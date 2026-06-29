-- GIEFA daily weighted interest allocation and finance report edit workflow
-- Run this in Supabase SQL Editor after supabase-statement-reporting.sql.

begin;

alter table public.finance_monthly_reports
  add column if not exists manual_interest_amount numeric,
  add column if not exists calculated_interest_amount numeric not null default 0,
  add column if not exists variance_amount numeric not null default 0,
  add column if not exists variance_status text not null default 'balanced';

alter table public.finance_monthly_reports
  drop constraint if exists finance_monthly_reports_status_check;

alter table public.finance_monthly_reports
  add constraint finance_monthly_reports_status_check
  check (status in ('draft', 'reviewed', 'final', 'edit_requested', 'edit_approved'));

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'finance_monthly_reports_variance_status_check'
  ) then
    alter table public.finance_monthly_reports
      add constraint finance_monthly_reports_variance_status_check
      check (variance_status in ('balanced', 'return_detected', 'deposit_exceeds_statement'));
  end if;
end $$;

create table if not exists public.finance_interest_allocations (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references public.finance_monthly_reports(id) on delete cascade,
  reporting_month text not null,
  member_id uuid not null references public.members(id) on delete cascade,
  opening_investment_balance numeric not null default 0,
  month_investment_deposits numeric not null default 0,
  weighted_balance numeric not null default 0,
  allocation_weight numeric not null default 0,
  interest_amount numeric not null default 0,
  days_in_month integer not null,
  calculation_method text not null default 'daily_weighted_balance',
  generated_at timestamptz not null default now(),
  unique (report_id, member_id)
);

create table if not exists public.finance_report_edit_requests (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references public.finance_monthly_reports(id) on delete cascade,
  requested_by uuid references public.members(id) on delete set null,
  approved_by uuid references public.members(id) on delete set null,
  reason text,
  chairman_note text,
  status text not null default 'requested',
  created_at timestamptz not null default now(),
  approved_at timestamptz,
  applied_at timestamptz,
  constraint finance_report_edit_requests_status_check
    check (status in ('requested', 'approved', 'rejected', 'applied'))
);

create table if not exists public.finance_report_adjustments (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references public.finance_monthly_reports(id) on delete cascade,
  edit_request_id uuid references public.finance_report_edit_requests(id) on delete set null,
  member_id uuid references public.members(id) on delete set null,
  adjustment_type text not null,
  amount numeric not null default 0,
  description text,
  reference text,
  created_by uuid references public.members(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint finance_report_adjustments_type_check
    check (adjustment_type in ('manual_member_deposit', 'manual_interest', 'correction'))
);

create index if not exists finance_interest_allocations_report_idx
  on public.finance_interest_allocations (report_id);

create index if not exists finance_interest_allocations_member_idx
  on public.finance_interest_allocations (member_id, reporting_month);

create index if not exists finance_report_edit_requests_report_idx
  on public.finance_report_edit_requests (report_id, status);

create index if not exists finance_report_adjustments_report_idx
  on public.finance_report_adjustments (report_id);

create or replace function public.recalculate_monthly_interest_allocations_v1(
  p_reporting_month text,
  p_manual_interest_amount numeric default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  report_record public.finance_monthly_reports%rowtype;
  month_start date;
  month_end date;
  month_days integer;
  approved_total numeric;
  manual_deposit_adjustment numeric;
  statement_movement numeric;
  interest_pool numeric;
  total_weighted_balance numeric;
begin
  if not public.is_approved_role(array['treasurer', 'chairman', 'admin']) then
    raise exception 'not authorized';
  end if;

  select *
  into report_record
  from public.finance_monthly_reports
  where reporting_month = p_reporting_month
  for update;

  if report_record.id is null then
    return;
  end if;

  month_start := to_date(p_reporting_month || '-01', 'YYYY-MM-DD');
  month_end := (month_start + interval '1 month - 1 day')::date;
  month_days := (month_end - month_start + 1);

  select coalesce(sum(amount), 0)
  into approved_total
  from public.deposit_submissions
  where status = 'approved'
    and contribution_month = p_reporting_month;

  select coalesce(sum(amount), 0)
  into manual_deposit_adjustment
  from public.finance_report_adjustments
  where report_id = report_record.id
    and adjustment_type = 'manual_member_deposit';

  approved_total := approved_total + manual_deposit_adjustment;
  statement_movement := coalesce(report_record.total_deposits, 0);
  interest_pool := coalesce(p_manual_interest_amount, report_record.manual_interest_amount);

  if interest_pool is null then
    interest_pool := greatest(statement_movement - approved_total, 0);
  end if;

  delete from public.finance_interest_allocations
  where report_id = report_record.id;

  create temporary table if not exists pg_temp.giefa_interest_weights (
    member_id uuid primary key,
    opening_investment_balance numeric not null,
    month_investment_deposits numeric not null,
    weighted_balance numeric not null
  ) on commit drop;

  truncate table pg_temp.giefa_interest_weights;

  insert into pg_temp.giefa_interest_weights (
    member_id,
    opening_investment_balance,
    month_investment_deposits,
    weighted_balance
  )
  select
    source.member_id,
    sum(source.opening_balance),
    sum(source.month_deposits),
    sum(source.weighted_amount)
  from (
    select
      ds.member_id,
      coalesce(sum(ds.investment_amount), 0) as opening_balance,
      0::numeric as month_deposits,
      coalesce(sum(ds.investment_amount), 0) * month_days as weighted_amount
    from public.deposit_submissions ds
    where ds.status = 'approved'
      and ds.deposit_date < month_start
    group by ds.member_id

    union all

    select
      ds.member_id,
      0::numeric as opening_balance,
      coalesce(sum(ds.investment_amount), 0) as month_deposits,
      coalesce(
        sum(
          ds.investment_amount *
          greatest((month_end - greatest(ds.deposit_date, month_start) + 1), 0)
        ),
        0
      ) as weighted_amount
    from public.deposit_submissions ds
    where ds.status = 'approved'
      and ds.deposit_date between month_start and month_end
    group by ds.member_id
  ) source
  group by source.member_id
  having sum(source.weighted_amount) > 0;

  select coalesce(sum(weighted_balance), 0)
  into total_weighted_balance
  from pg_temp.giefa_interest_weights;

  insert into public.finance_interest_allocations (
    report_id,
    reporting_month,
    member_id,
    opening_investment_balance,
    month_investment_deposits,
    weighted_balance,
    allocation_weight,
    interest_amount,
    days_in_month
  )
  select
    report_record.id,
    p_reporting_month,
    weights.member_id,
    weights.opening_investment_balance,
    weights.month_investment_deposits,
    weights.weighted_balance,
    case when total_weighted_balance > 0 then weights.weighted_balance / total_weighted_balance else 0 end,
    case when total_weighted_balance > 0 then round(interest_pool * (weights.weighted_balance / total_weighted_balance), 2) else 0 end,
    month_days
  from pg_temp.giefa_interest_weights weights
  on conflict (report_id, member_id) do update
  set opening_investment_balance = excluded.opening_investment_balance,
      month_investment_deposits = excluded.month_investment_deposits,
      weighted_balance = excluded.weighted_balance,
      allocation_weight = excluded.allocation_weight,
      interest_amount = excluded.interest_amount,
      days_in_month = excluded.days_in_month,
      generated_at = now();

  update public.finance_monthly_reports
  set approved_member_deposits = approved_total,
      unmatched_deposits = statement_movement - approved_total,
      manual_interest_amount = p_manual_interest_amount,
      calculated_interest_amount = interest_pool,
      variance_amount = statement_movement - approved_total,
      variance_status = case
        when approved_total > statement_movement then 'deposit_exceeds_statement'
        when statement_movement > approved_total then 'return_detected'
        else 'balanced'
      end,
      exception_count = case
        when approved_total > statement_movement then greatest(exception_count, 1)
        else exception_count
      end
  where id = report_record.id;
end;
$$;

create or replace function public.request_finance_report_edit_v1(
  p_report_id uuid,
  p_reason text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_id uuid;
begin
  if not public.is_approved_role(array['treasurer', 'admin']) then
    raise exception 'not authorized';
  end if;

  actor_id := public.current_member_uuid();

  insert into public.finance_report_edit_requests (report_id, requested_by, reason, status)
  values (p_report_id, actor_id, nullif(p_reason, ''), 'requested');

  update public.finance_monthly_reports
  set status = 'edit_requested'
  where id = p_report_id
    and status in ('draft', 'reviewed', 'final');
end;
$$;

create or replace function public.approve_finance_report_edit_v1(
  p_request_id uuid,
  p_approved boolean,
  p_note text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_id uuid;
  target_report_id uuid;
begin
  if not public.is_approved_role(array['chairman', 'admin']) then
    raise exception 'not authorized';
  end if;

  actor_id := public.current_member_uuid();

  select report_id
  into target_report_id
  from public.finance_report_edit_requests
  where id = p_request_id
    and status = 'requested'
  for update;

  if target_report_id is null then
    raise exception 'edit request not found or already decided';
  end if;

  update public.finance_report_edit_requests
  set status = case when p_approved then 'approved' else 'rejected' end,
      approved_by = actor_id,
      chairman_note = nullif(p_note, ''),
      approved_at = now()
  where id = p_request_id;

  update public.finance_monthly_reports
  set status = case when p_approved then 'edit_approved' else 'draft' end
  where id = target_report_id;
end;
$$;

create or replace function public.apply_finance_report_edit_v1(
  p_request_id uuid,
  p_manual_interest_amount numeric default null,
  p_manual_member_deposit_adjustment numeric default 0,
  p_notes text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_id uuid;
  target_report public.finance_monthly_reports%rowtype;
begin
  if not public.is_approved_role(array['treasurer', 'admin']) then
    raise exception 'not authorized';
  end if;

  actor_id := public.current_member_uuid();

  select reports.*
  into target_report
  from public.finance_report_edit_requests requests
  join public.finance_monthly_reports reports on reports.id = requests.report_id
  where requests.id = p_request_id
    and requests.status = 'approved'
  for update;

  if target_report.id is null then
    raise exception 'approved edit request not found';
  end if;

  if coalesce(p_manual_member_deposit_adjustment, 0) <> 0 then
    insert into public.finance_report_adjustments (
      report_id,
      edit_request_id,
      adjustment_type,
      amount,
      description,
      created_by
    )
    values (
      target_report.id,
      p_request_id,
      'manual_member_deposit',
      p_manual_member_deposit_adjustment,
      'Manual member/bank deposit adjustment during approved report edit',
      actor_id
    );
  end if;

  if p_manual_interest_amount is not null then
    insert into public.finance_report_adjustments (
      report_id,
      edit_request_id,
      adjustment_type,
      amount,
      description,
      created_by
    )
    values (
      target_report.id,
      p_request_id,
      'manual_interest',
      p_manual_interest_amount,
      'Manual monthly interest entered during approved report edit',
      actor_id
    );
  end if;

  update public.finance_monthly_reports
  set notes = concat_ws(E'\n', notes, nullif(p_notes, '')),
      status = 'draft'
  where id = target_report.id;

  update public.finance_report_edit_requests
  set status = 'applied',
      applied_at = now()
  where id = p_request_id;

  perform public.recalculate_monthly_interest_allocations_v1(
    target_report.reporting_month,
    p_manual_interest_amount
  );
end;
$$;

alter table public.finance_interest_allocations enable row level security;
alter table public.finance_report_edit_requests enable row level security;
alter table public.finance_report_adjustments enable row level security;

drop policy if exists "leadership view finance interest allocations" on public.finance_interest_allocations;
drop policy if exists "members view own finance interest allocations" on public.finance_interest_allocations;
drop policy if exists "leadership manage finance interest allocations" on public.finance_interest_allocations;
drop policy if exists "leadership view finance report edit requests" on public.finance_report_edit_requests;
drop policy if exists "finance request report edits" on public.finance_report_edit_requests;
drop policy if exists "chairman approve report edits" on public.finance_report_edit_requests;
drop policy if exists "leadership view finance report adjustments" on public.finance_report_adjustments;
drop policy if exists "finance manage finance report adjustments" on public.finance_report_adjustments;

create policy "leadership view finance interest allocations"
on public.finance_interest_allocations
for select
to authenticated
using (public.has_any_role(array['treasurer', 'chairman', 'admin']));

create policy "members view own finance interest allocations"
on public.finance_interest_allocations
for select
to authenticated
using (member_id = public.current_member_id());

create policy "leadership manage finance interest allocations"
on public.finance_interest_allocations
for all
to authenticated
using (public.has_any_role(array['treasurer', 'admin']))
with check (public.has_any_role(array['treasurer', 'admin']));

create policy "leadership view finance report edit requests"
on public.finance_report_edit_requests
for select
to authenticated
using (public.has_any_role(array['treasurer', 'chairman', 'admin']));

create policy "finance request report edits"
on public.finance_report_edit_requests
for insert
to authenticated
with check (public.has_any_role(array['treasurer', 'admin']));

create policy "chairman approve report edits"
on public.finance_report_edit_requests
for update
to authenticated
using (public.has_any_role(array['chairman', 'admin']))
with check (public.has_any_role(array['chairman', 'admin', 'treasurer']));

create policy "leadership view finance report adjustments"
on public.finance_report_adjustments
for select
to authenticated
using (public.has_any_role(array['treasurer', 'chairman', 'admin']));

create policy "finance manage finance report adjustments"
on public.finance_report_adjustments
for all
to authenticated
using (public.has_any_role(array['treasurer', 'admin']))
with check (public.has_any_role(array['treasurer', 'admin']));

grant execute on function public.recalculate_monthly_interest_allocations_v1(text, numeric) to authenticated;
grant execute on function public.request_finance_report_edit_v1(uuid, text) to authenticated;
grant execute on function public.approve_finance_report_edit_v1(uuid, boolean, text) to authenticated;
grant execute on function public.apply_finance_report_edit_v1(uuid, numeric, numeric, text) to authenticated;

notify pgrst, 'reload schema';

commit;

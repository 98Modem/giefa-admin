-- GIEFA emergency request cycle rules.
-- Run this in Supabase SQL Editor after deploying the matching app code.

begin;

alter table public.emergency_funds
  add column if not exists request_cycle_count integer not null default 0,
  add column if not exists last_refill_at timestamptz;

alter table public.emergency_funds
  drop constraint if exists emergency_funds_request_cycle_count_check,
  add constraint emergency_funds_request_cycle_count_check
    check (request_cycle_count between 0 and 2);

create or replace function public.approve_emergency_request(p_request_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_id uuid;
  target_member_id uuid;
  request_amount numeric;
  fund_available numeric;
  fund_cycle_count integer;
begin
  if not public.is_approved_role(array['treasurer', 'admin']) then
    raise exception 'not authorized';
  end if;

  actor_id := public.current_member_uuid();

  select member_id, amount
  into target_member_id, request_amount
  from public.emergency_requests
  where id = p_request_id
    and status = 'pending';

  if target_member_id is null then
    raise exception 'request not found or already decided';
  end if;

  select coalesce(available, 0), coalesce(request_cycle_count, 0)
  into fund_available, fund_cycle_count
  from public.emergency_funds
  where member_id = target_member_id
  for update;

  if fund_available is null then
    raise exception 'member has no emergency fund ledger';
  end if;

  if fund_available < 180000 then
    raise exception 'emergency balance must be at least UGX 180,000';
  end if;

  if fund_cycle_count >= 2 then
    raise exception 'member must refill emergency fund before another request';
  end if;

  if request_amount > floor(fund_available * 0.5) then
    raise exception 'request amount exceeds 50 percent of available emergency fund';
  end if;

  update public.emergency_requests
  set status = 'approved',
      approved_by = actor_id,
      approved_at = now()
  where id = p_request_id;

  update public.emergency_funds
  set total_withdrawn = coalesce(total_withdrawn, 0) + coalesce(request_amount, 0),
      available = coalesce(available, 0) - coalesce(request_amount, 0),
      request_cycle_count = least(coalesce(request_cycle_count, 0) + 1, 2)
  where member_id = target_member_id;

  insert into public.audit_logs (action, performed_by, target_member)
  values ('approve_emergency_request', actor_id, target_member_id);

  insert into public.notifications (member_id, message, read)
  values (target_member_id, 'Your emergency fund request was approved.', false);
end;
$$;

create or replace function public.approve_deposit_submission_v1(p_submission_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_id uuid;
  submission_record public.deposit_submissions%rowtype;
begin
  if not public.is_approved_role(array['treasurer', 'admin']) then
    raise exception 'not authorized';
  end if;

  actor_id := public.current_member_uuid();

  select *
  into submission_record
  from public.deposit_submissions
  where id = p_submission_id
    and status in ('submitted', 'needs_review')
  for update;

  if submission_record.id is null then
    raise exception 'deposit submission not found or already decided';
  end if;

  update public.deposit_submissions
  set status = 'approved',
      reviewed_by = actor_id,
      reviewed_at = now(),
      rejection_reason = null
  where id = p_submission_id;

  insert into public.monthly_contributions (
    member_id,
    month,
    amount,
    emergency_amount,
    investment_amount
  )
  values (
    submission_record.member_id,
    submission_record.contribution_month,
    submission_record.amount,
    submission_record.emergency_amount,
    submission_record.investment_amount
  );

  update public.emergency_funds
  set total_contributed = coalesce(total_contributed, 0) + submission_record.emergency_amount,
      available = coalesce(available, 0) + submission_record.emergency_amount,
      request_cycle_count = case
        when coalesce(request_cycle_count, 0) >= 2
          and coalesce(available, 0) + submission_record.emergency_amount >= 180000
        then 0
        else coalesce(request_cycle_count, 0)
      end,
      last_refill_at = case
        when coalesce(request_cycle_count, 0) >= 2
          and coalesce(available, 0) + submission_record.emergency_amount >= 180000
        then now()
        else last_refill_at
      end
  where member_id = submission_record.member_id;

  if not found and submission_record.emergency_amount > 0 then
    insert into public.emergency_funds (
      member_id,
      total_contributed,
      total_withdrawn,
      available,
      request_cycle_count,
      last_refill_at
    )
    values (
      submission_record.member_id,
      submission_record.emergency_amount,
      0,
      submission_record.emergency_amount,
      0,
      case when submission_record.emergency_amount >= 180000 then now() else null end
    );
  end if;

  update public.shares
  set total_amount = coalesce(total_amount, 0) + submission_record.investment_amount,
      total_shares = coalesce(total_shares, 0) + submission_record.investment_amount
  where member_id = submission_record.member_id;

  if not found and submission_record.investment_amount > 0 then
    insert into public.shares (
      member_id,
      total_amount,
      total_shares
    )
    values (
      submission_record.member_id,
      submission_record.investment_amount,
      submission_record.investment_amount
    );
  end if;

  begin
    if actor_id is not null then
      insert into public.audit_logs (action, performed_by, target_member)
      values ('approve_deposit_submission', actor_id, submission_record.member_id);
    end if;
  exception
    when foreign_key_violation then
      null;
  end;

  insert into public.notifications (member_id, message, read)
  values (
    submission_record.member_id,
    'Your deposit proof was approved and posted to your GIEFA ledger.',
    false
  );
end;
$$;

grant execute on function public.approve_emergency_request(uuid) to authenticated;
grant execute on function public.approve_deposit_submission_v1(uuid) to authenticated;

notify pgrst, 'reload schema';

commit;

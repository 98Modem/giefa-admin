-- GIEFA chairman/admin parity hotfix
-- Run this once in Supabase SQL Editor after the existing GIEFA scripts.
--
-- Purpose:
-- - Chairman can access and operate the same finance/system areas as admin when needed.
-- - Admin remains the technical fallback if chairman is unavailable or suspended.
-- - This script does not delete data. It replaces selected RLS policies and RPC functions.

begin;

-- ---------------------------------------------------------------------------
-- Storage and finance table policies
-- ---------------------------------------------------------------------------

drop policy if exists "finance upload bank statements" on storage.objects;
create policy "finance upload bank statements"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'bank-statements'
  and public.has_any_role(array['treasurer', 'chairman', 'admin'])
);

drop policy if exists "finance manage bank statement imports" on public.bank_statement_imports;
create policy "finance manage bank statement imports"
on public.bank_statement_imports
for all
to authenticated
using (public.has_any_role(array['treasurer', 'chairman', 'admin']))
with check (public.has_any_role(array['treasurer', 'chairman', 'admin']));

drop policy if exists "finance manage bank statement transactions" on public.bank_statement_transactions;
create policy "finance manage bank statement transactions"
on public.bank_statement_transactions
for all
to authenticated
using (public.has_any_role(array['treasurer', 'chairman', 'admin']))
with check (public.has_any_role(array['treasurer', 'chairman', 'admin']));

drop policy if exists "finance manage finance monthly reports" on public.finance_monthly_reports;
create policy "finance manage finance monthly reports"
on public.finance_monthly_reports
for all
to authenticated
using (public.has_any_role(array['treasurer', 'chairman', 'admin']))
with check (public.has_any_role(array['treasurer', 'chairman', 'admin']));

drop policy if exists "treasurer manage deposit submissions" on public.deposit_submissions;
create policy "treasurer manage deposit submissions"
on public.deposit_submissions
for update
to authenticated
using (public.has_any_role(array['treasurer', 'chairman', 'admin']))
with check (public.has_any_role(array['treasurer', 'chairman', 'admin']));

drop policy if exists "leadership manage finance interest allocations" on public.finance_interest_allocations;
create policy "leadership manage finance interest allocations"
on public.finance_interest_allocations
for all
to authenticated
using (public.has_any_role(array['treasurer', 'chairman', 'admin']))
with check (public.has_any_role(array['treasurer', 'chairman', 'admin']));

drop policy if exists "finance request report edits" on public.finance_report_edit_requests;
create policy "finance request report edits"
on public.finance_report_edit_requests
for insert
to authenticated
with check (public.has_any_role(array['treasurer', 'chairman', 'admin']));

drop policy if exists "chairman approve report edits" on public.finance_report_edit_requests;
create policy "chairman approve report edits"
on public.finance_report_edit_requests
for update
to authenticated
using (public.has_any_role(array['chairman', 'admin']))
with check (public.has_any_role(array['chairman', 'admin', 'treasurer']));

drop policy if exists "finance manage finance report adjustments" on public.finance_report_adjustments;
create policy "finance manage finance report adjustments"
on public.finance_report_adjustments
for all
to authenticated
using (public.has_any_role(array['treasurer', 'chairman', 'admin']))
with check (public.has_any_role(array['treasurer', 'chairman', 'admin']));

-- ---------------------------------------------------------------------------
-- Deposit review notifications and RPCs
-- ---------------------------------------------------------------------------

create or replace function public.notify_finance_deposit_submission()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.notifications (member_id, message, read)
  select
    members.id,
    'New deposit proof submitted for finance review.',
    false
  from public.members
  where members.status = 'approved'
    and members.role in ('treasurer', 'chairman', 'admin');

  return new;
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
  if not public.is_approved_role(array['treasurer', 'chairman', 'admin']) then
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
      available = coalesce(available, 0) + submission_record.emergency_amount
  where member_id = submission_record.member_id;

  if not found and submission_record.emergency_amount > 0 then
    insert into public.emergency_funds (
      member_id,
      total_contributed,
      total_withdrawn,
      available
    )
    values (
      submission_record.member_id,
      submission_record.emergency_amount,
      0,
      submission_record.emergency_amount
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

create or replace function public.reject_deposit_submission_v1(
  p_submission_id uuid,
  p_reason text default 'Finance could not match this deposit to the bank statement.'
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_id uuid;
  target_member_id uuid;
begin
  if not public.is_approved_role(array['treasurer', 'chairman', 'admin']) then
    raise exception 'not authorized';
  end if;

  actor_id := public.current_member_uuid();

  select member_id
  into target_member_id
  from public.deposit_submissions
  where id = p_submission_id
    and status in ('submitted', 'needs_review')
  for update;

  if target_member_id is null then
    raise exception 'deposit submission not found or already decided';
  end if;

  update public.deposit_submissions
  set status = 'rejected',
      reviewed_by = actor_id,
      reviewed_at = now(),
      rejection_reason = nullif(p_reason, '')
  where id = p_submission_id;

  begin
    if actor_id is not null then
      insert into public.audit_logs (action, performed_by, target_member)
      values ('reject_deposit_submission', actor_id, target_member_id);
    end if;
  exception
    when foreign_key_violation then
      null;
  end;

  insert into public.notifications (member_id, message, read)
  values (
    target_member_id,
    'Your deposit proof was rejected. Please review the finance note and resubmit if needed.',
    false
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Finance report edit workflow RPCs
-- ---------------------------------------------------------------------------

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
  if not public.is_approved_role(array['treasurer', 'chairman', 'admin']) then
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
  if not public.is_approved_role(array['treasurer', 'chairman', 'admin']) then
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

grant execute on function public.approve_deposit_submission_v1(uuid) to authenticated;
grant execute on function public.reject_deposit_submission_v1(uuid, text) to authenticated;
grant execute on function public.request_finance_report_edit_v1(uuid, text) to authenticated;
grant execute on function public.apply_finance_report_edit_v1(uuid, numeric, numeric, text) to authenticated;

notify pgrst, 'reload schema';

commit;

-- Optional verification after running:
-- select public.has_any_role(array['treasurer', 'chairman', 'admin']);
-- select pg_get_functiondef('public.approve_deposit_submission_v1(uuid)'::regprocedure);
-- select pg_get_functiondef('public.request_finance_report_edit_v1(uuid,text)'::regprocedure);

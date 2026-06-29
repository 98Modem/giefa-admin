-- GIEFA deposit approval hotfix
-- Run this in Supabase SQL Editor if approve/reject deposit fails with:
-- "insert or update on table audit_logs violates foreign key constraint ..."
--
-- The finance decision still updates deposit_submissions, monthly_contributions,
-- emergency_funds, shares, and notifications. Audit logging is attempted, but a
-- legacy audit_logs.performed_by foreign key cannot block finance posting.

begin;

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
  if not public.is_approved_role(array['treasurer', 'admin']) then
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

grant execute on function public.approve_deposit_submission_v1(uuid) to authenticated;
grant execute on function public.reject_deposit_submission_v1(uuid, text) to authenticated;

notify pgrst, 'reload schema';

commit;

-- Optional verification:
-- select pg_get_functiondef('public.approve_deposit_submission_v1(uuid)'::regprocedure);
-- select pg_get_functiondef('public.reject_deposit_submission_v1(uuid,text)'::regprocedure);

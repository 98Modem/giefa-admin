-- GIEFA deposit proof automation
-- Run this after the main GIEFA install script.

begin;

create table if not exists public.deposit_submissions (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.members(id) on delete cascade,
  contribution_month text not null,
  amount numeric not null check (amount > 0),
  emergency_amount numeric not null default 0 check (emergency_amount >= 0),
  investment_amount numeric not null default 0 check (investment_amount >= 0),
  deposit_date date not null,
  bank_reference text,
  sender_name text,
  proof_url text,
  extracted_text text,
  confidence numeric,
  status text not null default 'submitted',
  reviewed_by uuid references public.members(id) on delete set null,
  reviewed_at timestamptz,
  rejection_reason text,
  created_at timestamptz not null default now(),
  constraint deposit_submissions_status_check
    check (status in ('submitted', 'needs_review', 'approved', 'rejected')),
  constraint deposit_submissions_allocation_check
    check (amount = emergency_amount + investment_amount)
);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'deposit-proofs',
  'deposit-proofs',
  false,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "deposit proofs member read own" on storage.objects;
drop policy if exists "deposit proofs finance read" on storage.objects;
drop policy if exists "deposit proofs member upload own" on storage.objects;
drop policy if exists "deposit proofs member update own" on storage.objects;

create policy "deposit proofs member read own"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'deposit-proofs'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "deposit proofs finance read"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'deposit-proofs'
  and public.has_any_role(array['treasurer', 'chairman', 'admin'])
);

create policy "deposit proofs member upload own"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'deposit-proofs'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "deposit proofs member update own"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'deposit-proofs'
  and (storage.foldername(name))[1] = auth.uid()::text
)
with check (
  bucket_id = 'deposit-proofs'
  and (storage.foldername(name))[1] = auth.uid()::text
);

alter table public.deposit_submissions enable row level security;

drop policy if exists "member insert own deposit submissions" on public.deposit_submissions;
drop policy if exists "member view own deposit submissions" on public.deposit_submissions;
drop policy if exists "finance leadership view deposit submissions" on public.deposit_submissions;
drop policy if exists "treasurer manage deposit submissions" on public.deposit_submissions;

create policy "member insert own deposit submissions"
on public.deposit_submissions
for insert
to authenticated
with check (
  member_id = public.current_member_id()
  and status in ('submitted', 'needs_review')
);

create policy "member view own deposit submissions"
on public.deposit_submissions
for select
to authenticated
using (member_id = public.current_member_id());

create policy "finance leadership view deposit submissions"
on public.deposit_submissions
for select
to authenticated
using (public.has_any_role(array['treasurer', 'chairman', 'admin']));

create policy "treasurer manage deposit submissions"
on public.deposit_submissions
for update
to authenticated
using (public.has_any_role(array['treasurer', 'admin']))
with check (public.has_any_role(array['treasurer', 'admin']));

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
    and members.role in ('treasurer', 'admin');

  return new;
end;
$$;

drop trigger if exists on_deposit_submission_created on public.deposit_submissions;
create trigger on_deposit_submission_created
after insert on public.deposit_submissions
for each row execute function public.notify_finance_deposit_submission();

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

-- GIEFA Dashboard Supabase installation script
-- Project: Graduate Investment and Emergency Fund Association Dashboard
--
-- What this does:
-- 1. Removes old GIEFA policies from the app tables.
-- 2. Removes/replaces GIEFA helper and RPC functions.
-- 3. Enables RLS.
-- 4. Installs non-recursive RLS policies.
-- 5. Installs RPC functions used by the Next.js app.
--
-- Run this in Supabase SQL Editor while signed in as the project owner.

begin;

-- ---------------------------------------------------------------------------
-- 0. Clean old policies
-- ---------------------------------------------------------------------------

do $$
declare
  policy_record record;
  table_names text[] := array[
    'members',
    'emergency_requests',
    'monthly_contributions',
    'deposit_submissions',
    'emergency_funds',
    'shares',
    'audit_logs',
    'notifications'
  ];
begin
  for policy_record in
    select schemaname, tablename, policyname
    from pg_policies
    where schemaname = 'public'
      and tablename = any(table_names)
  loop
    execute format(
      'drop policy if exists %I on %I.%I',
      policy_record.policyname,
      policy_record.schemaname,
      policy_record.tablename
    );
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- 1. Clean old helper/RPC functions
-- ---------------------------------------------------------------------------

drop function if exists public.current_member();
drop function if exists public.current_member_id();
drop function if exists public.current_member_role();
drop function if exists public.current_member_uuid();
drop function if exists public.has_role(text);
drop function if exists public.has_any_role(text[]);
drop function if exists public.is_chairman_or_admin();
drop function if exists public.is_approved_role(text[]);
drop function if exists public.approve_member(uuid);
drop function if exists public.deny_member(uuid);
drop function if exists public.approve_member_v2(uuid);
drop function if exists public.deny_member_v2(uuid);
drop function if exists public.approve_suspension_v2(uuid);
drop function if exists public.reject_suspension_v2(uuid);
drop function if exists public.update_member_preferences_v2(text, text, text);
drop function if exists public.update_member_preferences_v2(text, integer, integer, text, text);
drop function if exists public.update_member_preferences_v2(text, integer, integer, text, text, text);
drop function if exists public.suspend_member(uuid);
drop function if exists public.approve_emergency_request(uuid);
drop function if exists public.reject_emergency_request(uuid);
drop function if exists public.notify_finance_deposit_submission() cascade;
drop function if exists public.approve_deposit_submission_v1(uuid);
drop function if exists public.reject_deposit_submission_v1(uuid, text);
drop trigger if exists on_auth_user_created on auth.users;
drop function if exists public.handle_new_auth_user();

-- Remove old public.members audit triggers. These caused deny/delete actions
-- to insert invalid audit_logs.performed_by values in earlier installs.
do $$
declare
  trigger_record record;
begin
  for trigger_record in
    select tgname
    from pg_trigger
    where tgrelid = 'public.members'::regclass
      and not tgisinternal
  loop
    execute format(
      'drop trigger if exists %I on public.members',
      trigger_record.tgname
    );
  end loop;
end $$;

-- Remove old finance ledger audit triggers. These can block deposit approval
-- when monthly_contributions, emergency_funds, or shares are posted.
do $$
declare
  trigger_record record;
  table_name text;
  table_names text[] := array[
    'monthly_contributions',
    'emergency_funds',
    'shares'
  ];
begin
  foreach table_name in array table_names
  loop
    for trigger_record in
      select tgname
      from pg_trigger
      where tgrelid = format('public.%I', table_name)::regclass
        and not tgisinternal
    loop
      execute format(
        'drop trigger if exists %I on public.%I',
        trigger_record.tgname,
        table_name
      );
    end loop;
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- 2. Non-recursive auth helpers
-- ---------------------------------------------------------------------------
-- SECURITY DEFINER is intentional. Policies on members must not query members
-- through RLS again, or you can hit recursive policy evaluation / stack depth.

create or replace function public.current_member_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select id
  from public.members
  where auth_user_id = auth.uid()
    and status = 'approved'
  limit 1
$$;

create or replace function public.current_member_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role::text
  from public.members
  where auth_user_id = auth.uid()
    and status = 'approved'
  limit 1
$$;

create or replace function public.has_role(required_role text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.current_member_role() = required_role
$$;

create or replace function public.has_any_role(required_roles text[])
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.current_member_role() = any(required_roles)
$$;

create or replace function public.is_chairman_or_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.has_any_role(array['chairman', 'admin'])
$$;

create or replace function public.is_approved_role(required_roles text[])
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.current_member_role() = any(required_roles)
$$;

-- Compatibility alias used by RPC functions.
create or replace function public.current_member_uuid()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select public.current_member_id()
$$;

grant execute on function public.current_member_id() to authenticated;
grant execute on function public.current_member_role() to authenticated;
grant execute on function public.has_role(text) to authenticated;
grant execute on function public.has_any_role(text[]) to authenticated;
grant execute on function public.is_chairman_or_admin() to authenticated;
grant execute on function public.is_approved_role(text[]) to authenticated;
grant execute on function public.current_member_uuid() to authenticated;

-- ---------------------------------------------------------------------------
-- 3. Auth signup trigger
-- ---------------------------------------------------------------------------
-- The browser must not insert directly into members during signup. Supabase
-- Auth creates auth.users, then this trigger creates the pending member row
-- with elevated database privileges.

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.members (
    auth_user_id,
    first_name,
    last_name,
    email,
    role,
    status
  )
  select
    new.id,
    coalesce(new.raw_user_meta_data ->> 'first_name', ''),
    coalesce(new.raw_user_meta_data ->> 'last_name', ''),
    new.email,
    'member',
    'pending'
  where not exists (
    select 1
    from public.members
    where auth_user_id = new.id
  );

  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_auth_user();

-- Repair users created before this trigger existed.
insert into public.members (
  auth_user_id,
  first_name,
  last_name,
  email,
  role,
  status
)
select
  users.id,
  coalesce(users.raw_user_meta_data ->> 'first_name', ''),
  coalesce(users.raw_user_meta_data ->> 'last_name', ''),
  users.email,
  'member',
  'pending'
from auth.users as users
where not exists (
  select 1
  from public.members
  where members.auth_user_id = users.id
);

-- ---------------------------------------------------------------------------
-- 4. Enable RLS
-- ---------------------------------------------------------------------------

alter table public.members
  add column if not exists avatar_url text,
  add column if not exists avatar_position_x integer not null default 50,
  add column if not exists avatar_position_y integer not null default 50,
  add column if not exists theme_mode text not null default 'system',
  add column if not exists color_theme text not null default 'blue',
  add column if not exists sidebar_position text not null default 'left';

alter table public.members
  drop constraint if exists members_avatar_position_x_check,
  add constraint members_avatar_position_x_check
    check (avatar_position_x between 0 and 100);

alter table public.members
  drop constraint if exists members_avatar_position_y_check,
  add constraint members_avatar_position_y_check
    check (avatar_position_y between 0 and 100);

alter table public.members
  drop constraint if exists members_theme_mode_check,
  add constraint members_theme_mode_check
    check (theme_mode in ('light', 'dark', 'system'));

alter table public.members
  drop constraint if exists members_color_theme_check,
  add constraint members_color_theme_check
    check (color_theme in ('blue', 'emerald', 'violet', 'rose', 'amber'));

alter table public.members
  drop constraint if exists members_sidebar_position_check,
  add constraint members_sidebar_position_check
    check (sidebar_position in ('left', 'right', 'floating'));

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
  'member-avatars',
  'member-avatars',
  true,
  2097152,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "member avatars public read" on storage.objects;
drop policy if exists "members upload own avatar" on storage.objects;
drop policy if exists "members update own avatar" on storage.objects;

create policy "member avatars public read"
on storage.objects
for select
to authenticated, anon
using (bucket_id = 'member-avatars');

create policy "members upload own avatar"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'member-avatars'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "members update own avatar"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'member-avatars'
  and (storage.foldername(name))[1] = auth.uid()::text
)
with check (
  bucket_id = 'member-avatars'
  and (storage.foldername(name))[1] = auth.uid()::text
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

alter table public.members enable row level security;
alter table public.emergency_requests enable row level security;
alter table public.monthly_contributions enable row level security;
alter table public.deposit_submissions enable row level security;
alter table public.emergency_funds enable row level security;
alter table public.shares enable row level security;
alter table public.audit_logs enable row level security;
alter table public.notifications enable row level security;

-- ---------------------------------------------------------------------------
-- 5. Members policies
-- ---------------------------------------------------------------------------

create policy "members insert own pending application"
on public.members
for insert
to authenticated
with check (
  auth_user_id = auth.uid()
  and role = 'member'
  and status = 'pending'
);

create policy "members view own record"
on public.members
for select
to authenticated
using (auth_user_id = auth.uid());

create policy "general secretary view members"
on public.members
for select
to authenticated
using (public.has_role('general_sec'));

create policy "chairman admin view members"
on public.members
for select
to authenticated
using (public.is_chairman_or_admin());

create policy "finance view member identities"
on public.members
for select
to authenticated
using (public.has_any_role(array['treasurer', 'admin']));

create policy "general secretary update member status"
on public.members
for update
to authenticated
using (public.has_role('general_sec'))
with check (status in ('pending', 'approved', 'denied', 'suspended'));

create policy "admin full members access"
on public.members
for all
to authenticated
using (public.has_role('admin'))
with check (public.has_role('admin'));

-- ---------------------------------------------------------------------------
-- 6. Emergency request policies
-- ---------------------------------------------------------------------------

create policy "member create own emergency request"
on public.emergency_requests
for insert
to authenticated
with check (
  member_id = public.current_member_id()
  and status = 'pending'
);

create policy "member view own emergency requests"
on public.emergency_requests
for select
to authenticated
using (member_id = public.current_member_id());

create policy "finance leadership view emergency requests"
on public.emergency_requests
for select
to authenticated
using (public.has_any_role(array['treasurer', 'chairman', 'admin']));

create policy "treasurer update emergency requests"
on public.emergency_requests
for update
to authenticated
using (public.has_any_role(array['treasurer', 'admin']))
with check (status in ('pending', 'approved', 'rejected'));

-- ---------------------------------------------------------------------------
-- 7. Monthly contribution policies
-- ---------------------------------------------------------------------------

create policy "member view own monthly contributions"
on public.monthly_contributions
for select
to authenticated
using (member_id = public.current_member_id());

create policy "finance leadership view monthly contributions"
on public.monthly_contributions
for select
to authenticated
using (public.has_any_role(array['treasurer', 'chairman', 'admin']));

create policy "treasurer manage monthly contributions"
on public.monthly_contributions
for all
to authenticated
using (public.has_any_role(array['treasurer', 'admin']))
with check (public.has_any_role(array['treasurer', 'admin']));

-- ---------------------------------------------------------------------------
-- 8. Deposit submission policies
-- ---------------------------------------------------------------------------

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

-- ---------------------------------------------------------------------------
-- 9. Emergency fund policies
-- ---------------------------------------------------------------------------

create policy "member view own emergency fund"
on public.emergency_funds
for select
to authenticated
using (member_id = public.current_member_id());

create policy "finance leadership view emergency funds"
on public.emergency_funds
for select
to authenticated
using (public.has_any_role(array['treasurer', 'chairman', 'admin']));

create policy "treasurer manage emergency funds"
on public.emergency_funds
for all
to authenticated
using (public.has_any_role(array['treasurer', 'admin']))
with check (public.has_any_role(array['treasurer', 'admin']));

-- ---------------------------------------------------------------------------
-- 10. Shares / investment policies
-- ---------------------------------------------------------------------------

create policy "member view own shares"
on public.shares
for select
to authenticated
using (member_id = public.current_member_id());

create policy "finance leadership view shares"
on public.shares
for select
to authenticated
using (public.has_any_role(array['treasurer', 'chairman', 'admin']));

create policy "treasurer manage shares"
on public.shares
for all
to authenticated
using (public.has_any_role(array['treasurer', 'admin']))
with check (public.has_any_role(array['treasurer', 'admin']));

-- ---------------------------------------------------------------------------
-- 11. Notifications policies
-- ---------------------------------------------------------------------------

create policy "member view own notifications"
on public.notifications
for select
to authenticated
using (member_id = public.current_member_id());

create policy "leadership create notifications"
on public.notifications
for insert
to authenticated
with check (public.has_any_role(array['admin', 'chairman', 'general_sec', 'treasurer']));

create policy "member mark own notifications read"
on public.notifications
for update
to authenticated
using (member_id = public.current_member_id())
with check (member_id = public.current_member_id());

-- ---------------------------------------------------------------------------
-- 12. Audit log policies
-- ---------------------------------------------------------------------------

create policy "chairman admin view audit logs"
on public.audit_logs
for select
to authenticated
using (public.is_chairman_or_admin());

create policy "leadership insert audit logs"
on public.audit_logs
for insert
to authenticated
with check (public.has_any_role(array['admin', 'chairman', 'general_sec', 'treasurer']));

-- ---------------------------------------------------------------------------
-- 13. RPC functions used by the Next.js app
-- ---------------------------------------------------------------------------

create or replace function public.approve_member(p_member_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_id uuid;
begin
  if not public.is_approved_role(array['general_sec', 'admin']) then
    raise exception 'not authorized';
  end if;

  actor_id := public.current_member_uuid();

  update public.members
  set status = 'approved',
      role = case
        when role in ('admin', 'chairman', 'treasurer', 'general_sec') then role
        else 'member'
      end
  where id = p_member_id
    and status = 'pending';

  insert into public.audit_logs (action, performed_by, target_member)
  values ('approve_member', actor_id, p_member_id);

  insert into public.notifications (member_id, message, read)
  values (p_member_id, 'Your GIEFA membership was approved.', false);
end;
$$;

create or replace function public.deny_member(p_member_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_approved_role(array['general_sec', 'admin']) then
    raise exception 'not authorized';
  end if;

  delete from public.members
  where id = p_member_id
    and status = 'pending';
end;
$$;

create or replace function public.approve_member_v2(p_member_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_id uuid;
begin
  if not public.is_approved_role(array['general_sec', 'admin']) then
    raise exception 'not authorized';
  end if;

  actor_id := public.current_member_id();

  update public.members
  set status = 'approved',
      role = case
        when role in ('admin', 'chairman', 'treasurer', 'general_sec') then role
        else 'member'
      end
  where id = p_member_id
    and status = 'pending';

  if actor_id is not null then
    insert into public.audit_logs (action, performed_by, target_member)
    values ('approve_member', actor_id, p_member_id);
  end if;

  insert into public.notifications (member_id, message, read)
  values (p_member_id, 'Your GIEFA membership was approved.', false);
end;
$$;

create or replace function public.deny_member_v2(p_member_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_approved_role(array['general_sec', 'admin']) then
    raise exception 'not authorized';
  end if;

  delete from public.members
  where id = p_member_id
    and status = 'pending';
end;
$$;

create or replace function public.approve_suspension_v2(p_member_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_id uuid;
begin
  if not public.is_approved_role(array['chairman', 'admin']) then
    raise exception 'not authorized';
  end if;

  actor_id := public.current_member_id();

  update public.members
  set status = 'suspended'
  where id = p_member_id
    and status = 'suspended';

  if actor_id is not null then
    insert into public.audit_logs (action, performed_by, target_member)
    values ('approve_suspension', actor_id, p_member_id);
  end if;

  insert into public.notifications (member_id, message, read)
  values (p_member_id, 'Your GIEFA account suspension has been reviewed and remains active.', false);
end;
$$;

create or replace function public.reject_suspension_v2(p_member_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_id uuid;
begin
  if not public.is_approved_role(array['chairman', 'admin']) then
    raise exception 'not authorized';
  end if;

  actor_id := public.current_member_id();

  update public.members
  set status = 'approved'
  where id = p_member_id
    and status = 'suspended';

  if actor_id is not null then
    insert into public.audit_logs (action, performed_by, target_member)
    values ('reject_suspension', actor_id, p_member_id);
  end if;

  insert into public.notifications (member_id, message, read)
  values (p_member_id, 'Your GIEFA account suspension was rejected. Access has been restored.', false);
end;
$$;

create or replace function public.update_member_preferences_v2(
  p_avatar_url text default null,
  p_avatar_position_x integer default null,
  p_avatar_position_y integer default null,
  p_theme_mode text default null,
  p_color_theme text default null,
  p_sidebar_position text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_theme_mode is not null and p_theme_mode not in ('light', 'dark', 'system') then
    raise exception 'invalid theme mode';
  end if;

  if p_color_theme is not null and p_color_theme not in ('blue', 'emerald', 'violet', 'rose', 'amber') then
    raise exception 'invalid color theme';
  end if;

  if p_sidebar_position is not null and p_sidebar_position not in ('left', 'right', 'floating') then
    raise exception 'invalid sidebar position';
  end if;

  if p_avatar_position_x is not null and (p_avatar_position_x < 0 or p_avatar_position_x > 100) then
    raise exception 'invalid avatar horizontal position';
  end if;

  if p_avatar_position_y is not null and (p_avatar_position_y < 0 or p_avatar_position_y > 100) then
    raise exception 'invalid avatar vertical position';
  end if;

  update public.members
  set avatar_url = coalesce(p_avatar_url, avatar_url),
      avatar_position_x = coalesce(p_avatar_position_x, avatar_position_x),
      avatar_position_y = coalesce(p_avatar_position_y, avatar_position_y),
      theme_mode = coalesce(p_theme_mode, theme_mode),
      color_theme = coalesce(p_color_theme, color_theme),
      sidebar_position = coalesce(p_sidebar_position, sidebar_position)
  where auth_user_id = auth.uid()
    and status = 'approved';
end;
$$;

create or replace function public.suspend_member(p_member_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_id uuid;
begin
  if not public.is_approved_role(array['general_sec', 'admin']) then
    raise exception 'not authorized';
  end if;

  actor_id := public.current_member_uuid();

  update public.members
  set status = 'suspended'
  where id = p_member_id
    and status = 'approved'
    and role <> 'admin';

  insert into public.audit_logs (action, performed_by, target_member)
  values ('suspend_member', actor_id, p_member_id);
end;
$$;

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

  update public.emergency_requests
  set status = 'approved',
      approved_by = actor_id,
      approved_at = now()
  where id = p_request_id;

  update public.emergency_funds
  set total_withdrawn = coalesce(total_withdrawn, 0) + coalesce(request_amount, 0),
      available = coalesce(available, 0) - coalesce(request_amount, 0)
  where member_id = target_member_id;

  insert into public.audit_logs (action, performed_by, target_member)
  values ('approve_emergency_request', actor_id, target_member_id);

  insert into public.notifications (member_id, message, read)
  values (target_member_id, 'Your emergency fund request was approved.', false);
end;
$$;

create or replace function public.reject_emergency_request(p_request_id uuid)
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
  from public.emergency_requests
  where id = p_request_id
    and status = 'pending';

  if target_member_id is null then
    raise exception 'request not found or already decided';
  end if;

  update public.emergency_requests
  set status = 'rejected',
      approved_by = actor_id,
      approved_at = now()
  where id = p_request_id;

  insert into public.audit_logs (action, performed_by, target_member)
  values ('reject_emergency_request', actor_id, target_member_id);

  insert into public.notifications (member_id, message, read)
  values (target_member_id, 'Your emergency fund request was rejected.', false);
end;
$$;

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

grant execute on function public.approve_member(uuid) to authenticated;
grant execute on function public.deny_member(uuid) to authenticated;
grant execute on function public.approve_member_v2(uuid) to authenticated;
grant execute on function public.deny_member_v2(uuid) to authenticated;
grant execute on function public.approve_suspension_v2(uuid) to authenticated;
grant execute on function public.reject_suspension_v2(uuid) to authenticated;
grant execute on function public.update_member_preferences_v2(text, integer, integer, text, text, text) to authenticated;
grant execute on function public.suspend_member(uuid) to authenticated;
grant execute on function public.approve_emergency_request(uuid) to authenticated;
grant execute on function public.reject_emergency_request(uuid) to authenticated;
grant execute on function public.approve_deposit_submission_v1(uuid) to authenticated;
grant execute on function public.reject_deposit_submission_v1(uuid, text) to authenticated;

notify pgrst, 'reload schema';

commit;

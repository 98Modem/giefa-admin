# GIEFA Supabase RLS Reset

This script rebuilds the core GIEFA policies without recursive `members` table
policy checks. Run it in the Supabase SQL editor after confirming existing audit
triggers/functions have been removed or renamed.

```sql
begin;

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------
-- SECURITY DEFINER is intentional here. These helpers are used by policies on
-- members, so they must not re-enter members RLS while resolving the current
-- user's approved role.

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

-- ---------------------------------------------------------------------------
-- Drop existing policies for a clean rebuild
-- ---------------------------------------------------------------------------

do $$
declare
  policy_record record;
  table_names text[] := array[
    'members',
    'emergency_requests',
    'monthly_contributions',
    'emergency_funds',
    'shares',
    'notifications',
    'audit_logs'
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
-- Members
-- ---------------------------------------------------------------------------

alter table public.members enable row level security;

create policy "members insert own pending application"
on public.members
for insert
with check (
  auth_user_id = auth.uid()
  and role = 'member'
  and status = 'pending'
);

create policy "members view own record"
on public.members
for select
using (auth_user_id = auth.uid());

create policy "general secretary view members"
on public.members
for select
using (public.has_role('general_sec'));

create policy "general secretary update member status"
on public.members
for update
using (public.has_role('general_sec'))
with check (
  status in ('pending', 'approved', 'denied', 'suspended')
);

create policy "chairman admin full members access"
on public.members
for all
using (public.is_chairman_or_admin())
with check (public.is_chairman_or_admin());

-- ---------------------------------------------------------------------------
-- Emergency requests
-- ---------------------------------------------------------------------------

alter table public.emergency_requests enable row level security;

create policy "member create own emergency request"
on public.emergency_requests
for insert
with check (member_id = public.current_member_id());

create policy "member view own emergency requests"
on public.emergency_requests
for select
using (member_id = public.current_member_id());

create policy "treasurer view emergency requests"
on public.emergency_requests
for select
using (public.has_any_role(array['treasurer', 'chairman', 'admin']));

create policy "treasurer decide emergency requests"
on public.emergency_requests
for update
using (public.has_role('treasurer'))
with check (status in ('approved', 'rejected'));

create policy "chairman admin manage emergency requests"
on public.emergency_requests
for all
using (public.is_chairman_or_admin())
with check (public.is_chairman_or_admin());

-- ---------------------------------------------------------------------------
-- Monthly contributions
-- ---------------------------------------------------------------------------

alter table public.monthly_contributions enable row level security;

create policy "member view own monthly contributions"
on public.monthly_contributions
for select
using (member_id = public.current_member_id());

create policy "finance leadership view monthly contributions"
on public.monthly_contributions
for select
using (public.has_any_role(array['treasurer', 'chairman', 'admin']));

create policy "treasurer manage monthly contributions"
on public.monthly_contributions
for all
using (public.has_any_role(array['treasurer', 'admin']))
with check (public.has_any_role(array['treasurer', 'admin']));

-- ---------------------------------------------------------------------------
-- Emergency fund balances
-- ---------------------------------------------------------------------------

alter table public.emergency_funds enable row level security;

create policy "member view own emergency fund"
on public.emergency_funds
for select
using (member_id = public.current_member_id());

create policy "finance leadership view emergency funds"
on public.emergency_funds
for select
using (public.has_any_role(array['treasurer', 'chairman', 'admin']));

create policy "treasurer manage emergency funds"
on public.emergency_funds
for all
using (public.has_any_role(array['treasurer', 'admin']))
with check (public.has_any_role(array['treasurer', 'admin']));

-- ---------------------------------------------------------------------------
-- Investment shares
-- ---------------------------------------------------------------------------

alter table public.shares enable row level security;

create policy "member view own shares"
on public.shares
for select
using (member_id = public.current_member_id());

create policy "finance leadership view shares"
on public.shares
for select
using (public.has_any_role(array['treasurer', 'chairman', 'admin']));

create policy "treasurer manage shares"
on public.shares
for all
using (public.has_any_role(array['treasurer', 'admin']))
with check (public.has_any_role(array['treasurer', 'admin']));

-- ---------------------------------------------------------------------------
-- Notifications
-- ---------------------------------------------------------------------------

alter table public.notifications enable row level security;

create policy "member view own notifications"
on public.notifications
for select
using (member_id = public.current_member_id());

create policy "leadership create notifications"
on public.notifications
for insert
with check (public.has_any_role(array['admin', 'chairman', 'general_sec', 'treasurer']));

-- ---------------------------------------------------------------------------
-- Audit logs
-- ---------------------------------------------------------------------------

alter table public.audit_logs enable row level security;

create policy "chairman admin view audit logs"
on public.audit_logs
for select
using (public.is_chairman_or_admin());

create policy "admin insert audit logs"
on public.audit_logs
for insert
with check (public.has_role('admin'));

commit;
```

## Recommended RPC functions

For governance actions that need strict transitions, prefer RPC functions over
direct table updates:

- `approve_member(member_id uuid)` for General Secretary and Admin.
- `deny_member(member_id uuid)` for General Secretary and Admin.
- `suspend_member(member_id uuid, reason text)` for General Secretary and Admin.
- `approve_emergency_request(request_id uuid)` for Treasurer and Admin.
- `reject_emergency_request(request_id uuid, reason text)` for Treasurer and Admin.
- `request_member_deletion(member_id uuid)` for General Secretary.
- `approve_member_deletion(member_id uuid)` for Chairman and Admin.

RPCs can validate old and new values in one transaction, insert audit rows, and
avoid broad update policies doing more than intended.

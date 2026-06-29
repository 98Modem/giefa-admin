-- GIEFA membership actions hotfix
-- Run this in Supabase SQL Editor if Deny or Approve fails with:
-- "insert or update on table audit_logs violates foreign key constraint ..."
--
-- This creates fresh membership RPCs with clean implementations:
-- - approve_member_v2 changes pending members to approved and removes them from Pending.
-- - deny_member_v2 deletes pending members from public.members.
-- - approve_suspension_v2 confirms suspension review.
-- - reject_suspension_v2 restores a suspended member to approved access.
-- - leftover audit triggers on public.members are removed because they can
--   insert invalid audit_logs.performed_by values during delete/update.

begin;

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

create or replace function public.current_member_uuid()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select public.current_member_id()
$$;

drop function if exists public.approve_member(uuid);
drop function if exists public.deny_member(uuid);
drop function if exists public.approve_member_v2(uuid);
drop function if exists public.deny_member_v2(uuid);
drop function if exists public.approve_suspension_v2(uuid);
drop function if exists public.reject_suspension_v2(uuid);

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

grant execute on function public.current_member_id() to authenticated;
grant execute on function public.current_member_uuid() to authenticated;
grant execute on function public.approve_member_v2(uuid) to authenticated;
grant execute on function public.deny_member_v2(uuid) to authenticated;
grant execute on function public.approve_suspension_v2(uuid) to authenticated;
grant execute on function public.reject_suspension_v2(uuid) to authenticated;

notify pgrst, 'reload schema';

commit;

-- Optional verification after running:
-- select tgname from pg_trigger where tgrelid = 'public.members'::regclass and not tgisinternal;
-- select pg_get_functiondef('public.approve_member_v2(uuid)'::regprocedure);
-- select pg_get_functiondef('public.deny_member_v2(uuid)'::regprocedure);
-- select pg_get_functiondef('public.approve_suspension_v2(uuid)'::regprocedure);
-- select pg_get_functiondef('public.reject_suspension_v2(uuid)'::regprocedure);

-- GIEFA controlled role assignment RPC
-- Run this in Supabase SQL Editor after the main install/parity scripts.
--
-- Purpose:
-- - Lets chairman/admin assign member roles without relying on direct members
--   table updates from the browser session.
-- - Keeps chairman succession safe.
-- - Prevents chairman from assigning the technical admin role.
-- - Avoids recursive RLS checks by using SECURITY DEFINER.

begin;

create or replace function public.assign_member_role(
  p_target_member_id uuid,
  p_next_role text
)
returns table (
  target_member_id uuid,
  target_auth_user_id uuid,
  old_role text,
  new_role text,
  self_change boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_record public.members%rowtype;
  target_record public.members%rowtype;
  previous_role text;
  remaining_chairmen integer;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  select *
  into actor_record
  from public.members
  where auth_user_id = auth.uid()
    and status = 'approved'
  limit 1;

  if actor_record.id is null then
    raise exception 'Only approved leadership users can assign roles.';
  end if;

  if actor_record.role not in ('chairman', 'admin') then
    raise exception 'Only chairman or admin can assign association roles.';
  end if;

  if p_next_role not in ('admin', 'chairman', 'treasurer', 'general_sec', 'member') then
    raise exception 'Choose a valid member and role.';
  end if;

  select *
  into target_record
  from public.members
  where id = p_target_member_id
    and status = 'approved'
  for update;

  if target_record.id is null then
    raise exception 'Roles can only be assigned to approved active members.';
  end if;

  if actor_record.role = 'chairman' and p_next_role = 'admin' then
    raise exception 'Chairman cannot assign the technical admin role.';
  end if;

  if target_record.role = 'chairman'
     and p_next_role <> 'chairman'
     and actor_record.role <> 'admin' then
    select count(*)
    into remaining_chairmen
    from public.members
    where status = 'approved'
      and role = 'chairman'
      and id <> target_record.id;

    if remaining_chairmen = 0 then
      raise exception 'Assign another approved member as chairman before the current chairman changes role.';
    end if;
  end if;

  previous_role := target_record.role;

  update public.members
  set role = p_next_role
  where id = target_record.id
  returning * into target_record;

  begin
    insert into public.audit_logs (action, performed_by, target_member)
    values ('assign_member_role', actor_record.id, target_record.id);
  exception
    when undefined_table or foreign_key_violation then
      null;
  end;

  return query
  select
    target_record.id,
    target_record.auth_user_id,
    previous_role,
    target_record.role::text,
    actor_record.id = target_record.id;
end;
$$;

revoke all on function public.assign_member_role(uuid, text) from public;
grant execute on function public.assign_member_role(uuid, text) to authenticated;

notify pgrst, 'reload schema';

commit;

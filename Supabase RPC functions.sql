-- GIEFA RPC functions for app/actions/giefa.ts
-- Run this in the Supabase SQL editor after the RLS policy reset script.

create or replace function public.is_approved_role(required_roles text[])
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.members
    where auth_user_id = auth.uid()
      and status = 'approved'
      and role = any(required_roles)
  )
$$;

create or replace function public.current_member_uuid()
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
      role = case when role in ('admin', 'chairman', 'treasurer', 'general_sec') then role else 'member' end
  where id = p_member_id
    and status = 'pending';

  insert into public.audit_logs (action, performed_by, target_member)
  values ('approve_member', actor_id, p_member_id);
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

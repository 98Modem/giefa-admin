-- GIEFA atomic General Secretary succession and meeting reminder defaults.
-- Run after supabase-install.sql and supabase-meetings-whatsapp.sql.

begin;

do $$
declare
  active_secretary_count integer;
begin
  select count(*)
  into active_secretary_count
  from public.members
  where role::text = 'general_sec'
    and status::text = 'approved';

  if active_secretary_count <> 1 then
    raise exception
      'General Secretary migration requires exactly one active GS; found %',
      active_secretary_count;
  end if;
end;
$$;

create table if not exists public.general_secretary_transfers (
  id uuid primary key default gen_random_uuid(),
  outgoing_member_id uuid references public.members(id) on delete set null,
  incoming_member_id uuid references public.members(id) on delete set null,
  approved_by uuid references public.members(id) on delete set null,
  outgoing_member_name text not null,
  incoming_member_name text not null,
  approved_by_name text not null,
  incoming_previous_role text not null,
  reason text not null check (char_length(reason) between 10 and 500),
  approved_at timestamptz not null default now()
);

create index if not exists general_secretary_transfers_approved_at_idx
  on public.general_secretary_transfers (approved_at desc);

-- A constant-expression partial unique index allows no more than one approved GS.
create unique index if not exists members_one_active_general_secretary_idx
  on public.members ((1))
  where role::text = 'general_sec'
    and status::text = 'approved';

alter table public.general_secretary_transfers enable row level security;

drop policy if exists "chairman admin view secretary transfers"
  on public.general_secretary_transfers;
create policy "chairman admin view secretary transfers"
on public.general_secretary_transfers
for select
to authenticated
using (public.has_any_role(array['chairman', 'admin']));

grant select on public.general_secretary_transfers to authenticated;
revoke insert, update, delete on public.general_secretary_transfers
  from anon, authenticated;

-- Ordinary member updates may never change a role. Authorized RPCs set a
-- transaction-local marker immediately before their role updates.
create or replace function public.guard_member_role_change_v1()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.role::text is distinct from old.role::text
     and coalesce(current_setting('giefa.role_change_authorized', true), '') <> 'on'
     and coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'member roles must be changed through an authorized governance action';
  end if;

  return new;
end;
$$;

drop trigger if exists guard_member_role_change_v1 on public.members;
create trigger guard_member_role_change_v1
before update of role on public.members
for each row
execute function public.guard_member_role_change_v1();

-- This deferred check permits the two updates inside a transfer while ensuring
-- every committed transaction finishes with exactly one approved GS.
create or replace function public.enforce_one_active_general_secretary_v1()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  active_secretary_count integer;
begin
  select count(*)
  into active_secretary_count
  from public.members
  where role::text = 'general_sec'
    and status::text = 'approved';

  if active_secretary_count <> 1 then
    raise exception 'GIEFA must have exactly one active General Secretary';
  end if;

  return null;
end;
$$;

drop trigger if exists enforce_one_active_general_secretary_v1 on public.members;
create constraint trigger enforce_one_active_general_secretary_v1
after insert or delete or update of role, status on public.members
deferrable initially deferred
for each row
execute function public.enforce_one_active_general_secretary_v1();

create or replace function public.assign_member_role_v2(
  p_member_id uuid,
  p_next_role text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_id uuid;
  actor_role text;
  target_role text;
  target_status text;
  target_name text;
  other_chairman_count integer;
begin
  actor_id := public.current_member_id();
  actor_role := public.current_member_role();

  if actor_id is null or actor_role not in ('chairman', 'admin') then
    raise exception 'only the Chairman or Admin can assign association roles';
  end if;

  if p_next_role not in ('chairman', 'treasurer', 'member') then
    raise exception 'General Secretary changes require the audited transfer action';
  end if;

  select
    member.role::text,
    member.status::text,
    coalesce(
      nullif(btrim(concat_ws(' ', member.first_name, member.last_name)), ''),
      member.email,
      'Unknown member'
    )
  into target_role, target_status, target_name
  from public.members member
  where member.id = p_member_id
  for update;

  if not found or target_status <> 'approved' then
    raise exception 'roles can only be assigned to approved members';
  end if;

  if target_role = 'general_sec' then
    raise exception 'use Transfer General Secretary to change the active GS';
  end if;

  if target_role = 'admin' then
    raise exception 'the technical Admin role cannot be changed here';
  end if;

  if target_role = 'chairman' and p_next_role <> 'chairman' and actor_role <> 'admin' then
    select count(*)
    into other_chairman_count
    from public.members
    where role::text = 'chairman'
      and status::text = 'approved'
      and id <> p_member_id;

    if other_chairman_count = 0 then
      raise exception 'assign another Chairman before changing the current Chairman role';
    end if;
  end if;

  perform set_config('giefa.role_change_authorized', 'on', true);
  execute format(
    'update public.members set role = %L where id = $1',
    p_next_role
  ) using p_member_id;

  insert into public.notifications (
    member_id, title, message, type, link_url, read
  ) values (
    p_member_id,
    'Role updated',
    'Your GIEFA role has changed to ' || replace(p_next_role, '_', ' ') || '.',
    'role_updated',
    '/dashboard',
    false
  );

  begin
    insert into public.audit_logs (action, performed_by, target_member)
    values (
      'assign_role:' || p_next_role || ':' || target_name,
      actor_id,
      p_member_id
    );
  exception when others then
    null;
  end;
end;
$$;

create or replace function public.transfer_general_secretary_v1(
  p_incoming_member_id uuid,
  p_reason text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_id uuid;
  actor_role text;
  actor_name text;
  outgoing_member_id uuid;
  outgoing_name text;
  incoming_name text;
  incoming_role text;
  incoming_status text;
  normalized_reason text;
  transfer_id uuid;
begin
  actor_id := public.current_member_id();
  actor_role := public.current_member_role();

  if actor_id is null or actor_role not in ('chairman', 'admin') then
    raise exception 'only the Chairman or Admin can approve a GS transfer';
  end if;

  normalized_reason := btrim(coalesce(p_reason, ''));
  if char_length(normalized_reason) < 10 or char_length(normalized_reason) > 500 then
    raise exception 'provide a transfer reason between 10 and 500 characters';
  end if;

  -- Serialize all GS transfers, including simultaneous requests.
  perform pg_advisory_xact_lock(hashtextextended('giefa:general-secretary-transfer', 0));

  select coalesce(
    nullif(btrim(concat_ws(' ', member.first_name, member.last_name)), ''),
    member.email,
    'Unknown approver'
  )
  into actor_name
  from public.members member
  where member.id = actor_id;

  select
    member.id,
    coalesce(
      nullif(btrim(concat_ws(' ', member.first_name, member.last_name)), ''),
      member.email,
      'Unknown member'
    )
  into outgoing_member_id, outgoing_name
  from public.members member
  where member.role::text = 'general_sec'
    and member.status::text = 'approved'
  for update;

  if not found then
    raise exception 'no active General Secretary was found';
  end if;

  if outgoing_member_id = p_incoming_member_id then
    raise exception 'choose a different member as the incoming General Secretary';
  end if;

  select
    coalesce(
      nullif(btrim(concat_ws(' ', member.first_name, member.last_name)), ''),
      member.email,
      'Unknown member'
    ),
    member.role::text,
    member.status::text
  into incoming_name, incoming_role, incoming_status
  from public.members member
  where member.id = p_incoming_member_id
  for update;

  if not found or incoming_status <> 'approved' then
    raise exception 'the incoming General Secretary must be an approved member';
  end if;

  if incoming_role <> 'member' then
    raise exception 'the incoming General Secretary must first be a normal member';
  end if;

  perform set_config('giefa.role_change_authorized', 'on', true);

  update public.members
  set role = 'member'
  where id = outgoing_member_id;

  update public.members
  set role = 'general_sec'
  where id = p_incoming_member_id;

  insert into public.general_secretary_transfers (
    outgoing_member_id,
    incoming_member_id,
    approved_by,
    outgoing_member_name,
    incoming_member_name,
    approved_by_name,
    incoming_previous_role,
    reason
  ) values (
    outgoing_member_id,
    p_incoming_member_id,
    actor_id,
    outgoing_name,
    incoming_name,
    actor_name,
    incoming_role,
    normalized_reason
  ) returning id into transfer_id;

  insert into public.notifications (
    member_id, title, message, type, link_url, read
  ) values
  (
    outgoing_member_id,
    'General Secretary term transferred',
    'Your General Secretary authority has ended and your role is now Member.',
    'general_secretary_transfer',
    '/dashboard',
    false
  ),
  (
    p_incoming_member_id,
    'You are the General Secretary',
    'You have been assigned as GIEFA General Secretary. Your governance access is active.',
    'general_secretary_transfer',
    '/members/meetings',
    false
  );

  begin
    insert into public.audit_logs (action, performed_by, target_member)
    values (
      'transfer_general_secretary:' || transfer_id::text,
      actor_id,
      p_incoming_member_id
    );
  exception when others then
    null;
  end;

  return transfer_id;
end;
$$;

revoke all on function public.assign_member_role_v2(uuid, text) from public;
revoke all on function public.transfer_general_secretary_v1(uuid, text) from public;
grant execute on function public.assign_member_role_v2(uuid, text) to authenticated;
grant execute on function public.transfer_general_secretary_v1(uuid, text) to authenticated;

alter table public.meetings
  alter column reminder_minutes set default array[10080, 1440, 60];

create or replace function public.schedule_meeting_v1(
  p_title text,
  p_meeting_type text,
  p_description text,
  p_location text,
  p_meeting_url text,
  p_starts_at timestamptz,
  p_duration_minutes integer,
  p_source_time_zone text,
  p_reminder_minutes integer[],
  p_whatsapp_enabled boolean
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_id uuid;
  meeting_id uuid;
  normalized_reminders integer[];
begin
  if not public.has_any_role(array['general_sec', 'chairman', 'admin']) then
    raise exception 'only the General Secretary, Chairman, or Admin can schedule meetings';
  end if;

  actor_id := public.current_member_id();
  if p_starts_at <= now() then
    raise exception 'meeting start time must be in the future';
  end if;
  if p_duration_minutes < 15 or p_duration_minutes > 720 then
    raise exception 'meeting duration must be between 15 minutes and 12 hours';
  end if;
  if not exists (select 1 from pg_timezone_names where name = p_source_time_zone) then
    raise exception 'invalid IANA time zone';
  end if;

  select array_agg(distinct reminder order by reminder desc)
  into normalized_reminders
  from unnest(p_reminder_minutes) as reminder
  where reminder = any(array[15, 60, 1440, 10080]);

  if coalesce(cardinality(normalized_reminders), 0) = 0 then
    normalized_reminders := array[10080, 1440, 60];
  end if;

  insert into public.meetings (
    title,
    meeting_type,
    description,
    location,
    meeting_url,
    starts_at,
    ends_at,
    source_time_zone,
    reminder_minutes,
    whatsapp_enabled,
    created_by
  ) values (
    btrim(p_title),
    p_meeting_type,
    nullif(btrim(coalesce(p_description, '')), ''),
    nullif(btrim(coalesce(p_location, '')), ''),
    nullif(btrim(coalesce(p_meeting_url, '')), ''),
    p_starts_at,
    p_starts_at + make_interval(mins => p_duration_minutes),
    p_source_time_zone,
    normalized_reminders,
    p_whatsapp_enabled,
    actor_id
  ) returning id into meeting_id;

  insert into public.notifications (member_id, title, message, type, link_url, read)
  select
    member.id,
    'Meeting scheduled',
    btrim(p_title) || ' has been scheduled. Open it to see the time in your local time zone.',
    'meeting_scheduled',
    '/meetings/' || meeting_id::text,
    false
  from public.members member
  where member.status::text = 'approved';

  if p_whatsapp_enabled then
    insert into public.meeting_reminder_deliveries (
      meeting_id,
      member_id,
      reminder_minutes,
      scheduled_for
    )
    select
      meeting_id,
      member.id,
      reminder_offset,
      p_starts_at - make_interval(mins => reminder_offset)
    from public.members member
    cross join lateral unnest(normalized_reminders) as reminder_offset
    where member.status::text = 'approved'
      and member.whatsapp_opt_in
      and member.phone_e164 is not null
      and p_starts_at - make_interval(mins => reminder_offset) > now();
  end if;

  begin
    insert into public.audit_logs (action, performed_by, target_member)
    values ('schedule_meeting:' || meeting_id::text, actor_id, actor_id);
  exception when others then
    null;
  end;

  return meeting_id;
end;
$$;

grant execute on function public.schedule_meeting_v1(
  text, text, text, text, text, timestamptz, integer, text, integer[], boolean
) to authenticated;

commit;

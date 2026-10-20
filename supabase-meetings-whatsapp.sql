-- GIEFA meeting scheduling, member time zones, and WhatsApp reminder queue.
-- Run once in the Supabase SQL Editor before deploying the matching app code.

begin;

alter table public.members
  add column if not exists phone_e164 text,
  add column if not exists time_zone text not null default 'UTC',
  add column if not exists whatsapp_opt_in boolean not null default false;

alter table public.members
  drop constraint if exists members_phone_e164_check,
  add constraint members_phone_e164_check
    check (phone_e164 is null or phone_e164 ~ '^\+[1-9][0-9]{7,14}$');

create table if not exists public.meetings (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  meeting_type text not null default 'general_assembly',
  description text,
  location text,
  meeting_url text,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  source_time_zone text not null default 'UTC',
  status text not null default 'scheduled',
  reminder_minutes integer[] not null default array[1440, 60],
  whatsapp_enabled boolean not null default true,
  created_by uuid not null references public.members(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint meetings_title_check check (length(btrim(title)) between 3 and 160),
  constraint meetings_type_check check (
    meeting_type in ('general_assembly', 'finance', 'membership', 'governance', 'committee', 'other')
  ),
  constraint meetings_status_check check (
    status in ('draft', 'scheduled', 'cancelled', 'completed')
  ),
  constraint meetings_time_check check (ends_at > starts_at),
  constraint meetings_reminders_check check (
    cardinality(reminder_minutes) between 1 and 5
    and reminder_minutes <@ array[15, 60, 1440, 10080]
  )
);

create table if not exists public.meeting_reminder_deliveries (
  id uuid primary key default gen_random_uuid(),
  meeting_id uuid not null references public.meetings(id) on delete cascade,
  member_id uuid not null references public.members(id) on delete cascade,
  reminder_minutes integer not null,
  channel text not null default 'whatsapp',
  status text not null default 'pending',
  scheduled_for timestamptz not null,
  attempts integer not null default 0,
  provider_message_id text,
  last_error text,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint meeting_reminder_channel_check check (channel in ('whatsapp')),
  constraint meeting_reminder_status_check check (
    status in ('pending', 'sending', 'sent', 'failed', 'skipped')
  ),
  constraint meeting_reminder_attempts_check check (attempts between 0 and 10),
  unique (meeting_id, member_id, reminder_minutes, channel)
);

alter table public.notifications
  add column if not exists title text,
  add column if not exists type text,
  add column if not exists link_url text;

create index if not exists meetings_starts_at_idx
  on public.meetings (starts_at)
  where status = 'scheduled';

create index if not exists meeting_reminders_due_idx
  on public.meeting_reminder_deliveries (scheduled_for, status)
  where status in ('pending', 'failed');

create index if not exists meeting_reminders_member_idx
  on public.meeting_reminder_deliveries (member_id, meeting_id);

alter table public.meetings enable row level security;
alter table public.meeting_reminder_deliveries enable row level security;

drop policy if exists "approved members view scheduled meetings" on public.meetings;
drop policy if exists "meeting managers manage meetings" on public.meetings;
drop policy if exists "meeting managers view reminder deliveries" on public.meeting_reminder_deliveries;

create policy "approved members view scheduled meetings"
on public.meetings
for select
to authenticated
using (
  public.current_member_id() is not null
  and (
    status <> 'draft'
    or public.has_any_role(array['general_sec', 'chairman', 'admin'])
  )
);

create policy "meeting managers manage meetings"
on public.meetings
for all
to authenticated
using (public.has_any_role(array['general_sec', 'chairman', 'admin']))
with check (public.has_any_role(array['general_sec', 'chairman', 'admin']));

create policy "meeting managers view reminder deliveries"
on public.meeting_reminder_deliveries
for select
to authenticated
using (public.has_any_role(array['general_sec', 'chairman', 'admin']));

create or replace function public.touch_meeting_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists touch_meeting_updated_at on public.meetings;
create trigger touch_meeting_updated_at
before update on public.meetings
for each row execute function public.touch_meeting_updated_at();

create or replace function public.update_meeting_communication_preferences_v1(
  p_phone_e164 text,
  p_time_zone text,
  p_whatsapp_opt_in boolean
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  member_id uuid;
  normalized_phone text;
begin
  member_id := public.current_member_id();
  if member_id is null then
    raise exception 'only approved members can update reminder preferences';
  end if;

  if not exists (select 1 from pg_timezone_names where name = p_time_zone) then
    raise exception 'invalid IANA time zone';
  end if;

  normalized_phone := nullif(regexp_replace(coalesce(p_phone_e164, ''), '[^0-9+]', '', 'g'), '');
  if normalized_phone is not null and normalized_phone !~ '^\+[1-9][0-9]{7,14}$' then
    raise exception 'phone number must use E.164 format, for example +14165550123';
  end if;

  if p_whatsapp_opt_in and normalized_phone is null then
    raise exception 'a WhatsApp number is required to enable reminders';
  end if;

  update public.members
  set phone_e164 = normalized_phone,
      time_zone = p_time_zone,
      whatsapp_opt_in = p_whatsapp_opt_in
  where id = member_id;

  if p_whatsapp_opt_in then
    insert into public.meeting_reminder_deliveries (
      meeting_id,
      member_id,
      reminder_minutes,
      scheduled_for
    )
    select
      meeting.id,
      member_id,
      reminder_offset,
      meeting.starts_at - make_interval(mins => reminder_offset)
    from public.meetings meeting
    cross join lateral unnest(meeting.reminder_minutes) as reminder_offset
    where meeting.status = 'scheduled'
      and meeting.whatsapp_enabled
      and meeting.starts_at > now()
      and meeting.starts_at - make_interval(mins => reminder_offset) > now()
    on conflict (meeting_id, member_id, reminder_minutes, channel)
    do update set
      status = 'pending',
      scheduled_for = excluded.scheduled_for,
      attempts = 0,
      last_error = null,
      updated_at = now()
    where meeting_reminder_deliveries.status = 'skipped';
  else
    update public.meeting_reminder_deliveries
    set status = 'skipped',
        last_error = 'Member opted out of WhatsApp reminders.',
        updated_at = now()
    where meeting_reminder_deliveries.member_id = member_id
      and status in ('pending', 'failed');
  end if;
end;
$$;

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
    normalized_reminders := array[1440, 60];
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
  where member.status = 'approved';

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
    where member.status = 'approved'
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

create or replace function public.cancel_meeting_v1(p_meeting_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_id uuid;
  meeting_title text;
begin
  if not public.has_any_role(array['general_sec', 'chairman', 'admin']) then
    raise exception 'not authorized to cancel meetings';
  end if;

  actor_id := public.current_member_id();

  update public.meetings
  set status = 'cancelled'
  where id = p_meeting_id
    and status in ('draft', 'scheduled')
  returning title into meeting_title;

  if meeting_title is null then
    raise exception 'meeting was not found or cannot be cancelled';
  end if;

  update public.meeting_reminder_deliveries
  set status = 'skipped',
      last_error = 'Meeting cancelled.',
      updated_at = now()
  where meeting_id = p_meeting_id
    and status in ('pending', 'failed', 'sending');

  insert into public.notifications (member_id, title, message, type, link_url, read)
  select
    member.id,
    'Meeting cancelled',
    meeting_title || ' has been cancelled.',
    'meeting_cancelled',
    '/meetings/' || p_meeting_id::text,
    false
  from public.members member
  where member.status = 'approved';

  begin
    insert into public.audit_logs (action, performed_by, target_member)
    values ('cancel_meeting:' || p_meeting_id::text, actor_id, actor_id);
  exception when others then
    null;
  end;
end;
$$;

create or replace function public.claim_due_meeting_reminders_v1(p_batch_size integer default 50)
returns table (
  delivery_id uuid,
  reminder_minutes integer,
  member_name text,
  phone_e164 text,
  time_zone text,
  meeting_id uuid,
  meeting_title text,
  meeting_description text,
  meeting_location text,
  meeting_url text,
  starts_at timestamptz,
  ends_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'service role required';
  end if;

  update public.meeting_reminder_deliveries delivery
  set status = 'failed',
      last_error = 'Previous send attempt timed out.',
      updated_at = now()
  where delivery.status = 'sending'
    and delivery.updated_at < now() - interval '15 minutes';

  return query
  with due as (
    select delivery.id
    from public.meeting_reminder_deliveries delivery
    join public.meetings meeting on meeting.id = delivery.meeting_id
    join public.members member on member.id = delivery.member_id
    where delivery.status in ('pending', 'failed')
      and delivery.attempts < 5
      and delivery.scheduled_for <= now()
      and meeting.status = 'scheduled'
      and meeting.whatsapp_enabled
      and meeting.starts_at > now()
      and member.status = 'approved'
      and member.whatsapp_opt_in
      and member.phone_e164 is not null
    order by delivery.scheduled_for, delivery.created_at
    for update of delivery skip locked
    limit greatest(1, least(coalesce(p_batch_size, 50), 100))
  ), claimed as (
    update public.meeting_reminder_deliveries delivery
    set status = 'sending',
        attempts = delivery.attempts + 1,
        updated_at = now()
    from due
    where delivery.id = due.id
    returning delivery.*
  )
  select
    claimed.id,
    claimed.reminder_minutes,
    coalesce(nullif(btrim(concat_ws(' ', member.first_name, member.last_name)), ''), 'GIEFA member'),
    member.phone_e164,
    member.time_zone,
    meeting.id,
    meeting.title,
    meeting.description,
    meeting.location,
    meeting.meeting_url,
    meeting.starts_at,
    meeting.ends_at
  from claimed
  join public.members member on member.id = claimed.member_id
  join public.meetings meeting on meeting.id = claimed.meeting_id;
end;
$$;

revoke all on function public.claim_due_meeting_reminders_v1(integer) from public, anon, authenticated;
grant execute on function public.claim_due_meeting_reminders_v1(integer) to service_role;
grant execute on function public.update_meeting_communication_preferences_v1(text, text, boolean) to authenticated;
grant execute on function public.schedule_meeting_v1(text, text, text, text, text, timestamptz, integer, text, integer[], boolean) to authenticated;
grant execute on function public.cancel_meeting_v1(uuid) to authenticated;

notify pgrst, 'reload schema';

commit;

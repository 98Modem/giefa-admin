-- GIEFA notification links
-- Run this after the main install script. It is safe to run more than once.

begin;

alter table public.notifications
  add column if not exists title text,
  add column if not exists type text,
  add column if not exists link_url text;

create index if not exists notifications_member_read_created_idx
  on public.notifications (member_id, read, created_at desc);

notify pgrst, 'reload schema';

commit;

-- GIEFA notification links
-- Run this after the main install script. It is safe to run more than once.

begin;

alter table public.notifications
  add column if not exists title text,
  add column if not exists type text,
  add column if not exists link_url text;

create index if not exists notifications_member_read_created_idx
  on public.notifications (member_id, read, created_at desc);

create or replace function public.notify_finance_deposit_submission()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.notifications (member_id, title, message, type, link_url, read)
  select
    members.id,
    'Deposit proof submitted',
    'New deposit proof submitted for finance review.',
    'deposit_submission',
    '/finance/deposit-submissions',
    false
  from public.members
  where members.status = 'approved'
    and members.role in ('treasurer', 'admin');

  return new;
end;
$$;

notify pgrst, 'reload schema';

commit;

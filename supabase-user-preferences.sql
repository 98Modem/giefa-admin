-- GIEFA user preferences and avatar storage
-- Run this in Supabase SQL Editor before testing avatar uploads/theme saves.

begin;

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

drop function if exists public.update_member_preferences_v2(text, text, text);
drop function if exists public.update_member_preferences_v2(text, integer, integer, text, text);
drop function if exists public.update_member_preferences_v2(text, integer, integer, text, text, text);

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

grant execute on function public.update_member_preferences_v2(text, integer, integer, text, text, text)
to authenticated;

notify pgrst, 'reload schema';

commit;

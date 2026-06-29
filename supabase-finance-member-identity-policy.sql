-- GIEFA finance member identity policy
-- Run this in Supabase SQL Editor if treasurer finance pages show
-- "Unknown member" for deposit or ledger records.

begin;

drop policy if exists "finance view member identities" on public.members;

create policy "finance view member identities"
on public.members
for select
to authenticated
using (public.has_any_role(array['treasurer', 'admin']));

notify pgrst, 'reload schema';

commit;

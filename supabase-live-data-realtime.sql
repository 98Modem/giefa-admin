-- GIEFA live page data realtime enablement
-- Run once in Supabase SQL Editor so open dashboard pages refresh when
-- finance, membership, governance, and fund records change.

begin;

do $$
declare
  table_name text;
  live_tables text[] := array[
    'members',
    'monthly_contributions',
    'emergency_funds',
    'shares',
    'emergency_requests',
    'deposit_submissions',
    'bank_statement_imports',
    'bank_statement_transactions',
    'finance_monthly_reports',
    'finance_interest_allocations',
    'finance_report_edit_requests',
    'notifications'
  ];
begin
  foreach table_name in array live_tables loop
    if to_regclass(format('public.%I', table_name)) is not null then
      execute format('alter table public.%I replica identity full', table_name);

      if exists (
        select 1
        from pg_publication
        where pubname = 'supabase_realtime'
      )
      and not exists (
        select 1
        from pg_publication_tables
        where pubname = 'supabase_realtime'
          and schemaname = 'public'
          and tablename = table_name
      ) then
        execute format('alter publication supabase_realtime add table public.%I', table_name);
      end if;
    end if;
  end loop;
end $$;

commit;

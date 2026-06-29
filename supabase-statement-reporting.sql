-- GIEFA monthly bank statement reporting
-- Run this in Supabase SQL Editor after the deposit automation script.

begin;

create table if not exists public.bank_statement_imports (
  id uuid primary key default gen_random_uuid(),
  reporting_month text not null,
  statement_file_url text,
  original_file_name text,
  opening_balance numeric not null default 0,
  closing_balance numeric not null default 0,
  notes text,
  status text not null default 'processed',
  uploaded_by uuid references public.members(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint bank_statement_imports_status_check
    check (status in ('uploaded', 'processed', 'failed'))
);

create table if not exists public.bank_statement_transactions (
  id uuid primary key default gen_random_uuid(),
  statement_import_id uuid not null references public.bank_statement_imports(id) on delete cascade,
  transaction_date date,
  description text,
  reference text,
  debit numeric not null default 0,
  credit numeric not null default 0,
  running_balance numeric,
  matched_submission_id uuid references public.deposit_submissions(id) on delete set null,
  match_status text not null default 'unmatched',
  created_at timestamptz not null default now(),
  constraint bank_statement_transactions_match_status_check
    check (match_status in ('exact', 'possible', 'unmatched'))
);

create table if not exists public.finance_monthly_reports (
  id uuid primary key default gen_random_uuid(),
  reporting_month text not null unique,
  statement_import_id uuid references public.bank_statement_imports(id) on delete set null,
  opening_balance numeric not null default 0,
  closing_balance numeric not null default 0,
  total_deposits numeric not null default 0,
  approved_member_deposits numeric not null default 0,
  unmatched_deposits numeric not null default 0,
  member_count integer not null default 0,
  exception_count integer not null default 0,
  notes text,
  status text not null default 'draft',
  prepared_by uuid references public.members(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint finance_monthly_reports_status_check
    check (status in ('draft', 'reviewed', 'final'))
);

create index if not exists bank_statement_imports_month_idx
  on public.bank_statement_imports (reporting_month);

create index if not exists bank_statement_transactions_import_idx
  on public.bank_statement_transactions (statement_import_id);

create index if not exists finance_monthly_reports_month_idx
  on public.finance_monthly_reports (reporting_month);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'bank-statements',
  'bank-statements',
  false,
  10485760,
  array[
    'application/pdf',
    'text/plain',
    'text/csv',
    'application/vnd.ms-excel',
    'application/octet-stream'
  ]
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "finance read bank statements" on storage.objects;
drop policy if exists "finance upload bank statements" on storage.objects;

create policy "finance read bank statements"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'bank-statements'
  and public.has_any_role(array['treasurer', 'chairman', 'admin'])
);

create policy "finance upload bank statements"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'bank-statements'
  and public.has_any_role(array['treasurer', 'admin'])
);

alter table public.bank_statement_imports enable row level security;
alter table public.bank_statement_transactions enable row level security;
alter table public.finance_monthly_reports enable row level security;

drop policy if exists "leadership view bank statement imports" on public.bank_statement_imports;
drop policy if exists "finance manage bank statement imports" on public.bank_statement_imports;
drop policy if exists "leadership view bank statement transactions" on public.bank_statement_transactions;
drop policy if exists "finance manage bank statement transactions" on public.bank_statement_transactions;
drop policy if exists "leadership view finance monthly reports" on public.finance_monthly_reports;
drop policy if exists "finance manage finance monthly reports" on public.finance_monthly_reports;

create policy "leadership view bank statement imports"
on public.bank_statement_imports
for select
to authenticated
using (public.has_any_role(array['treasurer', 'chairman', 'admin']));

create policy "finance manage bank statement imports"
on public.bank_statement_imports
for all
to authenticated
using (public.has_any_role(array['treasurer', 'admin']))
with check (public.has_any_role(array['treasurer', 'admin']));

create policy "leadership view bank statement transactions"
on public.bank_statement_transactions
for select
to authenticated
using (public.has_any_role(array['treasurer', 'chairman', 'admin']));

create policy "finance manage bank statement transactions"
on public.bank_statement_transactions
for all
to authenticated
using (public.has_any_role(array['treasurer', 'admin']))
with check (public.has_any_role(array['treasurer', 'admin']));

create policy "leadership view finance monthly reports"
on public.finance_monthly_reports
for select
to authenticated
using (public.has_any_role(array['treasurer', 'chairman', 'admin']));

create policy "finance manage finance monthly reports"
on public.finance_monthly_reports
for all
to authenticated
using (public.has_any_role(array['treasurer', 'admin']))
with check (public.has_any_role(array['treasurer', 'admin']));

create or replace function public.touch_finance_monthly_report_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists on_finance_monthly_report_updated on public.finance_monthly_reports;
create trigger on_finance_monthly_report_updated
before update on public.finance_monthly_reports
for each row execute function public.touch_finance_monthly_report_updated_at();

notify pgrst, 'reload schema';

commit;

-- GIEFA finance ledger foundation
-- Purpose: create an append-only ledger for approved deposits, emergency
-- withdrawals, and monthly interest postings.

begin;

create table if not exists public.ledger_entries (
  id uuid primary key default gen_random_uuid(),
  entry_type text not null check (
    entry_type in (
      'deposit_approved',
      'emergency_withdrawal',
      'interest_allocation',
      'manual_adjustment'
    )
  ),
  member_id uuid references public.members(id) on delete restrict,
  source_table text,
  source_id uuid,
  reporting_month text check (reporting_month is null or reporting_month ~ '^\d{4}-\d{2}$'),
  effective_date date not null default current_date,
  direction text not null check (direction in ('debit', 'credit')),
  amount numeric not null check (amount >= 0),
  emergency_amount numeric not null default 0 check (emergency_amount >= 0),
  investment_amount numeric not null default 0 check (investment_amount >= 0),
  status text not null default 'posted' check (status in ('posted', 'voided')),
  description text,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references public.members(id) on delete set null,
  created_at timestamptz not null default now()
);

create unique index if not exists ledger_entries_source_unique
  on public.ledger_entries(source_table, source_id, entry_type)
  where source_table is not null and source_id is not null;

create index if not exists ledger_entries_member_month_idx
  on public.ledger_entries(member_id, reporting_month, effective_date);

alter table public.ledger_entries enable row level security;

create or replace function public.current_member_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select id
  from public.members
  where auth_user_id = auth.uid()
  limit 1
$$;

create or replace function public.current_member_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role
  from public.members
  where auth_user_id = auth.uid()
    and status = 'approved'
  limit 1
$$;

create or replace function public.current_member_has_any_role(p_roles text[])
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.current_member_role() = any(p_roles), false)
$$;

drop policy if exists "ledger entries select own or leadership" on public.ledger_entries;
create policy "ledger entries select own or leadership"
on public.ledger_entries
for select
using (
  member_id = public.current_member_id()
  or public.current_member_has_any_role(array['admin', 'chairman', 'treasurer'])
);

drop policy if exists "ledger entries insert finance operators" on public.ledger_entries;
create policy "ledger entries insert finance operators"
on public.ledger_entries
for insert
with check (
  public.current_member_has_any_role(array['admin', 'treasurer'])
);

create or replace function public.prevent_ledger_entry_mutation()
returns trigger
language plpgsql
as $$
begin
  raise exception 'Ledger entries are immutable. Post a reversing adjustment instead.';
end;
$$;

drop trigger if exists prevent_ledger_entry_update on public.ledger_entries;
create trigger prevent_ledger_entry_update
before update on public.ledger_entries
for each row execute function public.prevent_ledger_entry_mutation();

drop trigger if exists prevent_ledger_entry_delete on public.ledger_entries;
create trigger prevent_ledger_entry_delete
before delete on public.ledger_entries
for each row execute function public.prevent_ledger_entry_mutation();

create or replace function public.post_ledger_entry_v1(
  p_entry_type text,
  p_member_id uuid,
  p_source_table text,
  p_source_id uuid,
  p_reporting_month text,
  p_effective_date date,
  p_direction text,
  p_amount numeric,
  p_emergency_amount numeric default 0,
  p_investment_amount numeric default 0,
  p_description text default null,
  p_metadata jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_id uuid;
  v_entry_id uuid;
begin
  if not public.current_member_has_any_role(array['admin', 'treasurer']) then
    raise exception 'Only admin or treasurer can post ledger entries.';
  end if;

  v_actor_id := public.current_member_id();

  insert into public.ledger_entries (
    entry_type,
    member_id,
    source_table,
    source_id,
    reporting_month,
    effective_date,
    direction,
    amount,
    emergency_amount,
    investment_amount,
    description,
    metadata,
    created_by
  )
  values (
    p_entry_type,
    p_member_id,
    p_source_table,
    p_source_id,
    p_reporting_month,
    coalesce(p_effective_date, current_date),
    p_direction,
    p_amount,
    coalesce(p_emergency_amount, 0),
    coalesce(p_investment_amount, 0),
    p_description,
    coalesce(p_metadata, '{}'::jsonb),
    v_actor_id
  )
  on conflict (source_table, source_id, entry_type)
  where source_table is not null and source_id is not null
  do nothing
  returning id into v_entry_id;

  if v_entry_id is null and p_source_table is not null and p_source_id is not null then
    select id into v_entry_id
    from public.ledger_entries
    where source_table = p_source_table
      and source_id = p_source_id
      and entry_type = p_entry_type
    limit 1;
  end if;

  return v_entry_id;
end;
$$;

create or replace function public.backfill_ledger_entries_v1()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer := 0;
  v_row_count integer := 0;
begin
  if not public.current_member_has_any_role(array['admin']) then
    raise exception 'Only admin can backfill ledger entries.';
  end if;

  insert into public.ledger_entries (
    entry_type,
    member_id,
    source_table,
    source_id,
    reporting_month,
    effective_date,
    direction,
    amount,
    emergency_amount,
    investment_amount,
    description,
    metadata,
    created_by
  )
  select
    'deposit_approved',
    ds.member_id,
    'deposit_submissions',
    ds.id,
    ds.contribution_month,
    coalesce(ds.deposit_date, ds.approved_at::date, ds.created_at::date, current_date),
    'credit',
    coalesce(ds.amount, 0),
    coalesce(ds.emergency_amount, 0),
    coalesce(ds.investment_amount, 0),
    'Approved member deposit',
    jsonb_build_object('bank_reference', ds.bank_reference, 'confidence', ds.confidence),
    public.current_member_id()
  from public.deposit_submissions ds
  where ds.status = 'approved'
  on conflict (source_table, source_id, entry_type)
  where source_table is not null and source_id is not null
  do nothing;

  get diagnostics v_row_count = row_count;
  v_count := v_count + v_row_count;

  insert into public.ledger_entries (
    entry_type,
    member_id,
    source_table,
    source_id,
    reporting_month,
    effective_date,
    direction,
    amount,
    emergency_amount,
    investment_amount,
    description,
    metadata,
    created_by
  )
  select
    'emergency_withdrawal',
    er.member_id,
    'emergency_requests',
    er.id,
    to_char(coalesce(er.approved_at, er.created_at), 'YYYY-MM'),
    coalesce(er.approved_at::date, er.created_at::date, current_date),
    'debit',
    coalesce(er.amount, 0),
    coalesce(er.amount, 0),
    0,
    'Approved emergency withdrawal',
    '{}'::jsonb,
    public.current_member_id()
  from public.emergency_requests er
  where er.status = 'approved'
  on conflict (source_table, source_id, entry_type)
  where source_table is not null and source_id is not null
  do nothing;

  get diagnostics v_row_count = row_count;
  v_count := v_count + v_row_count;

  insert into public.ledger_entries (
    entry_type,
    member_id,
    source_table,
    source_id,
    reporting_month,
    effective_date,
    direction,
    amount,
    emergency_amount,
    investment_amount,
    description,
    metadata,
    created_by
  )
  select
    'interest_allocation',
    fia.member_id,
    'finance_interest_allocations',
    fia.id,
    fia.reporting_month,
    (fia.reporting_month || '-01')::date,
    'credit',
    coalesce(fia.interest_amount, 0),
    0,
    coalesce(fia.interest_amount, 0),
    'Monthly interest allocation',
    jsonb_build_object('weighted_balance', fia.weighted_balance, 'weight_share', fia.weight_share),
    public.current_member_id()
  from public.finance_interest_allocations fia
  where coalesce(fia.interest_amount, 0) > 0
  on conflict (source_table, source_id, entry_type)
  where source_table is not null and source_id is not null
  do nothing;

  get diagnostics v_row_count = row_count;
  v_count := v_count + v_row_count;
  return v_count;
end;
$$;

grant execute on function public.post_ledger_entry_v1(
  text, uuid, text, uuid, text, date, text, numeric, numeric, numeric, text, jsonb
) to authenticated;
grant execute on function public.backfill_ledger_entries_v1() to authenticated;

notify pgrst, 'reload schema';

commit;

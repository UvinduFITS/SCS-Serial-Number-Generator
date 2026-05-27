-- ============================================================
-- 000_full_setup.sql
-- Run this ONCE in Supabase SQL Editor to set up everything.
-- Safe to run multiple times (uses CREATE IF NOT EXISTS patterns).
-- ============================================================

-- ── 1. TABLES ───────────────────────────────────────────────

create table if not exists public.profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  email        text not null,
  full_name    text,
  role         text not null default 'operations'
                 check (role in ('admin', 'operations')),
  status       text not null default 'active'
                 check (status in ('active', 'inactive')),
  created_at   timestamp with time zone default now(),
  created_by   uuid references auth.users(id) on delete set null
);

create table if not exists public.counters (
  id             uuid primary key default gen_random_uuid(),
  shipment_type  text not null check (shipment_type in ('AE','AI','OE','OI','WH')),
  number_type    text not null check (number_type in ('J','H')),
  current_number integer not null default 0,
  updated_at     timestamp with time zone default now(),
  unique (shipment_type, number_type)
);

create table if not exists public.generated_numbers (
  id                uuid primary key default gen_random_uuid(),
  created_at        timestamp with time zone default now(),
  user_id           uuid references auth.users(id),
  user_email        text not null,
  shipment_type     text not null,
  number_type       text not null,
  number_type_label text not null,
  sequence_number   integer not null,
  reference_number  text unique not null
);

-- ── 2. SEED COUNTERS (skip duplicates) ──────────────────────

insert into public.counters (shipment_type, number_type) values
  ('AE', 'J'), ('AE', 'H'),
  ('AI', 'J'), ('AI', 'H'),
  ('OE', 'J'), ('OE', 'H'),
  ('OI', 'J'), ('OI', 'H'),
  ('WH', 'J'), ('WH', 'H')
on conflict (shipment_type, number_type) do nothing;

-- ── 3. ENABLE RLS ───────────────────────────────────────────

alter table public.profiles          enable row level security;
alter table public.counters          enable row level security;
alter table public.generated_numbers enable row level security;

-- ── 4. HELPER FUNCTION ──────────────────────────────────────

create or replace function public.is_admin()
returns boolean
language sql
security definer
stable
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid()
      and role = 'admin'
      and status = 'active'
  );
$$;

grant execute on function public.is_admin() to authenticated;

-- ── 5. RLS POLICIES ─────────────────────────────────────────

-- Drop existing policies first to avoid conflicts
drop policy if exists "profiles_select"  on public.profiles;
drop policy if exists "profiles_insert"  on public.profiles;
drop policy if exists "profiles_update"  on public.profiles;
drop policy if exists "generated_numbers_admin_select" on public.generated_numbers;

-- profiles: users read own row, admins read all
create policy "profiles_select"
  on public.profiles for select
  using (auth.uid() = id or public.is_admin());

-- profiles: only admins can insert (edge function uses service role, bypasses this)
create policy "profiles_insert"
  on public.profiles for insert
  with check (public.is_admin());

-- profiles: only admins can update
create policy "profiles_update"
  on public.profiles for update
  using (public.is_admin());

-- generated_numbers: only admins can read audit log
create policy "generated_numbers_admin_select"
  on public.generated_numbers for select
  using (public.is_admin());

-- ── 6. ATOMIC NUMBER GENERATION FUNCTION ────────────────────

create or replace function public.generate_reference_number(
  p_shipment_type text,
  p_number_type   text
)
returns json
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id    uuid;
  v_user_email text;
  v_profile    record;
  v_counter    record;
  v_sequence   integer;
  v_reference  text;
  v_label      text;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  v_user_email := auth.email();
  if v_user_email is null then
    select email into v_user_email from auth.users where id = v_user_id;
  end if;

  select * into v_profile from public.profiles where id = v_user_id;
  if not found then
    raise exception 'User profile not found. Contact an administrator.';
  end if;
  if v_profile.status <> 'active' then
    raise exception 'Your account is inactive.';
  end if;

  if p_shipment_type not in ('AE','AI','OE','OI','WH') then
    raise exception 'Invalid shipment type: %', p_shipment_type;
  end if;
  if p_number_type not in ('J','H') then
    raise exception 'Invalid number type: %', p_number_type;
  end if;

  select * into v_counter
  from public.counters
  where shipment_type = p_shipment_type and number_type = p_number_type
  for update;

  if not found then
    raise exception 'Counter not found for % / %', p_shipment_type, p_number_type;
  end if;

  v_sequence := v_counter.current_number + 1;
  if v_sequence > 9999999 then
    raise exception 'Maximum sequence reached for % / %', p_shipment_type, p_number_type;
  end if;

  update public.counters
  set current_number = v_sequence, updated_at = now()
  where shipment_type = p_shipment_type and number_type = p_number_type;

  v_reference := p_number_type || 'LK' || p_shipment_type || lpad(v_sequence::text, 7, '0');
  v_label := case p_number_type when 'J' then 'Job Number' when 'H' then 'HAWB Number' end;

  insert into public.generated_numbers (
    user_id, user_email, shipment_type, number_type,
    number_type_label, sequence_number, reference_number
  ) values (
    v_user_id, v_user_email, p_shipment_type, p_number_type,
    v_label, v_sequence, v_reference
  );

  return json_build_object(
    'reference_number',  v_reference,
    'shipment_type',     p_shipment_type,
    'number_type',       p_number_type,
    'number_type_label', v_label,
    'sequence_number',   v_sequence,
    'created_at',        now()
  );
end;
$$;

grant execute on function public.generate_reference_number(text, text) to authenticated;

-- ── 7. ENSURE ADMIN PROFILE EXISTS ──────────────────────────

insert into public.profiles (id, email, full_name, role, status)
select
  id,
  email,
  'System Administrator',
  'admin',
  'active'
from auth.users
where email = 'automation@fitsexpress.com'
on conflict (id) do update
  set role = 'admin', status = 'active';

-- ── 8. VERIFY SETUP ─────────────────────────────────────────

select 'Tables OK' as check, count(*) as count from public.profiles
union all
select 'Counters OK', count(*) from public.counters
union all
select 'Admin exists', count(*) from public.profiles where role = 'admin';

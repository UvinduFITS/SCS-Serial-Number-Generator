-- ============================================================
-- 001_create_tables.sql
-- Creates profiles, counters, and generated_numbers tables
-- and seeds all 10 counter combinations
-- ============================================================

-- Profiles table (linked to auth.users)
create table public.profiles (
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

-- Counters table — one row per (shipment_type, number_type) pair
create table public.counters (
  id             uuid primary key default gen_random_uuid(),
  shipment_type  text not null check (shipment_type in ('AE','AI','OE','OI','WH')),
  number_type    text not null check (number_type in ('J','H')),
  current_number integer not null default 0,
  updated_at     timestamp with time zone default now(),
  unique (shipment_type, number_type)
);

-- Generated numbers — permanent immutable audit trail
create table public.generated_numbers (
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

-- Seed all 10 counter combinations
insert into public.counters (shipment_type, number_type) values
  ('AE', 'J'),
  ('AE', 'H'),
  ('AI', 'J'),
  ('AI', 'H'),
  ('OE', 'J'),
  ('OE', 'H'),
  ('OI', 'J'),
  ('OI', 'H'),
  ('WH', 'J'),
  ('WH', 'H');

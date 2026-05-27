-- ============================================================
-- 002_rls_policies.sql
-- Enables RLS and creates all access policies
-- ============================================================

-- Enable RLS on all tables
alter table public.profiles         enable row level security;
alter table public.counters         enable row level security;
alter table public.generated_numbers enable row level security;

-- ----------------------------------------------------------------
-- Helper function: is_admin()
-- Runs as SECURITY DEFINER so it bypasses RLS when reading profiles,
-- preventing circular policy evaluation.
-- ----------------------------------------------------------------
create or replace function public.is_admin()
returns boolean
language sql
security definer
stable
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and role = 'admin'
      and status = 'active'
  );
$$;

-- Grant execute to authenticated users
grant execute on function public.is_admin() to authenticated;


-- ================================================================
-- PROFILES policies
-- ================================================================

-- SELECT: users read own row OR admins read all rows
create policy "profiles_select"
  on public.profiles
  for select
  using (auth.uid() = id or is_admin());

-- INSERT: only admins (or service role via Edge Function)
create policy "profiles_insert"
  on public.profiles
  for insert
  with check (is_admin());

-- UPDATE: only admins
create policy "profiles_update"
  on public.profiles
  for update
  using (is_admin());

-- DELETE: no one (profiles are permanent)
-- (no DELETE policy = no DELETE allowed)


-- ================================================================
-- COUNTERS policies
-- No direct frontend access — only the SECURITY DEFINER RPC function
-- reads and updates counters.
-- ================================================================
-- (No policies added — no one can SELECT/INSERT/UPDATE/DELETE directly)


-- ================================================================
-- GENERATED_NUMBERS policies
-- ================================================================

-- SELECT: only admins can read audit logs
create policy "generated_numbers_admin_select"
  on public.generated_numbers
  for select
  using (is_admin());

-- INSERT: blocked for direct inserts; only via SECURITY DEFINER RPC
-- (No INSERT policy = no direct INSERT allowed)

-- UPDATE / DELETE: no one (numbers are immutable)
-- (No UPDATE/DELETE policies)

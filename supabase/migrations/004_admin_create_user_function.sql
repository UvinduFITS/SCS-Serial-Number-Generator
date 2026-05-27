-- ============================================================
-- 004_admin_create_user_function.sql
-- Creates users directly via SECURITY DEFINER PostgreSQL function.
-- Inserts into auth.users + auth.identities + public.profiles
-- so the new user can immediately log in.
-- ============================================================

-- Ensure pgcrypto is available for password hashing
-- (installed in the "extensions" schema in Supabase)
create extension if not exists pgcrypto with schema extensions;

-- Drop and recreate to avoid signature conflicts
drop function if exists public.admin_create_user(text, text, text, text);

create or replace function public.admin_create_user(
  p_email     text,
  p_password  text,
  p_full_name text default null,
  p_role      text default 'operations'
)
returns json
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id    uuid;
  v_caller_id  uuid;
  v_email      text;
begin
  v_email := lower(trim(p_email));

  -- 1. Verify caller is an active admin
  v_caller_id := auth.uid();
  if not exists (
    select 1 from public.profiles
    where id = v_caller_id
      and role   = 'admin'
      and status = 'active'
  ) then
    raise exception 'Not authorized: admin access required';
  end if;

  -- 2. Validate inputs
  if p_role not in ('admin', 'operations') then
    raise exception 'Invalid role. Must be admin or operations.';
  end if;

  if length(p_password) < 8 then
    raise exception 'Password must be at least 8 characters.';
  end if;

  if v_email is null or v_email = '' then
    raise exception 'Email is required.';
  end if;

  -- 3. Check email not already registered
  if exists (select 1 from auth.users where email = v_email) then
    raise exception 'Email % is already registered.', v_email;
  end if;

  -- 4. Generate UUID for new user
  v_user_id := gen_random_uuid();

  -- 5. Insert into auth.users (email pre-confirmed so user can log in immediately)
  insert into auth.users (
    id,
    instance_id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    confirmation_token,
    recovery_token,
    email_change_token_new,
    email_change,
    raw_app_meta_data,
    raw_user_meta_data,
    is_super_admin,
    created_at,
    updated_at,
    last_sign_in_at
  ) values (
    v_user_id,
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    v_email,
    extensions.crypt(p_password, extensions.gen_salt('bf')),
    now(),
    '',
    '',
    '',
    '',
    '{"provider":"email","providers":["email"]}'::jsonb,
    jsonb_build_object('full_name', p_full_name),
    false,
    now(),
    now(),
    null
  );

  -- 6. Insert into auth.identities — REQUIRED for login to work
  insert into auth.identities (
    provider_id,
    user_id,
    identity_data,
    provider,
    last_sign_in_at,
    created_at,
    updated_at
  ) values (
    v_user_id::text,
    v_user_id,
    jsonb_build_object(
      'sub',            v_user_id::text,
      'email',          v_email,
      'email_verified', true,
      'phone_verified', false
    ),
    'email',
    now(),
    now(),
    now()
  );

  -- 7. Create profile row
  insert into public.profiles (id, email, full_name, role, status, created_by)
  values (
    v_user_id,
    v_email,
    p_full_name,
    p_role,
    'active',
    v_caller_id
  );

  return json_build_object(
    'id',        v_user_id,
    'email',     v_email,
    'full_name', p_full_name,
    'role',      p_role,
    'status',    'active'
  );
end;
$$;

-- Allow any authenticated user to call (function itself enforces admin check)
grant execute on function public.admin_create_user(text, text, text, text) to authenticated;

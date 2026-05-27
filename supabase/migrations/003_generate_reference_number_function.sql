-- ============================================================
-- 003_generate_reference_number_function.sql
-- Atomic, concurrency-safe number generation via RPC.
-- SECURITY DEFINER bypasses RLS on counters/generated_numbers.
-- set search_path = '' is required by Supabase for SECURITY
-- DEFINER functions to prevent schema injection attacks.
-- ============================================================

create or replace function public.generate_reference_number(
  p_shipment_type text,
  p_number_type   text
)
returns json
language plpgsql
security definer
set search_path = ''          -- required by Supabase for SECURITY DEFINER
as $$
declare
  v_user_id         uuid;
  v_user_email      text;
  v_profile         record;
  v_counter         record;
  v_sequence        integer;
  v_reference       text;
  v_label           text;
begin
  -- 1. Require an authenticated caller
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  -- 2. Get caller email via Supabase auth helper (avoids direct auth.users query)
  v_user_email := auth.email();

  -- Fallback: if auth.email() returns null, read from auth.users directly
  if v_user_email is null then
    select email into v_user_email
    from auth.users
    where id = v_user_id;
  end if;

  -- 3. Verify profile exists and account is active
  --    Must use schema-qualified name because search_path = ''
  select * into v_profile
  from public.profiles
  where id = v_user_id;

  if not found then
    raise exception 'User profile not found. Contact an administrator.';
  end if;

  if v_profile.status <> 'active' then
    raise exception 'Your account is inactive. Contact an administrator.';
  end if;

  -- 4. Validate inputs
  if p_shipment_type not in ('AE','AI','OE','OI','WH') then
    raise exception 'Invalid shipment type: %', p_shipment_type;
  end if;

  if p_number_type not in ('J','H') then
    raise exception 'Invalid number type: %', p_number_type;
  end if;

  -- 5. Lock the counter row — FOR UPDATE prevents race conditions
  select * into v_counter
  from public.counters
  where shipment_type = p_shipment_type
    and number_type   = p_number_type
  for update;

  if not found then
    raise exception 'Counter not initialised for % / %', p_shipment_type, p_number_type;
  end if;

  -- 6. Check sequence cap (max 9,999,999)
  v_sequence := v_counter.current_number + 1;

  if v_sequence > 9999999 then
    raise exception 'Maximum sequence number (9,999,999) reached for % / %',
      p_shipment_type, p_number_type;
  end if;

  -- 7. Increment counter atomically
  update public.counters
  set current_number = v_sequence,
      updated_at     = now()
  where shipment_type = p_shipment_type
    and number_type   = p_number_type;

  -- 8. Build reference number: [TYPE]LK[SHIPMENT][7-DIGIT-SEQ]
  v_reference := p_number_type
              || 'LK'
              || p_shipment_type
              || lpad(v_sequence::text, 7, '0');

  -- 9. Human-readable label
  v_label := case p_number_type
    when 'J' then 'Job Number'
    when 'H' then 'HAWB Number'
  end;

  -- 10. Write permanent audit record
  insert into public.generated_numbers (
    user_id,
    user_email,
    shipment_type,
    number_type,
    number_type_label,
    sequence_number,
    reference_number
  ) values (
    v_user_id,
    v_user_email,
    p_shipment_type,
    p_number_type,
    v_label,
    v_sequence,
    v_reference
  );

  -- 11. Return result as JSON
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

-- Allow any authenticated user to call this function
grant execute on function public.generate_reference_number(text, text) to authenticated;

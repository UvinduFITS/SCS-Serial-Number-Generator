// Supabase Edge Function: create-user
// Creates a new Supabase Auth user and matching profile row.
// Only callable by authenticated admins — service role key never leaves server.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!

    // Admin client — bypasses RLS (never sent to frontend)
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    // User client — used only to verify the caller's identity and role
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return jsonResponse({ error: 'Missing authorization header' }, 401)
    }

    const supabaseUser = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    })

    // Verify the caller is an active admin
    const {
      data: { user: caller },
      error: callerError,
    } = await supabaseUser.auth.getUser()

    if (callerError || !caller) {
      return jsonResponse({ error: 'Unauthorized' }, 401)
    }

    const { data: callerProfile, error: profileError } = await supabaseUser
      .from('profiles')
      .select('role, status')
      .eq('id', caller.id)
      .single()

    if (
      profileError ||
      !callerProfile ||
      callerProfile.role !== 'admin' ||
      callerProfile.status !== 'active'
    ) {
      return jsonResponse({ error: 'Forbidden: admin access required' }, 403)
    }

    // Parse and validate request body
    const body = await req.json()
    const { email, password, full_name, role } = body

    if (!email || !password || !role) {
      return jsonResponse({ error: 'email, password, and role are required' }, 400)
    }

    if (!['admin', 'operations'].includes(role)) {
      return jsonResponse({ error: 'role must be admin or operations' }, 400)
    }

    if (password.length < 8) {
      return jsonResponse({ error: 'password must be at least 8 characters' }, 400)
    }

    // Create the Auth user (email auto-confirmed so they can log in immediately)
    const { data: newAuthUser, error: createError } =
      await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      })

    if (createError) {
      return jsonResponse({ error: createError.message }, 400)
    }

    // Insert profile row — use admin client so it bypasses RLS
    const { error: insertError } = await supabaseAdmin.from('profiles').insert({
      id: newAuthUser.user.id,
      email,
      full_name: full_name || null,
      role,
      status: 'active',
      created_by: caller.id,
    })

    if (insertError) {
      // Roll back: delete the auth user to keep things consistent
      await supabaseAdmin.auth.admin.deleteUser(newAuthUser.user.id)
      return jsonResponse({ error: insertError.message }, 500)
    }

    return jsonResponse({
      user: {
        id: newAuthUser.user.id,
        email,
        full_name: full_name || null,
        role,
        status: 'active',
      },
    }, 200)
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal server error'
    return jsonResponse({ error: message }, 500)
  }
})

function jsonResponse(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

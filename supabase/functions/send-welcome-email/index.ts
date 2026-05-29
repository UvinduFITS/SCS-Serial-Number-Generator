// Supabase Edge Function: send-welcome-email
// Sends a welcome email with login credentials via Gmail SMTP.
// SMTP credentials are kept in Supabase secrets (never in the frontend).
// Only authenticated admins can invoke this function.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { SMTPClient } from 'https://deno.land/x/denomailer@1.6.0/mod.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    console.log('[send-welcome-email] Request received')

    // ── 1. Verify caller is an authenticated admin ──────────────
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')

    if (!supabaseUrl || !anonKey) {
      console.error('Missing SUPABASE_URL or SUPABASE_ANON_KEY')
      return json({ error: 'Server misconfigured: missing Supabase env vars' }, 500)
    }

    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return json({ error: 'Missing authorization header' }, 401)

    const supabase = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    })

    const { data: { user }, error: userErr } = await supabase.auth.getUser()
    if (userErr || !user) {
      console.error('Auth error:', userErr)
      return json({ error: 'Unauthorized' }, 401)
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role, status')
      .eq('id', user.id)
      .single()

    if (!profile || profile.role !== 'admin' || profile.status !== 'active') {
      return json({ error: 'Forbidden: admin only' }, 403)
    }

    // ── 2. Parse input ──────────────────────────────────────────
    const { email, full_name, password, role, login_url } = await req.json()
    if (!email || !password) {
      return json({ error: 'email and password are required' }, 400)
    }

    console.log('[send-welcome-email] Sending email to:', email)

    // ── 3. Verify SMTP env vars ─────────────────────────────────
    const smtpHost = Deno.env.get('SMTP_HOST') || 'smtp.gmail.com'
    const smtpPort = parseInt(Deno.env.get('SMTP_PORT') || '465')
    const smtpUser = Deno.env.get('SMTP_USER')
    const smtpPass = Deno.env.get('SMTP_PASS')

    if (!smtpUser || !smtpPass) {
      console.error('Missing SMTP_USER or SMTP_PASS secrets')
      return json({
        error: 'SMTP credentials not configured. Set SMTP_USER and SMTP_PASS in Edge Function secrets.',
      }, 500)
    }

    console.log(`[send-welcome-email] SMTP config: ${smtpUser}@${smtpHost}:${smtpPort}`)

    // ── 4. Create SMTP client + send email ──────────────────────
    let client: SMTPClient | null = null
    try {
      client = new SMTPClient({
        connection: {
          hostname: smtpHost,
          port: smtpPort,
          tls: true,
          auth: {
            username: smtpUser,
            password: smtpPass,
          },
        },
        debug: { log: true, allowUnsecure: false },
        pool: false,
      })

      const displayName = full_name?.trim() || email.split('@')[0]
      const roleLabel = role === 'admin' ? 'Administrator' : 'Operations User'
      const appUrl = login_url || 'http://localhost:5173/login'

      const html = buildEmailHtml({ name: displayName, email, password, role: roleLabel, login_url: appUrl })
      const plain = buildPlainText({ name: displayName, email, password, role: roleLabel, login_url: appUrl })

      await client.send({
        from: `SCS Operations <${smtpUser}>`,
        to: email,
        subject: 'Welcome to SCS Operations — Your Login Details',
        content: plain,
        html,
      })

      console.log('[send-welcome-email] Email sent successfully')

      try { await client.close() } catch (_) { /* ignore */ }

      return json({ success: true, sent_to: email }, 200)

    } catch (smtpErr) {
      try { if (client) await client.close() } catch (_) { /* ignore */ }
      const msg = smtpErr instanceof Error ? smtpErr.message : String(smtpErr)
      console.error('[send-welcome-email] SMTP error:', msg)
      console.error('[send-welcome-email] Stack:', smtpErr instanceof Error ? smtpErr.stack : '')
      return json({
        error: `SMTP send failed: ${msg}`,
        hint: 'Make sure SMTP_PASS is a Gmail App Password (16 chars, no spaces) and 2FA is enabled on the Gmail account.',
      }, 500)
    }

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[send-welcome-email] Top-level error:', msg)
    return json({ error: msg }, 500)
  }
})

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

function buildPlainText(opts: {
  name: string; email: string; password: string; role: string; login_url: string
}) {
  return `Hi ${opts.name},

Your SCS Operations account has been created.

Login details:
  Email:    ${opts.email}
  Password: ${opts.password}
  Role:     ${opts.role}

Login here: ${opts.login_url}

For security, please change your password after your first login.

— SCS Operations Team
`
}

function buildEmailHtml(opts: {
  name: string; email: string; password: string; role: string; login_url: string
}) {
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Welcome to SCS Operations</title></head>
<body style="margin:0;padding:0;background:#f0f2f5;font-family:'Segoe UI',-apple-system,BlinkMacSystemFont,Roboto,Arial,sans-serif;">
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#f0f2f5;padding:30px 12px;">
    <tr><td align="center">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" style="max-width:600px;background:#ffffff;border-radius:14px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,0.06);">
        <tr><td style="background:linear-gradient(135deg,#2563eb 0%,#1e40af 100%);padding:36px 30px;text-align:center;">
          <div style="display:inline-block;width:56px;height:56px;background:#ffffff;border-radius:12px;line-height:56px;font-size:20px;font-weight:800;color:#2563eb;margin-bottom:14px;">SCS</div>
          <h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:700;">Welcome to SCS Operations</h1>
          <p style="margin:6px 0 0;color:#dbeafe;font-size:13px;">Serial Number Generator System</p>
        </td></tr>
        <tr><td style="padding:32px 36px 16px;">
          <h2 style="margin:0 0 12px;color:#111827;font-size:18px;font-weight:600;">Hi ${escapeHtml(opts.name)},</h2>
          <p style="margin:0 0 18px;color:#4b5563;font-size:14px;line-height:1.6;">An administrator has created an account for you on the SCS Operations Serial Number Generator System. Below are your login details — please keep them confidential.</p>
        </td></tr>
        <tr><td style="padding:0 36px 24px;">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:10px;">
            <tr><td style="padding:18px 22px;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                <tr><td style="padding:8px 0;border-bottom:1px solid #e5e7eb;">
                  <p style="margin:0;color:#9ca3af;font-size:11px;text-transform:uppercase;letter-spacing:0.6px;font-weight:600;">Email Address</p>
                  <p style="margin:4px 0 0;color:#111827;font-size:14px;font-weight:600;font-family:'Courier New',monospace;">${escapeHtml(opts.email)}</p>
                </td></tr>
                <tr><td style="padding:8px 0;border-bottom:1px solid #e5e7eb;">
                  <p style="margin:0;color:#9ca3af;font-size:11px;text-transform:uppercase;letter-spacing:0.6px;font-weight:600;">Temporary Password</p>
                  <p style="margin:4px 0 0;color:#111827;font-size:14px;font-weight:600;font-family:'Courier New',monospace;">${escapeHtml(opts.password)}</p>
                </td></tr>
                <tr><td style="padding:8px 0;">
                  <p style="margin:0;color:#9ca3af;font-size:11px;text-transform:uppercase;letter-spacing:0.6px;font-weight:600;">Account Role</p>
                  <p style="margin:4px 0 0;color:#111827;font-size:14px;font-weight:600;">${escapeHtml(opts.role)}</p>
                </td></tr>
              </table>
            </td></tr>
          </table>
        </td></tr>
        <tr><td align="center" style="padding:8px 36px 28px;">
          <a href="${escapeHtml(opts.login_url)}" target="_blank" style="display:inline-block;padding:14px 36px;background:#2563eb;color:#ffffff;text-decoration:none;border-radius:8px;font-weight:600;font-size:14px;box-shadow:0 4px 12px rgba(37,99,235,0.3);">Go to System →</a>
        </td></tr>
        <tr><td style="padding:0 36px 28px;">
          <div style="background:#fef3c7;border-left:3px solid #f59e0b;padding:12px 16px;border-radius:6px;">
            <p style="margin:0;color:#92400e;font-size:12px;line-height:1.5;"><strong>Security tip:</strong> For your safety, please change your password immediately after your first login.</p>
          </div>
        </td></tr>
        <tr><td style="background:#f9fafb;padding:20px 30px;text-align:center;border-top:1px solid #e5e7eb;">
          <p style="margin:0;color:#9ca3af;font-size:11px;line-height:1.5;">SCS Operations Internal System — Authorized Users Only<br>If you did not expect this email, please contact your administrator.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`
}

function escapeHtml(s: string) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

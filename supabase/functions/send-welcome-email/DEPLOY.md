# Deploy `send-welcome-email` Edge Function

This function sends a welcome email with login credentials when an admin
creates a new user. SMTP credentials are kept as Supabase secrets.

---

## Method 1: Deploy via Supabase Dashboard (Easiest, no CLI required)

### Step 1: Create the Edge Function

1. Go to your Supabase project dashboard:
   `https://supabase.com/dashboard/project/lutnkqteeaagswawmnka/functions`
2. Click **"Create a new function"**
3. Name it exactly: **`send-welcome-email`**
4. Open the file [`index.ts`](index.ts) from this folder
5. Copy ALL the contents and paste into the editor on Supabase
6. Click **Deploy function**

### Step 2: Set SMTP Secrets

1. In the same Functions page, click **"Manage secrets"** (or go to **Settings → Edge Functions → Secrets**)
2. Add these secrets one by one:

```
Name      Value
─────────────────────────────────────────────
SMTP_HOST   smtp.gmail.com
SMTP_PORT   465
SMTP_USER   automation@fitsexpress.com
SMTP_PASS   hmgifvoxndjzorlg
```

3. Click **Save**

That's it — the function is live!

---

## Method 2: Deploy via Supabase CLI

```powershell
# Navigate to project root
cd "C:\Users\developer_fitsexpres\Desktop\SCS Serial NUmber Generator"

# Login (one-time)
supabase login

# Link to your project (one-time)
supabase link --project-ref lutnkqteeaagswawmnka

# Set SMTP secrets
supabase secrets set SMTP_HOST=smtp.gmail.com
supabase secrets set SMTP_PORT=465
supabase secrets set SMTP_USER=automation@fitsexpress.com
supabase secrets set SMTP_PASS=hmgifvoxndjzorlg

# Deploy
supabase functions deploy send-welcome-email
```

---

## Testing

After deployment, go to your app:

1. Login as admin
2. Navigate to **User Management → Add User**
3. Fill in name, email, password, role
4. Click **Create User**

You should see:
- A success toast: `User xxx@... created and welcome email sent`
- The recipient receives a beautifully formatted email with their login credentials

---

## Troubleshooting

| Issue | Fix |
|---|---|
| Email not received | Check the Edge Function logs in Supabase Dashboard → Functions → send-welcome-email → Logs |
| `SMTP_PASS authentication failed` | Make sure you're using a Gmail **App Password**, not your regular password. Generate one at: https://myaccount.google.com/apppasswords |
| `Forbidden: admin only` | Confirm the calling user's profile has `role='admin'` and `status='active'` |
| Email goes to spam | Add SPF/DKIM records for your domain, or have users mark first email as "not spam" |

---

## Gmail App Password Note

The password `hmgifvoxndjzorlg` looks like a Gmail App Password (16 chars, no spaces). This is correct — Gmail SMTP requires App Passwords when 2FA is enabled on the account.

To rotate the password:
1. Go to https://myaccount.google.com/apppasswords
2. Generate a new app password
3. Update the `SMTP_PASS` secret in Supabase

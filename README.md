# SCS Operations — Serial Number Generator

A secure internal web tool for SCS Operations to generate unique sequential **Job Numbers** and **HAWB Numbers** for shipment operations.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18 + Vite + Tailwind CSS |
| Routing | React Router v6 |
| Backend / DB | Supabase (Auth, PostgreSQL, RLS, RPC) |
| User Creation | Supabase Edge Function |
| Excel Export | SheetJS (xlsx) |

---

## Number Format

```
[TYPE_PREFIX] + LK + [SHIPMENT_CODE] + [7-DIGIT_SEQUENCE]

Examples:
  JLKAE0000001   ← Job Number, Air Export, sequence 1
  HLKAE0000001   ← HAWB Number, Air Export, sequence 1
  JLKAI0000042   ← Job Number, Air Import, sequence 42
```

Each `(shipment_type, number_type)` pair has its own independent counter.

---

## Prerequisites

- Node.js 18+ and npm
- A [Supabase](https://supabase.com) project (free tier works)
- Supabase CLI (optional, for Edge Functions)

---

## Step 1 — Clone and Install

```bash
cd "SCS Serial NUmber Generator"
npm install
```

---

## Step 2 — Create Environment File

Copy `.env.example` to `.env.local` and fill in your Supabase values:

```bash
cp .env.example .env.local
```

```env
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

Both values are found in your Supabase project under **Settings → API**.

---

## Step 3 — Run SQL Migrations

Open the **Supabase SQL Editor** and run each file in order:

### 3a. Create Tables and Seed Counters

Paste and run: `supabase/migrations/001_create_tables.sql`

This creates:
- `profiles` — user accounts linked to `auth.users`
- `counters` — one row per (shipment_type, number_type) pair, pre-seeded with all 10 combinations
- `generated_numbers` — permanent immutable audit trail

### 3b. Enable RLS and Create Policies

Paste and run: `supabase/migrations/002_rls_policies.sql`

This enables Row Level Security and creates the `is_admin()` helper function
(SECURITY DEFINER to avoid circular policy evaluation).

### 3c. Create the Atomic Number Generation Function

Paste and run: `supabase/migrations/003_generate_reference_number_function.sql`

This creates the `generate_reference_number(p_shipment_type, p_number_type)` RPC function
that is the ONLY way to generate numbers. It uses `SELECT FOR UPDATE` to prevent duplicates
under concurrent requests.

---

## Step 4 — Create the First Admin User

Because the Edge Function requires an admin to create users, you must create the
first admin manually.

**In Supabase Dashboard:**

1. Go to **Authentication → Users → Add User**
2. Enter email and password, click **Create User**
3. Copy the new user's UUID from the users table

**Then run this SQL** (replace placeholders):

```sql
INSERT INTO public.profiles (id, email, full_name, role, status)
VALUES (
  '<UUID-from-step-above>',
  'admin@yourcompany.com',
  'System Administrator',
  'admin',
  'active'
);
```

---

## Step 5 — Deploy the Edge Function

The Edge Function creates new users without exposing the service role key to the browser.

### Using Supabase CLI

```bash
# Install CLI if needed
npm install -g supabase

# Login
supabase login

# Link to your project
supabase link --project-ref your-project-ref

# Deploy the function
supabase functions deploy create-user
```

The function automatically receives `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, and
`SUPABASE_ANON_KEY` as environment variables — no manual secrets needed.

---

## Step 6 — Run the App

```bash
npm run dev
```

Open http://localhost:5173 and sign in with the admin credentials from Step 4.

---

## Step 7 — Build for Production

```bash
npm run build
```

Deploy the `dist/` folder to any static hosting service (Vercel, Netlify, Cloudflare Pages, etc.).

---

## User Roles

| Feature | Operations User | Administrator |
|---|---|---|
| Log in | ✅ | ✅ |
| Generate Job Numbers | ✅ | ✅ |
| Generate HAWB Numbers | ✅ | ✅ |
| View Audit Logs | ✗ | ✅ |
| Filter Audit Logs | ✗ | ✅ |
| Export Logs to Excel | ✗ | ✅ |
| Add Users | ✗ | ✅ |
| Change Roles | ✗ | ✅ |
| Activate / Deactivate Users | ✗ | ✅ |
| Send Password Resets | ✗ | ✅ |

---

## Project Structure

```
SCS Serial NUmber Generator/
├── src/
│   ├── components/
│   │   ├── Layout.jsx          # App shell with header + sidebar
│   │   ├── Sidebar.jsx         # Role-aware navigation
│   │   ├── ProtectedRoute.jsx  # Redirect unauthenticated users
│   │   ├── AdminRoute.jsx      # Redirect non-admins
│   │   ├── Button.jsx          # Reusable button with loading state
│   │   ├── Input.jsx           # Form input with label + error
│   │   └── Select.jsx          # Form select with label + error
│   ├── pages/
│   │   ├── Login.jsx           # Authentication page
│   │   ├── GenerateNumber.jsx  # Main generation UI
│   │   ├── AdminLogs.jsx       # Audit log table with filters + export
│   │   └── UserManagement.jsx  # Admin user CRUD
│   ├── lib/
│   │   ├── supabaseClient.js   # Supabase JS client singleton
│   │   ├── auth.js             # signIn / signOut / passwordReset helpers
│   │   └── exportExcel.js      # xlsx export utility
│   ├── hooks/
│   │   ├── useAuth.js          # AuthContext + AuthProvider + useAuth hook
│   │   └── useProfile.js       # Standalone profile fetch hook
│   ├── App.jsx                 # Route definitions
│   └── main.jsx                # React entry point
├── supabase/
│   ├── migrations/
│   │   ├── 001_create_tables.sql
│   │   ├── 002_rls_policies.sql
│   │   └── 003_generate_reference_number_function.sql
│   └── functions/
│       └── create-user/
│           └── index.ts        # Edge Function for secure user creation
├── .env.example
├── index.html
├── package.json
├── tailwind.config.js
├── vite.config.js
└── README.md
```

---

## Security Notes

- The **service role key is never in the frontend**. User creation goes through the Edge Function which runs server-side.
- All number generation is done in a **SECURITY DEFINER PostgreSQL function** using `SELECT FOR UPDATE` — no counters in React, no duplicates possible.
- **RLS is enabled** on all tables. Operations users cannot read the `generated_numbers` table directly.
- Role is validated from the `profiles` table on every admin operation, not from localStorage.
- Generated numbers are **immutable** — no UPDATE or DELETE policies exist on `generated_numbers`.

---

## Troubleshooting

| Problem | Solution |
|---|---|
| "User profile not found" on login | Run the profile INSERT SQL from Step 4 |
| Edge Function returns 403 | Ensure the calling user's profile has `role = 'admin'` and `status = 'active'` |
| "Missing environment variable" on start | Check `.env.local` has both `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` |
| Numbers not generating | Ensure migration 003 was run and counters table is seeded (migration 001) |
| Can't see Audit Logs | Confirm your profile has `role = 'admin'` in the profiles table |

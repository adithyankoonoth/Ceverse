# Supabase setup for Ceverse

Ceverse uses **Supabase** for:

- **Auth** — email/password + Google OAuth  
- **Postgres** — application data (via Prisma)  
- **Auth triggers** — auto-create `public.users` + profiles on signup  

## 1. Create a project

1. Go to [supabase.com](https://supabase.com) → **New project**  
2. Note the **database password** you set  

## 2. Copy API keys

**Project Settings → API**

| Env var | Where |
|---------|--------|
| `NEXT_PUBLIC_SUPABASE_URL` | Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `anon` `public` key |
| `SUPABASE_SERVICE_ROLE_KEY` | `service_role` key (server only!) |

## 3. Database connection strings

**Project Settings → Database → Connection string**

Use:

- **Transaction pooler** (port `6543`) → `DATABASE_URL`  
  Append `?pgbouncer=true` if not present.  
- **Session mode / direct** (port `5432`) → `DIRECT_URL`  

Example shape:

```env
DATABASE_URL="postgresql://postgres.XXXX:PASSWORD@aws-0-REGION.pooler.supabase.com:6543/postgres?pgbouncer=true"
DIRECT_URL="postgresql://postgres.XXXX:PASSWORD@aws-0-REGION.pooler.supabase.com:5432/postgres"
```

## 4. Run SQL (schema + auth sync)

### Option A — recommended (SQL Editor)

In Supabase → **SQL Editor**, run **in order**:

1. **`supabase/ceverse_schema.sql`** — enums + all app tables  
2. **`supabase/02_auth_trigger.sql`** — `auth.users` → `public.users` trigger  
3. **`supabase/03_rls_basics.sql`** — basic RLS (optional but recommended)  

### Option B — Prisma push

```bash
npx prisma db push
# then still run 02_auth_trigger.sql and 03_rls_basics.sql in SQL Editor
```

## 5. Enable Google sign-in

### A. Google Cloud Console

1. [Google Cloud Console](https://console.cloud.google.com/) → create/select project  
2. **APIs & Services → Credentials → Create OAuth client ID**  
3. Application type: **Web application**  
4. **Authorized redirect URIs** — copy from Supabase Auth providers page, usually:

```text
https://YOUR_PROJECT_REF.supabase.co/auth/v1/callback
```

5. Copy **Client ID** and **Client Secret**

### B. Supabase Dashboard

1. **Authentication → Providers → Google** → Enable  
2. Paste Client ID + Client Secret → Save  

### C. Redirect URLs (Supabase)

**Authentication → URL configuration**

| Field | Value |
|-------|--------|
| Site URL | `http://localhost:3000` (prod: your domain) |
| Redirect URLs | `http://localhost:3000/auth/callback` and your production callback |

## 6. Email/password settings

**Authentication → Providers → Email**

- Enable Email provider  
- For local demos: disable **Confirm email** (or keep on for production)  
- Password requirements: set min length as needed (app signup still enforces 12+)  

## 7. App `.env`

```bash
cp .env.example .env
# fill Supabase + DATABASE_URL values
```

```bash
npm install
npx prisma generate
npx prisma db push   # if you skipped full SQL schema
# run 02_auth_trigger.sql in SQL Editor
npm run db:seed
npm run dev
```

## 8. Demo accounts (after seed)

Password: `CeverseDemo123!`

| Email | Role |
|-------|------|
| admin@ceverse.local | SUPER_ADMIN |
| creator@ceverse.local | CREATOR |
| operator@ceverse.local | MANUFACTURER |
| designer@ceverse.local | DESIGNER |

Note: `.local` emails work only when you create them via seed/Admin API. For Google, use a real Google account.

## 9. Auth flow (what the app does)

| Action | How |
|--------|-----|
| Email sign-up | `supabase.auth.signUp` + metadata `full_name`, `role` |
| Email sign-in | `supabase.auth.signInWithPassword` |
| Google | `supabase.auth.signInWithOAuth({ provider: 'google' })` → `/auth/callback` |
| Session | Cookie session via `@supabase/ssr` middleware |
| Profile row | Trigger `handle_new_user` + server `ensureAppUser` fallback |

## Security

Never commit `SUPABASE_SERVICE_ROLE_KEY` or the DB password. The anon key is public by design but protected by RLS.

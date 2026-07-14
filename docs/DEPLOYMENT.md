# Deployment Guide

## Recommended production stack

- **App:** Vercel (Next.js standalone also works in Docker)
- **DB + Auth:** Supabase (Postgres + Auth + optional Storage)
- **Redis:** Upstash or managed Redis
- **Storage:** S3 / R2 / Supabase Storage
- **Email:** Supabase Auth emails + Resend for product mail
- **Payments:** Stripe Connect

## Environment

Copy `.env.example` → `.env` and set real secrets. See [SUPABASE.md](./SUPABASE.md).

Critical:

- `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` (server only)
- `DATABASE_URL` (pooler) + `DIRECT_URL` (migrations)
- `NEXT_PUBLIC_APP_URL` must match Site URL / redirect allowlist in Supabase

## Database

```bash
npx prisma migrate deploy
npm run db:seed
```

## Docker

```bash
docker compose up --build
```

## CI

GitHub Actions runs typecheck, lint, unit tests, and dependency audit on push/PR.

## Workers

```bash
npm run worker
```

Requires `REDIS_URL`.

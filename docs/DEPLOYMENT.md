# Deployment Guide

## Recommended production stack

- **App:** Vercel (Next.js standalone also works in Docker)
- **DB:** Neon PostgreSQL
- **Redis:** Upstash or managed Redis
- **Storage:** S3 / R2 / MinIO
- **Email:** Resend
- **Payments:** Stripe Connect

## Environment

Copy `.env.example` → `.env` and set real secrets.

Critical:

- `BETTER_AUTH_SECRET` ≥ 32 chars
- `DATABASE_URL` (pooled) + `DIRECT_URL` (migrations)
- `NEXT_PUBLIC_APP_URL` / `BETTER_AUTH_URL` must match public origin

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

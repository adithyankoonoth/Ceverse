# Security

Ceverse targets OWASP Top 10 controls for a high-trust commercial platform.

## Authentication

- Supabase Auth (email/password + Google OAuth)
- Strong password policy at signup (12+ chars, complexity)
- HTTP-only session cookies via `@supabase/ssr`
- Auth user id is UUID; app profile is `public.users` (synced by trigger)

## Authorization

- Server-side session required for all protected APIs and pages
- RBAC matrix in `src/lib/rbac.ts`
- Deal membership checks prevent IDOR on deal-scoped resources

## Input / output

- Zod validation on APIs and server actions
- Prisma parameterized queries (SQLi mitigation)
- React escapes output by default (XSS)
- Upload MIME allowlist + size cap; signed URLs only

## Network / browser

- CSP, HSTS, X-Frame-Options DENY, nosniff, Permissions-Policy
- Open redirect protection on `next` query param
- Rate limiting on sensitive endpoints

## Audit

Sensitive actions write to `audit_logs` (auth, payments, verification, admin).

## Secrets

Never commit `.env`. Rotate Supabase service role, Stripe, and S3 keys regularly.

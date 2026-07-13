# Ceverse Architecture

Ceverse is a production SaaS for creator-led brand launches. It is a product of **Favverse**.

## Style

Clean Architecture + feature-oriented modules:

| Layer | Location | Responsibility |
|-------|----------|----------------|
| UI | `src/app`, `src/components` | Presentation only |
| Validation | `src/validation` | Zod request/input schemas |
| Services | `src/services` | Business rules, orchestration |
| Domain | `src/domain` | Pure models, scoring, errors |
| Infrastructure | `src/lib` | DB, auth, redis, storage, email, stripe |
| Workers | `src/workers` | BullMQ background jobs |

**Rule:** no business logic in React components. Routes/actions validate input, enforce authz, call services, map errors.

## Auth & authorization

- **Better Auth** email/password (min 12 chars), HTTP-only cookies, SameSite strict in production.
- Middleware performs a cheap session-cookie gate for protected shells.
- Real authorization is server-side via `requireSession` + RBAC (`src/lib/rbac.ts`).
- Admin routes require `ADMIN` / `SUPER_ADMIN`.

## Data

- PostgreSQL via Prisma (Neon-ready with pooled `DATABASE_URL` + `DIRECT_URL`).
- Soft deletes (`deletedAt`), optimistic locking (`version`), audit log table.
- Full-text ready string fields on profiles for future `tsvector` indexes / Meilisearch.

## Core domains

1. **Marketplace** — search, filters, bookmarks, match scores
2. **Proposals** — draft/send/counter/accept → deal creation
3. **Deal rooms** — milestones, tasks, decisions, activity, health
4. **Contracts** — versioned structured agreements + signatures
5. **Escrow** — fund / release against milestones (Stripe Connect)
6. **Messaging** — conversations, threads, pins
7. **Reputation** — reviews + events → trust score
8. **Verification & disputes** — admin mediation
9. **Admin** — users, flags, health, analytics

## AI engines (deterministic, explainable)

- `computeCompatibilityScore` — weighted multi-factor match
- `computeDealHealth` — risk band + rationale list

These are pure functions (unit-tested) so ranking stays auditable.

## Security controls

- Zod validation on every write path
- RBAC least privilege
- Rate limiting (Redis with in-memory fallback)
- CSP / HSTS / frame deny via `next.config.ts`
- Signed S3 uploads with MIME allowlist
- Audit log for sensitive actions
- Open-redirect safe `next` params

## Runtime topology

```
Browser → Next.js (RSC + Route Handlers + Server Actions)
            ├─ Prisma → PostgreSQL (Neon)
            ├─ Redis → rate limits + BullMQ
            ├─ Stripe Connect
            ├─ Resend
            └─ S3-compatible storage
```

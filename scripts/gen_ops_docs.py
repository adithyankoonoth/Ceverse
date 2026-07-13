#!/usr/bin/env python3
import os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def w(rel: str, content: str) -> None:
    path = os.path.join(ROOT, *rel.split("/"))
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8", newline="\n") as f:
        f.write(content)
    print("wrote", rel)


w(
    "prisma/seed.ts",
    r'''import { PrismaClient, UserRole } from "@prisma/client";
import { hashPassword } from "better-auth/crypto";

const db = new PrismaClient();

async function upsertUser(input: {
  email: string;
  name: string;
  role: UserRole;
  password: string;
  trustScore?: number;
}) {
  const passwordHash = await hashPassword(input.password);
  const user = await db.user.upsert({
    where: { email: input.email },
    create: {
      email: input.email,
      name: input.name,
      role: input.role,
      emailVerified: true,
      trustScore: input.trustScore ?? 70,
      accounts: {
        create: {
          accountId: input.email,
          providerId: "credential",
          password: passwordHash,
        },
      },
    },
    update: {
      name: input.name,
      role: input.role,
      trustScore: input.trustScore ?? 70,
    },
  });

  // Ensure credential account exists on re-seed
  const account = await db.account.findFirst({
    where: { userId: user.id, providerId: "credential" },
  });
  if (!account) {
    await db.account.create({
      data: {
        userId: user.id,
        accountId: input.email,
        providerId: "credential",
        password: passwordHash,
      },
    });
  } else {
    await db.account.update({
      where: { id: account.id },
      data: { password: passwordHash },
    });
  }

  return user;
}

async function main() {
  const password = "CeverseDemo123!";

  const admin = await upsertUser({
    email: "admin@ceverse.local",
    name: "Ceverse Admin",
    role: "SUPER_ADMIN",
    password,
    trustScore: 100,
  });

  const creator = await upsertUser({
    email: "creator@ceverse.local",
    name: "Ava Chen",
    role: "CREATOR",
    password,
    trustScore: 82,
  });

  const operator = await upsertUser({
    email: "operator@ceverse.local",
    name: "Nova Manufacturing",
    role: "MANUFACTURER",
    password,
    trustScore: 88,
  });

  const designer = await upsertUser({
    email: "designer@ceverse.local",
    name: "Studio North",
    role: "DESIGNER",
    password,
    trustScore: 76,
  });

  await db.creatorProfile.upsert({
    where: { userId: creator.id },
    create: {
      userId: creator.id,
      displayName: "Ava Chen",
      bio: "Lifestyle creator building a clean-beauty brand with 1.2M engaged followers.",
      location: "Los Angeles, US",
      countryCode: "US",
      audienceSize: 1_200_000,
      engagementRate: 0.041,
      industries: ["beauty", "lifestyle", "wellness"],
      preferredCategories: ["skincare", "supplements"],
      preferredPartnerships: ["revenue_share", "equity"],
      languages: ["en"],
      verificationStatus: "VERIFIED",
      socialLinks: { instagram: "https://instagram.com/ava", tiktok: "https://tiktok.com/@ava" },
    },
    update: {
      verificationStatus: "VERIFIED",
      audienceSize: 1_200_000,
    },
  });

  await db.operatorProfile.upsert({
    where: { userId: operator.id },
    create: {
      userId: operator.id,
      companyName: "Nova Manufacturing Co.",
      companyType: "MANUFACTURER",
      bio: "ISO-certified cosmetics manufacturer specializing in clean formulations and US fulfillment.",
      location: "Austin, US",
      countryCode: "US",
      employeeCount: 120,
      factoryCount: 2,
      certifications: ["ISO 22716", "GMP", "FDA registered"],
      manufacturingCapacity: "2M units / year",
      moq: 1000,
      regionsServed: ["US", "CA", "GLOBAL"],
      hasWarehousing: true,
      hasFulfillment: true,
      qualityCerts: ["ISO 22716"],
      industries: ["beauty", "wellness"],
      categories: ["skincare", "supplements", "haircare"],
      successRate: 0.94,
      averageDeliveryDays: 28,
      priceRangeMin: 5000,
      priceRangeMax: 250000,
      verificationStatus: "VERIFIED",
    },
    update: { verificationStatus: "VERIFIED" },
  });

  await db.operatorProfile.upsert({
    where: { userId: designer.id },
    create: {
      userId: designer.id,
      companyName: "Studio North",
      companyType: "DESIGNER",
      bio: "Packaging and brand systems for premium DTC launches.",
      location: "New York, US",
      countryCode: "US",
      moq: 1,
      regionsServed: ["US", "EU"],
      industries: ["beauty", "lifestyle"],
      categories: ["packaging", "branding"],
      successRate: 0.91,
      averageDeliveryDays: 21,
      verificationStatus: "VERIFIED",
    },
    update: {},
  });

  await db.featureFlag.upsert({
    where: { key: "ai_matching" },
    create: {
      key: "ai_matching",
      enabled: true,
      description: "Enable AI compatibility scoring in marketplace",
    },
    update: { enabled: true },
  });

  await db.featureFlag.upsert({
    where: { key: "escrow_payments" },
    create: {
      key: "escrow_payments",
      enabled: true,
      description: "Enable Stripe Connect escrow flows",
    },
    update: { enabled: true },
  });

  // Demo proposal + deal if none
  const existing = await db.proposal.findFirst({
    where: { senderId: creator.id, recipientId: operator.id },
  });
  if (!existing) {
    const proposal = await db.proposal.create({
      data: {
        senderId: creator.id,
        recipientId: operator.id,
        title: "Clean serum production partnership",
        summary:
          "Looking for a verified manufacturer to produce a vitamin-C serum with US fulfillment, 5k first run, 15% revenue share, and 90-day QA window.",
        status: "SENT",
        budgetMin: 25000,
        budgetMax: 80000,
        currency: "USD",
        timelineDays: 120,
        terms: {
          revenueSharePercent: 15,
          trademarkOwnership: "Creator retains trademark",
          paymentTerms: "Escrow with milestone unlocks",
          terminationClause: "30-day written notice",
          disputeClause: "Ceverse mediation then binding arbitration",
        },
        expiresAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
      },
    });
    console.log("Seeded proposal", proposal.id);
  }

  console.log("Seed complete");
  console.log("Demo password for all users:", password);
  console.log({
    admin: admin.email,
    creator: creator.email,
    operator: operator.email,
    designer: designer.email,
  });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
''',
)

w(
    "Dockerfile",
    r'''# syntax=docker/dockerfile:1

FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci

FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npx prisma generate
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nextjs
COPY --from=builder /app/public ./public
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
USER nextjs
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
CMD ["node", "server.js"]
''',
)

w(
    "docker-compose.yml",
    r'''services:
  postgres:
    image: postgres:16-alpine
    restart: unless-stopped
    environment:
      POSTGRES_USER: ceverse
      POSTGRES_PASSWORD: ceverse
      POSTGRES_DB: ceverse
    ports:
      - "5432:5432"
    volumes:
      - ceverse_pg:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ceverse -d ceverse"]
      interval: 5s
      timeout: 5s
      retries: 10

  redis:
    image: redis:7-alpine
    restart: unless-stopped
    ports:
      - "6379:6379"
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 5s
      timeout: 3s
      retries: 10

  app:
    build: .
    restart: unless-stopped
    ports:
      - "3000:3000"
    environment:
      NODE_ENV: production
      DATABASE_URL: postgresql://ceverse:ceverse@postgres:5432/ceverse?schema=public
      DIRECT_URL: postgresql://ceverse:ceverse@postgres:5432/ceverse?schema=public
      REDIS_URL: redis://redis:6379
      NEXT_PUBLIC_APP_URL: http://localhost:3000
      BETTER_AUTH_URL: http://localhost:3000
      BETTER_AUTH_SECRET: change-me-in-production-use-32chars-min
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy

volumes:
  ceverse_pg:
''',
)

w(
    ".dockerignore",
    r'''node_modules
.next
.git
coverage
playwright-report
test-results
.env
.env.*
*.md
docs
e2e
''',
)

w(
    ".github/workflows/ci.yml",
    r'''name: CI

on:
  push:
    branches: [master, main]
  pull_request:

jobs:
  verify:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:16-alpine
        env:
          POSTGRES_USER: ceverse
          POSTGRES_PASSWORD: ceverse
          POSTGRES_DB: ceverse
        ports: ["5432:5432"]
        options: >-
          --health-cmd "pg_isready -U ceverse -d ceverse"
          --health-interval 5s
          --health-timeout 5s
          --health-retries 10
      redis:
        image: redis:7-alpine
        ports: ["6379:6379"]
        options: >-
          --health-cmd "redis-cli ping"
          --health-interval 5s
          --health-timeout 3s
          --health-retries 10

    env:
      DATABASE_URL: postgresql://ceverse:ceverse@localhost:5432/ceverse?schema=public
      DIRECT_URL: postgresql://ceverse:ceverse@localhost:5432/ceverse?schema=public
      REDIS_URL: redis://localhost:6379
      NEXT_PUBLIC_APP_URL: http://localhost:3000
      BETTER_AUTH_URL: http://localhost:3000
      BETTER_AUTH_SECRET: ci-secret-must-be-at-least-32-chars!!
      NODE_ENV: test

    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
      - run: npm ci
      - run: npx prisma generate
      - run: npm run typecheck
      - run: npm run lint
      - run: npm test
      - run: npm run audit:deps
''',
)

w(
    "vitest.config.ts",
    r'''import path from "path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    coverage: {
      reporter: ["text", "html"],
      include: ["src/domain/**", "src/lib/rbac.ts", "src/lib/utils.ts"],
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
''',
)

w(
    "playwright.config.ts",
    r'''import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000",
    trace: "on-first-retry",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
''',
)

w(
    "tests/unit/rbac.test.ts",
    r'''import { describe, expect, it } from "vitest";
import {
  hasPermission,
  isAdmin,
  isCreator,
  isOperatorLike,
  permissionsFor,
} from "@/lib/rbac";

describe("rbac", () => {
  it("grants creators marketplace and escrow release", () => {
    expect(hasPermission("CREATOR", "marketplace:browse")).toBe(true);
    expect(hasPermission("CREATOR", "escrow:release")).toBe(true);
    expect(hasPermission("CREATOR", "admin:users")).toBe(false);
  });

  it("grants admins full admin surface", () => {
    expect(hasPermission("ADMIN", "admin:users")).toBe(true);
    expect(hasPermission("ADMIN", "verification:review")).toBe(true);
    expect(hasPermission("SUPER_ADMIN", "admin:impersonate")).toBe(true);
    expect(hasPermission("ADMIN", "admin:impersonate")).toBe(false);
  });

  it("classifies roles", () => {
    expect(isAdmin("ADMIN")).toBe(true);
    expect(isCreator("CREATOR")).toBe(true);
    expect(isOperatorLike("MANUFACTURER")).toBe(true);
    expect(isOperatorLike("CREATOR")).toBe(false);
  });

  it("returns non-empty permission sets", () => {
    expect(permissionsFor("CREATOR").length).toBeGreaterThan(5);
    expect(permissionsFor("SUPER_ADMIN").length).toBeGreaterThan(
      permissionsFor("CREATOR").length,
    );
  });
});
''',
)

w(
    "tests/unit/matching.test.ts",
    r'''import { describe, expect, it } from "vitest";
import { computeCompatibilityScore } from "@/domain/matching";

describe("computeCompatibilityScore", () => {
  it("scores strong aligned partners highly", () => {
    const result = computeCompatibilityScore({
      creatorIndustries: ["beauty", "wellness"],
      operatorIndustries: ["beauty", "skincare"],
      creatorCategories: ["skincare"],
      operatorCategories: ["skincare", "haircare"],
      creatorCountry: "US",
      operatorCountry: "US",
      operatorRegionsServed: ["US", "CA"],
      creatorTrustScore: 85,
      operatorTrustScore: 90,
      engagementRate: 0.05,
      audienceSize: 500_000,
      moq: 1000,
      successRate: 0.95,
      creatorVerified: true,
      operatorVerified: true,
      creatorLanguages: ["en"],
      operatorLanguages: ["en"],
    });
    expect(result.score).toBeGreaterThanOrEqual(70);
    expect(result.factors.length).toBeGreaterThan(5);
  });

  it("penalizes geo and industry mismatch", () => {
    const weak = computeCompatibilityScore({
      creatorIndustries: ["beauty"],
      operatorIndustries: ["industrial"],
      creatorCountry: "US",
      operatorCountry: "IN",
      operatorRegionsServed: ["IN"],
      creatorVerified: false,
      operatorVerified: false,
      moq: 100_000,
      audienceSize: 5_000,
    });
    expect(weak.score).toBeLessThan(60);
  });

  it("is deterministic", () => {
    const input = {
      creatorIndustries: ["beauty"],
      operatorIndustries: ["beauty"],
      creatorCountry: "US",
      operatorCountry: "US",
    };
    expect(computeCompatibilityScore(input)).toEqual(computeCompatibilityScore(input));
  });
});
''',
)

w(
    "tests/unit/deal-health.test.ts",
    r'''import { describe, expect, it } from "vitest";
import { computeDealHealth } from "@/domain/deal-health";

describe("computeDealHealth", () => {
  it("returns completed deals as low risk", () => {
    const result = computeDealHealth({ status: "COMPLETED" });
    expect(result.score).toBe(100);
    expect(result.riskLevel).toBe("LOW");
  });

  it("flags disputed deals as high risk", () => {
    const result = computeDealHealth({
      status: "DISPUTED",
      openDisputes: 1,
      overdueMilestones: 2,
      daysSinceLastActivity: 20,
      hasActiveContract: false,
    });
    expect(result.riskLevel).toBe("HIGH");
    expect(result.rationale.length).toBeGreaterThan(0);
  });

  it("rewards healthy active deals", () => {
    const result = computeDealHealth({
      status: "ACTIVE",
      milestoneCompletion: 0.8,
      overdueMilestones: 0,
      overdueTasks: 0,
      openDisputes: 0,
      daysSinceLastActivity: 1,
      escrowStatus: "FUNDED",
      hasActiveContract: true,
      memberTrustScores: [85, 90],
    });
    expect(result.score).toBeGreaterThanOrEqual(70);
    expect(result.riskLevel).toBe("LOW");
  });
});
''',
)

w(
    "tests/unit/pagination.test.ts",
    r'''import { describe, expect, it } from "vitest";
import {
  buildPaginatedResult,
  decodeCursor,
  encodeCursor,
  parsePaginationParams,
} from "@/lib/pagination";

describe("pagination", () => {
  it("parses and clamps page size", () => {
    const p = parsePaginationParams({
      query: { page: "2", pageSize: "999" },
      maxPageSize: 50,
    });
    expect(p.page).toBe(2);
    expect(p.pageSize).toBe(50);
    expect(p.offset).toBe(50);
  });

  it("builds meta correctly", () => {
    const result = buildPaginatedResult([1, 2], 25, { page: 1, pageSize: 10 });
    expect(result.meta.totalPages).toBe(3);
    expect(result.meta.hasNextPage).toBe(true);
  });

  it("round-trips cursors", () => {
    const cursor = encodeCursor(new Date("2026-01-01T00:00:00.000Z"), "abc");
    const decoded = decodeCursor(cursor);
    expect(decoded?.id).toBe("abc");
    expect(decoded?.createdAt).toBe("2026-01-01T00:00:00.000Z");
  });
});
''',
)

w(
    "e2e/smoke.spec.ts",
    r'''import { test, expect } from "@playwright/test";

test("landing page loads", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    "operating system",
  );
  await expect(page.getByRole("link", { name: /get started|launch on ceverse/i }).first()).toBeVisible();
});
''',
)

w(
    "docs/ARCHITECTURE.md",
    r'''# Ceverse Architecture

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
''',
)

w(
    "docs/API.md",
    r'''# Ceverse REST API (v1)

Base path: `/api/v1`  
Auth: Better Auth session cookie  
OpenAPI JSON: `GET /api/openapi`

## Envelope

Success:

```json
{ "ok": true, "data": {} }
```

Error:

```json
{ "ok": false, "error": { "code": "VALIDATION", "message": "..." } }
```

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | DB latency + status |
| GET | `/marketplace` | Search operators/creators |
| GET/POST | `/proposals` | List / create |
| GET/PATCH | `/proposals/:id` | Get / send-accept-reject-withdraw-counter |
| GET | `/deals` | List member deals |
| GET/PATCH | `/deals/:id` | Deal room / update |
| POST | `/matching` | Ranked matches or pair score |
| GET/PATCH | `/notifications` | List / mark read |
| GET/POST | `/messages` | Conversations / send |

Auth routes are under `/api/auth/*` (Better Auth).

## Pagination

Query: `page`, `pageSize` (max 50–100 depending on route), optional `cursor`.

## Rate limits

Marketplace, proposal creation, and messaging are rate-limited per user (and IP where available).
''',
)

w(
    "docs/DEPLOYMENT.md",
    r'''# Deployment Guide

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
''',
)

w(
    "docs/SECURITY.md",
    r'''# Security

Ceverse targets OWASP Top 10 controls for a high-trust commercial platform.

## Authentication

- Better Auth with strong password policy (12+ chars, complexity enforced at signup)
- HTTP-only cookies; Secure + SameSite Strict in production
- Session expiry + cookie cache; invalidation via Better Auth session APIs

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

Never commit `.env`. Rotate `BETTER_AUTH_SECRET`, Stripe, and S3 keys regularly.
''',
)

w(
    "README.md",
    r'''# Ceverse

**The operating system for creator-led brands.**  
A product by [Favverse](https://favverse.com).

Ceverse replaces Instagram DMs and verbal agreements with verified partners, structured proposals, deal rooms, contracts, escrow payments, reputation, analytics, and AI-assisted matching.

## Stack

- Next.js 15 (App Router) · React 19 · TypeScript
- PostgreSQL · Prisma · Redis · BullMQ
- Better Auth · Stripe Connect · Resend · S3
- Tailwind CSS 4 · shadcn-style UI · Framer Motion ready

## Quick start

```bash
cp .env.example .env
# edit secrets — generate BETTER_AUTH_SECRET with: openssl rand -base64 32

docker compose up -d postgres redis   # or use Neon + managed Redis
npm install
npx prisma db push
npm run db:seed
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Demo accounts (after seed)

Password for all: `CeverseDemo123!`

| Email | Role |
|-------|------|
| admin@ceverse.local | Super Admin |
| creator@ceverse.local | Creator |
| operator@ceverse.local | Manufacturer |
| designer@ceverse.local | Designer |

## Scripts

| Script | Purpose |
|--------|---------|
| `npm run dev` | Local app |
| `npm run build` / `start` | Production |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint |
| `npm test` | Vitest unit tests |
| `npm run test:e2e` | Playwright |
| `npm run db:*` | Prisma generate/migrate/seed |
| `npm run worker` | BullMQ workers |

## Documentation

- [Architecture](docs/ARCHITECTURE.md)
- [API](docs/API.md)
- [Deployment](docs/DEPLOYMENT.md)
- [Security](docs/SECURITY.md)

## Product surfaces

- Marketing landing
- Auth (sign-in / sign-up with role onboarding)
- Dashboard & analytics
- Marketplace + compatibility scores
- Proposals → Deal rooms
- Contracts, payments/escrow, messaging
- Notifications, settings
- Admin console (users, verifications, disputes, flags, health)

## License

Proprietary · Favverse
''',
)

# Fix globals.css utility classes if incomplete
print("ops docs done")

# Ceverse

**The operating system for creator-led brands.**  
A product by [Favverse](https://favverse.pages.dev).

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

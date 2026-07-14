# Ceverse

**The operating system for creator-led brands.**  
A product by [Favverse](https://favverse.pages.dev).

Ceverse replaces Instagram DMs and verbal agreements with verified partners, structured proposals, deal rooms, contracts, escrow payments, reputation, analytics, and AI-assisted matching.

## Stack

- Next.js 15 · React 19 · TypeScript · Tailwind
- **Supabase** — Auth (email + Google) + Postgres
- Prisma ORM · Redis/BullMQ · Stripe Connect · Resend · S3

## Quick start (Supabase)

1. Create a project at [supabase.com](https://supabase.com)
2. Follow **[docs/SUPABASE.md](docs/SUPABASE.md)** (SQL + Google OAuth)
3. Configure env and run:

```bash
cp .env.example .env
# fill NEXT_PUBLIC_SUPABASE_*, SUPABASE_SERVICE_ROLE_KEY, DATABASE_URL, DIRECT_URL

npm install
npx prisma generate
npx prisma db push          # or run supabase/ceverse_schema.sql in SQL Editor
# run supabase/02_auth_trigger.sql in Supabase SQL Editor
npm run db:seed
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### SQL files (Supabase → SQL Editor)

| File | Purpose |
|------|---------|
| `supabase/ceverse_schema.sql` | Full app schema (enums + tables) |
| `supabase/02_auth_trigger.sql` | Auto-create profile on signup |
| `supabase/03_rls_basics.sql` | Basic row-level security |

### Demo accounts (after seed)

Password: `CeverseDemo123!`

| Email | Role |
|-------|------|
| admin@ceverse.local | Super Admin |
| creator@ceverse.local | Creator |
| operator@ceverse.local | Manufacturer |
| designer@ceverse.local | Designer |

Sign-in also supports **Continue with Google** (after enabling Google provider).

## Scripts

| Script | Purpose |
|--------|---------|
| `npm run dev` | Local app |
| `npm run build` / `start` | Production |
| `npm run typecheck` | TypeScript |
| `npm test` | Unit tests |
| `npm run db:seed` | Seed via Supabase Admin API |
| `npm run worker` | BullMQ workers |

## Documentation

- [Supabase setup](docs/SUPABASE.md) ← **start here**
- [Architecture](docs/ARCHITECTURE.md)
- [API](docs/API.md)
- [Deployment](docs/DEPLOYMENT.md)
- [Security](docs/SECURITY.md)

## License

Proprietary · Favverse

/**
 * Seed demo users into Supabase Auth + public.users profiles.
 * Requires: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, DATABASE_URL
 */
import { PrismaClient, UserRole } from "@prisma/client";
import { createClient } from "@supabase/supabase-js";

const db = new PrismaClient();

const DEMO_PASSWORD = "CeverseDemo123!";

async function ensureAuthUser(input: {
  email: string;
  password: string;
  name: string;
  role: UserRole;
}) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      "Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to seed auth users",
    );
  }

  const admin = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // Try create; if exists, look up by email via list
  const created = await admin.auth.admin.createUser({
    email: input.email,
    password: input.password,
    email_confirm: true,
    user_metadata: {
      full_name: input.name,
      role: input.role,
    },
  });

  if (created.data.user) {
    return created.data.user;
  }

  const msg = created.error?.message ?? "";
  if (!/already|registered|exists/i.test(msg)) {
    throw new Error(`Failed to create ${input.email}: ${msg}`);
  }

  // Find existing user (paginated)
  let page = 1;
  for (;;) {
    const listed = await admin.auth.admin.listUsers({ page, perPage: 200 });
    const found = listed.data.users.find(
      (u) => u.email?.toLowerCase() === input.email.toLowerCase(),
    );
    if (found) {
      await admin.auth.admin.updateUserById(found.id, {
        password: input.password,
        email_confirm: true,
        user_metadata: { full_name: input.name, role: input.role },
      });
      return found;
    }
    if (listed.data.users.length < 200) break;
    page += 1;
  }

  throw new Error(`Could not create or find user ${input.email}`);
}

async function upsertProfile(
  userId: string,
  email: string,
  name: string,
  role: UserRole,
  trustScore: number,
) {
  await db.user.upsert({
    where: { id: userId },
    create: {
      id: userId,
      email,
      name,
      role,
      emailVerified: true,
      trustScore,
    },
    update: {
      name,
      role,
      emailVerified: true,
      trustScore,
      deletedAt: null,
      isActive: true,
    },
  });
}

async function main() {
  const adminAuth = await ensureAuthUser({
    email: "admin@ceverse.local",
    password: DEMO_PASSWORD,
    name: "Ceverse Admin",
    role: "SUPER_ADMIN",
  });
  const creatorAuth = await ensureAuthUser({
    email: "creator@ceverse.local",
    password: DEMO_PASSWORD,
    name: "Ava Chen",
    role: "CREATOR",
  });
  const operatorAuth = await ensureAuthUser({
    email: "operator@ceverse.local",
    password: DEMO_PASSWORD,
    name: "Nova Manufacturing",
    role: "MANUFACTURER",
  });
  const designerAuth = await ensureAuthUser({
    email: "designer@ceverse.local",
    password: DEMO_PASSWORD,
    name: "Studio North",
    role: "DESIGNER",
  });

  await upsertProfile(adminAuth.id, "admin@ceverse.local", "Ceverse Admin", "SUPER_ADMIN", 100);
  await upsertProfile(creatorAuth.id, "creator@ceverse.local", "Ava Chen", "CREATOR", 82);
  await upsertProfile(
    operatorAuth.id,
    "operator@ceverse.local",
    "Nova Manufacturing",
    "MANUFACTURER",
    88,
  );
  await upsertProfile(designerAuth.id, "designer@ceverse.local", "Studio North", "DESIGNER", 76);

  await db.creatorProfile.upsert({
    where: { userId: creatorAuth.id },
    create: {
      userId: creatorAuth.id,
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
      socialLinks: {
        instagram: "https://instagram.com/ava",
        tiktok: "https://tiktok.com/@ava",
      },
    },
    update: {
      verificationStatus: "VERIFIED",
      audienceSize: 1_200_000,
    },
  });

  await db.operatorProfile.upsert({
    where: { userId: operatorAuth.id },
    create: {
      userId: operatorAuth.id,
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
    where: { userId: designerAuth.id },
    create: {
      userId: designerAuth.id,
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

  const existing = await db.proposal.findFirst({
    where: { senderId: creatorAuth.id, recipientId: operatorAuth.id },
  });
  if (!existing) {
    await db.proposal.create({
      data: {
        senderId: creatorAuth.id,
        recipientId: operatorAuth.id,
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
  }

  console.log("Seed complete");
  console.log("Demo password:", DEMO_PASSWORD);
  console.log({
    admin: "admin@ceverse.local",
    creator: "creator@ceverse.local",
    operator: "operator@ceverse.local",
    designer: "designer@ceverse.local",
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

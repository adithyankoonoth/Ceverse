import { PrismaClient, UserRole } from "@prisma/client";
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

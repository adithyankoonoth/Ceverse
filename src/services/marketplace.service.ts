import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { buildPaginatedResult } from "@/lib/pagination";
import type { MarketplaceSearchInput } from "@/validation/marketplace";
import { computeCompatibilityScore } from "@/domain/matching";
import type { Role } from "@/lib/rbac";

export async function searchMarketplace(
  input: MarketplaceSearchInput,
  viewer?: { id: string; role: Role; trustScore: number } | null,
) {
  const page = input.page;
  const pageSize = input.pageSize;
  const skip = (page - 1) * pageSize;

  if (input.type === "creators") {
    return searchCreators(input, skip, page, pageSize);
  }
  return searchOperators(input, skip, page, pageSize, viewer);
}

async function searchOperators(
  input: MarketplaceSearchInput,
  skip: number,
  page: number,
  pageSize: number,
  viewer?: { id: string; role: Role; trustScore: number } | null,
) {
  const where: Prisma.OperatorProfileWhereInput = {
    deletedAt: null,
  };

  if (input.country) where.countryCode = input.country.toUpperCase();
  if (input.industry) where.industries = { has: input.industry };
  if (input.category) where.categories = { has: input.category };
  if (input.maxMoq != null) where.moq = { lte: input.maxMoq };
  if (input.minPrice != null || input.maxPrice != null) {
    where.AND = [
      ...(input.minPrice != null
        ? [{ priceRangeMax: { gte: input.minPrice } }]
        : []),
      ...(input.maxPrice != null
        ? [{ priceRangeMin: { lte: input.maxPrice } }]
        : []),
    ];
  }
  if (input.verifiedOnly) where.verificationStatus = "VERIFIED";
  if (input.minTrust != null) {
    where.user = { trustScore: { gte: input.minTrust }, deletedAt: null, isActive: true };
  } else {
    where.user = { deletedAt: null, isActive: true };
  }
  if (input.q) {
    where.OR = [
      { companyName: { contains: input.q, mode: "insensitive" } },
      { bio: { contains: input.q, mode: "insensitive" } },
      { location: { contains: input.q, mode: "insensitive" } },
    ];
  }

  const orderBy: Prisma.OperatorProfileOrderByWithRelationInput[] = [];
  if (input.sortBy === "moq") {
    orderBy.push({ moq: input.sortDir });
  } else if (input.sortBy === "recent") {
    orderBy.push({ createdAt: input.sortDir });
  } else {
    orderBy.push({ user: { trustScore: input.sortDir } });
  }

  const [rows, total] = await Promise.all([
    db.operatorProfile.findMany({
      where,
      orderBy,
      skip,
      take: pageSize,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            image: true,
            role: true,
            trustScore: true,
          },
        },
      },
    }),
    db.operatorProfile.count({ where }),
  ]);

  let viewerCreator: {
    industries: string[];
    preferredCategories: string[];
    countryCode: string | null;
    audienceSize: number;
    engagementRate: number;
    languages: string[];
    verificationStatus: string;
  } | null = null;

  if (viewer?.role === "CREATOR") {
    viewerCreator = await db.creatorProfile.findUnique({
      where: { userId: viewer.id },
      select: {
        industries: true,
        preferredCategories: true,
        countryCode: true,
        audienceSize: true,
        engagementRate: true,
        languages: true,
        verificationStatus: true,
      },
    });
  }

  const items = rows.map((row) => {
    const match = viewerCreator
      ? computeCompatibilityScore({
          creatorIndustries: viewerCreator.industries,
          operatorIndustries: row.industries,
          creatorCategories: viewerCreator.preferredCategories,
          operatorCategories: row.categories,
          creatorCountry: viewerCreator.countryCode,
          operatorCountry: row.countryCode,
          operatorRegionsServed: row.regionsServed,
          creatorTrustScore: viewer?.trustScore,
          operatorTrustScore: row.user.trustScore,
          engagementRate: viewerCreator.engagementRate,
          audienceSize: viewerCreator.audienceSize,
          moq: row.moq,
          successRate: row.successRate,
          creatorVerified: viewerCreator.verificationStatus === "VERIFIED",
          operatorVerified: row.verificationStatus === "VERIFIED",
          creatorLanguages: viewerCreator.languages,
          operatorLanguages: [],
        })
      : null;

    return {
      id: row.userId,
      profileId: row.id,
      kind: "operator" as const,
      name: row.companyName,
      displayName: row.user.name,
      image: row.user.image,
      role: row.user.role,
      trustScore: row.user.trustScore,
      bio: row.bio,
      location: row.location,
      countryCode: row.countryCode,
      industries: row.industries,
      categories: row.categories,
      moq: row.moq,
      successRate: row.successRate,
      averageDeliveryDays: row.averageDeliveryDays,
      verificationStatus: row.verificationStatus,
      certifications: row.certifications,
      hasWarehousing: row.hasWarehousing,
      hasFulfillment: row.hasFulfillment,
      matchScore: match?.score ?? null,
      matchFactors: match?.factors ?? null,
    };
  });

  if (input.sortBy === "trust" && items.some((i) => i.matchScore != null)) {
    items.sort((a, b) => (b.matchScore ?? 0) - (a.matchScore ?? 0));
  }

  return buildPaginatedResult(items, total, { page, pageSize });
}

async function searchCreators(
  input: MarketplaceSearchInput,
  skip: number,
  page: number,
  pageSize: number,
) {
  const where: Prisma.CreatorProfileWhereInput = {
    deletedAt: null,
    user: { deletedAt: null, isActive: true },
  };
  if (input.country) where.countryCode = input.country.toUpperCase();
  if (input.industry) where.industries = { has: input.industry };
  if (input.category) where.preferredCategories = { has: input.category };
  if (input.minAudience != null || input.maxAudience != null) {
    where.audienceSize = {
      ...(input.minAudience != null ? { gte: input.minAudience } : {}),
      ...(input.maxAudience != null ? { lte: input.maxAudience } : {}),
    };
  }
  if (input.verifiedOnly) where.verificationStatus = "VERIFIED";
  if (input.q) {
    where.OR = [
      { displayName: { contains: input.q, mode: "insensitive" } },
      { bio: { contains: input.q, mode: "insensitive" } },
    ];
  }

  const [rows, total] = await Promise.all([
    db.creatorProfile.findMany({
      where,
      orderBy:
        input.sortBy === "audience"
          ? { audienceSize: input.sortDir }
          : input.sortBy === "recent"
            ? { createdAt: input.sortDir }
            : { user: { trustScore: input.sortDir } },
      skip,
      take: pageSize,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            image: true,
            role: true,
            trustScore: true,
          },
        },
      },
    }),
    db.creatorProfile.count({ where }),
  ]);

  const items = rows.map((row) => ({
    id: row.userId,
    profileId: row.id,
    kind: "creator" as const,
    name: row.displayName,
    displayName: row.user.name,
    image: row.user.image,
    role: row.user.role,
    trustScore: row.user.trustScore,
    bio: row.bio,
    location: row.location,
    countryCode: row.countryCode,
    industries: row.industries,
    categories: row.preferredCategories,
    audienceSize: row.audienceSize,
    engagementRate: row.engagementRate,
    verificationStatus: row.verificationStatus,
    matchScore: null as number | null,
    matchFactors: null,
  }));

  return buildPaginatedResult(items, total, { page, pageSize });
}

export async function getMarketplaceProfile(userId: string, viewerId?: string) {
  const user = await db.user.findFirst({
    where: { id: userId, deletedAt: null, isActive: true },
    select: {
      id: true,
      name: true,
      image: true,
      role: true,
      trustScore: true,
      creatorProfile: true,
      operatorProfile: true,
      reviewsReceived: {
        take: 10,
        orderBy: { createdAt: "desc" },
        include: {
          author: { select: { id: true, name: true, image: true } },
        },
      },
    },
  });
  if (!user) return null;

  let bookmarked = false;
  if (viewerId) {
    const bm = await db.bookmark.findFirst({
      where: { userId: viewerId, targetId: userId },
    });
    bookmarked = Boolean(bm);
  }

  return { ...user, bookmarked };
}

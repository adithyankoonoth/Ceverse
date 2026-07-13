import { db } from "@/lib/db";
import { computeCompatibilityScore } from "@/domain/matching";
import { NotFoundError } from "@/domain/errors";

export async function matchOperatorsForCreator(
  creatorUserId: string,
  options?: { limit?: number; productCategory?: string; budget?: number },
) {
  const creator = await db.creatorProfile.findUnique({
    where: { userId: creatorUserId },
    include: { user: { select: { trustScore: true } } },
  });
  if (!creator) throw new NotFoundError("Creator profile");

  const operators = await db.operatorProfile.findMany({
    where: {
      deletedAt: null,
      user: { deletedAt: null, isActive: true },
      ...(options?.productCategory
        ? { categories: { has: options.productCategory } }
        : {}),
      ...(options?.budget != null
        ? { priceRangeMin: { lte: options.budget } }
        : {}),
    },
    take: 100,
    include: {
      user: {
        select: { id: true, name: true, image: true, role: true, trustScore: true },
      },
    },
  });

  const ranked = operators
    .map((op) => {
      const result = computeCompatibilityScore({
        creatorIndustries: creator.industries,
        operatorIndustries: op.industries,
        creatorCategories: creator.preferredCategories,
        operatorCategories: op.categories,
        creatorCountry: creator.countryCode,
        operatorCountry: op.countryCode,
        operatorRegionsServed: op.regionsServed,
        creatorTrustScore: creator.user.trustScore,
        operatorTrustScore: op.user.trustScore,
        engagementRate: creator.engagementRate,
        audienceSize: creator.audienceSize,
        moq: op.moq,
        successRate: op.successRate,
        creatorVerified: creator.verificationStatus === "VERIFIED",
        operatorVerified: op.verificationStatus === "VERIFIED",
        creatorLanguages: creator.languages,
      });
      return {
        operator: {
          userId: op.userId,
          companyName: op.companyName,
          role: op.user.role,
          image: op.user.image,
          trustScore: op.user.trustScore,
          moq: op.moq,
          countryCode: op.countryCode,
          industries: op.industries,
          categories: op.categories,
          verificationStatus: op.verificationStatus,
          successRate: op.successRate,
        },
        ...result,
      };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, options?.limit ?? 10);

  return ranked;
}

export async function scorePair(creatorUserId: string, operatorUserId: string) {
  const [creator, operator] = await Promise.all([
    db.creatorProfile.findUnique({
      where: { userId: creatorUserId },
      include: { user: { select: { trustScore: true } } },
    }),
    db.operatorProfile.findUnique({
      where: { userId: operatorUserId },
      include: { user: { select: { trustScore: true } } },
    }),
  ]);
  if (!creator) throw new NotFoundError("Creator profile");
  if (!operator) throw new NotFoundError("Operator profile");

  return computeCompatibilityScore({
    creatorIndustries: creator.industries,
    operatorIndustries: operator.industries,
    creatorCategories: creator.preferredCategories,
    operatorCategories: operator.categories,
    creatorCountry: creator.countryCode,
    operatorCountry: operator.countryCode,
    operatorRegionsServed: operator.regionsServed,
    creatorTrustScore: creator.user.trustScore,
    operatorTrustScore: operator.user.trustScore,
    engagementRate: creator.engagementRate,
    audienceSize: creator.audienceSize,
    moq: operator.moq,
    successRate: operator.successRate,
    creatorVerified: creator.verificationStatus === "VERIFIED",
    operatorVerified: operator.verificationStatus === "VERIFIED",
    creatorLanguages: creator.languages,
  });
}

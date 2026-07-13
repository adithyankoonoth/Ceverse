import { db } from "@/lib/db";
import { writeAudit } from "@/lib/audit";
import { clamp } from "@/lib/utils";
import { ValidationError } from "@/domain/errors";

export async function submitReview(input: {
  authorId: string;
  subjectId: string;
  dealId?: string;
  rating: number;
  categories?: Record<string, number>;
  comment?: string;
}) {
  if (input.authorId === input.subjectId) {
    throw new ValidationError("Cannot review yourself");
  }
  if (input.rating < 1 || input.rating > 5) {
    throw new ValidationError("Rating must be between 1 and 5");
  }

  const review = await db.review.create({
    data: {
      authorId: input.authorId,
      subjectId: input.subjectId,
      dealId: input.dealId,
      rating: input.rating,
      categories: input.categories ?? {},
      comment: input.comment,
    },
  });

  const delta = (input.rating - 3) * 2;
  await db.reputationEvent.create({
    data: {
      userId: input.subjectId,
      dealId: input.dealId,
      metric: "review",
      delta,
      reason: `Review rating ${input.rating}/5`,
    },
  });

  await recomputeTrustScore(input.subjectId);
  return review;
}

export async function recordReputationEvent(input: {
  userId: string;
  dealId?: string;
  metric: string;
  delta: number;
  reason: string;
}) {
  await db.reputationEvent.create({ data: input });
  return recomputeTrustScore(input.userId);
}

export async function recomputeTrustScore(userId: string) {
  const [user, events, reviews] = await Promise.all([
    db.user.findUniqueOrThrow({ where: { id: userId } }),
    db.reputationEvent.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 200,
    }),
    db.review.findMany({ where: { subjectId: userId } }),
  ]);

  const eventDelta = events.reduce((sum, e) => sum + e.delta, 0);
  const avgRating =
    reviews.length > 0
      ? reviews.reduce((s, r) => s + r.rating, 0) / reviews.length
      : 3;
  // Map avg rating 1-5 → roughly 20-100 contribution baseline
  const reviewBaseline = 20 + ((avgRating - 1) / 4) * 60;
  const score = clamp(Math.round(reviewBaseline + eventDelta * 0.5), 0, 100);

  const updated = await db.user.update({
    where: { id: userId },
    data: { trustScore: score, version: { increment: 1 } },
  });

  await writeAudit({
    actorId: userId,
    action: "reputation.recompute",
    resource: "user",
    resourceId: userId,
    metadata: { score, previous: user.trustScore, reviews: reviews.length },
  });

  return updated;
}

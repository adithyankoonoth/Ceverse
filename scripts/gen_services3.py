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
    "src/services/messaging.service.ts",
    r'''import { db } from "@/lib/db";
import { ForbiddenError, NotFoundError, ValidationError } from "@/domain/errors";
import { assertDealMember } from "@/services/deal.service";
import type { sendMessageSchema } from "@/validation/message";
import type { z } from "zod";
import type { Prisma } from "@prisma/client";

type SendMessageInput = z.infer<typeof sendMessageSchema>;

export async function getOrCreateDirectConversation(userId: string, recipientId: string) {
  if (userId === recipientId) {
    throw new ValidationError("Cannot message yourself");
  }
  const existing = await db.conversation.findFirst({
    where: {
      dealId: null,
      AND: [
        { members: { some: { userId } } },
        { members: { some: { userId: recipientId } } },
      ],
    },
    include: { members: true },
  });
  if (existing && existing.members.length === 2) return existing;

  return db.conversation.create({
    data: {
      members: {
        create: [{ userId }, { userId: recipientId }],
      },
    },
    include: { members: true },
  });
}

export async function sendMessage(userId: string, input: SendMessageInput) {
  let conversationId = input.conversationId;

  if (!conversationId && input.dealId) {
    await assertDealMember(input.dealId, userId);
    const conv = await db.conversation.findUnique({ where: { dealId: input.dealId } });
    if (conv) {
      conversationId = conv.id;
    } else {
      const created = await db.conversation.create({
        data: {
          dealId: input.dealId,
          title: "Deal chat",
          members: { create: [{ userId }] },
        },
      });
      conversationId = created.id;
    }
  }

  if (!conversationId && input.recipientId) {
    const conv = await getOrCreateDirectConversation(userId, input.recipientId);
    conversationId = conv.id;
  }

  if (!conversationId) {
    throw new ValidationError("Unable to resolve conversation");
  }

  const member = await db.conversationMember.findUnique({
    where: {
      conversationId_userId: { conversationId, userId },
    },
  });
  if (!member) {
    // Allow deal members to join conversation on first message
    if (input.dealId) {
      await assertDealMember(input.dealId, userId);
      await db.conversationMember.create({
        data: { conversationId, userId },
      });
    } else {
      throw new ForbiddenError("Not a conversation member");
    }
  }

  const message = await db.message.create({
    data: {
      conversationId,
      dealId: input.dealId,
      senderId: userId,
      body: input.body,
      parentId: input.parentId,
      attachments: input.attachments as Prisma.InputJsonValue,
      readBy: [userId],
    },
    include: {
      sender: { select: { id: true, name: true, image: true } },
    },
  });

  await db.conversation.update({
    where: { id: conversationId },
    data: { updatedAt: new Date() },
  });

  return message;
}

export async function listConversations(userId: string) {
  return db.conversation.findMany({
    where: { members: { some: { userId } } },
    orderBy: { updatedAt: "desc" },
    include: {
      members: {
        include: {
          // conversationMember has userId only — join user separately if needed
        },
      },
      messages: {
        orderBy: { createdAt: "desc" },
        take: 1,
        include: { sender: { select: { id: true, name: true, image: true } } },
      },
    },
    take: 50,
  });
}

export async function listMessages(userId: string, conversationId: string, cursor?: string) {
  const member = await db.conversationMember.findUnique({
    where: { conversationId_userId: { conversationId, userId } },
  });
  if (!member) throw new ForbiddenError("Not a conversation member");

  const messages = await db.message.findMany({
    where: {
      conversationId,
      deletedAt: null,
      ...(cursor ? { createdAt: { lt: new Date(cursor) } } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: 50,
    include: {
      sender: { select: { id: true, name: true, image: true } },
      replies: {
        take: 5,
        include: { sender: { select: { id: true, name: true, image: true } } },
      },
    },
  });

  await db.conversationMember.update({
    where: { conversationId_userId: { conversationId, userId } },
    data: { lastReadAt: new Date() },
  });

  return messages.reverse();
}

export async function pinMessage(userId: string, messageId: string, pinned: boolean) {
  const message = await db.message.findUnique({ where: { id: messageId } });
  if (!message?.conversationId) throw new NotFoundError("Message", messageId);
  const member = await db.conversationMember.findUnique({
    where: {
      conversationId_userId: { conversationId: message.conversationId, userId },
    },
  });
  if (!member) throw new ForbiddenError();
  return db.message.update({
    where: { id: messageId },
    data: { isPinned: pinned },
  });
}
''',
)

w(
    "src/services/reputation.service.ts",
    r'''import { db } from "@/lib/db";
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
''',
)

w(
    "src/services/verification.service.ts",
    r'''import { db } from "@/lib/db";
import { writeAudit } from "@/lib/audit";
import { ConflictError, NotFoundError } from "@/domain/errors";
import type { VerificationType } from "@prisma/client";
import type { Prisma } from "@prisma/client";
import { notifyUser } from "@/services/notification.service";

export async function submitVerification(input: {
  userId: string;
  type: VerificationType;
  documents: Array<{ name: string; storageKey: string; mimeType: string }>;
  notes?: string;
}) {
  const pending = await db.verificationRequest.findFirst({
    where: { userId: input.userId, type: input.type, status: "PENDING" },
  });
  if (pending) throw new ConflictError("A pending request already exists for this type");

  const request = await db.verificationRequest.create({
    data: {
      userId: input.userId,
      type: input.type,
      status: "PENDING",
      documents: input.documents as Prisma.InputJsonValue,
      notes: input.notes,
    },
  });

  await writeAudit({
    actorId: input.userId,
    action: "verification.submit",
    resource: "verification",
    resourceId: request.id,
  });

  return request;
}

export async function reviewVerification(input: {
  requestId: string;
  reviewerId: string;
  decision: "VERIFIED" | "REJECTED";
  rejectionReason?: string;
}) {
  const request = await db.verificationRequest.findUnique({
    where: { id: input.requestId },
  });
  if (!request) throw new NotFoundError("Verification request", input.requestId);
  if (request.status !== "PENDING") {
    throw new ConflictError("Request already reviewed");
  }

  const updated = await db.$transaction(async (tx) => {
    const req = await tx.verificationRequest.update({
      where: { id: input.requestId },
      data: {
        status: input.decision,
        reviewedById: input.reviewerId,
        reviewedAt: new Date(),
        rejectionReason: input.rejectionReason,
      },
    });

    if (input.decision === "VERIFIED") {
      await tx.creatorProfile.updateMany({
        where: { userId: request.userId },
        data: { verificationStatus: "VERIFIED" },
      });
      await tx.operatorProfile.updateMany({
        where: { userId: request.userId },
        data: { verificationStatus: "VERIFIED" },
      });
    }

    return req;
  });

  await notifyUser({
    userId: request.userId,
    type: "verification.reviewed",
    title:
      input.decision === "VERIFIED"
        ? "Verification approved"
        : "Verification rejected",
    body:
      input.decision === "VERIFIED"
        ? `Your ${request.type} verification was approved.`
        : input.rejectionReason ?? "Your verification was rejected.",
    href: "/settings",
    email: true,
  });

  await writeAudit({
    actorId: input.reviewerId,
    action: "verification.review",
    resource: "verification",
    resourceId: input.requestId,
    metadata: { decision: input.decision },
  });

  return updated;
}

export async function listPendingVerifications() {
  return db.verificationRequest.findMany({
    where: { status: "PENDING" },
    orderBy: { createdAt: "asc" },
    include: {
      user: { select: { id: true, name: true, email: true, role: true, image: true } },
    },
  });
}
''',
)

w(
    "src/services/dispute.service.ts",
    r'''import { db } from "@/lib/db";
import { writeAudit } from "@/lib/audit";
import { assertDealMember } from "@/services/deal.service";
import { ConflictError, NotFoundError } from "@/domain/errors";
import type { Prisma } from "@prisma/client";
import { notifyUser } from "@/services/notification.service";

export async function openDispute(input: {
  dealId: string;
  openedById: string;
  reason: string;
  evidence?: Array<{ name: string; storageKey: string }>;
}) {
  await assertDealMember(input.dealId, input.openedById);

  const dispute = await db.$transaction(async (tx) => {
    const d = await tx.dispute.create({
      data: {
        dealId: input.dealId,
        openedById: input.openedById,
        reason: input.reason,
        evidence: (input.evidence ?? []) as Prisma.InputJsonValue,
        status: "OPEN",
      },
    });
    await tx.deal.update({
      where: { id: input.dealId },
      data: { status: "DISPUTED" },
    });
    await tx.activity.create({
      data: {
        dealId: input.dealId,
        actorId: input.openedById,
        type: "dispute.opened",
        summary: "A dispute was opened",
        metadata: { disputeId: d.id },
      },
    });
    return d;
  });

  await writeAudit({
    actorId: input.openedById,
    action: "dispute.open",
    resource: "dispute",
    resourceId: dispute.id,
  });

  return dispute;
}

export async function resolveDispute(input: {
  disputeId: string;
  mediatorId: string;
  resolution: string;
  restoreDeal?: boolean;
}) {
  const dispute = await db.dispute.findUnique({ where: { id: input.disputeId } });
  if (!dispute) throw new NotFoundError("Dispute", input.disputeId);
  if (dispute.status === "RESOLVED" || dispute.status === "CLOSED") {
    throw new ConflictError("Dispute already resolved");
  }

  const updated = await db.$transaction(async (tx) => {
    const d = await tx.dispute.update({
      where: { id: input.disputeId },
      data: {
        status: "RESOLVED",
        resolution: input.resolution,
        mediatorId: input.mediatorId,
        resolvedAt: new Date(),
      },
    });
    if (input.restoreDeal !== false) {
      await tx.deal.update({
        where: { id: dispute.dealId },
        data: { status: "ACTIVE" },
      });
    }
    return d;
  });

  await notifyUser({
    userId: dispute.openedById,
    type: "dispute.resolved",
    title: "Dispute resolved",
    body: input.resolution,
    href: `/deals/${dispute.dealId}`,
  });

  await writeAudit({
    actorId: input.mediatorId,
    action: "dispute.resolve",
    resource: "dispute",
    resourceId: input.disputeId,
  });

  return updated;
}

export async function listDisputes(status?: string) {
  return db.dispute.findMany({
    where: status ? { status: status as "OPEN" } : undefined,
    orderBy: { createdAt: "desc" },
    include: {
      deal: { select: { id: true, title: true } },
      openedBy: { select: { id: true, name: true, email: true } },
    },
    take: 100,
  });
}
''',
)

w(
    "src/services/analytics.service.ts",
    r'''import { db } from "@/lib/db";

export async function getUserDashboardMetrics(userId: string) {
  const [
    deals,
    proposalsInbox,
    proposalsSent,
    unreadNotifications,
    payments,
    activeDisputes,
  ] = await Promise.all([
    db.deal.findMany({
      where: { members: { some: { userId } }, deletedAt: null },
      select: {
        id: true,
        status: true,
        phase: true,
        healthScore: true,
        riskLevel: true,
        escrows: { select: { totalAmount: true, releasedAmount: true, status: true } },
      },
    }),
    db.proposal.count({
      where: { recipientId: userId, status: "SENT", deletedAt: null },
    }),
    db.proposal.count({
      where: { senderId: userId, deletedAt: null },
    }),
    db.notification.count({ where: { userId, readAt: null } }),
    db.payment.findMany({
      where: { escrow: { deal: { members: { some: { userId } } } }, status: "SUCCEEDED" },
      select: { amount: true, type: true, createdAt: true },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
    db.dispute.count({
      where: {
        deal: { members: { some: { userId } } },
        status: { in: ["OPEN", "UNDER_REVIEW", "MEDIATION"] },
      },
    }),
  ]);

  const activeDeals = deals.filter((d) => d.status === "ACTIVE").length;
  const completedDeals = deals.filter((d) => d.status === "COMPLETED").length;
  const volume = deals.reduce((sum, d) => {
    const e = d.escrows[0];
    return sum + (e ? Number(e.totalAmount) : 0);
  }, 0);
  const released = deals.reduce((sum, d) => {
    const e = d.escrows[0];
    return sum + (e ? Number(e.releasedAmount) : 0);
  }, 0);
  const avgHealth =
    deals.filter((d) => d.healthScore != null).length > 0
      ? deals
          .filter((d) => d.healthScore != null)
          .reduce((s, d) => s + (d.healthScore ?? 0), 0) /
        deals.filter((d) => d.healthScore != null).length
      : null;

  return {
    activeDeals,
    completedDeals,
    totalDeals: deals.length,
    proposalsInbox,
    proposalsSent,
    unreadNotifications,
    activeDisputes,
    escrowVolume: volume,
    escrowReleased: released,
    averageHealthScore: avgHealth != null ? Math.round(avgHealth) : null,
    recentPayments: payments.map((p) => ({
      amount: Number(p.amount),
      type: p.type,
      createdAt: p.createdAt,
    })),
    riskBreakdown: {
      low: deals.filter((d) => d.riskLevel === "LOW").length,
      medium: deals.filter((d) => d.riskLevel === "MEDIUM").length,
      high: deals.filter((d) => d.riskLevel === "HIGH").length,
    },
  };
}

export async function getAdminAnalytics() {
  const [users, deals, proposals, disputes, verifications, payments] =
    await Promise.all([
      db.user.count({ where: { deletedAt: null } }),
      db.deal.groupBy({ by: ["status"], _count: true }),
      db.proposal.groupBy({ by: ["status"], _count: true }),
      db.dispute.groupBy({ by: ["status"], _count: true }),
      db.verificationRequest.count({ where: { status: "PENDING" } }),
      db.payment.aggregate({
        where: { status: "SUCCEEDED" },
        _sum: { amount: true },
        _count: true,
      }),
    ]);

  return {
    totalUsers: users,
    dealsByStatus: Object.fromEntries(deals.map((d) => [d.status, d._count])),
    proposalsByStatus: Object.fromEntries(proposals.map((p) => [p.status, p._count])),
    disputesByStatus: Object.fromEntries(disputes.map((d) => [d.status, d._count])),
    pendingVerifications: verifications,
    paymentVolume: Number(payments._sum.amount ?? 0),
    paymentCount: payments._count,
  };
}
''',
)

w(
    "src/services/admin.service.ts",
    r'''import { db } from "@/lib/db";
import { writeAudit } from "@/lib/audit";
import { NotFoundError } from "@/domain/errors";
import type { UserRole } from "@prisma/client";
import { buildPaginatedResult } from "@/lib/pagination";

export async function listUsers(page = 1, pageSize = 20, q?: string) {
  const where = {
    deletedAt: null,
    ...(q
      ? {
          OR: [
            { email: { contains: q, mode: "insensitive" as const } },
            { name: { contains: q, mode: "insensitive" as const } },
          ],
        }
      : {}),
  };
  const [items, total] = await Promise.all([
    db.user.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        trustScore: true,
        isActive: true,
        createdAt: true,
        lastLoginAt: true,
        image: true,
      },
    }),
    db.user.count({ where }),
  ]);
  return buildPaginatedResult(items, total, { page, pageSize });
}

export async function setUserRole(adminId: string, userId: string, role: UserRole) {
  const user = await db.user.update({
    where: { id: userId },
    data: { role, version: { increment: 1 } },
  });
  await writeAudit({
    actorId: adminId,
    action: "admin.set_role",
    resource: "user",
    resourceId: userId,
    metadata: { role },
  });
  return user;
}

export async function setUserActive(adminId: string, userId: string, isActive: boolean) {
  const user = await db.user.update({
    where: { id: userId },
    data: { isActive, version: { increment: 1 } },
  });
  await writeAudit({
    actorId: adminId,
    action: isActive ? "admin.activate_user" : "admin.deactivate_user",
    resource: "user",
    resourceId: userId,
  });
  return user;
}

export async function listFeatureFlags() {
  return db.featureFlag.findMany({ orderBy: { key: "asc" } });
}

export async function upsertFeatureFlag(input: {
  adminId: string;
  key: string;
  enabled: boolean;
  description?: string;
  rolloutPct?: number;
}) {
  const flag = await db.featureFlag.upsert({
    where: { key: input.key },
    create: {
      key: input.key,
      enabled: input.enabled,
      description: input.description,
      rolloutPct: input.rolloutPct ?? 100,
    },
    update: {
      enabled: input.enabled,
      description: input.description,
      rolloutPct: input.rolloutPct,
    },
  });
  await writeAudit({
    actorId: input.adminId,
    action: "admin.feature_flag",
    resource: "feature_flag",
    resourceId: flag.id,
    metadata: { key: input.key, enabled: input.enabled },
  });
  return flag;
}

export async function getSystemHealth() {
  const started = Date.now();
  let database: "ok" | "error" = "ok";
  try {
    await db.$queryRaw`SELECT 1`;
  } catch {
    database = "error";
  }

  return {
    status: database === "ok" ? "healthy" : "degraded",
    database,
    uptimeSeconds: Math.floor(process.uptime()),
    latencyMs: Date.now() - started,
    timestamp: new Date().toISOString(),
  };
}

export async function createAnnouncement(input: {
  adminId: string;
  title: string;
  body: string;
  endsAt?: Date;
}) {
  const announcement = await db.announcement.create({
    data: {
      title: input.title,
      body: input.body,
      endsAt: input.endsAt,
      active: true,
    },
  });
  await writeAudit({
    actorId: input.adminId,
    action: "admin.announcement",
    resource: "announcement",
    resourceId: announcement.id,
  });
  return announcement;
}

export async function getUserOrThrow(userId: string) {
  const user = await db.user.findFirst({ where: { id: userId, deletedAt: null } });
  if (!user) throw new NotFoundError("User", userId);
  return user;
}
''',
)

w(
    "src/services/deal-health.service.ts",
    r'''export { computeDealHealthForDeal } from "@/services/deal.service";
export { computeDealHealth } from "@/domain/deal-health";
''',
)

print("services3 done")

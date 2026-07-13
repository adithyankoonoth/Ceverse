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
    "src/services/deal.service.ts",
    r'''import { db } from "@/lib/db";
import { writeAudit } from "@/lib/audit";
import { ForbiddenError, NotFoundError } from "@/domain/errors";
import { computeDealHealth } from "@/domain/deal-health";
import type {
  createDecisionSchema,
  createMeetingNoteSchema,
  createMilestoneSchema,
  createTaskSchema,
  updateDealSchema,
  updateMilestoneSchema,
} from "@/validation/deal";
import type { z } from "zod";

type UpdateDealInput = z.infer<typeof updateDealSchema>;
type CreateMilestoneInput = z.infer<typeof createMilestoneSchema>;
type UpdateMilestoneInput = z.infer<typeof updateMilestoneSchema>;
type CreateTaskInput = z.infer<typeof createTaskSchema>;
type CreateDecisionInput = z.infer<typeof createDecisionSchema>;
type CreateMeetingInput = z.infer<typeof createMeetingNoteSchema>;

export async function assertDealMember(dealId: string, userId: string) {
  const member = await db.dealMember.findUnique({
    where: { dealId_userId: { dealId, userId } },
  });
  if (!member) throw new ForbiddenError("You are not a member of this deal");
  return member;
}

export async function listDeals(userId: string) {
  return db.deal.findMany({
    where: {
      deletedAt: null,
      members: { some: { userId } },
    },
    orderBy: { updatedAt: "desc" },
    include: {
      members: {
        include: {
          user: { select: { id: true, name: true, image: true, role: true, trustScore: true } },
        },
      },
      milestones: { orderBy: { orderIndex: "asc" } },
      _count: { select: { tasks: true, disputes: true } },
    },
  });
}

export async function getDeal(dealId: string, userId: string) {
  await assertDealMember(dealId, userId);
  const deal = await db.deal.findFirst({
    where: { id: dealId, deletedAt: null },
    include: {
      members: {
        include: {
          user: { select: { id: true, name: true, image: true, role: true, trustScore: true } },
        },
      },
      milestones: { orderBy: { orderIndex: "asc" } },
      tasks: { orderBy: [{ status: "asc" }, { orderIndex: "asc" }] },
      activities: { orderBy: { createdAt: "desc" }, take: 50 },
      decisions: { orderBy: { createdAt: "desc" }, take: 20 },
      meetings: { orderBy: { heldAt: "desc" }, take: 20 },
      contracts: { orderBy: { versionNumber: "desc" } },
      escrows: { include: { payments: true } },
      documents: { where: { deletedAt: null }, orderBy: { createdAt: "desc" }, take: 30 },
      disputes: { orderBy: { createdAt: "desc" } },
      proposal: true,
    },
  });
  if (!deal) throw new NotFoundError("Deal", dealId);

  const health = await computeDealHealthForDeal(dealId);
  if (
    deal.healthScore !== health.score ||
    deal.riskLevel !== health.riskLevel
  ) {
    await db.deal.update({
      where: { id: dealId },
      data: {
        healthScore: health.score,
        riskLevel: health.riskLevel,
        riskRationale: health.rationale,
      },
    });
  }

  return { ...deal, health };
}

export async function updateDeal(dealId: string, userId: string, input: UpdateDealInput) {
  await assertDealMember(dealId, userId);
  const updated = await db.deal.update({
    where: { id: dealId },
    data: {
      ...input,
      version: { increment: 1 },
    },
  });
  await db.activity.create({
    data: {
      dealId,
      actorId: userId,
      type: "deal.updated",
      summary: "Deal details updated",
      metadata: input,
    },
  });
  await writeAudit({
    actorId: userId,
    action: "deal.update",
    resource: "deal",
    resourceId: dealId,
    metadata: input,
  });
  return updated;
}

export async function addMilestone(
  dealId: string,
  userId: string,
  input: CreateMilestoneInput,
) {
  await assertDealMember(dealId, userId);
  const count = await db.milestone.count({ where: { dealId } });
  const milestone = await db.milestone.create({
    data: {
      dealId,
      title: input.title,
      description: input.description,
      amount: input.amount,
      currency: input.currency,
      dueDate: input.dueDate ? new Date(input.dueDate) : null,
      phase: input.phase,
      orderIndex: input.orderIndex ?? count,
    },
  });
  await db.activity.create({
    data: {
      dealId,
      actorId: userId,
      type: "milestone.created",
      summary: `Milestone added: ${milestone.title}`,
      metadata: { milestoneId: milestone.id },
    },
  });
  return milestone;
}

export async function updateMilestone(
  dealId: string,
  milestoneId: string,
  userId: string,
  input: UpdateMilestoneInput,
) {
  await assertDealMember(dealId, userId);
  const existing = await db.milestone.findFirst({ where: { id: milestoneId, dealId } });
  if (!existing) throw new NotFoundError("Milestone", milestoneId);

  const data: Record<string, unknown> = { ...input, version: { increment: 1 } };
  if (input.dueDate === null) data.dueDate = null;
  else if (input.dueDate) data.dueDate = new Date(input.dueDate);
  if (input.status === "APPROVED") data.approvedAt = new Date();
  if (input.status === "PAID") data.paidAt = new Date();

  const milestone = await db.milestone.update({
    where: { id: milestoneId },
    data,
  });
  await db.activity.create({
    data: {
      dealId,
      actorId: userId,
      type: "milestone.updated",
      summary: `Milestone updated: ${milestone.title}`,
      metadata: { milestoneId, ...input },
    },
  });
  return milestone;
}

export async function addTask(dealId: string, userId: string, input: CreateTaskInput) {
  await assertDealMember(dealId, userId);
  const task = await db.task.create({
    data: {
      dealId,
      title: input.title,
      description: input.description,
      milestoneId: input.milestoneId,
      assigneeId: input.assigneeId,
      dueDate: input.dueDate ? new Date(input.dueDate) : null,
    },
  });
  await db.activity.create({
    data: {
      dealId,
      actorId: userId,
      type: "task.created",
      summary: `Task created: ${task.title}`,
      metadata: { taskId: task.id },
    },
  });
  return task;
}

export async function addDecision(dealId: string, userId: string, input: CreateDecisionInput) {
  await assertDealMember(dealId, userId);
  const decision = await db.decisionLog.create({
    data: {
      dealId,
      actorId: userId,
      title: input.title,
      rationale: input.rationale,
    },
  });
  await db.activity.create({
    data: {
      dealId,
      actorId: userId,
      type: "decision.logged",
      summary: `Decision: ${decision.title}`,
      metadata: { decisionId: decision.id },
    },
  });
  return decision;
}

export async function addMeetingNote(
  dealId: string,
  userId: string,
  input: CreateMeetingInput,
) {
  await assertDealMember(dealId, userId);
  return db.meetingNote.create({
    data: {
      dealId,
      authorId: userId,
      title: input.title,
      body: input.body,
      heldAt: new Date(input.heldAt),
    },
  });
}

export async function computeDealHealthForDeal(dealId: string) {
  const deal = await db.deal.findUniqueOrThrow({
    where: { id: dealId },
    include: {
      milestones: true,
      tasks: true,
      disputes: { where: { status: { in: ["OPEN", "UNDER_REVIEW", "MEDIATION"] } } },
      activities: { orderBy: { createdAt: "desc" }, take: 1 },
      escrows: true,
      contracts: { where: { status: "ACTIVE" } },
      members: { include: { user: { select: { trustScore: true } } } },
    },
  });

  const now = Date.now();
  const milestones = deal.milestones;
  const doneStatuses = new Set(["APPROVED", "PAID", "SKIPPED"]);
  const completed = milestones.filter((m) => doneStatuses.has(m.status)).length;
  const completion = milestones.length ? completed / milestones.length : 0;
  const overdueMilestones = milestones.filter(
    (m) => m.dueDate && m.dueDate.getTime() < now && !doneStatuses.has(m.status),
  ).length;
  const overdueTasks = deal.tasks.filter(
    (t) => t.dueDate && t.dueDate.getTime() < now && t.status !== "DONE" && t.status !== "CANCELLED",
  ).length;
  const lastActivity = deal.activities[0]?.createdAt ?? deal.updatedAt;
  const daysSinceLastActivity = Math.floor(
    (now - lastActivity.getTime()) / (1000 * 60 * 60 * 24),
  );
  const escrow = deal.escrows[0];
  const total = escrow ? Number(escrow.totalAmount) : 0;
  const released = escrow ? Number(escrow.releasedAmount) : 0;

  const nextOpen = milestones
    .filter((m) => !doneStatuses.has(m.status) && m.dueDate)
    .sort((a, b) => (a.dueDate!.getTime() - b.dueDate!.getTime()))[0];

  return computeDealHealth({
    status: deal.status,
    phase: deal.phase,
    milestoneCompletion: completion,
    overdueMilestones,
    overdueTasks,
    openDisputes: deal.disputes.length,
    daysSinceLastActivity,
    escrowReleaseRatio: total > 0 ? released / total : undefined,
    escrowStatus: escrow?.status,
    memberTrustScores: deal.members.map((m) => m.user.trustScore),
    hasActiveContract: deal.contracts.length > 0,
    daysToNextMilestone: nextOpen?.dueDate
      ? Math.floor((nextOpen.dueDate.getTime() - now) / (1000 * 60 * 60 * 24))
      : null,
  });
}
''',
)

w(
    "src/services/notification.service.ts",
    r'''import { db } from "@/lib/db";
import { sendEmail } from "@/lib/email";
import { logger } from "@/lib/logger";

export async function notifyUser(input: {
  userId: string;
  type: string;
  title: string;
  body: string;
  href?: string;
  email?: boolean;
}) {
  const notification = await db.notification.create({
    data: {
      userId: input.userId,
      type: input.type,
      title: input.title,
      body: input.body,
      href: input.href,
      channel: "IN_APP",
    },
  });

  if (input.email) {
    const user = await db.user.findUnique({ where: { id: input.userId } });
    if (user?.email) {
      try {
        await sendEmail({
          to: user.email,
          subject: input.title,
          html: `<p>${escapeHtml(input.body)}</p>${
            input.href
              ? `<p><a href="${process.env.NEXT_PUBLIC_APP_URL}${input.href}">Open in Ceverse</a></p>`
              : ""
          }`,
          text: input.body,
        });
      } catch (err) {
        logger.warn("notification_email_failed", {
          userId: input.userId,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }
  }

  return notification;
}

export async function listNotifications(userId: string, unreadOnly = false) {
  return db.notification.findMany({
    where: {
      userId,
      ...(unreadOnly ? { readAt: null } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
}

export async function markNotificationsRead(userId: string, ids?: string[]) {
  return db.notification.updateMany({
    where: {
      userId,
      readAt: null,
      ...(ids?.length ? { id: { in: ids } } : {}),
    },
    data: { readAt: new Date() },
  });
}

function escapeHtml(s: string): string {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
''',
)

w(
    "src/services/contract.service.ts",
    r'''import { db } from "@/lib/db";
import { writeAudit } from "@/lib/audit";
import { ConflictError, ForbiddenError, NotFoundError } from "@/domain/errors";
import { assertDealMember } from "@/services/deal.service";
import type { createContractSchema, signContractSchema } from "@/validation/contract";
import type { z } from "zod";
import type { Prisma } from "@prisma/client";

type CreateContractInput = z.infer<typeof createContractSchema>;
type SignInput = z.infer<typeof signContractSchema>;

const REQUIRED_CLAUSES = [
  "paymentTerms",
  "terminationClause",
  "disputeClause",
  "trademarkOwnership",
] as const;

export function analyzeContractCompleteness(content: Record<string, unknown>) {
  const missing = REQUIRED_CLAUSES.filter((key) => {
    const value = content[key];
    return value == null || value === "";
  });
  const score = Math.round(
    ((REQUIRED_CLAUSES.length - missing.length) / REQUIRED_CLAUSES.length) * 100,
  );
  return { missing, score, complete: missing.length === 0 };
}

export async function createContract(userId: string, input: CreateContractInput) {
  await assertDealMember(input.dealId, userId);
  const completeness = analyzeContractCompleteness(input.content as Record<string, unknown>);

  const contract = await db.contract.create({
    data: {
      dealId: input.dealId,
      title: input.title,
      status: "DRAFT",
      content: input.content as Prisma.InputJsonValue,
      signatures: {
        create: {
          userId,
        },
      },
    },
    include: { signatures: true },
  });

  await db.activity.create({
    data: {
      dealId: input.dealId,
      actorId: userId,
      type: "contract.created",
      summary: `Contract drafted: ${contract.title}`,
      metadata: { contractId: contract.id, completeness },
    },
  });

  await writeAudit({
    actorId: userId,
    action: "contract.create",
    resource: "contract",
    resourceId: contract.id,
  });

  return { contract, completeness };
}

export async function versionContract(
  userId: string,
  contractId: string,
  content: CreateContractInput["content"],
  title?: string,
) {
  const existing = await db.contract.findUnique({ where: { id: contractId } });
  if (!existing) throw new NotFoundError("Contract", contractId);
  await assertDealMember(existing.dealId, userId);
  if (existing.status === "ACTIVE") {
    throw new ConflictError("Active contracts must be terminated before superseding");
  }

  const next = await db.$transaction(async (tx) => {
    await tx.contract.update({
      where: { id: contractId },
      data: { status: "SUPERSEDED" },
    });
    return tx.contract.create({
      data: {
        dealId: existing.dealId,
        title: title ?? existing.title,
        status: "DRAFT",
        content: content as Prisma.InputJsonValue,
        versionNumber: existing.versionNumber + 1,
        parentId: existing.id,
      },
    });
  });

  return next;
}

export async function requestSignatures(userId: string, contractId: string) {
  const contract = await db.contract.findUnique({
    where: { id: contractId },
    include: { deal: { include: { members: true } } },
  });
  if (!contract) throw new NotFoundError("Contract", contractId);
  await assertDealMember(contract.dealId, userId);

  for (const member of contract.deal.members) {
    await db.signature.upsert({
      where: {
        contractId_userId: { contractId, userId: member.userId },
      },
      create: { contractId, userId: member.userId },
      update: {},
    });
  }

  return db.contract.update({
    where: { id: contractId },
    data: { status: "PENDING_SIGNATURE" },
    include: { signatures: true },
  });
}

export async function signContract(
  userId: string,
  contractId: string,
  input: SignInput,
  meta?: { ip?: string; userAgent?: string },
) {
  const contract = await db.contract.findUnique({
    where: { id: contractId },
    include: { signatures: true, deal: { include: { members: true } } },
  });
  if (!contract) throw new NotFoundError("Contract", contractId);
  await assertDealMember(contract.dealId, userId);
  if (contract.status !== "PENDING_SIGNATURE" && contract.status !== "IN_REVIEW") {
    throw new ConflictError("Contract is not awaiting signatures");
  }

  await db.signature.upsert({
    where: { contractId_userId: { contractId, userId } },
    create: {
      contractId,
      userId,
      signedAt: new Date(),
      signatureData: input.signatureData,
      ipAddress: meta?.ip,
      userAgent: meta?.userAgent,
    },
    update: {
      signedAt: new Date(),
      signatureData: input.signatureData,
      ipAddress: meta?.ip,
      userAgent: meta?.userAgent,
    },
  });

  const signatures = await db.signature.findMany({ where: { contractId } });
  const memberIds = new Set(contract.deal.members.map((m) => m.userId));
  const allSigned = [...memberIds].every((id) =>
    signatures.some((s) => s.userId === id && s.signedAt),
  );

  const updated = await db.contract.update({
    where: { id: contractId },
    data: allSigned
      ? { status: "ACTIVE", activatedAt: new Date() }
      : { status: "PENDING_SIGNATURE" },
    include: { signatures: true },
  });

  await writeAudit({
    actorId: userId,
    action: "contract.sign",
    resource: "contract",
    resourceId: contractId,
    metadata: { activated: allSigned },
  });

  return updated;
}

export async function listContractsForUser(userId: string) {
  return db.contract.findMany({
    where: {
      deal: { members: { some: { userId } }, deletedAt: null },
    },
    orderBy: { updatedAt: "desc" },
    include: {
      deal: { select: { id: true, title: true } },
      signatures: true,
    },
    take: 50,
  });
}
''',
)

w(
    "src/services/matching.service.ts",
    r'''import { db } from "@/lib/db";
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
''',
)

w(
    "src/services/payment.service.ts",
    r'''import { db } from "@/lib/db";
import { writeAudit } from "@/lib/audit";
import { getStripe } from "@/lib/stripe";
import { assertDealMember } from "@/services/deal.service";
import { ConflictError, NotFoundError, ValidationError } from "@/domain/errors";
import { assertPermission, type Role } from "@/lib/rbac";

export async function createEscrow(
  userId: string,
  role: Role,
  dealId: string,
  totalAmount: number,
  currency = "USD",
) {
  assertPermission(role, "escrow:fund");
  await assertDealMember(dealId, userId);
  if (totalAmount <= 0) throw new ValidationError("Escrow amount must be positive");

  const existing = await db.escrow.findFirst({
    where: { dealId, status: { in: ["PENDING", "FUNDED", "PARTIALLY_RELEASED"] } },
  });
  if (existing) throw new ConflictError("An active escrow already exists for this deal");

  const escrow = await db.escrow.create({
    data: {
      dealId,
      totalAmount,
      currency,
      status: "PENDING",
    },
  });

  await db.activity.create({
    data: {
      dealId,
      actorId: userId,
      type: "escrow.created",
      summary: `Escrow created for ${totalAmount} ${currency}`,
      metadata: { escrowId: escrow.id },
    },
  });

  return escrow;
}

export async function fundEscrow(userId: string, role: Role, escrowId: string) {
  assertPermission(role, "escrow:fund");
  const escrow = await db.escrow.findUnique({ where: { id: escrowId } });
  if (!escrow) throw new NotFoundError("Escrow", escrowId);
  await assertDealMember(escrow.dealId, userId);
  if (escrow.status !== "PENDING") throw new ConflictError("Escrow is not pending funding");

  const stripe = getStripe();
  let stripePaymentIntentId: string | null = null;

  if (stripe) {
    const intent = await stripe.paymentIntents.create({
      amount: Math.round(Number(escrow.totalAmount) * 100),
      currency: escrow.currency.toLowerCase(),
      metadata: { escrowId: escrow.id, dealId: escrow.dealId },
      automatic_payment_methods: { enabled: true },
    });
    stripePaymentIntentId = intent.id;
  }

  const funded = await db.$transaction(async (tx) => {
    const payment = await tx.payment.create({
      data: {
        escrowId,
        amount: escrow.totalAmount,
        currency: escrow.currency,
        status: stripe ? "PROCESSING" : "SUCCEEDED",
        type: "escrow_fund",
        stripeId: stripePaymentIntentId,
      },
    });
    const updated = await tx.escrow.update({
      where: { id: escrowId },
      data: {
        status: stripe ? "PENDING" : "FUNDED",
        stripePaymentIntentId,
      },
    });
    return { escrow: updated, payment };
  });

  // Local/dev without Stripe: mark funded immediately
  if (!stripe) {
    await db.escrow.update({
      where: { id: escrowId },
      data: { status: "FUNDED" },
    });
  }

  await writeAudit({
    actorId: userId,
    action: "escrow.fund",
    resource: "escrow",
    resourceId: escrowId,
  });

  return funded;
}

export async function releaseMilestonePayment(
  userId: string,
  role: Role,
  milestoneId: string,
) {
  assertPermission(role, "escrow:release");
  const milestone = await db.milestone.findUnique({ where: { id: milestoneId } });
  if (!milestone) throw new NotFoundError("Milestone", milestoneId);
  await assertDealMember(milestone.dealId, userId);
  if (milestone.status !== "APPROVED") {
    throw new ConflictError("Milestone must be approved before release");
  }
  if (!milestone.amount) throw new ValidationError("Milestone has no amount");

  const escrow = await db.escrow.findFirst({
    where: { dealId: milestone.dealId, status: { in: ["FUNDED", "PARTIALLY_RELEASED"] } },
  });
  if (!escrow) throw new NotFoundError("Funded escrow");

  const remaining = Number(escrow.totalAmount) - Number(escrow.releasedAmount);
  const amount = Number(milestone.amount);
  if (amount > remaining) {
    throw new ValidationError("Release amount exceeds remaining escrow balance");
  }

  const result = await db.$transaction(async (tx) => {
    const payment = await tx.payment.create({
      data: {
        escrowId: escrow.id,
        amount,
        currency: milestone.currency,
        status: "SUCCEEDED",
        type: "milestone_release",
        metadata: { milestoneId },
      },
    });
    const newReleased = Number(escrow.releasedAmount) + amount;
    const fullyReleased = newReleased >= Number(escrow.totalAmount);
    const updatedEscrow = await tx.escrow.update({
      where: { id: escrow.id },
      data: {
        releasedAmount: newReleased,
        status: fullyReleased ? "RELEASED" : "PARTIALLY_RELEASED",
      },
    });
    await tx.milestone.update({
      where: { id: milestoneId },
      data: { status: "PAID", paidAt: new Date() },
    });
    return { payment, escrow: updatedEscrow };
  });

  await db.activity.create({
    data: {
      dealId: milestone.dealId,
      actorId: userId,
      type: "payment.released",
      summary: `Released ${amount} ${milestone.currency} for ${milestone.title}`,
      metadata: { milestoneId, paymentId: result.payment.id },
    },
  });

  await writeAudit({
    actorId: userId,
    action: "escrow.release",
    resource: "milestone",
    resourceId: milestoneId,
    metadata: { amount },
  });

  return result;
}

export async function listPaymentsForUser(userId: string) {
  return db.payment.findMany({
    where: {
      escrow: { deal: { members: { some: { userId } } } },
    },
    orderBy: { createdAt: "desc" },
    include: {
      escrow: {
        include: { deal: { select: { id: true, title: true } } },
      },
    },
    take: 100,
  });
}
''',
)

print("services2 done")

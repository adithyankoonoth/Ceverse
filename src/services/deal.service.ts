import { db } from "@/lib/db";
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

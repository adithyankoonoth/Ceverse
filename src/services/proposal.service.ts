import { db } from "@/lib/db";
import { writeAudit } from "@/lib/audit";
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from "@/domain/errors";
import type { CreateProposalInput, CounterProposalInput } from "@/validation/proposal";
import { notifyUser } from "@/services/notification.service";
import type { Prisma } from "@prisma/client";

export async function createProposal(
  actorId: string,
  input: CreateProposalInput,
  meta?: { requestId?: string; ip?: string },
) {
  if (input.recipientId === actorId) {
    throw new ValidationError("Cannot send a proposal to yourself");
  }
  const recipient = await db.user.findFirst({
    where: { id: input.recipientId, deletedAt: null, isActive: true },
  });
  if (!recipient) throw new NotFoundError("Recipient");

  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + input.expiresInDays);

  const proposal = await db.proposal.create({
    data: {
      senderId: actorId,
      recipientId: input.recipientId,
      title: input.title,
      summary: input.summary,
      status: "DRAFT",
      terms: input.terms as Prisma.InputJsonValue,
      budgetMin: input.budgetMin,
      budgetMax: input.budgetMax,
      currency: input.currency,
      timelineDays: input.timelineDays,
      expiresAt,
    },
  });

  await writeAudit({
    actorId,
    action: "proposal.create",
    resource: "proposal",
    resourceId: proposal.id,
    requestId: meta?.requestId,
    ipAddress: meta?.ip,
  });

  return proposal;
}

export async function sendProposal(actorId: string, proposalId: string) {
  const proposal = await getOwnedProposal(actorId, proposalId, "sender");
  if (proposal.status !== "DRAFT" && proposal.status !== "COUNTERED") {
    throw new ConflictError("Only draft or countered proposals can be sent");
  }
  const updated = await db.proposal.update({
    where: { id: proposalId },
    data: { status: "SENT" },
  });
  await notifyUser({
    userId: proposal.recipientId,
    type: "proposal.received",
    title: "New proposal received",
    body: proposal.title,
    href: `/proposals?id=${proposalId}`,
  });
  await writeAudit({
    actorId,
    action: "proposal.send",
    resource: "proposal",
    resourceId: proposalId,
  });
  return updated;
}

export async function counterProposal(
  actorId: string,
  proposalId: string,
  input: CounterProposalInput,
) {
  const original = await getOwnedProposal(actorId, proposalId, "recipient");
  if (original.status !== "SENT" && original.status !== "COUNTERED") {
    throw new ConflictError("Proposal is not open for counter-offers");
  }

  const counter = await db.$transaction(async (tx) => {
    await tx.proposal.update({
      where: { id: proposalId },
      data: { status: "COUNTERED" },
    });
    return tx.proposal.create({
      data: {
        senderId: actorId,
        recipientId: original.senderId,
        title: input.title ?? original.title,
        summary: input.summary ?? original.summary,
        status: "SENT",
        terms: (input.terms ?? original.terms) as Prisma.InputJsonValue,
        budgetMin: input.budgetMin ?? original.budgetMin,
        budgetMax: input.budgetMax ?? original.budgetMax,
        currency: original.currency,
        timelineDays: input.timelineDays ?? original.timelineDays,
        parentId: proposalId,
        revisionNumber: original.revisionNumber + 1,
        expiresAt: original.expiresAt,
      },
    });
  });

  await notifyUser({
    userId: original.senderId,
    type: "proposal.countered",
    title: "Proposal counter-offer",
    body: counter.title,
    href: `/proposals?id=${counter.id}`,
  });

  return counter;
}

export async function acceptProposal(actorId: string, proposalId: string) {
  const proposal = await getOwnedProposal(actorId, proposalId, "recipient");
  if (proposal.status !== "SENT" && proposal.status !== "COUNTERED") {
    throw new ConflictError("Proposal cannot be accepted in its current state");
  }

  const result = await db.$transaction(async (tx) => {
    const deal = await tx.deal.create({
      data: {
        title: proposal.title,
        description: proposal.summary,
        status: "ACTIVE",
        phase: "IDEA",
        members: {
          create: [
            { userId: proposal.senderId, role: "owner" },
            { userId: proposal.recipientId, role: "partner" },
          ],
        },
        activities: {
          create: {
            actorId,
            type: "deal.created",
            summary: "Deal created from accepted proposal",
            metadata: { proposalId },
          },
        },
        milestones: {
          create: defaultMilestones(),
        },
      },
    });

    const accepted = await tx.proposal.update({
      where: { id: proposalId },
      data: {
        status: "ACCEPTED",
        acceptedAt: new Date(),
        dealId: deal.id,
      },
    });

    await tx.conversation.create({
      data: {
        dealId: deal.id,
        title: deal.title,
        members: {
          create: [
            { userId: proposal.senderId },
            { userId: proposal.recipientId },
          ],
        },
      },
    });

    return { deal, proposal: accepted };
  });

  await notifyUser({
    userId: proposal.senderId,
    type: "proposal.accepted",
    title: "Proposal accepted",
    body: `${proposal.title} is now an active deal`,
    href: `/deals/${result.deal.id}`,
  });

  await writeAudit({
    actorId,
    action: "proposal.accept",
    resource: "proposal",
    resourceId: proposalId,
    metadata: { dealId: result.deal.id },
  });

  return result;
}

export async function rejectProposal(actorId: string, proposalId: string) {
  const proposal = await getOwnedProposal(actorId, proposalId, "recipient");
  if (proposal.status !== "SENT" && proposal.status !== "COUNTERED") {
    throw new ConflictError("Proposal cannot be rejected in its current state");
  }
  const updated = await db.proposal.update({
    where: { id: proposalId },
    data: { status: "REJECTED" },
  });
  await notifyUser({
    userId: proposal.senderId,
    type: "proposal.rejected",
    title: "Proposal declined",
    body: proposal.title,
    href: `/proposals?id=${proposalId}`,
  });
  return updated;
}

export async function withdrawProposal(actorId: string, proposalId: string) {
  const proposal = await getOwnedProposal(actorId, proposalId, "sender");
  if (proposal.status === "ACCEPTED") {
    throw new ConflictError("Accepted proposals cannot be withdrawn");
  }
  return db.proposal.update({
    where: { id: proposalId },
    data: { status: "WITHDRAWN" },
  });
}

export async function listProposals(userId: string, folder: "inbox" | "sent" | "all" = "all") {
  const where =
    folder === "inbox"
      ? { recipientId: userId, deletedAt: null }
      : folder === "sent"
        ? { senderId: userId, deletedAt: null }
        : {
            OR: [{ senderId: userId }, { recipientId: userId }],
            deletedAt: null,
          };

  return db.proposal.findMany({
    where,
    orderBy: { updatedAt: "desc" },
    include: {
      sender: { select: { id: true, name: true, image: true, role: true } },
      recipient: { select: { id: true, name: true, image: true, role: true } },
    },
    take: 100,
  });
}

export async function getProposal(userId: string, proposalId: string) {
  const proposal = await db.proposal.findFirst({
    where: {
      id: proposalId,
      deletedAt: null,
      OR: [{ senderId: userId }, { recipientId: userId }],
    },
    include: {
      sender: { select: { id: true, name: true, image: true, role: true, trustScore: true } },
      recipient: { select: { id: true, name: true, image: true, role: true, trustScore: true } },
      revisions: { orderBy: { revisionNumber: "asc" } },
      parent: true,
    },
  });
  if (!proposal) throw new NotFoundError("Proposal", proposalId);
  return proposal;
}

async function getOwnedProposal(
  actorId: string,
  proposalId: string,
  side: "sender" | "recipient",
) {
  const proposal = await db.proposal.findFirst({
    where: { id: proposalId, deletedAt: null },
  });
  if (!proposal) throw new NotFoundError("Proposal", proposalId);
  if (side === "sender" && proposal.senderId !== actorId) {
    throw new ForbiddenError("Only the sender can perform this action");
  }
  if (side === "recipient" && proposal.recipientId !== actorId) {
    throw new ForbiddenError("Only the recipient can perform this action");
  }
  return proposal;
}

function defaultMilestones() {
  const phases = [
    "IDEA",
    "RESEARCH",
    "PROTOTYPE",
    "SAMPLE",
    "PACKAGING",
    "MANUFACTURING",
    "QA",
    "SHIPPING",
    "LAUNCH",
  ] as const;
  return phases.map((phase, index) => ({
    title: phase.replaceAll("_", " ").toLowerCase().replace(/^\w/, (c) => c.toUpperCase()),
    phase,
    orderIndex: index,
    status: index === 0 ? ("IN_PROGRESS" as const) : ("PENDING" as const),
  }));
}

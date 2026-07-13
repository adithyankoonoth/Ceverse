import { db } from "@/lib/db";
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

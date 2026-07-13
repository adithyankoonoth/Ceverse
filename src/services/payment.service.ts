import { db } from "@/lib/db";
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

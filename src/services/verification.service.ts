import { db } from "@/lib/db";
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

import { db } from "@/lib/db";
import { writeAudit } from "@/lib/audit";
import { ConflictError, NotFoundError } from "@/domain/errors";
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

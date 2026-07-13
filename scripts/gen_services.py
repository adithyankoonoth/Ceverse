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
    "src/services/marketplace.service.ts",
    r'''import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { buildPaginatedResult } from "@/lib/pagination";
import type { MarketplaceSearchInput } from "@/validation/marketplace";
import { computeCompatibilityScore } from "@/domain/matching";
import type { Role } from "@/lib/rbac";

export async function searchMarketplace(
  input: MarketplaceSearchInput,
  viewer?: { id: string; role: Role; trustScore: number } | null,
) {
  const page = input.page;
  const pageSize = input.pageSize;
  const skip = (page - 1) * pageSize;

  if (input.type === "creators") {
    return searchCreators(input, skip, page, pageSize);
  }
  return searchOperators(input, skip, page, pageSize, viewer);
}

async function searchOperators(
  input: MarketplaceSearchInput,
  skip: number,
  page: number,
  pageSize: number,
  viewer?: { id: string; role: Role; trustScore: number } | null,
) {
  const where: Prisma.OperatorProfileWhereInput = {
    deletedAt: null,
  };

  if (input.country) where.countryCode = input.country.toUpperCase();
  if (input.industry) where.industries = { has: input.industry };
  if (input.category) where.categories = { has: input.category };
  if (input.maxMoq != null) where.moq = { lte: input.maxMoq };
  if (input.minPrice != null || input.maxPrice != null) {
    where.AND = [
      ...(input.minPrice != null
        ? [{ priceRangeMax: { gte: input.minPrice } }]
        : []),
      ...(input.maxPrice != null
        ? [{ priceRangeMin: { lte: input.maxPrice } }]
        : []),
    ];
  }
  if (input.verifiedOnly) where.verificationStatus = "VERIFIED";
  if (input.minTrust != null) {
    where.user = { trustScore: { gte: input.minTrust }, deletedAt: null, isActive: true };
  } else {
    where.user = { deletedAt: null, isActive: true };
  }
  if (input.q) {
    where.OR = [
      { companyName: { contains: input.q, mode: "insensitive" } },
      { bio: { contains: input.q, mode: "insensitive" } },
      { location: { contains: input.q, mode: "insensitive" } },
    ];
  }

  const orderBy: Prisma.OperatorProfileOrderByWithRelationInput[] = [];
  if (input.sortBy === "moq") {
    orderBy.push({ moq: input.sortDir });
  } else if (input.sortBy === "recent") {
    orderBy.push({ createdAt: input.sortDir });
  } else {
    orderBy.push({ user: { trustScore: input.sortDir } });
  }

  const [rows, total] = await Promise.all([
    db.operatorProfile.findMany({
      where,
      orderBy,
      skip,
      take: pageSize,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            image: true,
            role: true,
            trustScore: true,
          },
        },
      },
    }),
    db.operatorProfile.count({ where }),
  ]);

  let viewerCreator: {
    industries: string[];
    preferredCategories: string[];
    countryCode: string | null;
    audienceSize: number;
    engagementRate: number;
    languages: string[];
    verificationStatus: string;
  } | null = null;

  if (viewer?.role === "CREATOR") {
    viewerCreator = await db.creatorProfile.findUnique({
      where: { userId: viewer.id },
      select: {
        industries: true,
        preferredCategories: true,
        countryCode: true,
        audienceSize: true,
        engagementRate: true,
        languages: true,
        verificationStatus: true,
      },
    });
  }

  const items = rows.map((row) => {
    const match = viewerCreator
      ? computeCompatibilityScore({
          creatorIndustries: viewerCreator.industries,
          operatorIndustries: row.industries,
          creatorCategories: viewerCreator.preferredCategories,
          operatorCategories: row.categories,
          creatorCountry: viewerCreator.countryCode,
          operatorCountry: row.countryCode,
          operatorRegionsServed: row.regionsServed,
          creatorTrustScore: viewer?.trustScore,
          operatorTrustScore: row.user.trustScore,
          engagementRate: viewerCreator.engagementRate,
          audienceSize: viewerCreator.audienceSize,
          moq: row.moq,
          successRate: row.successRate,
          creatorVerified: viewerCreator.verificationStatus === "VERIFIED",
          operatorVerified: row.verificationStatus === "VERIFIED",
          creatorLanguages: viewerCreator.languages,
          operatorLanguages: [],
        })
      : null;

    return {
      id: row.userId,
      profileId: row.id,
      kind: "operator" as const,
      name: row.companyName,
      displayName: row.user.name,
      image: row.user.image,
      role: row.user.role,
      trustScore: row.user.trustScore,
      bio: row.bio,
      location: row.location,
      countryCode: row.countryCode,
      industries: row.industries,
      categories: row.categories,
      moq: row.moq,
      successRate: row.successRate,
      averageDeliveryDays: row.averageDeliveryDays,
      verificationStatus: row.verificationStatus,
      certifications: row.certifications,
      hasWarehousing: row.hasWarehousing,
      hasFulfillment: row.hasFulfillment,
      matchScore: match?.score ?? null,
      matchFactors: match?.factors ?? null,
    };
  });

  if (input.sortBy === "trust" && items.some((i) => i.matchScore != null)) {
    items.sort((a, b) => (b.matchScore ?? 0) - (a.matchScore ?? 0));
  }

  return buildPaginatedResult(items, total, { page, pageSize });
}

async function searchCreators(
  input: MarketplaceSearchInput,
  skip: number,
  page: number,
  pageSize: number,
) {
  const where: Prisma.CreatorProfileWhereInput = {
    deletedAt: null,
    user: { deletedAt: null, isActive: true },
  };
  if (input.country) where.countryCode = input.country.toUpperCase();
  if (input.industry) where.industries = { has: input.industry };
  if (input.category) where.preferredCategories = { has: input.category };
  if (input.minAudience != null || input.maxAudience != null) {
    where.audienceSize = {
      ...(input.minAudience != null ? { gte: input.minAudience } : {}),
      ...(input.maxAudience != null ? { lte: input.maxAudience } : {}),
    };
  }
  if (input.verifiedOnly) where.verificationStatus = "VERIFIED";
  if (input.q) {
    where.OR = [
      { displayName: { contains: input.q, mode: "insensitive" } },
      { bio: { contains: input.q, mode: "insensitive" } },
    ];
  }

  const [rows, total] = await Promise.all([
    db.creatorProfile.findMany({
      where,
      orderBy:
        input.sortBy === "audience"
          ? { audienceSize: input.sortDir }
          : input.sortBy === "recent"
            ? { createdAt: input.sortDir }
            : { user: { trustScore: input.sortDir } },
      skip,
      take: pageSize,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            image: true,
            role: true,
            trustScore: true,
          },
        },
      },
    }),
    db.creatorProfile.count({ where }),
  ]);

  const items = rows.map((row) => ({
    id: row.userId,
    profileId: row.id,
    kind: "creator" as const,
    name: row.displayName,
    displayName: row.user.name,
    image: row.user.image,
    role: row.user.role,
    trustScore: row.user.trustScore,
    bio: row.bio,
    location: row.location,
    countryCode: row.countryCode,
    industries: row.industries,
    categories: row.preferredCategories,
    audienceSize: row.audienceSize,
    engagementRate: row.engagementRate,
    verificationStatus: row.verificationStatus,
    matchScore: null as number | null,
    matchFactors: null,
  }));

  return buildPaginatedResult(items, total, { page, pageSize });
}

export async function getMarketplaceProfile(userId: string, viewerId?: string) {
  const user = await db.user.findFirst({
    where: { id: userId, deletedAt: null, isActive: true },
    select: {
      id: true,
      name: true,
      image: true,
      role: true,
      trustScore: true,
      creatorProfile: true,
      operatorProfile: true,
      reviewsReceived: {
        take: 10,
        orderBy: { createdAt: "desc" },
        include: {
          author: { select: { id: true, name: true, image: true } },
        },
      },
    },
  });
  if (!user) return null;

  let bookmarked = false;
  if (viewerId) {
    const bm = await db.bookmark.findFirst({
      where: { userId: viewerId, targetId: userId },
    });
    bookmarked = Boolean(bm);
  }

  return { ...user, bookmarked };
}
''',
)

w(
    "src/services/proposal.service.ts",
    r'''import { db } from "@/lib/db";
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
''',
)

print("services part 1 done")

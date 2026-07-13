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
    "src/validation/auth.ts",
    """import { z } from "zod";
import { OPERATOR_ROLES } from "@/domain/roles";

const signupRoles = ["CREATOR", ...OPERATOR_ROLES] as const;

export const signInSchema = z.object({
  email: z.string().email().max(255).transform((v) => v.toLowerCase().trim()),
  password: z.string().min(12).max(128),
});

export const signUpSchema = z.object({
  name: z.string().min(2).max(120).trim(),
  email: z.string().email().max(255).transform((v) => v.toLowerCase().trim()),
  password: z
    .string()
    .min(12)
    .max(128)
    .regex(/[A-Z]/, "Password must include an uppercase letter")
    .regex(/[a-z]/, "Password must include a lowercase letter")
    .regex(/[0-9]/, "Password must include a number"),
  role: z.enum(signupRoles).default("CREATOR"),
});

export type SignInInput = z.infer<typeof signInSchema>;
export type SignUpInput = z.infer<typeof signUpSchema>;
""",
)

w(
    "src/validation/marketplace.ts",
    """import { z } from "zod";

export const marketplaceSearchSchema = z.object({
  q: z.string().max(200).optional(),
  type: z.enum(["operators", "creators", "all"]).default("operators"),
  country: z.string().length(2).optional(),
  industry: z.string().max(80).optional(),
  category: z.string().max(80).optional(),
  minAudience: z.coerce.number().int().min(0).optional(),
  maxAudience: z.coerce.number().int().min(0).optional(),
  maxMoq: z.coerce.number().int().min(0).optional(),
  minPrice: z.coerce.number().min(0).optional(),
  maxPrice: z.coerce.number().min(0).optional(),
  minTrust: z.coerce.number().min(0).max(100).optional(),
  verifiedOnly: z
    .union([z.boolean(), z.enum(["true", "false"])])
    .transform((v) => v === true || v === "true")
    .optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(20),
  sortBy: z.enum(["trust", "audience", "moq", "recent"]).default("trust"),
  sortDir: z.enum(["asc", "desc"]).default("desc"),
});

export type MarketplaceSearchInput = z.infer<typeof marketplaceSearchSchema>;
""",
)

w(
    "src/validation/proposal.ts",
    """import { z } from "zod";

export const proposalTermsSchema = z.object({
  revenueSharePercent: z.number().min(0).max(100).optional(),
  equityPercent: z.number().min(0).max(100).optional(),
  trademarkOwnership: z.string().max(500).optional(),
  customerDataOwnership: z.string().max(500).optional(),
  inventoryOwnership: z.string().max(500).optional(),
  marketingResponsibilities: z.string().max(2000).optional(),
  productionResponsibility: z.string().max(2000).optional(),
  terminationClause: z.string().max(2000).optional(),
  disputeClause: z.string().max(2000).optional(),
  paymentTerms: z.string().max(1000).optional(),
});

export const createProposalSchema = z.object({
  recipientId: z.string().cuid(),
  title: z.string().min(3).max(200).trim(),
  summary: z.string().min(20).max(10000).trim(),
  budgetMin: z.number().min(0).optional(),
  budgetMax: z.number().min(0).optional(),
  currency: z.string().length(3).default("USD"),
  timelineDays: z.number().int().min(1).max(3650).optional(),
  terms: proposalTermsSchema.default({}),
  expiresInDays: z.number().int().min(1).max(90).default(14),
});

export const counterProposalSchema = z.object({
  title: z.string().min(3).max(200).trim().optional(),
  summary: z.string().min(20).max(10000).trim().optional(),
  budgetMin: z.number().min(0).optional(),
  budgetMax: z.number().min(0).optional(),
  timelineDays: z.number().int().min(1).max(3650).optional(),
  terms: proposalTermsSchema.optional(),
});

export const proposalActionSchema = z.object({
  action: z.enum(["send", "accept", "reject", "withdraw"]),
});

export type CreateProposalInput = z.infer<typeof createProposalSchema>;
export type CounterProposalInput = z.infer<typeof counterProposalSchema>;
""",
)

w(
    "src/validation/deal.ts",
    """import { z } from "zod";

export const projectPhaseSchema = z.enum([
  "IDEA",
  "RESEARCH",
  "PROTOTYPE",
  "SAMPLE",
  "PACKAGING",
  "MANUFACTURING",
  "QA",
  "SHIPPING",
  "LAUNCH",
  "POST_LAUNCH",
  "REFUND_MONITORING",
  "COMPLETED",
]);

export const updateDealSchema = z.object({
  title: z.string().min(3).max(200).optional(),
  description: z.string().max(10000).optional(),
  status: z.enum(["ACTIVE", "ON_HOLD", "COMPLETED", "CANCELLED"]).optional(),
  phase: projectPhaseSchema.optional(),
});

export const createMilestoneSchema = z.object({
  title: z.string().min(2).max(200),
  description: z.string().max(5000).optional(),
  amount: z.number().min(0).optional(),
  currency: z.string().length(3).default("USD"),
  dueDate: z.string().datetime().optional(),
  phase: projectPhaseSchema.optional(),
  orderIndex: z.number().int().min(0).optional(),
});

export const updateMilestoneSchema = z.object({
  title: z.string().min(2).max(200).optional(),
  description: z.string().max(5000).optional(),
  status: z
    .enum([
      "PENDING",
      "IN_PROGRESS",
      "AWAITING_APPROVAL",
      "APPROVED",
      "REJECTED",
      "PAID",
      "SKIPPED",
    ])
    .optional(),
  amount: z.number().min(0).optional(),
  dueDate: z.string().datetime().nullable().optional(),
});

export const createTaskSchema = z.object({
  title: z.string().min(2).max(200),
  description: z.string().max(5000).optional(),
  milestoneId: z.string().cuid().optional(),
  assigneeId: z.string().cuid().optional(),
  dueDate: z.string().datetime().optional(),
});

export const createDecisionSchema = z.object({
  title: z.string().min(2).max(200),
  rationale: z.string().min(5).max(10000),
});

export const createMeetingNoteSchema = z.object({
  title: z.string().min(2).max(200),
  body: z.string().min(5).max(20000),
  heldAt: z.string().datetime(),
});
""",
)

w(
    "src/validation/contract.ts",
    """import { z } from "zod";

export const createContractSchema = z.object({
  dealId: z.string().cuid(),
  title: z.string().min(3).max(200),
  content: z.object({
    revenueSharePercent: z.number().min(0).max(100).optional(),
    equityPercent: z.number().min(0).max(100).optional(),
    trademarkOwnership: z.string().max(1000).optional(),
    customerDataOwnership: z.string().max(1000).optional(),
    inventoryOwnership: z.string().max(1000).optional(),
    marketingResponsibilities: z.string().max(5000).optional(),
    productionResponsibility: z.string().max(5000).optional(),
    terminationClause: z.string().max(5000).optional(),
    disputeClause: z.string().max(5000).optional(),
    paymentTerms: z.string().max(2000).optional(),
    customClauses: z
      .array(z.object({ title: z.string(), body: z.string() }))
      .max(50)
      .optional(),
  }),
});

export const signContractSchema = z.object({
  signatureData: z.string().min(1).max(50000),
});
""",
)

w(
    "src/validation/message.ts",
    """import { z } from "zod";

export const sendMessageSchema = z
  .object({
    conversationId: z.string().cuid().optional(),
    dealId: z.string().cuid().optional(),
    recipientId: z.string().cuid().optional(),
    body: z.string().min(1).max(10000).trim(),
    parentId: z.string().cuid().optional(),
    attachments: z
      .array(
        z.object({
          name: z.string().max(255),
          storageKey: z.string().max(500),
          mimeType: z.string().max(120),
          sizeBytes: z.number().int().positive(),
        }),
      )
      .max(10)
      .default([]),
  })
  .refine((d) => d.conversationId || d.dealId || d.recipientId, {
    message: "conversationId, dealId, or recipientId is required",
  });
""",
)

print("done")

import { z } from "zod";

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

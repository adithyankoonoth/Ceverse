import { z } from "zod";

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

import { z } from "zod";

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

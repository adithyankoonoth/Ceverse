import { z } from "zod";

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

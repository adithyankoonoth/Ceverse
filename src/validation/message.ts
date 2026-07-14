import { z } from "zod";

export const sendMessageSchema = z
  .object({
    conversationId: z.string().min(1).max(64).optional(),
    dealId: z.string().min(1).max(64).optional(),
    recipientId: z.string().uuid().optional(),
    body: z.string().min(1).max(10000).trim(),
    parentId: z.string().min(1).max(64).optional(),
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

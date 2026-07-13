import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { logger } from "@/lib/logger";

export type AuditInput = {
  actorId?: string | null;
  action: string;
  resource: string;
  resourceId?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  requestId?: string | null;
  metadata?: Prisma.InputJsonValue;
};

/**
 * Persist an audit log entry. Failures are logged but never throw —
 * audit must not break the primary request path.
 */
export async function writeAudit(input: AuditInput): Promise<void> {
  try {
    await db.auditLog.create({
      data: {
        actorId: input.actorId ?? null,
        action: input.action,
        resource: input.resource,
        resourceId: input.resourceId ?? null,
        ipAddress: input.ipAddress ?? null,
        userAgent: input.userAgent ?? null,
        requestId: input.requestId ?? null,
        metadata: input.metadata ?? {},
      },
    });
  } catch (err) {
    logger.error("audit_write_failed", {
      action: input.action,
      resource: input.resource,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

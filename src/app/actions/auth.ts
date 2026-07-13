"use server";

import { db } from "@/lib/db";
import { writeAudit } from "@/lib/audit";
import { OPERATOR_ROLES } from "@/domain/roles";
import type { UserRole } from "@prisma/client";
import { headers } from "next/headers";

const ALLOWED = new Set<string>(["CREATOR", ...OPERATOR_ROLES]);

export async function completeSignUp(input: {
  role: string;
  userId?: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    if (!input.userId) {
      return { ok: false, error: "Missing user" };
    }
    if (!ALLOWED.has(input.role)) {
      return { ok: false, error: "Invalid role" };
    }
    const role = input.role as UserRole;

    await db.user.update({
      where: { id: input.userId },
      data: { role },
    });

    if (role === "CREATOR") {
      await db.creatorProfile.upsert({
        where: { userId: input.userId },
        create: {
          userId: input.userId,
          displayName: "New creator",
        },
        update: {},
      });
    } else {
      await db.operatorProfile.upsert({
        where: { userId: input.userId },
        create: {
          userId: input.userId,
          companyName: "New company",
          companyType: role,
        },
        update: {},
      });
    }

    const h = await headers();
    await writeAudit({
      actorId: input.userId,
      action: "auth.signup_complete",
      resource: "user",
      resourceId: input.userId,
      metadata: { role },
      ipAddress: h.get("x-forwarded-for"),
      userAgent: h.get("user-agent"),
    });

    return { ok: true };
  } catch {
    return { ok: false, error: "Failed to complete signup" };
  }
}

"use server";

import { db } from "@/lib/db";
import { writeAudit } from "@/lib/audit";
import { OPERATOR_ROLES } from "@/domain/roles";
import type { UserRole } from "@prisma/client";
import { headers } from "next/headers";
import { ensureAppUser } from "@/lib/auth";

const ALLOWED = new Set<string>(["CREATOR", ...OPERATOR_ROLES]);

export async function completeSignUp(input: {
  role: string;
  userId?: string;
  name?: string;
  email?: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    if (!input.userId) {
      return { ok: false, error: "Missing user" };
    }
    if (!ALLOWED.has(input.role)) {
      return { ok: false, error: "Invalid role" };
    }
    const role = input.role as UserRole;

    if (input.email) {
      await ensureAppUser({
        id: input.userId,
        email: input.email,
        name: input.name,
        role: role as never,
        emailVerified: false,
      });
    }

    await db.user.update({
      where: { id: input.userId },
      data: { role, name: input.name || undefined },
    });

    if (role === "CREATOR") {
      await db.creatorProfile.upsert({
        where: { userId: input.userId },
        create: {
          userId: input.userId,
          displayName: input.name?.trim() || "New creator",
        },
        update: {
          displayName: input.name?.trim() || undefined,
        },
      });
      await db.operatorProfile.deleteMany({ where: { userId: input.userId } });
    } else {
      await db.operatorProfile.upsert({
        where: { userId: input.userId },
        create: {
          userId: input.userId,
          companyName: input.name?.trim() || "New company",
          companyType: role,
        },
        update: {
          companyName: input.name?.trim() || undefined,
          companyType: role,
        },
      });
      await db.creatorProfile.deleteMany({ where: { userId: input.userId } });
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

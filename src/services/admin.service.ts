import { db } from "@/lib/db";
import { writeAudit } from "@/lib/audit";
import { NotFoundError } from "@/domain/errors";
import type { UserRole } from "@prisma/client";
import { buildPaginatedResult } from "@/lib/pagination";

export async function listUsers(page = 1, pageSize = 20, q?: string) {
  const where = {
    deletedAt: null,
    ...(q
      ? {
          OR: [
            { email: { contains: q, mode: "insensitive" as const } },
            { name: { contains: q, mode: "insensitive" as const } },
          ],
        }
      : {}),
  };
  const [items, total] = await Promise.all([
    db.user.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        trustScore: true,
        isActive: true,
        createdAt: true,
        lastLoginAt: true,
        image: true,
      },
    }),
    db.user.count({ where }),
  ]);
  return buildPaginatedResult(items, total, { page, pageSize });
}

export async function setUserRole(adminId: string, userId: string, role: UserRole) {
  const user = await db.user.update({
    where: { id: userId },
    data: { role, version: { increment: 1 } },
  });
  await writeAudit({
    actorId: adminId,
    action: "admin.set_role",
    resource: "user",
    resourceId: userId,
    metadata: { role },
  });
  return user;
}

export async function setUserActive(adminId: string, userId: string, isActive: boolean) {
  const user = await db.user.update({
    where: { id: userId },
    data: { isActive, version: { increment: 1 } },
  });
  await writeAudit({
    actorId: adminId,
    action: isActive ? "admin.activate_user" : "admin.deactivate_user",
    resource: "user",
    resourceId: userId,
  });
  return user;
}

export async function listFeatureFlags() {
  return db.featureFlag.findMany({ orderBy: { key: "asc" } });
}

export async function upsertFeatureFlag(input: {
  adminId: string;
  key: string;
  enabled: boolean;
  description?: string;
  rolloutPct?: number;
}) {
  const flag = await db.featureFlag.upsert({
    where: { key: input.key },
    create: {
      key: input.key,
      enabled: input.enabled,
      description: input.description,
      rolloutPct: input.rolloutPct ?? 100,
    },
    update: {
      enabled: input.enabled,
      description: input.description,
      rolloutPct: input.rolloutPct,
    },
  });
  await writeAudit({
    actorId: input.adminId,
    action: "admin.feature_flag",
    resource: "feature_flag",
    resourceId: flag.id,
    metadata: { key: input.key, enabled: input.enabled },
  });
  return flag;
}

export async function getSystemHealth() {
  const started = Date.now();
  let database: "ok" | "error" = "ok";
  try {
    await db.$queryRaw`SELECT 1`;
  } catch {
    database = "error";
  }

  return {
    status: database === "ok" ? "healthy" : "degraded",
    database,
    uptimeSeconds: Math.floor(process.uptime()),
    latencyMs: Date.now() - started,
    timestamp: new Date().toISOString(),
  };
}

export async function createAnnouncement(input: {
  adminId: string;
  title: string;
  body: string;
  endsAt?: Date;
}) {
  const announcement = await db.announcement.create({
    data: {
      title: input.title,
      body: input.body,
      endsAt: input.endsAt,
      active: true,
    },
  });
  await writeAudit({
    actorId: input.adminId,
    action: "admin.announcement",
    resource: "announcement",
    resourceId: announcement.id,
  });
  return announcement;
}

export async function getUserOrThrow(userId: string) {
  const user = await db.user.findFirst({ where: { id: userId, deletedAt: null } });
  if (!user) throw new NotFoundError("User", userId);
  return user;
}

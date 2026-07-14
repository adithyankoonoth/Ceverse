import { db } from "@/lib/db";
import { UnauthorizedError, ForbiddenError } from "@/domain/errors";
import type { Role } from "@/lib/rbac";
import { createClient } from "@/lib/supabase/server";
import type { User as AppUser } from "@prisma/client";

export type AuthSessionUser = {
  id: string;
  email: string;
  name: string;
  image?: string | null;
  role: Role;
  trustScore: number;
};

export type AppSession = {
  user: AuthSessionUser;
  supabaseUserId: string;
};

/**
 * Ensure public.users row exists for a Supabase auth user (Google / email signup).
 * The SQL trigger also does this; this is a safe server-side fallback.
 */
export async function ensureAppUser(input: {
  id: string;
  email: string;
  name?: string | null;
  image?: string | null;
  emailVerified?: boolean;
  role?: Role;
}): Promise<AppUser> {
  const existing = await db.user.findUnique({ where: { id: input.id } });
  if (existing) {
    const patch: {
      email?: string;
      name?: string;
      image?: string | null;
      emailVerified?: boolean;
      lastLoginAt: Date;
    } = { lastLoginAt: new Date() };
    if (input.email && input.email !== existing.email) patch.email = input.email;
    if (input.name && input.name !== existing.name) patch.name = input.name;
    if (input.image !== undefined && input.image !== existing.image) {
      patch.image = input.image;
    }
    if (input.emailVerified && !existing.emailVerified) patch.emailVerified = true;
    return db.user.update({ where: { id: input.id }, data: patch });
  }

  const role = input.role ?? "CREATOR";
  const name =
    input.name?.trim() ||
    input.email.split("@")[0] ||
    "Ceverse user";

  if (role === "CREATOR") {
    return db.user.create({
      data: {
        id: input.id,
        email: input.email.toLowerCase(),
        name,
        image: input.image ?? null,
        emailVerified: input.emailVerified ?? false,
        role: "CREATOR",
        lastLoginAt: new Date(),
        creatorProfile: {
          create: { displayName: name },
        },
      },
    });
  }

  const companyType =
    role === "ADMIN" || role === "SUPER_ADMIN" ? "OPERATOR" : role;

  return db.user.create({
    data: {
      id: input.id,
      email: input.email.toLowerCase(),
      name,
      image: input.image ?? null,
      emailVerified: input.emailVerified ?? false,
      role,
      lastLoginAt: new Date(),
      operatorProfile: {
        create: {
          companyName: name,
          companyType,
        },
      },
    },
  });
}

export async function getSession(): Promise<AppSession | null> {
  const supabase = await createClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();

  if (!authUser?.email) return null;

  const meta = authUser.user_metadata ?? {};
  const appUser = await ensureAppUser({
    id: authUser.id,
    email: authUser.email,
    name:
      (typeof meta.full_name === "string" && meta.full_name) ||
      (typeof meta.name === "string" && meta.name) ||
      (typeof meta.display_name === "string" && meta.display_name) ||
      null,
    image:
      (typeof meta.avatar_url === "string" && meta.avatar_url) ||
      (typeof meta.picture === "string" && meta.picture) ||
      null,
    emailVerified: Boolean(authUser.email_confirmed_at),
  });

  if (!appUser.isActive || appUser.deletedAt) return null;

  return {
    supabaseUserId: authUser.id,
    user: {
      id: appUser.id,
      email: appUser.email,
      name: appUser.name,
      image: appUser.image,
      role: appUser.role as Role,
      trustScore: appUser.trustScore,
    },
  };
}

export async function requireSession(): Promise<AppSession> {
  const session = await getSession();
  if (!session) throw new UnauthorizedError();
  return session;
}

export async function requireAdminSession(): Promise<AppSession> {
  const session = await requireSession();
  if (session.user.role !== "ADMIN" && session.user.role !== "SUPER_ADMIN") {
    throw new ForbiddenError("Admin access required");
  }
  return session;
}

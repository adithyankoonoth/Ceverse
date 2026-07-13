import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { headers } from "next/headers";
import { db } from "@/lib/db";
import { UnauthorizedError } from "@/domain/errors";
import type { Role } from "@/lib/rbac";

export const auth = betterAuth({
  database: prismaAdapter(db, { provider: "postgresql" }),
  secret: process.env.BETTER_AUTH_SECRET,
  baseURL: process.env.BETTER_AUTH_URL ?? process.env.NEXT_PUBLIC_APP_URL,
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 12,
    maxPasswordLength: 128,
  },
  session: {
    expiresIn: 60 * 60 * 24 * 7,
    updateAge: 60 * 60 * 24,
    cookieCache: {
      enabled: true,
      maxAge: 60 * 5,
    },
  },
  user: {
    additionalFields: {
      role: {
        type: "string",
        required: false,
        defaultValue: "CREATOR",
        input: false,
      },
      trustScore: {
        type: "number",
        required: false,
        defaultValue: 50,
        input: false,
      },
    },
  },
  advanced: {
    useSecureCookies: process.env.NODE_ENV === "production",
    defaultCookieAttributes: {
      httpOnly: true,
      sameSite: "strict",
      secure: process.env.NODE_ENV === "production",
    },
  },
  trustedOrigins: [process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"],
});

export type AuthSessionUser = {
  id: string;
  email: string;
  name: string;
  image?: string | null;
  role: Role;
  trustScore: number;
};

export async function getSession() {
  return auth.api.getSession({ headers: await headers() });
}

export async function requireSession() {
  const session = await getSession();
  if (!session?.user) {
    throw new UnauthorizedError();
  }
  const user = session.user as typeof session.user & {
    role?: string;
    trustScore?: number;
  };
  return {
    ...session,
    user: {
      ...user,
      role: (user.role ?? "CREATOR") as Role,
      trustScore: typeof user.trustScore === "number" ? user.trustScore : 50,
    },
  };
}

export async function requireAdminSession() {
  const session = await requireSession();
  if (session.user.role !== "ADMIN" && session.user.role !== "SUPER_ADMIN") {
    const { ForbiddenError } = await import("@/domain/errors");
    throw new ForbiddenError("Admin access required");
  }
  return session;
}

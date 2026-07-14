import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { ensureAppUser } from "@/lib/auth";
import { safeRedirectPath } from "@/lib/utils";
import type { Role } from "@/lib/rbac";
import { writeAudit } from "@/lib/audit";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = safeRedirectPath(searchParams.get("next"), "/dashboard");

  if (code) {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error && data.user?.email) {
      const meta = data.user.user_metadata ?? {};
      const roleRaw = typeof meta.role === "string" ? meta.role : "CREATOR";
      const role = roleRaw as Role;

      await ensureAppUser({
        id: data.user.id,
        email: data.user.email,
        name:
          (typeof meta.full_name === "string" && meta.full_name) ||
          (typeof meta.name === "string" && meta.name) ||
          null,
        image:
          (typeof meta.avatar_url === "string" && meta.avatar_url) ||
          (typeof meta.picture === "string" && meta.picture) ||
          null,
        emailVerified: Boolean(data.user.email_confirmed_at),
        role: [
          "CREATOR",
          "OPERATOR",
          "MANUFACTURER",
          "DESIGNER",
          "PACKAGING_PARTNER",
          "PHOTOGRAPHER",
          "LAWYER",
          "MARKETING_AGENCY",
          "WAREHOUSE",
          "INVESTOR",
        ].includes(role)
          ? role
          : "CREATOR",
      });

      await writeAudit({
        actorId: data.user.id,
        action: "auth.callback",
        resource: "user",
        resourceId: data.user.id,
        metadata: {
          provider: data.user.app_metadata?.provider ?? "email",
        },
      });

      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/sign-in?error=auth_callback`);
}

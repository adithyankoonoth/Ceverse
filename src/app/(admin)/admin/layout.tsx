import { redirect } from "next/navigation";
import { requireAdminSession } from "@/lib/auth";
import { AppShell } from "@/components/layout/app-shell";
import type { Role } from "@/lib/rbac";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  let session;
  try {
    session = await requireAdminSession();
  } catch {
    redirect("/dashboard");
  }

  return (
    <AppShell
      user={{
        name: session.user.name,
        email: session.user.email,
        image: session.user.image,
        role: session.user.role as Role,
      }}
    >
      {children}
    </AppShell>
  );
}

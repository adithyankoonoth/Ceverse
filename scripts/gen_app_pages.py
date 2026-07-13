#!/usr/bin/env python3
import os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def w(rel: str, content: str) -> None:
    path = os.path.join(ROOT, *rel.split("/"))
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8", newline="\n") as f:
        f.write(content)
    print("wrote", rel)


w(
    "src/app/(auth)/sign-in/page.tsx",
    r'''import Link from "next/link";
import { SignInForm } from "@/components/auth/sign-in-form";

export const metadata = { title: "Sign in" };

export default function SignInPage() {
  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-md space-y-6">
        <div className="space-y-2 text-center">
          <Link href="/" className="text-lg font-semibold">
            Ceverse
          </Link>
          <h1 className="text-2xl font-semibold tracking-tight">Welcome back</h1>
          <p className="text-sm text-muted-foreground">
            Sign in to your creator commerce workspace
          </p>
        </div>
        <SignInForm />
        <p className="text-center text-sm text-muted-foreground">
          No account?{" "}
          <Link href="/sign-up" className="text-foreground underline-offset-4 hover:underline">
            Create one
          </Link>
        </p>
      </div>
    </div>
  );
}
''',
)

w(
    "src/app/(auth)/sign-up/page.tsx",
    r'''import Link from "next/link";
import { SignUpForm } from "@/components/auth/sign-up-form";

export const metadata = { title: "Sign up" };

export default function SignUpPage() {
  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-12">
      <div className="w-full max-w-md space-y-6">
        <div className="space-y-2 text-center">
          <Link href="/" className="text-lg font-semibold">
            Ceverse
          </Link>
          <h1 className="text-2xl font-semibold tracking-tight">Create your account</h1>
          <p className="text-sm text-muted-foreground">
            Join the operating system for creator-led brands
          </p>
        </div>
        <SignUpForm />
        <p className="text-center text-sm text-muted-foreground">
          Already have an account?{" "}
          <Link href="/sign-in" className="text-foreground underline-offset-4 hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
''',
)

w(
    "src/components/auth/sign-in-form.tsx",
    r'''"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { signIn } from "@/lib/auth-client";
import { safeRedirectPath } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";

export function SignInForm() {
  const router = useRouter();
  const search = useSearchParams();
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    const form = new FormData(e.currentTarget);
    const email = String(form.get("email") ?? "");
    const password = String(form.get("password") ?? "");

    const { error } = await signIn.email({ email, password });
    setLoading(false);
    if (error) {
      toast.error(error.message ?? "Sign in failed");
      return;
    }
    toast.success("Signed in");
    router.push(safeRedirectPath(search.get("next")));
    router.refresh();
  }

  return (
    <Card>
      <CardContent className="pt-6">
        <form className="space-y-4" onSubmit={onSubmit}>
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              maxLength={255}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              minLength={12}
              maxLength={128}
            />
          </div>
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Signing in…" : "Sign in"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
''',
)

w(
    "src/components/auth/sign-up-form.tsx",
    r'''"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { signUp } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { completeSignUp } from "@/app/actions/auth";

const ROLES = [
  { value: "CREATOR", label: "Creator" },
  { value: "OPERATOR", label: "Business Operator" },
  { value: "MANUFACTURER", label: "Manufacturer" },
  { value: "DESIGNER", label: "Designer" },
  { value: "PACKAGING_PARTNER", label: "Packaging Partner" },
  { value: "PHOTOGRAPHER", label: "Photographer" },
  { value: "LAWYER", label: "Lawyer" },
  { value: "MARKETING_AGENCY", label: "Marketing Agency" },
  { value: "WAREHOUSE", label: "Warehouse" },
  { value: "INVESTOR", label: "Investor" },
] as const;

export function SignUpForm() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    const form = new FormData(e.currentTarget);
    const name = String(form.get("name") ?? "");
    const email = String(form.get("email") ?? "");
    const password = String(form.get("password") ?? "");
    const role = String(form.get("role") ?? "CREATOR");

    const { data, error } = await signUp.email({ name, email, password });
    if (error) {
      setLoading(false);
      toast.error(error.message ?? "Sign up failed");
      return;
    }

    const result = await completeSignUp({ role, userId: data?.user?.id });
    setLoading(false);
    if (!result.ok) {
      toast.error(result.error ?? "Could not finish onboarding");
      return;
    }

    toast.success("Account created");
    router.push("/dashboard");
    router.refresh();
  }

  return (
    <Card>
      <CardContent className="pt-6">
        <form className="space-y-4" onSubmit={onSubmit}>
          <div className="space-y-2">
            <Label htmlFor="name">Full name</Label>
            <Input id="name" name="name" required minLength={2} maxLength={120} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" name="email" type="email" required maxLength={255} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              name="password"
              type="password"
              required
              minLength={12}
              maxLength={128}
              autoComplete="new-password"
            />
            <p className="text-xs text-muted-foreground">
              At least 12 characters with upper, lower, and a number.
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="role">I am a…</Label>
            <select
              id="role"
              name="role"
              defaultValue="CREATOR"
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            >
              {ROLES.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
          </div>
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Creating account…" : "Create account"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
''',
)

w(
    "src/app/actions/auth.ts",
    r'''"use server";

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
''',
)

w(
    "src/app/(app)/layout.tsx",
    r'''import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth";
import { AppShell } from "@/components/layout/app-shell";
import type { Role } from "@/lib/rbac";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  let session;
  try {
    session = await requireSession();
  } catch {
    redirect("/sign-in");
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
''',
)

w(
    "src/app/(app)/dashboard/page.tsx",
    r'''import Link from "next/link";
import { requireSession } from "@/lib/auth";
import { getUserDashboardMetrics } from "@/services/analytics.service";
import { formatCurrency } from "@/lib/utils";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export const metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const session = await requireSession();
  const metrics = await getUserDashboardMetrics(session.user.id);

  const cards = [
    { label: "Active deals", value: String(metrics.activeDeals) },
    { label: "Proposals inbox", value: String(metrics.proposalsInbox) },
    {
      label: "Escrow volume",
      value: formatCurrency(metrics.escrowVolume),
    },
    {
      label: "Avg deal health",
      value: metrics.averageHealthScore != null ? String(metrics.averageHealthScore) : "—",
    },
  ];

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Welcome back, {session.user.name.split(" ")[0]}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Your creator commerce command center
          </p>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline">
            <Link href="/marketplace">Browse marketplace</Link>
          </Button>
          <Button asChild>
            <Link href="/proposals">Proposals</Link>
          </Button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((card) => (
          <Card key={card.label}>
            <CardHeader className="pb-2">
              <CardDescription>{card.label}</CardDescription>
              <CardTitle className="text-3xl font-semibold tabular-nums">
                {card.value}
              </CardTitle>
            </CardHeader>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Risk snapshot</CardTitle>
            <CardDescription>Across your active and historical deals</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-3">
            <Badge variant="success">Low {metrics.riskBreakdown.low}</Badge>
            <Badge variant="warning">Medium {metrics.riskBreakdown.medium}</Badge>
            <Badge variant="danger">High {metrics.riskBreakdown.high}</Badge>
            {metrics.activeDisputes > 0 ? (
              <Badge variant="danger">{metrics.activeDisputes} open disputes</Badge>
            ) : (
              <Badge variant="secondary">No open disputes</Badge>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Recent payments</CardTitle>
            <CardDescription>Succeeded escrow movements</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {metrics.recentPayments.length === 0 ? (
              <p className="text-sm text-muted-foreground">No payments yet.</p>
            ) : (
              metrics.recentPayments.slice(0, 5).map((p, i) => (
                <div
                  key={`${p.createdAt.toISOString()}-${i}`}
                  className="flex items-center justify-between text-sm"
                >
                  <span className="text-muted-foreground">{p.type.replaceAll("_", " ")}</span>
                  <span className="font-medium tabular-nums">
                    {formatCurrency(p.amount)}
                  </span>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
''',
)

w(
    "src/app/(app)/marketplace/page.tsx",
    r'''import Link from "next/link";
import { requireSession } from "@/lib/auth";
import { searchMarketplace } from "@/services/marketplace.service";
import { marketplaceSearchSchema } from "@/validation/marketplace";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { formatNumber } from "@/lib/utils";

export const metadata = { title: "Marketplace" };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function MarketplacePage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const session = await requireSession();
  const raw = await searchParams;
  const flat: Record<string, string> = {};
  for (const [k, v] of Object.entries(raw)) {
    if (typeof v === "string") flat[k] = v;
    else if (Array.isArray(v) && v[0]) flat[k] = v[0];
  }
  const input = marketplaceSearchSchema.parse(flat);
  const result = await searchMarketplace(input, {
    id: session.user.id,
    role: session.user.role,
    trustScore: session.user.trustScore,
  });

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Marketplace</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Discover verified operators and creators for your next launch
        </p>
      </div>

      <form className="grid gap-3 rounded-xl border border-border bg-card/40 p-4 md:grid-cols-4">
        <Input name="q" placeholder="Search companies…" defaultValue={input.q ?? ""} />
        <Input
          name="country"
          placeholder="Country (US)"
          maxLength={2}
          defaultValue={input.country ?? ""}
        />
        <Input
          name="industry"
          placeholder="Industry"
          defaultValue={input.industry ?? ""}
        />
        <Button type="submit">Search</Button>
        <input type="hidden" name="type" value={input.type} />
      </form>

      <div className="grid gap-4 md:grid-cols-2">
        {result.data.map((item) => (
          <Link key={item.id} href={`/marketplace/${item.id}`}>
            <Card className="h-full transition-colors hover:border-primary/40">
              <CardHeader>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <CardTitle className="text-base">{item.name}</CardTitle>
                    <CardDescription>
                      {item.role.replaceAll("_", " ")}
                      {item.location ? ` · ${item.location}` : ""}
                    </CardDescription>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <Badge variant="secondary">Trust {Math.round(item.trustScore)}</Badge>
                    {item.matchScore != null ? (
                      <Badge variant="default">Match {item.matchScore}</Badge>
                    ) : null}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="line-clamp-2 text-sm text-muted-foreground">
                  {item.bio ?? "No bio yet."}
                </p>
                <div className="flex flex-wrap gap-2">
                  {item.verificationStatus === "VERIFIED" ? (
                    <Badge variant="success">Verified</Badge>
                  ) : null}
                  {"moq" in item && item.moq != null ? (
                    <Badge variant="outline">MOQ {formatNumber(item.moq)}</Badge>
                  ) : null}
                  {"audienceSize" in item && item.audienceSize != null ? (
                    <Badge variant="outline">
                      Audience {formatNumber(item.audienceSize as number)}
                    </Badge>
                  ) : null}
                  {item.industries?.slice(0, 3).map((ind) => (
                    <Badge key={ind} variant="outline">
                      {ind}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      {result.data.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            No profiles match these filters. Try broadening your search.
          </CardContent>
        </Card>
      ) : null}

      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>
          Page {result.meta.page} of {Math.max(1, result.meta.totalPages)} · {result.meta.total}{" "}
          results
        </span>
      </div>
    </div>
  );
}
''',
)

print("auth + dashboard + marketplace done")

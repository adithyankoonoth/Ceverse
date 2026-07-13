"use client";

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

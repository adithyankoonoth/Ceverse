import { requireSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata = { title: "Settings" };

export default async function SettingsPage() {
  const session = await requireSession();
  const user = await db.user.findUniqueOrThrow({
    where: { id: session.user.id },
    include: { creatorProfile: true, operatorProfile: true },
  });

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">Account, profile, and verification</p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Account</CardTitle>
          <CardDescription>{user.email}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2 text-sm">
          <Badge variant="secondary">{user.role}</Badge>
          <Badge variant="outline">Trust {Math.round(user.trustScore)}</Badge>
        </CardContent>
      </Card>
      {user.creatorProfile ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Creator profile</CardTitle>
            <CardDescription>{user.creatorProfile.displayName}</CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Verification: {user.creatorProfile.verificationStatus}
          </CardContent>
        </Card>
      ) : null}
      {user.operatorProfile ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Operator profile</CardTitle>
            <CardDescription>{user.operatorProfile.companyName}</CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Verification: {user.operatorProfile.verificationStatus}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

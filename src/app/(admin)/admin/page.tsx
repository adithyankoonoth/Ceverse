import { requireAdminSession } from "@/lib/auth";
import { getAdminAnalytics } from "@/services/analytics.service";
import { listPendingVerifications } from "@/services/verification.service";
import { listDisputes } from "@/services/dispute.service";
import { getSystemHealth, listFeatureFlags, listUsers } from "@/services/admin.service";
import { formatCurrency } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata = { title: "Admin" };

export default async function AdminPage() {
  await requireAdminSession();
  const [analytics, verifications, disputes, health, flags, users] = await Promise.all([
    getAdminAnalytics(),
    listPendingVerifications(),
    listDisputes(),
    getSystemHealth(),
    listFeatureFlags(),
    listUsers(1, 10),
  ]);

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Admin console</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Users, verification queue, disputes, flags, and system health
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader>
            <CardDescription>Users</CardDescription>
            <CardTitle className="text-2xl tabular-nums">{analytics.totalUsers}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Payment volume</CardDescription>
            <CardTitle className="text-2xl tabular-nums">
              {formatCurrency(analytics.paymentVolume)}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Pending verifications</CardDescription>
            <CardTitle className="text-2xl tabular-nums">
              {analytics.pendingVerifications}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>System</CardDescription>
            <CardTitle className="text-2xl">
              <Badge variant={health.status === "healthy" ? "success" : "danger"}>
                {health.status}
              </Badge>
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Verification queue</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {verifications.length === 0 ? (
              <p className="text-sm text-muted-foreground">Queue is empty.</p>
            ) : (
              verifications.slice(0, 8).map((v) => (
                <div key={v.id} className="flex justify-between text-sm">
                  <span>
                    {v.user.name} · {v.type}
                  </span>
                  <Badge variant="warning">{v.status}</Badge>
                </div>
              ))
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Disputes</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {disputes.length === 0 ? (
              <p className="text-sm text-muted-foreground">No disputes.</p>
            ) : (
              disputes.slice(0, 8).map((d) => (
                <div key={d.id} className="flex justify-between text-sm">
                  <span className="truncate pr-3">{d.deal.title}</span>
                  <Badge variant="outline">{d.status}</Badge>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Recent users</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {users.data.map((u) => (
            <div key={u.id} className="flex items-center justify-between text-sm">
              <span>
                {u.name} · {u.email}
              </span>
              <div className="flex gap-2">
                <Badge variant="secondary">{u.role}</Badge>
                {!u.isActive ? <Badge variant="danger">Inactive</Badge> : null}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Feature flags</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {flags.length === 0 ? (
            <p className="text-sm text-muted-foreground">No flags configured.</p>
          ) : (
            flags.map((f) => (
              <div key={f.id} className="flex justify-between text-sm">
                <span>{f.key}</span>
                <Badge variant={f.enabled ? "success" : "secondary"}>
                  {f.enabled ? "on" : "off"}
                </Badge>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}

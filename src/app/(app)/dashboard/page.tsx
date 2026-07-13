import Link from "next/link";
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

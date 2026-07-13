import { requireSession } from "@/lib/auth";
import { getUserDashboardMetrics } from "@/services/analytics.service";
import { formatCurrency } from "@/lib/utils";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata = { title: "Analytics" };

export default async function AnalyticsPage() {
  const session = await requireSession();
  const m = await getUserDashboardMetrics(session.user.id);

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Analytics</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Partnership performance, escrow, and deal health
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[
          ["Total deals", m.totalDeals],
          ["Completed", m.completedDeals],
          ["Active", m.activeDeals],
          ["Escrow volume", formatCurrency(m.escrowVolume)],
          ["Released", formatCurrency(m.escrowReleased)],
          ["Avg health", m.averageHealthScore ?? "—"],
        ].map(([label, value]) => (
          <Card key={String(label)}>
            <CardHeader>
              <CardDescription>{label}</CardDescription>
              <CardTitle className="text-2xl tabular-nums">{value}</CardTitle>
            </CardHeader>
          </Card>
        ))}
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Risk distribution</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-2 text-sm sm:grid-cols-3">
          <div>Low risk: {m.riskBreakdown.low}</div>
          <div>Medium risk: {m.riskBreakdown.medium}</div>
          <div>High risk: {m.riskBreakdown.high}</div>
        </CardContent>
      </Card>
    </div>
  );
}

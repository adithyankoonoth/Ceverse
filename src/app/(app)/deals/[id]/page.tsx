import { requireSession } from "@/lib/auth";
import { getDeal } from "@/services/deal.service";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatCurrency } from "@/lib/utils";

export default async function DealRoomPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await requireSession();
  const deal = await getDeal(id, session.user.id);
  const health = deal.health;

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{deal.title}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {deal.phase.replaceAll("_", " ")} · {deal.status}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {deal.members.map((m) => (
            <Badge key={m.userId} variant="outline">
              {m.user.name}
            </Badge>
          ))}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Deal health</CardTitle>
            <CardDescription>Live risk assessment with explainability</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-end gap-3">
              <span className="text-4xl font-semibold tabular-nums">{health.score}</span>
              <Badge
                variant={
                  health.riskLevel === "HIGH"
                    ? "danger"
                    : health.riskLevel === "MEDIUM"
                      ? "warning"
                      : "success"
                }
              >
                {health.riskLevel} risk
              </Badge>
            </div>
            <Progress value={health.score} />
            <ul className="space-y-1 text-sm text-muted-foreground">
              {health.rationale.map((r) => (
                <li key={r}>• {r}</li>
              ))}
            </ul>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Escrow</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {deal.escrows[0] ? (
              <>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Status</span>
                  <span>{deal.escrows[0].status}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Total</span>
                  <span className="tabular-nums">
                    {formatCurrency(Number(deal.escrows[0].totalAmount), deal.escrows[0].currency)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Released</span>
                  <span className="tabular-nums">
                    {formatCurrency(
                      Number(deal.escrows[0].releasedAmount),
                      deal.escrows[0].currency,
                    )}
                  </span>
                </div>
              </>
            ) : (
              <p className="text-muted-foreground">No escrow configured.</p>
            )}
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="milestones">
        <TabsList>
          <TabsTrigger value="milestones">Milestones</TabsTrigger>
          <TabsTrigger value="tasks">Tasks</TabsTrigger>
          <TabsTrigger value="activity">Activity</TabsTrigger>
          <TabsTrigger value="decisions">Decisions</TabsTrigger>
          <TabsTrigger value="contracts">Contracts</TabsTrigger>
        </TabsList>
        <TabsContent value="milestones" className="space-y-3">
          {deal.milestones.map((m) => (
            <Card key={m.id}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0">
                <div>
                  <CardTitle className="text-sm">{m.title}</CardTitle>
                  <CardDescription>
                    {m.phase?.replaceAll("_", " ") ?? "—"}
                    {m.amount != null
                      ? ` · ${formatCurrency(Number(m.amount), m.currency)}`
                      : ""}
                  </CardDescription>
                </div>
                <Badge variant="outline">{m.status}</Badge>
              </CardHeader>
            </Card>
          ))}
        </TabsContent>
        <TabsContent value="tasks" className="space-y-3">
          {deal.tasks.length === 0 ? (
            <p className="text-sm text-muted-foreground">No tasks yet.</p>
          ) : (
            deal.tasks.map((t) => (
              <Card key={t.id}>
                <CardHeader className="flex flex-row items-center justify-between space-y-0">
                  <CardTitle className="text-sm">{t.title}</CardTitle>
                  <Badge variant="secondary">{t.status}</Badge>
                </CardHeader>
              </Card>
            ))
          )}
        </TabsContent>
        <TabsContent value="activity" className="space-y-3">
          {deal.activities.map((a) => (
            <div key={a.id} className="border-b border-border py-3 text-sm last:border-0">
              <div className="font-medium">{a.summary}</div>
              <div className="text-xs text-muted-foreground">
                {a.createdAt.toLocaleString()} · {a.type}
              </div>
            </div>
          ))}
        </TabsContent>
        <TabsContent value="decisions" className="space-y-3">
          {deal.decisions.length === 0 ? (
            <p className="text-sm text-muted-foreground">No decisions logged.</p>
          ) : (
            deal.decisions.map((d) => (
              <Card key={d.id}>
                <CardHeader>
                  <CardTitle className="text-sm">{d.title}</CardTitle>
                  <CardDescription>{d.rationale}</CardDescription>
                </CardHeader>
              </Card>
            ))
          )}
        </TabsContent>
        <TabsContent value="contracts" className="space-y-3">
          {deal.contracts.length === 0 ? (
            <p className="text-sm text-muted-foreground">No contracts yet.</p>
          ) : (
            deal.contracts.map((c) => (
              <Card key={c.id}>
                <CardHeader className="flex flex-row items-center justify-between space-y-0">
                  <div>
                    <CardTitle className="text-sm">{c.title}</CardTitle>
                    <CardDescription>v{c.versionNumber}</CardDescription>
                  </div>
                  <Badge variant="outline">{c.status}</Badge>
                </CardHeader>
              </Card>
            ))
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

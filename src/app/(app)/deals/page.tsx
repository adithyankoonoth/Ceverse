import Link from "next/link";
import { requireSession } from "@/lib/auth";
import { listDeals } from "@/services/deal.service";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata = { title: "Deals" };

function riskVariant(level: string | null | undefined) {
  if (level === "HIGH") return "danger" as const;
  if (level === "MEDIUM") return "warning" as const;
  if (level === "LOW") return "success" as const;
  return "secondary" as const;
}

export default async function DealsPage() {
  const session = await requireSession();
  const deals = await listDeals(session.user.id);

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Deal rooms</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Private workspaces for milestones, decisions, and protected collaboration
        </p>
      </div>
      <div className="grid gap-4">
        {deals.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-sm text-muted-foreground">
              No deals yet. Accept a proposal to open your first deal room.
            </CardContent>
          </Card>
        ) : (
          deals.map((deal) => (
            <Link key={deal.id} href={`/deals/${deal.id}`}>
              <Card className="transition-colors hover:border-primary/40">
                <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
                  <div>
                    <CardTitle className="text-base">{deal.title}</CardTitle>
                    <CardDescription>
                      {deal.phase.replaceAll("_", " ")} · {deal.members.length} members ·{" "}
                      {deal._count.tasks} tasks
                    </CardDescription>
                  </div>
                  <div className="flex flex-wrap justify-end gap-2">
                    <Badge variant="outline">{deal.status}</Badge>
                    {deal.riskLevel ? (
                      <Badge variant={riskVariant(deal.riskLevel)}>{deal.riskLevel} risk</Badge>
                    ) : null}
                    {deal.healthScore != null ? (
                      <Badge variant="secondary">Health {Math.round(deal.healthScore)}</Badge>
                    ) : null}
                  </div>
                </CardHeader>
              </Card>
            </Link>
          ))
        )}
      </div>
    </div>
  );
}

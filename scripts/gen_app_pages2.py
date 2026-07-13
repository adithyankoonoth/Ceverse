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
    "src/app/(app)/marketplace/[userId]/page.tsx",
    r'''import Link from "next/link";
import { notFound } from "next/navigation";
import { requireSession } from "@/lib/auth";
import { getMarketplaceProfile } from "@/services/marketplace.service";
import { scorePair } from "@/services/matching.service";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { formatNumber } from "@/lib/utils";

export default async function MarketplaceProfilePage({
  params,
}: {
  params: Promise<{ userId: string }>;
}) {
  const { userId } = await params;
  const session = await requireSession();
  const profile = await getMarketplaceProfile(userId, session.user.id);
  if (!profile) notFound();

  let match: Awaited<ReturnType<typeof scorePair>> | null = null;
  try {
    if (session.user.role === "CREATOR" && profile.operatorProfile) {
      match = await scorePair(session.user.id, userId);
    } else if (session.user.role !== "CREATOR" && profile.creatorProfile) {
      match = await scorePair(userId, session.user.id);
    }
  } catch {
    match = null;
  }

  const op = profile.operatorProfile;
  const cr = profile.creatorProfile;

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {op?.companyName ?? cr?.displayName ?? profile.name}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {profile.role.replaceAll("_", " ")}
            {(op?.location || cr?.location) ? ` · ${op?.location ?? cr?.location}` : ""}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Badge variant="secondary">Trust {Math.round(profile.trustScore)}</Badge>
            {(op?.verificationStatus === "VERIFIED" ||
              cr?.verificationStatus === "VERIFIED") && (
              <Badge variant="success">Verified</Badge>
            )}
          </div>
        </div>
        <Button asChild>
          <Link href={`/proposals?compose=${userId}`}>Send proposal</Link>
        </Button>
      </div>

      {match ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Compatibility score</CardTitle>
            <CardDescription>
              Deterministic match based on industry, geo, capacity, trust, and verification
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-end gap-3">
              <span className="text-4xl font-semibold tabular-nums">{match.score}</span>
              <span className="pb-1 text-sm text-muted-foreground">/ 100</span>
            </div>
            <Progress value={match.score} />
            <div className="grid gap-2 sm:grid-cols-2">
              {match.factors.map((f) => (
                <div
                  key={f.name}
                  className="rounded-lg border border-border px-3 py-2 text-sm"
                >
                  <div className="flex justify-between font-medium">
                    <span>{f.name}</span>
                    <span className="tabular-nums">{f.score}</span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">{f.note}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">About</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm text-muted-foreground">
          <p>{op?.bio ?? cr?.bio ?? "No bio provided."}</p>
          {op ? (
            <div className="grid gap-2 sm:grid-cols-2">
              <div>MOQ: {op.moq != null ? formatNumber(op.moq) : "—"}</div>
              <div>Success rate: {Math.round(op.successRate * 100) / 100}</div>
              <div>Avg delivery: {op.averageDeliveryDays ?? "—"} days</div>
              <div>
                Capabilities:{" "}
                {[op.hasWarehousing && "Warehousing", op.hasFulfillment && "Fulfillment"]
                  .filter(Boolean)
                  .join(", ") || "—"}
              </div>
            </div>
          ) : null}
          {cr ? (
            <div className="grid gap-2 sm:grid-cols-2">
              <div>Audience: {formatNumber(cr.audienceSize)}</div>
              <div>Engagement: {(cr.engagementRate * 100).toFixed(1)}%</div>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Reviews</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {profile.reviewsReceived.length === 0 ? (
            <p className="text-sm text-muted-foreground">No reviews yet.</p>
          ) : (
            profile.reviewsReceived.map((r) => (
              <div key={r.id} className="border-b border-border pb-3 last:border-0">
                <div className="flex justify-between text-sm">
                  <span className="font-medium">{r.author.name}</span>
                  <span className="tabular-nums">{r.rating}/5</span>
                </div>
                {r.comment ? (
                  <p className="mt-1 text-sm text-muted-foreground">{r.comment}</p>
                ) : null}
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
''',
)

w(
    "src/app/(app)/deals/page.tsx",
    r'''import Link from "next/link";
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
''',
)

w(
    "src/app/(app)/deals/[id]/page.tsx",
    r'''import { requireSession } from "@/lib/auth";
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
''',
)

w(
    "src/app/(app)/proposals/page.tsx",
    r'''import { requireSession } from "@/lib/auth";
import { listProposals } from "@/services/proposal.service";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils";
import { ProposalActions } from "@/components/proposals/proposal-actions";

export const metadata = { title: "Proposals" };

export default async function ProposalsPage() {
  const session = await requireSession();
  const proposals = await listProposals(session.user.id, "all");

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Proposals</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Negotiate terms with revision history and clean acceptance flows
        </p>
      </div>
      <div className="grid gap-4">
        {proposals.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-sm text-muted-foreground">
              No proposals yet. Find a partner in the marketplace to start.
            </CardContent>
          </Card>
        ) : (
          proposals.map((p) => {
            const isRecipient = p.recipientId === session.user.id;
            return (
              <Card key={p.id}>
                <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
                  <div>
                    <CardTitle className="text-base">{p.title}</CardTitle>
                    <CardDescription>
                      {isRecipient ? `From ${p.sender.name}` : `To ${p.recipient.name}`} · rev{" "}
                      {p.revisionNumber}
                      {p.budgetMax != null
                        ? ` · up to ${formatCurrency(Number(p.budgetMax), p.currency)}`
                        : ""}
                    </CardDescription>
                  </div>
                  <Badge variant="outline">{p.status}</Badge>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="line-clamp-3 text-sm text-muted-foreground">{p.summary}</p>
                  <ProposalActions
                    proposalId={p.id}
                    status={p.status}
                    isRecipient={isRecipient}
                    isSender={p.senderId === session.user.id}
                  />
                </CardContent>
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
}
''',
)

w(
    "src/components/proposals/proposal-actions.tsx",
    r'''"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

export function ProposalActions({
  proposalId,
  status,
  isRecipient,
  isSender,
}: {
  proposalId: string;
  status: string;
  isRecipient: boolean;
  isSender: boolean;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);

  async function act(action: string) {
    setLoading(action);
    const res = await fetch(`/api/v1/proposals/${proposalId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    const json = await res.json();
    setLoading(null);
    if (!res.ok || !json.ok) {
      toast.error(json?.error?.message ?? "Action failed");
      return;
    }
    toast.success(
      action === "accept"
        ? "Proposal accepted — deal room ready"
        : `Proposal ${action}ed`,
    );
    router.refresh();
    if (action === "accept" && json.data?.deal?.id) {
      router.push(`/deals/${json.data.deal.id}`);
    }
  }

  return (
    <div className="flex flex-wrap gap-2">
      {isSender && (status === "DRAFT" || status === "COUNTERED") ? (
        <Button size="sm" disabled={loading !== null} onClick={() => act("send")}>
          {loading === "send" ? "Sending…" : "Send"}
        </Button>
      ) : null}
      {isRecipient && (status === "SENT" || status === "COUNTERED") ? (
        <>
          <Button size="sm" disabled={loading !== null} onClick={() => act("accept")}>
            {loading === "accept" ? "Accepting…" : "Accept"}
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={loading !== null}
            onClick={() => act("reject")}
          >
            Decline
          </Button>
        </>
      ) : null}
      {isSender && status !== "ACCEPTED" && status !== "WITHDRAWN" ? (
        <Button
          size="sm"
          variant="ghost"
          disabled={loading !== null}
          onClick={() => act("withdraw")}
        >
          Withdraw
        </Button>
      ) : null}
    </div>
  );
}
''',
)

w(
    "src/app/(app)/messages/page.tsx",
    r'''import { requireSession } from "@/lib/auth";
import { listConversations } from "@/services/messaging.service";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata = { title: "Messages" };

export default async function MessagesPage() {
  const session = await requireSession();
  const conversations = await listConversations(session.user.id);

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Messages</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Direct and deal-room conversations with read receipts
        </p>
      </div>
      <div className="grid gap-3">
        {conversations.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-sm text-muted-foreground">
              No conversations yet.
            </CardContent>
          </Card>
        ) : (
          conversations.map((c) => {
            const last = c.messages[0];
            return (
              <Card key={c.id}>
                <CardHeader>
                  <CardTitle className="text-base">
                    {c.title ?? (c.dealId ? "Deal conversation" : "Direct message")}
                  </CardTitle>
                  <CardDescription>
                    {last
                      ? `${last.sender.name}: ${last.body.slice(0, 120)}`
                      : "No messages yet"}
                  </CardDescription>
                </CardHeader>
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
}
''',
)

w(
    "src/app/(app)/contracts/page.tsx",
    r'''import { requireSession } from "@/lib/auth";
import { listContractsForUser } from "@/services/contract.service";
import { Badge } from "@/components/ui/badge";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata = { title: "Contracts" };

export default async function ContractsPage() {
  const session = await requireSession();
  const contracts = await listContractsForUser(session.user.id);

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Contracts</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Versioned agreements with electronic signature support
        </p>
      </div>
      <div className="grid gap-3">
        {contracts.length === 0 ? (
          <Card>
            <CardHeader>
              <CardDescription>No contracts yet. Create one from a deal room.</CardDescription>
            </CardHeader>
          </Card>
        ) : (
          contracts.map((c) => (
            <Card key={c.id}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0">
                <div>
                  <CardTitle className="text-base">{c.title}</CardTitle>
                  <CardDescription>
                    {c.deal.title} · v{c.versionNumber} · {c.signatures.filter((s) => s.signedAt).length}/
                    {c.signatures.length} signed
                  </CardDescription>
                </div>
                <Badge variant="outline">{c.status}</Badge>
              </CardHeader>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
''',
)

w(
    "src/app/(app)/payments/page.tsx",
    r'''import { requireSession } from "@/lib/auth";
import { listPaymentsForUser } from "@/services/payment.service";
import { formatCurrency } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata = { title: "Payments" };

export default async function PaymentsPage() {
  const session = await requireSession();
  const payments = await listPaymentsForUser(session.user.id);

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Payments</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Escrow funding, milestone releases, and payout history
        </p>
      </div>
      <div className="grid gap-3">
        {payments.length === 0 ? (
          <Card>
            <CardHeader>
              <CardDescription>No payment activity yet.</CardDescription>
            </CardHeader>
          </Card>
        ) : (
          payments.map((p) => (
            <Card key={p.id}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0">
                <div>
                  <CardTitle className="text-base tabular-nums">
                    {formatCurrency(Number(p.amount), p.currency)}
                  </CardTitle>
                  <CardDescription>
                    {p.escrow.deal.title} · {p.type.replaceAll("_", " ")}
                  </CardDescription>
                </div>
                <Badge variant="outline">{p.status}</Badge>
              </CardHeader>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
''',
)

w(
    "src/app/(app)/analytics/page.tsx",
    r'''import { requireSession } from "@/lib/auth";
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
''',
)

w(
    "src/app/(app)/notifications/page.tsx",
    r'''import { requireSession } from "@/lib/auth";
import { listNotifications } from "@/services/notification.service";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const metadata = { title: "Notifications" };

export default async function NotificationsPage() {
  const session = await requireSession();
  const items = await listNotifications(session.user.id);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Notifications</h1>
        <p className="mt-1 text-sm text-muted-foreground">In-app alerts for deals and proposals</p>
      </div>
      <div className="grid gap-3">
        {items.length === 0 ? (
          <Card>
            <CardHeader>
              <CardDescription>You&apos;re all caught up.</CardDescription>
            </CardHeader>
          </Card>
        ) : (
          items.map((n) => (
            <Card key={n.id}>
              <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
                <div>
                  <CardTitle className="text-sm">{n.title}</CardTitle>
                  <CardDescription>{n.body}</CardDescription>
                </div>
                {!n.readAt ? <Badge>New</Badge> : null}
              </CardHeader>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
''',
)

w(
    "src/app/(app)/settings/page.tsx",
    r'''import { requireSession } from "@/lib/auth";
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
''',
)

w(
    "src/app/(admin)/admin/layout.tsx",
    r'''import { redirect } from "next/navigation";
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
''',
)

w(
    "src/app/(admin)/admin/page.tsx",
    r'''import { requireAdminSession } from "@/lib/auth";
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
''',
)

print("pages2 done")

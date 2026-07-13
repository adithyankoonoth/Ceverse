import Link from "next/link";
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

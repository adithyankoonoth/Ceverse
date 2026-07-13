import Link from "next/link";
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

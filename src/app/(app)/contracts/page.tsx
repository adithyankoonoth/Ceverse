import { requireSession } from "@/lib/auth";
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

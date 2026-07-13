import { requireSession } from "@/lib/auth";
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

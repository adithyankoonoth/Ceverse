import { requireSession } from "@/lib/auth";
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

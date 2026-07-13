import { requireSession } from "@/lib/auth";
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

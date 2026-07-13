import { requireSession } from "@/lib/auth";
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

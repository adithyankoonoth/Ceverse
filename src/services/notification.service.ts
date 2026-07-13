import { db } from "@/lib/db";
import { sendEmail } from "@/lib/email";
import { logger } from "@/lib/logger";

export async function notifyUser(input: {
  userId: string;
  type: string;
  title: string;
  body: string;
  href?: string;
  email?: boolean;
}) {
  const notification = await db.notification.create({
    data: {
      userId: input.userId,
      type: input.type,
      title: input.title,
      body: input.body,
      href: input.href,
      channel: "IN_APP",
    },
  });

  if (input.email) {
    const user = await db.user.findUnique({ where: { id: input.userId } });
    if (user?.email) {
      try {
        await sendEmail({
          to: user.email,
          subject: input.title,
          html: `<p>${escapeHtml(input.body)}</p>${
            input.href
              ? `<p><a href="${process.env.NEXT_PUBLIC_APP_URL}${input.href}">Open in Ceverse</a></p>`
              : ""
          }`,
          text: input.body,
        });
      } catch (err) {
        logger.warn("notification_email_failed", {
          userId: input.userId,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }
  }

  return notification;
}

export async function listNotifications(userId: string, unreadOnly = false) {
  return db.notification.findMany({
    where: {
      userId,
      ...(unreadOnly ? { readAt: null } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
}

export async function markNotificationsRead(userId: string, ids?: string[]) {
  return db.notification.updateMany({
    where: {
      userId,
      readAt: null,
      ...(ids?.length ? { id: { in: ids } } : {}),
    },
    data: { readAt: new Date() },
  });
}

function escapeHtml(s: string): string {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

import { requireSession } from "@/lib/auth";
import { jsonError, jsonOk } from "@/lib/api";
import {
  listNotifications,
  markNotificationsRead,
} from "@/services/notification.service";
import { z } from "zod";

export async function GET(request: Request) {
  try {
    const session = await requireSession();
    const url = new URL(request.url);
    const unreadOnly = url.searchParams.get("unread") === "true";
    const items = await listNotifications(session.user.id, unreadOnly);
    return jsonOk(items);
  } catch (error) {
    return jsonError(error);
  }
}

export async function PATCH(request: Request) {
  try {
    const session = await requireSession();
    const body = z
      .object({ ids: z.array(z.string().cuid()).optional() })
      .parse(await request.json().catch(() => ({})));
    const result = await markNotificationsRead(session.user.id, body.ids);
    return jsonOk(result);
  } catch (error) {
    return jsonError(error);
  }
}

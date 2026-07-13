import { requireSession } from "@/lib/auth";
import { jsonCreated, jsonError, jsonOk } from "@/lib/api";
import { sendMessageSchema } from "@/validation/message";
import {
  listConversations,
  listMessages,
  sendMessage,
} from "@/services/messaging.service";
import { assertPermission } from "@/lib/rbac";
import { rateLimit } from "@/lib/redis";
import { RateLimitError } from "@/domain/errors";

export async function GET(request: Request) {
  try {
    const session = await requireSession();
    const url = new URL(request.url);
    const conversationId = url.searchParams.get("conversationId");
    if (conversationId) {
      const cursor = url.searchParams.get("cursor") ?? undefined;
      return jsonOk(await listMessages(session.user.id, conversationId, cursor));
    }
    return jsonOk(await listConversations(session.user.id));
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(request: Request) {
  try {
    const session = await requireSession();
    assertPermission(session.user.role, "message:send");
    const rl = await rateLimit(`msg:${session.user.id}`, 60, 60);
    if (!rl.allowed) throw new RateLimitError();
    const body = sendMessageSchema.parse(await request.json());
    const message = await sendMessage(session.user.id, body);
    return jsonCreated(message);
  } catch (error) {
    return jsonError(error);
  }
}

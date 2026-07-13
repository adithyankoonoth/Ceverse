import { requireSession } from "@/lib/auth";
import { jsonCreated, jsonError, jsonOk } from "@/lib/api";
import { assertPermission } from "@/lib/rbac";
import { createProposalSchema } from "@/validation/proposal";
import { createProposal, listProposals } from "@/services/proposal.service";
import { rateLimit } from "@/lib/redis";
import { RateLimitError } from "@/domain/errors";
import { headers } from "next/headers";

export async function GET(request: Request) {
  try {
    const session = await requireSession();
    const url = new URL(request.url);
    const folder = (url.searchParams.get("folder") as "inbox" | "sent" | "all") || "all";
    const items = await listProposals(session.user.id, folder);
    return jsonOk(items);
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(request: Request) {
  try {
    const session = await requireSession();
    assertPermission(session.user.role, "proposal:create");

    const rl = await rateLimit(`proposal:create:${session.user.id}`, 20, 60);
    if (!rl.allowed) throw new RateLimitError();

    const body = createProposalSchema.parse(await request.json());
    const h = await headers();
    const proposal = await createProposal(session.user.id, body, {
      requestId: h.get("x-request-id") ?? undefined,
      ip: h.get("x-forwarded-for") ?? undefined,
    });
    return jsonCreated(proposal);
  } catch (error) {
    return jsonError(error);
  }
}

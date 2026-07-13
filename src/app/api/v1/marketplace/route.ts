import { headers } from "next/headers";
import { requireSession } from "@/lib/auth";
import { jsonError, jsonOk } from "@/lib/api";
import { rateLimit } from "@/lib/redis";
import { RateLimitError } from "@/domain/errors";
import { marketplaceSearchSchema } from "@/validation/marketplace";
import { searchMarketplace } from "@/services/marketplace.service";
import { assertPermission } from "@/lib/rbac";

export async function GET(request: Request) {
  try {
    const session = await requireSession();
    assertPermission(session.user.role, "marketplace:browse");

    const h = await headers();
    const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
    const rl = await rateLimit(`marketplace:${session.user.id}:${ip}`, 120, 60);
    if (!rl.allowed) throw new RateLimitError(Math.ceil((rl.resetAt - Date.now()) / 1000));

    const url = new URL(request.url);
    const raw = Object.fromEntries(url.searchParams.entries());
    const input = marketplaceSearchSchema.parse(raw);
    const result = await searchMarketplace(input, {
      id: session.user.id,
      role: session.user.role,
      trustScore: session.user.trustScore,
    });
    return jsonOk(result);
  } catch (error) {
    return jsonError(error);
  }
}

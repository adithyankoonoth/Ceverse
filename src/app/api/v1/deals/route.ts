import { requireSession } from "@/lib/auth";
import { jsonError, jsonOk } from "@/lib/api";
import { listDeals } from "@/services/deal.service";
import { assertPermission } from "@/lib/rbac";

export async function GET() {
  try {
    const session = await requireSession();
    assertPermission(session.user.role, "deal:read");
    const deals = await listDeals(session.user.id);
    return jsonOk(deals);
  } catch (error) {
    return jsonError(error);
  }
}

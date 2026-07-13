import { requireSession } from "@/lib/auth";
import { jsonError, jsonOk } from "@/lib/api";
import { getDeal, updateDeal } from "@/services/deal.service";
import { updateDealSchema } from "@/validation/deal";
import { assertPermission } from "@/lib/rbac";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const session = await requireSession();
    assertPermission(session.user.role, "deal:read");
    const { id } = await context.params;
    const deal = await getDeal(id, session.user.id);
    return jsonOk(deal);
  } catch (error) {
    return jsonError(error);
  }
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const session = await requireSession();
    assertPermission(session.user.role, "deal:write");
    const { id } = await context.params;
    const body = updateDealSchema.parse(await request.json());
    const deal = await updateDeal(id, session.user.id, body);
    return jsonOk(deal);
  } catch (error) {
    return jsonError(error);
  }
}

import { requireSession } from "@/lib/auth";
import { jsonError, jsonOk } from "@/lib/api";
import { matchOperatorsForCreator, scorePair } from "@/services/matching.service";
import { z } from "zod";

const bodySchema = z.object({
  operatorUserId: z.string().uuid().optional(),
  productCategory: z.string().max(80).optional(),
  budget: z.number().min(0).optional(),
  limit: z.number().int().min(1).max(50).optional(),
});

export async function POST(request: Request) {
  try {
    const session = await requireSession();
    const body = bodySchema.parse(await request.json());

    if (body.operatorUserId) {
      // Creator scores against operator; operators score incoming creator id as first arg.
      if (session.user.role === "CREATOR") {
        return jsonOk(await scorePair(session.user.id, body.operatorUserId));
      }
      return jsonOk(await scorePair(body.operatorUserId, session.user.id));
    }

    const ranked = await matchOperatorsForCreator(session.user.id, {
      productCategory: body.productCategory,
      budget: body.budget,
      limit: body.limit,
    });
    return jsonOk(ranked);
  } catch (error) {
    return jsonError(error);
  }
}

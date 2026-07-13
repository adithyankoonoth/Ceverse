import { requireSession } from "@/lib/auth";
import { jsonError, jsonOk } from "@/lib/api";
import { proposalActionSchema, counterProposalSchema } from "@/validation/proposal";
import {
  acceptProposal,
  counterProposal,
  getProposal,
  rejectProposal,
  sendProposal,
  withdrawProposal,
} from "@/services/proposal.service";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const session = await requireSession();
    const { id } = await context.params;
    const proposal = await getProposal(session.user.id, id);
    return jsonOk(proposal);
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
    const { id } = await context.params;
    const body = await request.json();

    if (body?.action) {
      const { action } = proposalActionSchema.parse(body);
      if (action === "send") return jsonOk(await sendProposal(session.user.id, id));
      if (action === "accept") return jsonOk(await acceptProposal(session.user.id, id));
      if (action === "reject") return jsonOk(await rejectProposal(session.user.id, id));
      if (action === "withdraw") return jsonOk(await withdrawProposal(session.user.id, id));
    }

    const counter = counterProposalSchema.parse(body);
    const result = await counterProposal(session.user.id, id, counter);
    return jsonOk(result);
  } catch (error) {
    return jsonError(error);
  }
}

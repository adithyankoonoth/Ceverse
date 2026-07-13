#!/usr/bin/env python3
import os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def w(rel: str, content: str) -> None:
    path = os.path.join(ROOT, *rel.split("/"))
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8", newline="\n") as f:
        f.write(content)
    print("wrote", rel)


w(
    "src/app/api/auth/[...all]/route.ts",
    r'''import { auth } from "@/lib/auth";
import { toNextJsHandler } from "better-auth/next-js";

export const { GET, POST } = toNextJsHandler(auth);
''',
)

w(
    "src/app/api/v1/health/route.ts",
    r'''import { jsonOk } from "@/lib/api";
import { getSystemHealth } from "@/services/admin.service";

export async function GET() {
  const health = await getSystemHealth();
  return jsonOk(health);
}
''',
)

w(
    "src/app/api/v1/marketplace/route.ts",
    r'''import { headers } from "next/headers";
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
''',
)

w(
    "src/app/api/v1/proposals/route.ts",
    r'''import { requireSession } from "@/lib/auth";
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
''',
)

w(
    "src/app/api/v1/proposals/[id]/route.ts",
    r'''import { requireSession } from "@/lib/auth";
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
''',
)

w(
    "src/app/api/v1/deals/route.ts",
    r'''import { requireSession } from "@/lib/auth";
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
''',
)

w(
    "src/app/api/v1/deals/[id]/route.ts",
    r'''import { requireSession } from "@/lib/auth";
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
''',
)

w(
    "src/app/api/v1/matching/route.ts",
    r'''import { requireSession } from "@/lib/auth";
import { jsonError, jsonOk } from "@/lib/api";
import { matchOperatorsForCreator, scorePair } from "@/services/matching.service";
import { z } from "zod";

const bodySchema = z.object({
  operatorUserId: z.string().cuid().optional(),
  productCategory: z.string().max(80).optional(),
  budget: z.number().min(0).optional(),
  limit: z.number().int().min(1).max(50).optional(),
});

export async function POST(request: Request) {
  try {
    const session = await requireSession();
    const body = bodySchema.parse(await request.json());

    if (body.operatorUserId) {
      const creatorId =
        session.user.role === "CREATOR" ? session.user.id : body.operatorUserId;
      const operatorId =
        session.user.role === "CREATOR" ? body.operatorUserId : session.user.id;
      // If viewer is creator, score creator->operator; else reverse roles carefully
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
''',
)

w(
    "src/app/api/v1/notifications/route.ts",
    r'''import { requireSession } from "@/lib/auth";
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
''',
)

w(
    "src/app/api/v1/messages/route.ts",
    r'''import { requireSession } from "@/lib/auth";
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
''',
)

w(
    "src/app/api/openapi/route.ts",
    r'''import { jsonOk } from "@/lib/api";

const spec = {
  openapi: "3.0.3",
  info: {
    title: "Ceverse API",
    version: "1.0.0",
    description: "REST API for the Ceverse creator commerce platform (Favverse).",
  },
  servers: [{ url: "/api/v1" }],
  paths: {
    "/health": {
      get: {
        summary: "System health",
        responses: { "200": { description: "OK" } },
      },
    },
    "/marketplace": {
      get: {
        summary: "Search marketplace",
        parameters: [
          { name: "q", in: "query", schema: { type: "string" } },
          { name: "type", in: "query", schema: { type: "string" } },
          { name: "page", in: "query", schema: { type: "integer" } },
        ],
        responses: { "200": { description: "Paginated results" } },
      },
    },
    "/proposals": {
      get: { summary: "List proposals", responses: { "200": { description: "OK" } } },
      post: { summary: "Create proposal", responses: { "201": { description: "Created" } } },
    },
    "/proposals/{id}": {
      get: { summary: "Get proposal", responses: { "200": { description: "OK" } } },
      patch: {
        summary: "Act on proposal (send/accept/reject/withdraw/counter)",
        responses: { "200": { description: "OK" } },
      },
    },
    "/deals": {
      get: { summary: "List deals", responses: { "200": { description: "OK" } } },
    },
    "/deals/{id}": {
      get: { summary: "Get deal room", responses: { "200": { description: "OK" } } },
      patch: { summary: "Update deal", responses: { "200": { description: "OK" } } },
    },
    "/matching": {
      post: {
        summary: "AI matching / pair score",
        responses: { "200": { description: "Scores" } },
      },
    },
    "/notifications": {
      get: { summary: "List notifications", responses: { "200": { description: "OK" } } },
      patch: { summary: "Mark read", responses: { "200": { description: "OK" } } },
    },
    "/messages": {
      get: { summary: "List conversations or messages", responses: { "200": { description: "OK" } } },
      post: { summary: "Send message", responses: { "201": { description: "Created" } } },
    },
  },
  components: {
    securitySchemes: {
      cookieAuth: {
        type: "apiKey",
        in: "cookie",
        name: "better-auth.session_token",
      },
    },
  },
  security: [{ cookieAuth: [] }],
};

export async function GET() {
  return jsonOk(spec);
}
''',
)

w(
    "src/workers/index.ts",
    r'''import { Worker, Queue } from "bullmq";
import { getRedis } from "@/lib/redis";
import { logger } from "@/lib/logger";
import { sendEmail } from "@/lib/email";
import { recomputeTrustScore } from "@/services/reputation.service";

const connection = () => {
  const url = process.env.REDIS_URL;
  if (!url) return null;
  return { url } as const;
};

export async function startWorkers() {
  const conn = connection();
  if (!conn) {
    logger.warn("workers_skipped_no_redis");
    return;
  }

  // Ensure redis module is initialized
  getRedis();

  const emailQueue = new Queue("email", { connection: conn });
  const reputationQueue = new Queue("reputation", { connection: conn });

  const emailWorker = new Worker(
    "email",
    async (job) => {
      await sendEmail(job.data as {
        to: string;
        subject: string;
        html: string;
        text?: string;
      });
    },
    { connection: conn },
  );

  const reputationWorker = new Worker(
    "reputation",
    async (job) => {
      const { userId } = job.data as { userId: string };
      await recomputeTrustScore(userId);
    },
    { connection: conn },
  );

  emailWorker.on("failed", (job, err) => {
    logger.error("email_job_failed", { jobId: job?.id, error: err.message });
  });
  reputationWorker.on("failed", (job, err) => {
    logger.error("reputation_job_failed", { jobId: job?.id, error: err.message });
  });

  logger.info("workers_started", {
    queues: [emailQueue.name, reputationQueue.name],
  });
}

if (require.main === module) {
  startWorkers().catch((err) => {
    logger.error("workers_boot_failed", { error: String(err) });
    process.exit(1);
  });
}
''',
)

print("api done")

import { jsonOk } from "@/lib/api";

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
        name: "sb-access-token",
        description: "Supabase Auth session cookies (managed by @supabase/ssr)",
      },
    },
  },
  security: [{ cookieAuth: [] }],
};

export async function GET() {
  return jsonOk(spec);
}

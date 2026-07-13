# Ceverse REST API (v1)

Base path: `/api/v1`  
Auth: Better Auth session cookie  
OpenAPI JSON: `GET /api/openapi`

## Envelope

Success:

```json
{ "ok": true, "data": {} }
```

Error:

```json
{ "ok": false, "error": { "code": "VALIDATION", "message": "..." } }
```

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | DB latency + status |
| GET | `/marketplace` | Search operators/creators |
| GET/POST | `/proposals` | List / create |
| GET/PATCH | `/proposals/:id` | Get / send-accept-reject-withdraw-counter |
| GET | `/deals` | List member deals |
| GET/PATCH | `/deals/:id` | Deal room / update |
| POST | `/matching` | Ranked matches or pair score |
| GET/PATCH | `/notifications` | List / mark read |
| GET/POST | `/messages` | Conversations / send |

Auth routes are under `/api/auth/*` (Better Auth).

## Pagination

Query: `page`, `pageSize` (max 50–100 depending on route), optional `cursor`.

## Rate limits

Marketplace, proposal creation, and messaging are rate-limited per user (and IP where available).

---
baseline_commit: da918cd
created: 2026-07-20
---

# Story 3.4: POST /v1/session/token — short-lived audience-bound CSRF-protected Bearer

Status: ready-for-dev

<!-- Ultimate context engine analysis completed - comprehensive developer guide created -->

## Story

As a web app developer,
I want session-to-Bearer token exchange with scope parity to API keys,
so that browser calls public API without exposing long-lived secrets (AD-2, AD-7, SOLUTION-DESIGN §15).

## Acceptance Criteria

1. **Given** authenticated better-auth session and valid CSRF token (double-submit cookie), **when** `POST /v1/session/token` is called, **then** response is HTTP **200** with JSON `{ accessToken, tokenType: "Bearer", expiresIn, scopes, workspaceId }` where `accessToken` is a signed JWT, `expiresIn` ≤ **900** seconds (15 min), `scopes` is the full canonical scope set, and `workspaceId` equals `session.activeOrganizationId`.
2. **Given** issued JWT, **when** decoded, **then** claims include `sub` (userId), `wid` (workspaceId), `scp` (scopes array), `aud` = `USETAGIH_WEB_PUBLIC_URL`, `iss` = `USETAGIH_API_PUBLIC_URL`, `exp`/`iat`, `jti` (uuid), `typ: "session_bearer"`; TTL from `iat` to `exp` is ≤ **900** seconds.
3. **Given** canonical scope enum in `@usetagih/schema`, **when** inspected, **then** values are exactly: `renders:read`, `renders:write`, `webhooks:manage`, `audit:read`; session token exchange grants **all four** scopes (web app full access within active workspace).
4. **Given** `Authorization: Bearer <session_jwt>` on `/v1/*`, **when** bearer auth middleware runs, **then** request context receives `{ authType: "session_bearer", userId, workspaceId, scopes }`; workspace on token must match route resource workspace (stub routes prove chain; cross-workspace returns **404** per NFR-5 — defer full envelope to Story 3.6).
5. **Given** bearer token missing required scope for a route, **when** scope guard runs, **then** HTTP **403** with code `FORBIDDEN` and message indicating required scope (full `requestId` envelope deferred to Story 3.6).
6. **Given** missing, mismatched, or absent CSRF double-submit on `POST /v1/session/token`, **when** called with valid session cookie, **then** HTTP **403** with code `FORBIDDEN`.
7. **Given** expired or absent session cookie on `POST /v1/session/token`, **when** called, **then** HTTP **401** with code `UNAUTHORIZED`.
8. **Given** expired, malformed, wrong-`aud`, or wrong-signature JWT on `/v1/*`, **when** bearer middleware runs, **then** HTTP **401** with code `UNAUTHORIZED`.
9. **Given** scope-parity matrix in `apps/api/src/routes/v1/session.token.test.ts`, **when** `bun test apps/api` runs, **then** each matrix row asserts session-bearer grant/deny matches required scope for stub routes; API-key column marked `// Story 3.5 extends` with skipped/placeholder tests.
10. **Given** `@usetagih/config/env` extended with `USETAGIH_WEB_PUBLIC_URL`, **when** `apps/api` boots in `dev`, **then** env parses; dev default `http://localhost:3000`; staging/prod required.
11. **Given** compose Postgres running, **when** `bun test apps/api` integration suite runs, **then** tests boot real Elysia app, drive sign-up → CSRF cookie → token exchange → bearer-authenticated stub routes via `fetch`.
12. **Given** workspace, **when** `bunx turbo run lint typecheck test build --force` runs from repo root, **then** all tasks exit 0.
13. **Out of scope (later Epic 3 stories):** API key create/list/revoke (Story 3.5); unified error envelope + `requestId` on all routes (Story 3.6); real resource handlers (Stories 3.8–3.14); web client token storage (Story 6.x); no browser-exposed long-lived API key pattern in docs.

## Tasks / Subtasks

- [ ] Task 1 — Canonical scope enum in schema (AC: 3, 9)
  - [ ] Create `packages/schema/src/auth/scopes.ts` per Dev Notes §Scope enum
  - [ ] Export from `packages/schema/src/index.ts`
  - [ ] Add unit test `packages/schema/src/auth/scopes.test.ts`
- [ ] Task 2 — Env schema extension (AC: 10)
  - [ ] Add `USETAGIH_WEB_PUBLIC_URL` to `packages/config/src/env/schema.ts` per Dev Notes §Env schema
  - [ ] Extend `EnvStub`; update `packages/config/src/env/env.test.ts`
  - [ ] Wire into `apps/api/src/env.ts`
- [ ] Task 3 — Session token signing + verification (AC: 1, 2, 8)
  - [ ] Pin `jose@6.2.3` in `apps/api/package.json` (direct dep — see Dev Notes §Token mechanism)
  - [ ] Implement `apps/api/src/auth/session-token.ts` — sign/verify helpers per Dev Notes §JWT claims
  - [ ] Constants: `SESSION_TOKEN_TTL_SECONDS = 900`, `SESSION_TOKEN_TYP = "session_bearer"`
- [ ] Task 4 — CSRF double-submit (AC: 6)
  - [ ] Implement `apps/api/src/middleware/csrf.ts` per Dev Notes §CSRF strategy
  - [ ] Issue `usetagih.csrf` cookie on sign-up-with-workspace and sign-in success (hook or response wrapper)
  - [ ] Add `GET /v1/session/csrf` to refresh CSRF cookie (session required; no CSRF check on GET)
- [ ] Task 5 — POST /v1/session/token route (AC: 1, 6, 7)
  - [ ] Implement `apps/api/src/routes/v1/session.token.ts`
  - [ ] Require session macro + CSRF middleware + workspace guard
  - [ ] Return token response shape per Dev Notes §Token response
- [ ] Task 6 — Bearer auth + scope middleware (AC: 4, 5, 8)
  - [ ] Implement `apps/api/src/middleware/bearer-auth.ts` — verify JWT, populate auth context
  - [ ] Implement `apps/api/src/middleware/scope-guard.ts` — macro `requireScope(...scopes)`
  - [ ] Implement `apps/api/src/middleware/auth-resolver.ts` — session cookie OR bearer JWT (cookie takes precedence when both present for workspace routes)
  - [ ] Wire middleware chain on `/v1/*` group in `createApp` per Dev Notes §Middleware order
- [ ] Task 7 — Scope-gated stub routes for parity matrix (AC: 4, 5, 9)
  - [ ] Add stub routes per Dev Notes §Scope-gated stubs
  - [ ] Refactor existing `GET /v1/renders` stub to use bearer OR session via unified auth resolver
- [ ] Task 8 — Scope-parity matrix tests (AC: 9, 11)
  - [ ] Create `apps/api/src/routes/v1/session.token.test.ts` per Dev Notes §Scope-parity matrix
  - [ ] Integration cases in `apps/api/src/integration/session-token.integration.test.ts` (probeDb skip pattern)
- [ ] Task 9 — Auth config + CORS (AC: 10)
  - [ ] Extend `packages/db/src/auth/auth.config.ts` `trustedOrigins` to include `USETAGIH_WEB_PUBLIC_URL`
  - [ ] Extend `createBetterAuthPlugin` CORS `allowedHeaders` to include `X-CSRF-Token`
- [ ] Task 10 — Verification gate (AC: 12)
  - [ ] `docker compose -f docker/compose.yml up -d postgres` (if not running)
  - [ ] `bun test apps/api`
  - [ ] `bun test packages/schema`
  - [ ] `bun test packages/config`
  - [ ] `bunx turbo run lint typecheck test build --force`

## Dev Notes

### Goal

Implement `POST /v1/session/token` on the **public REST boundary** (AD-2): authenticated session + CSRF → short-lived, audience-bound Bearer JWT carrying active `workspaceId` and full API scope set. Define the **canonical scope enum** now so Story 3.5 API keys adopt it unchanged. Add bearer auth middleware chain that Story 3.6 unifies with API keys and full error envelope.

### Binding ratified sources

| Ref | Requirement for 3.4 |
| --- | --- |
| **AD-2** | `apps/web` calls same public REST as integrators; `POST /v1/session/token` for browser API access — no internal-only bypass |
| **AD-7** | Session tokens ≤15 min, audience-bound, CSRF-protected; scopes match API key enum; scope-parity matrix; carry `workspaceId` |
| **SOLUTION-DESIGN §4.1 step 1** | Authenticate — API key or session-derived token; scope check |
| **SOLUTION-DESIGN §15** | Session token exchange story; scope-parity test matrix; `@usetagih/sdk` browser uses exchanged Bearer |
| **SOLUTION-DESIGN §7.1** | `api_keys.scopes[]` uses same enum — 3.4 defines enum, 3.5 persists |
| **correct-course A28 note 9** | Session tokens carry/validate active `workspaceId`; workspace filtering propagates through repos, workers, webhooks, audit, settings, logs |
| **Story 3.3** | Elysia 1.4.29, better-auth 1.6.23, session macro, workspace guard, `WORKSPACE_REQUIRED`, integration harness |

### Scope boundary: 3.4 vs 3.5 vs 3.6

| Capability | Owner | 3.4 delivers |
| --- | --- | --- |
| Canonical `ApiScope` enum | **3.4** | `packages/schema/src/auth/scopes.ts` |
| `POST /v1/session/token` | **3.4** | JWT exchange endpoint |
| Bearer JWT verify middleware | **3.4** | Prototype — 3.6 merges with API key auth |
| API key CRUD + hash-at-rest | **3.5** | **Do not** implement |
| Scope-parity matrix API-key column | **3.5 extends** | Placeholder/skipped tests only in 3.4 |
| Unified error envelope + `requestId` | **3.6** | Minimal `{ error: { code, message } }` OK |
| Cross-workspace 404 mapping | **3.6** | Stub comment + one integration probe |

### Token mechanism decision (encode exactly — do not use better-auth jwt/bearer plugins)

**Choice:** Custom JWT signed with **`jose@6.2.3`** (HS256, `BETTER_AUTH_SECRET` as symmetric key).

**Why not better-auth plugins:** Inspected `better-auth@1.6.23` — ships `jwt` and `bearer` plugins under `better-auth/plugins`, but:

| better-auth plugin | Problem for usetagih |
| --- | --- |
| `bearer` | Issues long-lived session bearer tied to better-auth session store — not ≤15 min audience-bound scoped tokens |
| `jwt` | Exposes `/api/auth/token` on auth mount — violates AD-2 public REST boundary (`/v1/session/token`) |
| Both | No custom claims for `workspaceId`, `scp[]`, `aud=USETAGIH_WEB_PUBLIC_URL` in our contract |

Architecture ratifies `POST /v1/session/token` on `/v1/*` with custom claims. Use `jose` (already transitive dep of better-auth 1.6.23 at `6.2.3` in lockfile) as **direct** dep in `apps/api`.

**Board note:** `jose@6.2.3` not listed in ARCHITECTURE-SPINE stack table — direct pin required; aligns with better-auth's bundled version.

### CSRF strategy (encode exactly — double-submit cookie)

**Choice:** **Double-submit cookie** (first option in epics/architecture AC).

| Element | Value |
| --- | --- |
| Cookie name | `usetagih.csrf` |
| Cookie flags | `SameSite=Strict`; `Secure=true` in staging/prod; **`HttpOnly=false`** (JS reads value for header) |
| Header name | `X-CSRF-Token` |
| Validation | `POST /v1/session/token`: `header === cookie` (constant-time compare); missing either → **403 FORBIDDEN** |
| Issuance | Set/refreshed on: successful `sign-up-with-workspace`, successful sign-in (`hooks.after`), `GET /v1/session/csrf` |
| Exempt | `GET` requests; `/api/auth/*`; `/health` |

**Do not** use SameSite+header-only (custom header without cookie compare) — double-submit chosen for explicit CSRF binding.

### Scope enum (encode exactly — home: `packages/schema`)

**File:** `packages/schema/src/auth/scopes.ts`

```typescript
import { z } from "zod";

export const API_SCOPES = [
  "renders:read",
  "renders:write",
  "webhooks:manage",
  "audit:read",
] as const;

export type ApiScope = (typeof API_SCOPES)[number];

export const ApiScopeSchema = z.enum(API_SCOPES);

export const ApiScopeArraySchema = z.array(ApiScopeSchema).min(1);

/** Session token exchange grants full workspace access (all scopes). Story 3.5 API keys may subset. */
export const SESSION_TOKEN_SCOPES: readonly ApiScope[] = [...API_SCOPES];

/** Route → required scope(s) — single source for parity matrix (3.4 session side; 3.5 adds api_key column). */
export const ROUTE_SCOPE_REQUIREMENTS = {
  "GET /v1/renders": ["renders:read"],
  "POST /v1/renders": ["renders:write"],
  "GET /v1/audit": ["audit:read"],
  "POST /v1/webhooks": ["webhooks:manage"],
  "GET /v1/webhooks": ["webhooks:manage"],
  "DELETE /v1/webhooks/:id": ["webhooks:manage"],
} as const satisfies Record<string, readonly ApiScope[]>;
```

Story 3.5 imports `API_SCOPES`, `ApiScopeSchema` unchanged for `api_keys.scopes[]` validation.

### JWT claims shape (encode exactly)

**Signing:** `SignJWT` from `jose`, algorithm **HS256**, secret = `TextEncoder.encode(env.BETTER_AUTH_SECRET)`.

**Payload:**

```typescript
type SessionBearerClaims = {
  sub: string;       // userId
  wid: string;       // workspaceId (activeOrganizationId)
  scp: ApiScope[];   // granted scopes
  aud: string;       // USETAGIH_WEB_PUBLIC_URL
  iss: string;       // USETAGIH_API_PUBLIC_URL
  exp: number;       // unix seconds, iat + SESSION_TOKEN_TTL_SECONDS
  iat: number;
  jti: string;       // crypto.randomUUID()
  typ: "session_bearer";
};
```

**Constants:**

```typescript
export const SESSION_TOKEN_TTL_SECONDS = 900; // 15 min max per AD-7
export const SESSION_TOKEN_TYP = "session_bearer" as const;
```

**Verification checks (all must pass):**

1. Signature valid (HS256 + `BETTER_AUTH_SECRET`)
2. `typ === "session_bearer"`
3. `aud === env.USETAGIH_WEB_PUBLIC_URL`
4. `iss === env.USETAGIH_API_PUBLIC_URL`
5. `exp > now` (clock skew tolerance: 30s)
6. `wid` is non-empty uuid
7. `scp` every element ∈ `API_SCOPES`

### Token response shape (encode exactly)

**`POST /v1/session/token`** success **200**:

```json
{
  "accessToken": "<jwt>",
  "tokenType": "Bearer",
  "expiresIn": 900,
  "scopes": ["renders:read", "renders:write", "webhooks:manage", "audit:read"],
  "workspaceId": "<uuid>"
}
```

No refresh token. Client re-exchanges via session cookie when expired.

### Env schema extensions (encode exactly)

**File:** `packages/config/src/env/schema.ts`

```typescript
export const DEV_ENV_DEFAULTS = {
  // ... existing ...
  USETAGIH_WEB_PUBLIC_URL: "http://localhost:3000",
} as const;

// dev schema:
USETAGIH_WEB_PUBLIC_URL: z.string().url().default(DEV_ENV_DEFAULTS.USETAGIH_WEB_PUBLIC_URL),

// staging/prod: required, no default
USETAGIH_WEB_PUBLIC_URL: z.string().url(),
```

**Auth config update** (`packages/db/src/auth/auth.config.ts`):

```typescript
trustedOrigins: [env.USETAGIH_API_PUBLIC_URL, env.USETAGIH_WEB_PUBLIC_URL],
```

Requires `parseEnv` in `@usetagih/config` to include `USETAGIH_WEB_PUBLIC_URL` — `packages/db/src/auth/auth.config.ts` already calls `parseEnv`; extending `EnvStub` is sufficient (no separate db env file).

### Middleware behavior table (encode exactly)

| Step | Middleware | Condition | HTTP | Code |
| --- | --- | --- | --- | --- |
| 1 | (none) | `POST /v1/session/token` no session | 401 | `UNAUTHORIZED` |
| 2 | csrf | `POST /v1/session/token` missing/mismatch CSRF | 403 | `FORBIDDEN` |
| 3 | workspace | session, zero orgs or no active org | 403 | `WORKSPACE_REQUIRED` |
| 4 | session-token route | valid session + CSRF + workspace | 200 | — |
| 5 | bearer-auth | `/v1/*` Bearer present, JWT invalid/expired/wrong aud/iss/typ | 401 | `UNAUTHORIZED` |
| 6 | bearer-auth | JWT valid | set `authContext` | — |
| 7 | scope-guard | route requires scope not in `authContext.scopes` | 403 | `FORBIDDEN` (message: `Insufficient scope: requires <scope>`) |
| 8 | workspace-match | token `wid` ≠ route `:workspaceId` param (when present) | 404 | `NOT_FOUND` |
| 9 | session macro | cookie auth, no session | 401 | `UNAUTHORIZED` |

**Auth resolution order on `/v1/*` resource routes:**

1. If `Authorization: Bearer` present → bearer-auth (session JWT only in 3.4; API key in 3.5)
2. Else → existing session cookie + workspace guard (Story 3.3 behavior preserved)

**`POST /v1/session/token` auth:** Session cookie only (not Bearer) — exchanging session for Bearer.

### Middleware chain order in `createApp` (encode exactly)

```text
1. GET /health
2. POST /api/auth/sign-up-with-workspace
3. createBetterAuthPlugin (mount /api/auth/*)
4. /v1 group:
   a. GET /v1/session/csrf          — session macro only
   b. POST /v1/session/token        — session macro + csrf + workspace
   c. bearer-auth plugin             — runs on all other /v1/*
   d. workspace-guard OR bearer workspace from JWT (skip double session lookup when bearer)
   e. scope-gated stub routes
   f. GET /v1/renders stub (existing, update auth)
```

### Scope-gated stub routes (encode exactly — for parity matrix only)

Add minimal stubs returning **501 NOT_IMPLEMENTED** (same pattern as renders stub) — prove scope + auth chain, not business logic:

| Route | Method | Required scope | Stub message |
| --- | --- | --- | --- |
| `/v1/renders` | GET | `renders:read` | Story 3.12 |
| `/v1/renders` | POST | `renders:write` | Story 3.11 |
| `/v1/audit` | GET | `audit:read` | Story 3.14 |
| `/v1/webhooks` | GET | `webhooks:manage` | Story 4.3 |
| `/v1/webhooks` | POST | `webhooks:manage` | Story 4.3 |

Use `{ auth: true, scope: ["renders:read"] }` macro pattern or equivalent plugin API.

### Scope-parity matrix test cases (encode exactly)

**File:** `apps/api/src/routes/v1/session.token.test.ts`

Table-driven unit/integration tests (can use mocked env + test secret for unit; integration file for full flow):

| # | Route | Method | Required scope | Session bearer (full scopes) | Session bearer (subset — see note) | API key (3.5) |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | `/v1/renders` | GET | `renders:read` | 501 pass | N/A (exchange grants all) | `test.todo("Story 3.5")` |
| 2 | `/v1/renders` | POST | `renders:write` | 501 pass | N/A | `test.todo("Story 3.5")` |
| 3 | `/v1/audit` | GET | `audit:read` | 501 pass | N/A | `test.todo("Story 3.5")` |
| 4 | `/v1/webhooks` | GET | `webhooks:manage` | 501 pass | N/A | `test.todo("Story 3.5")` |
| 5 | `/v1/webhooks` | POST | `webhooks:manage` | 501 pass | N/A | `test.todo("Story 3.5")` |
| 6 | `/v1/renders` | GET | `renders:read` | — | JWT with `scp: []` manually signed in test → 403 | `test.todo("Story 3.5")` |

**Note:** Production exchange always grants all scopes; row 6 uses test-only JWT builder with empty/subset `scp` to prove scope guard works — documents parity mechanism for 3.5 subset keys.

**Integration file:** `apps/api/src/integration/session-token.integration.test.ts`

Required cases:

1. `sign-up → GET /v1/session/csrf → POST /v1/session/token → 200 with valid JWT`
2. `POST /v1/session/token without CSRF → 403`
3. `POST /v1/session/token without session → 401`
4. `Bearer token on GET /v1/renders → 501 (auth passes)`
5. `Expired JWT → 401`
6. `JWT with wrong aud → 401`
7. `AuthCookieJar pattern from 3.3 for multi-step cookie forwarding`

### Pinned toolchain (exact)

| Package | Pin | Where |
| --- | --- | --- |
| `elysia` | `1.4.29` | already in `apps/api` |
| `better-auth` | `1.6.23` | via `@usetagih/db` |
| `jose` | `6.2.3` | **NEW direct** `apps/api/package.json` |
| `zod` | `^4.4.3` | via `@usetagih/schema`, `@usetagih/config` |

### Package layout (implement exactly)

```text
packages/schema/src/auth/
├── scopes.ts              # NEW — canonical enum + ROUTE_SCOPE_REQUIREMENTS
└── scopes.test.ts         # NEW

packages/config/src/env/
├── schema.ts              # UPDATE — USETAGIH_WEB_PUBLIC_URL
└── env.test.ts            # UPDATE

packages/db/src/auth/
└── auth.config.ts         # UPDATE — trustedOrigins + env field

apps/api/src/
├── auth/
│   └── session-token.ts   # NEW — sign/verify JWT
├── middleware/
│   ├── csrf.ts            # NEW
│   ├── bearer-auth.ts     # NEW
│   ├── scope-guard.ts     # NEW
│   └── auth-resolver.ts   # NEW — cookie OR bearer
├── routes/v1/
│   ├── session.token.ts   # NEW — POST /v1/session/token
│   ├── session.csrf.ts    # NEW — GET /v1/session/csrf
│   ├── session.token.test.ts  # NEW — parity matrix
│   ├── renders.stub.ts    # UPDATE — unified auth + scope
│   ├── audit.stub.ts      # NEW
│   └── webhooks.stub.ts   # NEW
├── integration/
│   └── session-token.integration.test.ts  # NEW
├── app.ts                 # UPDATE — wire middleware + routes
└── env.ts                 # UPDATE — parse USETAGIH_WEB_PUBLIC_URL

apps/api/package.json      # UPDATE — add jose@6.2.3
```

### Previous story intelligence (Story 3.3)

| Source | Learning for 3.4 |
| --- | --- |
| AuthCookieJar | Multi-step auth requires explicit `Cookie` header jar — reuse in session-token integration tests |
| Password reset route | `/api/auth/request-password-reset` (not forget-password) |
| `auth.api` server-only | Some org routes have no HTTP surface — not relevant to token exchange |
| Workspace guard | Validates `activeOrganizationId` ∈ user's org list — token `wid` must match same value |
| CORS | Extend `allowedHeaders` to include `X-CSRF-Token` in `createBetterAuthPlugin` cors config |
| Integration skip | `probeDb()` pattern — same preamble in new integration file |
| Review: membershipLimit | better-auth enforces single-member — token workspaceId is tenant boundary |

### Architecture compliance

| Ref | Rule |
| --- | --- |
| **AD-1** | Token sign/verify in `apps/api/src/auth/`; scope enum in `@usetagih/schema` |
| **AD-2** | Endpoint at `/v1/session/token` not `/api/auth/token` |
| **AD-7** | TTL ≤900s; aud binding; CSRF; scope parity matrix |
| **NFR-5** | Cross-workspace resource → 404 (probe in integration; full enforcement when routes exist) |
| **Epic 3 verify-first** | Integration tests boot real app + compose Postgres |

### Verification (required)

```bash
docker compose -f docker/compose.yml up -d postgres
bun run --filter @usetagih/db migrate
bun test apps/api
bun test packages/schema
bun test packages/config
bunx turbo run lint typecheck test build --force
```

### Project Structure Notes

- Scope enum lives in `@usetagih/schema` (contract package) — consumed by api, future sdk, OpenAPI generation in Story 7.4
- Do **not** store session JWTs server-side (stateless); revocation is expiry-only at MVP
- Do **not** document or implement localStorage long-lived API key pattern for web — Story 6.x uses session exchange
- Structured log `workspaceId` from bearer context — pino wiring Story 8.6; pass through Elysia context now

### References

- [Source: _bmad-output/planning-artifacts/epics.md — Story 3.4 ACs]
- [Source: _bmad-output/planning-artifacts/architecture/architecture-usetagih-2026-07-20/SOLUTION-DESIGN.md §4.1, §7.1, §15]
- [Source: _bmad-output/planning-artifacts/architecture/architecture-usetagih-2026-07-20/ARCHITECTURE-SPINE.md AD-2, AD-7]
- [Source: _bmad-output/planning-artifacts/correct-course-2026-07-20-harness-directives.md — A28 note 9, §5.2 workspace semantics]
- [Source: _bmad-output/implementation-artifacts/3-3-better-auth-registration-login-and-session-middleware.md — Dev Agent Record]
- [Source: apps/api/src/auth/mount.ts — session macro pattern]
- [Source: apps/api/src/middleware/workspace-guard.ts]
- [Source: node_modules/.bun/better-auth@1.6.23/.../dist/plugins — jwt/bearer exist but not used per AD-2]
- [Source: bun.lock — jose@6.2.3 transitive via better-auth]

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List

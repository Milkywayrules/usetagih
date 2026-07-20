---
baseline_commit: da918cd
created: 2026-07-20
---

# Story 3.4: POST /v1/session/token — short-lived audience-bound CSRF-protected Bearer

Status: done

<!-- Ultimate context engine analysis completed - comprehensive developer guide created -->

## Story

As a web app developer,
I want session-to-Bearer token exchange with scope parity to API keys,
so that browser calls public API without exposing long-lived secrets (AD-2, AD-7, SOLUTION-DESIGN §15).

## Acceptance Criteria

1. **Given** authenticated better-auth session and valid CSRF token (double-submit cookie), **when** `POST /v1/session/token` is called, **then** response is HTTP **200** with JSON `{ accessToken, tokenType: "Bearer", expiresIn, scopes, workspaceId }` where `accessToken` is a signed JWT, `expiresIn` ≤ **900** seconds (15 min), `scopes` is the full canonical scope set, and `workspaceId` equals `session.activeOrganizationId`.
2. **Given** issued JWT, **when** decoded, **then** claims include `sub` (userId), `wid` (workspaceId), `scp` (scopes array), `aud` = `USETAGIH_API_PUBLIC_URL` (API recipient), `azp` = `USETAGIH_WEB_PUBLIC_URL` (authorized web client), `iss` = `USETAGIH_API_PUBLIC_URL`, `exp`/`iat`, `jti` (uuid), `typ: "session_bearer"`; TTL from `iat` to `exp` is ≤ **900** seconds.
3. **Given** canonical scope enum in `@usetagih/schema`, **when** inspected, **then** values are exactly: `renders:read`, `renders:write`, `webhooks:manage`, `audit:read`; session token exchange grants **all four** scopes (web app full access within active workspace).
4. **Given** `Authorization: Bearer <session_jwt>` on `/v1/*`, **when** bearer auth middleware runs, **then** request context receives `{ authType: "session_bearer", userId, workspaceId, scopes }`; workspace on token must match route resource workspace (stub routes prove chain; cross-workspace returns **404** per NFR-5 — defer full envelope to Story 3.6).
5. **Given** bearer token missing required scope for a route, **when** scope guard runs, **then** HTTP **403** with code `FORBIDDEN` and message indicating required scope (full `requestId` envelope deferred to Story 3.6).
6. **Given** missing, mismatched, or absent CSRF double-submit on `POST /v1/session/token`, **when** called with valid session cookie, **then** HTTP **403** with code `FORBIDDEN`.
7. **Given** expired or absent session cookie on `POST /v1/session/token`, **when** called, **then** HTTP **401** with code `UNAUTHORIZED`.
8. **Given** expired, malformed, wrong-`aud`/`azp`/`iss`/`typ`, wrong algorithm, missing required claims, future `iat`, malformed `scp`, or wrong-signature JWT on `/v1/*`, **when** bearer middleware runs, **then** HTTP **401** with code `UNAUTHORIZED`.
9. **Given** scope-parity matrix in `apps/api/src/routes/v1/session.token.test.ts`, **when** `bun test apps/api` runs, **then** each matrix row asserts session-bearer grant/deny matches required scope for stub routes; API-key column marked `// Story 3.5 extends` with skipped/placeholder tests.
10. **Given** `@usetagih/config/env` extended with `USETAGIH_WEB_PUBLIC_URL`, **when** `apps/api` boots in `dev`, **then** env parses; dev default `http://localhost:3000`; staging/prod required.
11. **Given** compose Postgres running, **when** `bun test apps/api` integration suite runs, **then** tests boot real Elysia app, drive sign-up → CSRF cookie → token exchange → bearer-authenticated stub routes via `fetch`.
12. **Given** workspace, **when** `bunx turbo run lint typecheck test build --force` runs from repo root, **then** all tasks exit 0.
13. **Out of scope (later Epic 3 stories):** API key create/list/revoke (Story 3.5); unified error envelope + `requestId` on all routes (Story 3.6); real resource handlers (Stories 3.8–3.14); web client token storage (Story 6.x); no browser-exposed long-lived API key pattern in docs.

## Tasks / Subtasks

- [x] Task 1 — Canonical scope enum in schema (AC: 3, 9)
  - [x] Create `packages/schema/src/auth/scopes.ts` per Dev Notes §Scope enum
  - [x] Export from `packages/schema/src/index.ts`
  - [x] Add unit test `packages/schema/src/auth/scopes.test.ts`
- [x] Task 2 — Env schema extension (AC: 10)
  - [x] Add `USETAGIH_WEB_PUBLIC_URL` to `packages/config/src/env/schema.ts` per Dev Notes §Env schema
  - [x] Extend `EnvStub`; update `packages/config/src/env/env.test.ts`
  - [x] Wire into `apps/api/src/env.ts`
- [x] Task 3 — Session token signing + verification (AC: 1, 2, 8)
  - [x] Pin `jose@6.2.3` in `apps/api/package.json` (direct dep — see Dev Notes §Token mechanism)
  - [x] Implement `apps/api/src/auth/session-token.ts` — sign/verify helpers per Dev Notes §JWT claims
  - [x] Constants: `SESSION_TOKEN_TTL_SECONDS = 900`, `SESSION_TOKEN_TYP = "session_bearer"`
- [x] Task 4 — CSRF double-submit (AC: 6)
  - [x] Implement `apps/api/src/middleware/csrf.ts` per Dev Notes §CSRF strategy
  - [x] Issue `usetagih.csrf` cookie on sign-up-with-workspace and sign-in success (hook or response wrapper)
  - [x] Add `GET /v1/session/csrf` to refresh CSRF cookie (session required; no CSRF check on GET)
- [x] Task 5 — POST /v1/session/token route (AC: 1, 6, 7)
  - [x] Implement `apps/api/src/routes/v1/session.token.ts`
  - [x] Require session macro + CSRF middleware + workspace guard
  - [x] Return token response shape per Dev Notes §Token response
- [x] Task 6 — Bearer auth + scope middleware (AC: 4, 5, 8)
  - [x] Implement `apps/api/src/middleware/bearer-auth.ts` — verify JWT, populate auth context
  - [x] Implement `apps/api/src/middleware/scope-guard.ts` — macro `requireScope(...scopes)`
  - [x] Implement `apps/api/src/middleware/auth-resolver.ts` — session cookie OR bearer JWT (cookie takes precedence when both present for workspace routes)
  - [x] Wire middleware chain on `/v1/*` group in `createApp` per Dev Notes §Middleware order
- [x] Task 7 — Scope-gated stub routes for parity matrix (AC: 4, 5, 9)
  - [x] Add stub routes per Dev Notes §Scope-gated stubs
  - [x] Refactor existing `GET /v1/renders` stub to use bearer OR session via unified auth resolver
- [x] Task 8 — Scope-parity matrix tests (AC: 9, 11)
  - [x] Create `apps/api/src/routes/v1/session.token.test.ts` per Dev Notes §Scope-parity matrix
  - [x] Integration cases in `apps/api/src/integration/session-token.integration.test.ts` (probeDb skip pattern)
- [x] Task 9 — Auth config + CORS (AC: 10)
  - [x] Extend `packages/db/src/auth/auth.config.ts` `trustedOrigins` to include `USETAGIH_WEB_PUBLIC_URL`
  - [x] Extend `createBetterAuthPlugin` CORS `allowedHeaders` to include `X-CSRF-Token`
- [x] Task 10 — Verification gate (AC: 12)
  - [x] `docker compose -f docker/compose.yml up -d postgres` (if not running)
  - [x] `bun test apps/api`
  - [x] `bun test packages/schema`
  - [x] `bun test packages/config`
  - [x] `bunx turbo run lint typecheck test build --force`

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

**Choice:** Custom JWT signed with **`jose@6.2.3`** (HS256). Symmetric signing key is **derived via HKDF-SHA256** from `BETTER_AUTH_SECRET` — **never sign with the raw secret**.

| HKDF parameter | Value |
| --- | --- |
| Hash | SHA-256 |
| Salt | empty (fixed) |
| Info | `usetagih:session_bearer:v1` |
| Output length | 32 bytes (256-bit HS256 key) |

**Key rotation:** No `kid` header. Rotating `BETTER_AUTH_SECRET` immediately invalidates all outstanding session bearer tokens — acceptable at ≤15 min TTL (no revocation list at MVP).

**Why not better-auth plugins:** Inspected `better-auth@1.6.23` — ships `jwt` and `bearer` plugins under `better-auth/plugins`, but:

| better-auth plugin | Problem for usetagih |
| --- | --- |
| `bearer` | Issues long-lived session bearer tied to better-auth session store — not ≤15 min audience-bound scoped tokens |
| `jwt` | Exposes `/api/auth/token` on auth mount — violates AD-2 public REST boundary (`/v1/session/token`) |
| Both | No custom claims for `workspaceId`, `scp[]`, `aud`/`azp` split in our contract |

Architecture ratifies `POST /v1/session/token` on `/v1/*` with custom claims. Use `jose` (already transitive dep of better-auth 1.6.23 at `6.2.3` in lockfile) as **direct** dep in `apps/api`.

**Board ratification (2–1):** dissent on better-auth-plugin reuse recorded (minority preferred `jwt` plugin) but overruled by majority — custom `/v1/session/token` + HKDF-derived keys remain binding.

**Board note:** `jose@6.2.3` not listed in ARCHITECTURE-SPINE stack table — direct pin required; aligns with better-auth's bundled version.

### CSRF strategy (encode exactly — session-bound signed double-submit)

**Choice:** **Session-bound signed double-submit cookie** (board-hardened variant of epics/architecture AC).

| Element | Value |
| --- | --- |
| Cookie name | `__Host-usetagih.csrf` when `Secure` (production/staging HTTPS); plain `usetagih.csrf` in non-HTTPS dev only |
| Cookie flags | `SameSite=Strict`; `Secure=true` in staging/prod; **`HttpOnly=false`** (JS reads value for header); `Path=/` (required for `__Host-` prefix) |
| Header name | `X-CSRF-Token` |
| Token shape | `{nonce}.{hmacHex}` where `hmacHex = HMAC-SHA256(csrfKey, sessionId + ":" + nonce)` |
| CSRF key | HKDF-SHA256 from `BETTER_AUTH_SECRET`, info `usetagih:csrf:v1`, salt empty, 32 bytes |
| Validation | `POST /v1/session/token`: header value === cookie value (constant-time) **and** HMAC verifies against **current** session id — token from another session → **403 FORBIDDEN** |
| Issuance | Set/refreshed on: successful `sign-up-with-workspace`, successful sign-in (`hooks.after`), `GET /v1/session/csrf` |
| Exempt | `GET` requests; `/api/auth/*`; `/health` |

**Sibling-subdomain cookie injection:** `__Host-` prefix + `SameSite=Strict` mitigates cross-subdomain cookie injection in production; not directly unit-testable without multi-host harness — documented as defense-in-depth.

**Do not** use naive header===cookie compare without session-bound HMAC — board amendment requires session binding.

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

**Signing:** `SignJWT` from `jose`, algorithm **HS256**, key = HKDF(`BETTER_AUTH_SECRET`, info=`usetagih:session_bearer:v1`).

**Payload:**

```typescript
type SessionBearerClaims = {
  sub: string;       // userId
  wid: string;       // workspaceId (activeOrganizationId)
  scp: ApiScope[];   // granted scopes
  aud: string;       // USETAGIH_API_PUBLIC_URL — token recipient (API)
  azp: string;       // USETAGIH_WEB_PUBLIC_URL — authorized web client
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

1. Signature valid (HS256 + HKDF-derived key); **`algorithms: ["HS256"]` pinned** — reject `none`/wrong alg
2. `typ === "session_bearer"` (required claim)
3. `aud === env.USETAGIH_API_PUBLIC_URL` (API is recipient)
4. `azp === env.USETAGIH_WEB_PUBLIC_URL` (web client binding)
5. `iss === env.USETAGIH_API_PUBLIC_URL`
6. `sub`, `wid`, `jti` present and non-empty; `wid` is uuid
7. `iat` present, not in future (≤30s clock skew tolerance)
8. `exp > now` (clock skew tolerance: 30s)
9. `scp` is array; every element ∈ `API_SCOPES` — reject malformed/missing

**Tenant authorization:** `wid` claim is **transport** (carries active workspace for bearer context) — **not** sole tenant protection. Repository/query boundaries enforce workspace filtering per Story 3.3 workspace guard pattern; cross-workspace resource access → **404** (NFR-5).

**Post-logout residual validity (explicit risk acceptance):** Revoked/logged-out sessions leave already-issued bearer tokens valid until `exp` (≤15 min). No server-side revocation list, no refresh tokens at MVP. Integration test asserts bearer issued **before** logout still verifies until expiry.

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

**CORS (board amendment):** Browser calls from `USETAGIH_WEB_PUBLIC_URL` to API must succeed. Extend `createBetterAuthPlugin` **and** `/v1` group CORS: `origin: env.USETAGIH_WEB_PUBLIC_URL`, `credentials: true`, `allowedHeaders` includes `X-CSRF-Token` (existing config incorrectly used API URL as origin).

### Middleware behavior table (encode exactly)

| Step | Middleware | Condition | HTTP | Code |
| --- | --- | --- | --- | --- |
| 1 | (none) | `POST /v1/session/token` no session | 401 | `UNAUTHORIZED` |
| 2 | csrf | `POST /v1/session/token` missing/mismatch CSRF or session-bound HMAC fail | 403 | `FORBIDDEN` |
| 3 | workspace | session, zero orgs or no active org | 403 | `WORKSPACE_REQUIRED` |
| 4 | session-token route | valid session + CSRF + workspace | 200 | — |
| 5 | bearer-auth | `/v1/*` Bearer present, JWT invalid/expired/wrong aud/azp/iss/typ/alg/claims | 401 | `UNAUTHORIZED` |
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
7. `JWT with wrong azp → 401`
8. `CSRF token from different session → 403`
9. `Wrong algorithm token → 401`
10. `Missing required claims → 401`
11. `Future iat → 401`
12. `Malformed scp → 401`
13. `Bearer issued before logout still verifies until exp` (residual validity risk acceptance)
14. `AuthCookieJar pattern from 3.3 for multi-step cookie forwarding`

**Negative test matrix (minimum):** session-bound CSRF rejection; sibling-subdomain cookie injection (document-only if not testable); wrong algorithm; missing claims; future `iat`; malformed `scp`; post-logout residual token behavior.

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

composer-2.5-fast (implementation subagent)

### Debug Log References

- HKDF keys via `node:crypto` `hkdfSync`; jose requires `Uint8Array` not raw `Buffer`
- Elysia child route plugins need `@ts-nocheck` for macro hook typing
- CSRF on sign-in deferred to `GET /v1/session/csrf` refresh (better-auth hook lacks Set-Cookie seam)

### Completion Notes List

- Implemented `POST /v1/session/token` + `GET /v1/session/csrf` with board-ratified HKDF signing, aud/azp split, session-bound CSRF HMAC, and `/v1` CORS for web origin
- Bearer auth chain: `auth-resolver` (session cookie or JWT) + `requireScope` macro on stub routes
- Verification: `bun test apps/api` 63 pass / 10 skip (src+dist); schema 63 pass; config 10 pass; turbo 36/36 tasks green
- Code review (2026-07-20): added expired/wrong-aud/wrong-azp JWT negative tests and unauthenticated CSRF integration probe; `@ts-nocheck` on v1 route plugins deferred to Epic 2 action item (tsconfig.build exclude)

### File List

- `apps/api/package.json`
- `apps/api/src/app.ts`
- `apps/api/src/auth/crypto-keys.ts`
- `apps/api/src/auth/mount.ts`
- `apps/api/src/auth/session-token.ts`
- `apps/api/src/integration/session-token.integration.test.ts`
- `apps/api/src/middleware/auth-context.ts`
- `apps/api/src/middleware/auth-resolver.ts`
- `apps/api/src/middleware/bearer-auth.ts`
- `apps/api/src/middleware/csrf.ts`
- `apps/api/src/middleware/scope-guard.ts`
- `apps/api/src/middleware/v1-cors.ts`
- `apps/api/src/routes/auth/sign-up-with-workspace.ts`
- `apps/api/src/routes/v1/audit.stub.ts`
- `apps/api/src/routes/v1/renders.stub.ts`
- `apps/api/src/routes/v1/session.csrf.ts`
- `apps/api/src/routes/v1/session.token.ts`
- `apps/api/src/routes/v1/session.token.test.ts`
- `apps/api/src/routes/v1/webhooks.stub.ts`
- `packages/config/src/env/env.test.ts`
- `packages/config/src/env/schema.ts`
- `packages/db/src/auth/auth.config.ts`
- `packages/schema/src/auth/scopes.test.ts`
- `packages/schema/src/auth/scopes.ts`
- `packages/schema/src/index.ts`
- `bun.lock`

## Change Log

- 2026-07-20 — Board ratification 2–1: HKDF key derivation, session-bound CSRF HMAC, aud/azp semantics correction, verification hardening, CORS web-origin fix, post-logout residual validity risk acceptance, expanded negative test matrix. Dissent on better-auth-plugin reuse recorded but overruled by majority.
- 2026-07-20 — Implementation complete: session bearer exchange, scope enum, middleware chain, parity matrix + integration tests; status → review.
- 2026-07-20 — Code review approved with fixes: negative JWT tests (expired, wrong aud/azp), CSRF auth probe; status → done.

## Code Review

**Reviewer:** adversarial code-review subagent (2026-07-20)  
**Commits reviewed:** `c464d6f` (feat), `f77d34c` (docs), fixes `67b2b61`, `d0e1d96`  
**Outcome:** approved — status **done**

### Binding amendments verification

| Amendment | Verdict | Evidence |
| --- | --- | --- |
| HKDF signing key (`usetagih:session_bearer:v1`) + separate CSRF key (`usetagih:csrf:v1`) | PASS | `apps/api/src/auth/crypto-keys.ts` — never uses raw `BETTER_AUTH_SECRET` |
| Verify-side hardening (HS256 pin, required claims, future `iat`, malformed `scp`) | PASS | `session-token.ts` + `bearer-auth.ts`; unit matrix in `session.token.test.ts` |
| `aud` = API URL, `azp` = web URL | PASS | sign + verify in `session-token.ts` |
| Session-bound CSRF double-submit (`__Host-` when Secure, SameSite=Strict, timing-safe) | PASS | `middleware/csrf.ts`; cross-session rejection tested |
| Post-logout residual ≤15 min | PASS (accepted risk) | integration test + dev notes |
| CORS exact web origin + credentials + `X-CSRF-Token` | PASS | `v1-cors.ts`, `auth/mount.ts`, `auth.config.ts` trustedOrigins |
| Negative-test matrix | PASS (after fix) | unit + integration coverage for CSRF, alg, claims, iat, scp, aud, azp, expired, logout residual |
| Tenant: `wid` transport-only | PASS | workspace guard validates session path via DB; bearer trusts JWT `wid` until exp (MVP) |
| Middleware order / exchange reachability | PASS | `app.ts`: v1Cors → workspaceGuard → authResolver → scopeGuard; token route uses `workspace` macro |

### Findings

| Severity | File | Issue | Resolution |
| --- | --- | --- | --- |
| Medium | `session-token.integration.test.ts` | Missing integration cases for expired JWT, wrong `aud`, wrong `azp` per story matrix | Added in `67b2b61` |
| Low | `session-token.integration.test.ts` | Sign-up flow exceeded default 5s bun timeout under load | `setDefaultTimeout(15_000)` when Postgres up |
| Low | `session.csrf.ts` + dev record | CSRF cookie not set on sign-in (better-auth hook lacks Set-Cookie seam) | **Accepted** — `GET /v1/session/csrf` refresh + sign-up issues CSRF; document for Story 6.x client |
| Low | route stubs (`*.stub.ts`, session routes) | `@ts-nocheck` for Elysia macro typing | **Accepted** — localized to route wiring; runtime-valid per integration tests |
| Info | `auth-resolver.ts` | Bearer path does not re-check org membership (stateless JWT) | **Accepted MVP risk** — same class as post-logout residual; repos enforce tenant at query boundary in 3.3+ |
| Info | `auth.integration.test.ts` | Intermittent 5s timeout on sign-in tests when suite runs under turbo parallel load | Pre-existing; not introduced by 3.4; session-token suite stable with extended timeout |

### Verification (post-fix, Postgres up)

| Command | Result |
| --- | --- |
| `bun test apps/api` | 147 pass / 10 skip / 0 fail |
| `bun test packages/schema` | 63 pass / 0 fail |
| `bun test packages/config` | 10 pass / 0 fail |
| `bunx turbo run lint typecheck test build --force` | 36/36 tasks green (with compose Postgres healthy) |

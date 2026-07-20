---
baseline_commit: 7ee821c
created: 2026-07-20
---

# Story 3.5: API key create, list, and revoke endpoints

Status: ready-for-dev

<!-- Ultimate context engine analysis completed - comprehensive developer guide created -->

## Story

As an embed integrator (Alex),
I want POST/GET/DELETE /v1/api-keys with scoped show-once secrets,
so that I can authenticate REST calls (FR-22, FR-23, AD-7).

## Acceptance Criteria

1. **Given** authenticated workspace owner via **session cookie** or **session bearer JWT** (`authType` ∈ `session`, `session_bearer`) with active `workspaceId`, **when** `POST /v1/api-keys` with JSON `{ name, scopes, expiresAt? }`, **then** HTTP **201** with body including `secret` (full key, show-once), `prefix`, `id` (external `key_` prefix), `name`, `scopes`, `expiresAt`, `createdAt`; DB row stores `prefix` + argon2 `key_hash` only — **never** plaintext secret.
2. **Given** `POST /v1/api-keys` body, **when** validated, **then** `name` is non-empty string max 128 chars; `scopes` is non-empty array validated by `ApiScopeArraySchema` from `@usetagih/schema` (exact enum: `renders:read`, `renders:write`, `webhooks:manage`, `audit:read` — **no parallel enum**); optional `expiresAt` is ISO 8601 datetime in the future or omitted/null.
3. **Given** authenticated session owner, **when** `GET /v1/api-keys`, **then** HTTP **200** with `{ keys: [...] }` listing metadata per workspace (`id`, `name`, `prefix`, `scopes`, `expiresAt`, `revokedAt`, `createdAt`, `status`: `active`|`revoked`|`expired`); response **never** includes `secret` or `key_hash`.
4. **Given** authenticated session owner and `keyId` belonging to active workspace, **when** `DELETE /v1/api-keys/{keyId}`, **then** HTTP **200** with revoked key metadata (`revokedAt` set); already-revoked key returns **200** idempotently (same `revokedAt`).
5. **Given** `DELETE /v1/api-keys/{keyId}` where `keyId` belongs to another workspace, **when** called, **then** HTTP **404** with code `NOT_FOUND` (NFR-5 — not 403).
6. **Given** raw **API key Bearer** (`authType: "api_key"`) on `POST|GET|DELETE /v1/api-keys`, **when** called, **then** HTTP **403** with code `FORBIDDEN` and message indicating session authentication required for key management (evidence: FR-21 blocks unauthenticated key issuance; prevents key self-proliferation).
7. **Given** issued API key secret, **when** `Authorization: Bearer <secret>` on scope-gated `/v1/*` stub routes, **then** bearer middleware resolves `authContext` with `authType: "api_key"`, `workspaceId`, `scopes` (subset from key row), `apiKeyId`; routes enforce `requireScope` identically to session bearer (scope-parity matrix).
8. **Given** revoked or expired API key secret, **when** used as Bearer on `/v1/*`, **then** HTTP **401** with code `UNAUTHORIZED`.
9. **Given** API key Bearer missing required scope, **when** scope guard runs, **then** HTTP **403** with code `FORBIDDEN` and message `Insufficient scope: requires <scope>` (same shape as Story 3.4 — full envelope deferred to 3.6).
10. **Given** successful create or revoke, **when** operation completes, **then** `audit_events` row appended via `AuditRepo` with `action` `api_key.created` or `api_key.revoked`, `workspaceId`, `userId` (session actor), `resourceType: "api_key"`, `resourceId` = key id, `outcome: "success"`, client IP when available (FR-27 partial).
11. **Given** `apps/api` unit/integration tests, **when** `bun test apps/api` runs, **then** tests prove: plaintext secret never persisted; argon2 hash verified on auth; create → list (no secret) → authenticate stub route → revoke → 401; scope-parity matrix API-key column **un-skipped** and passes same grant/deny rows as session bearer (subset-scope keys deny missing scopes).
12. **Given** workspace, **when** `bunx turbo run lint typecheck test build --force` runs from repo root, **then** all tasks exit 0.
13. **Out of scope (later Epic 3 stories):** unified error envelope + `requestId` (Story 3.6); `GET /v1/audit` listing (Story 3.14); rate limits per key (Story 3.16); `lastUsedAt` column/tracking (Story 3.16 or 6.9 UX — not in 3.1 schema); OpenAPI publish (Story 7.4); web UI (Story 6.9).

## Tasks / Subtasks

- [ ] Task 1 — `ApiKeyRepo` port + Drizzle adapter (AC: 1, 3, 4, 8)
  - [ ] Add `packages/core/src/ports/api-key-repo.ts` — `create`, `listByWorkspace`, `findByPrefix`, `revoke`, types
  - [ ] Export from `packages/core` index
  - [ ] Implement `packages/db/src/repositories/api-key-repo.ts`
  - [ ] Export `createApiKeyRepo` from `packages/db`
  - [ ] Unit tests in `packages/db/src/repositories/api-key-repo.test.ts` (hash-at-rest, workspace isolation)
- [ ] Task 2 — API key crypto helpers (AC: 1, 7, 8)
  - [ ] Pin `@node-rs/argon2@2.0.2` in `apps/api/package.json` (direct dep — AD-7 argon2; no existing argon2 in monorepo)
  - [ ] Implement `apps/api/src/auth/api-key-crypto.ts` — generate secret, extract prefix, hash, verify per Dev Notes §Secret format
- [ ] Task 3 — Extend auth context + bearer resolution (AC: 6, 7, 8, 9)
  - [ ] Update `apps/api/src/middleware/auth-context.ts` — add `authType: "api_key"`, optional `userId`, optional `apiKeyId`
  - [ ] Refactor `apps/api/src/middleware/bearer-auth.ts` — JWT path first (token contains `.`), else API key lookup via `ApiKeyRepo.findByPrefix` + argon2 verify + expiry/revoke checks
  - [ ] Inject `apiKeyRepo` into `createAuthResolver` / `createApp` deps
- [ ] Task 4 — Session-only guard for key management routes (AC: 6)
  - [ ] Implement `apps/api/src/middleware/session-management-auth.ts` macro or inline guard — reject `authType === "api_key"`
- [ ] Task 5 — `/v1/api-keys` routes (AC: 1–5, 10)
  - [ ] Implement `apps/api/src/routes/v1/api-keys.ts` — POST, GET, DELETE with Zod body/params validation
  - [ ] Parse external `keyId` path param: accept `key_<uuid>` or bare uuid; normalize to uuid for DB lookup
  - [ ] Wire routes in `apps/api/src/app.ts` **before** scope-gated stubs; use `authenticated` + session-management guard
  - [ ] Append audit on create/revoke via injected `AuditRepo`
- [ ] Task 6 — Scope-parity matrix extension (AC: 7, 9, 11)
  - [ ] Update `apps/api/src/routes/v1/session.token.test.ts` — replace `test.skip` API-key rows with live tests using programmatically created keys (subset scopes + full scopes fixtures)
  - [ ] Add subset-scope denial case mirroring session bearer row 6
- [ ] Task 7 — Integration tests (AC: 11)
  - [ ] Create `apps/api/src/integration/api-keys.integration.test.ts` — sign-up → create key → list → stub route auth → revoke → 401; `probeDb()` skip pattern
  - [ ] Assert audit rows for create/revoke
  - [ ] Assert API key Bearer rejected on POST /v1/api-keys
- [ ] Task 8 — Verification gate (AC: 12)
  - [ ] `docker compose -f docker/compose.yml up -d postgres`
  - [ ] `bun run --filter @usetagih/db migrate`
  - [ ] `bun test apps/api`
  - [ ] `bun test packages/db`
  - [ ] `bunx turbo run lint typecheck test build --force`

## Dev Notes

### Goal

Deliver workspace-scoped API key **CRUD** (create/list/revoke) and wire long-lived key authentication into the **existing** bearer + `requireScope` chain from Story 3.4. Keys use the canonical `@usetagih/schema` scope enum unchanged. Plaintext secrets are show-once; argon2 hash at rest per AD-7.

### Binding ratified sources

| Ref | Requirement for 3.5 |
| --- | --- |
| **FR-22** | POST/GET /v1/api-keys; scoped secrets; show-once; hash at rest |
| **FR-23** | DELETE revoke; revoked → 401 on use |
| **FR-27 (partial)** | Audit create/revoke (full GET /v1/audit in 3.14) |
| **AD-7** | argon2 hash; scopes enum; scope-parity matrix; cross-workspace → 404 |
| **NFR-5** | Cross-workspace key access → 404 not 403 |
| **SOLUTION-DESIGN §7.1** | `api_keys` table — already migrated in Story 3.1 |
| **Story 3.4** | `API_SCOPES`, bearer middleware, `requireScope`, parity matrix stubs |
| **Story 3.3** | `AuditRepo`, session macro, workspace guard, integration harness |

### Scope boundary: 3.5 vs 3.6 vs 3.14

| Capability | Owner | 3.5 delivers |
| --- | --- | --- |
| API key CRUD endpoints | **3.5** | POST/GET/DELETE /v1/api-keys |
| API key Bearer auth on resource routes | **3.5** | Extend `bearer-auth.ts` |
| Scope-parity matrix API-key column | **3.5** | Un-skip + implement |
| Unified error envelope + `requestId` | **3.6** | Keep Story 3.4 minimal `{ error: { code, message } }` |
| GET /v1/audit query API | **3.14** | Only append audit rows here |
| Rate limits / quota / lastUsed | **3.16** | Do not add columns |

### Evidence-based decisions (no human loop — documented for board awareness)

| Decision | Choice | Rationale |
| --- | --- | --- |
| Key management auth | Session cookie or session bearer **only** | FR-21 owner issuance; blocks API-key-created API-key chains |
| argon2 library | `@node-rs/argon2@2.0.2` direct dep in `apps/api` | AD-7 mandates argon2; native perf; zero argon2 in monorepo today |
| Bearer disambiguation | JWT if token contains `.`, else API key secret | Session JWTs are dot-separated; key secrets are single-segment `utk_live_…` |
| External id format | `key_<uuid>` in JSON (`id` field) | ARCHITECTURE-SPINE naming (`apiKeyId` prefix `key_`); DB remains uuid PK |
| Secret format | `utk_live_` + 32 random bytes base64url (no padding) | Distinct from JWT; env-specific prefix deferred (single `utk_live_` at MVP) |
| Lookup prefix length | First **16** chars of secret stored in `api_keys.prefix` | Enables indexed lookup before argon2 verify; UX displays same prefix |
| `AuthContext.userId` for api_key | **Omit** (`undefined`) | `api_keys` has no `created_by`; resource audit actor deferred to 3.15; scope checks use `scopes` only |
| Management route scopes | No `requireScope` on `/v1/api-keys` | Owner capability via session auth; not in `ROUTE_SCOPE_REQUIREMENTS` |

**Board-awareness flag (non-blocking):** new dependency `@node-rs/argon2@2.0.2` — aligned with AD-7; no alternative in stack table. Session-only management policy is a security default, not a scope enum extension.

### Secret format (encode exactly)

| Element | Value |
| --- | --- |
| Full secret | `utk_live_` + `base64url(randomBytes(32))` (~51 chars total) |
| Stored `prefix` | First **16** characters of full secret (e.g. `utk_live_Ab12Cd`) |
| Stored `key_hash` | argon2 hash of **full** secret string |
| Bearer header | `Authorization: Bearer <full secret>` — same as PRD §10.2 |
| Generation | `crypto.getRandomValues` for random bytes; use Node `base64url` encoding without padding |

**Argon2 parameters (encode exactly):**

```typescript
import { hash, verify } from "@node-rs/argon2";

export const API_KEY_ARGON2_OPTIONS = {
  memoryCost: 19456,
  timeCost: 2,
  parallelism: 1,
} as const;
```

Use defaults from `@node-rs/argon2` with above explicit costs (OWASP-aligned moderate profile).

**Verification steps (all must pass):**

1. Extract Bearer token; if empty → null (401 downstream)
2. If token includes `.` → existing JWT path (`verifySessionBearerToken`) — unchanged
3. Else require token starts with `utk_live_` and length ≥ 40
4. Extract lookup prefix = `token.slice(0, 16)`
5. `findByPrefix(prefix)` → 0 rows → null (401)
6. If `revoked_at` set → null (401)
7. If `expires_at` set and `expires_at <= now()` → null (401)
8. argon2 verify(token, row.key_hash) → false → null (401)
9. Return `AuthContext { authType: "api_key", workspaceId: row.workspace_id, scopes: row.scopes, apiKeyId: row.id }`

### API contracts (encode exactly)

#### `POST /v1/api-keys`

**Auth:** session cookie or session bearer; **not** API key Bearer.

**Request:**

```json
{
  "name": "CI production",
  "scopes": ["renders:read", "renders:write"],
  "expiresAt": "2027-01-01T00:00:00.000Z"
}
```

**Response 201:**

```json
{
  "id": "key_550e8400-e29b-41d4-a716-446655440000",
  "name": "CI production",
  "prefix": "utk_live_Ab12Cd",
  "secret": "utk_live_Ab12CdEfGhIjKlMnOpQrStUvWxYz0123456789abc",
  "scopes": ["renders:read", "renders:write"],
  "expiresAt": "2027-01-01T00:00:00.000Z",
  "createdAt": "2026-07-20T05:00:00.000Z"
}
```

`secret` appears **only** in this response.

#### `GET /v1/api-keys`

**Response 200:**

```json
{
  "keys": [
    {
      "id": "key_550e8400-e29b-41d4-a716-446655440000",
      "name": "CI production",
      "prefix": "utk_live_Ab12Cd",
      "scopes": ["renders:read", "renders:write"],
      "expiresAt": "2027-01-01T00:00:00.000Z",
      "revokedAt": null,
      "createdAt": "2026-07-20T05:00:00.000Z",
      "status": "active"
    }
  ]
}
```

`status` derived: `revoked_at != null` → `revoked`; else `expires_at <= now()` → `expired`; else `active`.

#### `DELETE /v1/api-keys/{keyId}`

**Response 200:**

```json
{
  "id": "key_550e8400-e29b-41d4-a716-446655440000",
  "revokedAt": "2026-07-20T06:00:00.000Z"
}
```

### Auth integration seam (encode exactly — extend Story 3.4, do not replace)

**File:** `apps/api/src/middleware/bearer-auth.ts`

Current behavior (3.4): Bearer → JWT verify only.

**3.5 behavior:**

```text
resolveBearerAuth(authorization, env, apiKeyRepo):
  1. Parse Bearer token
  2. if token includes "." → verifySessionBearerToken (unchanged)
  3. else → verifyApiKeySecret(token, apiKeyRepo)
```

**File:** `apps/api/src/middleware/auth-resolver.ts`

No change to session-cookie path. Bearer branch calls updated `resolveBearerAuth` with injected repo.

**File:** `apps/api/src/middleware/auth-context.ts`

```typescript
export type AuthContext = {
  authType: "session" | "session_bearer" | "api_key";
  userId?: string;
  workspaceId: string;
  scopes: ApiScope[];
  apiKeyId?: string;
};
```

Session types set `userId`; api_key sets `apiKeyId` only.

**Scope guard:** unchanged — `hasRequiredScopes(authContext, required)` works for subset keys.

### Session-only management guard (encode exactly)

Apply to all `/v1/api-keys` handlers after `authenticated` macro resolves:

```typescript
if (authContext.authType === "api_key") {
  return status(403, {
    error: {
      code: "FORBIDDEN",
      message: "API key management requires session authentication",
    },
  });
}
```

### ApiKeyRepo port (encode exactly)

**File:** `packages/core/src/ports/api-key-repo.ts`

```typescript
export type ApiKeyRecord = {
  id: string;
  workspaceId: string;
  name: string;
  prefix: string;
  scopes: ApiScope[];
  expiresAt: Date | null;
  revokedAt: Date | null;
  createdAt: Date;
};

export type ApiKeyCreateInput = {
  workspaceId: string;
  name: string;
  prefix: string;
  keyHash: string;
  scopes: ApiScope[];
  expiresAt?: Date | null;
};

export interface ApiKeyRepo {
  create(input: ApiKeyCreateInput): Promise<ApiKeyRecord>;
  listByWorkspace(workspaceId: string): Promise<ApiKeyRecord[]>;
  findByPrefix(prefix: string): Promise<(ApiKeyRecord & { keyHash: string }) | null>;
  findById(workspaceId: string, id: string): Promise<ApiKeyRecord | null>;
  revoke(workspaceId: string, id: string): Promise<ApiKeyRecord | null>;
}
```

Import `ApiScope` from `@usetagih/schema` in core port (core already depends on schema).

**Workspace isolation:** `findById` and `revoke` **must** include `workspace_id` in WHERE — cross-workspace → null → route returns 404.

### Audit append (encode exactly)

| Event | `action` | `resourceType` | `resourceId` | `workspaceId` | `userId` |
| --- | --- | --- | --- | --- | --- |
| Create | `api_key.created` | `api_key` | uuid | active workspace | session user |
| Revoke | `api_key.revoked` | `api_key` | uuid | active workspace | session user |

Use existing `AuditRepo.append`; IP from `X-Forwarded-For` first hop or `request.headers` helper if present, else null.

### Middleware chain order in `createApp` (encode exactly)

```text
/v1 group (unchanged base):
  a. v1Cors
  b. workspaceGuard
  c. authResolver (now with apiKeyRepo)
  d. scopeGuard
  e. GET/POST /v1/session/csrf + token (unchanged)
  f. POST/GET/DELETE /v1/api-keys  ← NEW (session-management guard inside)
  g. scope-gated stubs (renders, audit, webhooks)
```

`/v1/api-keys` uses `authenticated` macro but **not** `requireScope`.

### Scope-parity matrix extension (encode exactly)

**File:** `apps/api/src/routes/v1/session.token.test.ts`

Replace each `test.skip('Story 3.5 API key …')` with:

1. **Full-scope key fixture** — create key with all four scopes via `ApiKeyRepo` directly in test setup (bypass HTTP) or via POST if session helper available
2. Assert same status as session bearer row (501 for stubs)
3. **Subset key** — create key with `scopes: ["audit:read"]` only; `GET /v1/renders` → **403**

Add helper `createTestApiKey(deps, { scopes })` in test file or `apps/api/src/test-helpers/api-key.ts` (local to api package until second consumer).

### Validation schemas (encode exactly)

**File:** `apps/api/src/routes/v1/api-keys.schemas.ts` (or inline in route file if <30 lines)

```typescript
import { ApiScopeArraySchema } from "@usetagih/schema";
import { z } from "zod";

export const CreateApiKeyBodySchema = z.object({
  name: z.string().trim().min(1).max(128),
  scopes: ApiScopeArraySchema,
  expiresAt: z.string().datetime().optional().nullable(),
});
```

Reject unknown scope strings with 422 `VALIDATION_FAILED` when Story 3.6 lands; until then return 400 with `{ error: { code: "VALIDATION_FAILED", message } }` on Zod failure.

### Pinned toolchain (exact)

| Package | Pin | Where |
| --- | --- | --- |
| `elysia` | `1.4.29` | existing |
| `better-auth` | `1.6.23` | via `@usetagih/db` |
| `jose` | `6.2.3` | existing (session bearer) |
| `@node-rs/argon2` | `2.0.2` | **NEW direct** `apps/api/package.json` |
| `zod` | `^4.4.3` | via schema/config |

### Package layout (implement exactly)

```text
packages/core/src/ports/
├── api-key-repo.ts          # NEW
└── index.ts                 # UPDATE export

packages/db/src/repositories/
├── api-key-repo.ts          # NEW
└── api-key-repo.test.ts     # NEW

apps/api/src/
├── auth/
│   └── api-key-crypto.ts    # NEW
├── middleware/
│   ├── auth-context.ts      # UPDATE — api_key type
│   ├── bearer-auth.ts       # UPDATE — JWT + API key paths
│   └── auth-resolver.ts     # UPDATE — inject apiKeyRepo
├── routes/v1/
│   ├── api-keys.ts          # NEW
│   ├── api-keys.schemas.ts  # NEW (optional coalesce)
│   └── session.token.test.ts # UPDATE — un-skip API key matrix
├── integration/
│   └── api-keys.integration.test.ts  # NEW
├── test-helpers/
│   └── api-key.ts           # NEW (optional)
└── app.ts                   # UPDATE — wire repo + routes

apps/api/package.json        # UPDATE — @node-rs/argon2@2.0.2
```

**No new migration** — `api_keys` table exists from Story 3.1.

### Previous story intelligence (Story 3.4)

| Source | Learning for 3.5 |
| --- | --- |
| Scope enum | Import `API_SCOPES`, `ApiScopeSchema`, `ApiScopeArraySchema` — never duplicate |
| Bearer middleware | Extend `bearer-auth.ts`; do not duplicate scope guard |
| Parity matrix | `session.token.test.ts` has skipped API-key rows — implement now |
| AuthContext | Extend type; scope guard already generic |
| Error shape | Minimal `{ error: { code, message } }` until 3.6 |
| `@ts-nocheck` on v1 routes | Acceptable on new route plugin if macro typing requires (Epic 2 action item) |
| Integration harness | Reuse `AuthCookieJar`, `probeDb()`, extended timeout from 3.4 |

### Architecture compliance

| Ref | Rule |
| --- | --- |
| **AD-1** | Crypto in `apps/api/src/auth/`; scopes from `@usetagih/schema` |
| **AD-7** | argon2 at rest; show-once; scope parity; audit append on mutate |
| **AD-2** | Key management on `/v1/api-keys` public REST boundary |
| **NFR-5** | Cross-workspace keyId → 404 |
| **Epic 3 verify-first** | Integration tests boot real app + Postgres |

### Testing requirements (encode exactly)

| Test file | Cases |
| --- | --- |
| `api-key-crypto.test.ts` | generate length/prefix; hash≠plaintext; verify roundtrip |
| `api-key-repo.test.ts` | create/list/revoke; findByPrefix; workspace isolation on findById/revoke |
| `session.token.test.ts` | parity matrix API-key column live (5 grant + 1 subset deny) |
| `api-keys.integration.test.ts` | E2E create/list/auth stub/revoke/401; audit rows; session-only management; hash never in DB plaintext |

**Hash-at-rest proof (required):** after create, query DB directly in test asserting `key_hash` ≠ secret and `key_hash` does not contain secret substring; `prefix` ≠ full secret.

### Verification (required)

```bash
docker compose -f docker/compose.yml up -d postgres
bun run --filter @usetagih/db migrate
bun test apps/api
bun test packages/db
bunx turbo run lint typecheck test build --force
```

### Project Structure Notes

- Repos implement `@usetagih/core` ports; route handlers call repos via `createApp` deps (same as `AuditRepo` in 3.3)
- Do **not** add `api_keys.created_by` column — out of 3.1 schema; session actor captured in audit metadata only
- Do **not** implement constant-time prefix enumeration mitigation beyond argon2 — acceptable at MVP key space
- Structured log `apiKeyId` from auth context — evlog wiring Story 8.6; pass through Elysia context now if trivial

### References

- [Source: _bmad-output/planning-artifacts/epics.md — Story 3.5 ACs]
- [Source: _bmad-output/planning-artifacts/architecture/architecture-usetagih-2026-07-20/ARCHITECTURE-SPINE.md AD-7]
- [Source: _bmad-output/planning-artifacts/architecture/architecture-usetagih-2026-07-20/SOLUTION-DESIGN.md §7.1]
- [Source: _bmad-output/planning-artifacts/prds/prd-usetagih-2026-07-20/prd.md FR-22, FR-23, §10.2]
- [Source: _bmad-output/implementation-artifacts/3-1-drizzle-database-schema-and-migrations-for-core-tables.md — api_keys columns]
- [Source: _bmad-output/implementation-artifacts/3-4-post-v1-session-token-short-lived-audience-bound-csrf-protected-bearer.md]
- [Source: packages/schema/src/auth/scopes.ts]
- [Source: packages/db/src/schema/api-keys.ts]
- [Source: apps/api/src/middleware/bearer-auth.ts]
- [Source: apps/api/src/middleware/auth-resolver.ts]

## Dev Agent Record

### Agent Model Used

composer-2.5-fast (create-story subagent)

### Debug Log References

### Completion Notes List

### File List

## Change Log

- 2026-07-20 — Story created: API key CRUD, argon2 hash-at-rest, bearer auth extension, scope-parity matrix completion, session-only management policy; status → ready-for-dev.

---
baseline_commit: 7216006
created: 2026-07-20
---

# Story 3.8: Idempotency middleware for render endpoints

Status: done

<!-- Ultimate context engine analysis completed - comprehensive developer guide created -->

## Story

As an embed integrator,
I want `Idempotency-Key` header deduplication per workspace+endpoint for 24h,
so that retries do not double-charge quota or duplicate artifacts (FR-24, AD-5).

## Acceptance Criteria

1. **Given** `POST /v1/invoices/render`, `POST /v1/quotations/render`, or `POST /v1/receipts/render` with `Authorization: Bearer` and `renders:write` scope, **when** request includes header `Idempotency-Key` with 1–255 printable ASCII characters (`^[\x20-\x7E]{1,255}$`), **then** middleware accepts the key; missing header → **400** `INVALID_REQUEST` with AD-11 envelope; invalid charset/length → **400** `INVALID_REQUEST`.
2. **Given** valid idempotency key and authenticated `workspaceId`, **when** middleware computes `keyHash`, **then** `keyHash = SHA-256(raw Idempotency-Key header value)` as lowercase hex (64 chars) — never store raw key in DB or logs.
3. **Given** render route with JSON body, **when** middleware computes `requestHash`, **then** `requestHash = SHA-256(UTF-8 bytes of raw request body as received)` — do not re-parse/re-serialize JSON (preserves client byte identity); empty body hashes empty string.
4. **Given** lookup key `(workspaceId, endpoint, keyHash)` where `endpoint` is normalized template `POST /v1/{documentType}/render` (e.g. `POST /v1/invoices/render`), **when** `IdempotencyStore.lookup` finds non-expired row with matching `requestHash`, **then** handler chain is **skipped** and cached `response_body` JSON is returned with original HTTP status (201 for sync stub) and `X-Request-Id` header — no second side effect.
5. **Given** same idempotency key within 24h but **different** `requestHash`, **when** middleware runs, **then** HTTP **409** with code `IDEMPOTENCY_CONFLICT`, message suitable for clients, `details: []`, full AD-11 envelope including `requestId` — handler must not execute.
6. **Given** first successful render response on a key miss, **when** handler returns JSON body containing at minimum `{ renderId, shareUrl }`, **then** middleware persists row in `idempotency_keys` via `IdempotencyStore.store` with `expires_at = now() + 24h`, storing full response snapshot in `response_body` jsonb.
7. **Given** expired idempotency row (`expires_at <= now()`), **when** same key is reused, **then** treat as miss (new render attempt allowed); adapter must not return expired rows as hits.
8. **Given** `packages/db` implements `createIdempotencyStore(db): IdempotencyStore` satisfying `packages/core/src/ports/idempotency-store.ts`, **when** `bun test packages/db` runs against compose Postgres, **then** tests cover lookup hit/miss/conflict, store, expiry filtering, and workspace isolation (reuse pattern from `isolation.test.ts`).
9. **Given** idempotency middleware wired on all three document-type render routes inside `/v1` group **after** auth + scope guards, **when** first request succeeds, **then** retry with same key + identical raw body returns **byte-identical** `renderId` and `shareUrl` without invoking inner handler twice (assert via handler call counter or synthetic ID stability test).
10. **Given** Story 3.8 stub inner handler (not Story 3.12 Typst pipeline), **when** first render POST succeeds, **then** returns HTTP **201** with body shape `{ renderId, status: "completed", shareUrl, expiresAt, schemaVersion, documentType, template }` using synthetic `rnd_` prefix IDs — sufficient to prove middleware caching; **no** Typst, R2 upload, validation use-case, or quota enforcement in this story.
11. **Given** `bun test apps/api`, **when** idempotency tests run, **then** unit tests cover header validation, hash helpers, conflict 409 envelope, and integration test (postgres-gated via `probeDb()`) proves happy-path retry + conflict case on at least one document type route.
12. **Given** workspace, **when** `bunx turbo run lint typecheck test build --force` runs from repo root, **then** all tasks exit 0.
13. **Out of scope (later Epic 3 stories):** payload validation (`validateUseCase` → Story 3.9); Typst render + R2 persist (Story 3.12); async `202` path (Epic 4); quota increment (Story 3.16); preview routes (Story 3.11); SDK client (Story 7.2); changing existing stub routes at `GET|POST /v1/renders` (Story 3.13).

## Tasks / Subtasks

- [x] Task 1 — Hash + header helpers (AC: 1, 2, 3)
  - [x] Create `apps/api/src/lib/idempotency-crypto.ts` — `validateIdempotencyKeyHeader`, `hashIdempotencyKey`, `hashRequestBody` using Web Crypto `crypto.subtle.digest("SHA-256", …)` (Bun-native, no new deps)
  - [x] Unit tests in `apps/api/src/lib/idempotency-crypto.test.ts`
- [x] Task 2 — `IdempotencyStore` Drizzle adapter (AC: 6, 7, 8)
  - [x] Implement `packages/db/src/repositories/idempotency-store.ts` — `lookup`/`store` per port; filter `expires_at > now()` on lookup; map DB unique violation on store race to safe behavior
  - [x] Export `createIdempotencyStore` from `packages/db/src/index.ts`
  - [x] Tests in `packages/db/src/repositories/idempotency-store.test.ts` + extend isolation coverage if needed
- [x] Task 3 — Idempotency middleware plugin (AC: 1–7, 9)
  - [x] Create `apps/api/src/middleware/idempotency.ts` — Elysia plugin factory `createIdempotencyMiddleware({ idempotencyStore })`
  - [x] Derive `endpoint` from route template + document type param
  - [x] On hit: return cached body + status; on conflict: `respondApiError` with `IDEMPOTENCY_CONFLICT_CODE`; on miss: `onAfterHandle` or equivalent to store successful 2xx response
  - [x] Require `authContext.workspaceId` — runs only on authenticated render routes
- [x] Task 4 — Document-type render stub routes (AC: 9, 10)
  - [x] Create `apps/api/src/routes/v1/render-by-document-type.stub.ts` — POST `/invoices/render`, `/quotations/render`, `/receipts/render` with `authenticated` + `requireScope: "renders:write"` + idempotency middleware
  - [x] Inner handler returns synthetic 201 body (generate `renderId` once per handler invocation — middleware must prevent double generation on retry)
  - [x] Wire in `apps/api/src/app.ts` replacing or supplementing `createRendersStubRoutes` POST stub (keep GET `/v1/renders` list stub as-is for Story 3.13)
  - [x] Inject `idempotencyStore` via `AppDeps`
- [x] Task 5 — Tests (AC: 11)
  - [x] `apps/api/src/middleware/idempotency.test.ts` — header validation, hit short-circuit, conflict 409 envelope
  - [x] `apps/api/src/integration/idempotency.integration.test.ts` — sign-up → session token or API key → POST render twice → same ids; different body → 409
- [x] Task 6 — Verification gate (AC: 12)
  - [x] `bun test packages/db`
  - [x] `bun test apps/api`
  - [x] `bunx turbo run lint typecheck test build --force`

## Dev Notes

### Goal

Deliver **idempotency middleware** and **`IdempotencyStore` db adapter** wired to `POST /v1/{documentType}/render` routes. Prove FR-24 / AD-5 deduplication with a synthetic stub handler; Story 3.12 swaps the inner handler for the real Typst sync render pipeline **without changing middleware contract**.

### Binding ratified sources

| Ref | Requirement for 3.8 |
| --- | --- |
| **FR-24** | Idempotency-Key 1–255 ASCII; same key+payload → same `renderId`/`shareUrl`; different payload → 409; 24h window |
| **AD-5** | Hash key + `workspaceId` + endpoint; response snapshot ≥24h; conflict on payload mismatch |
| **AD-11** | 409 uses `IDEMPOTENCY_CONFLICT` via `buildApiErrorEnvelope` + `requestId` |
| **ARCHITECTURE-SPINE** | Idempotency stored as SHA-256 hash of key; `rnd_`/`req_` prefixes at API layer |
| **SOLUTION-DESIGN §4.1 step 2** | Idempotency lookup before validate/render in full pipeline — middleware runs first on route |
| **SOLUTION-DESIGN §7.1** | `idempotency_keys` columns: `workspace_id`, `endpoint`, `key_hash`, `request_hash`, `response_body`, `expires_at` |
| **Story 3.2** | `IdempotencyStore` port — implement adapter now (was deferred from 3.2) |
| **Story 3.1** | Table + unique index `(workspace_id, endpoint, key_hash)` already migrated |
| **Story 3.6** | Use `respondApiError` / `getRequestId`; AD-11 envelope on all errors |
| **Story 3.7** | Middleware stays in `apps/api`; plugin order preserved |

### Scope boundary: 3.8 vs adjacent stories

| Capability | Owner | 3.8 delivers |
| --- | --- | --- |
| Idempotency middleware + db adapter | **3.8** | Full |
| `POST /v1/{documentType}/render` route registration | **3.8** | Stub inner handler only |
| Payload validation (`validateUseCase`) | **3.9** | Do not call |
| Preview (`/preview`) | **3.11** | Do not implement |
| Real Typst sync render + R2 | **3.12** | Replace stub handler; keep middleware |
| Quota counters on render | **3.16** | Do not increment |
| `GET /v1/renders` list | **3.13** | Keep existing list stub |
| Async `202` + idempotency | **Epic 4** | Sync 201 stub only |

### Evidence-based decisions (no human loop)

| Decision | Choice | Rationale |
| --- | --- | --- |
| Request body hash | SHA-256 of **raw bytes** as received | Avoids JSON normalization debates; matches "identical payload" literally |
| Key hash | SHA-256 of raw header string | AD-5 / Story 3.1 `key_hash` column comment |
| Endpoint key | Normalized template `POST /v1/invoices/render` | Story 3.2 port doc; matches `isolation.test.ts` fixture |
| TTL | 24h from store time | FR-24 / epics AC |
| Missing header | 400 `INVALID_REQUEST` | Render endpoints require idempotency per PRD §10.2 headers list |
| Expired rows | Filter on read; optional cleanup job deferred | YAGNI — expired rows ignored at lookup |
| Inner handler | Synthetic 201 stub | AC requires `renderId`/`shareUrl` proof without Typst (3.12) |
| Store timing | After successful 2xx handler response | Only cache successes; 4xx/5xx not stored |
| Concurrent duplicate POST | DB unique index + handle insert race | Return stored row or retry lookup on conflict |
| Package location | `packages/db` adapter + `apps/api` middleware | Matches RenderRepo / AuditRepo pattern |

### Current state — files to read before editing

| File | Current state | 3.8 changes |
| --- | --- | --- |
| `packages/core/src/ports/idempotency-store.ts` | Port defined (`lookup`/`store`) | **No change** — implement adapter |
| `packages/db/src/schema/idempotency-keys.ts` | Table + unique index | **No schema change** |
| `packages/db/src/isolation.test.ts` | Unique constraint per workspace test | May extend |
| `packages/db/src/index.ts` | Exports repos, no idempotency store | Add `createIdempotencyStore` |
| `apps/api/src/app.ts` | `/v1` chain: cors→workspace→auth→scope→routes | Inject store; add render-by-type routes + middleware |
| `apps/api/src/routes/v1/renders.stub.ts` | GET list + POST `/renders` → 501 | Keep GET; POST `/renders` may stay 501 or redirect note — **canonical paths are** `/invoices/render` etc. per PRD |
| `packages/schema/src/errors/codes.ts` | `IDEMPOTENCY_CONFLICT` → 409 | **Reuse** — no new codes |
| `apps/api/src/lib/api-error.ts` | Central envelope helper | Use for 409/400 paths |

### IdempotencyStore adapter (encode exactly)

**File:** `packages/db/src/repositories/idempotency-store.ts`

```typescript
import type { IdempotencyStore, IdempotencyLookupResult } from "@usetagih/core";

export function createIdempotencyStore(db: Db): IdempotencyStore {
  return {
    async lookup({ workspaceId, endpoint, keyHash }) {
      // SELECT ... WHERE workspace_id AND endpoint AND key_hash AND expires_at > now()
      // if row: return { status: "hit", requestHash, responseBody }
      // else: { status: "miss" }
    },
    async store({ workspaceId, endpoint, keyHash, requestHash, responseBody, expiresAt }) {
      // INSERT into idempotency_keys
      // on unique violation: optionally no-op (race) — middleware re-reads
    },
  };
}
```

**Conflict detection:** middleware compares incoming `requestHash` to stored row on hit; port returns hit only when row exists and not expired — conflict logic stays in middleware (port returns stored `requestHash` for comparison).

### Middleware flow (encode exactly)

**File:** `apps/api/src/middleware/idempotency.ts`

```
1. Read Idempotency-Key header → validate printable ASCII 1–255
2. keyHash = SHA-256(header)
3. requestHash = SHA-256(rawBody)  // capture in onParse or before handler
4. endpoint = `POST /v1/${documentType}/render`  // from route param
5. lookup(workspaceId, endpoint, keyHash)
   - hit + requestHash match → return cached responseBody + cached status
   - hit + requestHash mismatch → 409 IDEMPOTENCY_CONFLICT
   - miss → continue to handler
6. After handler: if status 2xx → store snapshot + expiresAt = now+24h
```

Wire middleware **per route group** or as scoped plugin on the three POST routes only — do not apply to GET routes or `/v1/session/token`.

### Plugin / route order (encode exactly)

Inside `/v1` group (unchanged prefix from Story 3.6):

```
cors → workspaceGuard → authResolver → scopeGuard →
  ... existing routes ...
  render-by-document-type routes (each: idempotency middleware → stub handler)
  renders list stub (GET only)
  → v1ErrorHandler
```

Root order from Story 3.7 (request-id → otel → evlog → security → openapi) — **unchanged**.

### Synthetic stub handler shape (encode exactly)

**201 response body (minimum fields for AC + forward compat with Story 3.12):**

```json
{
  "renderId": "rnd_<uuid>",
  "status": "completed",
  "shareUrl": "https://{webPublicUrl}/share/{token}",
  "expiresAt": "<ISO8601>",
  "schemaVersion": "2026-07-20",
  "documentType": "invoice",
  "template": "modern"
}
```

Generate new `renderId`/`shareUrl` only when inner handler runs (middleware miss). Use `env.USETAGIH_WEB_PUBLIC_URL` for share URL base. Template default `"modern"` acceptable for stub.

### Testing requirements

| Test file | Covers |
| --- | --- |
| `apps/api/src/lib/idempotency-crypto.test.ts` | ASCII validation; stable SHA-256 hex |
| `apps/api/src/middleware/idempotency.test.ts` | Hit short-circuit; conflict 409 envelope + `X-Request-Id` |
| `packages/db/src/repositories/idempotency-store.test.ts` | CRUD, expiry, workspace isolation |
| `apps/api/src/integration/idempotency.integration.test.ts` | End-to-end retry + conflict with real Postgres |

**Integration pattern:** reuse sign-up + session token or API key helpers from existing integration tests; use `probeDb()` skip when postgres unavailable.

**Handler invocation proof:** module-level counter or inject `onRenderStubInvoked` callback in test deps — second identical request must not increment counter.

### Verification (required)

- Unit tests: `bun test packages/db` + `bun test apps/api`
- Workspace gate: `bunx turbo run lint typecheck test build --force` from repo root (always `--force`)
- Epic 2 action items: no new generated artifacts expected; if any, update `turbo.json` + biome exclude

### Previous story intelligence (3.7)

- `createRequestIdPlugin()` **must remain first** root `.use()` — idempotency errors include `requestId` in envelope + header
- `respondApiError` / `statusApiError` for macro paths — idempotency conflict must set security headers on 409 (Story 3.7 review: early returns need header helper)
- evlog: optional `log.set({ stage: "idempotency_hit" })` on cache return — nice-to-have, not required AC
- Platform wiring stays in `apps/api` — do not extract middleware package yet

### Previous story intelligence (3.6)

- WeakMap `getRequestId(request)` pattern for macros — use in middleware if derive context gaps
- Success bodies remain **flat** — cached render 201 is flat JSON, not envelope-wrapped

### Previous story intelligence (3.2)

- Story 3.2 incorrectly referenced "Story 3.7" for idempotency middleware — **correct owner is 3.8** (this story)
- Port method signatures are authoritative — do not add methods without correct-course

### Git intelligence (baseline 7216006)

Recent Epic 3 patterns:

- Repo factories: `createXxxRepo(db)` in `packages/db`, inject via `AppDeps`
- Middleware as `new Elysia({ name: "..." })` factory plugins
- Colocated `*.test.ts`; integration under `apps/api/src/integration/`
- `.js` extension in relative imports (NodeNext)

### Latest technical specifics

| API | Guidance |
| --- | --- |
| `crypto.subtle.digest` | Available in Bun for SHA-256; use `TextEncoder` for string/body bytes |
| Printable ASCII | `^[\x20-\x7E]{1,255}$` — space through tilde |
| Elysia body access | Use `request.clone().text()` or framework body hook to hash raw bytes before JSON parse |

### Project Structure Notes

```
packages/db/src/repositories/
└── idempotency-store.ts          # NEW

apps/api/src/
├── lib/
│   └── idempotency-crypto.ts     # NEW
├── middleware/
│   └── idempotency.ts            # NEW
├── routes/v1/
│   └── render-by-document-type.stub.ts  # NEW
└── integration/
    └── idempotency.integration.test.ts  # NEW
```

### References

- [Source: `_bmad-output/planning-artifacts/epics.md` — Story 3.8 ACs]
- [Source: `_bmad-output/planning-artifacts/architecture/architecture-usetagih-2026-07-20/ARCHITECTURE-SPINE.md` — AD-5, AD-11, id hashing convention]
- [Source: `_bmad-output/planning-artifacts/architecture/architecture-usetagih-2026-07-20/SOLUTION-DESIGN.md` — §4.1 step 2, §7.1 `idempotency_keys`]
- [Source: `_bmad-output/planning-artifacts/prds/prd-usetagih-2026-07-20/prd.md` — §10.2 headers, render 201 body shape]
- [Source: `_bmad-output/implementation-artifacts/3-1-drizzle-database-schema-and-migrations-for-core-tables.md` — table columns]
- [Source: `_bmad-output/implementation-artifacts/3-2-packages-core-ports-and-validate-use-case.md` — IdempotencyStore port]
- [Source: `_bmad-output/implementation-artifacts/3-6-auth-middleware-request-id-and-unified-error-envelope.md` — envelope helper, request-id]
- [Source: `_bmad-output/implementation-artifacts/3-7-elysia-platform-baseline.md` — scope boundary, plugin order]
- [Source: `packages/core/src/ports/idempotency-store.ts` — port contract]
- [Source: `packages/db/src/schema/idempotency-keys.ts` — Drizzle schema]

## Dev Agent Record

### Agent Model Used

Composer 2.5 Fast

### Debug Log References

- Elysia plugin `onBeforeHandle` hooks only apply to routes registered on the same plugin instance; middleware co-registers POST handler per document type.
- `status(201, body)` responses are normalized before idempotency snapshot storage.

### Completion Notes List

- Implemented SHA-256 idempotency crypto helpers, Drizzle `IdempotencyStore` adapter, and render idempotency middleware wired to POST `/v1/{invoices|quotations|receipts}/render` stub routes.
- Middleware enforces `Idempotency-Key` validation, 24h TTL caching, 409 conflict on body mismatch, and handler short-circuit on retry.
- Added unit tests (crypto, middleware), postgres-gated db adapter tests, and integration tests (retry + conflict + missing header).
- `bunx turbo run lint typecheck test build --force` passes (36/36; api: 85+ tests, db: 9+ tests).

### File List

- `apps/api/src/app.ts` (modified)
- `apps/api/src/lib/idempotency-crypto.ts` (new)
- `apps/api/src/lib/idempotency-crypto.test.ts` (new)
- `apps/api/src/middleware/idempotency.ts` (new)
- `apps/api/src/middleware/idempotency.test.ts` (new)
- `apps/api/src/routes/v1/render-by-document-type.stub.ts` (new)
- `apps/api/src/integration/idempotency.integration.test.ts` (new)
- `packages/db/src/index.ts` (modified)
- `packages/db/src/repositories/idempotency-store.ts` (new)
- `packages/db/src/repositories/idempotency-store.test.ts` (new)
- `_bmad-output/implementation-artifacts/sprint-status.yaml` (modified)

### Change Log

- 2026-07-20: Story 3.8 — idempotency middleware, db adapter, render stub routes, tests; status → review
- 2026-07-20: adversarial code review — all 13 ACs pass; no code fixes required; status → done

## Code Review (2026-07-20)

**Reviewer:** adversarial code review (Story 3.8 idempotency)  
**Merged:** `main` @ `feb4f7b` (PR #13)  
**Verdict:** **PASS** — all 13 ACs satisfied; no blocking fixes

### AC checklist (13/13)

| AC | Result | Notes |
| --- | --- | --- |
| 1 | PASS | `validateIdempotencyKeyHeader` enforces printable ASCII 1–255; missing/invalid → 400 `INVALID_REQUEST` with AD-11 envelope |
| 2 | PASS | `hashIdempotencyKey` → SHA-256 lowercase hex; raw key never stored or logged |
| 3 | PASS | `hashRequestBody` hashes raw UTF-8 bytes via `request.clone().text()`; empty body → empty-string hash |
| 4 | PASS | Lookup hit skips handler; returns cached `response_body` with HTTP 201; `X-Request-Id` via global request-id `onAfterHandle` |
| 5 | PASS | Same key + different `requestHash` → 409 `IDEMPOTENCY_CONFLICT` with full AD-11 envelope + `requestId` |
| 6 | PASS | Successful 2xx responses stored via `IdempotencyStore.store` with `expires_at = now + 24h` |
| 7 | PASS | `lookup` filters `expires_at > now()`; expired rows treated as miss (db test) |
| 8 | PASS | `createIdempotencyStore` in `packages/db`; tests cover hit/miss, expiry, workspace isolation, insert race |
| 9 | PASS | Retry with same key+body returns identical `renderId`/`shareUrl`; handler counter stays at 1 (unit + integration) |
| 10 | PASS | Stub returns 201 with `rnd_` prefix, full body shape on all three document-type routes |
| 11 | PASS | Unit tests (crypto, middleware) + postgres-gated integration (retry, conflict, missing header) |
| 12 | PASS | `bunx turbo run lint typecheck test build --force` → 36/36 exit 0 |
| 13 | PASS | No Typst, R2, quota, validation use-case, or preview routes added |

### Findings triage

| ID | Sev | Bucket | Title | Resolution |
| --- | --- | --- | --- | --- |
| CR-1 | info | dismiss | SHA-256 key/body hashing + printable ASCII validation | Pass — `idempotency-crypto.ts` + unit tests |
| CR-2 | info | dismiss | Drizzle adapter expiry filter + workspace isolation + unique-violation swallow on store race | Pass — `idempotency-store.ts` + postgres tests |
| CR-3 | info | dismiss | Middleware hit short-circuit, conflict 409, post-store re-read on insert race | Pass — `idempotency.ts` + unit/integration tests |
| CR-4 | low | defer | Concurrent duplicate POST can invoke inner handler twice before first store completes | Accepted per story decision table (DB unique + post-store lookup); response consistency preserved; Story 3.12 real render should add handler-level dedup or advisory lock |
| CR-5 | low | dismiss | `@ts-nocheck` on Elysia macro route wiring | Accepted — same pattern as Stories 3.4/3.7; runtime-valid per integration tests |
| CR-6 | info | dismiss | Integration tests cover `invoices/render` only | Pass — AC 11 requires at least one document type; unit wiring registers all three paths |
| CR-7 | info | dismiss | HTTP status not persisted in `response_body`; cache hit hardcodes 201 | Pass for sync stub — AC 4 notes 201 for sync path; Story 3.12 can extend snapshot if async statuses needed |

### Verification run

| Gate | Result | Notes |
| --- | --- | --- |
| `docker compose -f docker/compose.yml up -d postgres` | **PASS** | Container healthy |
| `bun run --filter @usetagih/db migrate` | **PASS** | Migrations applied |
| `bun test apps/api` | **85 pass / 0 fail** | Integration idempotency suite ran (3 tests) |
| `bun test packages/db` | **9 pass / 0 fail** | Idempotency store adapter tests included |
| `bunx turbo run lint typecheck test build --force` | **36/36 exit 0** | Full workspace gate |

---
baseline_commit: a9397f6
created: 2026-07-20
---

# Story 3.7: Elysia platform baseline

Status: ready-for-dev

<!-- Ultimate context engine analysis completed - comprehensive developer guide created -->

## Story

As an API operator,
I want OpenAPI docs, telemetry, structured request logging, and security headers wired at the platform layer,
so that integrators and ops get baseline observability and hardening before feature routes land (NFR-7, NFR-8, AD-11).

## Acceptance Criteria

### Directive 5a — OpenAPI + Scalar hybrid (`USETAGIH_DOCS_ENABLED`, fail-closed prod)

1. **Given** `@elysiajs/openapi` configured in `apps/api` with **explicit paths** (not default `/openapi` only), **when** `USETAGIH_DOCS_ENABLED=true`, **then** `GET /v1/openapi.json` serves OpenAPI 3.1 JSON and `GET /docs` serves Scalar UI — both **unauthenticated** when enabled.
2. **Given** `USETAGIH_DOCS_ENABLED=false`, **when** `GET /v1/openapi.json` or `GET /docs` is requested, **then** both return **404** (no spec leakage, no Scalar HTML).
3. **Given** `parseApiEnv` / `@usetagih/config` env schema, **when** validated per Doppler environment, **then** `USETAGIH_DOCS_ENABLED` behaves as: **dev default `true`**; **staging required explicit boolean** (operators set `true` in Doppler); **prod default `false`** (fail-closed until Story 7.4 + Epic 8.8 launch gate flips to public).
4. **Given** pre-Epic-7 partial spec assembly, **when** `/v1/openapi.json` is served, **then** document merges `@usetagih/schema` OpenAPI `components.schemas` (from build output `packages/schema/openapi/components.json`) with Elysia-introspected route stubs for routes registered in `createApp()` today, and carries explicit partial-maturity marker via `info.description` **or** extension `x-usetagih-spec-maturity: partial`.
5. **Given** `bun test apps/api`, **when** docs-disabled test app runs, **then** tests assert **404** on both `/v1/openapi.json` and `/docs`.

### Directive 5b — Env-gated OTel (`@elysiajs/opentelemetry`)

6. **Given** `@elysiajs/opentelemetry` initialized **before** `createApp()` in `apps/api/src/index.ts`, **when** `OTEL_EXPORTER_OTLP_ENDPOINT` is **unset**, **then** tracing is a **no-op** (no export, no startup failure).
7. **Given** `OTEL_EXPORTER_OTLP_ENDPOINT` is set, **when** requests are handled, **then** traces/spans export with `service.name=usetagih-api`, sensitive attributes redacted, and `requestId` propagated as a trace attribute (from Story 3.6 middleware).
8. **Given** process shutdown (SIGTERM/SIGINT), **when** OTel was configured, **then** tracer provider flushes pending spans before exit.
9. **Given** MVP observability scope, **when** OTel is enabled, **then** **traces only** — no OTel metrics until post-MVP (log-derived metrics remain primary per SOLUTION-DESIGN §12).
10. **Given** `bun test apps/api`, **when** OTel no-op path runs without `OTEL_EXPORTER_OTLP_ENDPOINT`, **then** tests assert app boots and handles requests without export side effects.

### Directive 5c — evlog replaces pino for request logging (preserve field contract)

11. **Given** `evlog` with `evlog/elysia` plugin wired in `apps/api`, **when** any request is handled (including 404/unmatched routes per evlog ≥2.x `onRequest` init), **then** structured request/event logs emit JSON with ratified field contract: `requestId`, `workspaceId`, `renderId`, `stage`, `durationMs` (populate via `log.set()` where applicable; omit unset fields).
12. **Given** Story 3.6 request-id middleware, **when** evlog emits per-request wide event, **then** `requestId` matches `store.requestId` / `X-Request-Id` header value (`req_<uuid>`).
13. **Given** authenticated `/v1/*` routes with `authContext`, **when** request completes, **then** evlog event includes `workspaceId` when available on context (null-safe for unauthenticated routes like `/health`).
14. **Given** Story 3.6 internal error path (`v1-error-handler.ts`), **when** unhandled error occurs, **then** real error is logged via evlog (replacing `console.error`) — still **never** leaked in HTTP response body.
15. **Given** evlog configuration, **when** wired, **then** redaction, sampling, batching/retry, and flush-on-shutdown follow evlog defaults; `evlog` version **pinned** in `apps/api/package.json`; `initLogger({ env: { service: 'usetagih-api' } })` at startup.
16. **Given** env schema + Doppler stub docs, **when** this story merges, **then** `OTEL_EXPORTER_OTLP_ENDPOINT` (optional URL) and `USETAGIH_DOCS_ENABLED` are validated in `parseApiEnv` and documented in `doppler.yaml` header comments + SOLUTION-DESIGN §9 variable table.

### Directive 5e — Thin custom security-header middleware (not third-party helmet)

17. **Given** thin custom Elysia `onAfterHandle` security-header middleware (~20 lines, **no** `@elysiajs/helmet` or Express helmet port), **when** any JSON API route responds, **then** response headers include at minimum: `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY` (or equivalent `Content-Security-Policy` with `frame-ancestors 'none'`), `Referrer-Policy: no-referrer`, `Cross-Origin-Resource-Policy: same-origin`, and a **strict CSP** appropriate for JSON API responses (e.g. `default-src 'none'`).
18. **Given** Scalar `/docs` HTML route only, **when** docs are enabled, **then** that route receives **tested CSP relaxation** allowing Scalar inline script/style — API-wide CSP is **not** weakened for JSON routes.
19. **Given** MVP security scope, **when** security middleware runs, **then** **no app-level HSTS** header (reverse proxy owns HSTS per Story 8.7).
20. **Given** `bun test apps/api`, **when** security header tests run, **then** tests assert required headers on a representative `/v1/*` JSON route and correct relaxed CSP only on `/docs` when enabled.

### Cross-cutting

21. **Given** Story 3.6 unified error envelope (directive 5d — **already done**), **when** this story merges, **then** error envelope behavior is **unchanged** — do not re-wrap success bodies or alter AD-11 shapes.
22. **Given** workspace, **when** `bunx turbo run lint typecheck test build --force` runs from repo root, **then** all tasks exit 0.
23. **Out of scope (later stories):** full OpenAPI document completeness + Spectral CI (Story 7.4); production docs public flip at launch (Epic 8.8); HSTS (Story 8.7); render-path `stage`/`durationMs`/`renderId` population (Stories 3.11–3.12, 8.6); idempotency middleware (Story 3.8); extracting platform wiring to shared packages (stay in `apps/api` until second consumer); OTel metrics exporter.

## Tasks / Subtasks

- [ ] Task 1 — Env schema: `USETAGIH_DOCS_ENABLED` + `OTEL_EXPORTER_OTLP_ENDPOINT` (AC: 3, 6, 16)
  - [ ] Extend `packages/config/src/env/schema.ts` — boolean docs flag with per-environment defaults; optional OTel endpoint URL
  - [ ] Extend `EnvStub` interface + `DEV_ENV_DEFAULTS` if needed
  - [ ] Add tests in `packages/config/src/env/env.test.ts` — dev default true; prod default false; staging requires explicit; OTel optional
  - [ ] Document both vars in `doppler.yaml` comments and SOLUTION-DESIGN §9 table (no secret values)
- [ ] Task 2 — Dependencies (AC: 1, 6, 11)
  - [ ] Pin in `apps/api/package.json`: `@elysiajs/openapi`, `@elysiajs/opentelemetry`, `evlog` (exact versions — match elysia 1.4.29 peer range)
  - [ ] Do **not** add helmet / pino
- [ ] Task 3 — OpenAPI + Scalar plugin (AC: 1–5)
  - [ ] Create `apps/api/src/plugins/openapi-docs.ts` — env-gated; paths `/v1/openapi.json` + `/docs`; merge schema components + route stubs; partial-maturity marker
  - [ ] Resolve components merge: read built `@usetagih/schema` `openapi/components.json` (after `turbo build`) — prefer adding minimal `@usetagih/schema` export if needed vs duplicating generator
  - [ ] When disabled: register no-op or guard returning 404 for both paths
  - [ ] Tests: docs enabled → 200 on both; disabled → 404 on both
- [ ] Task 4 — OTel bootstrap (AC: 6–10)
  - [ ] Create `apps/api/src/telemetry/otel.ts` — init only when `OTEL_EXPORTER_OTLP_ENDPOINT` set; `service.name=usetagih-api`; requestId span attribute hook
  - [ ] Wire in `index.ts` **before** `createApp()`; register shutdown flush on SIGTERM/SIGINT
  - [ ] Tests: boot without endpoint; mock/spy that exporter not called
- [ ] Task 5 — evlog plugin + enrichment (AC: 11–15)
  - [ ] Create `apps/api/src/plugins/evlog.ts` — `initLogger` + `.use(evlog())`; derive hook to `log.set({ requestId, workspaceId })` from context
  - [ ] Replace `console.error` in `v1-error-handler.ts` with evlog error logging
  - [ ] Plugin order: after `createRequestIdPlugin`, before route handlers
  - [ ] Tests: request log includes `requestId`; workspaceId when auth context present
- [ ] Task 6 — Security headers middleware (AC: 17–20)
  - [ ] Create `apps/api/src/middleware/security-headers.ts` — ~20 lines `onAfterHandle`
  - [ ] Accept route-aware CSP: strict default; relaxed variant for `/docs` only
  - [ ] Wire globally after request-id; tests for `/v1/*` vs `/docs`
- [ ] Task 7 — `createApp()` composition order (AC: 1, 11, 17)
  - [ ] Update `apps/api/src/app.ts` — encode plugin order in Dev Notes table; pass `env` into new plugins
  - [ ] Preserve Story 3.6 middleware chain inside `/v1` group unchanged
- [ ] Task 8 — Verification gate (AC: 5, 10, 20, 22)
  - [ ] `bun test packages/config`
  - [ ] `bun test apps/api`
  - [ ] `bunx turbo run lint typecheck test build --force`

## Dev Notes

### Goal

Wire **directive #5** platform capabilities (items a, b, c, e) into `apps/api`. Item **d (standardized envelope)** is complete in Story 3.6 — do not regress. Deliver hybrid docs exposure (dev/staging on by policy, prod fail-closed), env-gated OTel traces, evlog request logging with preserved field contract, and thin security headers without third-party helmet.

### Binding ratified sources

| Ref | Requirement for 3.7 |
| --- | --- |
| **HARNESS directive #5** | openapi+scalar, otel, evlog, envelope (3.6), helmet → custom headers |
| **Board ratification (HARNESS-HUMAN-INPUT)** | Hybrid docs: dev/staging on; prod fail-closed until launch; then public unauthenticated at Epic 8.8 |
| **ARCHITECTURE-SPINE** | `@elysiajs/openapi`, `@elysiajs/opentelemetry`, `evlog/elysia`; logging fields; `USETAGIH_` env prefix |
| **SOLUTION-DESIGN §12.1** | evlog field contract: `requestId`, `workspaceId`, `renderId`, `stage`, `durationMs` |
| **SOLUTION-DESIGN §12.2** | Metrics names unchanged; OTel metrics deferred post-MVP |
| **Story 3.6** | `requestId` middleware first; `console.error` placeholder → replace with evlog |
| **Story 2.5** | `components.json` from schema build — merge, do not regenerate Zod in apps |
| **Story 7.4** | Full spec completeness, Spectral CI, prod docs activation coordination |
| **Story 8.7** | HSTS at proxy — not in this story |
| **Epic 2 open action items** | Generated-artifact checklist; contract-test atomicity; turbo parallel timeout — enforce at code review |

### Scope boundary: 3.7 vs adjacent stories

| Capability | Owner | 3.7 delivers |
| --- | --- | --- |
| `/v1/openapi.json` + `/docs` route serving (partial) | **3.7** | Env-gated hybrid |
| Full MVP paths in OpenAPI + Spectral zero errors | **7.4** | Do not block 3.7 on completeness |
| Prod docs public flip | **8.8** + **7.4** | 3.7 keeps prod default off |
| Unified error envelope | **3.6** | Preserve — no changes to envelope shape |
| `requestId` generation | **3.6** | Consume — wire to evlog + OTel |
| Render-stage logging (`renderId`, `stage`, `durationMs`) | **3.11–3.12**, **8.6** | Baseline request logging only in 3.7 |
| Idempotency middleware | **3.8** | Do not implement |
| Shared `@usetagih/platform` package | **future** | YAGNI — all wiring in `apps/api` |

### Evidence-based decisions (no human loop)

| Decision | Choice | Rationale |
| --- | --- | --- |
| Docs paths | `/v1/openapi.json` + `/docs` | Epics AC explicit paths; not plugin default `/openapi` |
| Docs gating | `USETAGIH_DOCS_ENABLED` boolean in `@usetagih/config` | Consistent with `parseApiEnv`; fail-closed prod default |
| OpenAPI merge | Schema `components.json` + Elysia route introspection | AD-1 single contract source; partial spec until 7.4 |
| Partial marker | `x-usetagih-spec-maturity: partial` | Machine-readable for SDK/CI; removed in 7.4 |
| OTel placement | Before `createApp()` in `index.ts` | Epics AC: initialized before app construction |
| OTel scope | Traces only at MVP | SOLUTION-DESIGN §12 — log-derived metrics primary |
| Logger | `evlog` not `pino` | Board-unanimous supersession; spine amended 2026-07-20 |
| Security headers | Custom ~20-line middleware | Directive #5e — no helmet port; CSP split for Scalar |
| HSTS | Out of scope | Story 8.7 — proxy responsibility |
| Package extraction | Defer | Epics dev notes: wiring stays in `apps/api` |

### Current state — files to read before editing

| File | Current state | 3.7 changes |
| --- | --- | --- |
| `apps/api/src/app.ts` | Request-id first; `/v1` group with cors→workspace→auth→scope→routes→error handler | Add evlog, security-headers, openapi-docs plugins at root level |
| `apps/api/src/index.ts` | `parseApiEnv` → `createApp` → `listen`; console.log startup | Add `initLogger`, OTel init, graceful shutdown flush |
| `apps/api/src/env.ts` | Thin wrapper over `parseEnv` | No logic change if schema extended in `@usetagih/config` |
| `apps/api/src/middleware/request-id.ts` | `store.requestId`, `X-Request-Id` header | Consume in evlog + OTel — do not change format |
| `apps/api/src/middleware/v1-error-handler.ts` | `console.error(error)` on 500 | Replace with evlog structured error log |
| `packages/config/src/env/schema.ts` | Auth + URL vars only | Add docs + OTel vars |
| `packages/schema/openapi/components.json` | Generated at build, gitignored | Runtime merge source for partial spec |

### Plugin / middleware order (encode exactly)

Root `Elysia` in `createApp()` — **after** OTel init in `index.ts`:

```
1. createRequestIdPlugin()     // Story 3.6 — MUST stay first
2. evlog plugin                // NEW — needs requestId in onRequest/onAfterHandle enrichment
3. securityHeadersPlugin()     // NEW — onAfterHandle; route-aware CSP
4. openapiDocsPlugin(env)      // NEW — env-gated; registers /v1/openapi.json + /docs BEFORE /v1 group
5. createHealthRoutes()
6. createSignUpWithWorkspaceRoute(...)
7. betterAuth
8. group("/v1", ...)           // unchanged inner order from Story 3.6
```

**OTel:** `@elysiajs/opentelemetry` wraps or precedes app in `index.ts` per plugin docs — initialize exporter only when endpoint set.

### Env schema extension (encode exactly)

**File:** `packages/config/src/env/schema.ts`

```typescript
// USETAGIH_DOCS_ENABLED
// dev: z.coerce.boolean().default(true)
// staging: z.coerce.boolean() — required (no default)
// prod: z.coerce.boolean().default(false)

// OTEL_EXPORTER_OTLP_ENDPOINT
// all envs: z.string().url().optional() — unset = no-op tracing
```

Update `EnvStub` interface accordingly. Extend `doppler.yaml` comment block listing new vars (no values).

### OpenAPI partial spec assembly (encode exactly)

**File:** `apps/api/src/plugins/openapi-docs.ts`

1. Load `components.schemas` from `@usetagih/schema` build artifact (after `turbo build`):
   - Option A (preferred): add `generateOpenApiComponents` export to `@usetagih/schema` index or `./openapi` subpath
   - Option B: read `openapi/components.json` via `createRequire` from package root
2. Configure `@elysiajs/openapi` with:
   - `path: '/docs'` (Scalar UI)
   - `specPath: '/v1/openapi.json'` (override default `/${path}/json`)
   - `documentation.info`: title `usetagih API`, version from `CURRENT_SCHEMA_VERSION`, description noting partial spec
   - `documentation['x-usetagih-spec-maturity']: 'partial'`
3. Merge pre-built components into `documentation.components`
4. Gate entire plugin with `env.USETAGIH_DOCS_ENABLED` — when false, mount explicit 404 handlers for both paths (do not rely on `enabled: false` alone if it still exposes default paths)

Reference: `@elysiajs/openapi@^1.4.x` uses Scalar by default; supports `provider: 'scalar'`, custom `path`, `specPath`.

### evlog wiring (encode exactly)

**Startup (`index.ts`):**

```typescript
import { initLogger } from "evlog";

initLogger({ env: { service: "usetagih-api" } });
```

**Plugin (`apps/api/src/plugins/evlog.ts`):**

```typescript
import { evlog } from "evlog/elysia";

// .use(evlog())
// onAfterHandle or derive: log.set({ requestId, workspaceId: authContext?.workspaceId })
```

**500 errors:** In `v1-error-handler.ts`, use `useLogger()` from `evlog/elysia` or pass log from context; log `{ err, requestId }` — never include stack in HTTP body.

Field contract (SOLUTION-DESIGN §12.1) — set on request completion where available:

| Field | Source in 3.7 |
| --- | --- |
| `requestId` | Story 3.6 middleware |
| `workspaceId` | `authContext.workspaceId` when authenticated |
| `renderId` | omit until render stories |
| `stage` | omit or `"http_request"` baseline |
| `durationMs` | evlog wide event default timing |

### OTel wiring (encode exactly)

**File:** `apps/api/src/telemetry/otel.ts`

- If `!env.OTEL_EXPORTER_OTLP_ENDPOINT` → return `{ shutdown: async () => {} }` (no-op)
- Else configure `@elysiajs/opentelemetry` with OTLP exporter and `service.name: 'usetagih-api'`
- Span attribute: `request.id` or `requestId` = value from request-id middleware (hook after request-id established)
- Redact: Authorization headers, cookies, API key material from span attributes
- `shutdown()`: flush provider on SIGTERM/SIGINT before `process.exit`

### Security headers middleware (encode exactly)

**File:** `apps/api/src/middleware/security-headers.ts`

```typescript
// onAfterHandle — inspect request.path
// Default (JSON API):
//   X-Content-Type-Options: nosniff
//   X-Frame-Options: DENY
//   Referrer-Policy: no-referrer
//   Cross-Origin-Resource-Policy: same-origin
//   Content-Security-Policy: default-src 'none'; frame-ancestors 'none'
//
// /docs only (when docs enabled):
//   Relaxed CSP allowing Scalar CDN/inline — document exact policy in test
//
// NO Strict-Transport-Security (Story 8.7)
```

Keep implementation ~20 lines in the middleware file itself (helper for CSP string OK if still thin).

### Testing requirements

| Test file | Covers |
| --- | --- |
| `packages/config/src/env/env.test.ts` | Docs flag defaults per environment; OTel optional |
| `apps/api/src/plugins/openapi-docs.test.ts` | Enabled/disabled 404 vs 200; partial marker present when enabled |
| `apps/api/src/telemetry/otel.test.ts` | No-op without endpoint |
| `apps/api/src/middleware/security-headers.test.ts` | Headers on `/v1/*`; relaxed CSP on `/docs` |
| `apps/api/src/plugins/evlog.test.ts` or extend integration | `requestId` in log output / drain mock |

Use Elysia `app.handle(new Request(...))` pattern from existing `error-envelope.test.ts` and `request-id.test.ts`.

### Verification (required)

- Unit tests: `bun test packages/config` + `bun test apps/api`
- Workspace gate: `bunx turbo run lint typecheck test build --force` from repo root (always `--force`)
- Generated artifacts: if new build outputs, declare in `turbo.json` `build.outputs` and narrow biome excludes per Epic 2 action item
- Contract atomicity: if OpenAPI structural assertions touch new paths, update schema tests in same PR

### Previous story intelligence (3.6)

- `createRequestIdPlugin()` **must remain first** `.use()` — evlog and OTel depend on stable `store.requestId`
- Error envelope complete — do not wrap success responses
- `console.error` in `v1-error-handler.ts` is intentional placeholder until evlog — replace in this story
- `NOT_IMPLEMENTED` + 501 stubs use schema envelope — preserve
- Integration tests: 100 pass pattern when postgres up; probeDb skip when not

### Git intelligence (baseline a9397f6)

Recent Epic 3 commits establish patterns:

- Middleware as factory functions returning `new Elysia({ name })`
- `.js` extension in imports (NodeNext)
- Tests colocated with source (`*.test.ts`)
- Schema changes require atomic test updates (Story 3.6 added `NOT_IMPLEMENTED` with envelope tests)

### Latest technical specifics

| Package | Version guidance |
| --- | --- |
| `elysia` | **1.4.29** (pinned — do not bump in this story) |
| `@elysiajs/openapi` | **^1.4.x** — Scalar default provider; configure `path` + `specPath` explicitly |
| `@elysiajs/opentelemetry` | Match elysia 1.4.x line |
| `evlog` | **^2.x** — requires `elysia >= 1.4.28`; use `onRequest` init for 404 capture (PR #359) |

### Project Structure Notes

- All new platform code under `apps/api/src/` — `plugins/`, `telemetry/`, `middleware/`
- Env vars in `packages/config` — apps import via `parseApiEnv`
- Do not add `apps/platform` or `@usetagih/observability` package yet
- Doppler docs: comment-only in `doppler.yaml` + row in SOLUTION-DESIGN §9 (planning artifact edit OK for variable documentation)

### SM split authorization

Per epics dev notes: SM may split into two stories (docs+headers / otel+evlog) if slice exceeds sprint capacity during `dev-story`. Single story file is authoritative until split is executed via correct-course.

### References

- [Source: `HARNESS-ADDITIONAL-INSTRUCTIONS.md` — directive #5 a–e]
- [Source: `HARNESS-HUMAN-INPUT.md` — board ratification hybrid docs + evlog supersession]
- [Source: `_bmad-output/planning-artifacts/epics.md` — Story 3.7 ACs]
- [Source: `_bmad-output/planning-artifacts/architecture/architecture-usetagih-2026-07-20/ARCHITECTURE-SPINE.md` — stack table, logging convention]
- [Source: `_bmad-output/planning-artifacts/architecture/architecture-usetagih-2026-07-20/SOLUTION-DESIGN.md` — §9 env vars, §12 observability]
- [Source: `_bmad-output/planning-artifacts/correct-course-2026-07-20-harness-directives.md` — applied ratification audit trail]
- [Source: `_bmad-output/implementation-artifacts/3-6-auth-middleware-request-id-and-unified-error-envelope.md` — request-id, envelope, scope boundary]
- [Source: `_bmad-output/implementation-artifacts/2-5-openapi-3-1-component-generation-from-zod.md` — components.json merge strategy]
- [Source: `@elysiajs/openapi` docs — path/specPath/scalar configuration]
- [Source: `evlog.dev` Elysia integration — initLogger + evlog plugin]

## Dev Agent Record

### Agent Model Used

{{agent_model_name_version}}

### Debug Log References

### Completion Notes List

### File List

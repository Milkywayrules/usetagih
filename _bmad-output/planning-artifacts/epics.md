---
stepsCompleted:
  - step-01-validate-prerequisites
  - step-02-design-epics
  - step-03-create-stories
  - step-04-final-validation
inputDocuments:
  - _bmad-output/planning-artifacts/prds/prd-usetagih-2026-07-20/prd.md
  - _bmad-output/planning-artifacts/architecture/architecture-usetagih-2026-07-20/ARCHITECTURE-SPINE.md
  - _bmad-output/planning-artifacts/architecture/architecture-usetagih-2026-07-20/SOLUTION-DESIGN.md
  - _bmad-output/planning-artifacts/ux-designs/ux-usetagih-2026-07-20/DESIGN.md
  - _bmad-output/planning-artifacts/ux-designs/ux-usetagih-2026-07-20/EXPERIENCE.md
status: final
created: 2026-07-20
project: usetagih
gate: phase-3
headless: true
---

# usetagih - Epic Breakdown

## Overview

Phase-3 gate artifact decomposing PRD contract v1 (§10), architecture AD-1–AD-13, and UX spine (16 screens) into agent-implementable epics and stories. **Epic 1 (PDF pipeline spike) gates all feature epics.** Spike failure on any blocking AC halts downstream work and reopens the PDF engine decision at the board — no silent Chromium fallback (AD-10).

**Sequencing (board-ratified):** Epic 0 monorepo/CI → Epic 1 spike (gate) → Epic 2 schema → Epic 3 API core → Epic 4 async/webhooks → Epic 5 templates → Epic 6 web app → Epic 7 SDK/OpenAPI → Epic 8 launch readiness → Epic 9 MCP v1.1 (POST-MVP).

## Requirements Inventory

### Functional Requirements

```
FR-1: Unified document contract — discriminated union on documentType (invoice|quotation|receipt); OpenAPI DocumentPayload; path/body mismatch → 400 DOCUMENT_TYPE_MISMATCH; SDK validateLocally uses same Zod (AD-1).
FR-2: Explicit validation failures — structured errors with JSON Pointer path, code, message, expected/received; no render on failure; financial mismatches → 422 not silent correction.
FR-3: Schema version negotiation — optional schemaVersion default 2026-07-20; GET /v1/schemas authority; unknown version → 400 with supported list.
FR-4: Multi-currency and precision — ISO 4217; JPY no fractions; USD/EUR two decimals half-up; decimal strings only.
FR-5: Date and locale formatting — ISO 8601 dates; English labels in PDF; invalid dates fail validation.
FR-6: Template selection — enum modern|classic per document type; invalid → 400; two templates per type at launch.
FR-7: Deterministic PDF output — byte-identical for identical payload+template+schemaVersion; golden CI gate; trial workspace tier footer watermark via Typst tier=free input.
FR-8: Pagination and layout stability — ≥25 line items golden; headers/footers repeat; totals on final page.
FR-9: Tax and totals rendering — display matches payload per §10.1; LINE_TOTAL_MISMATCH and TAX_TOTAL_MISMATCH rejected pre-render.
FR-10: Preview before render — POST /v1/{documentType}/preview; same Typst engine as PDF; no artifact persist.
FR-11: Validate endpoint — POST /v1/{documentType}/validate; 200 normalizedPreview or 422 envelope.
FR-12: Render endpoint — sync 201 ≤100 items within 10s; async 202 otherwise; cap 500 line items; failed render stable error codes.
FR-13: Retrieve render metadata — GET /v1/renders/{renderId}; cross-tenant → 404.
FR-14: Download render artifact — GET /v1/renders/{renderId}/download; auth required; audit logged.
FR-15: List render history — GET /v1/renders paginated; default 20 max 100; metadata only.
FR-16: OpenAPI specification — published stable URL; Spectral CI; all MVP endpoints + error envelope.
FR-17: Rate limiting and quotas — 429 RATE_LIMITED with Retry-After; 402 QUOTA_EXCEEDED.
FR-18: Artifact upload to object storage — R2 on success; failed upload → render failed; checksum on download verify.
FR-19: Signed share URLs — default TTL 90d; shareTtlDays 1–365; DELETE /v1/renders/{renderId}/share revokes; expired → 403/branded page.
FR-20: Artifact lifecycle — retention ≥ share TTL + grace; cleanup job; re-render new idempotency key → new artifact.
FR-21: Multi-workspace auth — better-auth organization plugin (teams disabled) + mandatory first workspace; session activeOrganizationId; unauthenticated blocked from history/keys.
FR-22: API key issuance and scopes — POST/GET /v1/api-keys; scopes renders:read|write, webhooks:manage, audit:read; show-once secret; hashed at rest.
FR-23: API key revocation — DELETE /v1/api-keys/{keyId}; revoked → 401; audit logged.
FR-24: Idempotent render requests — Idempotency-Key header 1–255 ASCII; same key+payload → same renderId; different payload → 409; 24h window.
FR-25: Webhook registration — POST/GET/DELETE /v1/webhooks; events render.completed|render.failed; SSL validated; delete audited.
FR-26: Webhook delivery and retry — 8 attempts ~24h; stable eventId; HMAC X-Usetagih-Signature; auto-disable after 7d 100% failure.
FR-27: Audit event capture — login, key CRUD, validate, render, download, webhook, share revoke; GET /v1/audit paginated; append-only 90d view.
FR-28: Document creation form — web forms map 1:1 to contract; server validation authoritative.
FR-29: Preview and export actions — preview + render API; Playwright e2e create→preview→export per document type.
FR-30: Render history view — list matches API; re-download; expired link renewal guidance.
FR-31: Local validation — SDK validateLocally without network; errors match server fixtures.
FR-32: Render client — SDK render() auth, idempotency, 429 retry; integration test all types; README quickstart.
FR-33: MCP tool list_schemas — matches GET /v1/schemas (v1.1 POST-MVP).
FR-34: MCP tool validate_payload — REST validate parity (v1.1 POST-MVP).
FR-35: MCP tool render_document — same backend render path (v1.1 POST-MVP).
```

### NonFunctional Requirements

```
NFR-1: Render API P95 ≤2s for ≤100 line items sync path.
NFR-2: 99.5% monthly uptime API + share link resolution.
NFR-3: HTTPS only; HSTS in production.
NFR-4: No secrets in repo; Doppler runtime injection.
NFR-5: Per-workspace data isolation; cross-workspace → 404.
NFR-6: Golden-file PDF tests block CI merge on drift (AD-3, AD-10).
NFR-7: Unified error envelope all endpoints (AD-11).
NFR-8: Structured logs + render/webhook metrics.
NFR-9: WCAG 2.1 AA on create/preview/export flows.
NFR-10: Schema breaking changes need new version + 90d deprecation.
NFR-11: Audit log append-only; no user delete at MVP.
NFR-12: Rate limits per API key; documented defaults + headers.
```

### Additional Requirements

```
- AD-1: Single canonical contract in packages/schema only; no duplicate Zod in apps.
- AD-2: apps/web and apps/mcp call public REST only; POST /v1/session/token for browser API access.
- AD-3: Typst 0.15.x pinned; vendored fonts; --ignore-system-fonts; SOURCE_DATE_EPOCH + #set document(date: none).
- AD-4: Sync/async contract; pg-boss separate worker container; idempotent job handlers.
- AD-5: Idempotency hash workspaceId+endpoint+key; validation rejects arithmetic mismatches pre-render.
- AD-6: R2 path renders/{workspaceId}/{renderId}.pdf; share HMAC TTL; artifact retention ≥ TTL+7d.
- AD-7: better-auth + organization plugin (teams disabled); API keys argon2 hashed; session token ≤15min audience-bound CSRF; logo SSRF hardening.
- AD-8: Webhook retry schedule 30s,2m,10m,30m,1h,3h,8h,12h + jitter; terminal 4xx no retry.
- AD-9: Next.js 15 App Router + Mantine v8; no server actions bypassing API validation.
- AD-10: Epic 1 spike blocking ACs — 25-line pagination, logo determinism PNG/JPEG/SVG, multi-page SVG preview parity, golden soak ≥100 iterations in CI Docker; failure reopens engine decision.
- AD-11: Error envelope { error: { code, message, requestId, details[] } }; one code → one HTTP status.
- AD-12: Support N and N-1 schema versions 90 days; SDK warns on version drift.
- Monorepo: turborepo; Bun 1.2.x; packages/core must not depend on packages/db or packages/render directly.
- CI: GitHub Actions lint/typecheck/unit/openapi/build/e2e; pdf-golden.yml; docker-push to GHCR on main.
- Deploy: Coolify pulls prebuilt GHCR images; never build on prod VPS; migrate pre-deploy hook.
- Local dev: docker/compose.yml postgres:16 + minio R2 emulation.
- apps/mcp: package.json stub + README at MVP only; preserved v1.1 path.
- packages/templates/CONTRIBUTING.md prerequisite before parallel template stories merge.
- Worker: SIGTERM graceful drain ≤30s integration test.
- Launch: uptime monitoring, restart policies, postgres restore drill, umami self-hosted.
```

### UX Design Requirements

```
UX-DR1: Port DESIGN.md tokens to apps/web/theme/tokens.ts → Mantine createTheme (primary navy, accent teal render actions only).
UX-DR2: AppShell navbar/header per DESIGN.md components; responsive Drawer nav <md (EXPERIENCE.md).
UX-DR3: SCR-LANDING marketing-lite hero + 3 feature cards + code snippet + footer guardrail copy.
UX-DR4: SCR-AUTH-SIGNIN/SIGNUP/RESET — centered Paper 420px; email + GitHub OAuth; better-auth errors in Alert.
UX-DR5: SCR-DASHBOARD — quick-action cards + recent 5 renders DataTable skeleton/empty states.
UX-DR6: SCR-DOC-CREATE 4-step Stepper (type→template→details→preview/export); split pane lg+; schema-driven form with JSON Pointer field errors in mono.
UX-DR7: Preview pane states idle/validating/valid/invalid; debounced 500ms refresh; iframe title for a11y.
UX-DR8: Render success panel — green Alert, accent Export button, CopyButton share URL, history anchor.
UX-DR9: SCR-DOC-HISTORY + SCR-DOC-DETAIL — mantine-datatable server pagination; expired link Badge orange + re-render guidance.
UX-DR10: SCR-TEMPLATE-GALLERY — Tabs per document type; 2 cards; deep-link to create with type+template query params.
UX-DR11: SCR-API-KEYS — create Modal with Checkbox.Group scopes; show-once secret Code block; revoke confirm Modal.
UX-DR12: SCR-AUDIT-LOG — 90-day note; filters; mono resource IDs; stripe rows per DESIGN.md.
UX-DR13: SCR-SETTINGS — Tabs Business|Branding|Account; Dropzone logo max 2MB PNG/JPEG/SVG; ColorInput accent.
UX-DR14: SCR-SHARE-PUBLIC — centered sm Container; metadata Paper; Download CTA; expired/invalid states; no payment CTA.
UX-DR15: Validation error UX — field path Code adjacent to label; summary Alert ≥3 errors; never silent total correction.
UX-DR16: WCAG 2.1 AA — labels, aria-describedby errors, aria-live validation, aria-current stepper, contrast ≥4.5:1, prefers-reduced-motion.
UX-DR17: Line items responsive — Table md+; card-per-row <sm; min 1 row; add/remove ActionIcons.
UX-DR18: Idempotency-Key uuid v4 per export click in web UI session storage.
UX-DR19: Voice/tone — infrastructure copy; "Document history" not "Your invoices"; no emoji celebration.
UX-DR20: All 16 screens from EXPERIENCE.md route map implemented with API action map parity.
```

### FR Coverage Map

```
FR-1: Epic 2 — Canonical Zod contract package
FR-2: Epic 2, Epic 3 — Validation use-case + API validate/preview/render paths
FR-3: Epic 2, Epic 3 — Schema version helpers + GET /v1/schemas
FR-4: Epic 2 — Currency/date validators in packages/schema
FR-5: Epic 2, Epic 5 — Date validation + template English labels in golden fixtures
FR-6: Epic 1, Epic 5 — Spike invoice/modern + remaining 5 templates
FR-7: Epic 1, Epic 3, Epic 5 — Spike golden gate + sync render watermark + template goldens
FR-8: Epic 1, Epic 5 — Spike 25-line fixture + template pagination goldens
FR-9: Epic 2, Epic 3, Epic 5 — Arithmetic rules + render display + golden tax cases
FR-10: Epic 1, Epic 3 — Spike SVG preview + POST preview endpoint
FR-11: Epic 3 — POST /v1/{documentType}/validate
FR-12: Epic 3, Epic 4 — Sync render Epic 3; async path Epic 4
FR-13: Epic 3 — GET /v1/renders/{renderId}
FR-14: Epic 3 — GET /v1/renders/{renderId}/download
FR-15: Epic 3 — GET /v1/renders list
FR-16: Epic 7 — OpenAPI publish + Spectral CI
FR-17: Epic 3 — Rate limit + quota middleware
FR-18: Epic 3 — R2 artifact upload
FR-19: Epic 3 — Share URL sign/revoke + public resolver
FR-20: Epic 4 — Artifact cleanup job + retention docs
FR-21: Epic 3 — better-auth registration/login
FR-22: Epic 3 — API key create/list
FR-23: Epic 3 — API key revoke
FR-24: Epic 3 — Idempotency middleware
FR-25: Epic 4 — Webhook CRUD
FR-26: Epic 4 — Webhook delivery worker
FR-27: Epic 3 — Audit capture + GET /v1/audit
FR-28: Epic 6 — SCR-DOC-CREATE schema form
FR-29: Epic 6 — Preview/export UI + Playwright e2e
FR-30: Epic 6 — SCR-DOC-HISTORY + SCR-DOC-DETAIL
FR-31: Epic 7 — SDK validateLocally
FR-32: Epic 7 — SDK render client
FR-33: Epic 9 (POST-MVP) — MCP list_schemas
FR-34: Epic 9 (POST-MVP) — MCP validate_payload
FR-35: Epic 9 (POST-MVP) — MCP render_document
```

## Epic List

### Epic 0: Monorepo & CI Foundation
Establish turborepo monorepo, shared tooling, local docker compose, and GitHub Actions CI so all packages build and test consistently before the PDF spike.
**FRs covered:** (enables all) **Gated by:** none **Gates:** Epic 1

### Epic 1: PDF Pipeline Spike (BLOCKING GATE)
Prove Typst 0.15.x renders invoice/modern deterministically with all board blocking ACs. **Failure on any criterion halts all feature epics and reopens engine decision at board.**
**FRs covered:** FR-6, FR-7, FR-8, FR-10 (partial) **Gated by:** Epic 0 **Gates:** Epics 2–8

### Epic 2: Canonical Schema & Contract Package
Implement packages/schema Zod discriminated union, business rules, error codes, and OpenAPI component generation per PRD §10.1.
**FRs covered:** FR-1, FR-2, FR-3, FR-4, FR-5 (validation) **Gated by:** Epic 1 **Gates:** Epic 3

### Epic 3: API Core — Auth, Keys, Idempotency, Sync Render, Share, Audit
Elysia REST API composition root: better-auth, POST /v1/session/token, API keys, idempotency, validate/preview/sync-render, R2 artifacts, share links, audit, rate limits, settings endpoints.
**FRs covered:** FR-2, FR-3, FR-5, FR-7, FR-9, FR-10, FR-11, FR-12 (sync), FR-13–FR-15, FR-17–FR-19, FR-21–FR-24, FR-27 **Gated by:** Epic 2 **Gates:** Epics 4–7

### Epic 4: Async Render Path, Webhooks & Artifact Lifecycle
pg-boss worker container, async 202 render path, webhook registration/delivery/retry, artifact cleanup cron.
**FRs covered:** FR-12 (async), FR-20, FR-25, FR-26 **Gated by:** Epic 3 **Gates:** Epic 8

### Epic 5: Document Templates (6 Curated Styles)
CONTRIBUTING.md prerequisite, then invoice/classic + quotation/receipt × modern/classic with golden fixtures per template.
**FRs covered:** FR-5, FR-6, FR-7, FR-8, FR-9 **Gated by:** Epic 1, Epic 3 **Gates:** Epic 6 quality bar

### Epic 6: Web Application (16 Screens)
Next.js 15 Mantine thin API consumer implementing all EXPERIENCE.md screens with Playwright UJ-1 e2e.
**FRs covered:** FR-28, FR-29, FR-30 **Gated by:** Epic 3 (session token), Epic 5 (templates) **Gates:** Epic 8

### Epic 7: TypeScript SDK & OpenAPI Publishing
@usetagih/sdk validateLocally + render client; published OpenAPI 3.1 with Spectral CI.
**FRs covered:** FR-1, FR-16, FR-31, FR-32 **Gated by:** Epic 3 **Gates:** Epic 8

### Epic 8: Launch Readiness & Production Deploy
GHCR deploy via Coolify, uptime monitoring, restore drill, restart policies, umami, observability, HSTS.
**FRs covered:** (NFR-1–NFR-4, NFR-8, NFR-2 launch proof) **Gated by:** Epics 3–7 **Gates:** production traffic

### Epic 9: MCP v1.1 Adapter — POST-MVP / NOT IN SPRINT
Preserved thin MCP wrapper over REST; max 5 tools. **Explicitly fenced out of MVP sprint.**
**FRs covered:** FR-33, FR-34, FR-35 **Gated by:** Epic 7 **Gates:** v1.1 release

---

## Epic 0: Monorepo & CI Foundation

Establish the build substrate so packages compile, lint, and run locally before the Typst spike.

### Story 0.1: Initialize turborepo monorepo workspace

As a developer,
I want a Bun+turborepo monorepo scaffold matching ARCHITECTURE-SPINE structural seed,
So that all apps and packages share one workspace root.

**Acceptance Criteria:**

**Given** an empty repo root
**When** workspace is initialized per SOLUTION-DESIGN §6
**Then** root `package.json` declares workspaces `apps/*` and `packages/*`, `turbo.json` defines `lint`, `typecheck`, `test`, `build` pipelines, and Bun 1.2.x is pinned
**And** stub directories exist: `apps/api`, `apps/web`, `apps/mcp`, `packages/schema`, `packages/core`, `packages/render`, `packages/templates`, `packages/sdk`, `packages/db`, `packages/config`
**And** `bun install` succeeds with zero errors
**And** `apps/mcp/README.md` states v1.1 deferred REST-only wrapper (AD-2, POST-MVP preservation)

### Story 0.2: Shared TypeScript and Biome config package

As a developer,
I want shared `packages/config` for tsconfig and Biome/ultracite,
So that all packages use consistent lint and compile settings (NFR quality baseline).

**Acceptance Criteria:**

**Given** Story 0.1 complete
**When** `packages/config` is added with `tsconfig/base.json` and extended biome config
**Then** each workspace package extends shared tsconfig
**And** root `bun run lint` executes Biome across workspaces via turbo
**And** bun test placeholder passes in at least one package

### Story 0.3: Local Docker Compose for Postgres and MinIO

As a developer,
I want `docker/compose.yml` with Postgres 16 and MinIO,
So that API development can run against local DB and R2-compatible storage (SOLUTION-DESIGN §8).

**Acceptance Criteria:**

**Given** Docker available locally
**When** `docker compose -f docker/compose.yml up -d postgres minio createbuckets` runs
**Then** Postgres listens on 5432 and MinIO S3 API on 9000 with bucket `usetagih-artifacts`
**And** `docker/compose.yml` documents R2 emulation env vars (`R2_FORCE_PATH_STYLE=true`) per SOLUTION-DESIGN §8.3
**And** compose file includes placeholder services for api/web (build stubs acceptable)

### Story 0.4: GitHub Actions CI workflow

As a developer,
I want `.github/workflows/ci.yml` running lint, typecheck, unit tests, OpenAPI spectral stub, and build,
So that every PR validates code quality before merge (AD CI seed).

**Acceptance Criteria:**

**Given** Story 0.1–0.2 complete
**When** CI workflow triggers on push/PR
**Then** jobs run: `lint`, `typecheck`, `unit` (`bun test`), `build` (`turbo build`) using `oven-sh/setup-bun@v2` with Bun 1.2.x
**And** OpenAPI job placeholder exists (Spectral wired in Epic 7)
**And** CI passes on main with current stubs

### Story 0.5: GHCR Docker build-and-push workflow skeleton

As an operator,
I want GitHub Actions to build and push API/web/render-ci images to GHCR on main merge,
So that Coolify can pull prebuilt images (SOLUTION-DESIGN §11.2, deploy constraint).

**Acceptance Criteria:**

**Given** `docker/Dockerfile.api`, `docker/Dockerfile.web`, `docker/Dockerfile.render-ci` stub files exist
**When** push to `main` occurs
**Then** workflow builds and pushes `ghcr.io/verasic-labs/usetagih-api`, `usetagih-web`, `usetagih-render-ci` with immutable tags
**And** workflow documents that production Coolify never builds on VPS
**And** dry-run or manual dispatch succeeds without secrets committed (NFR-4)

### Story 0.6: Doppler project mapping and env validation scaffold

As a developer,
I want `doppler.yaml` and env validation stub,
So that secrets are injected at runtime never committed (NFR-4, AD consistency).

**Acceptance Criteria:**

**Given** Doppler project `usetagih` configs `dev|staging|prod`
**When** `doppler.yaml` documents project mapping
**Then** no secret values exist in git
**And** `packages/config` exports Zod env schema stub for `DATABASE_URL`, `USETAGIH_API_PUBLIC_URL` per SOLUTION-DESIGN §9
**And** bun test covers env schema rejects missing required prod vars

---

## Epic 1: PDF Pipeline Spike (BLOCKING GATE)

**EXIT CONDITION:** If any blocking AC below fails in CI Docker (`Dockerfile.render-ci` amd64), **halt all feature epics (2–8)**, document failure in `packages/render/SPIKE-RESULT.md`, and escalate to decision board to reopen PDF engine choice. **No Chromium or pixel-golden fallback permitted (AD-10, FR-7).**

### Story 1.1: Pin Typst 0.15.x, font bundle, and shared preamble

As a render engineer,
I want Typst 0.15.x exact patch pinned with vendored OFL fonts and deterministic preamble,
So that PDF output is byte-stable across environments (AD-3, FR-7).

**Acceptance Criteria:**

**Given** `packages/render/typst-version.txt` pins exact 0.15.x patch
**When** `packages/render/fonts/` contains Inter + JetBrains Mono vendored TTF/OTF and `packages/templates/_shared/preamble.typ` includes `#set document(date: none)` plus font setup
**Then** `manifest.json` records typst binary checksum and planned container digest
**And** render driver invokes Typst with `--ignore-system-fonts` and `SOURCE_DATE_EPOCH=1700000000` in CI
**And** bun test verifies preamble file contains required determinism directives

### Story 1.2: Invoice modern Typst template and basic fixture

As a product owner,
I want `packages/templates/invoice/modern.typ` rendering a basic USD invoice fixture,
So that the spike proves template+engine viability (FR-6, FR-9 partial).

**Acceptance Criteria:**

**Given** fixture `packages/render/__fixtures__/payloads/invoice-modern-basic.json` (≤5 line items, single tax) conforming to PRD §10.1
**When** harness renders via Typst driver with `tier=free` input flag
**Then** PDF includes footer `Rendered with usetagih · usetagih.com` at ~8pt gray (FR-7, §11 OQ-2)
**And** displayed totals match payload values exactly — no silent recomputation (FR-9, AD-5)
**And** golden SHA-256 hash file `packages/render/__fixtures__/golden/invoice-modern-basic.sha256` is committed

### Story 1.3: Golden harness CLI (`golden:check`)

As a CI engineer,
I want `packages/render/scripts/golden-check.ts` comparing rendered PDF SHA-256 to manifest,
So that determinism regressions block merge (NFR-6, AD-3).

**Acceptance Criteria:**

**Given** `manifest.json` lists fixtures with expected sha256, typstVersion, schemaVersion
**When** `bun run --filter @usetagih/render golden:check` executes
**Then** exit code 0 on match; exit 1 on mismatch with size and first-bytes hex diff
**And** package.json scripts include `golden:render`, `golden:check`, `golden:soak`, `golden:update`
**And** bun test covers manifest parsing and hash comparison logic

### Story 1.4: CI Docker render-ci image and pdf-golden workflow

As a CI engineer,
I want `docker/Dockerfile.render-ci` and `.github/workflows/pdf-golden.yml`,
So that golden checks run only in authoritative linux/amd64 container (AD-3, SOLUTION-DESIGN §3.5).

**Acceptance Criteria:**

**Given** Dockerfile FROM debian:bookworm-slim installs pinned Typst .deb with checksum verify + copies fonts
**When** pdf-golden workflow runs on PR affecting `packages/render` or `packages/templates`
**Then** job uses container `ghcr.io/verasic-labs/usetagih-render-ci:2026-07-20` (or built equivalent)
**And** `bun run --filter @usetagih/render golden:check` exits 0
**And** local dev golden:check documented as advisory only outside CI Docker

### Story 1.5: 25-line-item pagination fixture (FR-8 blocking)

As a QA engineer,
I want a 25-line-item invoice fixture with golden hash proving clean page breaks,
So that pagination stability is proven before feature work (FR-8, AD-10 blocking #2).

**Acceptance Criteria:**

**Given** fixture `invoice-modern-pagination-25.json` with exactly 25 line items
**When** rendered in CI Docker via `golden:check`
**Then** SHA-256 matches committed golden hash
**And** automated test asserts PDF page count ≥2 and no clipped totals on final page (parse PDF page count via lightweight library or typst metadata)
**And** failure fails CI and triggers spike exit condition

### Story 1.6: Logo determinism fixture — PNG, JPEG, SVG (blocking)

As a security engineer,
I want logo rendering from persisted immutable bytes with checksum for PNG/JPEG/SVG,
So that logo fetch does not break determinism (AD-7, AD-10 blocking #3, FR-7).

**Acceptance Criteria:**

**Given** fixtures embed logos as local persisted bytes (base64 in JSON — no network in CI) for PNG, JPEG, SVG variants
**When** each fixture renders twice in CI Docker
**Then** identical SHA-256 hashes both runs per format
**And** render record model stub documents `logo_checksum` field populated from persisted bytes
**And** SVG fixture rejects/strips active content (`<script>`, event handlers, foreignObject) per SOLUTION-DESIGN §4.4
**And** failure fails CI and triggers spike exit condition

### Story 1.7: Multi-page SVG preview with PDF page-count parity (blocking)

As a frontend engineer,
I want Typst `--format svg` preview producing one SVG per page matching PDF page count,
So that FR-10 preview uses same engine without HTML fallback (AD-10 blocking #4, FR-10).

**Acceptance Criteria:**

**Given** pagination fixture from Story 1.5
**When** preview harness compiles same `.typ` with `--format svg` to `page-{n}.svg` (1-indexed, zero-padded)
**Then** SVG page count equals PDF page count
**And** pages sorted ascending; response shape documented: `{ pageCount, pages: [{ index, svg }] }` per SOLUTION-DESIGN §4.2
**And** SVG sanitization strips `<script>`, event handlers, external refs; bun test rejects dirty SVG
**And** temp SVG dir cleaned in `finally` block
**And** failure fails CI and triggers spike exit condition

### Story 1.8: Determinism soak ≥100 consecutive iterations (blocking)

As a CI engineer,
I want `golden:soak --iterations 100` with zero hash drift in CI Docker,
So that flake and float instability is caught (AD-10 blocking #5, NFR-6).

**Acceptance Criteria:**

**Given** pdf-golden workflow includes soak step
**When** `bun run --filter @usetagih/render golden:soak --iterations 100` runs in CI Docker on basic + pagination fixtures
**Then** all 100 iterations produce identical SHA-256 for each fixture
**And** any drift exits non-zero and triggers spike exit condition
**And** soak duration logged in CI output for baseline tracking

### Story 1.9: Spike gate documentation and board escalation protocol

As a tech lead,
I want explicit spike pass/fail gate artifact,
So that agents know to halt when engine proof fails (AD-10).

**Acceptance Criteria:**

**Given** all Stories 1.1–1.8 implemented
**When** spike completes
**Then** `packages/render/SPIKE-RESULT.md` records PASS or FAIL with CI run link, typst version, container digest, and hash manifest snapshot
**And** README in `packages/render/` states: FAIL → stop Epics 2–8, reopen engine decision at board, no Chromium fallback
**And** turbo pipeline includes optional `spike:gate` script that reads SPIKE-RESULT.md status
**And** on PASS, Epic 2+ work is unblocked

---

## Epic 2: Canonical Schema & Contract Package

Implement the single source of truth for validation shared by API, SDK, and web forms.

### Story 2.1: Document payload Zod discriminated union

As an integrator,
I want `packages/schema` exporting DocumentPayload union per PRD §10.1,
So that all runtimes parse identical contract (FR-1, AD-1).

**Acceptance Criteria:**

**Given** types for Money, Party, Address, LineItem, TaxLine, Branding, BaseDocumentPayload, Invoice|Quotation|Receipt payloads
**When** Zod schemas parse valid fixtures for all three document types
**Then** `documentType` discriminant enforced; cross-type fields rejected
**And** path/body mismatch helper returns `DOCUMENT_TYPE_MISMATCH` code
**And** bun test covers valid payloads and discriminant rejection cases

### Story 2.2: Business-rule validators for arithmetic integrity

As an integrator,
I want validation rejecting LINE_TOTAL_MISMATCH and TAX_TOTAL_MISMATCH,
So that financial values are never silently corrected (FR-2, FR-9, AD-5, §10.1 rules).

**Acceptance Criteria:**

**Given** payload with wrong lineTotal vs quantity×unitPrice half-up to currency minor units
**When** business validator runs
**Then** error at path `/lineItems/{n}/lineTotal` code `LINE_TOTAL_MISMATCH` with expected/received
**And** taxTotal vs sum(taxLines) mismatch → `/totals/taxTotal` `TAX_TOTAL_MISMATCH`
**And** JPY rejects fractional amounts; USD accepts 2 decimals (FR-4)
**And** quantity beyond 3 fractional digits rejected not rounded
**And** bun test uses ≥10 seeded failure fixtures targeting SM-2 clarity benchmark paths

### Story 2.3: Error codes enum and API error envelope types

As an SDK consumer,
I want typed error codes mapping 1:1 to HTTP statuses,
So that clients handle failures consistently (FR-2, NFR-7, AD-11).

**Acceptance Criteria:**

**Given** `packages/schema/src/errors/` enumerates codes: VALIDATION_FAILED, DOCUMENT_TYPE_MISMATCH, LINE_TOTAL_MISMATCH, TAX_TOTAL_MISMATCH, RATE_LIMITED, QUOTA_EXCEEDED, etc.
**When** envelope builder creates `{ error: { code, message, requestId, details[] } }`
**Then** each code maps to exactly one HTTP status per PRD §10.3
**And** details include JSON Pointer paths, optional expected/received
**And** bun test asserts no bare string errors exported from schema helpers

### Story 2.4: Schema version negotiation helpers

As an agent developer,
I want schemaVersion default `2026-07-20` with unsupported version rejection,
So that contract upgrades are explicit (FR-3, AD-12, NFR-10).

**Acceptance Criteria:**

**Given** payload omitting schemaVersion
**When** parser runs
**Then** defaults to `2026-07-20`
**And** unknown version yields 400 with supported versions list in message
**And** `getSchemaMetadata()` returns current version, document types, template enums for GET /v1/schemas

### Story 2.5: OpenAPI 3.1 component generation from Zod

As an integrator,
I want OpenAPI DocumentPayload components generated from schema package,
So that spec cannot drift from validation (FR-1, FR-16 partial, AD-1).

**Acceptance Criteria:**

**Given** `@asteasolutions/zod-to-openapi` setup in `packages/schema/src/openapi/`
**When** generator runs at build
**Then** OpenAPI includes discriminated union DocumentPayload, error envelope, Money decimal string pattern
**And** template enum documents modern|classic per type
**And** bun test snapshot or structural test verifies key paths exist

### Story 2.6: Shared validation fixture test suite

As a QA engineer,
I want cross-package fixture tests proving schema completeness,
So that Epic 3 API inherits trusted validation (FR-2, SM-2 prep).

**Acceptance Criteria:**

**Given** fixtures in `packages/schema/__fixtures__/` including valid all-types and ≥20 failure cases
**When** `bun test` runs in packages/schema
**Then** 100% expected pass/fail outcomes
**And** failure fixtures include path+code for ≥90% cases (SM-2 target)
**And** no duplicate Zod definitions exist outside packages/schema (grep CI check optional)

---

## Epic 3: API Core — Auth, Keys, Idempotency, Sync Render, Share, Audit

Composition root wiring Drizzle, R2, Typst driver, and core use-cases into Elysia REST API.

### Story 3.1: Drizzle database schema and migrations for core tables

As a backend developer,
I want PostgreSQL tables for better-auth organization plugin, workspace_settings, api_keys, renders, idempotency_keys, audit_events, usage_counters,
So that API core can persist workspace-scoped metadata (SOLUTION-DESIGN §7, AD-6).

**Acceptance Criteria:**

**Given** `packages/db/src/schema/` with Drizzle models matching SOLUTION-DESIGN §7.1
**When** `bun run --filter @usetagih/db migrate` runs against compose Postgres
**Then** tables created: better-auth organization plugin tables (`organization`, `member`, `session`, etc.) with teams disabled; `workspace_settings` (organization id PK, tier enum `trial`|`starter`|`pro`|`business`, branding); `api_keys` (workspace_id FK); `renders` (workspace_id FK, snapshot columns for tier/watermark/branding/logo_checksum); `idempotency_keys` (workspace_id); `audit_events` (workspace_id + user_id actor, nullable workspace_id only for signup/login/bootstrap); `usage_counters` (workspace_id)
**And** no duplicate `workspaces` table — better-auth `organization` is workspace identity
**And** bun test covers workspace-scoped render repo queries and cross-workspace isolation
**And** only tables needed for Epic 3 created — webhooks tables deferred to Epic 4

### Story 3.2: packages/core ports and validate use-case

As an architect,
I want hexagonal ports in packages/core with validate use-case,
So that route handlers stay thin (AD-1, FR-11).

**Acceptance Criteria:**

**Given** `packages/core/src/ports/` interfaces: RenderRepo, ArtifactStore, AuditRepo, IdempotencyStore (no direct db/render imports in core)
**When** ValidateUseCase executes against packages/schema
**Then** returns `{ valid: true, normalizedPreview }` or structured errors
**And** packages/core depends only on packages/schema (dependency graph AD-1)
**And** bun test covers validate use-case with schema fixtures

### Story 3.3: better-auth registration, login, and session middleware

As a direct user (Maya),
I want email/password and GitHub OAuth auth via better-auth,
So that I can access the web app securely (FR-21, AD-7).

**Acceptance Criteria:**

**Given** better-auth mounted at `apps/api` `/api/auth/*` with Drizzle adapter
**When** user registers via email or GitHub OAuth
**Then** session cookie issued; unauthenticated requests to `/v1/renders` return 401
**And** better-auth organization plugin enabled with `teams` disabled; invitation, member-add/remove, join, and team operations explicitly disabled/rejected
**And** signup flow includes mandatory first workspace creation (name, slug)
**And** user cannot access `/v1/renders` until ≥1 workspace exists and active org set
**And** password reset flows work per better-auth defaults
**And** bun test/integration covers register + create workspace + session.activeOrganizationId set
**And** integration test: workspace cannot gain a second member via any better-auth org API
**And** login event appended to audit_events (FR-27 partial)

### Story 3.4: POST /v1/session/token — short-lived audience-bound CSRF-protected Bearer

As a web app developer,
I want session-to-Bearer token exchange with scope parity to API keys,
So that browser calls public API without exposing long-lived secrets (AD-2, AD-7, SOLUTION-DESIGN §15).

**Acceptance Criteria:**

**Given** authenticated better-auth session and valid CSRF token (double-submit cookie or SameSite + custom header)
**When** `POST /v1/session/token` is called
**Then** returns Bearer token TTL ≤15 minutes, audience-bound to `USETAGIH_WEB_PUBLIC_URL`, carrying active `workspaceId`
**And** token scopes exactly match API key scope enum: renders:read, renders:write, webhooks:manage, audit:read
**And** middleware validates token workspace matches resource workspace scope on all `/v1/*` routes
**And** workspace filtering propagates through render, idempotency, audit, settings, webhook delivery, worker jobs, and structured log contexts
**And** scope-parity test matrix in `apps/api/src/routes/v1/session.token.test.ts` asserts each scope grants/denies same endpoints as API key equivalent
**And** missing/invalid CSRF returns 403
**And** expired session returns 401
**And** no browser-exposed long-lived API key storage pattern exists in web stub docs

### Story 3.5: API key create, list, and revoke endpoints

As an embed integrator (Alex),
I want POST/GET/DELETE /v1/api-keys with scoped show-once secrets,
So that I can authenticate REST calls (FR-22, FR-23, AD-7).

**Acceptance Criteria:**

**Given** authenticated workspace owner (session active org or API key workspace context)
**When** `POST /v1/api-keys` with name, scopes[], optional expiresAt
**Then** response includes full secret once; only prefix+hash stored
**And** `GET /v1/api-keys` lists metadata without secrets
**And** `DELETE /v1/api-keys/{keyId}` revokes immediately; next request with key returns 401
**And** insufficient scope on endpoint returns 403 with required scope hint
**And** create/revoke audit logged (FR-27)
**And** bun test covers hash-at-rest never stores plaintext

### Story 3.6: Auth middleware, request-id, and unified error envelope

As an API consumer,
I want Bearer auth middleware and consistent errors on all routes,
So that integration is predictable (NFR-7, AD-11, NFR-5).

**Acceptance Criteria:**

**Given** Elysia middleware chain
**When** any v1 route errors — including framework validation errors, unknown routes (`NOT_FOUND`), and internal/unhandled errors
**Then** response matches PRD §10.3 envelope built exclusively via `@usetagih/schema` helpers `buildApiErrorEnvelope` and `getHttpStatusForErrorCode` — no re-derived error shapes in apps
**And** every error response includes `requestId` prefix `req_` propagated from request-id middleware (response header + envelope field)
**And** error bodies never leak stack traces or internal exception messages in production-shaped responses
**And** inline ad-hoc error envelopes are removed and replaced — auth mount, workspace-guard, and `app.ts` 501 stub included
**And** success response bodies remain flat per PRD (standardization applies to errors only)
**And** API key and session token both authenticate via Authorization Bearer
**And** cross-workspace resource access returns 404 not 403 (NFR-5)
**And** bun test covers 401/403/404 mapping, validation envelope, unknown-route envelope, and internal-error envelope without stack leakage

### Story 3.7: Elysia platform baseline

As an API operator,
I want OpenAPI docs, telemetry, structured request logging, and security headers wired at the platform layer,
So that integrators and ops get baseline observability and hardening before feature routes land (NFR-7, NFR-8, AD-11).

**Acceptance Criteria:**

**Given** `@elysiajs/openapi` configured in `apps/api` with explicit paths (not default `/openapi` only)
**When** `USETAGIH_DOCS_ENABLED=true` (validated in `parseApiEnv` like existing vars; default enabled in dev; explicitly enabled in staging; fail-closed 404 in production until Story 7.4 + Epic 8 launch gate)
**Then** `GET /v1/openapi.json` serves spec JSON and `/docs` serves Scalar UI — both unauthenticated when enabled; both return 404 when disabled
**And** pre-Epic-7 spec merges `@usetagih/schema` OpenAPI components with Elysia route stubs and carries explicit partial-maturity marker (`info.description` or `x-usetagih-spec-maturity: partial`)
**And** bun test asserts docs disabled → 404 on both routes

**Given** `@elysiajs/opentelemetry` initialized before app construction
**When** `OTEL_EXPORTER_OTLP_ENDPOINT` is unset
**Then** tracing is a no-op (no export, no startup failure)
**And** when endpoint is set, traces/spans export with `service.name=usetagih-api`, sensitive attributes redacted, `requestId` propagated as trace attribute (after Story 3.6), and flush on shutdown
**And** no OTel metrics until post-MVP — log-derived metrics remain primary per SOLUTION-DESIGN §12
**And** bun test asserts OTel no-op without configuration

**Given** `evlog` with `evlog/elysia` plugin wired in `apps/api`
**When** any request is handled
**Then** structured request/event logs emit JSON with ratified field contract: `requestId`, `workspaceId`, `renderId`, `stage`, `durationMs` (via `log.set()` where applicable)
**And** `requestId` wired to Story 3.6 middleware; redaction, sampling, batching/retry, and flush-on-shutdown per evlog defaults; version pinned in `apps/api/package.json`
**And** `OTEL_EXPORTER_OTLP_ENDPOINT` and `USETAGIH_DOCS_ENABLED` added to `parseApiEnv` + Doppler stub docs

**Given** thin custom Elysia `onAfterHandle` security-header middleware (~20 lines, no third-party helmet port)
**When** any JSON API route responds
**Then** headers include `X-Content-Type-Options`, `X-Frame-Options`/`frame-ancestors`, `Referrer-Policy`, `Cross-Origin-Resource-Policy`, and strict CSP appropriate for JSON
**And** Scalar `/docs` HTML route alone receives tested CSP relaxation for inline script/style — API-wide CSP is not weakened for the UI
**And** no app-level HSTS (proxy owns HSTS per Story 8.7)
**And** bun test asserts required security headers on API routes and correct Scalar-route CSP

**Dev notes:** SM pre-authorized to split into two stories (docs+headers / otel+evlog) if slice exceeds sprint capacity. Code review must enforce open Epic 2 action items: generated-artifact checklist (`turbo.json` outputs + narrow biome exclude), contract-test atomicity (OpenAPI structural tests + runtime Zod), and turbo parallel test timeout budget for typst/render tests. All wiring stays in `apps/api` until a second consumer appears; `@usetagih/schema` components remain in schema package.

### Story 3.8: Idempotency middleware for render endpoints

As an embed integrator,
I want Idempotency-Key header deduplication per workspace+endpoint 24h,
So that retries do not double-charge quota or duplicate artifacts (FR-24, AD-5).

**Acceptance Criteria:**

**Given** `POST /v1/{documentType}/render` with Idempotency-Key 1–255 printable ASCII
**When** same key+identical payload hash retried within 24h
**Then** identical renderId and shareUrl returned without re-render
**And** same key+different payload → 409 conflict
**And** idempotency_keys table stores response snapshot with SHA-256 of key
**And** bun test covers happy path and conflict case

### Story 3.9: GET /v1/schemas and POST /v1/{documentType}/validate

As an integrator,
I want schema discovery and validate-only endpoint,
So that I can fix payloads before render (FR-3, FR-11, UJ-2).

**Acceptance Criteria:**

**Given** GET /v1/schemas unauthenticated or authenticated
**When** called
**Then** returns schemaVersion `2026-07-20`, document types, templates per type
**And** POST /v1/invoices|quotations|receipts/validate returns 200 `{ valid: true, normalizedPreview }` or 422 envelope
**And** path documentType authoritative vs body mismatch → 400 DOCUMENT_TYPE_MISMATCH
**And** bun test + integration test for all three types

### Story 3.10: Logo ingestion SSRF-hardened pipeline

As a security engineer,
I want logo fetch with SSRF protections and persisted bytes+checksum,
So that branding is safe and deterministic (AD-7, SOLUTION-DESIGN §4.4).

**Acceptance Criteria:**

**Given** branding.logoUrl HTTPS-only on payload or workspace settings
**When** logo fetched at first use
**Then** blocks private/link-local IPs; resolve-then-connect IP pinning; max 3 redirects; max 2MB raw / 10MB decompressed; content-types PNG/JPEG/SVG only with magic sniff
**And** SVG active content stripped/rejected
**And** bytes + SHA-256 persisted on render record; subsequent renders use persisted bytes only
**And** bun test uses mock server covering SSRF blocked IPs and determinism re-read

### Story 3.11: POST /v1/{documentType}/preview — multi-page SVG response

As a direct user,
I want HTML/SVG preview from validated payload without persisting artifact,
So that I review document before export (FR-10, Story 1.7 contract).

**Acceptance Criteria:**

**Given** valid authenticated payload
**When** POST /v1/invoices/preview (etc.) called
**Then** returns `{ valid: true, pageCount, pages: [{ index, svg }], html }` per SOLUTION-DESIGN §4.2
**And** uses same Typst template as PDF; page count matches PDF for identical input
**And** no render record or share URL created
**And** SVG sanitized; temp files cleaned
**And** bun test compares pageCount to PDF for pagination fixture

### Story 3.12: Sync render path — POST /v1/{documentType}/render (≤100 items, ≤10s)

As an integrator,
I want synchronous 201 render for standard payloads,
So that embed flow completes in one request (FR-12 sync, FR-7, NFR-1).

**Acceptance Criteria:**

**Given** payload with ≤100 line items and render completes within 10s hard timeout
**When** POST /v1/invoices/render with renders:write scope
**Then** returns 201, Location `/v1/renders/{renderId}`, body `{ renderId, status: "completed", shareUrl, expiresAt, schemaVersion, documentType, template }`
**And** PDF uploaded to R2 at `renders/{workspaceId}/{renderId}.pdf` with sha256 stored (FR-18)
**And** trial workspace tier applies footer watermark via Typst `tier=free` input; starter, pro, and business tiers map to `tier=pro` (FR-7, §11 OQ-2)
**And** render record snapshots resolved render-affecting inputs (tier/watermark flag, branding, logo checksum) for deterministic reproduction
**And** validation failure → 422 before Typst invoked
**And** payloads >500 line items rejected at validation
**And** integration test asserts P95 target mock ≤2s for basic fixture in CI (NFR-1 smoke)
**And** structured evlog events include requestId, renderId, durationMs stages (NFR-8 partial; baseline wiring in Story 3.7)

### Story 3.13: Render retrieval, list, and authenticated download

As an integrator,
I want GET render metadata, paginated list, and PDF download,
So that I can retrieve artifacts after render (FR-13, FR-14, FR-15).

**Acceptance Criteria:**

**Given** completed render owned by workspace
**When** GET /v1/renders/{renderId}, GET /v1/renders?page&pageSize&documentType&from&to, GET /v1/renders/{renderId}/download
**Then** metadata includes status, shareUrl, expiresAt, template, schemaVersion, idempotency fingerprint
**And** list defaults pageSize 20 max 100 metadata only
**And** download returns Content-Type application/pdf, Content-Disposition attachment, checksum verified
**And** download audit event logged (FR-27)
**And** cross-workspace renderId returns 404

### Story 3.14: Signed share URLs, public resolver, and revoke

As a document recipient,
I want share links with TTL and public view/download,
So that PDFs distribute without API keys (FR-19, AD-6).

**Acceptance Criteria:**

**Given** completed render with default shareTtlDays 90 or per-render 1–365
**When** shareUrl generated
**Then** HMAC-signed HTTPS URL; tampered signature fails
**And** GET /v1/share/{token} public endpoint returns metadata + download redirect for SCR-SHARE-PUBLIC
**And** expired token returns 403 or branded expiry JSON
**And** DELETE /v1/renders/{renderId}/share revokes link; no reissue endpoint
**And** bun test covers sign, verify, expiry, revoke

### Story 3.15: Audit log capture and GET /v1/audit

As a workspace owner,
I want append-only audit trail queryable via API,
So that embed flows are accountable (FR-27, NFR-11, AD-7).

**Acceptance Criteria:**

**Given** mutating operations: login, api_key create/revoke, validate, render, download, share revoke
**When** each completes
**Then** audit_events row with actor, action, resource id, timestamp, IP for API, outcome
**And** GET /v1/audit?page&pageSize returns paginated last 90 days with audit:read scope
**And** no DELETE on audit_events at MVP
**And** bun test verifies append-only behavior

### Story 3.16: Rate limiting and monthly quota enforcement

As a platform operator,
I want per-workspace rate limits and tier quotas,
So that abuse is controlled (FR-17, NFR-12).

**Acceptance Criteria:**

**Given** usage_counters tracks monthly renders per workspace tier per hypothesis table (trial 100/mo default)
**When** rate limit exceeded (per-tier renders/min hypothesis)
**Then** 429 code RATE_LIMITED with Retry-After header
**And** quota exceeded returns 402 QUOTA_EXCEEDED naming current tier and next tier
**And** idempotent retry same key does not double-count quota (FR-24)
**And** bun test covers limit boundaries per tier enum

### Story 3.17: Workspace settings and branding endpoints for web

As a direct user,
I want PATCH business/branding settings and logo upload,
So that PDFs use my identity (PRD §10.1 branding, UX-DR13).

**Acceptance Criteria:**

**Given** authenticated session token or API key scoped to active workspace
**When** PATCH /v1/settings/business, PATCH /v1/settings/branding, POST /v1/settings/branding/logo
**Then** workspace_settings updated; logo obeys same SSRF/size rules as Story 3.10
**And** render merges workspace defaults with payload branding override
**And** bun test covers merge precedence payload override > workspace default

### Story 3.18: Sync embed flow integration test (SM-4)

As a QA engineer,
I want staging-style integration test validate→render→download→share,
So that MVP embed path is proven before web (SM-4).

**Acceptance Criteria:**

**Given** docker compose stack with api+postgres+minio
**When** integration test runs: validate 200 → render 201 with Idempotency-Key → retry same key same ids → download bytes → share URL resolves
**Then** all steps pass under `bun test` integration tag
**And** audit log contains validate, render, download entries
**And** documents test in `apps/api/tests/embed-sync-flow.test.ts`

### Story 3.19: Workspace CRUD and active workspace selection

As a user with multiple clients,
I want to create, list, rename, and switch workspaces,
So that renders and API keys isolate per client project (FR-21).

**Acceptance Criteria:**

**Given** authenticated user who is member of workspace
**When** POST /v1/workspaces, GET /v1/workspaces, PATCH /v1/workspaces/{id}, POST /v1/workspaces/active, GET /v1/workspaces/active
**Then** CRUD works; slug unique; creator becomes sole owner member
**And** membership/ownership checks on list, rename, and active-selection endpoints
**And** 403 WORKSPACE_REQUIRED when no active workspace on resource routes
**And** bun test + integration cover switch + isolation (workspace A key cannot read workspace B render)

---

## Epic 4: Async Render Path, Webhooks & Artifact Lifecycle

Extend API with pg-boss worker, async renders, webhooks, and cleanup jobs.

### Story 4.1: pg-boss queue setup and worker container entrypoint

As an operator,
I want separate worker process consuming pg-boss jobs,
So that async work does not block API (AD-4, SOLUTION-DESIGN §5).

**Acceptance Criteria:**

**Given** pg-boss 10.x using DATABASE_URL
**When** `apps/api/src/worker.ts` entrypoint starts
**Then** registers handlers render.process, webhook.deliver, artifact.cleanup, webhook.sweep-disabled
**And** worker runs as separate Docker/Coolify resource same image different CMD
**And** integration test sends SIGTERM and asserts in-flight job drains within 30s (SOLUTION-DESIGN §5)
**And** bun test covers handler idempotency guard pattern

### Story 4.2: Async render path — 202 processing response

As an integrator (Jordan),
I want async render when >100 line items, timeout, or Prefer: respond-async,
So that large documents do not block HTTP (FR-12 async, AD-4, §11 OQ-3).

**Acceptance Criteria:**

**Given** payload >100 line items OR Prefer: respond-async OR sync path exceeds 10s timeout
**When** POST /v1/receipts/render called
**Then** immediate 202 with Location and `{ renderId, status: "processing", statusUrl }`
**And** render.process job enqueued; worker completes render and updates status to completed|failed
**And** GET /v1/renders/{renderId} reflects processing→completed transitions
**And** failed render includes stable retriable/non-retriable error codes
**And** integration test covers async happy path

### Story 4.3: Webhook registration CRUD endpoints

As an integrator,
I want POST/GET/DELETE /v1/webhooks subscribing to render.completed|render.failed,
So that my system gets async notification (FR-25, AD-8).

**Acceptance Criteria:**

**Given** webhooks table and webhooks:manage scope on pro or business tier workspace
**When** POST /v1/webhooks with HTTPS url and events[]
**Then** invalid SSL/HTTP url rejected at registration
**And** POST /v1/webhooks denied on trial and starter tiers (403 with tier upgrade hint)
**And** GET lists endpoints scoped to workspace; DELETE stops deliveries and audits deletion
**And** no secret rotation endpoint — documented delete+recreate pattern
**And** bun test covers CRUD + scope enforcement

### Story 4.4: Webhook delivery with HMAC signature and retry schedule

As an integrator,
I want signed webhook deliveries with stable eventId and 8-attempt retry,
So that I can deduplicate and recover from outages (FR-26, AD-8, PRD §10.5).

**Acceptance Criteria:**

**Given** registered webhook and completed async render
**When** webhook.deliver job runs
**Then** POST body matches §10.5 envelope with stable eventId across retries
**And** X-Usetagih-Signature HMAC-SHA256 over `{timestamp}.{rawBody}`
**And** retries on network/408/429/5xx only at intervals ≈30s,2m,10m,30m,1h,3h,8h,12h + jitter
**And** terminal 4xx marks delivery failed without further retry
**And** every attempt logged in audit_events
**And** bun test with mock HTTP server verifies signature and retry behavior

### Story 4.5: Webhook endpoint auto-disable after 7 days total failure

As a platform operator,
I want failing webhook endpoints disabled with owner notification,
So that poison endpoints do not infinite-loop (FR-26, §11 OQ-4).

**Acceptance Criteria:**

**Given** webhook endpoint 100% failure for 7 consecutive days
**When** webhook.sweep-disabled cron runs hourly
**Then** endpoint disabled_at set; no further deliveries
**And** notification logged/queued to owner (email deferred — audit + structured log acceptable MVP)
**And** bun test simulates failure streak with accelerated clock mock

### Story 4.6: Artifact cleanup cron and retention policy documentation

As an operator,
I want expired R2 artifacts removed after retention period,
So that storage costs stay bounded (FR-20, AD-6).

**Acceptance Criteria:**

**Given** artifact retention = share TTL + 7d grace minimum documented in API docs
**When** artifact.cleanup daily job runs
**Then** R2 objects deleted for renders past retention; PostgreSQL metadata + audit retained
**And** re-render with new idempotency key creates new artifact even for same payload
**And** bun test covers cleanup selection query and idempotent delete

### Story 4.7: Async embed flow integration test with webhook (SM-4 complete)

As a QA engineer,
I want validate→async render→webhook→share integration test,
So that UJ-4 path is proven (SM-4, UJ-4).

**Acceptance Criteria:**

**Given** test webhook receiver with signature verification
**When** integration test triggers async render with settlement idempotency key
**Then** 202 → poll/wait → render.completed webhook received once verifiable; duplicate delivery same eventId
**And** share URL valid; audit correlates renderId + webhook attempts
**And** test documented in `apps/api/tests/embed-async-webhook.test.ts`

---

## Epic 5: Document Templates (6 Curated Styles)

Complete remaining templates with golden regression after CONTRIBUTING.md gate.

### Story 5.0: Template authoring CONTRIBUTING.md (prerequisite gate)

As a template author,
I want CONTRIBUTING.md defining Typst conventions before parallel template work,
So that all templates share determinism rules (AD capability map, board constraint).

**Acceptance Criteria:**

**Given** spike preamble and invoice/modern exist
**When** `packages/templates/CONTRIBUTING.md` is merged
**Then** documents: preamble import rules, font usage, watermark flag, money/date formatting, golden fixture requirements, PR label `golden-update` process
**And** CI check or CODEOWNERS rule blocks new `.typ` template PRs without CONTRIBUTING.md present
**And** Epic 5 stories 5.1–5.5 must not merge before this story

### Story 5.1: Invoice classic template + golden fixture

As a direct user,
I want invoice classic template,
So that I can choose alternate visual style (FR-6, FR-7).

**Acceptance Criteria:**

**Given** CONTRIBUTING.md merged and spike gate PASS
**When** `packages/templates/invoice/classic.typ` renders fixture `invoice-classic-basic.json`
**Then** golden SHA-256 committed; CI Docker golden:check passes
**And** totals/tax display matches payload (FR-9)
**And** trial workspace tier watermark when Typst `tier=free` input applied

### Story 5.2: Quotation modern and classic templates + golden fixtures

As a direct user,
I want quotation templates in both styles,
So that quotations render professionally (FR-6, UJ-1/UJ-3 types).

**Acceptance Criteria:**

**Given** quotation-specific fields validUntil in fixtures
**When** modern and classic templates render `quotation-modern-basic.json` and `quotation-classic-basic.json`
**Then** golden hashes pass CI including JPY no-decimal fixture `quotation-modern-jpy.json` (FR-4)
**And** validUntil renders on PDF per English label spec (FR-5)

### Story 5.3: Receipt modern and classic templates + golden fixtures

As a marketplace integrator,
I want receipt templates with optional buyer and paymentReference,
So that payout receipts render (FR-6, UJ-4).

**Acceptance Criteria:**

**Given** receipt fixtures with paidAt, paymentReference, optional buyer omitted
**When** modern/classic templates render including inclusive-tax case `receipt-classic-inclusive-tax.json`
**Then** golden CI passes; pricesIncludeTax display correct (FR-9)
**And** pagination golden if line items exceed one page optional in receipt fixture

### Story 5.4: Multi-tax and discount golden fixture corpus

As a QA engineer,
I want golden fixtures covering multi-tax, discount, inclusive/exclusive tax,
So that SM-3 pass rate target is met (FR-9, SM-3).

**Acceptance Criteria:**

**Given** fixtures: invoice-classic-multi-tax.json, discount scenarios, pricesIncludeTax true/false
**When** golden:check runs full manifest
**Then** 100% pass in CI Docker for all 3 types × 2 templates core scenarios
**And** manifest.json lists every fixture with sha256, typstVersion, schemaVersion

### Story 5.5: Template quality benchmark checklist (SM-1)

As a product owner,
I want documented side-by-side benchmark vs Invovate and invoice-generator.com,
So that template quality gate is auditable (SM-1).

**Acceptance Criteria:**

**Given** all six templates passing goldens
**When** checklist completed in `_bmad-output/planning-artifacts/template-benchmark-sm1.md`
**Then** records ≥ Invovate rating for 3 types × 2 templates per reviewer rubric
**And** notes any gaps with remediation stories if below bar
**And** no diagonal watermark in any output (§11 OQ-2)

---

## Epic 6: Web Application (16 Screens)

Next.js 15 Mantine consumer implementing EXPERIENCE.md with Playwright e2e.

### Story 6.1: Next.js App Router scaffold with Mantine theme tokens

As a frontend developer,
I want apps/web with DESIGN.md tokens ported to Mantine createTheme,
So that all screens share brand layer (UX-DR1, AD-9).

**Acceptance Criteria:**

**Given** Next.js 15.x pinned in root package.json and Mantine v8
**When** `apps/web/theme/tokens.ts` maps DESIGN.md colors/typography/spacing to createTheme
**Then** accent color used only for render/export actions per DESIGN do's
**And** UI primitives use Mantine v8; if a needed headless primitive is missing, use `@base-ui/react` (install only when first needed in Epic 6) — never `@radix-ui/*` or shadcn/ui
**And** CONTRIBUTING note in `apps/web/README.md`: headless primitives = Mantine first, base-ui fallback only
**And** Inter + JetBrains Mono loaded; `@usetagih/sdk` dependency wired
**And** bun/turbo build apps/web succeeds

### Story 6.2: Auth screens SCR-AUTH-SIGNIN, SIGNUP, RESET

As Maya,
I want sign-in, sign-up, and password reset pages,
So that I can access the app (FR-21, UX-DR4, SCR-AUTH-*).

**Acceptance Criteria:**

**Given** routes `/sign-in`, `/sign-up`, `/forgot-password`, `/reset-password`
**When** user submits email/password or GitHub OAuth button
**Then** better-auth flows run; errors show in Alert; loading on submit
**And** successful auth redirects to `/app/onboarding/workspace` if user has zero workspaces, else `/app` (or redirect query param)
**And** Playwright smoke test covers sign-up happy path

### Story 6.3: Landing page SCR-LANDING

As a visitor,
I want marketing-lite landing explaining render infrastructure positioning,
So that I understand product boundary (UX-DR3, SCR-LANDING).

**Acceptance Criteria:**

**Given** public route `/`
**When** page loads SSR
**Then** hero "Strict schema in. Branded PDF out.", feature grid, API code snippet, footer guardrail copy per EXPERIENCE.md
**And** CTAs link to sign-up and sign-in
**And** no payment or accounting metaphors in copy

### Story 6.4: App shell, dashboard SCR-DASHBOARD

As an authenticated user,
I want navbar, header, and dashboard with recent renders,
So that I can navigate the app (UX-DR2, UX-DR5).

**Acceptance Criteria:**

**Given** session required on `/app/*`; session expired redirects to `/sign-in?redirect=`
**When** user views `/app`
**Then** AppShell with NavLinks per EXPERIENCE.md IA; Drawer on mobile <md
**And** quick-action cards link to `/app/documents/new?type=invoice|quotation|receipt`
**And** recent 5 renders from GET /v1/renders?pageSize=5 via session token exchange
**And** Playwright test covers nav + dashboard load

### Story 6.5: Document creation wizard SCR-DOC-CREATE

As Maya,
I want 4-step create flow with schema-driven form and preview,
So that I can build and export documents (FR-28, UX-DR6, UJ-1).

**Acceptance Criteria:**

**Given** `/app/documents/new` Stepper steps 0–3 (type, template, details, preview/export)
**When** user fills form mapped to JSON Pointer paths with Money decimal strings
**Then** client Zod from @usetagih/schema validates on blur; server POST validate authoritative
**And** split pane lg+ form/preview; Tabs Form|Preview on md
**And** line items Table md+ / cards sm; min 1 row; never auto-overwrite grandTotal (UX-DR15)
**And** POST preview debounced 500ms; preview iframe titled (UX-DR7)
**And** export POST render with uuid Idempotency-Key per click (UX-DR18)
**And** field errors show Code path in mono

### Story 6.6: Playwright e2e UJ-1 happy path all document types

As a QA engineer,
I want e2e create→preview→export for invoice, quotation, receipt,
So that FR-29 is satisfied (FR-29, NFR-9 partial).

**Acceptance Criteria:**

**Given** Playwright against docker compose stack
**When** `apps/web/e2e/uj1-export.spec.ts` runs per document type
**Then** each completes validate, preview visible, export downloads PDF, share link copied
**And** total mismatch scenario asserts field error blocks export (UJ-1 edge)
**And** tests run in CI e2e job

### Story 6.7: Documents history and detail SCR-DOC-HISTORY, SCR-DOC-DETAIL

As a user,
I want paginated history and render detail with re-download,
So that I can access past renders (FR-30, UX-DR9).

**Acceptance Criteria:**

**Given** routes `/app/documents` and `/app/documents/:renderId`
**When** user views history
**Then** mantine-datatable server pagination matches GET /v1/renders filters
**And** row actions download, copy link, view detail
**And** expired share shows orange Badge + re-render guidance
**And** empty state CTA to new document

### Story 6.8: Template gallery SCR-TEMPLATE-GALLERY

As Priya,
I want browse templates gallery,
So that I evaluate visual styles (UX-DR10, UJ-5).

**Acceptance Criteria:**

**Given** `/app/templates` with Tabs per document type
**When** loaded
**Then** 2 cards per tab from GET /v1/schemas; Use template deep-links to create with query params
**And** curation note: not editable at MVP

### Story 6.9: API keys screen SCR-API-KEYS

As Alex,
I want create/list/revoke API keys in UI,
So that I manage embed credentials (FR-22/23, UX-DR11).

**Acceptance Criteria:**

**Given** `/app/api-keys`
**When** user creates key with Checkbox.Group scopes matching FR-22 enum
**Then** show-once secret modal with CopyButton; list refreshes without secret
**And** revoke confirm Modal → DELETE; audit visible in audit screen
**And** scopes labels match API not documents:read typo from EXPERIENCE (use renders:read|write per PRD)

### Story 6.10: Audit log screen SCR-AUDIT-LOG

As a workspace owner,
I want paginated audit log viewer,
So that I trust embed activity (FR-27, UX-DR12).

**Acceptance Criteria:**

**Given** `/app/audit`
**When** loaded with audit:read via session token
**Then** DataTable shows timestamp, action, resource, outcome, IP; filters by action and resource id
**And** displays "Last 90 days. Append-only."

### Story 6.11: Settings SCR-SETTINGS

As a user,
I want business and branding settings affecting PDF output,
So that documents carry my identity (UX-DR13).

**Acceptance Criteria:**

**Given** `/app/settings` Tabs Business|Branding|Account
**When** user updates fields and logo Dropzone PNG/JPEG/SVG max 2MB
**Then** PATCH settings endpoints persist; logo uses API upload endpoint
**And** Account tab links better-auth password change

### Story 6.12: Public share page SCR-SHARE-PUBLIC

As a share link recipient,
I want view metadata and download PDF without account,
So that viral loop works (FR-19, UX-DR14, UJ-4).

**Acceptance Criteria:**

**Given** `/share/[token]` SSR route calling GET /v1/share/{token}
**When** valid token
**Then** shows document metadata, download Button, powered-by footer; no payment CTA
**And** expired and invalid states render full-page messages per EXPERIENCE.md
**And** Playwright test covers valid + expired mock

### Story 6.13: Accessibility WCAG 2.1 AA verification

As an accessibility reviewer,
I want create/preview/export flows meeting WCAG 2.1 AA,
So that NFR-9 is satisfied (UX-DR16, NFR-9).

**Acceptance Criteria:**

**Given** SCR-DOC-CREATE and auth screens
**When** axe or manual audit runs
**Then** form labels, aria-describedby errors, aria-live validation, stepper aria-current, contrast ≥4.5:1 on primary/accent buttons
**And** prefers-reduced-motion honored
**And** document accessibility findings in `apps/web/a11y-audit.md` with zero critical blockers

### Story 6.14: Workspace create, bootstrap, and switcher (SCR-WORKSPACE-*)

As a user,
I want to create my first workspace after signup and switch between workspaces,
So that I isolate client projects (FR-21, UX addendum).

**Acceptance Criteria:**

**Given** new signup without workspace → redirect `/app/onboarding/workspace`
**When** user submits workspace name → POST /v1/workspaces → active set → `/app`
**And** user can create additional workspaces from AppShell (modal or `/app/workspaces/new`) beyond first-run onboarding
**And** AppShell header includes workspace switcher (Select or Menu) calling POST /v1/workspaces/active
**And** Playwright: signup → onboarding → dashboard blocked without workspace; create second workspace and switch
**And** WCAG: switcher labeled "Active workspace"

---

## Epic 7: TypeScript SDK & OpenAPI Publishing

Official npm client and published spec for integrators.

### Story 7.1: SDK validateLocally parity with server

As Priya,
I want offline validation matching server errors,
So that I fix payloads before API calls (FR-31, UJ-5).

**Acceptance Criteria:**

**Given** `@usetagih/sdk` exports validateLocally(documentType, payload)
**When** run against shared fixture set with packages/schema
**Then** error codes and paths match server validate endpoint responses
**And** bun test in packages/sdk covers ≥20 shared fixtures
**And** no network calls in validateLocally

### Story 7.2: SDK render client with auth, idempotency, and 429 retry

As an integrator,
I want typed render() client,
So that embed integration is ergonomic (FR-32).

**Acceptance Criteria:**

**Given** SDK configured with apiKey and baseUrl
**When** client.render('invoice', payload, { template, idempotencyKey }) called
**Then** sets Authorization Bearer and Idempotency-Key header; parses 201/202 responses typed
**And** retries on 429 respecting Retry-After up to documented limit
**And** README quickstart enables first render <1h (FR-32)

### Story 7.3: Schema version drift warning in SDK

As a developer,
I want warning when bundled schemaVersion ≠ server GET /v1/schemas,
So that I upgrade SDK when needed (FR-3, AD-12).

**Acceptance Criteria:**

**Given** client initialization or first request
**When** server schemaVersion differs from @usetagih/schema bundled version
**Then** console.warn or typed warning event documents upgrade path
**And** bun test mocks version mismatch

### Story 7.4: Full OpenAPI assembly, Spectral CI, SDK wiring, and production docs activation

As an integrator,
I want a complete OpenAPI document validated in CI and activated for production integrators,
So that codegen stays trustworthy through launch (FR-16, AD-11).

**Acceptance Criteria:**

**Given** generated components from `packages/schema` merged into the full MVP route surface (component serving and Scalar UI wired in Story 3.7)
**When** OpenAPI document is assembled at build time
**Then** spec includes all MVP endpoints, error envelope, DocumentPayload union; partial-maturity marker removed
**And** CI job runs @stoplight/spectral-cli with `packages/schema/spectral.yaml` — zero severity errors
**And** `@usetagih/sdk` codegen/wiring consumes the assembled spec; bun test smoke validates spec JSON schema
**And** production docs activation flips `USETAGIH_DOCS_ENABLED` to public at launch (coordinated with Epic 8.8 checklist) — Story 3.7 owns route serving; this story owns document completeness and activation gate

### Story 7.5: SDK staging integration test all document types

As a QA engineer,
I want SDK integration test against running API,
So that SM-7 path is validated (FR-32, SM-7 prep).

**Acceptance Criteria:**

**Given** CI or manual staging with API key
**When** integration test runs validateLocally + render for invoice, quotation, receipt
**Then** all succeed with downloadable PDF bytes
**And** test skippable locally without stack via env flag

### Story 7.6: npm publish pipeline and package versioning aligned to schema

As a maintainer,
I want @usetagih/sdk publish workflow semver-aligned to schema versions,
So that integrators pin compatible versions (FR-31, NFR-10).

**Acceptance Criteria:**

**Given** schemaVersion 2026-07-20
**When** SDK version policy documented in packages/sdk/README
**Then** breaking schema bumps trigger major semver on @usetagih/schema and @usetagih/sdk
**And** CI documents npm publish on release tag (manual or automated without secrets in repo)

---

## Epic 8: Launch Readiness & Production Deploy

Production deploy, monitoring, observability, and operational runbooks.

### Story 8.1: Coolify production deploy pulling GHCR prebuilt images

As an operator,
I want Coolify services pulling api/web/worker from GHCR with Doppler secrets,
So that VPS never builds on prod (SOLUTION-DESIGN §11.2, NFR-4).

**Acceptance Criteria:**

**Given** GHCR images usetagih-api, usetagih-web pushed from CI
**When** Coolify deploys api.usetagih.com, app.usetagih.com, internal worker
**Then** pre-deploy hook runs `bun run --filter @usetagih/db migrate`
**And** health checks GET /health API and / web pass
**And** Doppler injects prod secrets; none in git
**And** Cloudflare DNS/proxy configured for web+api

### Story 8.2: External uptime monitoring

As an operator,
I want external uptime checks on API and web,
So that NFR-2 99.5% is measurable (SOLUTION-DESIGN §11.3).

**Acceptance Criteria:**

**Given** production URLs live
**When** uptime monitor configured (e.g., UptimeRobot or Better Stack)
**Then** alerts on api /health and app / failure
**And** runbook link in docs/ops/uptime.md

### Story 8.3: Container restart policies

As an operator,
I want restart unless-stopped on api, worker, web, postgres,
So that transient failures recover (SOLUTION-DESIGN §11.3).

**Acceptance Criteria:**

**Given** Coolify resources
**When** process crash simulated in staging
**Then** container restarts automatically within 2 minutes
**And** documented in deploy runbook

### Story 8.4: Postgres backup and restore drill runbook

As an operator,
I want daily pg_dump to R2 and one successful restore drill,
So that data loss risk is bounded (SOLUTION-DESIGN §13, §11.3).

**Acceptance Criteria:**

**Given** cron pg_dump daily 03:00 UTC to R2 backups/postgres/
**When** restore drill executed per docs/runbooks/restore-postgres.md
**Then** successful restore to staging DB documented with timestamp and operator sign-off
**And** retention 7 daily + 4 weekly documented

### Story 8.5: umami self-hosted analytics

As a product owner,
I want umami tracking web funnel events only,
So that sign-up/export/share views are measured without API noise (SOLUTION-DESIGN §12.3).

**Acceptance Criteria:**

**Given** umami at analytics.usetagih.com on VPS
**When** web app loads
**Then** tracks sign-up, export click, share page view — not API render counts
**And** Doppler UMAMI_* vars configured

### Story 8.6: Structured logging and render/webhook metrics

As an operator,
I want evlog logs and basic metrics export,
So that NFR-8 observability baseline exists.

**Acceptance Criteria:**

**Given** API and worker render paths (worker logging migrated to evlog in the same pass)
**When** render completes or fails
**Then** JSON logs include requestId, workspaceId, renderId, stage, durationMs per SOLUTION-DESIGN §12.1 field contract (logger supersession: evlog replaces pino — observability contract unchanged)
**And** counters documented verbatim: `usetagih_renders_total`, `usetagih_render_duration_seconds`, `usetagih_webhook_deliveries_total`, `usetagih_queue_depth` per SOLUTION-DESIGN §12.2
**And** evlog OTLP drain may share the OpenTelemetry collector endpoint from Story 3.7 when configured
**And** integration tests cover evlog pipeline; alert threshold documented queue depth >50 for 5min

### Story 8.7: HSTS and HTTPS enforcement

As a security engineer,
I want HSTS on production API and web,
So that NFR-3 is met.

**Acceptance Criteria:**

**Given** Cloudflare proxy or reverse proxy config
**When** HTTP request attempted
**Then** redirected to HTTPS; Strict-Transport-Security header present on prod responses
**And** verification documented in security checklist

### Story 8.8: Launch checklist and success metrics validation plan

As a product owner,
I want launch gate checklist mapping SM-1–SM-4,
So that MVP exit criteria are explicit.

**Acceptance Criteria:**

**Given** epics 0–7 complete
**When** `_bmad-output/planning-artifacts/launch-checklist.md` filled
**Then** includes: golden 100% SM-3, template benchmark SM-1, validation clarity SM-2 sampling plan, embed demo SM-4 link, MCP explicitly out of scope, privacy policy published placeholder (§9.4 assumption)
**And** launch checklist includes tier limit smoke test per enum and documents payment integration explicitly out of MVP scope
**And** counter-metrics SM-C1–C3 copy review checklist included
**And** flip `USETAGIH_DOCS_ENABLED` to public production exposure at launch (Story 3.7 fail-closed default; Story 7.4 owns document completeness)

---

## Epic 9: MCP v1.1 Adapter — POST-MVP / NOT IN SPRINT

**Scope fence:** This epic is **explicitly excluded from MVP sprint**. `apps/mcp` remains stub until REST v1 stabilizes. Stories below are backlog only.

### Story 9.1: MCP server scaffold calling REST only

As an agent platform engineer,
I want apps/mcp thin server using @modelcontextprotocol/sdk + @usetagih/sdk,
So that no duplicate business logic exists (FR-33–35 prep, AD-2, SOLUTION-DESIGN §14).

**Acceptance Criteria:**

**Given** POST-MVP sprint started and Epic 7 complete
**When** apps/mcp implemented
**Then** zero imports from packages/core or packages/render
**And** all tools HTTP-call public API with API key auth
**And** tool count ≤5 total

### Story 9.2: MCP tool list_schemas

As an MCP agent,
I want list_schemas tool,
So that I discover contract (FR-33).

**Acceptance Criteria:**

**Given** MCP server running
**When** list_schemas invoked
**Then** output matches GET /v1/schemas JSON content exactly

### Story 9.3: MCP tool validate_payload

As an MCP agent,
I want validate_payload tool,
So that I fix JSON before render (FR-34).

**Acceptance Criteria:**

**Given** document type + JSON arguments
**When** validate_payload invoked
**Then** error envelope parity with POST /v1/{documentType}/validate for shared fixtures

### Story 9.4: MCP tool render_document

As an MCP agent,
I want render_document tool returning renderId and shareUrl,
So that UJ-3 completes (FR-35).

**Acceptance Criteria:**

**Given** document type, template, payload, optional idempotency key
**When** render_document invoked
**Then** calls POST /v1/{documentType}/render; returns renderId + shareUrl; no local PDF generation

### Story 9.5: Optional MCP tools get_render_status and download_pdf

As an MCP agent,
I want optional status and download tools within 5-tool cap,
So that agents poll/retrieve artifacts (PRD §4.10 optional).

**Acceptance Criteria:**

**Given** total MCP tools ≤5
**When** get_render_status and download_pdf implemented
**Then** map to GET /v1/renders/{renderId} and GET /v1/renders/{renderId}/download respectively
**And** documented in apps/mcp README

---

## Final Validation Summary

| Check | Status |
|---|---|
| MVP FR-1–FR-32 each map to ≥1 story | PASS |
| FR-33–FR-35 fenced in Epic 9 POST-MVP | PASS |
| Epic 1 spike blocking ACs with exit condition | PASS (Stories 1.5–1.9) |
| POST /v1/session/token in Epic 3 Story 3.4 with scope-parity matrix | PASS |
| Sequencing: 0→1 gate→2→3→4→5→6→7→8 | PASS |
| CONTRIBUTING.md before template parallel (Story 5.0 gates 5.1–5.5) | PASS |
| 16 UX screens covered Epic 6 | PASS |
| No payments/teams/marketplace/i18n/e-invoicing stories | PASS |
| Testing in ACs: bun test, Playwright, golden CI | PASS |
| NFR coverage via Epic 1,3,6,8 stories | PASS |

**Total stories:** 85 (Epic 0: 6, Epic 1: 9, Epic 2: 6, Epic 3: 18, Epic 4: 7, Epic 5: 6, Epic 6: 14, Epic 7: 6, Epic 8: 8, Epic 9 POST-MVP: 5)

**FR coverage gaps:** None for MVP FR-1–FR-32. FR-33–FR-35 intentionally deferred to Epic 9 POST-MVP with stub preservation in Story 0.1.

---
title: "Solution Design: usetagih"
status: final
created: 2026-07-20
updated: 2026-07-20
companion_to: ARCHITECTURE-SPINE.md
---

# Solution Design: usetagih

Operational and implementation detail for agents building from `ARCHITECTURE-SPINE.md`. PRD §10 is frozen — this document implements it.

## 1. Big Choices (Rationale Summary)

### 1.1 Frontend: Next.js 15 App Router

| Criterion | Next.js 15 | TanStack Start |
| --- | --- | --- |
| Mantine v8 | Official templates + guides | Community template only |
| Coolify deploy | Standard standalone Docker pattern | Nitro/Bun compile — fewer Coolify recipes |
| Public-API consumer | Client fetch + optional route handlers as thin BFF | Server functions tempt business logic duplication |
| Bun monorepo | Dev via Bun; prod Node standalone (acceptable) | Native Bun runtime |
| Share page SSR | App Router SSR for `/share/[token]` | Supported via TanStack Start SSR |

**Decision:** Next.js 15 App Router (latest maintained 15.x patch pinned in root `package.json`). The web app is a thin Mantine consumer of the public REST API; Mantine's first-class Next integration and Coolify deployment path outweigh TanStack Start's Bun-native runtime for this workload.

### 1.2 PDF Engine: Typst CLI 0.15.x

| Criterion | Typst 0.15.x | Playwright print-to-PDF | @react-pdf/renderer |
| --- | --- | --- | --- |
| Byte-identical (FR-7) | Yes with pinned fonts, `#set document(date: none)`, `SOURCE_DATE_EPOCH` (pre-0.15 Typst leaked local timezone even with epoch — fixed in 0.15.0) | No — metadata/timestamps vary | No — known non-deterministic bytes |
| NFR-1 P95 ≤2s | 5–50ms compile warm | 1–5s+ cold Chromium | ~100–500ms |
| 12 GB VPS memory | ~40 MB binary, no browser pool | 200–400 MB per Chromium | Moderate |
| Pagination (FR-8) | Native paged media | CSS print quirks | Known pagination bugs |
| Template DX (6 templates) | `.typ` + JSON `--input` | HTML/CSS React components | JSX layout components |
| Preview = same engine (FR-10) | Compile same `.typ` → SVG pages | Same HTML | N/A for preview |

**Decision:** Typst CLI **0.15.x** with exact patch pinned in `packages/render/typst-version.txt`; binary checksum and `Dockerfile.render-ci` container digest recorded in `manifest.json`. Vendored fonts in `packages/render/fonts/`. Shared preamble (`packages/templates/_shared/preamble.typ`) includes `#set document(date: none)` alongside fixed `SOURCE_DATE_EPOCH`. Always `--ignore-system-fonts`. Preview endpoint returns multi-page SVG compiled from the same `.typ` (see §4.2). PDF path runs `typst compile` with identical template + input JSON.

**Rejected Chromium:** Memory footprint and byte-instability on shared VPS violate FR-7/NFR-1. No pixel-golden fallback — FR-7 is byte-identical PDF only; spike failure reopens engine decision at board.

**Rejected @react-pdf:** Non-deterministic PDF bytes and pagination instability at 25+ line items fail FR-7/FR-8 gates.

---

## 2. Epic-1 Spike (Mandatory Gate)

**Epic:** `E1-pdf-pipeline-spike`  
**Goal:** Prove Typst renders `invoice` + `modern` template deterministically before any other feature epic merges.

### 2.1 Deliverables

| # | Artifact | Path |
| --- | --- | --- |
| 1 | Typst invoice modern template | `packages/templates/invoice/modern.typ` |
| 2 | Shared Typst preamble (fonts, colors, footer watermark) | `packages/templates/_shared/preamble.typ` |
| 3 | Font bundle (Inter + JetBrains Mono OFL) | `packages/render/fonts/` |
| 4 | Fixture payload (≤5 line items, USD, single tax) | `packages/render/__fixtures__/invoice-modern-basic.json` |
| 5 | Golden PDF + SHA-256 manifest | `packages/render/__fixtures__/golden/invoice-modern-basic.sha256` |
| 6 | Harness CLI | `packages/render/scripts/golden-check.ts` |
| 7 | CI Docker image | `docker/Dockerfile.render-ci` |
| 8 | CI workflow | `.github/workflows/pdf-golden.yml` |

### 2.2 Spike Acceptance Criteria (all blocking)

Failure on **any** criterion reopens the engine decision at the board before any further template is authored — no silent Chromium fallback.

- [ ] `bun run golden:check` exits 0 in CI Docker (`Dockerfile.render-ci` amd64 image)
- [ ] Re-run produces identical SHA-256 in CI Docker (byte-stable)
- [ ] Footer watermark renders for `tier=free` flag in template input
- [ ] **25-line-item pagination fixture (FR-8)** — `invoice-modern-pagination-25.json` + golden hash; blocking
- [ ] **Logo determinism fixture** — fetch once, persist immutable bytes + checksum on render record, render from persisted bytes; cover PNG, JPEG, SVG
- [ ] **Multi-page SVG preview** — same `.typ` fixture compiled with `--format svg` (one file per page); page count matches PDF; naming, ordering, cleanup, response shape, and SVG sanitization documented and tested
- [ ] **Determinism soak** — `golden:check` ≥100 consecutive iterations in CI Docker with zero hash drift
- [ ] Shared preamble includes `#set document(date: none)` + fixed `SOURCE_DATE_EPOCH`
- [ ] Typst version pin in `packages/render/typst-version.txt` (0.15.x exact patch); binary checksum + container digest in manifest

### 2.3 Spike → Production Path

Spike harness becomes permanent NFR-6 gate. Adding template = add fixture + golden hash PR.

---

## 3. Golden-File Test Architecture

### 3.1 Fixture Corpus Layout

```text
packages/render/__fixtures__/
  payloads/
    invoice-modern-basic.json
    invoice-modern-pagination-25.json
    invoice-classic-multi-tax.json
    quotation-modern-jpy.json
    receipt-classic-inclusive-tax.json
    # ... 3 types × 2 templates × scenarios
  golden/
    invoice-modern-basic.pdf          # committed reference (optional — prefer hash-only)
    invoice-modern-basic.sha256
    manifest.json                     # { file, sha256, typstVersion, schemaVersion }
```

### 3.2 Tolerance Policy

| Check | Policy |
| --- | --- |
| Primary (authoritative) | SHA-256 byte equality of PDF bytes **only** inside pinned `Dockerfile.render-ci` image (linux/amd64) |
| Local dev / other platforms | `golden:check` is **advisory** — upstream float/platform variance (typst/typst#7683) may differ; CI Docker is contract |
| Date fields | Fixed `issuedAt` in fixtures; `SOURCE_DATE_EPOCH=1700000000` in CI; preamble `#set document(date: none)` |
| Fonts | `--ignore-system-fonts`; only `packages/render/fonts/` |
| Typst version | 0.15.x exact patch in `typst-version.txt`; binary checksum + container digest in `manifest.json`; bump requires manifest update |
| Logo URLs | Production: fetch once with SSRF hardening, persist bytes + checksum; fixtures use embedded base64 or local stub — no network in CI |
| Failure | CI blocks merge; update golden via PR labeled `golden-update` + visual diff attachment |
| **Not acceptable** | Pixel-golden or PNG snapshot fallback for FR-7 — byte-identical PDF only |

### 3.3 Font Pinning

- **UI fonts (web):** Inter, JetBrains Mono via `@fontsource` or Google Fonts link — unrelated to PDF determinism
- **PDF fonts:** vendored TTF/OTF in `packages/render/fonts/` referenced in `preamble.typ` via `#set text(font: "...")`
- **Preamble determinism:** `packages/templates/_shared/preamble.typ` must include `#set document(date: none)` alongside font/color setup
- **CI reproducibility:** `docker/Dockerfile.render-ci` FROM `debian:bookworm-slim` + pinned Typst 0.15.x `.deb` (checksum verified) + copy fonts; record image digest in `manifest.json`; no system font packages

### 3.4 Harness Commands

```json
// packages/render/package.json scripts
{
  "golden:render": "bun scripts/render-fixture.ts",
  "golden:check": "bun scripts/golden-check.ts",
  "golden:soak": "bun scripts/golden-soak.ts",
  "golden:update": "bun scripts/golden-check.ts --update"
}
```

`golden-check.ts` flow:

1. For each entry in `manifest.json`
2. Render payload → temp PDF via Typst driver
3. SHA-256 compare to golden
4. Exit 1 on mismatch with diff of file sizes + first bytes hex

### 3.5 CI Job (`pdf-golden.yml`)

```yaml
# triggers: push/PR affecting packages/render, packages/templates
jobs:
  pdf-golden:
    runs-on: ubuntu-latest
    container:
      image: ghcr.io/verasic-labs/usetagih-render-ci:2026-07-20  # built from Dockerfile.render-ci
    steps:
      - checkout
      - run: bun install --frozen-lockfile
      - run: bun run --filter @usetagih/render golden:check
      - run: bun run --filter @usetagih/render golden:soak --iterations 100
    env:
      SOURCE_DATE_EPOCH: "1700000000"
      TYPST_IGNORE_SYSTEM_FONTS: "1"
```

---

## 4. Render Pipeline (Detailed)

```mermaid
sequenceDiagram
  participant C as Client
  participant API as apps/api
  participant V as packages/core
  participant T as Typst
  participant R2 as R2
  participant Q as pg-boss
  C->>API: POST /v1/invoices/render
  API->>V: validate(payload)
  alt invalid
    V-->>API: 422 envelope
  else valid + sync path
    V->>T: compile(template, json)
    T-->>V: pdf bytes
    V->>R2: PUT artifact
    V-->>API: render record completed
    API-->>C: 201 + shareUrl
  else async path
    V-->>API: render record processing
    API-->>C: 202 + statusUrl
    API->>Q: enqueue render.job
    Q->>V: worker render
    V->>R2: PUT
    V->>Q: enqueue webhook.deliver
  end
```

### 4.1 Stages

1. **Authenticate** — API key or session-derived token; scope check
2. **Idempotency** — lookup `idempotency_keys` table; return cached response if hit
3. **Validate** — Zod parse + business rules (§10.1 arithmetic)
4. **Resolve branding** — merge workspace defaults + payload override; logo pipeline (see §4.4); snapshot resolved tier/watermark/branding/logo checksum on render record
5. **Render** — map `workspace_settings.tier`: `trial` → Typst `--input tier=free`; paid tiers → `tier=pro`; build Typst input JSON; invoke `typst compile --input json=<path>` (from persisted logo bytes when applicable)
6. **Store** — upload R2; insert/update `renders` row with `sha256`, `byteSize`, `r2Key`
7. **Share URL** — sign JWT/HMAC token with expiry
8. **Webhook** — if registered, enqueue delivery job
9. **Audit** — append event

### 4.2 Preview Path

`POST /v1/{documentType}/preview`:

- Same validate + branding resolve (persisted logo bytes)
- `typst compile --format svg` on the **same** `.typ` template as PDF — one SVG file per page
- **Output naming:** `{renderTempDir}/page-{n}.svg` (1-indexed, zero-padded to page count width)
- **Ordering:** pages sorted ascending by index; response `pages[]` mirrors PDF page order
- **Page count:** must match PDF page count for identical input (acceptance test in spike)
- **Cleanup:** temp SVG dir removed in `finally` block; no R2 persist
- **Response shape:**

```json
{
  "valid": true,
  "pageCount": 2,
  "pages": [
    { "index": 1, "svg": "<svg>...</svg>" }
  ],
  "html": "<div class=\"page\" data-page=\"1\">...</div>"
}
```

- **SVG sanitization:** strip `<script>`, event handlers, external references, and `foreignObject`; reject if active content remains
- No render record (ephemeral); no share URL

### 4.3 Trial-Tier Watermark (Typst tier input)

Typst template receives `--input tier=free|pro` (enum unchanged until Epic 5 template pass). Render path maps `workspace_settings.tier === 'trial'` → `tier=free`; all paid tiers (`starter`, `pro`, `business`) → `tier=pro`. Footer text when `tier=free`: `Rendered with usetagih · usetagih.com` at 8pt gray. Render records snapshot resolved tier/watermark flag at render time so deterministic reproduction never depends on mutable workspace settings.

### 4.4 Logo Ingestion (SSRF-hardened)

Logo fetch occurs **once** at first use per distinct URL; subsequent renders use persisted immutable bytes + checksum on the render record.

| Control | Requirement |
| --- | --- |
| SSRF | Block private/link-local IP ranges; resolve-then-connect with IP pinning against DNS rebinding |
| Redirects | Cap at 3; reject non-HTTPS after first hop |
| Size | Max 2 MB raw; max 10 MB decompressed |
| Content-Type | Allow `image/png`, `image/jpeg`, `image/svg+xml` only; sniff magic bytes |
| Decompression bomb | Limit expansion ratio; abort on zip/gzip bombs in SVG |
| SVG active content | Strip/reject `<script>`, event handlers, external refs, `foreignObject` |
| Storage | Persist bytes + SHA-256 checksum on `renders.logo_checksum` + object key; Typst reads local path only |
| Determinism | Re-render from persisted bytes — never re-fetch mid-idempotency window |

Fixtures in CI use embedded base64 logos — no network fetch in golden tests.

---

## 5. Async Job / Queue Mechanism

**Choice:** `pg-boss` on existing PostgreSQL — no Redis.

**Deployment:** Worker runs as a **separate process/container** from API, same Docker image, different entrypoint (`worker.ts`). Requires integration test proving Bun compatibility + graceful shutdown (SIGTERM drains in-flight jobs within 30s).

**Idempotency:** All job handlers must be idempotent — pg-boss at-least-once delivery means crash-after-side-effect duplicates are possible. Use render status checks, delivery attempt IDs, and conditional updates.

| Job type | Payload | Concurrency |
| --- | --- | --- |
| `render.process` | `{ renderId }` | 2 workers (VPS CPU headroom) |
| `webhook.deliver` | `{ deliveryId }` | 4 workers |
| `artifact.cleanup` | `{ batchSize }` | cron daily |
| `webhook.sweep-disabled` | `{}` | cron hourly |

**Sync vs async decision** (in render use-case):

```typescript
const forceAsync = preferAsyncHeader || payload.lineItems.length > 100;
// if sync: race render against 10s timeout → on timeout flip to async 202
```

**Hard timeout:** 10s wall clock for sync path; worker uses 120s internal timeout.

### 5.4 Workspace API Endpoints

| Method | Path | Purpose |
| --- | --- | --- |
| POST | `/v1/workspaces` | Create workspace (auth required); creator becomes sole owner member |
| GET | `/v1/workspaces` | List user's workspaces (membership check) |
| PATCH | `/v1/workspaces/{workspaceId}` | Rename workspace (ownership check) |
| POST | `/v1/workspaces/active` | Set active workspace (`{ workspaceId }`; membership check) |
| GET | `/v1/workspaces/active` | Get active workspace + tier (membership check) |

All existing `/v1/*` resource routes resolve tenant from API key's workspace or session active org. Returns `403 WORKSPACE_REQUIRED` when user has zero workspaces or active workspace unset on resource routes (except workspace bootstrap endpoints).

---

## 6. Repository Layout (Full)

```text
usetagih/
├── apps/
│   ├── api/
│   │   ├── src/
│   │   │   ├── index.ts              # Elysia app bootstrap
│   │   │   ├── routes/v1/            # validate, render, renders, keys, webhooks, audit, schemas, share
│   │   │   ├── middleware/           # auth, rate-limit, idempotency, request-id
│   │   │   ├── worker.ts             # pg-boss consumer entry
│   │   │   └── openapi.ts
│   │   ├── drizzle/                  # re-export migrations from packages/db
│   │   ├── Dockerfile
│   │   └── package.json              # name: @usetagih/api
│   ├── web/
│   │   ├── app/                      # Next.js App Router
│   │   │   ├── (public)/             # landing, auth, share
│   │   │   └── app/                  # authenticated shell
│   │   ├── components/               # Mantine UI per EXPERIENCE.md screens
│   │   ├── lib/api-client.ts         # wraps @usetagih/sdk
│   │   ├── theme/                    # DESIGN.md tokens → Mantine createTheme
│   │   ├── Dockerfile
│   │   └── package.json              # name: @usetagih/web
│   └── mcp/
│       └── README.md                 # v1.1 stub — "calls REST only"
├── packages/
│   ├── schema/
│   │   ├── src/document/             # Zod discriminated union §10.1
│   │   ├── src/errors/               # error codes enum
│   │   ├── src/openapi/              # OpenAPI 3.1 generator
│   │   └── package.json              # name: @usetagih/schema
│   ├── core/
│   │   ├── src/use-cases/            # validate, render, preview, webhook, idempotency
│   │   ├── src/ports/                # interfaces: RenderRepo, ArtifactStore, Queue
│   │   └── package.json
│   ├── render/
│   │   ├── src/typst-driver.ts
│   │   ├── fonts/
│   │   ├── __fixtures__/
│   │   ├── scripts/golden-check.ts
│   │   └── package.json              # name: @usetagih/render
│   ├── templates/
│   │   ├── invoice/{modern,classic}.typ
│   │   ├── quotation/{modern,classic}.typ
│   │   ├── receipt/{modern,classic}.typ
│   │   ├── _shared/preamble.typ
│   │   └── CONTRIBUTING.md           # prerequisite before parallel template stories merge
│   ├── sdk/
│   │   ├── src/client.ts             # validateLocally, render, types
│   │   └── package.json              # name: @usetagih/sdk
│   ├── db/
│   │   ├── src/schema/               # Drizzle tables
│   │   ├── migrations/
│   │   └── package.json              # name: @usetagih/db
│   └── config/
│       ├── tsconfig/base.json
│       ├── biome.json
│       └── package.json
├── docker/
│   ├── compose.yml
│   ├── Dockerfile.api
│   ├── Dockerfile.web
│   └── Dockerfile.render-ci
├── .github/workflows/
│   ├── ci.yml
│   └── pdf-golden.yml
├── turbo.json
├── package.json                        # workspaces root
└── doppler.yaml
```

### 6.1 Package Dependency Graph

```mermaid
flowchart BT
  schema[schema]
  db[db]
  render[render]
  templates[templates]
  core[core ports + use-cases]
  sdk[sdk]
  api[api composition root]
  web[web]
  core --> schema
  render --> templates
  api --> core
  api --> db
  api --> render
  api --> schema
  sdk --> schema
  web --> sdk
```

`packages/core` depends on `packages/schema` only. `apps/api` wires Drizzle repos (`packages/db`), Typst driver (`packages/render`), R2, and pg-boss to core ports.

---

## 7. Database Schema (Drizzle)

### 7.1 Core Tables

| Table | Purpose |
| --- | --- |
| `user`, `session`, `account`, `verification` | better-auth core |
| `organization`, `member`, `invitation` | better-auth organization plugin (teams off; invitation/member-add/remove/join/team ops disabled at app layer) — **`organization` is workspace identity; no duplicate `workspaces` table** |
| `workspace_settings` | `organization_id` PK, tier enum (`trial`\|`starter`\|`pro`\|`business`), branding JSON, business identity |
| `api_keys` | `id`, `workspace_id` FK → `organization.id`, `name`, `prefix`, `key_hash`, `scopes[]`, `expires_at`, `revoked_at` |
| `renders` | `id`, `workspace_id` FK, `document_type`, `template`, `schema_version`, `status`, `idempotency_hash`, `payload_hash`, `r2_key`, `sha256`, `byte_size`, `share_token`, `share_expires_at`, `logo_checksum`, snapshot columns (`resolved_tier`, `show_watermark`, `branding_snapshot`), `error_code`, timestamps |
| `idempotency_keys` | `workspace_id`, `endpoint`, `key_hash`, `request_hash`, `response_body`, `expires_at` |
| `webhooks` | `id`, `workspace_id`, `url`, `secret_hash`, `events[]`, `disabled_at`, `failure_streak_since` (Epic 4) |
| `webhook_deliveries` | `id`, `event_id`, `webhook_id`, `render_id`, `attempt`, `status`, `next_attempt_at`, `response_code` |
| `audit_events` | append-only: `id`, `workspace_id` (nullable only for signup/login/bootstrap), `user_id` actor, `action`, `resource_type`, `resource_id`, `outcome`, `ip`, `metadata`, `created_at` |
| `usage_counters` | `workspace_id`, month, render_count |

### 7.2 Migration Strategy

- **Tool:** Drizzle Kit (`drizzle-kit generate` / `migrate`)
- **Location:** `packages/db/migrations/`
- **Naming:** `YYYYMMDDHHMMSS_description.sql`
- **Local:** `bun run --filter @usetagih/db migrate` against compose Postgres
- **Prod:** run migrate as Coolify pre-deploy hook on `api` container
- **Rollback:** forward-only at MVP; corrective migration if needed
- **Seed:** `packages/db/seed/dev.ts` — test user, sample API key (dev only)

---

## 8. Local Development

### 8.1 Docker Compose (`docker/compose.yml`)

| Service | Image | Ports |
| --- | --- | --- |
| `postgres` | `postgres:16-alpine` | 5432 |
| `minio` | `minio/minio` | 9000 (S3 API), 9001 (console) |
| `createbuckets` | minio mc | creates `usetagih-artifacts` bucket |
| `api` | build `Dockerfile.api` | 3001 |
| `web` | build `Dockerfile.web` | 3000 |

### 8.2 Dev Commands (root)

```bash
doppler run --config dev -- docker compose -f docker/compose.yml up -d postgres minio
doppler run --config dev -- bun run dev          # turbo: api + web
bun run --filter @usetagih/db migrate
bun run --filter @usetagih/render golden:check
bun test
bun run e2e                                     # playwright against localhost:3000
```

### 8.3 MinIO as R2 Emulation

Env in Doppler `dev`:

```
R2_ENDPOINT=http://localhost:9000
R2_BUCKET=usetagih-artifacts
R2_ACCESS_KEY_ID=minioadmin
R2_SECRET_ACCESS_KEY=minioadmin
R2_FORCE_PATH_STYLE=true
```

Prod uses Cloudflare R2 endpoint without path-style forcing.

---

## 9. Environment Variables (Doppler)

**Project:** `usetagih`  
**Configs:** `dev`, `staging`, `prod`

| Variable | Used by | Description |
| --- | --- | --- |
| `DATABASE_URL` | api, worker | PostgreSQL connection |
| `BETTER_AUTH_SECRET` | api, web | Session signing |
| `BETTER_AUTH_URL` | api, web | Public auth base URL |
| `GITHUB_CLIENT_ID` | api | OAuth |
| `GITHUB_CLIENT_SECRET` | api | OAuth |
| `USETAGIH_API_PUBLIC_URL` | api, web, sdk | e.g. `https://api.usetagih.com` |
| `USETAGIH_WEB_PUBLIC_URL` | api, web | e.g. `https://app.usetagih.com` |
| `USETAGIH_SHARE_SIGNING_SECRET` | api | HMAC for share URLs |
| `USETAGIH_WEBHOOK_SIGNING_SECRET` | api | Default webhook secret pepper |
| `R2_ENDPOINT` | api | S3-compatible endpoint |
| `R2_BUCKET` | api | Artifact bucket name |
| `R2_ACCESS_KEY_ID` | api | R2 access key |
| `R2_SECRET_ACCESS_KEY` | api | R2 secret |
| `R2_PUBLIC_URL` | api | Optional CDN base for share links |
| `USETAGIH_RATE_LIMIT_RENDERS_PER_MIN` | api | Default 60 |
| `SOURCE_DATE_EPOCH` | render CI | Fixed epoch for determinism |
| `TYPST_BINARY_PATH` | api, render | Default `/usr/local/bin/typst` |
| `NEXT_PUBLIC_USETAGIH_API_URL` | web | Browser-visible API base |
| `DOPPLER_TOKEN` | Coolify | Injected at deploy — not in repo |

---

## 10. CI (GitHub Actions)

### 10.1 `ci.yml` (main)

| Job | Steps |
| --- | --- |
| `lint` | `bun install`, `turbo lint` (Biome) |
| `typecheck` | `turbo typecheck` |
| `unit` | `bun test` all packages |
| `openapi` | Spectral validate generated OpenAPI |
| `build` | `turbo build` |
| `e2e` | Playwright against docker compose stack (postgres, minio, api, web) |
| `worker-integration` | pg-boss Bun compatibility + graceful shutdown (SIGTERM drain) |
| `docker-push` | On `main` merge: build + push `ghcr.io/verasic-labs/usetagih-api`, `usetagih-web`, `usetagih-render-ci` |

### 10.2 Bun in CI

```yaml
- uses: oven-sh/setup-bun@v2
  with:
    bun-version: "1.2.x"
```

---

## 11. Deploy Topology (Coolify / Contabo VPS)

```mermaid
flowchart TB
  subgraph internet [Internet]
    USER[Users / Integrators]
    CF[Cloudflare DNS + proxy]
  end
  subgraph vps [Contabo VPS 6c/12GB]
    COOL[Coolify]
    WEB[app.usetagih.com web]
    API[api.usetagih.com api]
    WORKER[worker container]
    PG[(PostgreSQL 16)]
    UM[umami.usetagih.com]
  end
  R2[(Cloudflare R2)]
  USER --> CF
  CF --> WEB
  CF --> API
  CF --> UM
  WEB --> API
  API --> PG
  WORKER --> PG
  API --> R2
  WORKER --> R2
  COOL --> WEB
  COOL --> API
  COOL --> WORKER
  COOL --> PG
  COOL --> UM
```

### 11.1 Coolify Resources

| Resource | Domain | Notes |
| --- | --- | --- |
| `usetagih-web` | `app.usetagih.com` | Next.js standalone |
| `usetagih-api` | `api.usetagih.com` | Elysia compiled binary |
| `usetagih-worker` | internal | Same image as API; `worker.ts` entrypoint; separate Coolify resource |
| `usetagih-postgres` | internal | Persistent volume 20 GB |
| `usetagih-umami` | `analytics.usetagih.com` | Optional MVP-launch |

### 11.2 Deploy Flow

1. Push to `main` → GitHub Actions build + test
2. GitHub Actions builds Docker images (`Dockerfile.api`, `Dockerfile.web`, `Dockerfile.render-ci`) and pushes to **GHCR** (`ghcr.io/verasic-labs/usetagih-*`)
3. Coolify **pulls prebuilt images** from GHCR — never builds on the production VPS (competes with render traffic, threatens NFR budgets)
4. Pre-deploy: `bun run --filter @usetagih/db migrate`
5. Health checks: `GET /health` on API, `/` on web
6. Doppler sync injects secrets into Coolify env

### 11.3 Launch Readiness (blocking before prod traffic)

- [ ] External uptime monitoring on `api.usetagih.com` and `app.usetagih.com`
- [ ] Container restart policies configured (`unless-stopped` or Coolify equivalent) for api, worker, web, postgres
- [ ] One successful Postgres restore drill documented and executed (`docs/runbooks/restore-postgres.md`)

### 11.4 Resource Budget (12 GB)

| Process | Memory cap |
| --- | --- |
| PostgreSQL | 2 GB |
| API | 768 MB |
| Worker | 768 MB |
| Web | 512 MB |
| umami + its PG | 512 MB |
| Typst renders | ephemeral ≤256 MB each, max 2 concurrent |
| OS headroom | ~7 GB |

---

## 12. Observability

### 12.1 Structured Logs (evlog)

> **Supersession (2026-07-20):** `evlog` replaces `pino` for request/event logging per approved architecture amendment. Field contract and §12.2 metric names unchanged.

Required fields on render path:

```json
{
  "level": "info",
  "msg": "render.completed",
  "requestId": "req_...",
  "workspaceId": "...",
  "renderId": "rnd_...",
  "documentType": "invoice",
  "template": "modern",
  "lineItemCount": 12,
  "durationMs": 145,
  "stage": "typst_compile|r2_upload|total"
}
```

### 12.2 Metrics (Prometheus-compatible via `/metrics` or log-derived)

| Metric | Type |
| --- | --- |
| `usetagih_renders_total` | counter by status, document_type |
| `usetagih_render_duration_seconds` | histogram |
| `usetagih_webhook_deliveries_total` | counter by outcome |
| `usetagih_validation_failures_total` | counter by error_code |
| `usetagih_queue_depth` | gauge by job type (`render.process`, `webhook.deliver`) |

MVP: export via structured logs + manual dashboards; alert when `render.process` or `webhook.deliver` queue depth exceeds threshold (e.g. >50 for 5 min). Add Prometheus exporter post-launch if needed.

### 12.3 umami Analytics

- Track web: sign-up, export click, share page view
- Do **not** track API integrator render counts in umami — use `usage_counters` table
- Self-hosted on same VPS; Doppler config `UMAMI_DATABASE_URL`

---

## 13. Backup Policy (PostgreSQL)

| Policy | Setting |
| --- | --- |
| Full backup | Daily 03:00 UTC via `pg_dump` cron on VPS |
| Retention | 7 daily, 4 weekly (copy to R2 `backups/postgres/`) |
| R2 artifacts | Versioning off; artifacts reproducible from payload if retained metadata exists — backup optional |
| Restore drill | Document in `docs/runbooks/restore-postgres.md`; **one successful drill required before launch**; test quarterly thereafter |
| Encryption | R2 backup objects SSE-S3; dumps gzip |

---

## 14. MCP v1.1 Preservation (Not Built)

`apps/mcp/` stub documents:

- Tools map 1:1 to REST (§10.4)
- Implementation: `@modelcontextprotocol/sdk` + `@usetagih/sdk` only
- No imports from `packages/core` or `packages/render`
- Deploy as separate Coolify resource when ready

---

## 15. Web App Integration Notes

- **Auth:** better-auth mounted at `apps/api` `/api/auth/*`; web redirects via `BETTER_AUTH_URL`
- **Session token exchange (auth epic story):** `POST /v1/session/token` — issues short-lived (≤15 min), audience-bound Bearer tokens with CSRF protection (double-submit cookie or SameSite + custom header). Scopes of session-derived tokens must be exactly equivalent to API-key scopes; scope-parity acceptance test matrix required. No browser-exposed session→Bearer bridge; no internal route may skip idempotency (AD-5) or audit (AD-7).
- **API client:** `@usetagih/sdk` in browser calls public API with exchanged Bearer token
- **Share page:** Next.js `app/share/[token]/page.tsx` calls `GET /v1/share/{token}` public endpoint
- **Theme:** port `DESIGN.md` YAML tokens to `apps/web/theme/tokens.ts` → Mantine `createTheme`
- **Playwright e2e:** `apps/web/e2e/uj1-invoice-export.spec.ts` per FR-29
- **Headless primitives:** Mantine v8 first per AD-13; `@base-ui/react` only when a needed pattern is missing (install when first needed in Epic 6); no Radix/shadcn in `apps/web`

---

## 16. OpenAPI / SDK Generation

- Generate OpenAPI 3.1 from `@usetagih/schema` at build time
- Publish at `GET /v1/openapi.json` and `/openapi.json` redirect
- SDK types generated from same schema package — no openapi-typescript drift
- CI: `@stoplight/spectral-cli` ruleset in `packages/schema/spectral.yaml`

---

## 17. Risks for Epic Breakdown

| Risk | Severity | Epic impact |
| --- | --- | --- |
| Typst byte-stability edge case (logo fetch, float) | High | Epic-1 spike must pass all blocking criteria; failure reopens engine decision at board — no pixel fallback |
| Typst template authoring velocity (6 templates) | Medium | `packages/templates/CONTRIBUTING.md` prerequisite before parallel template stories; shared preamble |
| Next.js + Bun monorepo friction | Low | Use Node for Next prod build in Docker only |
| pg-boss load on Postgres | Low | Monitor queue depth; acceptable for MVP volume |
| Logo URL fetch breaks determinism | High | SSRF-hardened pipeline; checksum persisted bytes on render record; reject changed logo mid-idempotency |
| 10s sync timeout with large payloads | Medium | Async path + clear `RENDER_TIMEOUT` error code |
| Single VPS outage = full downtime | Medium | Accept for 99.5% MVP; document HA as post-MVP |
| Web session → API token exchange complexity | Medium | Dedicated story in auth epic; scope-parity matrix; must not bypass idempotency or audit |

---

**Status:** Final — ready for `bmad-create-epics-and-stories`.

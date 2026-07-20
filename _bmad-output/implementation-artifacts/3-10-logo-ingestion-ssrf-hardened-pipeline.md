---
baseline_commit: 4e47c2b
created: 2026-07-20
---

# Story 3.10: Logo ingestion SSRF-hardened pipeline

Status: done

<!-- Ultimate context engine analysis completed - comprehensive developer guide created -->

## Story

As a security engineer,
I want logo fetch with SSRF protections and persisted bytes+checksum,
so that branding is safe and deterministic (AD-7, SOLUTION-DESIGN §4.4).

## Acceptance Criteria

1. **Given** resolved branding with `logoUrl` (HTTPS-only per `httpsUrlSchema` — already enforced at payload parse; re-validate at ingestion boundary), **when** `ingestLogoFromUrl(url)` runs, **then** only `https:` scheme is accepted; `http:`, `file:`, `data:`, IP-literal hosts, and missing host → failure with structured error suitable for future HTTP **422** mapping (`VALIDATION_FAILED`, detail path `/branding/logoUrl`).
2. **Given** a hostname URL, **when** DNS resolves, **then** **every** resolved A/AAAA address is checked **before** connect; if **any** address is private, link-local, loopback, unspecified, CGNAT carrier-grade NAT (`100.64.0.0/10`), or IPv6 ULA/link-local → fetch aborted (SSRF block) with explicit error — no connection attempted.
3. **Given** allowed public IPs after DNS validation, **when** TCP connect proceeds, **then** use **resolve-then-connect IP pinning**: connect to the validated IP directly while sending correct `Host` SNI/header for the original hostname — mitigates DNS rebinding between resolve and connect (re-resolve or pin; document chosen strategy in code comment).
4. **Given** HTTP(S) response chain, **when** redirects occur, **then** cap at **3** total redirects; reject redirect to non-HTTPS URL; re-run SSRF IP checks on each redirect target hostname before following.
5. **Given** successful response body download, **when** bytes accumulate, **then** enforce **max 2 MB raw** response size (abort mid-stream if exceeded) and **max 10 MB decompressed** for gzip/deflate/br content-encoding (decompression-bomb protection — track inflated bytes, abort if ratio exceeds safe bound).
6. **Given** downloaded bytes, **when** content validation runs, **then** allow **only** PNG, JPEG, SVG identified by **magic-byte sniff** (not `Content-Type` alone): PNG `\x89PNG`, JPEG `\xFF\xD8\xFF`, SVG starts with `<svg` or `<?xml` then `<svg` after optional whitespace/BOM; mismatch → reject.
7. **Given** SVG bytes passing sniff, **when** `sanitizeSvgLogo()` from `@usetagih/render` runs, **then** active content stripped/rejected per Story 1.6 / SOLUTION-DESIGN §4.4 (`<script>`, event handlers, `<foreignObject>`, external refs); persisted bytes = **post-sanitization** buffer; PNG/JPEG skip sanitizer.
8. **Given** validated persisted bytes, **when** checksum computed, **then** `logoChecksum = computeLogoChecksum(bytes)` (lowercase hex SHA-256) using existing `@usetagih/render` helper — checksum covers **bytes written to storage** (post-SVG-sanitization when applicable).
9. **Given** `LogoBlobStore` port (core) + adapter, **when** first fetch for distinct `(workspaceId, logoUrl)` succeeds, **then** bytes persisted at object key `logos/{workspaceId}/{logoChecksum}.{ext}` (`png`|`jpg`|`svg`) with correct content-type metadata; return `{ bytes, logoChecksum, contentType, storageKey }`.
10. **Given** same `logoUrl` re-requested within pipeline (or render record already holds `logoChecksum` + storage key from prior step), **when** `resolveLogoUseCase` runs, **then** **no network fetch** — load bytes from `LogoBlobStore.get` by storage key / checksum only (determinism re-read path).
11. **Given** `resolveLogoUseCase({ workspaceId, workspaceBranding, payloadBranding })`, **when** both sources provide branding, **then** payload `branding.logoUrl` overrides workspace default; absent payload logo falls back to workspace `workspace_settings.branding.logoUrl`; no logo in either → `{ logo: null }` without error.
12. **Given** `resolveLogoUseCase` output consumed by render prep, **when** logo present, **then** expose bytes compatible with `prepareLogoForTypst` contract (temp local path + `logoChecksum` for `renders.logo_checksum` snapshot — Story 3.12 wires DB persist; this story delivers use-case + prep bridge helper, not HTTP routes).
13. **Given** `bun test packages/render` and `bun test packages/core`, **when** logo ingestion tests run, **then** mock HTTP server (Bun `serve` or equivalent) covers: blocked private IP (e.g. `127.0.0.1`, `10.0.0.1`, `169.254.169.254`); redirect cap exceeded; oversize body; wrong magic bytes; malicious SVG rejected; **determinism re-read** — second call with same URL returns identical checksum without second HTTP request (assert fetch call count).
14. **Given** workspace, **when** `bunx turbo run lint typecheck test build --force` runs from repo root, **then** all tasks exit 0.
15. **Out of scope (later Epic 3 stories):** HTTP routes (`POST /v1/{documentType}/render` logo wiring → Story 3.12; `POST /v1/settings/branding/logo` → Story 3.17); preview route (Story 3.11); audit events (Story 3.15); R2 production adapter if MinIO stub sufficient for tests (full R2 wiring with render upload → Story 3.12); changing golden harness fixtures (still use embedded `logoBytes`, no network in CI per §4.4); new Zod payload fields (`logoBytes` remains rejected on API payloads per Story 2.1).

## Tasks / Subtasks

- [x] Task 1 — Core ports + domain types (AC: 9, 10)
  - [x] Add `packages/core/src/ports/logo-blob-store.ts` — `get`/`put` by `{ workspaceId, storageKey }`; domain type `IngestedLogo { bytes: Uint8Array; logoChecksum: string; contentType: "image/png"|"image/jpeg"|"image/svg+xml"; storageKey: string }`
  - [x] Add `packages/core/src/ports/logo-fetcher.ts` — `fetchLogo(url: string): Promise<{ bytes: Uint8Array; contentType: string }>` (interface only — adapter implements SSRF controls)
  - [x] Export from `packages/core/src/ports/index.ts`; verify dependency-graph guard still passes (core → schema only)
- [x] Task 2 — SSRF-hardened fetch implementation (AC: 1–6)
  - [x] Create `packages/render/src/logo-ingestion/fetch-logo.ts` — implements pinning, redirect cap, size limits, magic sniff, decompression limits
  - [x] Create `packages/render/src/logo-ingestion/private-ip.ts` — shared CIDR/blocklist helpers (IPv4 + IPv6)
  - [x] Create `packages/render/src/logo-ingestion/validate-content.ts` — magic-byte rules per format
  - [x] Unit tests `packages/render/src/logo-ingestion/fetch-logo.test.ts` with mock server
- [x] Task 3 — Ingestion orchestrator in render (AC: 7, 8)
  - [x] Create `packages/render/src/logo-ingestion/ingest-logo.ts` — compose fetch → sniff → sanitize SVG → checksum → return `IngestedLogo` shape
  - [x] Reuse `sanitizeSvgLogo`, `computeLogoChecksum` — **do not** duplicate sanitizer logic
  - [x] Tests for SVG rejection path and checksum of sanitized bytes
- [x] Task 4 — LogoBlobStore adapter (AC: 9, 10)
  - [x] Implement in-memory adapter for unit tests (`packages/render/src/logo-ingestion/memory-logo-blob-store.ts` or under `packages/db` if following artifact pattern)
  - [x] Implement MinIO/filesystem adapter stub aligned with `@usetagih/db` / compose MinIO (Story 0.3) — key pattern `logos/{workspaceId}/{checksum}.{ext}`
  - [x] Tests: put then get returns identical bytes; workspace isolation on keys
- [x] Task 5 — `resolveLogoUseCase` (AC: 10, 11, 12)
  - [x] Create `packages/core/src/use-cases/resolve-logo-use-case.ts` — merge branding, cache lookup by checksum/key, fetch-on-miss via injected deps `{ logoFetcher, logoBlobStore, ingestLogo }`
  - [x] Create `packages/render/src/logo-ingestion/prepare-ingested-logo-for-typst.ts` — bridge ingested bytes to temp file + `--input logo=` relative path (mirror `prepareLogoForTypst` but from `IngestedLogo`, not fixture JSON)
  - [x] Export use case from `packages/core/src/use-cases/index.ts`
  - [x] Tests in `packages/core/src/use-cases/resolve-logo-use-case.test.ts` with fake fetcher/store
- [x] Task 6 — Determinism + SSRF integration tests (AC: 13)
  - [x] Mock server scenarios: private IP host, redirect loop, 3MB body, fake PNG header with HTML body, XSS SVG
  - [x] Assert single-fetch caching on repeated `resolveLogoUseCase` calls
- [x] Task 7 — Verification gate (AC: 14)
  - [x] `bun test packages/core`
  - [x] `bun test packages/render`
  - [x] `bunx turbo run lint typecheck test build --force`

## Dev Notes

### Goal

Deliver the **SSRF-hardened logo ingestion pipeline** ratified in AD-7 and SOLUTION-DESIGN §4.4: fetch once from HTTPS `logoUrl`, validate bytes, sanitize SVG, persist immutable bytes + SHA-256 checksum, re-read from storage on subsequent use. Epic 1 proved Typst rendering from persisted bytes (Story 1.6); this story adds **production URL fetch** without breaking golden CI (fixtures stay on embedded `logoBytes`).

### Binding ratified sources

| Ref | Requirement for 3.10 |
| --- | --- |
| **AD-7** | SSRF block private/link-local; resolve-then-connect pinning; redirect/size/content-type limits; decompression-bomb protection; SVG active content stripped; fetch once, render from persisted bytes + checksum |
| **AD-1** | Use-case in `packages/core`; fetch/store adapters implement core ports; routes do not embed fetch logic (Story 3.12 composes) |
| **AD-6** | Object storage key pattern under workspace prefix (PDFs at `renders/…`; logos at `logos/…`) |
| **FR-7** | Deterministic render — checksum on persisted bytes defines identity |
| **PRD §10.1** | `branding.logoUrl` HTTPS-only; max 2 MB; PNG/JPEG/SVG only |
| **SOLUTION-DESIGN §4.1 step 4** | Resolve branding → logo pipeline → snapshot checksum on render record |
| **SOLUTION-DESIGN §4.4** | Full control table (SSRF, redirects, size, sniff, SVG, storage, determinism) |
| **Story 1.6** | `sanitizeSvgLogo`, `computeLogoChecksum`, `prepareLogoForTypst` — **reuse, do not fork** |
| **Story 2.1** | API payloads reject `branding.logoBytes` — only `logoUrl` in validated payloads |
| **Story 3.1** | `renders.logo_checksum` column exists; populate in Story 3.12 |
| **Story 3.2** | Port/adapter hex pattern; core depends on `@usetagih/schema` only |
| **Story 3.9** | Validate routes done — logo failures later map to 422 before Typst in Story 3.12 |

### Scope boundary: 3.10 vs adjacent stories

| Capability | Owner | 3.10 delivers |
| --- | --- | --- |
| SSRF-safe HTTPS fetch + byte validation | **3.10** | Full |
| SVG sanitization primitive | **1.6** | Reuse only |
| `resolveLogoUseCase` + blob persist | **3.10** | Full |
| Typst `--input logo=` from ingested bytes | **3.10** | Bridge helper |
| HTTP render route invoking pipeline | **3.12** | Do not implement |
| Settings logo upload endpoint | **3.17** | Reuses same ingestion module |
| Preview route | **3.11** | Do not implement |
| Golden harness network fetch | **never** | Fixtures use `logoBytes` |

### Evidence-based decisions (no human loop)

| Decision | Choice | Rationale |
| --- | --- | --- |
| Module location for fetch | `packages/render/src/logo-ingestion/` | Story 1.6 already owns logo bytes + sanitizer + checksum; keeps `@usetagih/core` free of HTTP/driver deps |
| Core ports | `LogoFetcher` + `LogoBlobStore` | AD-1 — use-case orchestrates; adapters in render/db/api |
| Error vocabulary | Reuse `VALIDATION_FAILED` + `/branding/logoUrl` detail | PRD §10.3 — no new error codes unless unavoidable; Story 3.12 maps to HTTP 422 |
| Storage key | `logos/{workspaceId}/{logoChecksum}.{ext}` | Content-addressed by checksum — dedupe identical logos per workspace; aligns with AD-6 prefix pattern |
| Cache / no re-fetch | Lookup blob store by checksum before network | SOLUTION §4.4 determinism + idempotency safety (Story 3.8) |
| Branding merge | Payload overrides workspace settings | PRD §10.1 + SOLUTION §4.1 step 4 |
| CI golden tests | No network | §4.4 explicit — mock server only in unit tests |
| `ArtifactStore` PDF-only | Add separate `LogoBlobStore` port | Avoid widening PDF contract; logos are not PDF artifacts |

### SSRF blocklist (encode exactly)

Reject resolved addresses matching (IPv4 and IPv6):

| Range | Notes |
| --- | --- |
| `127.0.0.0/8` | Loopback |
| `10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16` | RFC1918 |
| `169.254.0.0/16` | Link-local / cloud metadata |
| `100.64.0.0/10` | CGNAT |
| `0.0.0.0/8` | Current network |
| `::1/128` | IPv6 loopback |
| `fc00::/7` | IPv6 ULA |
| `fe80::/10` | IPv6 link-local |

Also reject hostname literals that parse as IP without DNS (apply same checks).

### Fetch implementation sketch

**File:** `packages/render/src/logo-ingestion/fetch-logo.ts`

```typescript
export type FetchLogoResult =
  | { ok: true; bytes: Buffer; contentType: "image/png" | "image/jpeg" | "image/svg+xml" }
  | { ok: false; reason: string };

export async function fetchLogoSsrfSafe(
  url: string,
  deps?: { fetch?: typeof fetch; maxRedirects?: number },
): Promise<FetchLogoResult>;
```

Implementation requirements:

- Parse URL; require `https:` protocol.
- `dns.promises.lookup(hostname, { all: true, verbatim: true })` — validate all records.
- Connect using pinned IP (Bun `fetch` with custom `connect` if available, else `node:https.request` to IP with `servername` / `Host` header).
- Manual redirect follow with counter ≤ 3; re-validate each new URL.
- Stream body with running byte count; abort > 2_097_152 bytes.
- If `content-encoding` gzip/deflate/br, decompress with inflated cap 10_485_760 bytes.

### Magic-byte sniff (encode exactly)

| Format | Rule |
| --- | --- |
| PNG | First 8 bytes `89 50 4E 47 0D 0A 1A 0A` |
| JPEG | First 3 bytes `FF D8 FF` |
| SVG | Trim BOM/whitespace; starts with `<svg` (case-insensitive) OR `<?xml` with `<svg` within first 1 KB |

If sniff disagrees with allowed set → reject.

### `resolveLogoUseCase` signature (encode exactly)

**File:** `packages/core/src/use-cases/resolve-logo-use-case.ts`

```typescript
export type ResolveLogoInput = {
  workspaceId: string;
  workspaceBranding?: { logoUrl?: string; accentColor?: string } | null;
  payloadBranding?: { logoUrl?: string; accentColor?: string } | null;
};

export type ResolveLogoDeps = {
  ingestFromUrl: (url: string) => Promise<IngestedLogo>;
  getStoredLogo: (params: {
    workspaceId: string;
    logoChecksum: string;
  }) => Promise<IngestedLogo | null>;
  storeLogo: (logo: IngestedLogo & { workspaceId: string }) => Promise<void>;
};

export type ResolveLogoResult =
  | { ok: true; logo: IngestedLogo | null; mergedBranding: { logoUrl?: string; accentColor?: string } }
  | { ok: false; code: "VALIDATION_FAILED"; message: string; path: "/branding/logoUrl" };
```

Flow:

1. Merge branding (payload wins on `logoUrl` / `accentColor`).
2. If no `logoUrl` → `{ ok: true, logo: null, mergedBranding }`.
3. If blob already exists for URL checksum (optional URL→checksum cache layer) or storage hit → return stored bytes **without fetch**.
4. Else `ingestFromUrl` → `storeLogo` → return.

### Current state — files to read before editing

| File | Current state | 3.10 changes |
| --- | --- | --- |
| `packages/render/src/svg-sanitize.ts` | `sanitizeSvgLogo()` allowlist | **No behavior change** — call from ingestion |
| `packages/render/src/render-record.ts` | `computeLogoChecksum()` | **Reuse** |
| `packages/render/src/logo-prep.ts` | Fixture `logoBytes` → Typst path | **Keep** for golden harness; add parallel path for ingested logos |
| `packages/core/src/ports/artifact-store.ts` | PDF-only | **Do not widen** — add `LogoBlobStore` |
| `packages/schema/src/document/branding.ts` | `logoUrl` https | **No change** |
| `packages/db/src/schema/renders.ts` | `logoChecksum` column | **No migration** — populated in 3.12 |
| `packages/db/src/schema/workspace-settings.ts` | `branding` jsonb | Read in use-case via future repo; 3.10 tests pass branding inline |

### Testing requirements

| Suite | Coverage |
| --- | --- |
| `fetch-logo.test.ts` | SSRF blocked hosts; redirect cap; size limit; magic sniff |
| `ingest-logo.test.ts` | End-to-end mock server → sanitized SVG + checksum |
| `resolve-logo-use-case.test.ts` | Branding merge; cache hit skips fetch (mock ingest counter) |
| Golden harness | **Must remain green** — no changes to manifest network assumptions |

Mock server pattern (Bun):

```typescript
const server = Bun.serve({
  port: 0,
  fetch(req) {
    // return controlled responses per test case
  },
});
const url = `https://127.0.0.1:${server.port}/logo.png`; // expect SSRF block before connect
```

For allowed-public tests, bind mock server to `0.0.0.0` but use hostname `localhost` — expect **block** on resolve (loopback). Use a synthetic public IP test via mocked `lookup` injection (dependency injection on DNS module).

**Critical:** Tests must inject/mock DNS resolution — do not rely on real external URLs in CI.

### Previous story intelligence

| Story | Learning for 3.10 |
| --- | --- |
| **1.6** | Checksum is post-SVG-sanitization; golden uses `logoBytes` not URLs |
| **1.7** | Do **not** run `sanitizeSvgLogo` on Typst output — only on user logo bytes |
| **3.2** | New ports in core; adapters outside; dependency-graph test must pass |
| **3.6** | Logo errors surface as AD-11 envelope in HTTP layer (Story 3.12) |
| **3.8** | Idempotency requires stable logo bytes mid-window — persisted checksum satisfies |
| **3.9** | Thin routes call core use-cases — ingestion stays out of `apps/api` until 3.12 |

### Git intelligence (recent Epic 3 pattern)

Recent commits (`4e47c2b` baseline): validate routes + shared `document-type-paths.ts`; postgres-gated integration tests; `map-*-result.ts` HTTP mappers; scope registry updates. Follow same test layout: unit tests colocated, integration optional postgres gate, turbo `--force` gate.

### Latest technical notes (Bun 1.x)

- Prefer `Bun.serve` for mock HTTPS in tests; inject custom `fetch`/`lookup` into ingestion for determinism.
- Avoid new npm deps for SSRF (use `node:dns`, `node:https`, or Bun native fetch with test doubles).
- If Bun fetch cannot pin IP in your runtime version, use `node:https.request` with `createConnection` override — document version caveat in code comment.

### Project Structure Notes

- Logo ingestion lives under `packages/render/src/logo-ingestion/` (new directory).
- Core use-case + ports under `packages/core/src/` per hex architecture.
- No `apps/api` route changes in this story.
- Wire adapters in Story 3.12 `AppDeps`.

### References

- [Source: _bmad-output/planning-artifacts/epics.md — Story 3.10]
- [Source: _bmad-output/planning-artifacts/architecture/architecture-usetagih-2026-07-20/SOLUTION-DESIGN.md §4.4]
- [Source: _bmad-output/planning-artifacts/architecture/architecture-usetagih-2026-07-20/ARCHITECTURE-SPINE.md — AD-7]
- [Source: packages/render/src/svg-sanitize.ts — sanitizeSvgLogo]
- [Source: packages/render/src/render-record.ts — computeLogoChecksum]
- [Source: packages/render/src/logo-prep.ts — prepareLogoForTypst fixture path]
- [Source: _bmad-output/implementation-artifacts/1-6-logo-determinism-fixture-png-jpeg-svg-blocking.md]
- [Source: _bmad-output/implementation-artifacts/3-2-packages-core-ports-and-validate-use-case.md — port pattern]

## Dev Agent Record

### Agent Model Used

composer-2.5-fast

### Completion Notes List

- SSRF-hardened `fetchLogoSsrfSafe` with DNS pre-check, IP pinning via `node:https`, redirect cap, size/decompression limits, magic-byte sniff
- `ingestLogoFromUrl` composes fetch → sanitize SVG → `computeLogoChecksum` → storage key `logos/{workspaceId}/{checksum}.{ext}`
- `resolveLogoUseCase` merges branding (payload overrides workspace), URL cache skip re-fetch, maps failures to `VALIDATION_FAILED` `/branding/logoUrl`
- In-memory + filesystem `LogoBlobStore` adapters; `prepareIngestedLogoForTypst` bridge for Story 3.12
- `docker compose -f docker/compose.yml up -d postgres` + `bunx turbo run lint typecheck test build --force` → 36/36 exit 0

### File List

- packages/core/src/ports/logo-blob-store.ts
- packages/core/src/ports/logo-fetcher.ts
- packages/core/src/ports/index.ts
- packages/core/src/use-cases/resolve-logo-use-case.ts
- packages/core/src/use-cases/resolve-logo-use-case.test.ts
- packages/core/src/use-cases/index.ts
- packages/core/src/index.ts
- packages/render/src/logo-ingestion/fetch-logo.ts
- packages/render/src/logo-ingestion/fetch-logo.test.ts
- packages/render/src/logo-ingestion/private-ip.ts
- packages/render/src/logo-ingestion/private-ip.test.ts
- packages/render/src/logo-ingestion/validate-content.ts
- packages/render/src/logo-ingestion/ingest-logo.ts
- packages/render/src/logo-ingestion/ingest-logo.test.ts
- packages/render/src/logo-ingestion/memory-logo-blob-store.ts
- packages/render/src/logo-ingestion/memory-logo-blob-store.test.ts
- packages/render/src/logo-ingestion/filesystem-logo-blob-store.ts
- packages/render/src/logo-ingestion/prepare-ingested-logo-for-typst.ts
- packages/render/src/logo-ingestion/prepare-ingested-logo-for-typst.test.ts
- packages/render/src/logo-ingestion/index.ts
- packages/render/src/index.ts
- packages/render/package.json
- bun.lock
- _bmad-output/implementation-artifacts/3-10-logo-ingestion-ssrf-hardened-pipeline.md
- _bmad-output/implementation-artifacts/sprint-status.yaml

## Change Log

- 2026-07-20: story 3.10 implementation — SSRF-hardened logo ingestion pipeline (status → review)
- 2026-07-20: adversarial code review — no medium+ findings; status → done

## Code Review (2026-07-20)

**Reviewer:** adversarial code review (Story 3.10 logo ingestion SSRF pipeline)  
**Implementation:** PR #23 @ `d569aa6`  
**Verdict:** **PASS** — all 15 ACs satisfied; no medium+ code fixes required

### AC checklist (15/15)

| AC | Result | Notes |
| --- | --- | --- |
| 1 | PASS | `validateHttpsUrl` rejects `http:`, `file:`, `data:`, IP-literal hosts, missing host; failures surface as `VALIDATION_FAILED` `/branding/logoUrl` via `resolveLogoUseCase` |
| 2 | PASS | `resolveAndValidateHost` checks every DNS A/AAAA record against RFC1918, loopback, link-local, CGNAT, unspecified, IPv6 ULA/link-local blocklist before connect |
| 3 | PASS | Resolve-then-connect IP pinning via `node:https` to validated address with `servername`/`Host` for original hostname; documented in `fetch-logo.ts` |
| 4 | PASS | Manual redirect follow capped at 3; non-HTTPS redirect targets rejected; each redirect re-runs URL + DNS SSRF validation |
| 5 | PASS | Raw body stream capped at 2 MB; gzip/deflate/br decompression capped at 10 MB via `maxOutputLength` |
| 6 | PASS | `sniffLogoContentType` enforces PNG/JPEG/SVG magic bytes; ignores `Content-Type` header alone |
| 7 | PASS | SVG path runs `sanitizeSvgLogo`; persisted bytes are post-sanitization; PNG/JPEG skip sanitizer |
| 8 | PASS | `computeLogoChecksum` on bytes written to storage (post-SVG-sanitization when applicable) |
| 9 | PASS | `buildLogoStorageKey` → `logos/{workspaceId}/{logoChecksum}.{ext}`; `LogoBlobStore.put` accepts content-type metadata |
| 10 | PASS | `findLogoByUrl` cache + `resolveLogoUseCaseFromStorage` re-read by checksum/key skip network; tests assert single fetch count |
| 11 | PASS | `mergeBranding` payload overrides workspace; absent payload logo falls back to workspace; no logo → `{ logo: null }` |
| 12 | PASS | `prepareIngestedLogoForTypst` writes temp file + relative `logo=` arg + returns `logoChecksum` for render snapshot wiring |
| 13 | PASS | Mock-server tests cover blocked private IPs, redirect cap, oversize body, wrong magic bytes, malicious SVG, determinism re-read |
| 14 | PASS | `docker compose postgres` + `bunx turbo run lint typecheck test build --force` → 36/36 exit 0 |
| 15 | PASS | No HTTP routes, preview, audit, R2 production adapter, golden fixture network fetch, or API payload schema changes |

### Findings triage

| ID | Sev | Bucket | Title | Resolution |
| --- | --- | --- | --- | --- |
| CR-1 | low | defer | `LogoBlobStore` filesystem stub stores bytes only (no separate content-type sidecar) | AC 15 allows MinIO/filesystem stub for tests; Story 3.12 production adapter can persist metadata |
| CR-2 | low | defer | IPv4-mapped IPv6 addresses fail-closed when parser cannot extract embedded IPv4 | DNS AAAA records rarely use `::ffff:` form; fail-closed favors SSRF safety over edge-case reachability |
| CR-3 | low | dismiss | `findLogoByUrl` is optional on `ResolveLogoDeps` | Composition root (Story 3.12) wires `MemoryLogoBlobStore.findByUrl`; `resolveLogoUseCaseFromStorage` covers checksum/key re-read path per AC 10 |
| CR-4 | low | dismiss | Alternate IPv4 encodings (`0177.0.0.1`, `2130706433`) bypass `isBlockedHostname` on raw hostname | `URL` normalizes hostname to dotted-quad before SSRF checks; fetch rejects loopback encodings |
| CR-5 | low | dismiss | `streamBodyWithLimit` may invoke `resolve` twice on oversize streams | Promise first-resolve wins; stream destroyed on limit breach; no observed incorrect success path |

### Verification run

| Gate | Result | Notes |
| --- | --- | --- |
| `docker compose -f docker/compose.yml up -d postgres` | **PASS** | Container healthy |
| `bunx turbo run lint typecheck test build --force` | **36/36 exit 0** | Logo ingestion suites: 23 pass in `packages/render` + `packages/core` |

## Story Validation Record

**Validated:** 2026-07-20 (create-story step 6 checklist)

| Check | Result |
| --- | --- |
| Epics Story 3.10 AC coverage | PASS |
| SOLUTION-DESIGN §4.4 control table mapped | PASS |
| Story 1.6 sanitizer/checksum reuse | PASS |
| AD-1 hex boundary (ports + use-case) | PASS |
| Out of scope boundaries (HTTP routes, settings upload, preview) | PASS |
| SSRF test strategy with mock server | PASS |
| Determinism re-read without re-fetch | PASS |
| Golden CI no-network preserved | PASS |
| Verification commands with turbo `--force` | PASS |
| Prior stories 3.1–3.9 patterns referenced | PASS |

---
baseline_commit: d879b85
created: 2026-07-20
---

# Story 3.11: POST /v1/{documentType}/preview — multi-page SVG response

Status: review

<!-- Ultimate context engine analysis completed - comprehensive developer guide created -->

## Story

As a direct user,
I want HTML/SVG preview from validated payload without persisting artifact,
so that I review document before export (FR-10, Story 1.7 contract).

## Acceptance Criteria

1. **Given** valid authenticated payload with `renders:write` scope, **when** `POST /v1/invoices/preview` (and `quotations` / `receipts` path segments) is called, **then** HTTP **200** with `{ valid: true, pageCount, pages: [{ index, svg }], html }` per SOLUTION-DESIGN §4.2 — flat success body, not envelope-wrapped.
2. **Given** validated payload, **when** preview compiles, **then** uses the **same** Typst `.typ` template + `--input json=` + `tier=` + optional `logo=` as the PDF path; `pageCount` equals PDF metadata from `query(<page-count>)` on identical inputs (Story 1.7 parity contract).
3. **Given** preview succeeds, **when** response is inspected, **then** **no** `renders` row inserted, **no** R2 artifact, **no** share URL, **no** idempotency key consumed — ephemeral only.
4. **Given** each Typst-emitted SVG page, **when** returned in `pages[].svg`, **then** `sanitizeTypstOutputSvg()` runs (output profile — **not** `sanitizeSvgLogo`); reject/throw if active content remains after sanitization.
5. **Given** `html` field, **when** built from sanitized pages, **then** each page wrapped as `<div class="page" data-page="{index}">{svg}</div>` concatenated in ascending index order (SOLUTION-DESIGN §4.2).
6. **Given** workspace tier from `workspace_settings`, **when** Typst inputs built, **then** map `trial` → `--input tier=free`; `starter`|`pro`|`business` → `tier=pro` (§4.3 watermark rule — preview shows watermark for trial).
7. **Given** payload and workspace branding, **when** logo URL present, **then** invoke `resolveLogoUseCase` (Story 3.10) and pass ingested bytes via `prepareIngestedLogoForTypst`; no network re-fetch on cached checksum.
8. **Given** invalid payload or path/body document type mismatch, **when** preview called, **then** same HTTP mapping as validate route (`422` validation, `400` mismatch/unsupported schemaVersion) via shared validate step — Typst **not** invoked.
9. **Given** logo ingestion failure, **when** preview called, **then** HTTP **422** `VALIDATION_FAILED` with detail path `/branding/logoUrl`.
10. **Given** template file missing on disk (e.g. `quotation/modern.typ` before Epic 5), **when** preview called after validation passes, **then** HTTP **400** `INVALID_REQUEST` with detail path `/template` and message indicating template unavailable — route still registered for all three path segments.
11. **Given** `packages/render` test suite with Typst available, **when** pagination fixture `invoice-modern-pagination-25` preview runs, **then** `pageCount === 3` and matches PDF page count helper (AC from epics / Story 1.7).
12. **Given** `packages/schema/src/auth/scopes.ts`, **when** updated, **then** includes `POST /v1/invoices|quotations|receipts/preview` → `["renders:write"]`; session.token scope parity matrix extended.
13. **Given** `bun test apps/api`, **when** preview tests run, **then** unit tests cover: auth/scope denial; validate failure → 422 before Typst; document-type mismatch → 400; invoice happy path mocked render layer; scope registry parity.
14. **Given** compose Postgres + Typst available, **when** `apps/api/src/integration/preview.integration.test.ts` runs (postgres-gated, typst-gated), **then** sign-up → API key → `POST /v1/invoices/preview` with `invoice-minimal.json` → 200, `valid: true`, `pageCount >= 1`, `pages[0].svg` starts with `<svg`.
15. **Given** workspace, **when** `docker compose -f docker/compose.yml up -d postgres` then `bunx turbo run lint typecheck test build --force`, **then** all tasks exit 0.
16. **Out of scope (later stories):** render record persist (Story 3.12); idempotency on preview; audit events (Story 3.15); rate limits (Story 3.16); quotation/receipt Typst templates beyond availability check (Epic 5); SDK client (Story 7.2); OpenAPI Spectral (Story 7.4).

## Tasks / Subtasks

- [x] Task 1 — Render layer: template resolution + payload preview (AC: 2, 4, 5, 11)
  - [x] Add `packages/render/src/template-path.ts` — `resolveDocumentTemplatePath(documentType, template)` → absolute `.typ` path under `packages/templates/{type}/{template}.typ`; throw typed error if missing
  - [x] Add `packages/render/src/preview-from-payload.ts` — write payload JSON to temp dir, optional logo via `prepareIngestedLogoForTypst`, call `renderPreview()`, build `html` wrapper; cleanup temps in `finally`
  - [x] Add `mapWorkspaceTierToTypstTier(tier)` helper in render or core
  - [x] Export from `packages/render/src/index.ts`
  - [x] Extend `preview.test.ts` or add `preview-from-payload.test.ts` — pagination parity when Typst available
- [x] Task 2 — Core `previewUseCase` (AC: 2, 6, 7, 8, 9, 10)
  - [x] Create `packages/core/src/use-cases/preview-use-case.ts` — compose `validateUseCase`, `resolveLogoUseCase`, template check, `renderPreviewFromPayload` via injected deps
  - [x] Export from `packages/core/src/use-cases/index.ts` and `packages/core/src/index.ts`
  - [x] Unit tests with fake render + logo deps in `preview-use-case.test.ts`
- [x] Task 3 — DB workspace settings reader (AC: 6, 7)
  - [x] Add `packages/db/src/repositories/workspace-settings-repo.ts` — `getByOrganizationId(workspaceId)` → `{ tier, branding }`
  - [x] Export `createWorkspaceSettingsRepo` from `packages/db/src/index.ts`
- [x] Task 4 — API route + HTTP mapping (AC: 1, 3, 8, 9, 10, 12)
  - [x] Create `apps/api/src/lib/map-preview-result.ts` — maps use-case result → 200 body or AD-11 envelope
  - [x] Create `apps/api/src/routes/v1/preview-by-document-type.ts` — POST `/{invoices|quotations|receipts}/preview` with `authenticated: true`, `requireScope: "renders:write"`
  - [x] Wire logo ingestion deps (reuse Story 3.10 modules) in route factory or `AppDeps`
  - [x] Wire in `apps/api/src/app.ts`
  - [x] Extend `ROUTE_SCOPE_REQUIREMENTS` + `session.token.test.ts` matrix
- [x] Task 5 — Tests (AC: 13, 14)
  - [x] `apps/api/src/routes/v1/preview-by-document-type.test.ts`
  - [x] `apps/api/src/lib/map-preview-result.test.ts`
  - [x] `apps/api/src/integration/preview.integration.test.ts` — postgres + typst gated
- [x] Task 6 — Verification gate (AC: 15)
  - [x] `docker compose -f docker/compose.yml up -d postgres`
  - [x] `bunx turbo run lint typecheck test build --force`

## Dev Notes

### Goal

Expose **`POST /v1/{documentType}/preview`** — validate payload, resolve branding/logo (Story 3.10), compile multi-page SVG via existing `renderPreview()` (Story 1.7), return §4.2 response shape. No persistence side effects.

### Binding ratified sources

| Ref | Requirement for 3.11 |
| --- | --- |
| **FR-10** | Preview uses same Typst engine as PDF; multi-page SVG |
| **AD-1** | `previewUseCase` in `packages/core`; thin Elysia route |
| **AD-10** | Story 1.7 parity — page count must match PDF metadata |
| **AD-11** | Errors via envelope; success flat JSON |
| **SOLUTION-DESIGN §4.2** | Response shape, SVG sanitization, temp cleanup, no R2 |
| **SOLUTION-DESIGN §4.3** | Tier mapping trial→free, paid→pro |
| **SOLUTION-DESIGN §4.4** | Logo via `resolveLogoUseCase` — reuse Story 3.10 |
| **Story 1.7** | `renderPreview()`, `sanitizeTypstOutputSvg()` — **reuse verbatim** |
| **Story 3.9** | Validate HTTP mapping pattern — mirror for preview failures |
| **Story 3.10** | `resolveLogoUseCase`, `prepareIngestedLogoForTypst` |

### Scope boundary

| Capability | Owner | 3.11 delivers |
| --- | --- | --- |
| `renderPreview()` engine | **1.7** | Reuse |
| Logo SSRF pipeline | **3.10** | Compose |
| `POST /preview` HTTP | **3.11** | Full |
| PDF persist + render record | **3.12** | Do not implement |
| Quotation/receipt `.typ` files | **Epic 5** | Return 400 if missing |

### Evidence-based decisions

| Decision | Choice | Rationale |
| --- | --- | --- |
| Preview auth | `authenticated` + `renders:write` | Same as validate — pre-render write path |
| Idempotency | **None** on preview | Epics + Story 3.8 scope — render only |
| Template missing | **400** `INVALID_REQUEST` `/template` | Only `invoice/modern.typ` exists; Epic 5 adds others |
| HTML wrapper | Concat `<div class="page" data-page="n">` | §4.2 verbatim |
| Workspace tier source | DB `workspace_settings.tier` | §4.3 snapshot rule for render; preview reads live tier |
| Render deps injection | `previewUseCase` accepts `renderPreviewFromPayload` fn | Keeps `@usetagih/core` free of Typst/child_process |

### `previewUseCase` signature (encode exactly)

```typescript
export type PreviewUseCaseInput = {
  pathDocumentType: DocumentType;
  rawPayload: unknown;
  workspaceId: string;
  workspaceTier: WorkspaceTier;
  workspaceBranding?: MergedBranding | null;
};

export type PreviewUseCaseSuccess = {
  ok: true;
  pageCount: number;
  pages: Array<{ index: number; svg: string }>;
  html: string;
};

export type PreviewUseCaseFailure = {
  ok: false;
  code: ErrorCode;
  details: ApiErrorDetail[];
};

export type PreviewUseCaseDeps = {
  resolveLogo: typeof resolveLogoUseCase;
  resolveLogoDeps: ResolveLogoDeps;
  renderPreviewFromPayload: (input: {
    payload: DocumentPayload;
    workspaceTier: WorkspaceTier;
    logo: IngestedLogo | null;
  }) => Promise<{ pageCount: number; pages: Array<{ index: number; svg: string }>; html: string }>;
  templateExists: (documentType: DocumentType, template: string) => boolean;
};
```

Flow: validate → template exists check → resolve logo → map tier → render → success body fields.

### HTML builder (encode exactly)

```typescript
export function buildPreviewHtml(pages: Array<{ index: number; svg: string }>): string {
  return pages
    .slice()
    .sort((a, b) => a.index - b.index)
    .map((p) => `<div class="page" data-page="${p.index}">${p.svg}</div>`)
    .join("");
}
```

### Tier mapping (encode exactly)

```typescript
export function mapWorkspaceTierToTypstTier(tier: WorkspaceTier): "free" | "pro" {
  return tier === "trial" ? "free" : "pro";
}
```

### Template path resolver

**File:** `packages/render/src/template-path.ts`

```typescript
const REPO_TEMPLATES_ROOT = resolve(PACKAGE_ROOT, "../templates");

export function resolveDocumentTemplatePath(
  documentType: DocumentType,
  template: string,
): string {
  const path = join(REPO_TEMPLATES_ROOT, documentType, `${template}.typ`);
  if (!existsSync(path)) {
    throw new TemplateNotFoundError(documentType, template);
  }
  return path;
}
```

`PACKAGE_ROOT` in render package is `packages/render`; templates live at `packages/templates`.

### Current state — files to read before editing

| File | Current state | 3.11 changes |
| --- | --- | --- |
| `packages/render/src/preview.ts` | `renderPreview()` ready | **Reuse** — add payload wrapper |
| `packages/render/src/svg-output-sanitize.ts` | Output sanitizer | **No change** |
| `packages/core/src/use-cases/validate-use-case.ts` | Ready | **Call from preview** |
| `packages/core/src/use-cases/resolve-logo-use-case.ts` | Ready | **Compose** |
| `apps/api/src/routes/v1/validate-by-document-type.ts` | Pattern reference | Mirror for preview |
| `apps/api/src/lib/map-validate-result.ts` | HTTP mapper | Parallel `map-preview-result.ts` |
| `packages/schema/src/auth/scopes.ts` | Validate routes listed | Add preview routes |

### Testing requirements

| Suite | Coverage |
| --- | --- |
| `preview-use-case.test.ts` | Validate fail; template missing; logo fail; success mocked |
| `preview-from-payload.test.ts` | Pagination parity vs PDF count (typst-gated) |
| `preview-by-document-type.test.ts` | Auth, scope, 422, 400 mismatch, mocked success |
| `preview.integration.test.ts` | Postgres E2E invoice minimal (typst-gated) |

### Previous story intelligence

| Story | Learning for 3.11 |
| --- | --- |
| **1.7** | Never run `sanitizeSvgLogo` on Typst output; temp dir cleanup in `finally` |
| **3.9** | Thin routes + `map-*-result.ts` mappers; shared `document-type-paths.ts` |
| **3.10** | Logo pipeline in render package; use-case in core with injected deps |

### Git intelligence

Baseline `d879b85` (Story 3.10 done). Follow feat branch `feat/story-3-11-preview` → PR → merge pattern from Epic 3 stories.

### References

- [Source: _bmad-output/planning-artifacts/epics.md — Story 3.11]
- [Source: SOLUTION-DESIGN.md §4.2, §4.3, §4.4]
- [Source: packages/render/src/preview.ts]
- [Source: _bmad-output/implementation-artifacts/1-7-multi-page-svg-preview-with-pdf-page-count-parity-blocking.md]
- [Source: _bmad-output/implementation-artifacts/3-10-logo-ingestion-ssrf-hardened-pipeline.md]

## Dev Agent Record

### Agent Model Used

composer-2.5-fast

### Completion Notes List

- `previewUseCase` composes validate → template guard → logo resolve → `renderPreviewFromPayload`
- POST `/v1/{invoices|quotations|receipts}/preview` with `renders:write`; quotation/receipt return 400 when `.typ` missing (Epic 5)
- `docker compose postgres` + `bunx turbo run lint typecheck test build --force` → 36/36 exit 0

### File List

- packages/render/src/template-path.ts
- packages/render/src/template-path.test.ts
- packages/render/src/tier-map.ts
- packages/render/src/tier-map.test.ts
- packages/render/src/preview-html.ts
- packages/render/src/preview-html.test.ts
- packages/render/src/preview-from-payload.ts
- packages/render/src/preview-from-payload.test.ts
- packages/render/src/golden/render-fixture.ts
- packages/render/src/index.ts
- packages/core/src/use-cases/preview-use-case.ts
- packages/core/src/use-cases/preview-use-case.test.ts
- packages/core/src/use-cases/index.ts
- packages/core/src/index.ts
- packages/db/src/repositories/workspace-settings-repo.ts
- packages/db/src/index.ts
- apps/api/src/lib/map-preview-result.ts
- apps/api/src/lib/map-preview-result.test.ts
- apps/api/src/lib/preview-deps.ts
- apps/api/src/routes/v1/preview-by-document-type.ts
- apps/api/src/routes/v1/preview-by-document-type.test.ts
- apps/api/src/integration/preview.integration.test.ts
- apps/api/src/routes/v1/session.token.test.ts
- apps/api/src/app.ts
- apps/api/package.json
- packages/schema/src/auth/scopes.ts
- bun.lock
- _bmad-output/implementation-artifacts/3-11-post-v1-documenttype-preview-multi-page-svg-response.md
- _bmad-output/implementation-artifacts/sprint-status.yaml

## Change Log

- 2026-07-20: story 3.11 created — ready for dev
- 2026-07-20: story 3.11 implementation — preview endpoint (status → review)

## Story Validation Record

**Validated:** 2026-07-20 (create-story)

| Check | Result |
| --- | --- |
| Epics Story 3.11 AC coverage | PASS |
| SOLUTION-DESIGN §4.2 response shape | PASS |
| Story 1.7 renderPreview reuse | PASS |
| Story 3.10 logo pipeline compose | PASS |
| No render record / R2 side effects | PASS |
| Template availability guard for Epic 5 gap | PASS |
| Verification commands with turbo `--force` | PASS |

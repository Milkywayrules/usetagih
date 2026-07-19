---
baseline_commit: 63a0902
---

# Story 1.7: Multi-page SVG preview with PDF page-count parity (blocking)

Status: review

<!-- Ultimate context engine analysis completed - comprehensive developer guide created -->

## Story

As a frontend engineer,
I want Typst `--format svg` preview producing one SVG per page matching PDF page count,
so that FR-10 preview uses same engine without HTML fallback (AD-10 blocking #4, FR-10).

## Acceptance Criteria

1. **Given** Story 1.6 complete (manifest-driven golden harness, logo prep, `sanitizeSvgLogo` allowlist), **when** `renderPreview()` in `packages/render/src/preview.ts` compiles the same `.typ` + inputs as PDF via `compileTypst({ format: "svg" })` with output template `page-{0p}.svg` under a temp dir, **then** it returns `{ pageCount, pages: [{ index, svg }] }` per SOLUTION-DESIGN §4.2 (spike subset — no `valid`/`html`; those are Story 3.10 API fields).
2. **Given** pagination fixture `invoice-modern-pagination-25` from Story 1.5, **when** `renderPreview()` runs with `tier=free`, **then** `pageCount === 3` and `pages.length === 3`, indices sorted ascending `[1, 2, 3]`, and `pageCount` equals PDF page count from `evalTypst()` + `query(<page-count>)` on the same template + inputs.
3. **Given** basic fixture `invoice-modern-basic`, **when** `renderPreview()` runs, **then** `pageCount === 1`, single page `index === 1`, filename emitted as `page-1.svg` (Typst `{0p}` with one total page — no leading-zero padding required).
4. **Given** each Typst-emitted SVG string before return, **when** `sanitizeTypstOutputSvg()` runs (output-sanitizer profile — **not** `sanitizeSvgLogo`), **then** `<script>`, event handlers (`on*=` attrs), external `href`/`xlink:href`, and `<foreignObject>` are stripped; structural Typst elements (`<use>`, `<symbol>`, `<defs>`, `<g>`, `<path>`, `<text>`, etc.) are **preserved**; bun test rejects dirty SVG that still contains active content after sanitization.
5. **Given** any `renderPreview()` invocation, **when** compile succeeds or fails, **then** temp SVG directory under `packages/render/.tmp/preview-{random}/` is removed in a `finally` block (no orphaned dirs after test suite).
6. **Given** committed PDF goldens from Stories 1.2–1.6, **when** this story merges, **then** `golden:check` SHA-256 values remain unchanged — basic `b11be4533d38f525326164b530a143bd71270440dc4b98f42cec426f2d3a105c`, pagination `d19dd496ed850cea10f8f50146812c4541fc811f075553222b432e6e691cc584`, logo fixtures unchanged; **no** `.sha256` or manifest hash regeneration for PDF fixtures.
7. **Given** workspace, **when** `bunx turbo run lint typecheck test build --force` runs from repo root, **then** all tasks exit 0; preview parity + output-sanitizer tests run under `@usetagih/render` test task (environment-gated when Typst absent — same pattern as `invoice-modern.test.ts`).
8. **Given** local Docker available, **when** in-container `golden:check` runs after implementation, **then** all five manifest fixtures still pass (preview work must not break PDF determinism gate).
9. **Given** preview parity or sanitizer test failure in CI, **when** `pdf-golden.yml` / turbo test runs, **then** non-zero exit triggers spike exit condition (AD-10 blocking #4).
10. **Out of scope (Stories 1.8–1.9, Epic 3.10):** `POST /v1/{documentType}/preview` HTTP endpoint, `html` wrapper field, R2 persist, render records, `golden:soak --iterations 100`, `SPIKE-RESULT.md`, applying `sanitizeSvgLogo` allowlist to Typst output (would strip `<use>` and corrupt pages).

## Tasks / Subtasks

- [x] Task 1 — Preview module (AC: 1, 2, 3, 5)
  - [x] Create `packages/render/src/preview.ts` with `renderPreview()` per Dev Notes §API contract
  - [x] Wire same input args as `renderFixtureFromManifest()` — `json=`, `tier=`, optional `logo=` via `prepareLogoForTypst()`
  - [x] Use Typst output path `{previewTempDir}/page-{0p}.svg`; glob + parse indices; sort ascending
  - [x] `finally`: `rmSync(previewTempDir, { recursive: true, force: true })`
- [x] Task 2 — Output SVG sanitizer profile (AC: 4)
  - [x] Add `sanitizeTypstOutputSvg()` in `packages/render/src/svg-output-sanitize.ts` (or co-locate in `svg-sanitize.ts` with clear section header — **separate export**, do not modify `sanitizeSvgLogo` behavior)
  - [x] Create `packages/render/src/svg-output-sanitize.test.ts` with malicious inline fixtures + clean Typst-output snippet containing `<use>`/`<symbol>`
- [x] Task 3 — Parity + cleanup tests (AC: 2, 3, 5, 6)
  - [x] Create `packages/render/src/preview.test.ts` (or extend `invoice-modern.test.ts`) — environment-gated via `typstAvailable`
  - [x] Assert pagination `pageCount === 3`, basic `pageCount === 1`, indices sorted, SVG page count === `getPdfPageCount()` helper
  - [x] Assert temp preview dir absent after `renderPreview()` returns
  - [x] Reuse stability constants `STABLE_BASIC` / `STABLE_PAGINATION` — run existing golden-stability tests unchanged
- [x] Task 4 — Export surface (AC: 1)
  - [x] Export `renderPreview`, types from `packages/render/src/index.ts` (or `./preview` subpath if index stays minimal)
- [x] Task 5 — Verification gate (AC: 7, 8)
  - [x] `bunx turbo run lint typecheck test build --force`
  - [x] In-container: `docker run --rm -e SOURCE_DATE_EPOCH=1700000000 usetagih-render-ci:local bun run --filter @usetagih/render golden:check`
  - [x] Record page counts, sanitizer profile decision, temp-dir cleanup proof in Dev Agent Record

## Dev Notes

### Goal

Deliver **AD-10 blocking #4** — multi-page SVG preview compiled from the **same** Typst template + JSON inputs as PDF, with page-count parity against PDF metadata probes, defense-in-depth output sanitization, temp-dir cleanup, and CI failure = spike exit. Seventh story of Epic 1. Unblocks Story 3.10 (preview HTTP endpoint wraps this module) and completes FR-10 engine proof for the spike.

### Epic 1 context (cross-story sequencing)

| Story | Delivers | Depends on 1.7 |
| --- | --- | --- |
| 1.7 | **this story** — SVG preview module + parity tests | 1.5 pagination fixture, 1.6 sanitizer primitive |
| 1.8 | CI soak `--iterations 100` | harness stable |
| 1.9 | SPIKE-RESULT.md | all spike ACs including preview |
| 3.10 | `POST /v1/{documentType}/preview` API | **`renderPreview()` contract** |

### Environment facts (do not guess)

| Fact | Value |
| --- | --- |
| Baseline commit (Story 1.6 done) | `63a0902` |
| Typst version | `0.15.1` per `typst-version.txt` and manifest |
| Basic fixture PDF page count | **1** (`query(<page-count>)` → `[1]`) |
| Pagination fixture PDF page count | **3** (`query(<page-count>)` → `[3]`) |
| Basic golden hash (**must preserve**) | `b11be4533d38f525326164b530a143bd71270440dc4b98f42cec426f2d3a105c` |
| Pagination golden hash (**must preserve**) | `d19dd496ed850cea10f8f50146812c4541fc811f075553222b432e6e691cc584` |
| CI Docker image tag (local) | `usetagih-render-ci:local` |
| CI Docker command | `docker run --rm -e SOURCE_DATE_EPOCH=1700000000 usetagih-render-ci:local bun run --filter @usetagih/render golden:check` |
| Turbo verification | `bunx turbo run lint typecheck test build --force` |
| Spike exit condition | Any preview parity / sanitizer / `golden:check` failure in CI halts Epics 2–8 (AD-10) |

### Typst multi-page SVG output path (verified Typst 0.15.1)

**Exact placeholder syntax** (Typst docs + `typst compile --help`):

| Placeholder | Meaning |
| --- | --- |
| `{p}` | 1-indexed page number, unpadded (`1`, `2`, `10`) |
| `{0p}` | 1-indexed, zero-padded to **total page count width** (`1` for 1-page doc; `1`,`2`,`3` for 3-page doc; `01`…`15` for 15-page doc) |
| `{t}` | Total page count embedded in filename (optional) |
| `{n}` | Alias of `{0p}` in Typst CLI source |

**Chosen output pattern for this story:** `{previewTempDir}/page-{0p}.svg`

- Matches SOLUTION-DESIGN §4.2 intent (`page-{n}.svg`, 1-indexed, zero-padded to page-count width).
- Verified locally: pagination fixture emits `page-1.svg`, `page-2.svg`, `page-3.svg`; basic emits `page-1.svg` only.
- **Compile invocation** (extend existing `compileTypst` — already supports `format: "svg"`):

```typescript
compileTypst({
  inputPath: templateAbs,
  outputPath: join(previewTempDir, "page-{0p}.svg"),
  format: "svg",
  extraArgs: [/* same --input json= tier= logo= as PDF */],
});
```

- **Do not** use `{p}` alone when filenames must sort lexicographically across ≥10 pages — `{0p}` is correct per §4.2.
- **Do not** hardcode zero-padding in TypeScript — Typst `{0p}` handles width from total pages.

**Typst-emitted SVG structure (observed on pagination page-1):** heavy `<use>` (860), `<path>`, `<symbol>`/`<defs>`, `<g>`, root `<svg>`. No `<text>` on page 1 sample but other pages may include text nodes — output sanitizer must not strip these.

### Sanitizer profile decision — logo allowlist vs Typst output strip-list

| Profile | Function | Input trust | `<use>` / `<symbol>` | `<style>` | Purpose |
| --- | --- | --- | --- | --- | --- |
| **Logo allowlist** | `sanitizeSvgLogo()` | Untrusted user upload | **STRIPPED** (blocked element) | **STRIPPED** | Persisted logo bytes before Typst write (Story 1.6) |
| **Typst output strip-list** | `sanitizeTypstOutputSvg()` | Trusted engine output; defense-in-depth per §4.2 | **PRESERVED** | **PRESERVED** (strip `@import`/`url(`/`javascript:` in `style=` attrs only) | Preview/API SVG response |

**Rationale:** Reusing `sanitizeSvgLogo()` on Typst output would remove `<use>`/`<symbol>` and **corrupt** rendered pages (glyphs are referenced via `<use href="#…">`). §4.2 mandates stripping **active content** only: `<script>`, event handlers, external refs, `foreignObject`.

**Output sanitizer spec** (`sanitizeTypstOutputSvg(input: string): SvgSanitizeResult` — reuse result type from `svg-sanitize.ts`):

1. UTF-8 parse input string.
2. **Strip** (regex, case-insensitive, dotall where needed): `<script…>…</script>`, self-closing `<script…/>`, `<foreignObject>…</foreignObject>`.
3. **Strip** event-handler attributes: `\s(on[a-zA-Z]+)\s*=\s*("…"|'…'|[^\s>]+)` globally.
4. **Strip** external refs: `href` / `xlink:href` where value matches `^(?:https?:)?//`, `^https?://`, or dangerous schemes (`javascript:`, `data:`, `vbscript:`) — **preserve** internal fragment refs (`href="#glyph-1"`).
5. **Strip** dangerous inline `style=` values containing `@import`, `url(`, `javascript:`, `expression(`.
6. **Reject** (`{ ok: false }`) if any remain after strip:
   - `<script` (case-insensitive)
   - `\son[a-zA-Z]+\s*=`
   - `<foreignObject`
   - external/dangerous `href=` / `xlink:href=`
7. On success: return `{ ok: true, sanitized: Buffer, sha256 }` — same shape as logo sanitizer for test ergonomics.

**Do not** apply element allowlist to output — Typst may emit `<clipPath>`, `<mask>`, `<linearGradient>`, `<text>`, `<tspan>`, `<image>` (embedded), etc.

**Unit test matrix** (`svg-output-sanitize.test.ts`):

| Case | Input | Expected |
| --- | --- | --- |
| typst-clean | Snippet with `<use href="#x"/>`, `<symbol>`, `<path>` | `ok: true`; `<use>` preserved |
| injected-script | Typst snippet + `<script>alert(1)</script>` | stripped → `ok: true` if clean |
| script-persist | `<script src="https://evil/x"/>` survives strip | `ok: false` |
| onload | `<svg onload="alert(1)">` | handler stripped → `ok: true` |
| foreignObject | `<foreignObject>…</foreignObject>` | stripped; reject if remains |
| external-href | `<image xlink:href="https://evil.com/x.png"/>` | external ref stripped or reject |
| internal-href | `<use href="#glyph-0"/>` | **preserved**, `ok: true` |

### Preview module API (`packages/render/src/preview.ts`)

```typescript
export type PreviewPage = { index: number; svg: string };
export type PreviewResult = { pageCount: number; pages: PreviewPage[] };

export type RenderPreviewOptions = {
  /** Absolute path to `.typ` template */
  templatePath: string;
  /** Absolute path to payload JSON */
  payloadPath: string;
  tier?: string; // default "free"
};

/** Compile same template+inputs as PDF; return sanitized multi-page SVG preview. */
export function renderPreview(options: RenderPreviewOptions): PreviewResult;
```

**Implementation flow:**

1. `previewTempDir = join(PACKAGE_ROOT, ".tmp", \`preview-${randomUUID()}\`)` — use `randomUUID()` from `node:crypto`.
2. Build `extraArgs` identical to `renderFixtureFromManifest()`:
   - `--input`, `json=${relative(templateDir, payloadPath)}`
   - `--input`, `tier=${tier}`
   - optional logo via `prepareLogoForTypst(payloadPath, templateDir)` → `--input logo=…`
3. `try { compileTypst({ format: "svg", outputPath: join(previewTempDir, "page-{0p}.svg"), … }) } finally { rmSync(previewTempDir, { recursive: true, force: true }) }`
4. `pdfPageCount = getPdfPageCount(templatePath, extraArgs)` — helper using `evalTypst({ expression: 'query(<page-count>)', … })`; parse JSON array `[{ value: [N] }]` → `N`.
5. Glob `page-*.svg` in temp dir **before** finally deletes — read file contents into memory first, then cleanup in finally.
6. Parse index from filename: `/page-(\d+)\.svg$/` → integer `index`.
7. Sort pages by `index` ascending.
8. For each file: `sanitizeTypstOutputSvg(raw)` — throw or reject if `!ok`.
9. Assert `pages.length === pdfPageCount`; if mismatch throw descriptive error (parity failure).
10. Return `{ pageCount: pdfPageCount, pages: [{ index, svg: sanitized.toString('utf8') }] }`.

**Convenience wrapper** for tests (mirror manifest pattern):

```typescript
export function renderPreviewFromManifest(
  entry: GoldenFixtureEntry,
  tier = "free",
): PreviewResult;
```

### PDF page count helper (parity source of truth)

**Chosen mechanism:** Same as Story 1.5 — `evalTypst()` + `#metadata(counter(page).final()) <page-count>` label already in `modern.typ`. **Do not** count PDF `/Type /Page` objects or SVG file count alone — PDF metadata is authoritative; SVG count must match.

```typescript
function getPdfPageCount(
  templatePath: string,
  extraArgs: string[],
): number {
  const raw = evalTypst({
    inputPath: templatePath,
    expression: "query(<page-count>)",
    extraArgs,
  });
  const hits = JSON.parse(raw) as Array<{ value: number[] }>;
  const n = hits[0]?.value?.[0];
  if (n === undefined || !Number.isFinite(n)) {
    throw new Error(`failed to read <page-count> metadata: ${raw}`);
  }
  return Number(n);
}
```

**Expected parity values (authoritative — verified at story creation):**

| Fixture id | PDF `<page-count>` | SVG files emitted | `renderPreview().pageCount` |
| --- | --- | --- | --- |
| `invoice-modern-basic` | 1 | 1 (`page-1.svg`) | 1 |
| `invoice-modern-pagination-25` | 3 | 3 (`page-1.svg` … `page-3.svg`) | 3 |

### Response shape (spike vs API)

SOLUTION-DESIGN §4.2 full API response includes `valid`, `html`. **This story implements spike/harness subset only:**

```json
{
  "pageCount": 3,
  "pages": [
    { "index": 1, "svg": "<svg …>…</svg>" },
    { "index": 2, "svg": "<svg …>…</svg>" },
    { "index": 3, "svg": "<svg …>…</svg>" }
  ]
}
```

Story 3.10 wraps this with validation envelope + `html` div wrappers.

### Golden / PDF stability plan (mandatory)

| Rule | Action |
| --- | --- |
| Preview compiles SVG only — no PDF re-render for golden update | **Do not** run `golden:update` for this story |
| Existing PDF `.sha256` files | **Untouched** |
| `golden:check` | Must still pass all 5 fixtures in CI Docker |
| Stability tests from Story 1.6 | Must remain green (`STABLE_BASIC`, `STABLE_PAGINATION`) |
| If PDF hashes drift | **Stop** — preview module must not alter PDF compile path; fix regression before merge |

Preview tests are **bun test only** — no SVG golden hashes committed in Epic 1 spike (byte drift risk from sanitizer edits is acceptable for preview; PDF goldens remain authoritative for FR-7).

### Current repo state (Stories 1.1–1.6 — build on this)

| Item | State | This story changes |
| --- | --- | --- |
| `packages/render/src/typst-driver.ts` | `compileTypst` supports `format: "svg"` | **reuse** — no API change required |
| `packages/render/src/golden/render-fixture.ts` | PDF render + logo prep | **reuse** input-arg building — extract shared helper if DRY threshold met (2 consumers: render + preview) |
| `packages/render/src/svg-sanitize.ts` | `sanitizeSvgLogo()` allowlist | **add separate** `sanitizeTypstOutputSvg` export or sibling file — **do not** weaken logo allowlist |
| `packages/render/src/preview.ts` | absent | **NEW** |
| `packages/render/src/invoice-modern.test.ts` | pagination metadata tests | **extend** or add `preview.test.ts` |
| `packages/templates/invoice/modern.typ` | `<page-count>` metadata present | **no template change** unless probe missing (it exists from Story 1.5) |
| `manifest.json` / PDF goldens | 5 fixtures | **no changes** |
| `pdf-golden.yml` | runs `golden:check` | **no workflow change** — preview covered by turbo `test` |

### Architecture compliance

- **FR-10:** Preview uses same Typst engine + template as PDF — no HTML/Chromium fallback.
- **AD-10 blocking #4:** Multi-page SVG preview with page-count parity; CI test failure = spike exit.
- **SOLUTION-DESIGN §4.2:** Output naming `{0p}`, ascending order, response shape, sanitization, temp cleanup, no persist.
- **FR-7 / AD-3:** PDF goldens unchanged — preview is additive.
- **Story 1.6 lesson:** Two sanitizer profiles — logo allowlist vs output strip-list; never conflate.

### Anti-patterns (do not do)

- Do **not** call `sanitizeSvgLogo()` on Typst output — strips `<use>` and corrupts pages.
- Do **not** regenerate PDF golden hashes for this story.
- Do **not** commit `.tmp/preview-*` or SVG artifacts — temp only.
- Do **not** implement HTTP preview endpoint — Story 3.10.
- Do **not** add `html` field or DOM wrapper — Story 3.10.
- Do **not** use `{p}` placeholder when lexicographic sort across pages matters for ≥10 pages — use `{0p}`.
- Do **not** skip `finally` cleanup — AC mandates it.
- Do **not** add `golden:soak` — Story 1.8.
- Do **not** count pages by reading PDF bytes — use `<page-count>` metadata probe.

### Previous story intelligence

**Story 1.5:**

- Pagination fixture renders **3 pages** (not merely ≥2 — parity tests must assert exact `3`).
- `query(<page-count>)` and `query(<totals-page>)` via `evalTypst()` — reuse for PDF side of parity.
- `<page-count>` metadata does not alter PDF bytes — safe to rely on for parity without golden drift.

**Story 1.6:**

- `sanitizeSvgLogo()` hardened to **element allowlist** — blocks `<use>`, `<image>`, `<style>`.
- `prepareLogoForTypst()` wired into manifest render — preview must use same logo args for logo fixtures (optional parity test for logo-svg fixture in follow-up; **minimum** AC requires pagination + basic).
- Golden stability gate for basic/pagination — must remain green.

**Story 1.3–1.4:**

- `golden:check` triple-checks manifest — preview work must not break it.

### Project Structure Notes

```
packages/render/
├── src/
│   ├── preview.ts                    # NEW — renderPreview()
│   ├── preview.test.ts               # NEW — parity + cleanup (or extend invoice-modern.test.ts)
│   ├── svg-output-sanitize.ts        # NEW — sanitizeTypstOutputSvg() (or section in svg-sanitize.ts)
│   ├── svg-output-sanitize.test.ts   # NEW
│   ├── typst-driver.ts               # reuse compileTypst format svg
│   ├── svg-sanitize.ts               # unchanged logo allowlist
│   ├── golden/render-fixture.ts      # optional: extract buildTypstInputArgs() shared helper
│   └── index.ts                      # export preview types + renderPreview
```

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story-1.7]
- [Source: _bmad-output/planning-artifacts/architecture/architecture-usetagih-2026-07-20/SOLUTION-DESIGN.md#§4.2]
- [Source: _bmad-output/planning-artifacts/architecture/architecture-usetagih-2026-07-20/SOLUTION-DESIGN.md#§2.2-spike-AC-4]
- [Source: _bmad-output/implementation-artifacts/1-5-25-line-item-pagination-fixture-fr-8-blocking.md]
- [Source: _bmad-output/implementation-artifacts/1-6-logo-determinism-fixture-png-jpeg-svg-blocking.md]
- [Source: packages/render/src/typst-driver.ts]
- [Source: packages/render/src/svg-sanitize.ts — sanitizeSvgLogo allowlist]
- [Source: packages/render/src/golden/render-fixture.ts]
- [Source: https://typst.app/docs/reference/svg/ — multi-page `{p}`, `{0p}`, `{t}` templates]
- [Source: Typst 0.15.1 CLI — `typst compile --help` page template section]

## Dev Agent Record

### Agent Model Used

Composer 2.5

### Debug Log References

- parity: basic fixture PDF `<page-count>` = 1, SVG `page-1.svg`; pagination PDF = 3, SVG `page-1.svg` … `page-3.svg`
- sanitizer: separate strip-list profile in `svg-output-sanitize.ts` — preserves `<use>`/`<symbol>`/`<path>`, strips active content
- cleanup: `ls packages/render/.tmp/preview-*` → no matches after test suite

### Completion Notes List

- implemented `renderPreview()` / `renderPreviewFromManifest()` compiling Typst `--format svg` to `page-{0p}.svg` with PDF `<page-count>` parity via `evalTypst(query(<page-count>))`
- extracted shared `buildTypstInputArgs()` from golden render harness for PDF/preview input parity
- added `sanitizeTypstOutputSvg()` defense-in-depth strip-list distinct from logo allowlist
- verification: `bun test packages/render` 124 pass; `golden:check` all 5 fixtures; turbo `--force` 36/36; docker `golden:check` exit 0

### File List

- `packages/render/src/preview.ts` (new)
- `packages/render/src/preview.test.ts` (new)
- `packages/render/src/svg-output-sanitize.ts` (new)
- `packages/render/src/svg-output-sanitize.test.ts` (new)
- `packages/render/src/index.ts` (modified — export preview + sanitizer)
- `packages/render/src/golden/render-fixture.ts` (modified — shared `buildTypstInputArgs`)
- `_bmad-output/implementation-artifacts/1-7-multi-page-svg-preview-with-pdf-page-count-parity-blocking.md` (modified)
- `_bmad-output/implementation-artifacts/sprint-status.yaml` (modified)

## Change Log

- 2026-07-20: multi-page SVG preview module with PDF page-count parity, output sanitizer, and CI verification gates (AD-10 blocking #4)

## Story Validation Record

- **Validated:** 2026-07-20 against `bmad-create-story/checklist.md`
- **Result:** PASS
- **Checks applied:** Epics AC coverage (SVG compile `{0p}`, page-count parity, ascending order, §4.2 response subset, output sanitization distinct from logo allowlist, temp `finally` cleanup, CI/spike exit); verified page counts basic=1 pagination=3 via live `evalTypst`; Typst output structure observation (`<use>`/`<symbol>` must be preserved); exact placeholder syntax `{0p}` for Typst 0.15.1; `renderPreview()` path + API contract; PDF page count via `<page-count>` metadata; golden stability plan (no PDF hash changes); reuse Story 1.5–1.6 harness patterns; anti-patterns and out-of-scope boundaries (API endpoint Story 3.10, soak Story 1.8); turbo `--force` verification gate

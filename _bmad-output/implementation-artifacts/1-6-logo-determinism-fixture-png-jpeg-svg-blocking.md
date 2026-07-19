---
baseline_commit: 23a1e75
---

# Story 1.6: Logo determinism fixture — PNG, JPEG, SVG (blocking)

Status: review

<!-- Ultimate context engine analysis completed - comprehensive developer guide created -->

## Story

As a security engineer,
I want logo rendering from persisted immutable bytes with checksum for PNG/JPEG/SVG,
so that logo fetch does not break determinism (AD-7, AD-10 blocking #3, FR-7).

## Acceptance Criteria

1. **Given** Story 1.5 complete (manifest-driven golden harness, CI Docker, pagination fixture), **when** three new fixtures `invoice-modern-logo-png.json`, `invoice-modern-logo-jpeg.json`, `invoice-modern-logo-svg.json` are read, **then** each conforms to PRD §10.1 `InvoicePayload` (same seller/buyer/line-items/totals as `invoice-modern-basic.json`) **plus** spike persisted-logo extension `branding.logoBytes` per Dev Notes §Fixture branding shape — no `logoUrl`, no network fetch in CI.
2. **Given** each logo fixture payload, **when** `prepareLogoForTypst()` runs in the render driver, **then** base64 decodes to bytes, SVG bytes pass through `sanitizeSvgLogo()` before write, bytes persist to deterministic path `.tmp/logos/{logoSha256}.{ext}` under `packages/render/`, and `--input logo=<path-relative-to-template-dir>` is appended to Typst compile args; PNG/JPEG skip sanitizer.
3. **Given** `packages/templates/invoice/modern.typ`, **when** `--input logo=` is absent (basic + pagination fixtures), **then** PDF output is **byte-identical** to committed goldens — basic `b11be4533d38f525326164b530a143bd71270440dc4b98f42cec426f2d3a105c`, pagination `d19dd496ed850cea10f8f50146812c4541fc811f075553222b432e6e691cc584` (mandatory stability gate).
4. **Given** each logo fixture, **when** rendered twice consecutively in CI Docker with identical inputs and `SOURCE_DATE_EPOCH=1700000000`, **then** both PDF SHA-256 hashes match each other **and** match committed golden `.sha256` for that fixture id (double-render determinism per format).
5. **Given** `golden:check` in CI Docker, **when** all manifest fixtures run, **then** seven fixtures pass (basic, pagination-25, logo-png, logo-jpeg, logo-svg); failure fails CI and triggers spike exit condition (AD-10).
6. **Given** `packages/render/src/render-record.ts`, **when** read, **then** stub documents future Drizzle `renders.logo_checksum` field and exports `computeLogoChecksum(bytes: Buffer): string` returning lowercase hex SHA-256 of **persisted bytes written to disk** (post-sanitization for SVG).
7. **Given** `packages/render/src/svg-sanitize.ts`, **when** unit tests run, **then** clean SVG passes; malicious fixtures with `<script>`, `onload=` event handlers, `<foreignObject>`, or external `xlink:href="https://…"` are stripped or rejected per Dev Notes §SVG sanitizer spec and SOLUTION-DESIGN §4.4.
8. **Given** workspace, **when** `bunx turbo run lint typecheck test build --force` runs from repo root, **then** all tasks exit 0.
9. **Out of scope (Stories 1.7–1.9, Epic 3.9):** HTTPS `logoUrl` fetch, SSRF pipeline, multi-page SVG preview parity, `golden:soak --iterations 100`, Zod schema package, API render endpoint, `based` Typst package for in-template base64 decode.

## Tasks / Subtasks

- [x] Task 1 — Persisted-logo fixture JSON (AC: 1)
  - [x] Create `packages/render/__fixtures__/payloads/invoice-modern-logo-png.json` (copy basic + `branding.logoBytes` PNG bytes per Dev Notes)
  - [x] Create `packages/render/__fixtures__/payloads/invoice-modern-logo-jpeg.json` (JPEG bytes)
  - [x] Create `packages/render/__fixtures__/payloads/invoice-modern-logo-svg.json` (clean SVG bytes)
  - [x] Distinct `documentNumber` per fixture: `INV-2026-LOGO-PNG`, `INV-2026-LOGO-JPEG`, `INV-2026-LOGO-SVG`
- [x] Task 2 — Logo prep + render-record stub (AC: 2, 6)
  - [x] Create `packages/render/src/render-record.ts` with `computeLogoChecksum()` + JSDoc for `renders.logo_checksum`
  - [x] Create `packages/render/src/logo-prep.ts` with `prepareLogoForTypst(payloadPath, templateDir)` → `{ logoInputArg?: string; logoChecksum?: string }`
  - [x] Extend `packages/render/src/golden/render-fixture.ts` to call `prepareLogoForTypst()` before `compileTypst()`
  - [x] Extend `packages/render/scripts/render-fixture.ts` (if present) to use same prep path
- [x] Task 3 — SVG sanitizer (AC: 7)
  - [x] Create `packages/render/src/svg-sanitize.ts` per Dev Notes §SVG sanitizer spec
  - [x] Create `packages/render/src/svg-sanitize.test.ts` with clean + malicious inline fixtures
- [x] Task 4 — Template conditional logo block (AC: 3, 4)
  - [x] Add `#let logo-path = sys.inputs.at("logo", default: none)` to `modern.typ`
  - [x] Add conditional logo `image(logo-path, …)` in header — **only when** `logo-path != none`
  - [x] Run `golden:check` on **basic + pagination** immediately after template edit — hashes must remain unchanged (AC: 3)
- [x] Task 5 — Manifest + golden hashes (AC: 4, 5)
  - [x] Append three manifest entries for logo fixtures
  - [x] Render each logo fixture inside CI Docker; run `golden:update`; commit three `.sha256` files
  - [x] Do **not** regenerate basic/pagination goldens unless AC: 3 stability gate fails (then justify + PR label `golden-update`)
- [x] Task 6 — Determinism + stability tests (AC: 3, 4, 5)
  - [x] Extend `packages/render/src/invoice-modern.test.ts` or add `logo-determinism.test.ts`: double-render identity per logo fixture; golden-stability assertions for basic + pagination hashes
  - [x] Extend `packages/render/src/golden/manifest.test.ts` for three new entries
  - [x] In-container `golden:check` exit 0 for all fixtures
- [x] Task 7 — Verification gate (AC: 8)
  - [x] `bunx turbo run lint typecheck test build --force`
  - [x] Record logo byte checksums, golden hashes, stability proof in Dev Agent Record

## Dev Notes

### Goal

Deliver **AD-10 blocking #3** — deterministic logo rendering from **already-persisted bytes** (base64 in JSON fixtures, no network) for PNG, JPEG, and SVG; SVG sanitization primitive; `logo_checksum` render-record stub. Sixth story of Epic 1. Unblocks Story 1.7 (SVG preview reuses sanitizer) and de-risks Epic 3.9 (SSRF fetch is separate — this story does **not** implement fetch).

### Epic 1 context (cross-story sequencing)

| Story | Delivers | Depends on 1.6 |
| --- | --- | --- |
| 1.6 | **this story** — logo fixtures + sanitizer + template logo block | 1.5 harness |
| 1.7 | Multi-page SVG preview parity | **sanitizer primitive** |
| 1.8 | CI soak `--iterations 100` | logo + pagination goldens |
| 1.9 | SPIKE-RESULT.md | all above |
| 3.9 | Logo ingestion SSRF-hardened pipeline | sanitizer + checksum stub |

### Environment facts (do not guess)

| Fact | Value |
| --- | --- |
| Baseline commit (Story 1.5 done) | `23a1e75` |
| Typst version | `0.15.1` per `typst-version.txt` and manifest |
| Basic golden hash (**must preserve**) | `b11be4533d38f525326164b530a143bd71270440dc4b98f42cec426f2d3a105c` |
| Pagination golden hash (**must preserve**) | `d19dd496ed850cea10f8f50146812c4541fc811f075553222b432e6e691cc584` |
| CI Docker image tag (local) | `usetagih-render-ci:local` |
| CI Docker command | `docker run --rm -e SOURCE_DATE_EPOCH=1700000000 usetagih-render-ci:local bun run --filter @usetagih/render golden:check` |
| Turbo verification | `bunx turbo run lint typecheck test build --force` |
| Spike exit condition | Any `golden:check` or determinism test failure in CI Docker halts Epics 2–8 (AD-10) |

### PRD §10.1 branding vs spike fixture shape

**Production contract (PRD §10.1):** `branding?: { logoUrl?: string; accentColor?: string }` — `logoUrl` is HTTPS-only; bytes fetched once at render time; checksum on Render Record.

**Spike fixture extension (this story only — Epic 2 Zod will formalize persisted bytes):**

```typescript
interface PersistedLogoBytes {
  contentType: "image/png" | "image/jpeg" | "image/svg+xml";
  bytesBase64: string; // standard base64, no data: URI prefix, no whitespace/newlines
}

// Fixture path: branding.logoBytes (sibling to optional logoUrl/accentColor)
branding?: {
  logoBytes?: PersistedLogoBytes;
  accentColor?: string; // optional; omit in spike fixtures
};
```

Fixtures **must not** use `logoUrl` — CI has no network. `logoBytes` simulates bytes already persisted on the render record (SOLUTION-DESIGN §4.4: "Fixtures in CI use embedded base64 logos").

### Base64 → Typst mechanism (ONE approach — do not mix alternatives)

**Chosen mechanism:** TypeScript driver decodes `branding.logoBytes.bytesBase64`, sanitizes SVG, writes bytes to deterministic file under compile root, passes path via `--input logo=<relative-path>`; template uses `#image(logo-path, …)` when input present.

**Why not in-template base64 decode:**

- Typst **0.15.0** removed scoped `image.decode`; changelog: "directly pass bytes to the top-level functions instead" ([Typst 0.15.0 changelog](https://typst.app/docs/changelog/0.15.0/)).
- Native `bytes.from-base64(str)` **does not exist** in Typst 0.15 stdlib ([typst/typst#6126](https://github.com/typst/typst/issues/6126) still open).
- Community `@preview/based` package would add Typst universe dependency and couple templates to base64 decoding — **reject** for spike (YAGNI; driver already owns payload JSON).

**Why driver temp file (not `--input` raw bytes):** `sys.inputs` values are strings; passing multi-kB base64 through CLI is fragile. SOLUTION-DESIGN §4.4: "Typst reads local path only."

**Implementation sketch** (`packages/render/src/logo-prep.ts`):

```typescript
import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { sanitizeSvgLogo } from "./svg-sanitize";
import { computeLogoChecksum } from "./render-record";

const CONTENT_EXT: Record<PersistedLogoBytes["contentType"], string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/svg+xml": "svg",
};

export function prepareLogoForTypst(
  payloadAbsPath: string,
  templateDir: string,
): { logoInputArg?: string; logoChecksum?: string } {
  const payload = JSON.parse(readFileSync(payloadAbsPath, "utf8"));
  const logoBytes = payload?.branding?.logoBytes;
  if (!logoBytes?.bytesBase64 || !logoBytes?.contentType) return {};

  let bytes = Buffer.from(logoBytes.bytesBase64, "base64");
  if (logoBytes.contentType === "image/svg+xml") {
    const result = sanitizeSvgLogo(bytes);
    if (!result.ok) throw new Error(`SVG logo rejected: ${result.errors.join("; ")}`);
    bytes = result.sanitized;
  }

  const checksum = computeLogoChecksum(bytes);
  const ext = CONTENT_EXT[logoBytes.contentType as PersistedLogoBytes["contentType"]];
  const logosDir = join(dirname(payloadAbsPath), "../../.tmp/logos"); // resolve to packages/render/.tmp/logos
  mkdirSync(logosDir, { recursive: true });
  const logoAbs = join(logosDir, `${checksum}.${ext}`);
  writeFileSync(logoAbs, bytes); // overwrite ok — same bytes → same path

  const logoRel = relative(templateDir, logoAbs);
  return { logoInputArg: `logo=${logoRel}`, logoChecksum: checksum };
}
```

**Wire into** `renderFixtureFromManifest()` — after building `json=` input, if `logoInputArg` returned, append `--input`, `logoInputArg`.

**Template block** (`packages/templates/invoice/modern.typ`) — insert after preamble vars, before header grid:

```typst
#let logo-path = sys.inputs.at("logo", default: none)

// Header — logo optional (absent for basic/pagination fixtures)
#grid(
  columns: (1fr, 1fr),
  gutter: 12pt,
  align(left)[
    #if logo-path != none [
      #image(logo-path, width: 48pt, height: 48pt, fit: "contain")
      #v(6pt)
    ]
    #text(font: font-semibold, fill: text-primary, size: 14pt)[#payload.seller.name]
  ],
  align(right)[
    #text(font: font-bold, fill: text-primary, size: 18pt)[INVOICE]
  ],
)
```

Replace the existing header `#grid` that only shows seller name — **do not** add logo markup outside this conditional.

### Deterministic logo bytes (embed verbatim in fixture JSON)

| Format | contentType | bytesBase64 (exact) | logo_checksum (SHA-256 of raw/sanitized bytes) |
| --- | --- | --- | --- |
| PNG | `image/png` | `iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+X4f0AAAAASUVORK5CYII=` | `9f8d9d8acd5d181df9cc210eed6451603814e1d8d622c82acf9a5bb7f38bc438` |
| JPEG | `image/jpeg` | `/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAABAAEDAREAAhEBAxEB/8QAFAABAAAAAAAAAAAAAAAAAAAACP/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAMAwEAAhEDEQA79//Z` | `3b20d13ec3b2b6ea57c851c7688b91c72ba91649b90668c6f21d4842dc46bd8e` |
| SVG | `image/svg+xml` | `PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxMCIgaGVpZ2h0PSIxMCI+PHJlY3Qgd2lkdGg9IjEwIiBoZWlnaHQ9IjEwIiBmaWxsPSIjMEQ5NDg4Ii8+PC9zdmc+` | `eadd635626436423706e82e13d72f302804806e2c34c75616fc662e27328a2c3` |

Decoded SVG (for reference only — fixture uses base64 above):

```xml
<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><rect width="10" height="10" fill="#0D9488"/></svg>
```

**Fixture JSON skeleton** (all three — only `documentNumber`, `branding.logoBytes`, and optional `notes` differ):

```json
{
  "schemaVersion": "2026-07-20",
  "documentType": "invoice",
  "template": "modern",
  "documentNumber": "INV-2026-LOGO-PNG",
  "issuedAt": "2026-07-15",
  "dueAt": "2026-08-15",
  "currency": "USD",
  "seller": { "...": "copy verbatim from invoice-modern-basic.json" },
  "buyer": { "...": "copy verbatim from invoice-modern-basic.json" },
  "lineItems": [ "... copy verbatim from invoice-modern-basic.json ..." ],
  "taxLines": [ "... copy verbatim ..." ],
  "pricesIncludeTax": false,
  "totals": {
    "subtotal": { "amount": "622.00" },
    "taxTotal": { "amount": "51.56" },
    "grandTotal": { "amount": "673.56" }
  },
  "notes": "Logo determinism spike fixture — PNG variant.",
  "branding": {
    "logoBytes": {
      "contentType": "image/png",
      "bytesBase64": "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+X4f0AAAAASUVORK5CYII="
    }
  }
}
```

Swap `contentType`, `bytesBase64`, `documentNumber`, and `notes` suffix (`PNG` / `JPEG` / `SVG`) per fixture file.

### SVG sanitizer spec (`packages/render/src/svg-sanitize.ts`)

```typescript
export type SvgSanitizeResult =
  | { ok: true; sanitized: Buffer; sha256: string }
  | { ok: false; errors: string[] };

/** Sanitize persisted SVG logo bytes before Typst write. Pure TS — no DOM deps. */
export function sanitizeSvgLogo(input: Buffer | string): SvgSanitizeResult;
```

**Processing order:**

1. Parse input as UTF-8 string `svg`.
2. **Strip** `<script>...</script>` (case-insensitive, dotall).
3. **Strip** self-closing `<script…/>` tags.
4. **Strip** `<foreignObject>...</foreignObject>` (case-insensitive, dotall).
5. **Strip** event-handler attributes: regex `\s(on[a-zA-Z]+)\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)` (global, case-insensitive).
6. **Strip** external references on `href` / `xlink:href` where value matches `(?i)^(?:https?:)?//` or `(?i)^https?://`.
7. **Reject** (return `{ ok: false }`) if any remain:
   - `<script` (case-insensitive)
   - `\son[a-zA-Z]+\s*=` event handler
   - `<foreignObject` (case-insensitive)
   - external `href=` / `xlink:href=` (same patterns as step 6)
8. On success: `sanitized = Buffer.from(svg, "utf8")`, `sha256 = sha256(sanitized)`.

**Unit test matrix** (`svg-sanitize.test.ts` — inline strings, not golden fixtures):

| Case | Input snippet | Expected |
| --- | --- | --- |
| clean | Dev Notes SVG rect | `ok: true` |
| script tag | `<script>alert(1)</script>` inside svg | stripped → `ok: true` if no script remains |
| script reject | `<script src="https://evil/x"/>` after strip still has `<script` | `ok: false` |
| onload | `<svg onload="alert(1)">` | handler stripped → `ok: true` if no handlers remain |
| foreignObject | `<foreignObject>…</foreignObject>` | stripped; reject if tag remains |
| external href | `<image xlink:href="https://evil.com/x.png"/>` | external ref stripped or reject if still present |

PNG/JPEG logos **must not** invoke `sanitizeSvgLogo`.

### Render record stub (`packages/render/src/render-record.ts`)

```typescript
import { createHash } from "node:crypto";

/**
 * Future Drizzle `renders.logo_checksum` (SOLUTION-DESIGN §4.4, epics Story 3.1).
 * SHA-256 hex of persisted logo bytes written for Typst — post-SVG-sanitization when applicable.
 * Populated by render pipeline from `prepareLogoForTypst().logoChecksum`; not persisted to DB in Epic 1.
 */
export function computeLogoChecksum(bytes: Buffer): string {
  return createHash("sha256").update(bytes).digest("hex");
}
```

Optional export type `RenderRecordLogoFields = { logo_checksum: string | null }` with JSDoc referencing `renders` table — no DB wiring in this story.

### Golden stability plan (mandatory — Story 1.5 lesson)

| Scenario | Action |
| --- | --- |
| Template `#if logo-path != none` — no logo input on basic/pagination | PDF bytes **unchanged** — hashes stay `b11be453…105c` and `d19dd496…c584` |
| Logo input present | **New** goldens for three logo fixtures only — expect PDF hash **≠** basic hash |
| Pre-merge gate | Run `golden:check` in Docker **before** committing template — basic + pagination must pass first |
| If basic/pagination drift | **Stop** — fix conditional template until stable; do not bulk-regenerate without PR label `golden-update` + Dev Agent Record justification |

**Stability test** (add to test suite):

```typescript
const STABLE_BASIC = "b11be4533d38f525326164b530a143bd71270440dc4b98f42cec426f2d3a105c";
const STABLE_PAGINATION = "d19dd496ed850cea10f8f50146812c4541fc811f075553222b432e6e691cc584";

renderTest("basic fixture golden unchanged after logo template work", () => {
  const out = join(TMP_DIR, "stability-basic.pdf");
  renderFixture(BASIC_FIXTURE, "free", out);
  expect(sha256File(out)).toBe(STABLE_BASIC);
});
```

Use manifest-driven `renderFixtureFromManifest()` for stability tests once driver handles logo prep (ensures same code path as `golden:check`).

### Double-render determinism tests (per format)

Mirror Story 1.2 pattern for each logo fixture id:

```typescript
const LOGO_FIXTURES = [
  "invoice-modern-logo-png",
  "invoice-modern-logo-jpeg",
  "invoice-modern-logo-svg",
] as const;

for (const id of LOGO_FIXTURES) {
  renderTest(`consecutive renders of ${id} are byte-identical`, () => {
    const out1 = join(TMP_DIR, `${id}-det-1.pdf`);
    const out2 = join(TMP_DIR, `${id}-det-2.pdf`);
    renderFixture(id, "free", out1); // must route through logo-prep + --input logo=
    renderFixture(id, "free", out2);
    expect(sha256File(out1)).toBe(sha256File(out2));
  });
}
```

Extend `renderFixture()` helper in tests to call shared `prepareLogoForTypst()` — **do not** duplicate logo logic in tests vs harness.

### Manifest entries (append three to `fixtures[]`)

```json
{
  "id": "invoice-modern-logo-png",
  "payload": "__fixtures__/payloads/invoice-modern-logo-png.json",
  "template": "../templates/invoice/modern.typ",
  "sha256": "<AUTHORITATIVE_HASH_FROM_CI_DOCKER_golden:update>",
  "typstVersion": "0.15.1",
  "schemaVersion": "2026-07-20",
  "inputs": { "tier": "free" }
}
```

Repeat for `invoice-modern-logo-jpeg` and `invoice-modern-logo-svg`. Replace placeholder hashes only after `golden:update` inside `usetagih-render-ci:local`.

### Current repo state (Stories 1.1–1.5 — build on this)

| Item | State | This story changes |
| --- | --- | --- |
| `packages/templates/invoice/modern.typ` | No logo rendering | conditional `#image(logo-path)` header block |
| `packages/render/src/golden/render-fixture.ts` | json + tier inputs only | logo prep + `--input logo=` |
| `packages/render/manifest.json` | basic + pagination-25 | **+3** logo fixtures |
| `packages/render/__fixtures__/payloads/` | basic, pagination, wrong-total | **+3** logo JSON |
| `packages/render/__fixtures__/golden/` | basic + pagination `.sha256` | **+3** logo `.sha256` |
| `packages/render/src/render-record.ts` | absent | **NEW** stub |
| `packages/render/src/svg-sanitize.ts` | absent | **NEW** + tests |
| `packages/render/src/logo-prep.ts` | absent | **NEW** |
| `golden:check` / `pdf-golden.yml` | Story 1.3–1.4 | auto-picks new manifest entries |

### Architecture compliance

- **FR-7:** Deterministic PDF bytes — double-render + golden SHA-256 per logo format.
- **AD-10 blocking #3:** Logo determinism fixture PNG/JPEG/SVG; CI failure triggers spike exit.
- **AD-7 / SOLUTION-DESIGN §4.4:** SVG active content stripped/rejected; checksum on persisted bytes (`logo_checksum` stub).
- **AD-3:** Authoritative golden hashes from CI Docker only.
- **PRD §10.1:** Fixture payload shape extends `branding` with persisted bytes (spike); production `logoUrl` deferred to Epic 3.9.
- **Story 1.5 lesson:** Layout change (logo block) **will** change bytes when logo present; **must not** change bytes when logo absent — enforce via AC: 3 stability gate.

### Anti-patterns (do not do)

- Do **not** fetch `logoUrl` over network in tests or harness — fixtures use `logoBytes` only.
- Do **not** add `@preview/based` or in-template base64 decode — driver temp file is the chosen mechanism.
- Do **not** implement SSRF, redirect caps, or logo upload API — Epic 3.9.
- Do **not** regenerate basic/pagination goldens when adding logo fixtures unless stability gate fails.
- Do **not** skip SVG sanitization for SVG logo fixture — even clean fixture must go through sanitizer (proves pipeline).
- Do **not** use random logo bytes — embed exact base64 from Dev Notes table.
- Do **not** add `golden:soak --iterations 100` — Story 1.8.
- Do **not** commit `.tmp/*.pdf` or `.tmp/logos/*` — scratch dirs (ensure `.gitignore` covers `.tmp/logos/` if needed).

### Previous story intelligence

**Story 1.5:**

- Metadata probes (`<page-count>`, `<totals-page>`) do **not** alter PDF bytes when layout unchanged — but **layout** changes do alter bytes.
- Adding conditional logo block: absent logo → no layout change expected; present logo → new goldens required.
- `golden:check` triple-checks manifest vs `.sha256` file vs render — reuse unchanged.

**Story 1.2:**

- Double-render byte identity test pattern in `invoice-modern.test.ts`.
- `#metadata()` labels invisible in PDF — logo `image()` **is** visible and affects bytes.

**Story 1.3–1.4:**

- Manifest-driven harness; new fixtures auto-picked by `golden:check` and `pdf-golden.yml`.

### Project Structure Notes

```
packages/render/
├── __fixtures__/
│   ├── payloads/
│   │   ├── invoice-modern-logo-png.json    # NEW
│   │   ├── invoice-modern-logo-jpeg.json   # NEW
│   │   └── invoice-modern-logo-svg.json    # NEW
│   └── golden/
│       ├── invoice-modern-logo-png.sha256    # NEW
│       ├── invoice-modern-logo-jpeg.sha256   # NEW
│       └── invoice-modern-logo-svg.sha256    # NEW
├── manifest.json                             # +3 entries
└── src/
    ├── logo-prep.ts                          # NEW
    ├── render-record.ts                      # NEW
    ├── svg-sanitize.ts                       # NEW
    ├── svg-sanitize.test.ts                  # NEW
    ├── golden/render-fixture.ts              # wire logo prep
    └── invoice-modern.test.ts OR logo-determinism.test.ts  # stability + double-render

packages/templates/invoice/
└── modern.typ                                  # conditional logo header
```

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story-1.6]
- [Source: _bmad-output/planning-artifacts/prds/prd-usetagih-2026-07-20/prd.md#10.1]
- [Source: _bmad-output/planning-artifacts/architecture/architecture-usetagih-2026-07-20/SOLUTION-DESIGN.md#§4.4]
- [Source: _bmad-output/planning-artifacts/architecture/architecture-usetagih-2026-07-20/SOLUTION-DESIGN.md#§4.2-SVG-sanitization]
- [Source: _bmad-output/implementation-artifacts/1-5-25-line-item-pagination-fixture-fr-8-blocking.md]
- [Source: packages/render/src/golden/render-fixture.ts]
- [Source: packages/templates/invoice/modern.typ]
- [Source: packages/render/__fixtures__/payloads/invoice-modern-basic.json]
- [Source: https://typst.app/docs/changelog/0.15.0/ — `image.decode` removal]
- [Source: https://github.com/typst/typst/issues/6126 — no native base64 decode]

## Dev Agent Record

### Agent Model Used

Composer 2.5 Fast (headless subagent)

### Debug Log References

- story Dev Notes PNG/JPEG base64 had invalid image structure (PNG IDAT CRC mismatch; JPEG SOF zero components) — replaced with Typst-decodable 1×1 bytes; SVG bytes unchanged (`eadd6356…`)
- `render-fixture.ts` script already routes through `renderFixtureFromManifest()` — no script change required

### Completion Notes List

- logo byte checksums (persisted): PNG `5e3d382db4dd83d59aa5742793ad6b7903409e865c83bcbc54835049f043bc15`, JPEG `7c60b3084f2b187549233aeb6d4dfc173fa796357b83c0b44d000da5bd06ed37`, SVG `eadd635626436423706e82e13d72f302804806e2c34c75616fc662e27328a2c3`
- golden PDF hashes (CI Docker, `SOURCE_DATE_EPOCH=1700000000`): PNG `17d03365c73abe453099420cd495602383d7d008cb332d6c87e8d3d972517646`, JPEG `c1ce18db9dfaf69056aa8a52765b4c812072314030b44afa90cc22fb0702ff56`, SVG `8df87133dcd46622ca4ca0dd3b196a39f6e0ebe7ff1f28ff92657b873a1248d4`
- stability gate preserved: basic `b11be4533d38f525326164b530a143bd71270440dc4b98f42cec426f2d3a105c`, pagination `d19dd496ed850cea10f8f50146812c4541fc811f075553222b432e6e691cc584`
- double-render in-container: all three logo fixtures IDENTICAL consecutive hashes
- sanitizer tests: clean SVG passes; script tag stripped; self-closing script rejected; onload stripped; foreignObject stripped; external xlink:href stripped/rejected
- `bunx turbo run lint typecheck test build --force`: 36/36 tasks exit 0

### File List

- `packages/render/src/svg-sanitize.ts` (new)
- `packages/render/src/svg-sanitize.test.ts` (new)
- `packages/render/src/render-record.ts` (new)
- `packages/render/src/logo-prep.ts` (new)
- `packages/render/src/golden/render-fixture.ts` (modified)
- `packages/render/src/invoice-modern.test.ts` (modified)
- `packages/render/src/golden/manifest.test.ts` (modified)
- `packages/templates/invoice/modern.typ` (modified)
- `packages/render/__fixtures__/payloads/invoice-modern-logo-png.json` (new)
- `packages/render/__fixtures__/payloads/invoice-modern-logo-jpeg.json` (new)
- `packages/render/__fixtures__/payloads/invoice-modern-logo-svg.json` (new)
- `packages/render/__fixtures__/golden/invoice-modern-logo-png.sha256` (new)
- `packages/render/__fixtures__/golden/invoice-modern-logo-jpeg.sha256` (new)
- `packages/render/__fixtures__/golden/invoice-modern-logo-svg.sha256` (new)
- `packages/render/manifest.json` (modified)
- `_bmad-output/implementation-artifacts/1-6-logo-determinism-fixture-png-jpeg-svg-blocking.md` (modified)
- `_bmad-output/implementation-artifacts/sprint-status.yaml` (modified)

## Change Log

- 2026-07-20: logo determinism fixtures (PNG/JPEG/SVG), SVG sanitizer, conditional template logo block, manifest + goldens, stability + double-render tests

## Story Validation Record

- **Validated:** 2026-07-20 against `bmad-create-story/checklist.md`
- **Result:** PASS
- **Checks applied:** Epics AC #3 coverage (PNG/JPEG/SVG fixtures, double-render determinism, logo_checksum stub, SVG §4.4 sanitization, CI failure = spike exit); PRD §10.1 branding shape documented with spike `logoBytes` extension; single base64→Typst mechanism (driver temp file + `--input logo=`) with Typst 0.15 evidence; exact fixture bytes + checksums table; sanitizer function signature + rejection rules + test matrix; template conditional logo spec; golden stability plan for basic/pagination hashes; manifest + golden additions; reuse Story 1.2–1.5 harness patterns; anti-patterns and out-of-scope boundaries (Epic 3.9 SSRF); turbo `--force` verification gate

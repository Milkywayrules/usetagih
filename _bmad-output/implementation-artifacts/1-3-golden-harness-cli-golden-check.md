---
baseline_commit: 9557386
---

# Story 1.3: Golden harness CLI (`golden:check`)

Status: review

<!-- Ultimate context engine analysis completed - comprehensive developer guide created -->

## Story

As a CI engineer,
I want `packages/render/scripts/golden-check.ts` comparing rendered PDF SHA-256 to manifest,
so that determinism regressions block merge (NFR-6, AD-3).

## Acceptance Criteria

1. **Given** Story 1.2 complete (`manifest.json` `fixtures[]` with `invoice-modern-basic`, committed `.sha256`, `render-fixture.ts`, `typst-driver.ts`), **when** `packages/render/src/golden/manifest.ts` parses `manifest.json`, **then** each fixture entry validates required fields (`id`, `payload`, `template`, `sha256`, `typstVersion`, `schemaVersion`, `inputs`) and throws typed parse errors on missing/invalid fields (lowercase hex `sha256` exactly 64 chars).
2. **Given** a parsed manifest, **when** `packages/render/src/golden/hash-compare.ts` compares two SHA-256 strings, **then** pure functions return `{ match: boolean, ... }` and on mismatch produce a report with fixture id, expected hash, actual hash, expected vs actual byte sizes, and first **32** bytes hex diff (side-by-side or offset-aligned) — **no Typst spawn required** for these unit tests.
3. **Given** manifest fixture `invoice-modern-basic`, **when** `renderFixtureFromManifest(entry)` runs (shared module used by CLI scripts), **then** it renders via existing `compileTypst()` + manifest `template` path (resolved from `packages/render/`) + manifest `inputs` as `--input key=value` pairs + payload path using the **same relative-path technique** as `scripts/render-fixture.ts` (payload path relative to template directory), output to `packages/render/.tmp/{id}.pdf`, and returns `{ outputPath, sha256 }`.
4. **Given** all manifest fixtures, **when** `bun run --filter @usetagih/render golden:check` executes, **then** for each fixture it: (a) renders to `.tmp/`, (b) compares actual SHA-256 to manifest `sha256`, (c) compares manifest `sha256` to committed `__fixtures__/golden/{id}.sha256` — **warn+fail if manifest and `.sha256` file disagree** (drift detection), (d) exits **0** only when all fixtures pass all checks; exits **1** on any mismatch or render failure, printing per-fixture mismatch report to stderr.
5. **Given** intentional template change, **when** `bun run --filter @usetagih/render golden:update` executes, **then** it re-renders all fixtures, rewrites both `manifest.json` fixture `sha256` fields and `__fixtures__/golden/{id}.sha256` files atomically (write temp + rename), prints a **loud stderr warning** banner (`⚠ GOLDEN HASHES UPDATED — commit with PR label golden-update`), and exits 0.
6. **Given** `golden:soak`, **when** `bun run --filter @usetagih/render golden:soak [--iterations N]` runs, **then** for each manifest fixture it renders **N** consecutive times (default **5** when flag omitted — local dev default; Story 1.8 CI passes `--iterations 100`), asserts every iteration SHA-256 equals the first iteration hash, logs fixture id + iteration count + duration, and exits 1 on first drift with iteration number in the report.
7. **Given** `golden:render`, **when** `bun run --filter @usetagih/render golden:render` executes, **then** it renders **all** manifest fixtures to `.tmp/{id}.pdf` and prints each output path + SHA-256 to stdout (no hash comparison — render-only helper).
8. **Given** `packages/render/package.json`, **when** scripts section is read, **then** it includes exactly: `"golden:render": "bun scripts/golden-render.ts"`, `"golden:check": "bun scripts/golden-check.ts"`, `"golden:soak": "bun scripts/golden-soak.ts"`, `"golden:update": "bun scripts/golden-check.ts --update"` (architecture SOLUTION-DESIGN §3.4).
9. **Given** workspace with Typst binary installed, **when** `bun test packages/render` runs, **then** new unit tests in `packages/render/src/golden/*.test.ts` pass covering manifest parse success/failure cases and hash-compare mismatch report shape; existing Story 1.1–1.2 tests remain green.
10. **Given** workspace, **when** `bunx turbo run lint typecheck test build --force` runs from repo root, **then** all tasks exit 0.
11. **Verification gate — happy path:** `bun run --filter @usetagih/render golden:check` exits 0 with `invoice-modern-basic` hash `b11be4533d38f525326164b530a143bd71270440dc4b98f42cec426f2d3a105c`.
12. **Verification gate — failure path:** temporarily corrupt `__fixtures__/golden/invoice-modern-basic.sha256` (change one hex char) → `golden:check` exits 1 with mismatch report including sizes + hex diff → restore file → `golden:check` exits 0 again.
13. **Out of scope (Stories 1.4+):** `Dockerfile.render-ci`, `.github/workflows/pdf-golden.yml`, pagination/logo/SVG fixtures, CI Docker authoritative gate, `SPIKE-RESULT.md`. Do **not** add new fixtures beyond existing `invoice-modern-basic`.

## Tasks / Subtasks

- [x] Task 1 — Pure golden library modules (AC: 1, 2)
  - [x] Create `packages/render/src/golden/manifest.ts` — `loadManifest()`, `parseFixtureEntry()`, Zod or hand-rolled validation with clear error messages
  - [x] Create `packages/render/src/golden/hash-compare.ts` — `compareSha256()`, `formatHexDiff(bytesA, bytesB, maxBytes=32)`, `buildMismatchReport()`
  - [x] Create `packages/render/src/golden/index.ts` re-exports
  - [x] Create `packages/render/src/golden/manifest.test.ts` — valid manifest, missing field, bad sha256 format
  - [x] Create `packages/render/src/golden/hash-compare.test.ts` — match, mismatch sizes, hex diff output
- [x] Task 2 — Shared manifest-driven render helper (AC: 3)
  - [x] Create `packages/render/src/golden/render-fixture.ts` — `renderFixtureFromManifest(entry, options?)` using `compileTypst()` from `typst-driver.ts`
  - [x] Refactor `packages/render/scripts/render-fixture.ts` to call shared helper (preserve CLI flags `--fixture`, `--tier`, `--out`; lookup manifest entry by id or fallback to invoice-modern defaults for backward compat)
  - [x] Resolve paths: `payload` and `template` relative to `packages/render/`; payload `--input json=` path relative to template dir (match Story 1.2 technique)
  - [x] Convert manifest `inputs` object to `--input key=value` args (e.g. `tier=free`)
- [x] Task 3 — `golden-check.ts` CLI (AC: 4, 5)
  - [x] Create `packages/render/scripts/golden-check.ts` with flags `--update` (optional)
  - [x] Check mode: iterate fixtures, render, triple-check (actual vs manifest vs `.sha256` file), aggregate exit code
  - [x] Update mode: re-render all, update manifest + `.sha256`, loud warning banner to stderr
  - [x] Ensure `.tmp/` created via `mkdirSync({ recursive: true })`; do not commit `.tmp/` outputs
- [x] Task 4 — `golden-render.ts` and `golden-soak.ts` CLIs (AC: 6, 7)
  - [x] Create `packages/render/scripts/golden-render.ts` — render all fixtures, print paths + hashes
  - [x] Create `packages/render/scripts/golden-soak.ts` — parse `--iterations N` (default 5), loop per fixture, fail fast on drift
  - [x] Log soak duration per fixture for Story 1.8 baseline tracking
- [x] Task 5 — package.json scripts (AC: 8)
  - [x] Add four golden scripts per Dev Notes §Scripts block
  - [x] Keep existing `render:fixture`, `render:smoke`, `install:typst` unchanged
- [x] Task 6 — Verification gate (AC: 9–12)
  - [x] Run `bun test packages/render`
  - [x] Run `golden:check` happy + corrupt-hash failure + restore
  - [x] Run `bunx turbo run lint typecheck test build --force`
  - [x] Record results in Dev Agent Record

## Dev Notes

### Goal

Deliver the **golden harness CLI** that turns Story 1.2's single fixture + hash into an **automated determinism gate** — third story of Epic 1 (BLOCKING PDF spike). Unblocks Story 1.4 (CI Docker + `pdf-golden.yml`) and provides `golden:soak` scaffold for Story 1.8 (100-iteration CI soak).

### Epic 1 context (cross-story sequencing)

| Story | Delivers | Depends on 1.3 |
| --- | --- | --- |
| 1.3 | **this story** — `golden:check` / `golden:update` / `golden:soak` / `golden:render` | 1.2 fixture + manifest + render-fixture |
| 1.4 | `Dockerfile.render-ci` + `pdf-golden.yml` calling `golden:check` | this harness |
| 1.5–1.7 | Blocking fixtures added to manifest | harness consumes new entries automatically |
| 1.8 | CI soak `--iterations 100` | reuses `golden:soak` from this story |
| 1.9 | SPIKE-RESULT.md | all above |

### Environment facts (do not guess)

| Fact | Value |
| --- | --- |
| Baseline commit (Story 1.2 done) | `9557386` — review merge after `51342f7` / `5fe155a` |
| Typst version | `0.15.1` per `typst-version.txt` and manifest |
| Committed golden hash | `b11be4533d38f525326164b530a143bd71270440dc4b98f42cec426f2d3a105c` |
| Manifest path | `packages/render/manifest.json` (package root — **not** under `__fixtures__/golden/`) |
| Golden hash files | `packages/render/__fixtures__/golden/{fixture-id}.sha256` — one lowercase hex line |
| Temp render output | `packages/render/.tmp/{fixture-id}.pdf` — gitignored |
| Turbo verification | `bunx turbo run lint typecheck test build --force` |
| Local golden advisory | SOLUTION-DESIGN §3.2 — local `golden:check` may differ from CI Docker; still implement correctly; CI Docker is authoritative in Story 1.4 |
| Soak default iterations | **5** local default; Story 1.8 CI uses `--iterations 100` |
| Hex diff width | First **32** bytes of PDF buffers (configurable constant `HEX_DIFF_BYTES = 32`) |

### Current repo state (Stories 1.1–1.2 — build on this, do not redo)

| Item | State | This story changes |
| --- | --- | --- |
| `packages/render/manifest.json` | `fixtures[]` with one entry `invoice-modern-basic` | only modified by `golden:update` (not in normal check path) |
| `packages/render/scripts/render-fixture.ts` | CLI hardcodes `invoice/modern.typ`; prints SHA-256 | refactor to use shared manifest render helper |
| `packages/render/src/typst-driver.ts` | `compileTypst`, `evalTypst`, determinism env | **reuse as-is** — do not regress |
| `packages/render/__fixtures__/golden/invoice-modern-basic.sha256` | committed hash | read-only in check mode; rewritten in update mode |
| `packages/render/package.json` | has `render:fixture`, no golden scripts | add four golden scripts |
| `scripts/golden-check.ts` | **absent** | **NEW** |
| `scripts/golden-soak.ts` | **absent** | **NEW** |
| `scripts/golden-render.ts` | **absent** | **NEW** |
| `src/golden/` | **absent** | **NEW** library modules + tests |

### Existing manifest fixture entry (canonical — do not rename id)

```json
{
  "id": "invoice-modern-basic",
  "payload": "__fixtures__/payloads/invoice-modern-basic.json",
  "template": "../../templates/invoice/modern.typ",
  "sha256": "b11be4533d38f525326164b530a143bd71270440dc4b98f42cec426f2d3a105c",
  "typstVersion": "0.15.1",
  "schemaVersion": "2026-07-20",
  "inputs": {
    "tier": "free"
  }
}
```

Paths in `payload` and `template` are relative to `packages/render/`.

### Manifest schema (Story 1.3 validation contract)

Top-level `manifest.json` fields (already present — preserve):

| Field | Type | Notes |
| --- | --- | --- |
| `typstVersion` | string | must match `typst-version.txt` |
| `schemaVersion` | string | manifest schema version (`0.0.0` today) |
| `typstBinary` | object | Story 1.1 — do not modify in this story |
| `renderCiImage` | object | Story 1.4 — do not modify |
| `fixtures` | array | **iterate this in all golden CLIs** |

Each `fixtures[]` entry **required** fields:

| Field | Type | Validation |
| --- | --- | --- |
| `id` | string | kebab-case; matches `{id}.sha256` filename |
| `payload` | string | path relative to `packages/render/` |
| `template` | string | path relative to `packages/render/` |
| `sha256` | string | `/^[a-f0-9]{64}$/` |
| `typstVersion` | string | e.g. `"0.15.1"` |
| `schemaVersion` | string | e.g. `"2026-07-20"` |
| `inputs` | object | string values only; passed as Typst `--input` |

Parse errors must include JSON path context, e.g. `fixtures[0].sha256: expected 64-char lowercase hex`.

### Render path resolution (match Story 1.2 — critical)

Story 1.2 established that Typst `--input json=` paths resolve **relative to the template file directory**, not repo root. Existing working code in `scripts/render-fixture.ts`:

```typescript
const payloadPath = resolve(PACKAGE_ROOT, `__fixtures__/payloads/${fixture}.json`);
const payloadInput = relative(join(REPO_ROOT, "packages/templates/invoice"), payloadPath);

compileTypst({
  inputPath: TEMPLATE_PATH,
  outputPath: out,
  extraArgs: ["--input", `json=${payloadInput}`, "--input", `tier=${tier}`],
});
```

**Generalize for manifest entries:**

```typescript
const templateAbs = resolve(PACKAGE_ROOT, entry.template);
const templateDir = dirname(templateAbs);
const payloadAbs = resolve(PACKAGE_ROOT, entry.payload);
const payloadInput = relative(templateDir, payloadAbs);

const inputArgs = Object.entries(entry.inputs).flatMap(([k, v]) => [
  "--input", `${k}=${typeof v === "string" ? v : String(v)}`,
]);

compileTypst({
  inputPath: templateAbs,
  outputPath: resolve(PACKAGE_ROOT, ".tmp", `${entry.id}.pdf`),
  extraArgs: ["--input", `json=${payloadInput}`, ...inputArgs],
});
```

Do **not** switch to absolute payload paths — breaks Typst 0.15 sandbox resolution.

### `golden-check.ts` flow

```
1. loadManifest(PACKAGE_ROOT/manifest.json)
2. for each fixture in manifest.fixtures:
   a. renderFixtureFromManifest → { outputPath, sha256: actual }
   b. expectedManifest = fixture.sha256
   c. expectedFile = read(__fixtures__/golden/{id}.sha256).trim()
   d. if expectedManifest !== expectedFile:
        emit MANIFEST/GOLDEN-FILE DRIFT warning (both values printed)
        fail this fixture
   e. if actual !== expectedManifest:
        read both PDF bytes (actual file + optional: re-read isn't needed for expected)
        emit mismatch report (hash, sizes, hex diff of actual vs re-render expected bytes)
        fail this fixture
3. exit 0 if all pass; exit 1 if any fail
```

**Mismatch report format (stderr, per failing fixture):**

```
FAIL invoice-modern-basic
  expected: b11be4533d38f525326164b530a143bd71270440dc4b98f42cec426f2d3a105c
  actual:   b11be4533d38f525326164b530a143bd71270440dc4b98f42cec426f2d3a105d
  size: expected manifest hash only — compare rendered PDF sizes:
  pdf bytes: <actual-size> (expected hash implies prior size unknown — show actual size; if golden PDF exists show both)
  first-32-bytes hex diff:
    actual:   255044462d312e340a25...
    expected: (render fresh expected hash match — for byte diff, compare actual PDF to a re-render is same as hash check)
```

**Exact mismatch report fields (implement literally):**

On hash mismatch for fixture `{id}`:

1. Render once → buffer `A`, hash `actual`, size `sizeA`
2. Render again immediately → buffer `B`, hash `actual2`, size `sizeB`
3. Print to stderr:
   - `FAIL {id}`
   - `expected (manifest): {manifest.sha256}`
   - `expected (golden file): {goldenFileHash}` — omit line if identical to manifest
   - `actual: {actual}`
   - `pdf size: {sizeA} bytes` — if `sizeA !== sizeB`, also print `second render size: {sizeB} bytes (flake suspected)`
   - `first 32 bytes (render 1): {hex(A[0:32])}`
   - If `actual !== actual2`: also print `first 32 bytes (render 2): {hex(B[0:32])}` + `WARNING: consecutive renders differ — flake detected`
4. Exit 1 (aggregate across fixtures)

On **manifest vs `.sha256` drift** (before render): print both values, skip render for that fixture, fail.

Use lowercase hex without `0x` prefix; space-separate every 2 chars optional (be consistent within file).

### `--update` mode (`golden:update`)

1. Same render loop as check
2. For each fixture:
   - Compute fresh SHA-256
   - Write `__fixtures__/golden/{id}.sha256` (single line + `\n`)
   - Update in-memory manifest entry `sha256`
3. Write `manifest.json` (pretty-printed 2-space indent, trailing newline)
4. Print warning banner to stderr:

```
══════════════════════════════════════════════════════════════
⚠  GOLDEN HASHES UPDATED — review diffs before commit
⚠  PR must carry label: golden-update
⚠  Do not run --update to silence CI without visual review
══════════════════════════════════════════════════════════════
```

5. Exit 0

Use atomic writes: write to `.tmp` file then `rename`.

### `golden-soak.ts` contract

```
Usage: bun scripts/golden-soak.ts [--iterations N]

Default: --iterations 5
```

For each manifest fixture:

```typescript
let firstHash: string | null = null;
for (let i = 1; i <= iterations; i++) {
  const { sha256 } = renderFixtureFromManifest(entry, { outputPath: `.tmp/${id}-soak-${i}.pdf` });
  if (firstHash === null) firstHash = sha256;
  else if (sha256 !== firstHash) { report drift at iteration i; exit 1; }
}
console.log(`SOAK PASS ${id}: ${iterations} iterations, hash ${firstHash}, ${durationMs}ms`);
```

Clean up soak temp files in `finally` (optional — `.tmp/` is gitignored).

Story 1.8 will invoke: `bun run --filter @usetagih/render golden:soak --iterations 100`

### `golden-render.ts` contract

Renders all manifest fixtures to `.tmp/{id}.pdf`, prints:

```
invoice-modern-basic → packages/render/.tmp/invoice-modern-basic.pdf (b11be453…)
```

No hash validation. Exit 1 if any render throws.

### package.json scripts block

Add to `packages/render/package.json`:

```json
{
  "golden:render": "bun scripts/golden-render.ts",
  "golden:check": "bun scripts/golden-check.ts",
  "golden:soak": "bun scripts/golden-soak.ts",
  "golden:update": "bun scripts/golden-check.ts --update"
}
```

Architecture SOLUTION-DESIGN §3.4 specifies `golden:render` → `render-fixture.ts`; **this story uses dedicated `golden-render.ts`** that iterates all manifest fixtures (architecture intent is "render all fixtures" — single-fixture CLI remains `render:fixture`).

### Testing requirements

**Pure unit tests (always run — no Typst required):**

`packages/render/src/golden/manifest.test.ts`:

- Parses real `manifest.json` from disk (or fixture copy in test)
- Rejects manifest missing `fixtures`
- Rejects fixture with invalid sha256 (`GHIJK...` or uppercase)
- Rejects fixture missing `inputs`

`packages/render/src/golden/hash-compare.test.ts`:

- `compareSha256(a, a)` → match
- `compareSha256(a, b)` → mismatch with report fields populated
- `formatHexDiff` on known buffers → expected hex strings

**Integration (environment-gated — Typst required):**

Optional: one test in `golden-check.integration.test.ts` calling check logic when binary present — may rely on CLI verification gate instead to avoid duplication with Story 1.2 tests.

**Do not break:** `preamble.test.ts`, `invoice-modern.test.ts`, `index.test.ts`.

### Verification commands (Dev Agent Record must capture output)

```bash
# Prerequisites (once)
bash packages/render/scripts/install-typst-local.sh

# 1. Unit tests
bun test packages/render

# 2. Happy path
bun run --filter @usetagih/render golden:check
# expect exit 0

# 3. Failure path
cp packages/render/__fixtures__/golden/invoice-modern-basic.sha256 /tmp/golden-backup.sha256
echo "0000000000000000000000000000000000000000000000000000000000000000" > packages/render/__fixtures__/golden/invoice-modern-basic.sha256
bun run --filter @usetagih/render golden:check
# expect exit 1 + mismatch output
cp /tmp/golden-backup.sha256 packages/render/__fixtures__/golden/invoice-modern-basic.sha256

# 4. Restore verify
bun run --filter @usetagih/render golden:check
# expect exit 0

# 5. Soak smoke (default 5)
bun run --filter @usetagih/render golden:soak
# expect exit 0

# 6. Full workspace gate
bunx turbo run lint typecheck test build --force
```

### Architecture compliance

- **AD-3:** Reuse `compileTypst()` determinism flags — do not bypass driver.
- **AD-10:** No Chromium, no pixel-golden fallback — SHA-256 only.
- **NFR-6:** This story implements the local harness; CI wiring is Story 1.4.
- **FR-7:** Byte-identical check via SHA-256.
- **SOLUTION-DESIGN §3.4:** Four golden scripts; check flow render→compare→exit code.
- **SOLUTION-DESIGN §3.5:** Soak accepts `--iterations` for Story 1.8 reuse.

### Anti-patterns (do not do)

- Do **not** create `Dockerfile.render-ci` or `pdf-golden.yml` — Story 1.4.
- Do **not** add pagination/logo/SVG fixtures — Stories 1.5–1.7.
- Do **not** duplicate render logic in three scripts — extract shared `renderFixtureFromManifest`.
- Do **not** use absolute paths for `--input json=` — breaks Typst sandbox (Story 1.2 lesson).
- Do **not** commit `.tmp/*.pdf` or modify golden hashes except via `--update` during intentional refresh.
- Do **not** hardcode only `invoice-modern-basic` in golden-check — iterate `manifest.fixtures[]` for forward compatibility.
- Do **not** add npm dependencies for SHA-256 (use `node:crypto` like existing code).

### Previous story intelligence

**Story 1.1:**

- `compileTypst` requires `--root` = repo root for cross-package template imports.
- `SOURCE_DATE_EPOCH` defaults to `1700000000` in driver.
- Smoke hash `1fb48bb3…` is hello.typ only — unrelated to invoice golden.

**Story 1.2:**

- Invoice golden hash: `b11be4533d38f525326164b530a143bd71270440dc4b98f42cec426f2d3a105c`.
- PDF text is CID-encoded — golden check uses **byte hash only**, not string search.
- `render-fixture.ts` payload path must be relative to template dir.
- Manifest entry and `.sha256` file must stay in sync — this story enforces that.
- Footer/metadata tests stay in `invoice-modern.test.ts` — golden harness is hash-only.

### Project Structure Notes

```
packages/render/
├── manifest.json              # fixtures[] authority
├── scripts/
│   ├── golden-check.ts        # NEW — check + --update
│   ├── golden-soak.ts         # NEW
│   ├── golden-render.ts       # NEW
│   └── render-fixture.ts      # REFACTOR — thin CLI wrapper
├── src/
│   ├── golden/
│   │   ├── manifest.ts        # NEW
│   │   ├── hash-compare.ts    # NEW
│   │   ├── render-fixture.ts  # NEW — shared render
│   │   ├── manifest.test.ts   # NEW
│   │   └── hash-compare.test.ts # NEW
│   └── typst-driver.ts        # unchanged
└── __fixtures__/golden/
    └── {id}.sha256            # committed hash sidecar
```

Export golden helpers from `src/index.ts` only if needed by other packages — **YAGNI:** keep internal to `@usetagih/render` unless Epic 3 requires (it won't).

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story-1.3]
- [Source: _bmad-output/planning-artifacts/architecture/architecture-usetagih-2026-07-20/SOLUTION-DESIGN.md#§3.1–§3.5]
- [Source: _bmad-output/planning-artifacts/architecture/architecture-usetagih-2026-07-20/ARCHITECTURE-SPINE.md#AD-3, AD-10]
- [Source: _bmad-output/implementation-artifacts/1-2-invoice-modern-typst-template-and-basic-fixture.md]
- [Source: _bmad-output/implementation-artifacts/1-1-pin-typst-0-15-x-font-bundle-and-shared-preamble.md]
- [Source: packages/render/manifest.json]
- [Source: packages/render/scripts/render-fixture.ts]
- [Source: packages/render/src/typst-driver.ts]

## Dev Agent Record

### Agent Model Used

Composer 2.5 (implementation subagent)

### Debug Log References

- Story 1.2 manifest `template` path (`../../templates/...`) resolves one level too high from `packages/render/`; `resolveTemplatePath()` normalizes to `../templates/...` when direct path missing.

### Completion Notes List

- Added `src/golden/` library: manifest parsing with typed errors, SHA-256 compare + mismatch report (32-byte hex diff, flake detection via double render), shared `renderFixtureFromManifest()` reusing `compileTypst()`.
- Added CLIs: `golden-check.ts` (triple hash check + `--update` with atomic writes + warning banner), `golden-render.ts`, `golden-soak.ts` (default 5 iterations).
- Refactored `render-fixture.ts` to use shared manifest render helper; added four `golden:*` scripts to `package.json`.
- Verification: `bun test packages/render` — 29 pass; `golden:check` exit 0 (`b11be453…105c`); corrupt `.sha256` exit 1 (MANIFEST/GOLDEN-FILE DRIFT); restore exit 0; `golden:soak` 5 iterations identical (~97ms); `bunx turbo run lint typecheck test build --force` — 36/36 tasks green.

### File List

- `packages/render/src/golden/manifest.ts` (new)
- `packages/render/src/golden/hash-compare.ts` (new)
- `packages/render/src/golden/render-fixture.ts` (new)
- `packages/render/src/golden/index.ts` (new)
- `packages/render/src/golden/manifest.test.ts` (new)
- `packages/render/src/golden/hash-compare.test.ts` (new)
- `packages/render/scripts/golden-check.ts` (new)
- `packages/render/scripts/golden-render.ts` (new)
- `packages/render/scripts/golden-soak.ts` (new)
- `packages/render/scripts/render-fixture.ts` (modified)
- `packages/render/package.json` (modified)
- `packages/render/__fixtures__/manifest-missing-fixtures.json` (new — test fixture)
- `_bmad-output/implementation-artifacts/1-3-golden-harness-cli-golden-check.md` (modified)
- `_bmad-output/implementation-artifacts/sprint-status.yaml` (modified)

### Change Log

- 2026-07-20: Story 1.3 — golden harness CLI (`golden:check`, `golden:update`, `golden:soak`, `golden:render`) with manifest-driven render helper and pure unit tests.

### Story Validation Record

- **Validated:** 2026-07-20 against `bmad-create-story/checklist.md`
- **Result:** PASS
- **Checks applied:** manifest iteration not hardcoded; manifest vs `.sha256` drift detection; triple hash check; exit codes 0/1; mismatch report fields; `--update` warning banner; soak `--iterations` default 5 + Story 1.8 reuse; shared render helper extracting Story 1.2 path technique; pure unit tests without Typst; package.json four scripts; verification corrupt-hash gate; out-of-scope 1.4+ boundaries; no reinvention of driver/template/fixture

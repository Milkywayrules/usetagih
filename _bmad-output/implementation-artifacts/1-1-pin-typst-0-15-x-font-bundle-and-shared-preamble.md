---
baseline_commit: 6e78bab2061ccf96b216d1c719b10c66b589a142
---

# Story 1.1: Pin Typst 0.15.x, font bundle, and shared preamble

Status: done

<!-- Ultimate context engine analysis completed - comprehensive developer guide created -->

## Story

As a render engineer,
I want Typst 0.15.x exact patch pinned with vendored OFL fonts and deterministic preamble,
so that PDF output is byte-stable across environments (AD-3, FR-7).

## Acceptance Criteria

1. **Given** Epic 0 complete, **when** `packages/render/typst-version.txt` is read, **then** it contains exactly `0.15.1` (single line, no `v` prefix, no trailing whitespace) — the latest Typst **0.15.x patch** as of 2026-07-20 per [typst/typst releases](https://github.com/typst/typst/releases) (`v0.15.1` published 2026-07-17; supersedes `v0.15.0`).
2. **Given** `packages/render/fonts/`, **when** directory contents are inspected, **then** vendored OFL TTF files exist for **Inter 4.1** (Regular, Medium, SemiBold, Bold) and **JetBrains Mono 2.304** (Regular, Bold) plus license files — **fonts ARE committed**; total vendored weight stays minimal (6 TTFs + 2 license files only).
3. **Given** `packages/templates/_shared/preamble.typ`, **when** file is read, **then** it includes `#set document(date: none)`, Inter as default body font, JetBrains Mono for raw/mono text, and base typography tokens (size, leading) suitable for invoice templates in Story 1.2 — no watermark/footer yet (Story 1.2).
4. **Given** `packages/render/manifest.json`, **when** parsed, **then** it records `typstVersion`, `typstBinary` (asset name, download URL, tarball SHA-256, extracted binary SHA-256), `renderCiImage.plannedTag` (`ghcr.io/verasic-labs/usetagih-render-ci:2026-07-20`), and `renderCiImage.plannedDigest` placeholder (`null` until Story 1.4 builds the image); `fixtures` array is empty `[]` (populated in Stories 1.2–1.3).
5. **Given** `packages/render/src/typst-driver.ts`, **when** `compileTypst()` is invoked, **then** it spawns the Typst CLI at `TYPST_BINARY_PATH` (default `packages/render/.bin/typst` locally, `/usr/local/bin/typst` in CI Docker) with **`--ignore-system-fonts`**, **`--font-path`** pointing at `packages/render/fonts/`, and env **`SOURCE_DATE_EPOCH=1700000000`** (override via env only when explicitly set — default to `1700000000` for determinism).
6. **Given** root `.gitignore`, **when** inspected, **then** `packages/render/.bin/` is listed — the Typst **binary is never committed**; only `typst-version.txt` + checksums in `manifest.json`.
7. **Given** `packages/render/src/preamble.test.ts`, **when** `bun test` runs in `@usetagih/render`, **then** tests assert `packages/templates/_shared/preamble.typ` contains the substring `#set document(date: none)`, references Inter and JetBrains Mono font names, and does **not** embed system-date-dependent directives.
8. **Given** local linux x86_64 (WSL2 Ubuntu), **when** developer runs the local render smoke (Dev Notes §Local render smoke), **then** two consecutive compiles of the smoke fixture produce **byte-identical PDFs** (SHA-256 match).
9. **Given** existing workspace, **when** `bunx turbo run lint typecheck test build --force` runs from repo root, **then** all tasks exit 0.
10. **Out of scope (Stories 1.2+):** invoice template, golden fixtures/hashes, `golden:check` CLI, `Dockerfile.render-ci`, `pdf-golden.yml`, watermark footer, logo fixtures, determinism soak.

## Tasks / Subtasks

- [x] Task 1 — Pin Typst 0.15.1 and local binary bootstrap (AC: 1, 6)
  - [x] Create `packages/render/typst-version.txt` with content `0.15.1`
  - [x] Add `packages/render/.bin/` to root `.gitignore`
  - [x] Add `packages/render/scripts/install-typst-local.sh` (or `.ts`) that downloads `typst-x86_64-unknown-linux-musl.tar.xz` from `https://github.com/typst/typst/releases/download/v0.15.1/typst-x86_64-unknown-linux-musl.tar.xz`, extracts `typst` to `packages/render/.bin/typst`, marks executable — **script is committed; binary is not**
  - [x] Document one-liner install in Dev Notes; run once for local smoke
- [x] Task 2 — Vendor OFL font bundle (AC: 2)
  - [x] Download Inter 4.1 from `https://github.com/rsms/inter/releases/download/v4.1/Inter-4.1.zip`; copy from `extras/ttf/`: `Inter-Regular.ttf`, `Inter-Medium.ttf`, `Inter-SemiBold.ttf`, `Inter-Bold.ttf` → `packages/render/fonts/inter/`
  - [x] Copy `LICENSE.txt` from Inter zip → `packages/render/fonts/inter/LICENSE.txt`
  - [x] Download JetBrains Mono 2.304 from `https://github.com/JetBrains/JetBrainsMono/releases/download/v2.304/JetBrainsMono-2.304.zip`; copy from `fonts/ttf/`: `JetBrainsMono-Regular.ttf`, `JetBrainsMono-Bold.ttf` → `packages/render/fonts/jetbrains-mono/`
  - [x] Copy `OFL.txt` from JetBrains zip → `packages/render/fonts/jetbrains-mono/OFL.txt`
  - [x] Add `packages/render/fonts/README.md` documenting exact source URLs, versions, and vendored file list
- [x] Task 3 — Shared preamble (AC: 3)
  - [x] Create `packages/templates/_shared/preamble.typ` per exact specification in Dev Notes
  - [x] Update `packages/templates/README.md` to reference `_shared/preamble.typ` import pattern for Epic 1 templates
- [x] Task 4 — Manifest + typst driver (AC: 4, 5)
  - [x] Create `packages/render/manifest.json` per schema in Dev Notes; compute and record SHA-256 of tarball + extracted binary after local install
  - [x] Create `packages/render/src/typst-driver.ts` exporting `compileTypst`, `resolveTypstBinaryPath`, `DEFAULT_SOURCE_DATE_EPOCH`
  - [x] Re-export driver from `packages/render/src/index.ts` (replace or augment `RENDER_STUB` — stub may remain as deprecated alias if tests depend on it, but driver is primary export)
  - [x] Add `TYPST_BINARY_PATH` resolution: env var → default local `.bin/typst` → fallback `/usr/local/bin/typst`
  - [x] Update `packages/render/package.json` scripts: add `"render:smoke": "bun scripts/render-smoke.ts"` and `"install:typst": "bash scripts/install-typst-local.sh"` (names exact)
- [x] Task 5 — Bun tests (AC: 7)
  - [x] Create `packages/render/src/preamble.test.ts` reading preamble file from repo-relative path
  - [x] Keep/update `packages/render/src/index.test.ts` if stub export changes
- [x] Task 6 — Smoke fixture for local determinism (AC: 8)
  - [x] Create `packages/render/__fixtures__/smoke/hello.typ` importing preamble and rendering minimal "Hello usetagih" text
  - [x] Create `packages/render/scripts/render-smoke.ts` (or document shell commands) invoking driver twice, comparing SHA-256
- [x] Task 7 — Verification gate (AC: 9)
  - [x] Run local Typst install + render smoke (environment-gated if binary download blocked — document)
  - [x] Run `bun test` in `packages/render`
  - [x] Run `bunx turbo run lint typecheck test build --force` from repo root
  - [x] Record results in Dev Agent Record

## Dev Notes

### Goal

Land the **Typst 0.15.x toolchain pin**, **vendored OFL font bundle**, **deterministic shared preamble**, and **minimal Typst driver** — first story of Epic 1 (BLOCKING PDF pipeline spike gate). Epic 1 exit condition: any blocking AC failing in CI Docker halts Epics 2–8 and escalates to the board; **no Chromium or pixel-golden fallback** (AD-10, FR-7).

### Epic 1 context (cross-story sequencing)

| Story | Delivers | Depends on 1.1 |
| --- | --- | --- |
| 1.2 | `invoice/modern.typ` + basic fixture + golden hash | preamble + fonts + driver |
| 1.3 | `golden:check` CLI + manifest fixtures array | manifest schema + driver |
| 1.4 | `Dockerfile.render-ci` + `pdf-golden.yml` | typst pin + fonts + manifest digest field |
| 1.5–1.8 | Blocking spike fixtures (pagination, logo, SVG, soak) | full harness |
| 1.9 | SPIKE-RESULT.md + board escalation protocol | all above |

### Environment facts (do not guess)

| Fact | Value |
| --- | --- |
| Typst latest 0.15.x patch | **`0.15.1`** — verified via `curl -s https://api.github.com/repos/typst/typst/releases` filtering `tag_name` prefix `v0.15.`; latest = `v0.15.1` (2026-07-17), prior patch `v0.15.0` (2026-06-15) |
| Local platform | linux x86_64 (WSL2 Ubuntu) |
| Local Typst asset | `typst-x86_64-unknown-linux-musl.tar.xz` from release `v0.15.1` |
| Local binary path | `packages/render/.bin/typst` — **gitignored, never committed** |
| CI binary path (future 1.4) | `/usr/local/bin/typst` installed in `Dockerfile.render-ci` |
| `SOURCE_DATE_EPOCH` | **`1700000000`** — fixed for all CI and local smoke compiles (SOLUTION-DESIGN §3.2) |
| Inter source | [rsms/inter v4.1](https://github.com/rsms/inter/releases/tag/v4.1) — OFL-1.1 |
| JetBrains Mono source | [JetBrains/JetBrainsMono v2.304](https://github.com/JetBrains/JetBrainsMono/releases/tag/v2.304) — OFL-1.1 |
| Font weights required | Inter: Regular (400), Medium (500), SemiBold (600), Bold (700); JetBrains Mono: Regular (400), Bold (700) — per SOLUTION-DESIGN §3.3 and template typography needs |
| Turbo verification | **`bunx turbo run lint typecheck test build --force`** — Epic 0 retro action item; always use `--force` for story sign-off |
| `packages/templates/` | Non-workspace content directory (no `package.json`) — `.typ` files only |

### Current repo state (Epic 0 complete — do not re-bootstrap)

| Item | Current value | This story changes |
| --- | --- | --- |
| `packages/render/package.json` | stub scripts; no Typst deps | add driver; keep `bun test` |
| `packages/render/src/index.ts` | `RENDER_STUB` export | add typst driver exports |
| `packages/render/typst-version.txt` | **absent** | **NEW** |
| `packages/render/manifest.json` | **absent** | **NEW** |
| `packages/render/fonts/` | **absent** | **NEW** vendored TTFs + licenses |
| `packages/render/.bin/` | **absent** | **NEW** gitignored local binary |
| `packages/templates/_shared/preamble.typ` | **absent** | **NEW** |
| `packages/templates/README.md` | stub one-liner | update with preamble import docs |
| root `.gitignore` | no render `.bin` entry | add `packages/render/.bin/` |
| `docker/Dockerfile.render-ci` | **absent** | Story 1.4 — do not create |
| `.github/workflows/pdf-golden.yml` | **absent** | Story 1.4 — do not create |

### Exact `typst-version.txt`

File: `packages/render/typst-version.txt`

```
0.15.1
```

No `v` prefix. Bump requires manifest update + board awareness (SOLUTION-DESIGN §3.2).

### Exact `manifest.json` schema (Story 1.1 scope)

File: `packages/render/manifest.json`

```json
{
  "typstVersion": "0.15.1",
  "schemaVersion": "0.0.0",
  "typstBinary": {
    "asset": "typst-x86_64-unknown-linux-musl.tar.xz",
    "downloadUrl": "https://github.com/typst/typst/releases/download/v0.15.1/typst-x86_64-unknown-linux-musl.tar.xz",
    "tarballSha256": "<sha256-of-downloaded-tarball>",
    "binarySha256": "<sha256-of-extracted-typst-binary>"
  },
  "renderCiImage": {
    "plannedTag": "ghcr.io/verasic-labs/usetagih-render-ci:2026-07-20",
    "plannedDigest": null
  },
  "fixtures": []
}
```

- `tarballSha256` / `binarySha256`: compute after running install script; commit real hex values (lowercase, no prefix).
- `plannedDigest`: stays `null` until Story 1.4 builds and pushes the render-ci image.
- `fixtures[]`: populated in Stories 1.2–1.3 with `{ "file", "sha256", "typstVersion", "schemaVersion" }` entries.

### Exact `preamble.typ` specification

File: `packages/templates/_shared/preamble.typ`

```typst
// Shared deterministic preamble — import from templates via relative path.
// Fonts resolved via typst-driver --font-path packages/render/fonts/

#set document(date: none)

#let body-font = "Inter"
#let mono-font = "JetBrains Mono"

#set text(
  font: body-font,
  size: 10pt,
  leading: 0.65em,
)

#show raw: set text(font: mono-font, size: 9pt)
#show raw.where(block: true): set block(spacing: 0.65em)

// Typography weight helpers for templates (Story 1.2+)
#let font-regular = "Inter"
#let font-medium = "Inter Medium"
#let font-semibold = "Inter SemiBold"
#let font-bold = "Inter Bold"
#let mono-regular = "JetBrains Mono"
#let mono-bold = "JetBrains Mono Bold"
```

**Determinism requirements encoded:**
- `#set document(date: none)` — fixes Typst 0.15+ timezone leak (pre-0.15 leaked local timezone even with `SOURCE_DATE_EPOCH`; fixed in 0.15.0 per SOLUTION-DESIGN §1.2).
- Font names match vendored TTF family names (Inter subfamilies use space-separated weight names in Typst).
- No `#datetime.today()`, no `#sys.version`, no network calls.

**Template import pattern (for Story 1.2):**

```typst
#import "../_shared/preamble.typ": *
```

### Font directory layout (committed)

```
packages/render/fonts/
├── README.md
├── inter/
│   ├── Inter-Regular.ttf
│   ├── Inter-Medium.ttf
│   ├── Inter-SemiBold.ttf
│   ├── Inter-Bold.ttf
│   └── LICENSE.txt
└── jetbrains-mono/
    ├── JetBrainsMono-Regular.ttf
    ├── JetBrainsMono-Bold.ttf
    └── OFL.txt
```

### `typst-driver.ts` contract

File: `packages/render/src/typst-driver.ts`

**Exports:**

| Export | Purpose |
| --- | --- |
| `DEFAULT_SOURCE_DATE_EPOCH` | `1700000000` constant |
| `resolveTypstBinaryPath()` | `process.env.TYPST_BINARY_PATH` → `packages/render/.bin/typst` (if exists) → `/usr/local/bin/typst` |
| `resolveFontPath()` | absolute path to `packages/render/fonts/` |
| `compileTypst(options)` | spawn Typst compile with determinism flags |

**`compileTypst` options:**

```typescript
type CompileTypstOptions = {
  inputPath: string;       // .typ file
  outputPath: string;      // .pdf (or .svg in future stories)
  format?: "pdf" | "svg";  // default "pdf"
  fontPath?: string;       // default resolveFontPath()
  extraArgs?: string[];    // future --input json=...
};
```

**Spawn requirements (non-negotiable):**

```typescript
const env = {
  ...process.env,
  SOURCE_DATE_EPOCH: process.env.SOURCE_DATE_EPOCH ?? String(DEFAULT_SOURCE_DATE_EPOCH),
};

const args = [
  "compile",
  "--ignore-system-fonts",
  "--font-path", fontPath,
  ...(format === "svg" ? ["--format", "svg"] : []),
  inputPath,
  outputPath,
  ...extraArgs,
];
```

Use `Bun.spawn` or `child_process.spawnSync` with `stdio: "pipe"`; throw on non-zero exit with stderr attached.

### Smoke fixture

File: `packages/render/__fixtures__/smoke/hello.typ`

```typst
#import "../../../../templates/_shared/preamble.typ": *

= Hello usetagih

Smoke test for deterministic PDF output.
```

Adjust import path to resolve correctly from fixture location (use relative path that works when compile cwd is repo root or fixture dir — **driver must document/respect working directory**; recommend compiling with absolute paths).

### Local render smoke verification

**Prerequisites:** run install script once to populate `packages/render/.bin/typst`.

```bash
# From repo root
bun run --filter @usetagih/render scripts/render-smoke.ts
# OR manual:
SOURCE_DATE_EPOCH=1700000000 \
  packages/render/.bin/typst compile \
  --ignore-system-fonts \
  --font-path packages/render/fonts \
  packages/render/__fixtures__/smoke/hello.typ \
  /tmp/usetagih-smoke-1.pdf

SOURCE_DATE_EPOCH=1700000000 \
  packages/render/.bin/typst compile \
  --ignore-system-fonts \
  --font-path packages/render/fonts \
  packages/render/__fixtures__/smoke/hello.typ \
  /tmp/usetagih-smoke-2.pdf

sha256sum /tmp/usetagih-smoke-1.pdf /tmp/usetagih-smoke-2.pdf
# Hashes MUST match byte-for-byte
```

Required `package.json` scripts (Task 4):

```json
{
  "install:typst": "bash scripts/install-typst-local.sh",
  "render:smoke": "bun scripts/render-smoke.ts"
}
```

**Font discovery check** (after vendoring, before smoke):

```bash
SOURCE_DATE_EPOCH=1700000000 packages/render/.bin/typst fonts --font-path packages/render/fonts | grep -E 'Inter|JetBrains'
```

If family names differ from preamble literals, update `preamble.typ` to match `typst fonts` output — do not guess.

### Bun test specification

File: `packages/render/src/preamble.test.ts`

**Must assert:**

1. File `packages/templates/_shared/preamble.typ` exists (resolve via `import.meta.dir` + relative path up to repo root, or `path.join` from known anchor).
2. Content includes exact substring `#set document(date: none)`.
3. Content includes `"Inter"` and `"JetBrains Mono"`.
4. Content does **not** include `#datetime.today` or `sys.version`.

Use `import { expect, test } from "bun:test"`.

### Architecture compliance

- **AD-3:** Typst 0.15.x exact patch; `--ignore-system-fonts`; vendored fonts only; `SOURCE_DATE_EPOCH=1700000000`; preamble `#set document(date: none)`.
- **AD-10:** Epic 1 is blocking gate — this story establishes foundation; do not implement Chromium/pixel fallback paths.
- **AD-1:** `packages/core` must **not** depend on `@usetagih/render` — no changes to core in this story.
- **Hexagonal:** driver lives in `packages/render`; API wiring is Epic 3.
- **NFR-4:** no secrets in committed files.

### Testing Requirements

Run from repo root; all must exit 0:

```bash
# 1. Install local Typst (once, environment-gated if network blocked)
bash packages/render/scripts/install-typst-local.sh

# 2. Package tests
bun test packages/render

# 3. Full workspace gate (--force mandatory)
bunx turbo run lint typecheck test build --force

# 4. Local render smoke (after binary install)
bun run --filter @usetagih/render render:smoke
# or manual sha256 compare per §Local render smoke
```

### Anti-patterns (do not do)

- Do **not** commit `packages/render/.bin/typst` or any Typst binary to git.
- Do **not** use system fonts or omit `--ignore-system-fonts`.
- Do **not** pin Typst 0.13.x or 0.14.x — board re-pinned to 0.15.x (ARCHITECTURE-SPINE AD-3).
- Do **not** implement golden harness, Docker render-ci, or invoice template — Stories 1.2–1.4.
- Do **not** add Chromium, Playwright PDF, or pixel-diff golden fallback.
- Do **not** vendor entire Inter/JetBrains font families — only the 6 TTFs listed.
- Do **not** add new npm dependencies unless strictly required for spawn/path (prefer Bun builtins).

### Previous epic learnings (Epic 0)

- Turbo cache can mask failures — always verify with `--force` (Epic 0 retro).
- Environment-gated steps (Doppler login, Docker daemon) must be documented separately from always-required greps/tests.
- `@usetagih/config/env` pattern: source TS exports, bun test colocated — follow same pattern in `@usetagih/render`.
- Commit-msg hook is wired — follow verasic commit protocol; verify trailer clean after commit.

### Project Structure Notes

- `packages/render/` is workspace member `@usetagih/render`; `packages/templates/` is **not** a workspace package.
- Preamble lives in templates (content); fonts live in render (toolchain) — driver passes `--font-path` to bridge them.
- Future `golden:check` reads `manifest.json` from `packages/render/manifest.json` (canonical path established here).

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story-1.1]
- [Source: _bmad-output/planning-artifacts/architecture/architecture-usetagih-2026-07-20/ARCHITECTURE-SPINE.md#AD-3]
- [Source: _bmad-output/planning-artifacts/architecture/architecture-usetagih-2026-07-20/SOLUTION-DESIGN.md#§1.2, §3.2, §3.3]
- [Source: _bmad-output/implementation-artifacts/epic-0-retro-2026-07-20.md — turbo --force]
- [Source: packages/render/package.json — current stub]
- [Source: packages/templates/README.md — current stub]
- [Typst v0.15.1 release](https://github.com/typst/typst/releases/tag/v0.15.1)
- [Inter v4.1 release](https://github.com/rsms/inter/releases/tag/v4.1)
- [JetBrains Mono v2.304 release](https://github.com/JetBrains/JetBrainsMono/releases/tag/v2.304)

## Dev Agent Record

### Agent Model Used

Composer 2.5 Fast

### Debug Log References

- Typst 0.15.1 tarball extracts to `typst-x86_64-unknown-linux-musl/typst` (not version-prefixed path)
- Typst 0.15 sandbox requires `--root` set to repo root for cross-package imports
- `#set text(leading: ...)` removed in Typst 0.15; preamble uses `#set par(leading: 0.65em)` instead
- Smoke fixture import path: `../../../templates/_shared/preamble.typ` (relative from fixture dir)

### Completion Notes List

- Pinned Typst 0.15.1 with install script, manifest checksums, and gitignored local binary
- Vendored Inter 4.1 (4 weights) + JetBrains Mono 2.304 (2 weights) with OFL licenses (~2.2M total)
- Added deterministic preamble, typst driver with `--ignore-system-fonts`, `--font-path`, `SOURCE_DATE_EPOCH=1700000000`
- Render smoke: consecutive compiles produce identical SHA-256 `1fb48bb3c1606e06378955b310c7c93bf4b9ffa486283fcaee9fd396068da93b`
- `bun test packages/render`: 3 pass, 0 fail
- `bunx turbo run lint typecheck test build --force`: 36/36 tasks successful

### File List

- `.gitignore` (modified — add `packages/render/.bin/`)
- `_bmad-output/implementation-artifacts/sprint-status.yaml` (modified — story → review)
- `_bmad-output/implementation-artifacts/1-1-pin-typst-0-15-x-font-bundle-and-shared-preamble.md` (modified)
- `packages/render/typst-version.txt` (new)
- `packages/render/manifest.json` (new)
- `packages/render/package.json` (modified — install:typst, render:smoke scripts)
- `packages/render/scripts/install-typst-local.sh` (new)
- `packages/render/scripts/render-smoke.ts` (new)
- `packages/render/src/typst-driver.ts` (new)
- `packages/render/src/index.ts` (modified — driver exports)
- `packages/render/src/preamble.test.ts` (new)
- `packages/render/__fixtures__/smoke/hello.typ` (new)
- `packages/render/fonts/README.md` (new)
- `packages/render/fonts/inter/Inter-Regular.ttf` (new)
- `packages/render/fonts/inter/Inter-Medium.ttf` (new)
- `packages/render/fonts/inter/Inter-SemiBold.ttf` (new)
- `packages/render/fonts/inter/Inter-Bold.ttf` (new)
- `packages/render/fonts/inter/LICENSE.txt` (new)
- `packages/render/fonts/jetbrains-mono/JetBrainsMono-Regular.ttf` (new)
- `packages/render/fonts/jetbrains-mono/JetBrainsMono-Bold.ttf` (new)
- `packages/render/fonts/jetbrains-mono/OFL.txt` (new)
- `packages/templates/_shared/preamble.typ` (new)
- `packages/templates/README.md` (modified)

### Change Log

- 2026-07-20: Story 1.1 — pin Typst 0.15.1 toolchain, vendored fonts, shared preamble, typst driver, smoke harness
- 2026-07-20: Code review APPROVED — determinism probes (mtime touch, no-env SOURCE_DATE_EPOCH), manifest checksums, turbo 36/36 green

### Code Review Record

- **Verdict:** APPROVED
- **Reviewed commit:** `600dd8c`
- **Determinism:** smoke double-render, post-touch third render, and driver-without-shell-SOURCE_DATE_EPOCH all produce SHA-256 `1fb48bb3c1606e06378955b310c7c93bf4b9ffa486283fcaee9fd396068da93b`
- **Manifest:** binary SHA-256 and tarball SHA-256 match recomputed values; `typst --version` = `0.15.1`
- **Findings:** none blocking; optional future hardening — install script could verify tarball against manifest before extract

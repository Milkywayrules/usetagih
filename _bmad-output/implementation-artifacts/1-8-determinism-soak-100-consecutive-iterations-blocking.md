---
baseline_commit: 234a911
---

# Story 1.8: Determinism soak ≥100 consecutive iterations (blocking)

Status: done

<!-- Ultimate context engine analysis completed - comprehensive developer guide created -->

## Story

As a CI engineer,
I want `golden:soak --iterations 100` with zero hash drift in CI Docker,
so that flake and float instability is caught (AD-10 blocking #5, NFR-6).

## Acceptance Criteria

1. **Given** Story 1.7 complete (`golden:soak` scaffold from Story 1.3, five manifest fixtures, `pdf-golden.yml` runs `golden:check` in `usetagih-render-ci:ci`), **when** `packages/render/scripts/golden-soak.ts` is extended with repeatable `--fixture <id>` flags, **then** omitting `--fixture` soaks **all** manifest fixtures (local dev default unchanged); passing one or more `--fixture` soaks only those ids; unknown id exits **1** with stderr listing valid ids; usage documents both flags.
2. **Given** soak completes successfully, **when** stdout is read, **then** each fixture line matches `SOAK PASS ${id}: ${iterations} iterations, hash ${sha256}, ${durationMs}ms` and a final summary line matches `SOAK SUMMARY: ${fixtureCount} fixture(s), ${iterations} iteration(s) each, ${totalDurationMs}ms total` (new — enables CI baseline tracking without parsing per-fixture lines only).
3. **Given** hash drift on iteration *i*, **when** soak runs, **then** exit **1** with existing drift report (`FAIL ${id}`, iteration number, first vs actual hash) — unchanged behavior from Story 1.3; triggers spike exit condition (AD-10).
4. **Given** `.github/workflows/pdf-golden.yml`, **when** workflow runs after this story, **then** a **Determinism soak** step executes **after** the existing Golden check step, reusing the **same** in-job image `usetagih-render-ci:ci` (no second build), with `SOURCE_DATE_EPOCH=1700000000`, invoking exactly:

   ```bash
   bun run --filter @usetagih/render golden:soak --iterations 100 \
     --fixture invoice-modern-basic \
     --fixture invoice-modern-pagination-25
   ```

   **And** the step records wall-clock duration to `$GITHUB_STEP_SUMMARY` as `golden:soak wall_ms=<N>` (milliseconds, integer) plus echoes the same line to job log stdout.
5. **Given** CI soak command above, **when** it completes in CI Docker, **then** all **100** iterations produce identical SHA-256 per fixture: basic `b11be4533d38f525326164b530a143bd71270440dc4b98f42cec426f2d3a105c`, pagination `d19dd496ed850cea10f8f50146812c4541fc811f075553222b432e6e691cc584`; non-zero exit fails the job and spike gate.
6. **Given** committed PDF goldens from Stories 1.2–1.7, **when** this story merges, **then** no `.sha256` files, `manifest.json` hash fields, or golden PDF bytes change — soak is read-only render + compare; **do not** run `golden:update`.
7. **Given** workspace, **when** `bunx turbo run lint typecheck test build --force` runs from repo root, **then** all tasks exit 0; new unit tests cover `--fixture` arg parsing and fixture filtering logic (pure — no Typst required).
8. **Given** local Docker available, **when** verification runs `docker build -f docker/Dockerfile.render-ci -t usetagih-render-ci:local .` then in-container soak with `--iterations 100` on the two CI fixtures, **then** exit 0, zero drift, duration recorded in Dev Agent Record (actual `SOAK SUMMARY` ms + optional `wall_ms` from host `time`).
9. **Given** soak or `golden:check` failure in `pdf-golden.yml`, **when** job fails, **then** spike exit condition applies — halt Epics 2–8 per AD-10.
10. **Out of scope (Story 1.9, Epic 2+):** `SPIKE-RESULT.md`, `spike:gate` turbo script, changing `golden:check` triple-hash logic, adding new fixtures, logo-fixture soak in CI (logo fixtures remain in default all-fixtures local soak only), preview/SVG work, schema package.

## Tasks / Subtasks

- [x] Task 1 — Extend `golden-soak.ts` CLI (AC: 1, 2, 3)
  - [x] Parse `--iterations N` (default **5**, unchanged) and repeatable `--fixture <id>`
  - [x] Filter manifest entries when `--fixture` provided; validate ids exist
  - [x] Emit final `SOAK SUMMARY: …` line after all fixtures pass
  - [x] Update usage string on invalid args
- [x] Task 2 — Unit tests for soak arg/filter logic (AC: 7)
  - [x] Export `parseGoldenSoakArgs()` (or test via small pure module) from soak script pattern used elsewhere
  - [x] Cases: default all fixtures, single `--fixture`, multiple `--fixture`, unknown id error
- [x] Task 3 — Wire CI soak step (AC: 4, 5, 9)
  - [x] Add step to `.github/workflows/pdf-golden.yml` after Golden check; reuse `usetagih-render-ci:ci`
  - [x] Append `golden:soak wall_ms=…` to `$GITHUB_STEP_SUMMARY`
- [x] Task 4 — Verification gate (AC: 6, 7, 8)
  - [x] Rebuild `usetagih-render-ci:local`; run CI-equivalent soak command with `--iterations 100`
  - [x] Confirm `golden:check` still passes all 5 fixtures (no golden drift)
  - [x] `bunx turbo run lint typecheck test build --force`
  - [x] Record durations + hashes in Dev Agent Record

## Dev Notes

### Goal

Deliver **AD-10 blocking #5** — 100-iteration determinism soak in authoritative CI Docker on **basic + pagination** fixtures, with fixture filtering for AC letter compliance while preserving all-fixtures default for local dev. Eighth story of Epic 1. Unblocks Story 1.9 (`SPIKE-RESULT.md` requires all blocking ACs including soak).

### Epic 1 context (cross-story sequencing)

| Story | Delivers | Depends on 1.8 |
| --- | --- | --- |
| 1.8 | **this story** — CI soak 100× on basic + pagination | 1.3 soak scaffold, 1.4 pdf-golden workflow, 1.5 pagination fixture |
| 1.9 | SPIKE-RESULT.md + spike gate docs | **this soak step passing in CI** |

### Fixture-filter decision (encoded — do not re-debate)

| Option | Decision | Rationale |
| --- | --- | --- |
| Soak all 5 fixtures in CI | **Rejected for CI** | AC letter: "basic + pagination fixtures" only; logo fixtures (PNG/JPEG/SVG) add decode work without extra determinism signal for float flake |
| Soak only 2 in CI, all 5 locally by default | **Chosen** | Matches AC; keeps Story 1.3 local default (`golden:soak` no args → all fixtures, 5 iterations) |
| `--fixture` flag | **Add** (repeatable) | Same pattern as `render-fixture.ts --fixture <name>`; CI passes two flags explicitly |

**Timing rationale (Story 1.3 baseline + estimates):**

| Context | Measurement | Extrapolation to 100×2 fixtures |
| --- | --- | --- |
| Story 1.3 Dev Agent Record | ~**97 ms** for **5** iterations × **1** fixture (host) | ~19 ms/iter basic → ~1.9 s for 100× basic |
| Pagination fixture | ~3 pages vs 1 | ~3–5× basic per iter → ~6–10 s for 100× pagination |
| **CI Docker (2 fixtures)** | Not yet measured at story creation | **~12–20 s** wall expected — well under typical job budget |
| All 5 fixtures × 100 | Would be ~50–100 s | Unnecessary for AC; available locally via default soak |

Implementer **must** record actual `SOAK SUMMARY` and host `wall_ms` in Dev Agent Record after local container run.

### Environment facts (do not guess)

| Fact | Value |
| --- | --- |
| Baseline commit (Story 1.7 done) | `234a911` |
| Typst version | `0.15.1` |
| Basic fixture id | `invoice-modern-basic` |
| Pagination fixture id | `invoice-modern-pagination-25` |
| Basic golden hash (**must match every soak iter**) | `b11be4533d38f525326164b530a143bd71270440dc4b98f42cec426f2d3a105c` |
| Pagination golden hash (**must match every soak iter**) | `d19dd496ed850cea10f8f50146812c4541fc811f075553222b432e6e691cc584` |
| CI in-job image tag | `usetagih-render-ci:ci` (built once per job) |
| Local Docker image tag | `usetagih-render-ci:local` |
| Soak default iterations (no flag) | **5** (Story 1.3 — unchanged) |
| CI iterations | **100** (this story) |
| Turbo verification | `bunx turbo run lint typecheck test build --force` |
| Spike exit condition | Soak drift or workflow failure halts Epics 2–8 (AD-10) |

### Current `golden-soak.ts` state (Story 1.3 — extend, do not rewrite)

```typescript
// packages/render/scripts/golden-soak.ts — today
function parseArgs(argv: string[]): { iterations: number } {
  // only --iterations N, default 5
}
// loops ALL manifest.fixtures — no filter
// logs: SOAK PASS ${id}: ${iterations} iterations, hash ${firstHash}, ${durationMs}ms
// no SOAK SUMMARY line yet
```

**Reuse:** `loadManifest`, `renderFixtureFromManifest`, temp cleanup in `finally`, drift fail-fast logic — **preserve**.

### Exact CLI specification (implement verbatim)

**Usage:**

```
bun scripts/golden-soak.ts [--iterations N] [--fixture <id>]...

Options:
  --iterations N   Consecutive renders per fixture (default: 5)
  --fixture <id>   Limit to manifest fixture id; repeat for multiple (default: all fixtures)
```

**Examples:**

```bash
# Local dev — all fixtures, 5 iterations (unchanged default)
bun run --filter @usetagih/render golden:soak

# CI-equivalent — basic + pagination only, 100 iterations
bun run --filter @usetagih/render golden:soak --iterations 100 \
  --fixture invoice-modern-basic \
  --fixture invoice-modern-pagination-25

# Single fixture probe
bun run --filter @usetagih/render golden:soak --iterations 10 --fixture invoice-modern-basic
```

**Parse rules:**

1. Collect all `--fixture` values in order (dedupe optional — if duplicate id, soak once is fine).
2. If `fixtureIds.length === 0` → `entries = manifest.fixtures` (all).
3. Else → `entries = fixtureIds.map(id => manifest.fixtures.find(f => f.id === id))`; if any `undefined` → stderr `unknown fixture: ${id}` + list valid ids → exit **1**.
4. If `iterations < 1` or non-integer → usage error exit **1**.

**Suggested parseArgs return type:**

```typescript
type GoldenSoakArgs = {
  iterations: number;
  fixtureIds: string[]; // empty = all
};

function parseGoldenSoakArgs(argv: string[]): GoldenSoakArgs;
function resolveSoakEntries(
  manifest: GoldenManifest,
  fixtureIds: string[],
): GoldenFixtureEntry[];
```

Place pure helpers in `packages/render/src/golden/soak-args.ts` (or co-locate in `manifest.ts` if minimal) — **test the pure functions**, keep script thin.

**Stdout contract (after success):**

```
SOAK PASS invoice-modern-basic: 100 iterations, hash b11be4533d38f525326164b530a143bd71270440dc4b98f42cec426f2d3a105c, 1842ms
SOAK PASS invoice-modern-pagination-25: 100 iterations, hash d19dd496ed850cea10f8f50146812c4541fc811f075553222b432e6e691cc584, 9124ms
SOAK SUMMARY: 2 fixture(s), 100 iteration(s) each, 10966ms total
```

**Drift stderr (unchanged shape):**

```
FAIL invoice-modern-basic
  drift at iteration 42
  first hash: b11be453…
  actual: …
```

### Exact `.github/workflows/pdf-golden.yml` change

Insert **after** the existing `Golden check in render-ci container` step, **before** job end:

```yaml
      - name: Determinism soak in render-ci container
        run: |
          set -o pipefail
          SOAK_START=$(date +%s%3N)
          docker run --rm \
            -e SOURCE_DATE_EPOCH=1700000000 \
            usetagih-render-ci:ci \
            bun run --filter @usetagih/render golden:soak --iterations 100 \
              --fixture invoice-modern-basic \
              --fixture invoice-modern-pagination-25
          SOAK_EXIT=$?
          SOAK_END=$(date +%s%3N)
          SOAK_WALL_MS=$((SOAK_END - SOAK_START))
          echo "golden:soak wall_ms=${SOAK_WALL_MS}" | tee -a "${GITHUB_STEP_SUMMARY:-/dev/stdout}"
          exit "${SOAK_EXIT}"
```

**Notes:**

- **Do not** rebuild the Docker image — reuse `usetagih-render-ci:ci` from prior step (same job).
- `date +%s%3N` works on GitHub `ubuntu-latest`; for local YAML sanity check, step is CI-only.
- Container stdout already includes per-fixture ms + `SOAK SUMMARY`; workflow adds host wall_ms including container startup overhead (~100–300 ms).
- Non-zero soak exit must fail the step (`set -o pipefail` + explicit `exit ${SOAK_EXIT}`).

### Local verification commands (mandatory before merge)

```bash
# 1. Rebuild image (workspace baked into image — rebuild after code changes)
docker build -f docker/Dockerfile.render-ci -t usetagih-render-ci:local .

# 2. Golden check unchanged
docker run --rm -e SOURCE_DATE_EPOCH=1700000000 usetagih-render-ci:local \
  bun run --filter @usetagih/render golden:check

# 3. CI-equivalent soak (record SOAK SUMMARY + wall time)
/usr/bin/time -f 'host wall_s=%e' docker run --rm -e SOURCE_DATE_EPOCH=1700000000 usetagih-render-ci:local \
  bun run --filter @usetagih/render golden:soak --iterations 100 \
    --fixture invoice-modern-basic \
    --fixture invoice-modern-pagination-25

# 4. Default local soak still works (5 iter, all fixtures)
bun run --filter @usetagih/render golden:soak

# 5. Turbo gate
bunx turbo run lint typecheck test build --force

# 6. Optional: docker builder prune -f (disk hygiene per Story 1.4)
```

### Golden stability plan (mandatory)

| Rule | Action |
| --- | --- |
| Soak renders to `.tmp/{id}-soak-{i}.pdf` only | **No** committed artifact changes |
| `manifest.json` / `__fixtures__/golden/*.sha256` | **Untouched** |
| `golden:check` after soak work | Must pass all **5** fixtures in CI Docker |
| If PDF hashes drift during dev | **Stop** — fix determinism regression; never `golden:update` to silence soak |

### Architecture compliance

- **NFR-6:** Golden-file determinism enforced in CI; soak catches iteration-level flake.
- **AD-10 blocking #5:** ≥100 consecutive identical hashes in CI Docker; failure reopens engine decision.
- **SOLUTION-DESIGN §3.5:** pdf-golden job includes `golden:soak --iterations 100` after `golden:check` — adapt build+run pattern from Story 1.4 (not GHCR pull).
- **FR-7:** Byte-identical output requirement stress-tested across iterations.

### Anti-patterns (do not do)

- Do **not** run `golden:update` or change committed hashes for this story.
- Do **not** soak logo fixtures in CI (AC specifies basic + pagination only).
- Do **not** rebuild Docker image twice in the same workflow job.
- Do **not** change `golden:check` behavior or pagination/page-count tests from Story 1.5/1.7.
- Do **not** add fixtures to manifest.
- Do **not** implement `SPIKE-RESULT.md` — Story 1.9.
- Do **not** remove default all-fixtures soak behavior (breaks Story 1.3 local dev contract).

### Previous story intelligence

**Story 1.3:**

- Created `golden-soak.ts` with `--iterations` default 5, all-fixtures loop, per-fixture duration log.
- Host timing ~97 ms / 5 iter / 1 fixture — use for extrapolation only; container is authoritative.
- Story 1.8 explicitly deferred to this story.

**Story 1.4:**

- `pdf-golden.yml` builds `usetagih-render-ci:ci` in-job; soak step slots **after** `golden:check`.
- `SOURCE_DATE_EPOCH=1700000000` required on every container run.

**Story 1.5:**

- Pagination fixture id `invoice-modern-pagination-25`; hash `d19dd496…`; 3 PDF pages.

**Story 1.7:**

- Preview work must not alter PDF bytes — `golden:check` 5/5 must stay green after 1.8.

### Project Structure Notes

```
packages/render/
├── scripts/
│   └── golden-soak.ts              # MODIFY — --fixture filter + SOAK SUMMARY
├── src/golden/
│   ├── soak-args.ts                # NEW (recommended) — parseGoldenSoakArgs, resolveSoakEntries
│   └── soak-args.test.ts           # NEW — pure arg/filter tests
.github/workflows/
└── pdf-golden.yml                  # MODIFY — add Determinism soak step
```

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story-1.8]
- [Source: _bmad-output/planning-artifacts/architecture/architecture-usetagih-2026-07-20/SOLUTION-DESIGN.md#§3.4–§3.5]
- [Source: _bmad-output/implementation-artifacts/1-3-golden-harness-cli-golden-check.md — golden-soak contract]
- [Source: _bmad-output/implementation-artifacts/1-4-ci-docker-render-ci-image-and-pdf-golden-workflow.md — pdf-golden build+run pattern]
- [Source: _bmad-output/implementation-artifacts/1-5-25-line-item-pagination-fixture-fr-8-blocking.md]
- [Source: packages/render/scripts/golden-soak.ts]
- [Source: packages/render/scripts/render-fixture.ts — --fixture flag pattern]
- [Source: .github/workflows/pdf-golden.yml]

## Dev Agent Record

### Agent Model Used

Composer 2.5 Fast (headless subagent)

### Debug Log References

- container 100× soak: basic hash `b11be4533d38f525326164b530a143bd71270440dc4b98f42cec426f2d3a105c` (9936ms), pagination hash `d19dd496ed850cea10f8f50146812c4541fc811f075553222b432e6e691cc584` (15051ms), `SOAK SUMMARY: 2 fixture(s), 100 iteration(s) each, 24995ms total`, host wall_s=27.65
- default all-fixtures probe (2 iter): 5 fixtures, `SOAK SUMMARY: 5 fixture(s), 2 iteration(s) each, 1630ms total`
- `golden:check` in container: 5/5 PASS, no golden drift
- `bunx turbo run lint typecheck test build --force`: 36/36 tasks exit 0

### Completion Notes List

- added `soak-args.ts` with `parseGoldenSoakArgs`, `resolveSoakEntries`, and `UnknownFixtureError`; seven unit tests cover default/all/single/multi/unknown-id paths
- extended `golden-soak.ts` with repeatable `--fixture`, final `SOAK SUMMARY` line, and unknown-id stderr listing valid ids
- wired Determinism soak step in `pdf-golden.yml` after golden:check, reusing `usetagih-render-ci:ci`, logging `golden:soak wall_ms=<N>` to step summary

### File List

- `.github/workflows/pdf-golden.yml` (modified)
- `packages/render/scripts/golden-soak.ts` (modified)
- `packages/render/src/golden/soak-args.ts` (new)
- `packages/render/src/golden/soak-args.test.ts` (new)
- `_bmad-output/implementation-artifacts/1-8-determinism-soak-100-consecutive-iterations-blocking.md` (modified)
- `_bmad-output/implementation-artifacts/sprint-status.yaml` (modified)

## Change Log

- 2026-07-20: CI determinism soak — `--fixture` filter, SOAK SUMMARY, pdf-golden workflow step (Story 1.8)
- 2026-07-20: code review — hardened `--fixture`/`--iterations` parsing, drift helper unit tests; APPROVED

## Code Review Record

- **Reviewed:** 2026-07-20 (headless adversarial, commit `1d17668` + review fixes)
- **Verdict:** APPROVED
- **Findings fixed:**
  - **medium:** `--fixture` / `--iterations` without values silently ignored → now exit 1 with usage
  - **medium:** `--fixture --iterations` treated flag as id → now rejected as invalid fixture
  - **low:** fractional `--iterations 1.5` truncated to 1 → now rejected
  - **low:** no unit coverage for drift stderr contract → `detectSoakHashDrift` + `formatSoakDriftReport` tested
- **Verified:** container soak 25× zero drift; golden:check 5/5; host 2-iter all-fixtures; turbo 36/36; workflow exit propagation; YAML parses

## Story Validation Record

- **Validated:** 2026-07-20 against `bmad-create-story/checklist.md`
- **Result:** PASS
- **Checks applied:** Epics AC coverage (pdf-golden soak step, `--iterations 100`, basic + pagination fixtures, identical SHA-256 all iterations, drift non-zero + spike exit, duration logged); fixture-filter decision with timing rationale; exact CLI `--fixture` repeatable syntax; exact workflow YAML with `GITHUB_STEP_SUMMARY` wall_ms; local container rebuild + verification commands; golden stability (no hash changes); reuse Story 1.3 soak scaffold; anti-patterns and Story 1.9 out-of-scope; turbo `--force` gate; unit test requirement for arg parsing

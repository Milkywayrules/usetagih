---
baseline_commit: 9a20e4e
---

# Story 1.9: Spike gate documentation and board escalation protocol

Status: done

<!-- Ultimate context engine analysis completed - comprehensive developer guide created -->

## Story

As a tech lead,
I want explicit spike pass/fail gate artifact,
so that agents know to halt when engine proof fails (AD-10).

## Acceptance Criteria

1. **Given** Stories 1.1–1.8 complete with local in-container evidence (see Dev Notes §Evidence snapshot), **when** `packages/render/SPIKE-RESULT.md` is committed, **then** it follows the **exact section order and field names** in Dev Notes §SPIKE-RESULT.md template — verdict `PASS (local-container-verified)`, date `2026-07-20`, typst `0.15.1` + binary SHA-256 `29273eaa04f6d00edd0c2bec578f565fc9c65be856bfbffc894567c68ed0b237`, container digest from local `usetagih-render-ci:local` inspect, hash manifest snapshot table for **all 5** fixtures copied from `manifest.json`, soak baseline numbers from Story 1.8 Dev Agent Record, machine-readable line `status: PASS` on its own line, evidence-source note documenting local-container verification + CI-pending first-push re-verify, and escalation protocol section for FAIL (halt Epics 2–8, board reopen, no Chromium fallback).
2. **Given** `SPIKE-RESULT.md` verdict is PASS, **when** `status:` line is read, **then** it is exactly `status: PASS` (case-sensitive value for parser tests; document human verdict separately as `PASS (local-container-verified)`).
3. **Given** no GitHub remote exists today, **when** `SPIKE-RESULT.md` is written, **then** CI run link field states `pending — first push re-verification` (not a fabricated URL); follow-up references Epic 0 retro action item "run first-push environment re-verification when remote exists" and Stories 0.4/0.5 environment-gated pattern.
4. **Given** `packages/render/README.md` (Story 1.4), **when** extended, **then** new **Spike gate** section states: FAIL → stop Epics 2–8, reopen PDF engine decision at board, **no Chromium or pixel-golden fallback** (AD-10); PASS → Epics 2+ unblocked; points to `SPIKE-RESULT.md` and `bun run --filter @usetagih/render spike:gate`.
5. **Given** `packages/render/scripts/spike-gate.ts`, **when** `bun run --filter @usetagih/render spike:gate` executes, **then** it reads `packages/render/SPIKE-RESULT.md`, parses the `status:` line, exits **0** on `PASS` with stdout `SPIKE GATE: PASS — Epics 2+ unblocked`, exits **1** on `FAIL` with stderr halt message `SPIKE GATE: FAIL — halt Epics 2–8; reopen PDF engine decision at board; no Chromium fallback` and references `SPIKE-RESULT.md`.
6. **Given** `packages/render/package.json`, **when** scripts are inspected, **then** `"spike:gate": "bun scripts/spike-gate.ts"` exists alongside existing golden scripts.
7. **Given** optional turbo integration, **when** root `turbo.json` or package scripts are updated, **then** `spike:gate` is invocable via `bun run --filter @usetagih/render spike:gate` (no root turbo task required unless added as passthrough — document command in README; do **not** wire `spike:gate` into default CI merge gate until remote exists).
8. **Given** pure parser module (recommended `packages/render/src/golden/spike-gate.ts`), **when** `bun test` runs, **then** unit tests cover: parse `status: PASS` → pass, `status: FAIL` → fail, missing file → exit 1, missing `status:` line → exit 1, case-sensitive value enforcement (`status: pass` rejected).
9. **Given** workspace, **when** `bunx turbo run lint typecheck test build --force` runs from repo root, **then** all tasks exit 0; `spike:gate` exits 0 after SPIKE-RESULT.md committed with PASS.
10. **Given** local Docker available, **when** verification re-runs in-container `golden:check` + CI-equivalent soak, **then** evidence still holds (5/5 PASS, soak zero drift) — SPIKE-RESULT.md documents these commands; implementer records re-verify timestamps in Dev Agent Record.
11. **Out of scope (Epic 2+):** changing golden hashes, new fixtures, pdf-golden workflow edits, schema package, API endpoints, marking Epic 1 `done` in sprint-status (code-review / dev-story completion handles story done; epic done is separate board step).

## Tasks / Subtasks

- [x] Task 1 — Author `SPIKE-RESULT.md` (AC: 1, 2, 3)
  - [x] Create `packages/render/SPIKE-RESULT.md` from Dev Notes §SPIKE-RESULT.md template (fill with §Evidence snapshot values — do not invent numbers)
  - [x] Include machine-readable `status: PASS` line
  - [x] Document CI-pending follow-up per Epic 0 retro
- [x] Task 2 — Extend README spike gate section (AC: 4)
  - [x] Add **Spike gate** section with FAIL halt protocol + PASS unblock + `spike:gate` command
- [x] Task 3 — Implement `spike-gate.ts` + parser module (AC: 5, 8)
  - [x] Create `packages/render/src/golden/spike-gate.ts` with `parseSpikeStatus(markdown: string): "PASS" | "FAIL"` and `readSpikeResultStatus(path): "PASS" | "FAIL"`
  - [x] Create `packages/render/scripts/spike-gate.ts` thin CLI (exit codes + messages per AC)
  - [x] Create `packages/render/src/golden/spike-gate.test.ts`
- [x] Task 4 — Wire package script (AC: 6, 7)
  - [x] Add `"spike:gate"` to `packages/render/package.json`
- [x] Task 5 — Verification gate (AC: 9, 10)
  - [x] `bun run --filter @usetagih/render spike:gate` → exit 0
  - [x] Optional FAIL probe: temp edit `status: FAIL` → exit 1 with halt message → revert
  - [x] In-container `golden:check` + soak spot-check (or cite Story 1.8 recorded baselines if image unchanged)
  - [x] `bunx turbo run lint typecheck test build --force`
  - [x] Record verification in Dev Agent Record

## Dev Notes

### Goal

Deliver **Epic 1 exit artifact** — formal spike PASS documentation with board escalation protocol on FAIL, machine-readable gate for agents/turbo, and honest local-container evidence pending first-push CI re-verification. **Final story of Epic 1.** Unblocks Epic 2+ when PASS; on FAIL halts Epics 2–8 per AD-10.

### Epic 1 context (cross-story sequencing)

| Story | Delivers | Evidence for 1.9 |
| --- | --- | --- |
| 1.1 | Typst 0.15.1 pin, fonts, preamble | typst version + binary checksum in manifest |
| 1.2 | Basic fixture golden | manifest row `invoice-modern-basic` |
| 1.3 | golden harness CLI | reuse manifest.json as snapshot source |
| 1.4 | render-ci Docker + pdf-golden workflow | README base; CI environment-gated |
| 1.5 | Pagination 25-line fixture | manifest row + page count 3 |
| 1.6 | Logo PNG/JPEG/SVG determinism | 3 manifest rows; double-render tests pass |
| 1.7 | SVG preview page-count parity | basic 1==1, pagination 3==3 |
| 1.8 | Soak 100× basic + pagination | baseline ms in SPIKE-RESULT |
| **1.9** | **this story** — SPIKE-RESULT + spike:gate | aggregates all above |

### Evidence snapshot (copy into SPIKE-RESULT.md — do not guess)

| Field | Value |
| --- | --- |
| Human verdict | `PASS (local-container-verified)` |
| Machine status line | `status: PASS` |
| Date | `2026-07-20` |
| Typst version | `0.15.1` (`typst-version.txt`, `manifest.json`) |
| Typst binary SHA-256 | `29273eaa04f6d00edd0c2bec578f565fc9c65be856bfbffc894567c68ed0b237` |
| Local container image | `usetagih-render-ci:local` |
| Local container digest (inspect 2026-07-20) | `sha256:fec59812849c6903f4d55d54e3778a02f6afbcf1a1a884d59940939a0dc7d21a` |
| Planned GHCR tag (manifest) | `ghcr.io/verasic-labs/usetagih-render-ci:2026-07-20` |
| Planned digest (manifest `renderCiImage.plannedDigest`) | `sha256:30c6f288ef2234f48056faf227b5bb80c39eccac677fee22624f3773955b0a1d` |
| CI run link | `pending — first push re-verification` (no GitHub remote) |
| Golden check | 5/5 fixtures PASS in `usetagih-render-ci:local` with `SOURCE_DATE_EPOCH=1700000000` |
| Soak 100× (Story 1.8) | basic: 9936ms/100 iter, hash stable; pagination: 15051ms/100 iter, hash stable; `SOAK SUMMARY: 2 fixture(s), 100 iteration(s) each, 24995ms total`; zero drift |
| SVG preview parity | basic PDF pages 1 == SVG pages 1; pagination PDF pages 3 == SVG pages 3 |
| Logo determinism | PNG/JPEG/SVG consecutive double-render byte-identical per fixture |
| Baseline commit (Story 1.8 done) | `9a20e4e` |

**Honesty rule:** SPIKE-RESULT.md must **not** claim GitHub CI green or include a fake Actions URL. Local in-container runs use the **same** `docker/Dockerfile.render-ci` as CI — equivalent environment; first remote push re-verifies pdf-golden.yml per Epic 0 retro.

### SPIKE-RESULT.md template (implement verbatim structure)

Create `packages/render/SPIKE-RESULT.md` with these sections **in order**:

```markdown
# usetagih PDF pipeline spike result

status: PASS

## Verdict

PASS (local-container-verified)

## Date

2026-07-20

## Typst toolchain

| Field | Value |
| --- | --- |
| Version | 0.15.1 |
| Binary SHA-256 | 29273eaa04f6d00edd0c2bec578f565fc9c65be856bfbffc894567c68ed0b237 |
| Pin file | `typst-version.txt` |
| Determinism env | `SOURCE_DATE_EPOCH=1700000000`, `--ignore-system-fonts` |

## Container image

| Field | Value |
| --- | --- |
| Local image | `usetagih-render-ci:local` |
| Local digest | sha256:fec59812849c6903f4d55d54e3778a02f6afbcf1a1a884d59940939a0dc7d21a |
| Planned CI image | ghcr.io/verasic-labs/usetagih-render-ci:2026-07-20 |
| Planned digest (manifest) | sha256:30c6f288ef2234f48056faf227b5bb80c39eccac677fee22624f3773955b0a1d |
| Dockerfile | `docker/Dockerfile.render-ci` |

## CI run

| Field | Value |
| --- | --- |
| GitHub Actions run | pending — first push re-verification |
| Workflow | `.github/workflows/pdf-golden.yml` |
| Follow-up | Re-run pdf-golden on first push when remote exists (Epic 0 retro action item) |

## Hash manifest snapshot

Copied from `manifest.json` at spike gate time:

| Fixture ID | SHA-256 | Typst | Schema |
| --- | --- | --- | --- |
| invoice-modern-basic | b11be4533d38f525326164b530a143bd71270440dc4b98f42cec426f2d3a105c | 0.15.1 | 2026-07-20 |
| invoice-modern-pagination-25 | d19dd496ed850cea10f8f50146812c4541fc811f075553222b432e6e691cc584 | 0.15.1 | 2026-07-20 |
| invoice-modern-logo-png | 17d03365c73abe453099420cd495602383d7d008cb332d6c87e8d3d972517646 | 0.15.1 | 2026-07-20 |
| invoice-modern-logo-jpeg | c1ce18db9dfaf69056aa8a52765b4c812072314030b44afa90cc22fb0702ff56 | 0.15.1 | 2026-07-20 |
| invoice-modern-logo-svg | 8df87133dcd46622ca4ca0dd3b196a39f6e0ebe7ff1f28ff92657b873a1248d4 | 0.15.1 | 2026-07-20 |

## Blocking AC evidence

| AC | Story | Evidence |
| --- | --- | --- |
| Typst pin + fonts + preamble | 1.1 | typst 0.15.1; vendored fonts; preamble determinism directives |
| Basic golden | 1.2 | `invoice-modern-basic` hash stable |
| Golden harness | 1.3 | `golden:check` manifest-driven |
| CI Docker gate | 1.4 | `Dockerfile.render-ci`; pdf-golden workflow (environment-gated until remote) |
| 25-line pagination | 1.5 | 3 pages; hash stable |
| Logo determinism PNG/JPEG/SVG | 1.6 | double-render identical per format |
| SVG preview page parity | 1.7 | 1==1 basic; 3==3 pagination |
| Soak ≥100 iterations | 1.8 | basic 9936ms/100; pagination 15051ms/100; zero drift |

## Soak baseline (100 iterations, 2 fixtures)

| Fixture | Iterations | Duration | Hash (stable) |
| --- | --- | --- | --- |
| invoice-modern-basic | 100 | 9936ms | b11be4533d38f525326164b530a143bd71270440dc4b98f42cec426f2d3a105c |
| invoice-modern-pagination-25 | 100 | 15051ms | d19dd496ed850cea10f8f50146812c4541fc811f075553222b432e6e691cc584 |

## Evidence source

- **Primary:** local `docker run` inside `usetagih-render-ci:local` built from `docker/Dockerfile.render-ci` (linux/amd64 equivalent to CI job).
- **CI pending:** no GitHub remote at spike gate time; pdf-golden.yml re-verification required on first push (consistent with Epic 0 environment-gated AC pattern).
- **Advisory only:** host `golden:check` outside Docker may differ — not spike evidence.

## Escalation protocol (on FAIL)

If `status: FAIL` (future regression or CI failure after push):

1. **Halt** all Epic 2–8 implementation work immediately.
2. **Document** failure in this file: set `status: FAIL`, human verdict `FAIL`, CI run URL, failing command output summary.
3. **Escalate** to decision board to reopen PDF engine choice (Typst vs alternatives).
4. **Forbidden:** Chromium headless fallback, pixel-diff golden against HTML, silent engine swap (AD-10, FR-7).
5. **Re-run** `bun run --filter @usetagih/render spike:gate` — must exit 1 until PASS restored.

## Unblock statement

On `status: PASS`, Epic 2 (Canonical Schema) and downstream epics may proceed. Epic 1 remains `in-progress` until board marks epic done after optional CI re-verify.
```

**Parser contract:** `spike-gate` scans lines for first match `^status:\s*(PASS|FAIL)\s*$` (value case-sensitive). The `status:` line appears **after** the H1 title and **before** `## Verdict` — do not move it.

### README additions (`packages/render/README.md`)

Append section (preserve existing Golden checks content):

```markdown
## Spike gate (Epic 1 exit)

Epic 1 blocks all feature epics until the PDF pipeline spike passes in authoritative CI Docker (AD-10).

- **Artifact:** `SPIKE-RESULT.md` — verdict, toolchain pins, manifest snapshot, soak baselines.
- **Check:** `bun run --filter @usetagih/render spike:gate` — reads `status:` line; exit 0 on PASS, exit 1 on FAIL with halt message.

| Verdict | Action |
| --- | --- |
| **PASS** | Epics 2+ unblocked |
| **FAIL** | Stop Epics 2–8; reopen PDF engine decision at board; **no Chromium or pixel-golden fallback** |

Local `golden:check` outside CI Docker remains advisory (see above). SPIKE-RESULT records local-container evidence until first GitHub CI run confirms pdf-golden.yml.
```

### `spike-gate.ts` implementation spec

**Module:** `packages/render/src/golden/spike-gate.ts`

```typescript
export type SpikeStatus = "PASS" | "FAIL";

export class SpikeGateError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SpikeGateError";
  }
}

/** Parse first `status: PASS|FAIL` line (value case-sensitive). */
export function parseSpikeStatus(markdown: string): SpikeStatus;

/** Read file; throw SpikeGateError if missing or unparseable. */
export function readSpikeResultStatus(spikeResultPath: string): SpikeStatus;
```

**CLI:** `packages/render/scripts/spike-gate.ts`

- Default path: `resolve(PACKAGE_ROOT, "SPIKE-RESULT.md")` — reuse `PACKAGE_ROOT` from `render-fixture.ts` pattern.
- On PASS: stdout `SPIKE GATE: PASS — Epics 2+ unblocked`, exit 0.
- On FAIL: stderr `SPIKE GATE: FAIL — halt Epics 2–8; reopen PDF engine decision at board; no Chromium fallback\nSee packages/render/SPIKE-RESULT.md`, exit 1.
- On parse/read error: stderr message, exit 1.

**Package script:**

```json
"spike:gate": "bun scripts/spike-gate.ts"
```

**Turbo:** no change to default `lint|typecheck|test|build` pipeline required. Optional future root script `"spike:gate": "bun run --filter @usetagih/render spike:gate"` — out of scope unless trivial; README documents filter command.

### Unit tests (`spike-gate.test.ts`)

| Case | Input | Expected |
| --- | --- | --- |
| PASS line | `# title\n\nstatus: PASS\n\n## Verdict` | `"PASS"` |
| FAIL line | `status: FAIL` | `"FAIL"` |
| lowercase rejected | `status: pass` | throws |
| missing line | `# no status` | throws |
| extra whitespace OK | `status: PASS  ` | `"PASS"` (trim value) |

Use temp files for `readSpikeResultStatus` integration-style test.

### Local verification commands (mandatory before merge)

```bash
# 1. Spike gate (after SPIKE-RESULT.md committed)
bun run --filter @usetagih/render spike:gate

# 2. FAIL probe (revert after)
# sed -i 's/status: PASS/status: FAIL/' packages/render/SPIKE-RESULT.md
# bun run --filter @usetagih/render spike:gate; echo exit=$?
# git checkout -- packages/render/SPIKE-RESULT.md

# 3. Reconfirm golden evidence (optional if image unchanged since 1.8)
docker run --rm -e SOURCE_DATE_EPOCH=1700000000 usetagih-render-ci:local \
  bun run --filter @usetagih/render golden:check

# 4. Turbo gate
bunx turbo run lint typecheck test build --force
```

### Architecture compliance

- **AD-10:** Spike failure halts Epics 2–8; documented escalation; no Chromium fallback.
- **FR-7:** Manifest snapshot proves byte-identical golden corpus at gate time.
- **NFR-6:** Gate artifact ties CI golden enforcement to explicit PASS/FAIL for agents.
- **Epic 0 retro:** Environment-gated CI link honest; first-push re-verify documented.

### Anti-patterns (do not do)

- Do **not** fabricate a GitHub Actions run URL or claim CI green without remote.
- Do **not** change `manifest.json` fixture hashes or run `golden:update`.
- Do **not** add Chromium/puppeteer fallback language anywhere.
- Do **not** mark Epic 1 or Epic 2 `done`/`in-progress` in sprint-status from this story alone.
- Do **not** wire `spike:gate` into pdf-golden.yml until CI remote exists (optional follow-up).
- Do **not** weaken `status:` parser to accept lowercase `pass`/`fail`.

### Previous story intelligence

**Story 1.8:** Soak baselines (9936ms, 15051ms, 24995ms total); explicitly deferred SPIKE-RESULT + spike:gate to this story.

**Story 1.7:** Preview parity 1==1 and 3==3; PDF goldens unchanged.

**Story 1.6:** Logo double-render tests; three logo manifest entries.

**Story 1.4:** README golden vs CI advisory pattern — extend, do not replace.

**Epic 0 retro:** Environment-gated AC + first-push re-verification action items — cite in SPIKE-RESULT CI section.

### Project Structure Notes

```
packages/render/
├── SPIKE-RESULT.md                 # NEW — spike gate artifact
├── README.md                       # MODIFY — Spike gate section
├── package.json                    # MODIFY — spike:gate script
├── scripts/
│   └── spike-gate.ts               # NEW — CLI
└── src/golden/
    ├── spike-gate.ts               # NEW — parser
    └── spike-gate.test.ts          # NEW — unit tests
```

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story-1.9]
- [Source: _bmad-output/planning-artifacts/epics.md#Epic-1 — EXIT CONDITION]
- [Source: _bmad-output/implementation-artifacts/epic-0-retro-2026-07-20.md — environment-gated + first push]
- [Source: _bmad-output/implementation-artifacts/1-8-determinism-soak-100-consecutive-iterations-blocking.md — soak baselines]
- [Source: packages/render/manifest.json — hash snapshot source]
- [Source: packages/render/README.md — extend]
- [Source: packages/render/scripts/golden-check.ts — CLI/script patterns]
- [Source: docker/Dockerfile.render-ci]

## Dev Agent Record

### Agent Model Used

Composer 2.5 Fast

### Debug Log References

- container digest verified via `docker image inspect usetagih-render-ci:local --format '{{.Id}}'` → `sha256:fec59812849c6903f4d55d54e3778a02f6afbcf1a1a884d59940939a0dc7d21a` (matches Story 1.8 image; soak baselines cited from 1.8 Dev Agent Record)

### Completion Notes List

- authored `SPIKE-RESULT.md` with exact template section order, machine-readable `status: PASS`, local-container evidence, CI-pending note, 5-fixture manifest snapshot, soak baselines, escalation protocol
- extended `README.md` with Spike gate (Epic 1 exit) section per AD-10
- implemented `parseSpikeStatus` / `readSpikeResultStatus` parser + `spike-gate.ts` CLI with exit 0/1 messages per AC
- added 7 unit tests covering PASS, FAIL, lowercase rejection, missing line/file
- wired `spike:gate` script in `package.json`
- verification 2026-07-20: `spike:gate` exit 0; FAIL probe exit 1 with halt message; `bun test packages/render` 161 pass; `turbo run lint typecheck test build --force` 36/36 tasks green

### File List

- packages/render/SPIKE-RESULT.md (new)
- packages/render/README.md (modified)
- packages/render/package.json (modified)
- packages/render/scripts/spike-gate.ts (new)
- packages/render/src/golden/spike-gate.ts (new)
- packages/render/src/golden/spike-gate.test.ts (new)
- _bmad-output/implementation-artifacts/1-9-spike-gate-documentation-and-board-escalation-protocol.md (modified)
- _bmad-output/implementation-artifacts/sprint-status.yaml (modified)

## Change Log

- 2026-07-20: Epic 1 exit artifact — SPIKE-RESULT.md PASS gate, spike:gate CLI/parser, README escalation protocol
- 2026-07-20: code review APPROVED — evidence integrity verified, gates re-run green, epic 1 closed

## Code Review Record

- **Reviewed:** 2026-07-20 (headless, commit `d1f91d7`)
- **Verdict:** APPROVED
- **Evidence audit:** all SPIKE-RESULT claims match manifest, sha256 files, typst-version.txt, Story 1.8 soak baselines, local container digest; CI link honest (pending)
- **Gates re-run:** `spike:gate` exit 0; FAIL probe exit 1; `golden:check` 5/5 PASS; `turbo run lint typecheck test build --force` 36/36 green
- **Epic 1:** closed (`epic-1: done`)

## Story Validation Record

- **Validated:** 2026-07-20 against `bmad-create-story/checklist.md`
- **Result:** PASS
- **Checks applied:** Epics AC coverage (SPIKE-RESULT.md fields, README FAIL protocol, spike:gate script, PASS unblocks Epic 2+); honest local-container evidence + CI-pending note; exact SPIKE-RESULT template with manifest table (5 fixtures), soak baselines, escalation on FAIL; machine-readable `status:` line + parser tests; no fabricated CI URL; reuse manifest.json; anti-patterns; verification commands; turbo `--force` gate; Story 1.8/1.7/1.6 evidence cross-referenced; environment-gated Epic 0 retro alignment

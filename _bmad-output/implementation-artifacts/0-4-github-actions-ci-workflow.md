---
baseline_commit: 6d1ef7624938fb8d008aa6cbe8249ec6b5619c5e
---

# Story 0.4: GitHub Actions CI workflow

Status: done

<!-- Ultimate context engine analysis completed - comprehensive developer guide created -->

## Story

As a developer,
I want `.github/workflows/ci.yml` running lint, typecheck, unit tests, OpenAPI Spectral stub, and build,
so that every PR validates code quality before merge (AD CI seed, SOLUTION-DESIGN §10).

## Acceptance Criteria

1. **Given** Stories 0.1–0.3 complete (turbo pipelines green; `bun.lock` committed), **when** `.github/workflows/ci.yml` is added per Dev Notes, **then** workflow `name` is `CI`, triggers on `push` to branch `main` and on all `pull_request` events, and declares jobs `lint`, `typecheck`, `unit`, `build`, and `openapi-spectral`.
2. **Given** any CI job runs, **when** Bun is installed, **then** step uses `oven-sh/setup-bun@v2` with `bun-version: "1.2.18"` (matches root `packageManager` `bun@1.2.18` and `engines.bun` `>=1.2.0 <1.3.0`).
3. **Given** dependency install in CI, **when** each job runs after checkout, **then** `bun install --frozen-lockfile` executes and a cache step restores/saves `~/.bun/install/cache` keyed by `${{ runner.os }}-bun-${{ hashFiles('bun.lock') }}`.
4. **Given** job `lint`, **when** it completes, **then** it runs `bunx turbo run lint` (Biome via workspace scripts).
5. **Given** job `typecheck`, **when** it completes, **then** it runs `bunx turbo run typecheck`.
6. **Given** job `unit`, **when** it completes, **then** it runs `bunx turbo run test` (delegates to per-package `bun test`).
7. **Given** job `build`, **when** it completes, **then** it runs `bunx turbo run build`.
8. **Given** job `openapi-spectral`, **when** it runs before Epic 7, **then** it is a **placeholder** that exits 0 with a documented message — no Spectral CLI install, no spec file requirement yet (wired in Epic 7 Story 7.4).
9. **Given** no GitHub remote exists (repo is local-only today), **when** verification runs locally, **then** static YAML parse + command-parity turbo run pass; actual GitHub Actions runner execution is **environment-gated** until a remote is created and re-verified on first push.
10. **Given** existing workspace from Stories 0.1–0.3, **when** `bunx turbo run lint typecheck test build` runs from repo root after adding the workflow file, **then** all tasks still exit 0 (workflow YAML must not alter package graphs or scripts).
11. **Out of scope (Stories 0.5–0.6, Epic 1+):** GHCR docker-push workflow, `pdf-golden.yml`, Playwright e2e job, pg-boss worker-integration job, Doppler secrets, Coolify deploy hooks, production Dockerfiles — do not implement here.

## Tasks / Subtasks

- [x] Task 1 — Create `.github/workflows/ci.yml` (AC: 1–8)
  - [x] Add workflow header: `name: CI`, triggers (`push` → `main`, `pull_request`), optional `concurrency` group cancel-in-progress
  - [x] Define shared job pattern: `actions/checkout@v4` → `oven-sh/setup-bun@v2` (`bun-version: "1.2.18"`) → `actions/cache@v4` for `~/.bun/install/cache` → `bun install --frozen-lockfile` → turbo command
  - [x] Job `lint`: `bunx turbo run lint`
  - [x] Job `typecheck`: `bunx turbo run typecheck`
  - [x] Job `unit`: `bunx turbo run test`
  - [x] Job `build`: `bunx turbo run build`
  - [x] Job `openapi-spectral`: placeholder step documenting Epic 7 Spectral wiring; exit 0
  - [x] All jobs use `runs-on: ubuntu-latest`
- [x] Task 2 — Verification gate (AC: 9–10)
  - [x] Run static YAML parse (always required)
  - [x] Run command-parity: `bunx turbo run lint typecheck test build` (always required)
  - [x] Optionally run `actionlint` if binary present — skip with note if absent
  - [x] Mark GitHub runner execution environment-gated; document re-verify on first remote push
  - [x] Record results in Dev Agent Record

## Dev Notes

### Goal

Add the **primary CI workflow** per SOLUTION-DESIGN §10.1 (subset for Epic 0) so lint, typecheck, unit tests, and build run on every PR once a GitHub remote exists. Story 0.5 adds GHCR push; Epic 1 adds `pdf-golden.yml`; Epic 6 adds e2e; Epic 7 wires Spectral for real.

### Current repo state (Stories 0.1–0.3 landed — do not re-bootstrap)

| Item | Current value | This story changes |
| --- | --- | --- |
| `.github/` | **absent** | add `.github/workflows/ci.yml` only |
| Root `package.json` | `packageManager` `bun@1.2.18`; scripts delegate to turbo | unchanged |
| `turbo.json` | `lint`, `typecheck`, `test`, `build` pipelines; `typecheck`/`test` depend on `^build` | unchanged |
| `bun.lock` | committed | CI uses `--frozen-lockfile` |
| Workspace members | 9 packages (8 + `@usetagih/config`); all four turbo tasks green | must remain green |
| `docker/compose.yml` | Story 0.3 infra stack | **not** used in CI yet (e2e deferred Epic 6) |
| Git remotes | **none** — local-only repo | GitHub runner AC environment-gated |

### Environment facts (do not guess)

| Fact | Value |
| --- | --- |
| GitHub remote | **Does not exist** — no `origin`; epic AC "CI passes on main" requires remote + push |
| Local verification | YAML parse + turbo command-parity prove workflow intent until remote created |
| Bun pin | `packageManager: "bun@1.2.18"` in root `package.json`; `engines.bun: ">=1.2.0 <1.3.0"` |
| Turbo baseline | `bunx turbo run lint typecheck test build` → 36/36 tasks green (Story 0.3 verified) |
| Lockfile | `bun.lock` at repo root — required for `--frozen-lockfile` |
| actionlint | Optional — run only if `command -v actionlint` succeeds; do not add as repo dependency |

### Exact `.github/workflows/ci.yml` specification

File path: **`.github/workflows/ci.yml`**

```yaml
name: CI

on:
  push:
    branches:
      - main
  pull_request:

concurrency:
  group: ci-${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true

jobs:
  lint:
    name: lint
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v2
        with:
          bun-version: "1.2.18"
      - uses: actions/cache@v4
        with:
          path: ~/.bun/install/cache
          key: ${{ runner.os }}-bun-${{ hashFiles('bun.lock') }}
          restore-keys: |
            ${{ runner.os }}-bun-
      - run: bun install --frozen-lockfile
      - run: bunx turbo run lint

  typecheck:
    name: typecheck
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v2
        with:
          bun-version: "1.2.18"
      - uses: actions/cache@v4
        with:
          path: ~/.bun/install/cache
          key: ${{ runner.os }}-bun-${{ hashFiles('bun.lock') }}
          restore-keys: |
            ${{ runner.os }}-bun-
      - run: bun install --frozen-lockfile
      - run: bunx turbo run typecheck

  unit:
    name: unit
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v2
        with:
          bun-version: "1.2.18"
      - uses: actions/cache@v4
        with:
          path: ~/.bun/install/cache
          key: ${{ runner.os }}-bun-${{ hashFiles('bun.lock') }}
          restore-keys: |
            ${{ runner.os }}-bun-
      - run: bun install --frozen-lockfile
      - run: bunx turbo run test

  build:
    name: build
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v2
        with:
          bun-version: "1.2.18"
      - uses: actions/cache@v4
        with:
          path: ~/.bun/install/cache
          key: ${{ runner.os }}-bun-${{ hashFiles('bun.lock') }}
          restore-keys: |
            ${{ runner.os }}-bun-
      - run: bun install --frozen-lockfile
      - run: bunx turbo run build

  openapi-spectral:
    name: openapi (spectral placeholder)
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: OpenAPI Spectral placeholder (Epic 7)
        run: |
          echo "OpenAPI Spectral validation deferred to Epic 7 Story 7.4"
          echo "Future: @stoplight/spectral-cli with packages/schema/spectral.yaml"
          exit 0
```

**Notes on the spec:**

- Job IDs match architecture names where applicable; Spectral job ID is `openapi-spectral` with display name noting placeholder status.
- SOLUTION-DESIGN §10.1 also lists `e2e`, `worker-integration`, and `docker-push` jobs — **explicitly out of scope** for Story 0.4 (Epic 6, Epic 4, Story 0.5 respectively).
- Parallel jobs duplicate setup steps intentionally — standard GHA pattern; no composite action needed at this scale.
- Do **not** add `permissions:` block unless required — default read-only checkout is sufficient for these jobs.
- Do **not** cache `node_modules` — Bun install from lockfile + install cache is sufficient for this monorepo size.

### Architecture compliance

- **SOLUTION-DESIGN §10.1:** `ci.yml` with `lint`, `typecheck`, `unit`, `openapi` placeholder, `build` — subset implemented; deferred jobs documented.
- **SOLUTION-DESIGN §10.2:** `oven-sh/setup-bun@v2` with Bun 1.2.x pin (exact `1.2.18` matches repo).
- **SOLUTION-DESIGN §11.2:** CI on push to `main` precedes GHCR push (Story 0.5) and Coolify pull deploy (Epic 8) — workflow establishes quality gate first.
- **ARCHITECTURE-SPINE structural seed:** `.github/workflows/ci.yml` path listed in repo layout.
- **Epic 0 Story 0.4 AC:** lint, typecheck, unit (`bun test` via turbo), build (`turbo build`), Spectral placeholder.
- **NFR-4:** no secrets in workflow — none required for lint/typecheck/test/build stubs.

### Previous story intelligence (0.3)

- `bunx turbo run lint typecheck test build` is the canonical green gate — CI jobs must mirror these exact turbo invocations, not raw per-package loops.
- Biome excludes `_bmad-output` — workflow file under `.github/` is unaffected.
- Docker compose exists but CI does not start compose services in this story.
- Story 0.3 anti-pattern: do not add unrelated infra — same applies; CI YAML only.

### Git intelligence (recent commits)

| Commit | Relevance |
| --- | --- |
| `6d1ef76` | story 0-3 done — baseline for `baseline_commit` |
| `d69b945` | docker compose landed — out of CI scope here |
| `7c93172` | story 0-3 created — format reference for validation record |
| `7e31fdd` | shared config — turbo pipelines CI will exercise |

### Testing Requirements

Run from repo root.

#### Static — workflow YAML parse (always required)

```bash
test -f .github/workflows/ci.yml

# Python YAML parse (preferred — stdlib-safe on most Linux/WSL images)
python3 -c "
import sys
try:
    import yaml
except ImportError:
    sys.exit('PyYAML missing — install python3-yaml or use: pip install pyyaml')
yaml.safe_load(open('.github/workflows/ci.yml'))
print('YAML parse OK')
"

# Structural greps — job names and key pins
grep -q 'name: CI' .github/workflows/ci.yml
grep -q 'oven-sh/setup-bun@v2' .github/workflows/ci.yml
grep -q 'bun-version: "1.2.18"' .github/workflows/ci.yml
grep -q 'bun install --frozen-lockfile' .github/workflows/ci.yml
grep -q 'bunx turbo run lint' .github/workflows/ci.yml
grep -q 'bunx turbo run typecheck' .github/workflows/ci.yml
grep -q 'bunx turbo run test' .github/workflows/ci.yml
grep -q 'bunx turbo run build' .github/workflows/ci.yml
grep -q 'openapi-spectral:' .github/workflows/ci.yml
grep -q 'branches:' .github/workflows/ci.yml
grep -q 'main' .github/workflows/ci.yml
grep -q 'pull_request:' .github/workflows/ci.yml
grep -q '~/.bun/install/cache' .github/workflows/ci.yml
```

#### Command-parity (always required — proves what CI executes)

```bash
bunx turbo run lint typecheck test build
```

Expected: all tasks exit 0 (currently 36/36 workspace tasks).

#### Optional — actionlint (skip if not installed)

```bash
if command -v actionlint >/dev/null 2>&1; then
  actionlint .github/workflows/ci.yml
else
  echo "SKIP actionlint — not installed (optional per story scope)"
fi
```

#### Environment-gated — GitHub Actions runner (re-verify when remote exists)

```bash
# Preconditions: git remote add origin <url>; push branch main or open PR
# Expected: all jobs lint, typecheck, unit, build, openapi-spectral green on GitHub
echo "ENVIRONMENT-GATED — no GitHub remote configured at story creation time"
```

Re-run full GitHub verification after first `git push -u origin main` or first PR — record run URL in Dev Agent Record.

### Anti-patterns (do not do)

- Do **not** add `.github/workflows/docker-push.yml` or `pdf-golden.yml` (Stories 0.5, 1.4).
- Do **not** add Playwright/e2e or docker compose service startup in CI (Epic 6).
- Do **not** install Spectral CLI or fail CI on missing OpenAPI spec (Epic 7).
- Do **not** commit secrets, `GITHUB_TOKEN` overrides, or Doppler tokens.
- Do **not** change root `package.json` scripts or `turbo.json` unless a CI blocker forces it — prefer workflow-only diff.
- Do **not** use `npm`/`pnpm`/`yarn` — Bun-only monorepo.
- Do **not** pin `bun-version: "latest"` — must match `1.2.18`.
- Do **not** skip `--frozen-lockfile` in CI install step.

### Epic 0 cross-story context

| Story | Relationship |
| --- | --- |
| 0.5 | GHCR build-push workflow on `main`; depends on CI quality gate existing |
| 0.6 | Doppler/env schema — no CI secrets in this story |
| 1.4 | `pdf-golden.yml` separate workflow for render-ci container |
| 7.4 | Replaces `openapi-spectral` placeholder with real Spectral CLI job |

### Project Structure Notes

```text
.github/
└── workflows/
    └── ci.yml    # NEW — sole deliverable
```

No changes to `apps/`, `packages/`, `docker/`, or root toolchain files expected.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 0.4]
- [Source: _bmad-output/planning-artifacts/architecture/architecture-usetagih-2026-07-20/SOLUTION-DESIGN.md#10. CI (GitHub Actions)]
- [Source: _bmad-output/planning-artifacts/architecture/architecture-usetagih-2026-07-20/SOLUTION-DESIGN.md#11.2 Deploy Flow]
- [Source: _bmad-output/planning-artifacts/architecture/architecture-usetagih-2026-07-20/ARCHITECTURE-SPINE.md#Structural Seed]
- [Source: _bmad-output/implementation-artifacts/0-3-local-docker-compose-for-postgres-and-minio.md — turbo baseline, environment-gated pattern]
- [Source: package.json — packageManager bun@1.2.18]
- [Source: turbo.json — pipeline task graph]

## Dev Agent Record

### Agent Model Used

Composer 2.5 (headless dev subagent)

### Debug Log References

- Static YAML parse: `YAML parse OK`; structural greps all matched
- Command-parity: `bunx turbo run lint typecheck test build` → 36/36 tasks successful (FULL TURBO, exit 0)
- actionlint: skipped — binary not installed (optional per story scope)
- GitHub runner: ENVIRONMENT-GATED — no GitHub remote configured; re-verify on first `git push -u origin main` or first PR

### Completion Notes List

- Added `.github/workflows/ci.yml` per SOLUTION-DESIGN §10.1 subset: jobs `lint`, `typecheck`, `unit`, `build`, `openapi-spectral` (placeholder)
- Workflow triggers on `push` to `main` and all `pull_request` events; concurrency cancel-in-progress enabled
- Each job pins Bun 1.2.18 via `oven-sh/setup-bun@v2`, caches `~/.bun/install/cache` keyed by `bun.lock`, runs `bun install --frozen-lockfile`
- Turbo invocations mirror local green gate: `lint`, `typecheck`, `test`, `build`
- No changes to package graphs, scripts, or toolchain files

### File List

- `.github/workflows/ci.yml` (new)
- `_bmad-output/implementation-artifacts/0-4-github-actions-ci-workflow.md` (updated)
- `_bmad-output/implementation-artifacts/sprint-status.yaml` (updated)

## Story Validation Record

| Check | Result |
| --- | --- |
| Epic 0.4 AC coverage (lint, typecheck, unit, build, Spectral placeholder) | PASS |
| SOLUTION-DESIGN §10.1 job subset vs deferred jobs (e2e, docker-push) fenced | PASS |
| SOLUTION-DESIGN §10.2 Bun setup `oven-sh/setup-bun@v2` + 1.2.18 pin | PASS |
| Trigger config (`push` → `main`, `pull_request`) | PASS |
| Bun install cache strategy (`~/.bun/install/cache`, `bun.lock` hash key) | PASS |
| No GitHub remote — local verification protocol + environment-gated runner AC | PASS |
| Command-parity verification (`bunx turbo run lint typecheck test build`) | PASS |
| Zero-guess file path, job names, workflow YAML spec, verification commands | PASS |
| Stories 0.1–0.3 context + out-of-scope fence (0.5–0.6, Epic 1+) | PASS |
| Anti-patterns prevent scope creep (GHCR, pdf-golden, e2e, real Spectral) | PASS |

## Change Log

- 2026-07-20: story created and validated — ready for dev
- 2026-07-20: implemented CI workflow; local verification green; status → review
- 2026-07-20: code review approved; forced turbo 36/36 green; status → done

## Code Review Record

| Check | Result |
| --- | --- |
| AC 1–8 workflow structure, triggers, jobs, pins, cache, placeholder | PASS |
| AC 9 local YAML + turbo verification; GitHub runner environment-gated | PASS |
| AC 10 command-parity `bunx turbo run lint typecheck test build --force` | PASS — 36/36, 0 cached |
| AC 11 out-of-scope fence (GHCR, Doppler, e2e, real Spectral) | PASS |
| Dev cached turbo report suspicion | cleared — `--force` re-run uncached |
| actionlint | SKIP — not installed (optional) |

**Verdict:** APPROVED

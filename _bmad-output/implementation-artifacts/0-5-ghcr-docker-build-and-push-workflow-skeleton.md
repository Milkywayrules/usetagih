---
baseline_commit: 7a872472202c89823b8ec31eaec5fbb23792932d
---

# Story 0.5: GHCR Docker build-and-push workflow skeleton

Status: review

<!-- Ultimate context engine analysis completed - comprehensive developer guide created -->

## Story

As an operator,
I want GitHub Actions to build and push API/web/render-ci images to GHCR on main merge,
so that Coolify can pull prebuilt images (SOLUTION-DESIGN §11.2, deploy constraint).

## Acceptance Criteria

1. **Given** Stories 0.1–0.4 complete and stub Dockerfiles exist at `docker/Dockerfile.api`, `docker/Dockerfile.web`, and `docker/Dockerfile.render-ci`, **when** `.github/workflows/docker-publish.yml` is added per Dev Notes, **then** workflow `name` is `Docker Publish`, triggers on `push` to branch `main` and on `workflow_dispatch` with boolean input `dry_run` (default `false`).
2. **Given** any workflow run on `main` push with `dry_run=false`, **when** images are built and pushed, **then** three GHCR packages are published: `ghcr.io/verasic-labs/usetagih-api`, `ghcr.io/verasic-labs/usetagih-web`, `ghcr.io/verasic-labs/usetagih-render-ci`, each tagged with immutable `sha-${{ github.sha }}` (full commit SHA, no `:latest`, no date-only tags in this story).
3. **Given** `workflow_dispatch` with `dry_run=true`, **when** the workflow runs, **then** all three images build successfully but **no push** step executes (build-only dry-run per NFR-4 / epic AC).
4. **Given** the workflow file, **when** the header comment block is read, **then** it documents that production Coolify **never builds on the VPS** — it pulls prebuilt images from GHCR only (SOLUTION-DESIGN §11.2 step 3).
5. **Given** registry authentication, **when** push steps run, **then** workflow declares top-level `permissions: packages: write, contents: read`, logs in via `docker/login-action@v3` with `registry: ghcr.io`, `username: ${{ github.actor }}`, `password: ${{ secrets.GITHUB_TOKEN }}` — **no PATs, no committed tokens** (NFR-4).
6. **Given** repo grep for secrets, **when** verification runs, **then** no `ghp_`, `gho_`, `ghu_`, `ghs_`, `ghr_` tokens, no `secrets.GHCR_*` custom secrets, and no hardcoded registry passwords exist in tracked files touched by this story.
7. **Given** no GitHub remote exists (repo is local-only today), **when** verification runs locally, **then** static YAML parse + local `docker build` of each alpine stub Dockerfile pass; actual GHCR push and GitHub Actions runner execution are **environment-gated** until a remote is created and re-verified on first push to `main`.
8. **Given** local docker build verification on WSL (host `C:` ~2.2 GB free), **when** stub images are built, **then** builds use existing tiny alpine stubs only; verification script removes freshly built local tags and runs `docker builder prune -f` after success.
9. **Given** existing CI from Story 0.4, **when** `bunx turbo run lint typecheck test build` runs from repo root after adding workflow + render-ci stub, **then** all tasks still exit 0 (workflow must not alter package graphs or scripts).
10. **Out of scope (Stories 0.6, Epic 1+):** multi-stage production Dockerfiles (debian + Bun/Elysia/Next.js/Typst), `pdf-golden.yml`, Coolify deploy hooks, Doppler tokens, changing `ci.yml` to embed docker-push job, real Typst render-ci image (Epic 1 Story 1.4) — do not implement here.

## Tasks / Subtasks

- [x] Task 1 — Add `docker/Dockerfile.render-ci` alpine stub (AC: 1, prerequisite)
  - [x] Create minimal stub matching api/web pattern (`alpine:3.21`, idle CMD)
  - [x] Header comment: stub only — real debian+Typst image lands Epic 1 Story 1.4
  - [x] Do **not** install Typst, fonts, or Bun in this stub
- [x] Task 2 — Create `.github/workflows/docker-publish.yml` (AC: 1–5)
  - [x] Workflow header comment documenting Coolify pull-only deploy (§11.2)
  - [x] Triggers: `push` → `main`; `workflow_dispatch` input `dry_run` (boolean, default false)
  - [x] Top-level `permissions: packages: write, contents: read`
  - [x] Single job `publish` with matrix `image: [api, web, render-ci]` mapping to Dockerfiles and GHCR image names
  - [x] Steps: checkout → login to ghcr.io → setup docker buildx → build-push (push conditional on `dry_run != true`)
  - [x] Immutable tag expression: `sha-${{ github.sha }}` on all three images
  - [x] `runs-on: ubuntu-latest`; no Bun setup needed (docker-only workflow)
- [x] Task 3 — Verification gate (AC: 6–9)
  - [x] Static YAML parse + structural greps (always required)
  - [x] Local `docker build` for api, web, render-ci stubs (always required when daemon up)
  - [x] Post-build cleanup: `docker image rm` stub tags + `docker builder prune -f`
  - [x] Secret grep proof across repo / workflow
  - [x] Command-parity turbo run
  - [x] Mark GHCR push + GitHub runner environment-gated
  - [x] Record results in Dev Agent Record

## Dev Notes

### Goal

Add the **GHCR publish workflow skeleton** per SOLUTION-DESIGN §10.1 (`docker-push` job) and §11.2 deploy flow so Epic 8 Coolify can pull prebuilt `ghcr.io/verasic-labs/usetagih-*` images. This story wires build+push plumbing with **alpine stub Dockerfiles** — not production images.

### Render-ci stub decision (explicit)

| Decision | **Create `docker/Dockerfile.render-ci` as alpine stub in this story** |
| --- | --- |
| Rationale | Epic 0.5 AC requires all three Dockerfiles before the workflow runs; GHCR workflow must build/push `usetagih-render-ci`; SOLUTION-DESIGN §11.2 lists `Dockerfile.render-ci` alongside api/web; Story 0.3 deferred render-ci intentionally — 0.5 is the correct landing point for a **stub** only |
| Out of scope for stub | debian:bookworm-slim, pinned Typst 0.15.x `.deb`, vendored fonts, `SOURCE_DATE_EPOCH`, amd64 determinism — all Epic 1 Stories 1.1–1.4 |
| Epic 1 Story 1.4 | Replaces stub with real render-ci image; adds `.github/workflows/pdf-golden.yml` consuming `ghcr.io/verasic-labs/usetagih-render-ci:sha-<sha>` |

### Current repo state (Stories 0.1–0.4 landed — do not re-bootstrap)

| Item | Current value | This story changes |
| --- | --- | --- |
| `.github/workflows/ci.yml` | Story 0.4 — lint/typecheck/unit/build/openapi-spectral | **unchanged** — docker publish is separate workflow |
| `docker/Dockerfile.api` | alpine:3.21 stub, EXPOSE 3001 | unchanged (still stub; production multi-stage deferred) |
| `docker/Dockerfile.web` | alpine:3.21 stub, EXPOSE 3000 | unchanged |
| `docker/Dockerfile.render-ci` | **absent** | **NEW** alpine stub |
| `.github/workflows/docker-publish.yml` | **absent** | **NEW** |
| Git remotes | **none** — local-only repo | GHCR push AC environment-gated |
| Docker daemon (WSL) | running | local build verification OK |

### Environment facts (do not guess)

| Fact | Value |
| --- | --- |
| GitHub remote | **Does not exist** — no `origin`; GHCR push requires remote + `GITHUB_TOKEN` on runner |
| Local verification | YAML parse + `docker build` + tag-expression grep + secret grep; push is environment-gated |
| Disk pressure | Host `C:` ~2.2 GB free — **alpine stubs only**; mandatory cleanup after local builds |
| Docker daemon | Available in WSL — use `docker` (fallback `docker.exe` per Story 0.3 pattern) |
| Registry org | `verasic-labs` (lowercase GHCR namespace) |
| Immutable tags | `sha-<full-git-sha>` only in this story — no `:latest`, no floating date tags |
| Auth | `secrets.GITHUB_TOKEN` with `packages: write` — never commit PATs (NFR-4) |
| CI conventions | Story 0.4 uses `actions/checkout@v4`, concurrency groups — mirror where applicable |

### Exact `docker/Dockerfile.render-ci` specification

File path: **`docker/Dockerfile.render-ci`**

```dockerfile
# Stub placeholder — real debian+Typst CI image in Epic 1 Story 1.4 (SOLUTION-DESIGN §3.3)
FROM alpine:3.21
CMD ["sleep", "infinity"]
```

**Notes:**

- No `EXPOSE` — render-ci is a CI batch image, not a network service in stub form.
- Epic 1 replaces entire file with `debian:bookworm-slim` + pinned Typst + fonts copy.
- Keep image tiny for local verification under disk pressure.

### Exact `.github/workflows/docker-publish.yml` specification

File path: **`.github/workflows/docker-publish.yml`**

(SOLUTION-DESIGN §10.1 names the job `docker-push`; this story implements it as a **separate workflow file** — Story 0.4 explicitly fenced adding it to `ci.yml`.)

```yaml
# GHCR image publish — SOLUTION-DESIGN §10.1 (docker-push), §11.2 Deploy Flow
#
# Production Coolify NEVER builds on the VPS. Coolify pulls prebuilt images from GHCR only.
# See Epic 8 Story 8.1 for Coolify resource wiring.
#
# Images: ghcr.io/verasic-labs/usetagih-{api,web,render-ci}
# Tags:   sha-<full-commit-sha> (immutable; no :latest in this story)

name: Docker Publish

on:
  push:
    branches:
      - main
  workflow_dispatch:
    inputs:
      dry_run:
        description: Build only — skip GHCR push (local/manual verification)
        type: boolean
        default: false

permissions:
  contents: read
  packages: write

concurrency:
  group: docker-publish-${{ github.ref }}
  cancel-in-progress: true

jobs:
  publish:
    name: publish-${{ matrix.image }}
    runs-on: ubuntu-latest
    strategy:
      fail-fast: false
      matrix:
        include:
          - image: api
            dockerfile: docker/Dockerfile.api
            ghcr_name: usetagih-api
          - image: web
            dockerfile: docker/Dockerfile.web
            ghcr_name: usetagih-web
          - image: render-ci
            dockerfile: docker/Dockerfile.render-ci
            ghcr_name: usetagih-render-ci
    steps:
      - uses: actions/checkout@v4

      - name: Log in to GHCR
        if: ${{ github.event_name != 'workflow_dispatch' || !inputs.dry_run }}
        uses: docker/login-action@v3
        with:
          registry: ghcr.io
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}

      - name: Set up Docker Buildx
        uses: docker/setup-buildx-action@v3

      - name: Build and push
        uses: docker/build-push-action@v6
        with:
          context: .
          file: ${{ matrix.dockerfile }}
          push: ${{ github.event_name != 'workflow_dispatch' || !inputs.dry_run }}
          tags: ghcr.io/verasic-labs/${{ matrix.ghcr_name }}:sha-${{ github.sha }}
          provenance: false
```

On `push` to `main`, push and login run. On `workflow_dispatch` with `dry_run=true`, build only (no login, no push).

**Notes on the spec:**

- Matrix builds three images in parallel — matches SOLUTION-DESIGN §11.2 three-image list.
- `provenance: false` avoids extra attestations metadata on stub images (optional; keeps pushes simple).
- Do **not** add `oven-sh/setup-bun` — this workflow is docker-only.
- Do **not** embed docker-push into `ci.yml` — separate workflow per Story 0.4 out-of-scope fence.
- Tag format `sha-${{ github.sha }}` satisfies immutable tag AC; Epic 1 `pdf-golden.yml` will reference the same scheme (architecture example date tag is illustrative only).

### Architecture compliance

- **SOLUTION-DESIGN §10.1:** `docker-push` job — build + push three GHCR images on `main` merge.
- **SOLUTION-DESIGN §11.2:** Deploy flow step 2 (GHA builds/pushes) + step 3 (Coolify pull-only, never VPS build) — document in workflow header.
- **SOLUTION-DESIGN §6 repo layout:** `docker/Dockerfile.{api,web,render-ci}` + `.github/workflows/` — render-ci stub added here; `pdf-golden.yml` deferred Epic 1.
- **Epic 0 Story 0.5 AC:** three images, immutable tags, Coolify doc, dry-run/manual dispatch, NFR-4.
- **NFR-4:** no secrets in repo — `GITHUB_TOKEN` is runner-provided, not committed.

### Previous story intelligence (0.4)

- `.github/workflows/ci.yml` exists with Bun 1.2.18 pin — docker-publish workflow is independent; do not modify ci.yml.
- Story 0.4 environment-gated pattern: no GitHub remote → local static + command verification; re-verify on first push.
- Story 0.4 anti-pattern explicitly named `.github/workflows/docker-push.yml` — this story uses **`docker-publish.yml`** (architecture §10.1 job name `docker-push`; filename chosen to distinguish from ci.yml and match sprint story key semantics).
- Turbo baseline: `bunx turbo run lint typecheck test build` → 36/36 tasks green — must remain green.

### Previous story intelligence (0.3)

- `docker/Dockerfile.api` and `docker/Dockerfile.web` are alpine:3.21 stubs — render-ci stub follows same pattern.
- Story 0.3 said render-ci deferred to 0.5/1.4 — **0.5 creates stub; 1.4 creates real image**.
- Docker resolver helper (`docker` vs `docker.exe`) applies to local verification.
- Disk pressure on host `C:` — alpine only, cleanup mandatory.

### Git intelligence (recent commits)

| Commit | Relevance |
| --- | --- |
| `7a87247` | story 0-4 done — baseline for `baseline_commit` |
| `00075aa` | ci.yml landed — naming/trigger conventions to mirror |
| `7109f8f` | story 0-4 created — format reference for validation record |
| `d69b945` | docker stubs api/web — render-ci stub extends set |

### Testing Requirements

Run from repo root.

#### Static — workflow YAML parse (always required)

```bash
test -f .github/workflows/docker-publish.yml
test -f docker/Dockerfile.render-ci

python3 -c "
import sys
try:
    import yaml
except ImportError:
    sys.exit('PyYAML missing — install python3-yaml or: pip install pyyaml')
yaml.safe_load(open('.github/workflows/docker-publish.yml'))
print('YAML parse OK')
"

# Structural greps
grep -q 'name: Docker Publish' .github/workflows/docker-publish.yml
grep -q 'branches:' .github/workflows/docker-publish.yml
grep -q 'main' .github/workflows/docker-publish.yml
grep -q 'workflow_dispatch:' .github/workflows/docker-publish.yml
grep -q 'dry_run:' .github/workflows/docker-publish.yml
grep -q 'packages: write' .github/workflows/docker-publish.yml
grep -q 'docker/login-action@v3' .github/workflows/docker-publish.yml
grep -q 'secrets.GITHUB_TOKEN' .github/workflows/docker-publish.yml
grep -q 'sha-\${{ github.sha }}' .github/workflows/docker-publish.yml
grep -q 'usetagih-api' .github/workflows/docker-publish.yml
grep -q 'usetagih-web' .github/workflows/docker-publish.yml
grep -q 'usetagih-render-ci' .github/workflows/docker-publish.yml
grep -q 'docker/Dockerfile.render-ci' .github/workflows/docker-publish.yml
grep -q 'never builds on the VPS\|NEVER builds on the VPS' .github/workflows/docker-publish.yml
```

#### Immutable tag scheme (always required)

```bash
grep -E 'tags:.*sha-\$\{\{ github\.sha \}\}' .github/workflows/docker-publish.yml
# Expect 1 match in build-push step (matrix applies per job)
```

#### Secret grep proof (always required)

```bash
# Must exit 1 (no matches) for committed secret patterns in workflow + docker stubs
! grep -rE 'gh[pousr]_[A-Za-z0-9]{20,}' .github/workflows/docker-publish.yml docker/Dockerfile.* 2>/dev/null
! grep -rE 'secrets\.GHCR_' .github/workflows/ 2>/dev/null
! grep -rE 'password:\s*[\"\'][^\"\']+[\"\']' .github/workflows/docker-publish.yml | grep -v GITHUB_TOKEN
echo "Secret grep OK"
```

#### Local docker build — alpine stubs (always required when daemon up)

```bash
resolve_docker() {
  if command -v docker >/dev/null 2>&1 && docker info >/dev/null 2>&1; then
    echo docker
  elif command -v docker.exe >/dev/null 2>&1 && docker.exe info >/dev/null 2>&1; then
    echo docker.exe
  else
    return 1
  fi
}

DOCKER=$(resolve_docker) || { echo "SKIP docker build — daemon unavailable"; exit 0; }

$DOCKER build -f docker/Dockerfile.api -t usetagih-api:verify-stub .
$DOCKER build -f docker/Dockerfile.web -t usetagih-web:verify-stub .
$DOCKER build -f docker/Dockerfile.render-ci -t usetagih-render-ci:verify-stub .

# Mandatory cleanup (disk pressure — host C: ~2.2 GB free)
$DOCKER image rm -f usetagih-api:verify-stub usetagih-web:verify-stub usetagih-render-ci:verify-stub
$DOCKER builder prune -f
echo "Docker stub builds OK + cleanup done"
```

#### Command-parity (always required)

```bash
bunx turbo run lint typecheck test build
```

Expected: all tasks exit 0 (currently 36/36 workspace tasks).

#### Optional — actionlint (skip if not installed)

```bash
if command -v actionlint >/dev/null 2>&1; then
  actionlint .github/workflows/docker-publish.yml
else
  echo "SKIP actionlint — not installed (optional per story scope)"
fi
```

#### Environment-gated — GHCR push + GitHub Actions runner

```bash
# Preconditions: git remote add origin <url>; push to main OR workflow_dispatch dry_run=false
# Expected: three images at ghcr.io/verasic-labs/usetagih-{api,web,render-ci}:sha-<sha>
echo "ENVIRONMENT-GATED — no GitHub remote configured at story creation time"
```

Re-run full GitHub verification after first `git push -u origin main` — record run URL in Dev Agent Record.

### Anti-patterns (do not do)

- Do **not** add multi-stage Bun/Next.js/Typst production Dockerfiles — stubs only.
- Do **not** install Typst or debian base in `Dockerfile.render-ci` — Epic 1 Story 1.4.
- Do **not** add `.github/workflows/pdf-golden.yml` — Epic 1 Story 1.4.
- Do **not** commit PATs, `GHCR_TOKEN`, or Doppler secrets.
- Do **not** use `:latest` or floating date-only tags — `sha-${{ github.sha }}` only.
- Do **not** modify `ci.yml` to embed docker-push — separate workflow file.
- Do **not** skip post-build `docker image rm` + `docker builder prune -f` during local verification.
- Do **not** use fat base images for stubs — alpine:3.21 only.

### Epic 0 cross-story context

| Story | Relationship |
| --- | --- |
| 0.4 | CI quality gate exists; docker-publish runs after merge to main (parallel concern) |
| 0.6 | Doppler/env schema — no registry secrets in repo |
| 1.4 | Replaces render-ci stub; adds pdf-golden.yml consuming GHCR render-ci image |
| 8.1 | Coolify pulls GHCR images — depends on this workflow being live on remote |

### Project Structure Notes

```text
.github/
└── workflows/
    ├── ci.yml                 # unchanged (Story 0.4)
    └── docker-publish.yml     # NEW — sole workflow deliverable

docker/
├── Dockerfile.api             # unchanged stub
├── Dockerfile.web             # unchanged stub
└── Dockerfile.render-ci       # NEW — alpine stub
```

No changes to `apps/`, `packages/`, or root toolchain files expected.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 0.5]
- [Source: _bmad-output/planning-artifacts/architecture/architecture-usetagih-2026-07-20/SOLUTION-DESIGN.md#10.1 CI]
- [Source: _bmad-output/planning-artifacts/architecture/architecture-usetagih-2026-07-20/SOLUTION-DESIGN.md#11.2 Deploy Flow]
- [Source: _bmad-output/planning-artifacts/architecture/architecture-usetagih-2026-07-20/SOLUTION-DESIGN.md#3.3 Font Pinning — render-ci real image spec]
- [Source: _bmad-output/implementation-artifacts/0-4-github-actions-ci-workflow.md — GHA conventions, environment-gated pattern]
- [Source: _bmad-output/implementation-artifacts/0-3-local-docker-compose-for-postgres-and-minio.md — docker stub pattern, disk/cleanup]
- [Source: docker/Dockerfile.api, docker/Dockerfile.web — existing stub pattern]

## Dev Agent Record

### Agent Model Used

Composer 2.5 (headless dev-story subagent)

### Debug Log References

- Static: YAML parse OK; all structural greps pass
- Secret grep: no ghp_/GHCR_ tokens; GITHUB_TOKEN only
- Docker: api/web/render-ci alpine stub builds OK; verify tags removed; builder prune reclaimed 21.21GB cache
- Turbo: 36/36 tasks green (FULL TURBO)
- ENVIRONMENT-GATED: no GitHub remote; GHCR push + GHA runner re-verify on first push to main

### Completion Notes List

- Added `docker/Dockerfile.render-ci` alpine:3.21 stub (Epic 1.4 replaces with debian+Typst)
- Added `.github/workflows/docker-publish.yml` — matrix publish job for api/web/render-ci with immutable `sha-${{ github.sha }}` tags, GITHUB_TOKEN auth, dry_run build-only dispatch
- Workflow header documents Coolify NEVER builds on VPS — pull-only from GHCR per SOLUTION-DESIGN §11.2
- Local verification complete; GHCR push environment-gated (no git remote)

### File List

- `.github/workflows/docker-publish.yml` (new)
- `docker/Dockerfile.render-ci` (new)
- `_bmad-output/implementation-artifacts/0-5-ghcr-docker-build-and-push-workflow-skeleton.md` (updated)
- `_bmad-output/implementation-artifacts/sprint-status.yaml` (updated)

## Story Validation Record

| Check | Result |
| --- | --- |
| Epic 0.5 AC coverage (three images, immutable tags, Coolify doc, dry-run, NFR-4) | PASS |
| Render-ci stub decision documented with rationale (stub now, real image Epic 1.4) | PASS |
| SOLUTION-DESIGN §10.1 docker-push + §11.2 deploy flow compliance | PASS |
| Exact file paths: `docker-publish.yml`, three Dockerfiles including new render-ci stub | PASS |
| Trigger config (`push` → `main`, `workflow_dispatch` + `dry_run`) | PASS |
| Tag scheme `sha-${{ github.sha }}` with grep verification command | PASS |
| Permissions + GHCR login via `GITHUB_TOKEN` only; secret grep proof | PASS |
| No GitHub remote — local YAML + docker build + cleanup protocol | PASS |
| Disk pressure: alpine stubs + mandatory `docker image rm` + `builder prune -f` | PASS |
| Stories 0.3–0.4 context + out-of-scope fence (production Dockerfiles, pdf-golden, ci.yml embed) | PASS |
| Zero-guess workflow YAML spec, matrix mapping, verification commands | PASS |

## Change Log

- 2026-07-20: story created and validated — ready for dev
- 2026-07-20: implemented GHCR docker-publish workflow skeleton + render-ci alpine stub; local verification pass; status → review

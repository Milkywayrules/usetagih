---
baseline_commit: f21d459
---

# Story 1.4: CI Docker render-ci image and pdf-golden workflow

Status: ready-for-dev

<!-- Ultimate context engine analysis completed - comprehensive developer guide created -->

## Story

As a CI engineer,
I want `docker/Dockerfile.render-ci` and `.github/workflows/pdf-golden.yml`,
so that golden checks run only in the authoritative linux/amd64 container (AD-3, SOLUTION-DESIGN §3.5).

## Acceptance Criteria

1. **Given** Story 1.3 complete (`golden:check` harness, manifest fixture `invoice-modern-basic`, hash `b11be4533d38f525326164b530a143bd71270440dc4b98f42cec426f2d3a105c`), **when** `docker/Dockerfile.render-ci` is read, **then** it replaces the Story 0.5 alpine stub with `FROM debian:bookworm-slim`, installs pinned Typst **0.15.1** from the official GitHub release **tar.xz** (not `.deb` — Typst publishes no `.deb` for 0.15.1; see Dev Notes §Typst install adaptation), verifies **both** tarball SHA-256 and extracted binary SHA-256 against values in `packages/render/manifest.json` `typstBinary`, installs `typst` to `/usr/local/bin/typst`, copies vendored fonts from `packages/render/fonts/` into the image, installs Bun **1.2.18** (matches root `packageManager`), copies monorepo slices required for `@usetagih/render` golden harness, runs `bun install --frozen-lockfile`, and sets `ENV SOURCE_DATE_EPOCH=1700000000`.
2. **Given** the real Dockerfile, **when** local verification runs (`docker build -f docker/Dockerfile.render-ci -t usetagih-render-ci:local .`), **then** build succeeds on linux/amd64; post-build cleanup runs **`docker builder prune -f` only** (do **not** `docker image rm usetagih-render-ci:local` — tag may be reused); no extra base images beyond `debian:bookworm-slim` and `oven/bun:1.2.18` (multi-stage COPY).
3. **Given** built image `usetagih-render-ci:local`, **when** `docker run --rm -e SOURCE_DATE_EPOCH=1700000000 usetagih-render-ci:local bun run --filter @usetagih/render golden:check` executes, **then** exit code is **0** and output confirms `invoice-modern-basic` hash `b11be4533d38f525326164b530a143bd71270440dc4b98f42cec426f2d3a105c`. If hash differs from committed golden (platform drift), run `golden:update` **inside the same container**, commit updated hashes with PR label `golden-update`, and document in Dev Agent Record — CI Docker hash is authoritative per AD-3.
4. **Given** `.github/workflows/pdf-golden.yml` added, **when** workflow triggers are read, **then** `pull_request` and `push` to `main` fire only when paths change under `packages/render/**`, `packages/templates/**`, `docker/Dockerfile.render-ci`, or `.github/workflows/pdf-golden.yml` (path filters on both events).
5. **Given** a workflow run (local YAML verification + environment-gated GitHub runner), **when** the `pdf-golden` job executes, **then** it **builds** `docker/Dockerfile.render-ci` in-job as `usetagih-render-ci:ci` (does **not** pull GHCR — PR branch Dockerfile is source of truth; see Dev Notes §Image acquisition), runs `bun run --filter @usetagih/render golden:check` inside that container with `SOURCE_DATE_EPOCH=1700000000`, and fails the job on non-zero exit.
6. **Given** `packages/render/README.md`, **when** the advisory section is read, **then** it states local host `golden:check` (outside this Docker image) is **advisory only**; authoritative golden contract is CI Docker per SOLUTION-DESIGN §3.2 and AD-3.
7. **Given** `.github/workflows/docker-publish.yml` (Story 0.5), **when** compared after this story, **then** matrix/context/tags for `render-ci` remain **`sha-${{ github.sha }}` immutable tags only** — no `:latest`, no date tag in publish workflow; real Dockerfile replaces stub automatically on next `main` push (environment-gated until remote exists).
8. **Given** workspace, **when** `bunx turbo run lint typecheck test build --force` runs from repo root, **then** all tasks exit 0 (workflow/Dockerfile changes must not break packages).
9. **Given** workflow YAML, **when** static parse runs locally (`python3 -c "import yaml; yaml.safe_load(open('.github/workflows/pdf-golden.yml'))"`), **then** parse succeeds with no errors.
10. **Out of scope (Stories 1.5–1.8):** `golden:soak --iterations 100` in CI, pagination/logo/SVG fixtures, `SPIKE-RESULT.md`, production api/web Dockerfiles, changing `ci.yml` job matrix, adding `:2026-07-20` floating tag to docker-publish.

## Tasks / Subtasks

- [ ] Task 1 — Replace `docker/Dockerfile.render-ci` (AC: 1, 2)
  - [ ] Remove alpine stub; implement exact Dockerfile spec in Dev Notes §Dockerfile.render-ci
  - [ ] Pin Typst tar.xz URL + dual sha256 from `manifest.json` `typstBinary`
  - [ ] COPY fonts + monorepo slices; `bun install --frozen-lockfile`
  - [ ] COPY Bun from `oven/bun:1.2.18`
- [ ] Task 2 — Add `.github/workflows/pdf-golden.yml` (AC: 4, 5, 9)
  - [ ] Path filters on PR + push main
  - [ ] Job: checkout → `docker build` → `docker run golden:check`
  - [ ] Header comment referencing AD-3 / §3.5; note GitHub runner environment-gated when no remote
- [ ] Task 3 — Document advisory-only local golden (AC: 6)
  - [ ] Create or extend `packages/render/README.md` with §Local vs CI golden authority
- [ ] Task 4 — Confirm docker-publish compatibility (AC: 7)
  - [ ] Verify `docker/Dockerfile.render-ci` path unchanged in matrix; no tag scheme edits required
  - [ ] Optional: update `manifest.json` `renderCiImage.plannedDigest` after first local build (lowercase hex or `sha256:…` digest string)
- [ ] Task 5 — Verification gate (AC: 2, 3, 8, 9)
  - [ ] `docker build` + in-container `golden:check` exit 0
  - [ ] `docker builder prune -f`
  - [ ] `bunx turbo run lint typecheck test build --force`
  - [ ] YAML parse + structural greps (no secrets)
  - [ ] Record results in Dev Agent Record

## Dev Notes

### Goal

Deliver the **authoritative render CI environment** — real `debian:bookworm-slim` image with pinned Typst + vendored fonts + Bun, plus `pdf-golden.yml` that runs Story 1.3's `golden:check` inside that image. Fourth story of Epic 1 (BLOCKING PDF spike). Unblocks Stories 1.5–1.7 (fixtures assume CI Docker) and establishes the contract local dev must not treat as optional once CI exists.

### Epic 1 context (cross-story sequencing)

| Story | Delivers | Depends on 1.4 |
| --- | --- | --- |
| 1.4 | **this story** — `Dockerfile.render-ci` + `pdf-golden.yml` | 1.3 golden harness |
| 1.5–1.7 | Blocking fixtures added to manifest | CI Docker for golden:check |
| 1.8 | CI soak `--iterations 100` in pdf-golden | render-ci image + workflow file |
| 1.9 | SPIKE-RESULT.md | all above |

### Environment facts (do not guess)

| Fact | Value |
| --- | --- |
| Baseline commit (Story 1.3 done) | `f21d459` |
| Docker daemon | **Running** in WSL2 — `docker` CLI works |
| Host disk | Windows `C:` ~**1.5 GB** free — avoid hoarding layers; **`docker builder prune -f` mandatory** after verification |
| Docker data disk | Ample internal space — full render-ci build is OK |
| GitHub remote | **None** — pdf-golden runner + GHCR push **environment-gated** (same pattern as Stories 0.4/0.5) |
| Bun pin | `bun@1.2.18` per root `package.json` `packageManager` |
| Typst pin | `0.15.1` per `typst-version.txt` and manifest |
| Committed golden hash | `b11be4533d38f525326164b530a143bd71270440dc4b98f42cec426f2d3a105c` |
| Turbo verification | `bunx turbo run lint typecheck test build --force` |
| typst-driver binary resolution | `/usr/local/bin/typst` when `.bin/typst` absent (Docker path) |

### Typst install adaptation (epic .deb → tar.xz)

| Epic AC wording | Actual Typst 0.15.1 release artifacts |
| --- | --- |
| "pinned Typst .deb with checksum verify" | **No `.deb` published.** No `x86_64-unknown-linux-gnu` tar.xz either. |
| **This story** | Official **`typst-x86_64-unknown-linux-musl.tar.xz`** — same asset as local `install-typst-local.sh` and `manifest.json` `typstBinary`. Musl static binary runs on `debian:bookworm-slim` (glibc). |
| Checksum guarantee | Identical to epic intent: download pinned release URL, verify **tarball** SHA-256, extract, verify **binary** SHA-256 before `install`. Values from manifest (do not recompute ad hoc): |

```json
"typstBinary": {
  "asset": "typst-x86_64-unknown-linux-musl.tar.xz",
  "downloadUrl": "https://github.com/typst/typst/releases/download/v0.15.1/typst-x86_64-unknown-linux-musl.tar.xz",
  "tarballSha256": "a6d077d0a95eed5a2eba715b2dae06be954f624ccbf85758a03f389ded33118c",
  "binarySha256": "29273eaa04f6d00edd0c2bec578f565fc9c65be856bfbffc894567c68ed0b237"
}
```

Extract directory: `typst-x86_64-unknown-linux-musl/typst` (same as `install-typst-local.sh`).

### Image acquisition strategy (pdf-golden vs docker-publish)

| Workflow | Strategy | Rationale |
| --- | --- | --- |
| **`pdf-golden.yml`** | **Build in-job** from `docker/Dockerfile.render-ci` → tag `usetagih-render-ci:ci` → `docker run … golden:check` | PR may change Dockerfile/fonts/harness before any GHCR push; authoritative environment must match **current tree**, not last `main` image. |
| **`docker-publish.yml`** | **Unchanged tag scheme** — push `ghcr.io/verasic-labs/usetagih-render-ci:sha-${{ github.sha }}` on `main` merge | Story 0.5 contract; Coolify/Epic 8 consume sha tags. Real Dockerfile replaces stub — no matrix edits. |
| **Do not** | Pull `ghcr.io/…/usetagih-render-ci:2026-07-20` in pdf-golden | `manifest.json` `renderCiImage.plannedTag` is planning reference only; publish workflow does not emit date tag. |
| **Do not** | Pull `sha-*` in pdf-golden | PR Dockerfile can diverge from merged SHA image. |

SOLUTION-DESIGN §3.5 shows `container: image: …:2026-07-20` — **adapt** to build+run pattern above; same authoritative linux/amd64 environment, clearer PR semantics.

### Bun-in-image approach

**Decision:** Multi-stage **COPY** from official `oven/bun:1.2.18` image (matches `ci.yml` `setup-bun` pin). Do not curl-install Bun in Debian layer (extra moving parts). Do not use alpine Bun stage mixed into runtime without pinning — `oven/bun:1.2.18` is the single Bun source.

```dockerfile
COPY --from=oven/bun:1.2.18 /usr/local/bin/bun /usr/local/bin/bun
```

Ensure `/usr/local/bin` is on `PATH`. Turbo is **not** required inside render-ci for `golden:check` — `bun run --filter @usetagih/render` uses workspace protocol from root install.

### Exact `docker/Dockerfile.render-ci` specification

File path: **`docker/Dockerfile.render-ci`** — **replaces entire stub**.

```dockerfile
# Authoritative render CI environment — AD-3, SOLUTION-DESIGN §3.3–§3.5
# Epic 1 Story 1.4 — replaces Story 0.5 alpine stub
FROM debian:bookworm-slim

ARG TYPST_VERSION=0.15.1
ARG TYPST_ASSET=typst-x86_64-unknown-linux-musl.tar.xz
# Pin from packages/render/manifest.json typstBinary — bump together with manifest
ARG TYPST_TARBALL_SHA256=a6d077d0a95eed5a2eba715b2dae06be954f624ccbf85758a03f389ded33118c
ARG TYPST_BINARY_SHA256=29273eaa04f6d00edd0c2bec578f565fc9c65be856bfbffc894567c68ed0b237

RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates curl xz-utils \
  && rm -rf /var/lib/apt/lists/*

RUN set -eux; \
  url="https://github.com/typst/typst/releases/download/v${TYPST_VERSION}/${TYPST_ASSET}"; \
  curl -fsSL -o /tmp/typst.tar.xz "${url}"; \
  echo "${TYPST_TARBALL_SHA256}  /tmp/typst.tar.xz" | sha256sum -c -; \
  tar -xJf /tmp/typst.tar.xz -C /tmp; \
  install -m 755 "/tmp/typst-x86_64-unknown-linux-musl/typst" /usr/local/bin/typst; \
  echo "${TYPST_BINARY_SHA256}  /usr/local/bin/typst" | sha256sum -c -; \
  rm -rf /tmp/typst.tar.xz "/tmp/typst-x86_64-unknown-linux-musl"

COPY --from=oven/bun:1.2.18 /usr/local/bin/bun /usr/local/bin/bun

ENV SOURCE_DATE_EPOCH=1700000000 \
  PATH="/usr/local/bin:${PATH}"

WORKDIR /workspace

# Monorepo slices for @usetagih/render golden harness (no apps/*)
COPY package.json bun.lock turbo.json ./
COPY packages/config packages/config
COPY packages/render packages/render
COPY packages/templates packages/templates

RUN bun install --frozen-lockfile

# Fonts vendored under packages/render/fonts/ (also copied via packages/render tree)
# typst-driver resolves fonts via packages/render/fonts relative to package root

CMD ["bash"]
```

**Build context:** repository root (`.`). **Platform:** `linux/amd64` (default on GitHub ubuntu-latest and WSL2 amd64).

### Exact `.github/workflows/pdf-golden.yml` specification

File path: **`.github/workflows/pdf-golden.yml`** (NEW)

```yaml
# PDF golden determinism gate — AD-3, SOLUTION-DESIGN §3.5
# Authoritative SHA-256 checks run ONLY inside Dockerfile.render-ci (linux/amd64).
# GitHub runner execution environment-gated until remote exists (Story 0.4 pattern).

name: PDF Golden

on:
  pull_request:
    paths:
      - "packages/render/**"
      - "packages/templates/**"
      - "docker/Dockerfile.render-ci"
      - ".github/workflows/pdf-golden.yml"
  push:
    branches:
      - main
    paths:
      - "packages/render/**"
      - "packages/templates/**"
      - "docker/Dockerfile.render-ci"
      - ".github/workflows/pdf-golden.yml"

concurrency:
  group: pdf-golden-${{ github.ref }}
  cancel-in-progress: true

jobs:
  pdf-golden:
    name: pdf-golden
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Build render-ci image
        run: docker build -f docker/Dockerfile.render-ci -t usetagih-render-ci:ci .

      - name: Golden check in render-ci container
        run: |
          docker run --rm \
            -e SOURCE_DATE_EPOCH=1700000000 \
            usetagih-render-ci:ci \
            bun run --filter @usetagih/render golden:check
```

**Notes:**

- No `container:` job key — image is built from current checkout in step 1.
- No GHCR login in this workflow.
- Story 1.8 adds soak step to this file — leave room in comments only; do not add soak now.

### `packages/render/README.md` advisory section

Create **`packages/render/README.md`** (package-level; distinct from `fonts/README.md`) with at minimum:

```markdown
## Golden checks: local vs CI

- **Authoritative:** `golden:check` inside the pinned `docker/Dockerfile.render-ci` image (linux/amd64), enforced by `.github/workflows/pdf-golden.yml`.
- **Advisory:** running `bun run --filter @usetagih/render golden:check` on the host (WSL/macOS/other Typst builds) may produce different PDF bytes due to platform/Typst build variance (see SOLUTION-DESIGN §3.2, typst/typst#7683). Use local runs for fast feedback only — merge gate is CI Docker.
- **Update golden hashes** only after visual review, inside CI Docker via `golden:update`, with PR label `golden-update`.
```

Include one-liner pointers to `manifest.json`, `typst-version.txt`, and `docker/Dockerfile.render-ci`.

### Current repo state (Stories 0.5, 1.1–1.3 — build on this)

| Item | State | This story changes |
| --- | --- | --- |
| `docker/Dockerfile.render-ci` | alpine:3.21 stub (`CMD sleep infinity`) | **REPLACE** with debian+Typst+fonts+Bun |
| `.github/workflows/pdf-golden.yml` | **absent** | **NEW** |
| `.github/workflows/docker-publish.yml` | matrix includes render-ci → `sha-${{ github.sha }}` | **unchanged** tags/context; builds real image after merge |
| `packages/render/manifest.json` | `typstBinary` musl checksums; `renderCiImage.plannedDigest: null` | optional digest update after build |
| `packages/render/README.md` | **absent** (only `fonts/README.md`) | **NEW** advisory doc |
| Golden harness | Story 1.3 — `golden:check`/`soak`/etc. | **consume** — do not rewrite harness logic |

### In-container verification command sequence

Local (Docker daemon required):

```bash
# 1. Build authoritative image
docker build -f docker/Dockerfile.render-ci -t usetagih-render-ci:local .

# 2. Golden check inside container (authoritative)
docker run --rm \
  -e SOURCE_DATE_EPOCH=1700000000 \
  usetagih-render-ci:local \
  bun run --filter @usetagih/render golden:check
# expect exit 0; hash b11be4533d38f525326164b530a143bd71270440dc4b98f42cec426f2d3a105c

# 3. Workspace gate (host)
bunx turbo run lint typecheck test build --force

# 4. YAML parse
python3 -c "import yaml; yaml.safe_load(open('.github/workflows/pdf-golden.yml'))"

# 5. Cleanup (mandatory — host C: disk pressure)
docker builder prune -f
# do NOT docker image rm usetagih-render-ci:local
```

### Architecture compliance

- **AD-3:** Typst 0.15.x pinned; `--ignore-system-fonts`; vendored fonts; CI Docker is authoritative for golden SHA-256.
- **AD-10:** No Chromium/pixel-golden — `golden:check` SHA-256 only (Story 1.3).
- **SOLUTION-DESIGN §3.2:** Local golden advisory; CI Docker contract.
- **SOLUTION-DESIGN §3.3:** debian:bookworm-slim + pinned Typst + fonts copy (adapted to tar.xz).
- **SOLUTION-DESIGN §3.5:** pdf-golden workflow on render/templates path changes.
- **NFR-6:** Determinism enforced at CI boundary.

### Anti-patterns (do not do)

- Do **not** keep alpine stub or install Typst via apt.
- Do **not** invent a `.deb` download URL — it does not exist for Typst 0.15.1.
- Do **not** pull GHCR image in pdf-golden (see §Image acquisition).
- Do **not** add `:latest` or `:2026-07-20` to docker-publish tags in this story.
- Do **not** add `golden:soak --iterations 100` — Story 1.8.
- Do **not** add pagination/logo/SVG fixtures — Stories 1.5–1.7.
- Do **not** embed secrets or PATs in workflow YAML.
- Do **not** skip `docker builder prune -f` after local Docker verification.
- Do **not** `docker image rm` the local test tag unless disk emergency — reuse `usetagih-render-ci:local`.

### Previous story intelligence

**Story 1.3:**

- `golden:check` triple-checks manifest vs `.sha256` file vs actual render.
- `typst-driver` resolves binary: `TYPST_BINARY_PATH` → `.bin/typst` → `/usr/local/bin/typst` — Docker uses last fallback.
- Payload `--input json=` paths must stay relative to template dir — unchanged.
- Default `golden:soak` iterations **5** locally; CI 100 is Story 1.8.

**Story 0.5:**

- docker-publish pushes `sha-${{ github.sha }}` only; GHCR push environment-gated without remote.
- Post-build cleanup pattern: `docker builder prune -f` after stub builds — same for real image.

**Story 0.4:**

- CI uses `oven-sh/setup-bun@v2` with `bun-version: "1.2.18"` — match in Docker.

### Project Structure Notes

```
docker/
└── Dockerfile.render-ci          # REPLACE stub → real CI image

.github/workflows/
├── ci.yml                        # unchanged
├── docker-publish.yml            # unchanged tag scheme; builds new Dockerfile on main
└── pdf-golden.yml                # NEW

packages/render/
├── README.md                     # NEW — local vs CI advisory
├── manifest.json                 # optional plannedDigest update
└── fonts/                        # copied into image via Dockerfile
```

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story-1.4]
- [Source: _bmad-output/planning-artifacts/architecture/architecture-usetagih-2026-07-20/SOLUTION-DESIGN.md#§3.2–§3.5]
- [Source: _bmad-output/planning-artifacts/architecture/architecture-usetagih-2026-07-20/ARCHITECTURE-SPINE.md#AD-3]
- [Source: _bmad-output/implementation-artifacts/1-3-golden-harness-cli-golden-check.md]
- [Source: _bmad-output/implementation-artifacts/0-5-ghcr-docker-build-and-push-workflow-skeleton.md]
- [Source: packages/render/manifest.json]
- [Source: packages/render/scripts/install-typst-local.sh]
- [Source: docker/Dockerfile.render-ci]
- [Source: .github/workflows/docker-publish.yml]

## Dev Agent Record

### Agent Model Used

_(filled by dev agent)_

### Debug Log References

### Completion Notes List

### File List

### Story Validation Record

- **Validated:** 2026-07-20 against `bmad-create-story/checklist.md`
- **Result:** PASS
- **Checks applied:** tar.xz adaptation documented with manifest checksums; musl-on-debian rationale; full Dockerfile spec; pdf-golden build-in-job (not GHCR pull); docker-publish tag scheme preserved; Bun COPY from oven/bun:1.2.18; path filters PR+main; in-container golden:check command sequence; README advisory-only; docker builder prune cleanup without removing local tag; environment-gated runner; out-of-scope soak/fixtures; previous story 1.3/0.5 intelligence; anti-patterns; verification commands including turbo --force and YAML parse

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

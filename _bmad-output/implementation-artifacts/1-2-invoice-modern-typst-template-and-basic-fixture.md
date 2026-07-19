---
baseline_commit: 018ac6a
---

# Story 1.2: Invoice modern Typst template and basic fixture

Status: ready-for-dev

<!-- Ultimate context engine analysis completed - comprehensive developer guide created -->

## Story

As a product owner,
I want `packages/templates/invoice/modern.typ` rendering a basic USD invoice fixture,
so that the spike proves template+engine viability (FR-6, FR-9 partial).

## Acceptance Criteria

1. **Given** Story 1.1 complete (Typst 0.15.1, fonts, preamble, driver), **when** fixture `packages/render/__fixtures__/payloads/invoice-modern-basic.json` is read, **then** it conforms to PRD §10.1 `InvoicePayload` with ≤5 line items, single `taxLines` entry, `currency: "USD"`, `template: "modern"`, `documentType: "invoice"`, and all required fields populated per schema below.
2. **Given** the basic fixture and template, **when** the render harness invokes `compileTypst()` with `--input json=<absolute-payload-path>` and `--input tier=free`, **then** the resulting PDF includes a centered footer line exactly `Rendered with usetagih · usetagih.com` (middle dot `·`, not hyphen or bullet) at **8pt** in gray **`#64748B`** (DESIGN.md `text-muted`) on every page — per FR-7 and PRD §11 OQ-2.
3. **Given** `--input tier=pro` (or any value other than `free`), **when** the same fixture renders, **then** the footer line is **absent** (white-label path smoke — full tier wiring is Epic 3).
4. **Given** payload `totals` and line-item `lineTotal` values, **when** PDF renders, **then** displayed monetary strings match payload `amount` fields **verbatim** — template must **not** multiply `quantity × unitPrice`, sum line items, or recompute tax/grand totals (FR-9, AD-5).
5. **Given** fixture `packages/render/__fixtures__/payloads/invoice-modern-wrong-total.json` (copy of basic with `totals.grandTotal.amount: "9999.99"` while other totals unchanged), **when** rendered, **then** PDF byte stream contains the literal UTF-8 substring `9999.99` and does **not** contain the mathematically correct grand total `673.56` — proving no silent correction.
6. **Given** two consecutive renders of the basic fixture with identical inputs and `SOURCE_DATE_EPOCH=1700000000`, **when** SHA-256 compared, **then** PDF bytes are identical (determinism gate, FR-7).
7. **Given** golden file `packages/render/__fixtures__/golden/invoice-modern-basic.sha256`, **when** read, **then** it contains one lowercase hex SHA-256 hash (64 chars, no extension, no trailing newline beyond single `\n` optional) matching the committed render output.
8. **Given** `packages/render/manifest.json`, **when** parsed, **then** `fixtures[]` includes an entry for `invoice-modern-basic` with `sha256`, `typstVersion: "0.15.1"`, `schemaVersion: "2026-07-20"`, and documents `tier: "free"` as required Typst input.
9. **Given** workspace, **when** `bun test packages/render` runs, **then** tests pass including footer presence/absence, no-recomputation probe, and manifest/fixture file existence checks.
10. **Given** workspace, **when** `bunx turbo run lint typecheck test build --force` runs from repo root, **then** all tasks exit 0.
11. **Out of scope (Stories 1.3+):** `golden:check` / `golden:soak` CLI, `Dockerfile.render-ci`, `pdf-golden.yml`, pagination/logo/SVG/soak fixtures, Zod validation package (Epic 2), API render endpoint (Epic 3).

## Tasks / Subtasks

- [ ] Task 1 — Canonical basic fixture (AC: 1)
  - [ ] Create `packages/render/__fixtures__/payloads/invoice-modern-basic.json` per exact JSON in Dev Notes §Fixture JSON
  - [ ] Create `packages/render/__fixtures__/payloads/invoice-modern-wrong-total.json` (grandTotal only change)
- [ ] Task 2 — Invoice modern Typst template (AC: 2, 3, 4)
  - [ ] Create `packages/templates/invoice/modern.typ` importing `../_shared/preamble.typ`
  - [ ] Read payload via `json(sys.inputs.at("json"))`; read tier via `sys.inputs.at("tier", default: "pro")`
  - [ ] Implement modern layout per Dev Notes §Template layout (no arithmetic on money fields)
  - [ ] Footer via `#set page(footer: …)` when `tier == "free"` only
- [ ] Task 3 — Render harness + driver inputs (AC: 2, 3, 6)
  - [ ] Extend `compileTypst` usage (or add thin helper) passing `--input json=…` and `--input tier=…` via `extraArgs`
  - [ ] Create `packages/render/scripts/render-fixture.ts` CLI: `--fixture <name> [--tier free|pro] [--out <path>]`
  - [ ] Add `package.json` script `"render:fixture": "bun scripts/render-fixture.ts"`
  - [ ] Add `packages/render/.tmp/` to root `.gitignore` (render output scratch dir)
- [ ] Task 4 — Golden hash + manifest (AC: 6, 7, 8)
  - [ ] Render basic fixture once with `tier=free`; compute SHA-256
  - [ ] Commit `packages/render/__fixtures__/golden/invoice-modern-basic.sha256`
  - [ ] Append manifest `fixtures[]` entry per Dev Notes §Manifest entry
  - [ ] Document double-render verification in Dev Agent Record
- [ ] Task 5 — Bun tests (AC: 5, 9)
  - [ ] Create `packages/render/src/invoice-modern.test.ts` (environment-gated when Typst binary absent)
  - [ ] Test: tier=free footer string present in PDF bytes; tier=pro absent
  - [ ] Test: wrong-total fixture contains `9999.99`, not corrected `673.56`
  - [ ] Test: consecutive renders byte-identical for basic fixture
  - [ ] Test: golden sha256 file matches fresh render hash
- [ ] Task 6 — Verification gate (AC: 10)
  - [ ] Run full turbo gate with `--force`
  - [ ] Record hashes and command results in Dev Agent Record

## Dev Notes

### Goal

Deliver the **first real document template** (`invoice/modern`) plus **contract-conformant fixture**, **free-tier footer**, **no-recomputation rendering**, and **committed golden SHA-256** — second story of Epic 1 (BLOCKING PDF spike). Proves Typst can render a PRD-shaped invoice before golden CLI (1.3) and CI Docker (1.4).

### Epic 1 context (cross-story sequencing)

| Story | Delivers | Depends on 1.2 |
| --- | --- | --- |
| 1.2 | **this story** — template + basic fixture + golden hash | 1.1 preamble/fonts/driver |
| 1.3 | `golden:check` CLI consuming manifest `fixtures[]` | fixture + hash + render script |
| 1.4 | CI Docker + `pdf-golden.yml` | 1.3 harness |
| 1.5–1.8 | Blocking spike fixtures | full harness |
| 1.9 | SPIKE-RESULT.md + escalation | all above |

### Environment facts (do not guess)

| Fact | Value |
| --- | --- |
| Baseline commit (Story 1.1 landed) | `600dd8c` — Typst driver, fonts, preamble; review merge `018ac6a` |
| Typst version | `0.15.1` per `packages/render/typst-version.txt` |
| Payload schema authority | PRD §10.1 `_bmad-output/planning-artifacts/prds/prd-usetagih-2026-07-20/prd.md` |
| Footer copy (exact) | `Rendered with usetagih · usetagih.com` — PRD FR-7, §11 OQ-2, UX DESIGN.md guardrail |
| Footer style | 8pt, gray `#64748B` (DESIGN.md `text-muted`) |
| Tier → footer rule | Typst input `tier=free` shows footer; any other tier omits — epics AC; Epic 3 maps account tier |
| No recomputation | FR-9 + AD-5 — display payload strings only; validation rejects mismatches pre-render (Epic 2) |
| Fixture path | `packages/render/__fixtures__/payloads/` per SOLUTION-DESIGN §3.1 |
| Golden path | `packages/render/__fixtures__/golden/invoice-modern-basic.sha256` (hash-only; no committed PDF required) |
| Turbo verification | `bunx turbo run lint typecheck test build --force` |

### Current repo state (Story 1.1 — build on this, do not redo)

| Item | State | This story changes |
| --- | --- | --- |
| `packages/templates/_shared/preamble.typ` | Inter + JetBrains Mono tokens, `#set document(date: none)` | **no watermark here** — footer lives in `invoice/modern.typ` |
| `packages/render/src/typst-driver.ts` | `compileTypst`, `--root`, `--ignore-system-fonts`, `--font-path`, `SOURCE_DATE_EPOCH` | pass `--input` via `extraArgs`; optional typed helper |
| `packages/render/manifest.json` | `fixtures: []` | add `invoice-modern-basic` entry |
| `packages/templates/invoice/modern.typ` | **absent** | **NEW** |
| `packages/render/__fixtures__/payloads/` | **absent** | **NEW** JSON fixtures |
| `packages/render/__fixtures__/golden/` | **absent** | **NEW** `.sha256` |
| `packages/render/scripts/render-fixture.ts` | **absent** | **NEW** (1.3 replaces/extends into golden CLI) |
| root `.gitignore` | has `packages/render/.bin/` | add `packages/render/.tmp/` |

### Fixture JSON — `invoice-modern-basic.json`

Contract: PRD §10.1 `InvoicePayload`, `schemaVersion: "2026-07-20"`, exactly **3 line items**, **1 tax line**, USD, tax-exclusive.

```json
{
  "schemaVersion": "2026-07-20",
  "documentType": "invoice",
  "template": "modern",
  "documentNumber": "INV-2026-0042",
  "issuedAt": "2026-07-15",
  "dueAt": "2026-08-15",
  "currency": "USD",
  "seller": {
    "name": "Acme Widgets LLC",
    "email": "billing@acmewidgets.example",
    "taxId": "US-12-3456789",
    "address": {
      "line1": "100 Market Street",
      "city": "San Francisco",
      "region": "CA",
      "postalCode": "94105",
      "country": "US"
    }
  },
  "buyer": {
    "name": "Beta Industries Inc",
    "email": "accounts@betaind.example",
    "address": {
      "line1": "200 Commerce Blvd",
      "city": "Austin",
      "region": "TX",
      "postalCode": "78701",
      "country": "US"
    }
  },
  "lineItems": [
    {
      "description": "Widget Pro License (annual)",
      "quantity": 2,
      "unit": "license",
      "unitPrice": { "amount": "149.00" },
      "lineTotal": { "amount": "298.00" }
    },
    {
      "description": "Priority Support Add-on",
      "quantity": 1,
      "unit": "year",
      "unitPrice": { "amount": "99.00" },
      "lineTotal": { "amount": "99.00" }
    },
    {
      "description": "Onboarding Session (3 hours)",
      "quantity": 3,
      "unit": "hour",
      "unitPrice": { "amount": "75.00" },
      "lineTotal": { "amount": "225.00" }
    }
  ],
  "taxLines": [
    {
      "name": "Sales Tax",
      "rate": 0.0825,
      "amount": { "amount": "51.56" }
    }
  ],
  "pricesIncludeTax": false,
  "totals": {
    "subtotal": { "amount": "622.00" },
    "taxTotal": { "amount": "51.56" },
    "grandTotal": { "amount": "673.56" }
  },
  "notes": "Payment due within 30 days. Thank you for your business."
}
```

**Wrong-total variant** (`invoice-modern-wrong-total.json`): identical except `"grandTotal": { "amount": "9999.99" }`. Used only for no-recomputation test — **no golden hash** for this file.

### Tier flag mechanism (`tier=free` → footer)

Typst CLI inputs (passed through driver `extraArgs`):

```typescript
const payloadPath = resolve("packages/render/__fixtures__/payloads/invoice-modern-basic.json");
const tier = "free"; // or "pro"

compileTypst({
  inputPath: resolve("packages/templates/invoice/modern.typ"),
  outputPath: resolve("packages/render/.tmp/invoice-modern-basic.pdf"),
  extraArgs: [
    "--input", `json=${payloadPath}`,
    "--input", `tier=${tier}`,
  ],
});
```

Template reads inputs:

```typst
#let payload = json(sys.inputs.at("json"))
#let tier = sys.inputs.at("tier", default: "pro")
#let show-footer = tier == "free"
```

**Epic 3 mapping (future):** API sets `tier` from `account_settings.tier`; `free` → `--input tier=free`; Embed Pro+ → `tier=pro`. SOLUTION-DESIGN §4.3 describes equivalent `showWatermark: boolean` — this story uses **`tier` string input** per epics AC; `show-footer = tier == "free"`.

### Template layout — `packages/templates/invoice/modern.typ`

**Import:**

```typst
#import "../_shared/preamble.typ": *
```

**Structure (modern style — professional, document-first per UX DESIGN.md):**

| Section | Spec |
| --- | --- |
| Header row | Seller name (`font-semibold`, primary navy `#1E3A5F`); right-aligned "INVOICE" title (`font-bold`, 18pt) |
| Meta block | Document `#`, Issued, Due dates — labels in `text-secondary` `#475569`, values from payload ISO dates formatted English `MMM DD, YYYY` (parse `issuedAt`/`dueAt` strings only for display formatting; **do not** inject current date) |
| Parties | Two columns: Bill From (seller), Bill To (buyer) with name, email, address lines |
| Line items table | Columns: Description, Qty, Unit, Unit Price, Line Total — header row with bottom border `#E2E8F0`; zebra optional |
| Tax block | Single row per `taxLines[]` entry: name, rate as percent display `(rate × 100)%`, amount verbatim |
| Totals block | Right-aligned: Subtotal, Tax, **Grand Total** — print `totals.*.amount` strings with `$` prefix for USD (literal concatenation `"$" + amount`, not float math) |
| Notes | Optional `notes` field below totals |
| Footer | Only when `show-footer`: see AC #2 |

**Money display helper (verbatim — no math):**

```typst
#let fmt-money(amount) = {
  if payload.currency == "USD" {
    "$" + amount
  } else {
    payload.currency + " " + amount
  }
}
```

Use `fmt-money(item.lineTotal.amount)` etc. — **never** `quantity * unitPrice`.

**Footer implementation (exact):**

```typst
#set page(
  footer: context {
    if show-footer {
      set align(center)
      set text(size: 8pt, fill: rgb("#64748B"))
      [Rendered with usetagih · usetagih.com]
    }
  },
)
```

No diagonal watermark. No opacity overlay. Never render footer when `tier != "free"`.

### `render-fixture.ts` contract

File: `packages/render/scripts/render-fixture.ts`

```
Usage: bun scripts/render-fixture.ts --fixture invoice-modern-basic [--tier free|pro] [--out <pdf-path>]
```

- Resolves payload at `__fixtures__/payloads/{fixture}.json`
- Template fixed: `packages/templates/invoice/modern.typ`
- Default `--tier free` for golden generation
- Default `--out` → `packages/render/.tmp/{fixture}.pdf` (gitignored via `.tmp*` or explicit path under package)
- Prints output path and SHA-256 to stdout
- Requires Typst binary (same as smoke test)

Add to `packages/render/package.json`:

```json
"render:fixture": "bun scripts/render-fixture.ts"
```

### Golden hash generation procedure

Run once after template stabilizes (local linux x86_64 with Typst 0.15.1 installed):

```bash
# Prerequisites
bash packages/render/scripts/install-typst-local.sh

# Render
bun run --filter @usetagih/render render:fixture -- --fixture invoice-modern-basic --tier free

# Compute hash (adjust path if --out differs)
sha256sum packages/render/.tmp/invoice-modern-basic.pdf | awk '{print $1}' \
  > packages/render/__fixtures__/golden/invoice-modern-basic.sha256

# Double-render determinism check
bun run --filter @usetagih/render render:fixture -- --fixture invoice-modern-basic --tier free --out /tmp/usetagih-inv-1.pdf
bun run --filter @usetagih/render render:fixture -- --fixture invoice-modern-basic --tier free --out /tmp/usetagih-inv-2.pdf
sha256sum /tmp/usetagih-inv-1.pdf /tmp/usetagih-inv-2.pdf
# Hashes MUST match each other AND committed golden file

# Verify golden file matches
sha256sum -c <(echo "$(cat packages/render/__fixtures__/golden/invoice-modern-basic.sha256)  packages/render/.tmp/invoice-modern-basic.pdf")
```

### Manifest entry

Append to `packages/render/manifest.json` → `fixtures[]`:

```json
{
  "id": "invoice-modern-basic",
  "payload": "__fixtures__/payloads/invoice-modern-basic.json",
  "template": "../../templates/invoice/modern.typ",
  "sha256": "<lowercase-hex-from-render>",
  "typstVersion": "0.15.1",
  "schemaVersion": "2026-07-20",
  "inputs": {
    "tier": "free"
  }
}
```

Paths relative to `packages/render/` unless harness resolves absolute (Story 1.3 golden CLI owns final path resolution — keep consistent).

### Testing requirements

```bash
# 1. Typst binary (once)
bash packages/render/scripts/install-typst-local.sh

# 2. Package tests (includes environment-gated render tests)
bun test packages/render

# 3. Full workspace gate
bunx turbo run lint typecheck test build --force

# 4. Manual golden refresh (only when template intentionally changes)
bun run --filter @usetagih/render render:fixture -- --fixture invoice-modern-basic --tier free
# recompute sha256 → update golden file + manifest (PR label golden-update in CI era)
```

**`invoice-modern.test.ts` must cover:**

1. Payload + golden files exist on disk
2. Render basic fixture twice → identical SHA-256
3. Fresh render hash === committed `invoice-modern-basic.sha256`
4. `tier=free` → PDF bytes include exact footer string `Rendered with usetagih · usetagih.com`
5. `tier=pro` → PDF bytes do **not** include that footer string
6. Wrong-total fixture → bytes include `9999.99`, exclude `673.56` as grand total display

**Environment gating:** if `resolveTypstBinaryPath()` binary missing, skip render tests with clear message (same pattern as optional smoke — but CI/local dev expects binary installed).

**PDF string assertion technique:** search raw PDF buffer for UTF-8 byte sequences (no PDF parser dependency required for MVP spike).

### Architecture compliance

- **AD-3:** Same Typst pin, fonts, `SOURCE_DATE_EPOCH`, `--ignore-system-fonts`, preamble `#set document(date: none)` — do not regress Story 1.1.
- **AD-5 / FR-9:** Template displays payload totals verbatim; arithmetic validation deferred to Epic 2.
- **AD-10:** No Chromium, no pixel-golden fallback.
- **FR-6:** First `invoice` + `modern` template for spike.
- **FR-7:** Footer for free tier; byte-identical double-render.
- **NFR-6:** Golden hash committed (full CLI gate in Story 1.3).

### Anti-patterns (do not do)

- Do **not** implement `golden:check`, soak, or CI Docker — Stories 1.3–1.4.
- Do **not** add Zod schema or API routes — Epic 2/3.
- Do **not** recompute `lineTotal`, `subtotal`, `taxTotal`, or `grandTotal` in Typst.
- Do **not** use `#datetime.today()` or system date for displayed invoice dates.
- Do **not** use diagonal watermark — footer line only (OQ-2).
- Do **not** commit generated PDFs to git (hash file only).
- Do **not** change Typst version or font bundle without board awareness.

### Previous story intelligence (Story 1.1)

- Typst 0.15 requires `--root` set to repo root (driver already sets this) for cross-package imports.
- `#set text(leading: …)` removed in Typst 0.15 — preamble uses `#set par(leading: 0.65em)`.
- Smoke import path from fixtures: use paths relative to template or absolute via `--root`.
- Consecutive smoke PDF SHA-256: `1fb48bb3c1606e06378955b310c7c93bf4b9ffa486283fcaee9fd396068da93b` (hello.typ — unrelated to this fixture).
- Always verify with `turbo --force`.

### Project Structure Notes

- `packages/templates/` is **not** a workspace package — `.typ` content only.
- Fixtures live under `packages/render/__fixtures__/` (render owns test corpus per SOLUTION-DESIGN §3.1).
- Template path: `packages/templates/invoice/modern.typ` (create `invoice/` directory).

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story-1.2]
- [Source: _bmad-output/planning-artifacts/prds/prd-usetagih-2026-07-20/prd.md#§10.1, FR-7, FR-9, §11 OQ-2]
- [Source: _bmad-output/planning-artifacts/architecture/architecture-usetagih-2026-07-20/SOLUTION-DESIGN.md#§2, §3.1, §4.3]
- [Source: _bmad-output/planning-artifacts/ux-designs/ux-usetagih-2026-07-20/DESIGN.md — colors, typography, footer guardrail]
- [Source: _bmad-output/implementation-artifacts/1-1-pin-typst-0-15-x-font-bundle-and-shared-preamble.md]
- [Source: packages/render/src/typst-driver.ts]
- [Source: packages/templates/_shared/preamble.typ]

## Dev Agent Record

### Agent Model Used

_(filled by dev agent)_

### Debug Log References

### Completion Notes List

### File List

### Change Log

### Story Validation Record

- **Validated:** 2026-07-20 against `bmad-create-story/checklist.md`
- **Result:** PASS — no critical gaps after self-review
- **Checks applied:** PRD §10.1 field names in fixture sketch; exact footer string + 8pt `#64748B`; tier=free via Typst `--input`; no-recomputation wrong-total fixture; golden hash procedure; manifest entry; Story 1.1 driver/preamble reuse; out-of-scope boundaries for 1.3+

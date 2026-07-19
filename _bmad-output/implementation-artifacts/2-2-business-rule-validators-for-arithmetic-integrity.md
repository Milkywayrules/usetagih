---
baseline_commit: df6a5117fb1095bc51cd683b8a49d141bb22d8b9
---

# Story 2.2: Business-rule validators for arithmetic integrity

Status: done

<!-- Ultimate context engine analysis completed - comprehensive developer guide created -->

## Story

As an integrator,
I want validation rejecting `LINE_TOTAL_MISMATCH` and `TAX_TOTAL_MISMATCH`,
so that financial values are never silently corrected (FR-2, FR-9, AD-5, §10.1 rules).

## Acceptance Criteria

1. **Given** a structurally valid `DocumentPayload` (passed `DocumentPayloadSchema.parse()`), **when** `validateDocumentPayloadArithmetic(payload)` runs, **then** it returns `BusinessRuleFinding[]` (empty = pass); each finding includes JSON Pointer `path`, string `code`, human `message`, and optional `expected` / `received` decimal strings — never mutates the payload.
2. **Given** a line item where declared `lineTotal` ≠ `quantity × unitPrice` rounded **half-up** to currency minor units (PRD §10.1, FR-4), **when** the validator runs, **then** finding at `/lineItems/{n}/lineTotal` with `code: "LINE_TOTAL_MISMATCH"`, `expected` = computed canonical amount, `received` = declared amount (both normalized per Dev Notes §Comparison).
3. **Given** `taxLines` present and `totals.taxTotal` ≠ `Σ taxLines[].amount` (exact normalized string equality after summing with currency minor units), **when** the validator runs, **then** finding at `/totals/taxTotal` with `code: "TAX_TOTAL_MISMATCH"`, `expected` = sum, `received` = declared `taxTotal`.
4. **Given** `totals.subtotal` ≠ `Σ lineItems[].lineTotal` (normalized sum), **when** the validator runs, **then** finding at `/totals/subtotal` with `code: "VALIDATION_FAILED"` (Story 2.3 formalizes enum; use local constant).
5. **Given** `pricesIncludeTax: false` (or omitted) and `totals.grandTotal` ≠ `subtotal − discount + taxTotal` (treat missing `discount` as `"0"`), **when** the validator runs, **then** finding at `/totals/grandTotal` with `code: "VALIDATION_FAILED"`.
6. **Given** `pricesIncludeTax: true` and `totals.grandTotal` ≠ `subtotal − discount`, **when** the validator runs, **then** finding at `/totals/grandTotal` with `code: "VALIDATION_FAILED"`.
7. **Given** optional `discount` present and `discount > subtotal` (decimal compare), **when** the validator runs, **then** finding at `/discount` with `code: "VALIDATION_FAILED"`.
8. **Given** `currency: "JPY"`, **when** any `Money.amount` in the payload (line items, tax lines, discount, totals) contains a fractional minor unit (non-zero digits after the decimal point, or any `.` when minor units = 0), **then** structural parse may still pass but arithmetic validator emits finding at that money path with `code: "VALIDATION_FAILED"` and message citing FR-4 JPY integer-yen rule.
9. **Given** `currency: "USD"` (or `"EUR"`), **when** any `Money.amount` has more than 2 fractional digits, **then** finding at that path with `code: "VALIDATION_FAILED"` (FR-4 two-decimal enforcement at business layer — complements `moneyAmountSchema` syntax).
10. **Given** `quantity` with more than 3 fractional digits, **when** `DocumentPayloadSchema.parse()` runs, **then** Zod rejects (Story 2.1 `quantitySchema` — **not** duplicated in arithmetic validator); **and** `bun test` includes an explicit regression test referencing `quantitySchema` rejection (AC continuity with epics).
11. **Given** `packages/schema/__fixtures__/invalid/arithmetic/` with **≥10** seeded failure JSON files (see Dev Notes §Failure fixtures), **when** `bun test packages/schema`, **then** each fixture: parse succeeds structurally, arithmetic validator returns ≥1 finding with expected `path` + `code`; valid fixtures (`__fixtures__/valid/*`, `invoice-modern-basic.json`) return zero findings.
12. **Given** `packages/render/__fixtures__/payloads/invoice-modern-wrong-total.json` (Story 1.2 no-recomputation probe — wrong `grandTotal` only), **when** parsed + validated, **then** structural parse passes, arithmetic validator rejects `/totals/grandTotal` (proves schema layer catches what render would print verbatim).
13. **Given** workspace, **when** `bunx turbo run lint typecheck test build --force` runs from repo root, **then** all tasks exit 0.
14. **Out of scope (Stories 2.3–2.6, Epic 3):** HTTP status mapping, error envelope builder, OpenAPI, `schemaVersion` defaulting, render/template changes, modifying render golden hashes, npm decimal libraries, auto-correcting payload fields.

## Tasks / Subtasks

- [x] Task 1 — Validation module scaffold (AC: 1, 14)
  - [x] Create `packages/schema/src/validation/` per Dev Notes §File layout
  - [x] Add `finding.ts`, `codes.ts`, export surface in `src/index.ts`
- [x] Task 2 — Dependency-free decimal math (AC: 2, 3, 4, 5, 6, 7)
  - [x] Implement `decimal.ts` helpers (multiply, add, subtract, sum, compare, normalize, half-up round) using **bigint** scaled integers — **no** `parseFloat` / `Number()` on money strings
  - [x] Unit-test half-up edge cases in `decimal.test.ts` (see Dev Notes §Half-up test vectors)
- [x] Task 3 — Currency minor units (AC: 8, 9)
  - [x] Implement `currency-minor-units.ts` with `getCurrencyMinorUnits(code)` and `assertMoneyMinorUnits(amount, currency)` 
  - [x] Wire minor-unit scan across all money fields in payload walk
- [x] Task 4 — Arithmetic validator (AC: 2–7, 12)
  - [x] Implement `validate-arithmetic.ts` with `validateDocumentPayloadArithmetic(payload: DocumentPayload): BusinessRuleFinding[]`
  - [x] Implement `validate-arithmetic.test.ts` matrix
- [x] Task 5 — Failure fixtures (AC: 11)
  - [x] Add ≥10 JSON files under `__fixtures__/invalid/arithmetic/` per Dev Notes §Failure fixtures
- [x] Task 6 — Verification gate (AC: 13)
  - [x] `bun test packages/schema`
  - [x] `bunx turbo run lint typecheck test build --force`

## Dev Notes

### Goal

Add **business-rule validation** on top of Story 2.1 structural Zod parse. Rejects arithmetic integrity violations **before render** (AD-5) with stable finding codes. Render (Story 1.2) prints payload values verbatim — the **schema package** is where mismatches are **rejected**, never corrected.

### PRD §10.1 normative arithmetic rules (authoritative — implement exactly)

Quote from [PRD §10.1](_bmad-output/planning-artifacts/prds/prd-usetagih-2026-07-20/prd.md):

- `lineTotal = quantity × unitPrice`, rounded **half-up** to currency minor units; declared `lineTotal` mismatch → `422` with code **`LINE_TOTAL_MISMATCH`**.
- `subtotal = Σ lineTotals`.
- Tax-exclusive (`pricesIncludeTax: false`, default): `grandTotal = subtotal − discount + taxTotal`.
- Tax-inclusive (`pricesIncludeTax: true`): `grandTotal = subtotal − discount`.
- When `taxLines` present, `totals.taxTotal` must equal `Σ taxLines[].amount`; mismatch → `422` with code **`TAX_TOTAL_MISMATCH`**.
- `discount ≤ subtotal`; tax rates in range 0..1 (0..1 enforced structurally by `taxRateSchema` in 2.1).
- Rounding mode **half-up** documented in FR-4; enforced across all monetary calculations in this validator.

**FR-4 precision (implement in business layer):**

- JPY: reject fractional minor units on any money field.
- USD/EUR: accept at most **2** decimal places; amounts used in calculations rounded half-up to 2 decimals.
- Money values remain canonical decimal strings (non-negative base-10, no exponent) — already enforced by `moneyAmountSchema`.

### Render no-recomputation seam (Story 1.2)

| Layer | Behavior |
| --- | --- |
| **Render** (`packages/render`) | Typst template prints `lineTotal`, `totals.*` from JSON **verbatim** — `invoice-modern-wrong-total.json` proves wrong `grandTotal: "9999.99"` appears in PDF bytes |
| **Schema (this story)** | After Zod parse, `validateDocumentPayloadArithmetic` **rejects** inconsistent totals so bad payloads never reach render in Epic 3+ |
| **Test bridge** | Parse render `invoice-modern-wrong-total.json` → structural pass, arithmetic fail on `/totals/grandTotal` |

Do **not** change render fixtures or golden hashes. Do **not** add recomputation to Typst templates.

### Epic 2 cross-story boundaries

| Story | Owns | Not in 2.2 |
| --- | --- | --- |
| **2.1 (done)** | Structural Zod union, `quantitySchema` ≤3 fractional digits, `checkDocumentTypeMismatch` | — |
| **2.2 (this)** | Decimal math, `validateDocumentPayloadArithmetic`, `LINE_TOTAL_MISMATCH` / `TAX_TOTAL_MISMATCH` code strings, FR-4 minor-unit checks, subtotal/grandTotal/discount rules with `VALIDATION_FAILED` | — |
| 2.3 | `packages/schema/src/errors/` enum, HTTP 1:1 mapping, `{ error: { code, message, requestId, details[] } }` builder | Move/re-export codes from `validation/codes.ts` |
| 2.4 | `schemaVersion` default injection | — |
| 2.5 | OpenAPI generation | — |
| 2.6 | Expand to ≥20 failure fixtures, SM-2 90% path+code coverage | Large corpus expansion |

### Integration architecture decision: separate step, not Zod `superRefine`

**Decision:** Business rules run as a **pure function after** successful `DocumentPayloadSchema.parse()` — **not** embedded in Zod `.superRefine()`.

| Approach | Rationale |
| --- | --- |
| **Separate `validateDocumentPayloadArithmetic()`** ✓ | Matches SOLUTION-DESIGN §4.1 stage 3 ("Zod parse + business rules"); keeps structural vs business errors distinct; findings shape aligns with Story 2.3 `details[]`; easier for SDK `validateLocally` to mirror API |
| Zod `.superRefine()` on union | Rejected — mixes Zod issue format with business finding format; harder for Epic 3 to map `LINE_TOTAL_MISMATCH` → 422 vs structural → 422 `VALIDATION_FAILED` |

**Epic 3 orchestration (implement later — document seam now):**

```typescript
const parsed = DocumentPayloadSchema.safeParse(raw);
if (!parsed.success) { /* map Zod issues → VALIDATION_FAILED details */ }

const findings = validateDocumentPayloadArithmetic(parsed.data);
if (findings.length > 0) { /* 422 with findings as details[] */ }
```

Optional convenience export (recommended):

```typescript
export function validateDocumentPayload(raw: unknown):
  | { ok: true; data: DocumentPayload }
  | { ok: false; stage: "structural"; error: z.ZodError }
  | { ok: false; stage: "business"; findings: BusinessRuleFinding[] };
```

Implement in `packages/schema/src/validation/validate-document-payload.ts` if adding orchestration helper; arithmetic-only export is minimum AC.

### Story 2.3 code seam (avoid rework)

Story 2.3 creates `packages/schema/src/errors/` with full enum. **This story** places code strings in `validation/codes.ts`:

```typescript
export const LINE_TOTAL_MISMATCH_CODE = "LINE_TOTAL_MISMATCH" as const;
export const TAX_TOTAL_MISMATCH_CODE = "TAX_TOTAL_MISMATCH" as const;
export const VALIDATION_FAILED_CODE = "VALIDATION_FAILED" as const;
// Story 2.3: move into errors/codes.ts enum + re-export from index
```

Findings use plain `string` codes now; 2.3 narrows to enum union. Do **not** create `src/errors/` directory in 2.2.

### Types and function signatures

```typescript
// validation/finding.ts
export type BusinessRuleFinding = {
  path: string;       // JSON Pointer, 0-indexed: "/lineItems/0/lineTotal"
  code: string;       // LINE_TOTAL_MISMATCH_CODE | TAX_TOTAL_MISMATCH_CODE | VALIDATION_FAILED_CODE
  message: string;
  expected?: string;  // canonical decimal string
  received?: string;
};

// validation/validate-arithmetic.ts
import type { DocumentPayload } from "../document/document-payload";

export function validateDocumentPayloadArithmetic(
  payload: DocumentPayload,
): BusinessRuleFinding[];
```

Return **all** findings (do not short-circuit on first error) — Epic 3/SDK can show multiple issues; order: line items ascending index, then totals, then discount.

### File layout (implement exactly)

```text
packages/schema/
├── src/
│   ├── index.ts                           # re-export validation public API
│   ├── document/                          # unchanged from 2.1 (no superRefine additions)
│   └── validation/
│       ├── finding.ts
│       ├── codes.ts
│       ├── currency-minor-units.ts
│       ├── decimal.ts
│       ├── decimal.test.ts
│       ├── validate-arithmetic.ts
│       ├── validate-arithmetic.test.ts
│       └── validate-document-payload.ts   # optional orchestration helper
└── __fixtures__/
    └── invalid/
        └── arithmetic/                    # ≥10 new failure fixtures
            ├── line-total-mismatch-usd.json
            ├── line-total-half-up-edge.json
            ├── tax-total-mismatch.json
            ├── subtotal-mismatch.json
            ├── grand-total-mismatch-tax-exclusive.json
            ├── grand-total-mismatch-tax-inclusive.json
            ├── discount-exceeds-subtotal.json
            ├── jpy-fractional-line-total.json
            ├── usd-three-decimal-unit-price.json
            ├── multi-line-second-item-mismatch.json
            └── ... (≥10 total)
```

Do **not** add npm dependencies for decimal math (`decimal.js`, `big.js`, etc.) — AGENTS.md stack rule.

### Decimal arithmetic (`decimal.ts`) — dependency-free, no float on money

**Invariant:** Never use `parseFloat`, `Number(moneyString)`, or IEEE float arithmetic on `Money.amount` strings.

**Scaled integer representation:**

```typescript
// Internal only — not exported unless useful for tests
type ScaledAmount = bigint; // value × 10^minorUnits

function parseMoneyToScaled(amount: string, minorUnits: number): ScaledAmount;
function scaledToMoneyString(scaled: ScaledAmount, minorUnits: number): string;
```

**Exported helpers (minimum):**

| Function | Purpose |
| --- | --- |
| `multiplyQuantityByMoney(quantity: number, unitPriceAmount: string, minorUnits: number): string` | `quantity × unitPrice`, half-up round to `minorUnits` |
| `addMoneyAmounts(amounts: string[], minorUnits: number): string` | Sum with final half-up to `minorUnits` |
| `subtractMoneyAmounts(minuend: string, subtrahend: string, minorUnits: number): string` | Subtraction with half-up |
| `compareMoneyAmounts(a: string, b: string, minorUnits: number): -1 \| 0 \| 1` | After normalization |
| `normalizeMoneyAmount(amount: string, minorUnits: number): string` | Canonical string for comparison/output in findings |

**Half-up rounding (positive amounts only — schema guarantees non-negative):**

1. Scale amount to integer: `scaled = round_half_up(amount × 10^minorUnits)` using bigint.
2. Half-up at scale S: if fractional part ≥ 0.5 ulp at target scale, increment.
3. For `multiplyQuantityByMoney`: compute product at scale `minorUnits + 3` (quantity has ≤3 fractional digits), then half-up to `minorUnits`.

**Quantity handling:**

- Represent `quantity` as integer with scale 3: `qtyScaled = BigInt(Math.round(quantity * 1000))` — safe because quantity is already validated ≤3 decimal places and positive (max magnitude well within safe integer range for invoice line counts).
- `unitPrice` parsed to scaled bigint at `minorUnits`.
- Product: `(qtyScaled * priceScaled) / 10^3` with half-up at `minorUnits`.

### Half-up test vectors (`decimal.test.ts`)

| quantity | unitPrice | minorUnits | expected lineTotal |
| --- | --- | --- | --- |
| 10 | 9.99 | 2 | 99.90 |
| 3 | 0.335 | 2 | 1.01 | (1.005 → half-up) |
| 1 | 0.005 | 2 | 0.01 |
| 2 | 149.00 | 2 | 298.00 |
| 1000 | 1 | 0 (JPY) | 1000 |

### Comparison (`§Comparison`)

Before emitting `LINE_TOTAL_MISMATCH` / `TAX_TOTAL_MISMATCH`:

1. `expected = normalizeMoneyAmount(computed, minorUnits)`
2. `received = normalizeMoneyAmount(declared, minorUnits)`
3. Mismatch if `compareMoneyAmounts(expected, received, minorUnits) !== 0`

Findings always include normalized `expected` / `received` strings.

### Currency minor units (`currency-minor-units.ts`)

```typescript
const CURRENCY_MINOR_UNITS: Record<string, number> = {
  JPY: 0,
  USD: 2,
  EUR: 2,
  GBP: 2,
  // extend as fixtures require
};

export function getCurrencyMinorUnits(currency: string): number;
export function validateMoneyMinorUnits(
  amount: string,
  currency: string,
): { valid: true } | { valid: false; reason: string };
```

- Lookup `payload.currency` once per validation call.
- Unlisted ISO 4217 codes: default **2** minor units (`[ASSUMPTION]` — FR-4 explicitly names USD/EUR/JPY; extend map when new currencies appear in fixtures).
- Walk all money fields: each `lineItems[].unitPrice`, `lineItems[].lineTotal`, each `taxLines[].amount`, optional `discount`, `totals.subtotal`, `totals.taxTotal`, `totals.grandTotal`.

### Validator algorithm (`validate-arithmetic.ts`)

1. Resolve `minorUnits = getCurrencyMinorUnits(payload.currency)`.
2. **Minor-unit scan** — all money fields; collect `VALIDATION_FAILED` findings for FR-4 violations.
3. **Per line item** (index `i`):
   - `expectedLineTotal = multiplyQuantityByMoney(item.quantity, item.unitPrice.amount, minorUnits)`
   - If ≠ `item.lineTotal.amount` → `LINE_TOTAL_MISMATCH` at `/lineItems/{i}/lineTotal`
4. **Subtotal** — `sumLineTotals = addMoneyAmounts(lineItems.map(li => li.lineTotal.amount), minorUnits)`; if ≠ `payload.totals.subtotal.amount` → `/totals/subtotal`
5. **Tax total** — **only when** `payload.taxLines` is present **and** `length > 0` (PRD: "When taxLines present"): `sumTax = addMoneyAmounts(taxLines.map(t => t.amount.amount), minorUnits)`; if ≠ `payload.totals.taxTotal.amount` → `TAX_TOTAL_MISMATCH` at `/totals/taxTotal`. When `taxLines` is absent or `[]`, **skip** this check (do not infer tax from line items).
6. **Discount** — if `discount` present: if `compareMoneyAmounts(discount.amount, subtotal.amount, minorUnits) > 0` → `/discount`
7. **Grand total**:
   - `discountAmount = payload.discount?.amount ?? "0"`
   - If `payload.pricesIncludeTax === true`: `expectedGrand = subtractMoneyAmounts(subtotal, discountAmount, minorUnits)`
   - Else: `expectedGrand = addMoneyAmounts([subtractMoneyAmounts(subtotal, discountAmount, minorUnits), taxTotal], minorUnits)`
   - Compare to `payload.totals.grandTotal.amount` → `/totals/grandTotal` on mismatch

Use declared `totals.subtotal` / `totals.taxTotal` for grand-total formula (not recomputed sums) — validates internal consistency of **declared** totals per PRD; line-item and tax checks catch upstream errors separately.

### Failure fixtures (≥10, SM-2 path clarity)

Fixtures target **SM-2** clarity benchmark: each failure exposes an unambiguous JSON Pointer `path` + stable `code` for integrator error display (Story 2.6 expands corpus to ≥20 and 90% coverage).

Derive from `invoice-minimal.json` / `invoice-modern-basic.json` where possible; change **one** field per fixture.

| File | Mutation | Expected path | Expected code |
| --- | --- | --- | --- |
| `line-total-mismatch-usd.json` | line 0 `lineTotal: "99.91"` (should be 99.90) | `/lineItems/0/lineTotal` | `LINE_TOTAL_MISMATCH` |
| `line-total-half-up-edge.json` | qty 3, unit 0.335, wrong lineTotal 1.00 | `/lineItems/0/lineTotal` | `LINE_TOTAL_MISMATCH` (expected 1.01) |
| `tax-total-mismatch.json` | `totals.taxTotal: "110.00"` vs taxLines sum 51.56 | `/totals/taxTotal` | `TAX_TOTAL_MISMATCH` |
| `subtotal-mismatch.json` | `totals.subtotal` off by 1.00 | `/totals/subtotal` | `VALIDATION_FAILED` |
| `grand-total-mismatch-tax-exclusive.json` | wrong grandTotal, correct subtotal/tax | `/totals/grandTotal` | `VALIDATION_FAILED` |
| `grand-total-mismatch-tax-inclusive.json` | `pricesIncludeTax: true`, wrong grandTotal | `/totals/grandTotal` | `VALIDATION_FAILED` |
| `discount-exceeds-subtotal.json` | `discount` > subtotal | `/discount` | `VALIDATION_FAILED` |
| `jpy-fractional-line-total.json` | `currency: JPY`, `lineTotal: "1000.5"` | `/lineItems/0/lineTotal` | `VALIDATION_FAILED` |
| `usd-three-decimal-unit-price.json` | `unitPrice: "9.999"` | `/lineItems/0/unitPrice` | `VALIDATION_FAILED` |
| `multi-line-second-item-mismatch.json` | line index 1 wrong total | `/lineItems/1/lineTotal` | `LINE_TOTAL_MISMATCH` |

Test pattern per fixture:

```typescript
const payload = DocumentPayloadSchema.parse(loadJson("..."));
const findings = validateDocumentPayloadArithmetic(payload);
expect(findings).toContainEqual(expect.objectContaining({ path: "...", code: "..." }));
```

### Test matrix (`validate-arithmetic.test.ts`)

| Test | Assertion |
| --- | --- |
| Valid minimal fixtures (3 types) | zero findings |
| `invoice-modern-basic.json` | zero findings |
| `invoice-modern-wrong-total.json` | finding on `/totals/grandTotal` |
| Each arithmetic failure fixture (≥10) | expected path + code |
| `decimal.test.ts` half-up vectors | exact string outputs |
| `quantitySchema` rejects 4 decimal places | Zod throw (2.1 regression) |

### Public exports (`src/index.ts`)

Add exports:

- `validateDocumentPayloadArithmetic`
- `BusinessRuleFinding` type
- `LINE_TOTAL_MISMATCH_CODE`, `TAX_TOTAL_MISMATCH_CODE`, `VALIDATION_FAILED_CODE`
- Optional: `validateDocumentPayload` orchestration helper
- Do **not** export internal bigint helpers unless needed by tests

### Environment facts (do not guess)

| Fact | Value |
| --- | --- |
| Baseline commit | `df6a5117fb1095bc51cd683b8a49d141bb22d8b9` (Story 2.1 done) |
| Zod / package versions | Same as Story 2.1 — `zod ^4.4.3` |
| Turbo verification | `bunx turbo run lint typecheck test build --force` |
| Unit tests | `bun test packages/schema` |
| Render wrong-total fixture | `packages/render/__fixtures__/payloads/invoice-modern-wrong-total.json` |
| No new dependencies | Decimal math must be in-repo bigint/string only |

### Anti-patterns (do not)

- Do not use float arithmetic on money strings.
- Do not auto-correct or mutate payload totals in the validator.
- Do not embed business rules in Zod `.superRefine()` on `DocumentPayloadSchema`.
- Do not create `packages/schema/src/errors/` (Story 2.3).
- Do not change render templates, golden hashes, or wrong-total fixture JSON.
- Do not add `decimal.js` / `big.js` npm packages.
- Do not duplicate `quantitySchema` logic inside arithmetic validator (structural only).

### Git intelligence (recent Epic 2 work)

| Commit | Relevance |
| --- | --- |
| `808fd81` feat: document payload zod union | Established `packages/schema/src/document/` module layout and test patterns |
| `df6a511` chore: mark story 2-1 done | Confirms structural schema complete; 2.2 builds on same package |
| `aa3552e` docs: story 2-1 | Story file format/template reference for this story |

### Previous story intelligence (2.1)

| Source | Learning for 2.2 |
| --- | --- |
| Story 2.1 | `packages/schema/src/document/` layout, `.strict()` objects, `quantitySchema` already rejects >3 fractional digits |
| Story 2.1 | `checkDocumentTypeMismatch` pattern: return typed result with code string constant — mirror for findings array |
| Story 2.1 | Minimal fixtures use `10 × 9.99 = 99.90` — use as valid arithmetic baseline |
| Story 1.2 | Wrong-total fixture proves render verbatim; 2.2 validates at schema layer |

### References

- [Source: `_bmad-output/planning-artifacts/epics.md` — Story 2.2 ACs]
- [Source: `_bmad-output/planning-artifacts/prds/prd-usetagih-2026-07-20/prd.md` — §10.1 normative arithmetic, FR-4, §10.3 error envelope shape]
- [Source: `_bmad-output/planning-artifacts/architecture/architecture-usetagih-2026-07-20/ARCHITECTURE-SPINE.md` — AD-5 financial integrity]
- [Source: `_bmad-output/planning-artifacts/architecture/architecture-usetagih-2026-07-20/SOLUTION-DESIGN.md` — §4.1 Validate stage]
- [Source: `_bmad-output/implementation-artifacts/2-1-document-payload-zod-discriminated-union.md` — structural schema boundaries]
- [Source: `_bmad-output/implementation-artifacts/1-2-invoice-modern-typst-template-and-basic-fixture.md` — no-recomputation wrong-total probe]
- [Source: `packages/render/__fixtures__/payloads/invoice-modern-basic.json` — valid arithmetic reference]
- [Source: `packages/render/__fixtures__/payloads/invoice-modern-wrong-total.json` — grandTotal mismatch probe]

## Dev Agent Record

### Agent Model Used

Composer 2.5

### Debug Log References

### Completion Notes List

- added `validateDocumentPayloadArithmetic` with bigint scaled-integer decimal math (no float on money strings)
- implemented PRD §10.1 rules: line total half-up, subtotal sum, tax total (when taxLines present), grand total tax-inclusive/exclusive, discount cap, FR-4 minor-unit checks
- seeded 10 arithmetic failure fixtures plus bridge test against render wrong-total fixture
- `bun test packages/schema`: 16 pass, 0 fail
- `bunx turbo run lint typecheck test build --force`: 36 tasks successful

### File List

- packages/schema/src/index.ts
- packages/schema/src/validation/finding.ts
- packages/schema/src/validation/codes.ts
- packages/schema/src/validation/currency-minor-units.ts
- packages/schema/src/validation/decimal.ts
- packages/schema/src/validation/decimal.test.ts
- packages/schema/src/validation/validate-arithmetic.ts
- packages/schema/src/validation/validate-arithmetic.test.ts
- packages/schema/src/validation/validate-document-payload.ts
- packages/schema/__fixtures__/invalid/arithmetic/line-total-mismatch-usd.json
- packages/schema/__fixtures__/invalid/arithmetic/line-total-half-up-edge.json
- packages/schema/__fixtures__/invalid/arithmetic/tax-total-mismatch.json
- packages/schema/__fixtures__/invalid/arithmetic/subtotal-mismatch.json
- packages/schema/__fixtures__/invalid/arithmetic/grand-total-mismatch-tax-exclusive.json
- packages/schema/__fixtures__/invalid/arithmetic/grand-total-mismatch-tax-inclusive.json
- packages/schema/__fixtures__/invalid/arithmetic/discount-exceeds-subtotal.json
- packages/schema/__fixtures__/invalid/arithmetic/jpy-fractional-line-total.json
- packages/schema/__fixtures__/invalid/arithmetic/usd-three-decimal-unit-price.json
- packages/schema/__fixtures__/invalid/arithmetic/multi-line-second-item-mismatch.json
- _bmad-output/implementation-artifacts/sprint-status.yaml

## Change Log

- 2026-07-20: story context created for business-rule arithmetic validators (Story 2.2)
- 2026-07-20: implemented arithmetic integrity validators with bigint decimal math, 10 failure fixtures, and full test coverage
- 2026-07-20: code review approved — adversarial decimal probes pass; regression tests added for pagination fixture, scale combos, and taxLines skip

## Senior Developer Review (AI)

_Reviewer: code-review subagent on 2026-07-20_

### Outcome

**APPROVED** — bigint decimal math verified against reference implementation; PRD §10.1 rules correctly implemented.

### Decimal-math probe summary

| Probe | Cases | Result |
| --- | --- | --- |
| Scale combos (qty 0–3dp × price 0–2dp × JPY/USD minor units) | 9,621 | PASS |
| Half-up boundaries (0.125×2, 3×0.335, 1×0.005, 1×1.005, etc.) | 6 | PASS |
| Quantity float scaling brute-force (i/1000 for i=1..999999) | 999,999 | PASS |
| String normalization (0.50 vs 0.5, 99.90 vs 99.9) | 3 | PASS |
| Huge values (15-digit amounts, 25-item sum) | 3 | PASS |
| Pagination-25 fixture subtotal drift | 1 | PASS |
| JPY zero-decimal multiply | 1 | PASS |

### PRD §10.1 cross-check

| Rule | Implementation | Verdict |
| --- | --- | --- |
| lineTotal = qty × unitPrice half-up | `multiplyQuantityByMoney` + `LINE_TOTAL_MISMATCH` at `/lineItems/{n}/lineTotal` | OK |
| subtotal = Σ lineTotals | `addMoneyAmounts` + `VALIDATION_FAILED` at `/totals/subtotal` | OK |
| taxTotal = Σ taxLines when present | skip when absent/`[]`; `TAX_TOTAL_MISMATCH` at `/totals/taxTotal` | OK |
| grandTotal tax-exclusive | subtotal − discount + taxTotal (declared totals) | OK |
| grandTotal tax-inclusive | subtotal − discount | OK |
| discount ≤ subtotal | `/discount` `VALIDATION_FAILED` | OK |
| FR-4 JPY / USD minor units | `validateMoneyMinorUnits` walk | OK |
| No float on money strings | grep clean; quantity uses `Math.round(qty*1000)` per dev notes | OK |
| Findings-not-throws, no mutation | pure function returns array | OK |
| Story 2.3 code seam | `codes.ts` exports three constants | OK |

### Findings

| Severity | Finding | Action |
| --- | --- | --- |
| LOW | `Math.round(quantity * 1000)` uses IEEE float on quantity — safe for ≤3dp per brute-force proof, but Story 2.6 could add string-based qty scaling if quantities ever become strings | noted |
| LOW | `.5` / leading-zero amounts handled in `decimal.ts` but rejected by `moneyAmountSchema` regex — defensive only | noted |
| — | Added regression tests: scale-combo property loop, huge-value sum, pagination-25 fixture, taxLines skip | fixed in review |

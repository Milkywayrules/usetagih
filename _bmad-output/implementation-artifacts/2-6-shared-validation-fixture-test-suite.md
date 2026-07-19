---
baseline_commit: 6ab6028ce6b8af954d878e2c19d640caccc2695d
---

# Story 2.6: Shared validation fixture test suite

Status: ready-for-dev

<!-- Ultimate context engine analysis completed - comprehensive developer guide created -->

## Story

As a QA engineer,
I want cross-package fixture tests proving schema completeness,
so that Epic 3 API inherits trusted validation (FR-2, SM-2 prep).

## Acceptance Criteria

1. **Given** fixtures under `packages/schema/__fixtures__/` with valid all-types payloads and **≥20** failure cases each paired with a sidecar `.expected.json`, **when** the table-driven fixture suite runs via `bun test packages/schema`, **then** **100%** of entries produce the declared pass/fail outcome through the canonical validation entry points (`validateDocumentPayload` and `checkDocumentTypeMismatch` where applicable).
2. **Given** the sidecar manifest convention (Dev Notes §Manifest convention), **when** SM-2 coverage is computed over all failure entries, **then** `entriesWithPathAndCode / totalFailureEntries ≥ 0.90` (PRD SM-2 target) — with the sidecar convention every failure entry MUST include `expected.path` + `expected.code`, so the suite assertion should be **100%** (≥0.90 is the floor, 1.0 is the implementation target).
3. **Given** the failure taxonomy in Dev Notes §Failure-case coverage map, **when** the corpus is complete, **then** every **payload-reachable** error code is exercised at least once: `VALIDATION_FAILED`, `UNSUPPORTED_SCHEMA_VERSION`, `DOCUMENT_TYPE_MISMATCH`, `LINE_TOTAL_MISMATCH`, `TAX_TOTAL_MISMATCH`; transport-only codes (`UNAUTHORIZED`, `FORBIDDEN`, `QUOTA_EXCEEDED`, `NOT_FOUND`, `IDEMPOTENCY_CONFLICT`, `RATE_LIMITED`, `INTERNAL_ERROR`, `INVALID_REQUEST`, `RENDER_TIMEOUT`) are **explicitly out of scope** — not reachable from payload validation alone.
4. **Given** valid fixtures for all three document types, **when** run through `validateDocumentPayload`, **then** each passes all stages (`schemaVersion` default → structural → business) with `ok: true`.
5. **Given** `packages/schema/src/guard/no-duplicate-zod.test.ts`, **when** `bun test packages/schema` runs, **then** no file under `packages/*/src/**` or `apps/*/src/**` imports `zod` or calls `z.object(` except the allowlist in Dev Notes §Duplicate-Zod guard — Epic 3 inherits AD-1 single-owner guarantee.
6. **Given** workspace, **when** `bunx turbo run lint typecheck test build --force` runs from repo root, **then** all tasks exit 0.
7. **Out of scope (Epic 3+):** HTTP status mapping in fixture runner, Elysia middleware, envelope builder wiring, Invovate benchmark scoring script (SM-2 human comparison deferred to launch checklist Story 8.8), CI grep workflow (optional per epics — bun test guard is sufficient for MVP).

## Tasks / Subtasks

- [ ] Task 1 — Manifest convention + inventory migration (AC: 1, 2, 3)
  - [ ] Create sidecar `.expected.json` for every valid and invalid fixture per Dev Notes §Manifest convention
  - [ ] Move top-level structural invalid fixtures into `__fixtures__/invalid/structural/` (update `document-payload.test.ts` paths)
  - [ ] Add gap fixtures listed in Dev Notes §Gap fixtures to fill (≥7 new JSON payloads + sidecars)
  - [ ] Add metadata-only document-type-mismatch sidecar under `__fixtures__/invalid/document-type-mismatch/`
- [ ] Task 2 — Table-driven runner (AC: 1, 2, 4)
  - [ ] Create `packages/schema/src/fixtures/runner.ts` — discovery, stage routing, finding extraction helpers
  - [ ] Create `packages/schema/src/fixtures/fixture-suite.test.ts` — drives all sidecar pairs; asserts pass/fail + path+code
  - [ ] Create `packages/schema/src/fixtures/sm2-coverage.test.ts` — computes and asserts SM-2 metric ≥0.90 (target 1.0)
  - [ ] Refactor `validate-arithmetic.test.ts` inline fixture table to load from sidecars OR delegate to shared discovery helper (avoid duplicate expected-path tables)
- [ ] Task 3 — Duplicate-Zod guard (AC: 5)
  - [ ] Create `packages/schema/src/guard/no-duplicate-zod.test.ts` per Dev Notes §Duplicate-Zod guard
- [ ] Task 4 — Verification gate (AC: 6)
  - [ ] `bun test packages/schema`
  - [ ] `bunx turbo run lint typecheck test build --force`

## Dev Notes

### Goal

Consolidate and complete the **shared validation fixture corpus** started in Stories 2.1–2.4. Epic 3 `ValidateUseCase` (Story 3.2) and SDK `validateLocally` (Story 7.1) will import the same fixtures — this story makes pass/fail outcomes **declarative, discoverable, and SM-2-measurable**.

### PRD FR-2 / SM-2 — what we measure

| Ref | Requirement for 2.6 |
| --- | --- |
| **FR-2** | Validation failures carry JSON Pointer `path`, machine `code`, human `message`, optional `expected`/`received` — no render on failure |
| **SM-2** | ≥90% of seeded failure fixtures include actionable `path` + `code` (benchmark vs Invovate — automated corpus prepares the seeded set) |
| **AD-1** | Sole Zod owner is `packages/schema` — guard test enforces for Epic 3 |

**Payload-validation scope (in):** codes reachable from `validateDocumentPayload()` + `checkDocumentTypeMismatch()`.

**Transport scope (out — do NOT add fixtures expecting these from payload validation):**

| Code | Why excluded |
| --- | --- |
| `UNAUTHORIZED`, `FORBIDDEN` | Auth middleware (Story 3.6) |
| `QUOTA_EXCEEDED`, `RATE_LIMITED` | Rate limit middleware (Story 3.15) |
| `NOT_FOUND` | Resource lookup / cross-tenant (Epic 3 routes) |
| `IDEMPOTENCY_CONFLICT` | Idempotency middleware (Story 3.7) |
| `INTERNAL_ERROR` | Unexpected server failure |
| `INVALID_REQUEST` | Malformed HTTP/request params — Epic 3 maps some cases; schema structural failures use `VALIDATION_FAILED` in details |
| `RENDER_TIMEOUT` | Webhook `render.failed` metadata (PRD §10.5), not REST envelope |

### Current fixture inventory (Stories 2.1–2.4 — read before editing)

| Category | Path | Count | Sidecar today | Expected path+code in tests |
| --- | --- | ---: | --- | --- |
| **Valid all-types** | `__fixtures__/valid/invoice-minimal.json` | 1 | ❌ | implicit pass in `validate-document-payload.test.ts` |
| | `__fixtures__/valid/quotation-minimal.json` | 1 | ❌ | implicit pass in `document-payload.test.ts` |
| | `__fixtures__/valid/receipt-minimal.json` | 1 | ❌ | implicit pass in `document-payload.test.ts` |
| **Arithmetic (Story 2.2)** | `__fixtures__/invalid/arithmetic/*.json` | **10** | ❌ | inline table in `validate-arithmetic.test.ts` |
| **Structural (Story 2.1)** | `__fixtures__/invalid/invoice-with-logo-bytes.json` | 1 | ❌ | throw-only in `document-payload.test.ts` |
| | `__fixtures__/invalid/receipt-with-due-at.json` | 1 | ❌ | throw-only |
| | `__fixtures__/invalid/invoice-with-paid-at.json` | 1 | ❌ | throw-only |
| **Total failure JSON** | | **13** | **0 sidecars** | **need ≥20 → add ≥7** |

**Gaps to fill:** schema-version rejection, additional structural violations, document-type mismatch metadata entry, sidecars for **all** entries.

### Manifest convention — decision (encode exactly)

**Sidecar JSON** paired by basename in the same directory:

| File | Purpose |
| --- | --- |
| `{name}.json` | Payload (valid or invalid) — unchanged JSON for copy/paste into docs |
| `{name}.expected.json` | Declared outcome — **source of truth** for table-driven runner |

**Do not** embed expected outcomes inside payload JSON (keeps fixtures portable for render/SDK docs).

**Sidecar schema:**

```typescript
import type { ErrorCode } from "../errors/codes";
import type { DocumentType } from "../document/document-type";

/** Pass entry — valid fixtures only */
type FixtureExpectedPass = { outcome: "pass" };

/** Fail via validateDocumentPayload */
type FixtureExpectedFailPayload = {
  outcome: "fail";
  stage: "schemaVersion" | "structural" | "business";
  expected: { path: string; code: ErrorCode };
};

/** Fail via checkDocumentTypeMismatch — no payload .json required */
type FixtureExpectedFailDocumentTypeMismatch = {
  outcome: "fail";
  stage: "documentTypeMismatch";
  pathDocumentType: DocumentType;
  body: Record<string, unknown>;
  expected: { path: "/documentType"; code: "DOCUMENT_TYPE_MISMATCH" };
};

type FixtureExpectedOutcome =
  | FixtureExpectedPass
  | FixtureExpectedFailPayload
  | FixtureExpectedFailDocumentTypeMismatch;
```

**Discovery rule:** glob `__fixtures__/**/*.json`, exclude `*.expected.json`. For each payload file, require sibling `{sameBasename}.expected.json`. For document-type-mismatch, allow `.expected.json` without payload when `stage === "documentTypeMismatch"`.

**Directory layout after migration:**

```text
packages/schema/__fixtures__/
├── valid/
│   ├── invoice-minimal.json + .expected.json
│   ├── quotation-minimal.json + .expected.json
│   └── receipt-minimal.json + .expected.json
├── invalid/
│   ├── arithmetic/          # 10 existing — add sidecars only
│   ├── structural/          # move 3 existing + add new structural gaps
│   ├── schema-version/      # new
│   └── document-type-mismatch/
│       └── invoice-path-receipt-body.expected.json  # metadata-only
```

### Failure-case coverage map — exact corpus (22 entries)

Implement **exactly** these failure entries (path + code). Existing JSON may be moved/renamed only where noted.

#### Stage: `schemaVersion` (1)

| Sidecar basename | Payload file | `expected.path` | `expected.code` |
| --- | --- | --- | --- |
| `unsupported-2025-01-01` | `invalid/schema-version/unsupported-2025-01-01.json` | `/schemaVersion` | `UNSUPPORTED_SCHEMA_VERSION` |

Payload: copy `invoice-minimal.json`, set `"schemaVersion": "2025-01-01"`.

#### Stage: `documentTypeMismatch` (1)

| Sidecar | Payload | `expected.path` | `expected.code` |
| --- | --- | --- | --- |
| `invoice-path-receipt-body.expected.json` | *(none)* | `/documentType` | `DOCUMENT_TYPE_MISMATCH` |

Sidecar content:

```json
{
  "outcome": "fail",
  "stage": "documentTypeMismatch",
  "pathDocumentType": "invoice",
  "body": { "documentType": "receipt" },
  "expected": { "path": "/documentType", "code": "DOCUMENT_TYPE_MISMATCH" }
}
```

Runner calls `checkDocumentTypeMismatch("invoice", { documentType: "receipt" })`.

#### Stage: `structural` (10)

| Sidecar basename | Payload | `expected.path` | `expected.code` | Notes |
| --- | --- | --- | --- | --- |
| `invoice-with-logo-bytes` | move to `invalid/structural/` | `/branding/logoBytes` | `VALIDATION_FAILED` | existing — strict unrecognized key |
| `receipt-with-due-at` | move to `invalid/structural/` | `/dueAt` | `VALIDATION_FAILED` | existing — cross-type field |
| `invoice-with-paid-at` | move to `invalid/structural/` | `/paidAt` | `VALIDATION_FAILED` | existing — cross-type field |
| `missing-buyer-invoice` | **new** | `/buyer` | `VALIDATION_FAILED` | omit required buyer on invoice |
| `invalid-currency-xxx` | **new** | `/currency` | `VALIDATION_FAILED` | `"currency": "XXX"` |
| `invalid-issued-at` | **new** | `/issuedAt` | `VALIDATION_FAILED` | `"issuedAt": "20-07-2026"` |
| `invalid-template-enum` | **new** | `/template` | `VALIDATION_FAILED` | `"template": "retro"` |
| `quantity-four-decimals` | **new** | `/lineItems/0/quantity` | `VALIDATION_FAILED` | `"quantity": 1.2345` |
| `empty-line-items` | **new** | `/lineItems` | `VALIDATION_FAILED` | `"lineItems": []` |
| `quotation-with-due-at` | **new** | `/dueAt` | `VALIDATION_FAILED` | quotation payload + `dueAt` (invoice-only field) |

#### Stage: `business` (10 — existing arithmetic fixtures)

Keep filenames under `invalid/arithmetic/`. Add sidecars; expected primary finding:

| Fixture file | `expected.path` | `expected.code` |
| --- | --- | --- |
| `line-total-mismatch-usd.json` | `/lineItems/0/lineTotal` | `LINE_TOTAL_MISMATCH` |
| `line-total-half-up-edge.json` | `/lineItems/0/lineTotal` | `LINE_TOTAL_MISMATCH` |
| `multi-line-second-item-mismatch.json` | `/lineItems/1/lineTotal` | `LINE_TOTAL_MISMATCH` |
| `tax-total-mismatch.json` | `/totals/taxTotal` | `TAX_TOTAL_MISMATCH` |
| `subtotal-mismatch.json` | `/totals/subtotal` | `VALIDATION_FAILED` |
| `grand-total-mismatch-tax-exclusive.json` | `/totals/grandTotal` | `VALIDATION_FAILED` |
| `grand-total-mismatch-tax-inclusive.json` | `/totals/grandTotal` | `VALIDATION_FAILED` |
| `discount-exceeds-subtotal.json` | `/discount` | `VALIDATION_FAILED` |
| `jpy-fractional-line-total.json` | `/lineItems/0/lineTotal` | `VALIDATION_FAILED` |
| `usd-three-decimal-unit-price.json` | `/lineItems/0/unitPrice` | `VALIDATION_FAILED` |

**Valid pass sidecars (3):** each `{ "outcome": "pass" }` for the three minimal valid fixtures.

**Total:** 3 pass + 22 fail = **25** manifest entries; **22** failure cases satisfies epics ≥20.

**Example sidecars:**

`valid/invoice-minimal.expected.json`:

```json
{ "outcome": "pass" }
```

`invalid/arithmetic/tax-total-mismatch.expected.json`:

```json
{
  "outcome": "fail",
  "stage": "business",
  "expected": { "path": "/totals/taxTotal", "code": "TAX_TOTAL_MISMATCH" }
}
```

`invalid/schema-version/unsupported-2025-01-01.expected.json`:

```json
{
  "outcome": "fail",
  "stage": "schemaVersion",
  "expected": { "path": "/schemaVersion", "code": "UNSUPPORTED_SCHEMA_VERSION" }
}
```

### Table-driven runner design (implement exactly)

**Files:**

```text
packages/schema/src/fixtures/
├── runner.ts              # discovery + validation orchestration helpers
├── fixture-suite.test.ts  # AC 1 — 100% pass/fail outcomes
└── sm2-coverage.test.ts   # AC 2 — metric computation
```

**`runner.ts` exports:**

```typescript
export function discoverFixturePairs(fixturesRoot: string): FixturePair[];

export function zodErrorToPrimaryJsonPointer(error: z.ZodError): {
  path: string;
  code: typeof VALIDATION_FAILED_CODE;
};

export function extractPrimaryFinding(
  result: Exclude<ValidateDocumentPayloadResult, { ok: true }>,
): { path: string; code: ErrorCode };

export function runFixtureExpectation(
  payload: unknown | null,
  expected: FixtureExpectedOutcome,
): void;
```

**Stage routing in `extractPrimaryFinding`:**

| `ValidateDocumentPayloadResult.stage` | Primary finding |
| --- | --- |
| `schemaVersion` | `{ path: "/schemaVersion", code: rejection.code }` |
| `structural` | first Zod issue → JSON Pointer via `zodErrorToPrimaryJsonPointer` → `code: VALIDATION_FAILED` |
| `business` | first entry in `findings[]` (deterministic: validator returns ordered findings — use `[0]`) |

**`zodErrorToPrimaryJsonPointer` algorithm:**

```typescript
function zodPathToJsonPointer(path: PropertyKey[]): string {
  if (path.length === 0) return "";
  return path
    .map((segment) =>
      typeof segment === "number" ? `/${segment}` : `/${String(segment)}`,
    )
    .join("");
}
// use error.issues[0].path — if empty string, use "/" only when sidecar expects root (none in this corpus)
```

**`fixture-suite.test.ts` behavior:**

1. Discover all pairs via `discoverFixturePairs`.
2. For each pass entry: `validateDocumentPayload(payload)` → `ok: true`.
3. For each fail entry with payload: `validateDocumentPayload(payload)` → `ok: false`, compare `extractPrimaryFinding` to sidecar `expected`.
4. For document-type-mismatch entries: assert `checkDocumentTypeMismatch` returns `match: false` with sidecar `expected`.
5. Fail test if any payload JSON lacks sidecar or any sidecar lacks `expected.path`+`expected.code` on failure entries.

**Keep existing unit tests** (`decimal.test.ts`, `codes.test.ts`, etc.) — do not delete Story 2.2 arithmetic edge tests; dedupe only the inline `arithmeticFailureFixtures` table by reading sidecars instead.

### SM-2 metric computation (implement exactly)

In `sm2-coverage.test.ts`:

```typescript
const failures = allExpectedOutcomes.filter((e) => e.outcome === "fail");
const withPathCode = failures.filter(
  (e) => e.expected?.path && e.expected?.code,
);
const ratio = withPathCode.length / failures.length;

expect(ratio).toBeGreaterThanOrEqual(0.9); // PRD SM-2 floor
expect(ratio).toBe(1); // sidecar convention — all 22 failures annotated
```

Also assert each payload-reachable code appears ≥1 time (coverage map guard):

```typescript
const codes = new Set(withPathCode.map((e) => e.expected.code));
for (const code of [
  "VALIDATION_FAILED",
  "UNSUPPORTED_SCHEMA_VERSION",
  "DOCUMENT_TYPE_MISMATCH",
  "LINE_TOTAL_MISMATCH",
  "TAX_TOTAL_MISMATCH",
] as const) {
  expect(codes.has(code)).toBe(true);
}
```

### Duplicate-Zod guard — decision (implement exactly)

**File:** `packages/schema/src/guard/no-duplicate-zod.test.ts`

**Scan roots (relative to repo root):**

- `packages/*/src/**/*.ts`
- `apps/*/src/**/*.ts`

**Exclude from scan:**

- `packages/schema/**` (canonical owner)
- `**/node_modules/**`, `**/dist/**`

**Allowlist (exact paths — Story 0.6 env validation exception):**

- `packages/config/src/env/schema.ts`

**Violation patterns (any match → test fails):**

- `/from\s+["']zod["']/`
- `/\bz\.object\s*\(/`

**Implementation sketch:**

```typescript
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const ALLOWLIST = new Set(["packages/config/src/env/schema.ts"]);
const SCAN_ROOTS = ["packages", "apps"];

function collectTsFiles(dir: string): string[] { /* recursive, skip node_modules/dist */ }

test("no duplicate zod definitions outside packages/schema", () => {
  const violations: string[] = [];
  for (const file of allScannedFiles) {
    const rel = relative(repoRoot, file);
    if (rel.startsWith("packages/schema/")) continue;
    if (ALLOWLIST.has(rel)) continue;
    const src = readFileSync(file, "utf8");
    if (/from\s+["']zod["']/.test(src) || /\bz\.object\s*\(/.test(src)) {
      violations.push(rel);
    }
  }
  expect(violations).toEqual([]);
});
```

Epics mark CI grep as optional — this bun test is the enforced MVP guard.

### Validation entry point (use — do not reimplement)

```typescript
// packages/schema/src/validation/validate-document-payload.ts
validateDocumentPayload(raw) →
  | { ok: true, data }
  | { ok: false, stage: "schemaVersion", rejection }
  | { ok: false, stage: "structural", error: ZodError }
  | { ok: false, stage: "business", findings: BusinessRuleFinding[] }
```

Epic 3 `ValidateUseCase` will call the same function — fixture suite proves end-to-end behavior.

### Epic 2 cross-story boundaries

| Story | Owns | Not in 2.6 |
| --- | --- | --- |
| **2.1 (done)** | Structural fixtures, `checkDocumentTypeMismatch` | — |
| **2.2 (done)** | 10 arithmetic failure JSON files | sidecars, unified runner |
| **2.3 (done)** | `ErrorCode` enum, envelope types | HTTP wiring |
| **2.4 (done)** | `validateDocumentPayload` orchestration | — |
| **2.5 (done)** | OpenAPI components | fixture expansion |
| **2.6 (this)** | Sidecar manifest, ≥20 failure corpus, SM-2 metric, duplicate-zod guard | API routes, Invovate manual benchmark |

Completing 2.6 is the **last Epic 2 story** — after done, epic can move to retrospective.

### Previous story intelligence

| Source | Learning for 2.6 |
| --- | --- |
| Story 2.2 | Arithmetic fixtures + inline expected table in `validate-arithmetic.test.ts` — migrate to sidecars |
| Story 2.3 | Structural failures map to `VALIDATION_FAILED`; dedicated codes for line/tax mismatch |
| Story 2.4 | `validateDocumentPayload` stage routing; version failure uses `UNSUPPORTED_SCHEMA_VERSION` |
| Story 2.5 | Do not commit generated artifacts; structural tests over snapshots — same pattern for fixture runner |

### Git intelligence (recent Epic 2 work)

| Commit | Relevance |
| --- | --- |
| `6ab6028` | Story 2.5 done — current baseline |
| `81f583a` | OpenAPI generation hardening — keep guard tests separate |
| `0abc3cb` | OpenAPI components from Zod — AD-1 pattern to enforce |

### Environment facts (do not guess)

| Fact | Value |
| --- | --- |
| Baseline commit | `6ab6028ce6b8af954d878e2c19d640caccc2695d` |
| Fixtures root | `packages/schema/__fixtures__/` |
| Validation orchestrator | `validateDocumentPayload()` in `src/validation/validate-document-payload.ts` |
| Turbo verification | `bunx turbo run lint typecheck test build --force` |
| Unit tests | `bun test packages/schema` |
| Current failure JSON count | 13 — **add ≥7** |
| SM-2 target | ≥90% path+code on failure fixtures; implement 100% via sidecars |

### Anti-patterns (do not)

- Do not add expected outcomes inside payload JSON files.
- Do not expect transport error codes from `validateDocumentPayload` alone.
- Do not duplicate Zod schemas in `apps/` or other packages — guard test must fail if attempted.
- Do not remove Story 2.2 decimal unit tests — only dedupe fixture expectation tables.
- Do not add OpenAPI or HTTP route code.
- Do not modify render golden hashes or Typst templates.

### References

- [Source: `_bmad-output/planning-artifacts/epics.md` — Story 2.6 ACs]
- [Source: `_bmad-output/planning-artifacts/prds/prd-usetagih-2026-07-20/prd.md` — FR-2, SM-2]
- [Source: `_bmad-output/planning-artifacts/architecture/architecture-usetagih-2026-07-20/ARCHITECTURE-SPINE.md` — AD-1]
- [Source: `_bmad-output/implementation-artifacts/2-1-document-payload-zod-discriminated-union.md` — fixture strategy]
- [Source: `_bmad-output/implementation-artifacts/2-2-business-rule-validators-for-arithmetic-integrity.md` — arithmetic fixtures]
- [Source: `_bmad-output/implementation-artifacts/2-4-schema-version-negotiation-helpers.md` — validateDocumentPayload stages]
- [Source: `packages/schema/src/validation/validate-document-payload.ts`]
- [Source: `packages/schema/src/document/document-type-mismatch.ts`]

## Dev Agent Record

### Agent Model Used

Composer 2.5

### Debug Log References

### Completion Notes List

### File List

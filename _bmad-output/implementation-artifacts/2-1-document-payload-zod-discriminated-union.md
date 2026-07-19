---
baseline_commit: aa3552e331c92f29c730a4e24117ee1e5bbcfe9b
---

# Story 2.1: Document payload Zod discriminated union

Status: review

<!-- Ultimate context engine analysis completed - comprehensive developer guide created -->

## Story

As an integrator,
I want `packages/schema` exporting DocumentPayload union per PRD §10.1,
so that all runtimes parse identical contract (FR-1, AD-1).

## Acceptance Criteria

1. **Given** `packages/schema` exports Zod schemas and inferred TypeScript types for `Money`, `Party`, `Address`, `LineItem`, `TaxLine`, `Branding`, `BaseDocumentPayload`, `InvoicePayload`, `QuotationPayload`, `ReceiptPayload`, and `DocumentPayload`, **when** `package.json` declares `"zod": "^4.4.3"` (same pin as `@usetagih/config`), **then** all schemas live under `packages/schema/src/document/` per Dev Notes §File layout and `src/index.ts` re-exports the public surface (no duplicate Zod outside this package).
2. **Given** dedicated minimal valid fixtures for all three document types in `packages/schema/__fixtures__/valid/`, **when** `DocumentPayloadSchema.parse()` runs on each, **then** parse succeeds and inferred `documentType` discriminant matches fixture.
3. **Given** `packages/render/__fixtures__/payloads/invoice-modern-basic.json` (PRD-conformant, no spike extensions), **when** parsed through `DocumentPayloadSchema`, **then** parse succeeds (conformance proof against Epic 1 render corpus).
4. **Given** `.strict()` on every object schema (see Dev Notes §Strictness), **when** payload includes unknown keys — including `branding.logoBytes` from Epic 1 spike fixtures — **then** parse fails with Zod unrecognized-key error (proves canonical schema excludes render-internal extensions).
5. **Given** discriminated union on `documentType`, **when** cross-type-only fields appear (e.g. `dueAt` on receipt, `paidAt` on invoice, `validUntil` on invoice), **then** parse fails (strict + variant shape enforcement).
6. **Given** path `documentType` authoritative per PRD §10.1, **when** `checkDocumentTypeMismatch(pathDocumentType, body)` runs, **then** returns `{ match: false, code: "DOCUMENT_TYPE_MISMATCH", ... }` when body includes mismatched `documentType`; returns `{ match: true }` when body omits `documentType` or matches path (Story 2.3 maps code → HTTP 400; out of scope here).
7. **Given** `bun test packages/schema`, **when** test suite runs, **then** covers: all three valid minimal fixtures, render basic fixture conformance, strict rejection of `logoBytes`, cross-type field rejection, and mismatch helper cases (match / mismatch / omitted body type).
8. **Given** workspace, **when** `bunx turbo run lint typecheck test build --force` runs from repo root, **then** all tasks exit 0.
9. **Out of scope (Stories 2.2–2.6, Epic 3):** arithmetic business rules (`LINE_TOTAL_MISMATCH`, `TAX_TOTAL_MISMATCH`), error envelope builder, `schemaVersion` defaulting/negotiation, OpenAPI generation, HTTPS fetch/SSRF logo pipeline, render package changes to golden fixtures, modifying render logo fixtures to drop `logoBytes`.

## Tasks / Subtasks

- [x] Task 1 — Package wiring (AC: 1)
  - [x] Add `"zod": "^4.4.3"` to `packages/schema/package.json` dependencies
  - [x] Remove `SCHEMA_STUB`; implement real exports in `src/index.ts`
- [x] Task 2 — Primitive + shared schemas (AC: 1, 4)
  - [x] Create `src/document/primitives.ts` with reusable string/number validators per Dev Notes §Field constraints
  - [x] Create `money.ts`, `address.ts`, `party.ts`, `line-item.ts`, `tax-line.ts`, `branding.ts`, `totals.ts`, `metadata.ts`, `base-document-payload.ts`
- [x] Task 3 — Document variants + union (AC: 1, 5)
  - [x] Create `invoice-payload.ts`, `quotation-payload.ts`, `receipt-payload.ts`
  - [x] Create `document-payload.ts` with `z.discriminatedUnion("documentType", [...])` exporting `DocumentPayloadSchema` + type
  - [x] Create `document-type.ts` with `DocumentType` const + schema
- [x] Task 4 — Path/body mismatch helper (AC: 6)
  - [x] Create `document-type-mismatch.ts` with `checkDocumentTypeMismatch()` + `DOCUMENT_TYPE_MISMATCH_CODE`
- [x] Task 5 — Fixtures + tests (AC: 2, 3, 4, 5, 7)
  - [x] Add `__fixtures__/valid/{invoice,quotation,receipt}-minimal.json`
  - [x] Add `__fixtures__/invalid/` cases per Dev Notes §Invalid fixtures
  - [x] Replace `src/index.test.ts` stub with `src/document/document-payload.test.ts` (+ keep index smoke if desired)
- [x] Task 6 — Verification gate (AC: 8)
  - [x] `bun test packages/schema`
  - [x] `bunx turbo run lint typecheck test build --force`

## Dev Notes

### Goal

Replace Story 0.1 schema stub with the **canonical structural contract** for all document payloads (FR-1, AD-1). First story of Epic 2 — gates Epic 3 API validate/preview/render paths. Spike gate PASS (Story 1.9) unblocks this work.

### Epic 2 cross-story boundaries

| Story | Owns | Not in 2.1 |
| --- | --- | --- |
| **2.1 (this)** | Structural Zod union, `.strict()` object shapes, `checkDocumentTypeMismatch` | — |
| 2.2 | `LINE_TOTAL_MISMATCH`, `TAX_TOTAL_MISMATCH`, quantity precision business rules, JPY fractional rejection | Arithmetic validators |
| 2.3 | Error codes enum, `{ error: { code, message, requestId, details[] } }` builder | HTTP mapping beyond exporting mismatch code string |
| 2.4 | `schemaVersion` default `2026-07-20`, unsupported version rejection, `getSchemaMetadata()` | Default injection at parse time |
| 2.5 | OpenAPI 3.1 generation from Zod | `@asteasolutions/zod-to-openapi` |
| 2.6 | ≥20 failure fixtures, SM-2 path+code coverage | Large fixture corpus |

### logoBytes vs canonical schema (board decision for 2.1)

**Decision: `branding.logoBytes` does NOT enter canonical `DocumentPayload` schema in Story 2.1.**

| Layer | Branding shape | Rationale |
| --- | --- | --- |
| **Canonical API payload (PRD §10.1)** | `{ logoUrl?: string; accentColor?: string }` only | Board-ratified contract; clients send HTTPS URL; Epic 3.9 fetches once, persists bytes + checksum on render record |
| **Render spike extension (Story 1.6)** | `branding.logoBytes?: { contentType; bytesBase64 }` | CI-only simulation of **post-fetch persisted bytes**; render driver reads JSON directly — not an API request field |
| **Resolution path** | Render logo fixtures (`invoice-modern-logo-*.json`) keep `logoBytes` unchanged; they **must fail** `DocumentPayloadSchema.parse()` under `.strict()`. Conformance tests use `invoice-modern-basic.json` (no `logoBytes`). Future render adapter (Epic 3+) strips internal fields before API validation or uses a separate internal type in `packages/render` — do not widen canonical schema for test convenience. |

Story 1.6 Dev Notes said "Epic 2 Zod will formalize persisted bytes" — **superseded** by PRD §10.1 authority and Epic 3.9 scope (URL ingest → persisted bytes on record, not on request payload).

### Strictness decision

**Use `.strict()` on every `z.object()` in this story** (including nested `totals`, `Branding`, `Party`, payload variants).

- Rejects unknown keys (`logoBytes`, `dueAt` on wrong type, etc.) at the offending object level.
- Aligns with AD-1 single canonical contract — no silent stripping of integrator typos.
- Do **not** use `.passthrough()` or `.strip()` on document payload objects.
- Top-level parse entrypoint: `DocumentPayloadSchema` only (discriminated union of strict variants).

### Environment facts (do not guess)

| Fact | Value |
| --- | --- |
| Spike gate | PASS — Epics 2+ unblocked (`packages/render/SPIKE-RESULT.md`) |
| Zod version | `^4.4.3` in `packages/config/package.json` — pin identical in `@usetagih/schema` |
| Import style | `import { z } from "zod"` (Zod 4 classic API, same as `packages/config/src/env/schema.ts`) |
| Schema stub today | `packages/schema/src/index.ts` exports `SCHEMA_STUB` only |
| Render PRD-conformant fixture | `packages/render/__fixtures__/payloads/invoice-modern-basic.json` |
| Render spike fixtures (non-canonical) | `invoice-modern-logo-{png,jpeg,svg}.json` — contain `branding.logoBytes` |
| Turbo verification | `bunx turbo run lint typecheck test build --force` |
| Unit tests | `bun test packages/schema` |

### File layout (implement exactly)

```text
packages/schema/
├── package.json                    # add zod dependency; keep existing scripts
├── src/
│   ├── index.ts                    # public exports (schemas, types, mismatch helper)
│   └── document/
│       ├── primitives.ts           # shared string/number refinements
│       ├── money.ts
│       ├── address.ts
│       ├── party.ts
│       ├── line-item.ts
│       ├── tax-line.ts
│       ├── branding.ts
│       ├── totals.ts
│       ├── metadata.ts
│       ├── base-document-payload.ts
│       ├── invoice-payload.ts
│       ├── quotation-payload.ts
│       ├── receipt-payload.ts
│       ├── document-type.ts
│       ├── document-payload.ts
│       ├── document-type-mismatch.ts
│       └── document-payload.test.ts
└── __fixtures__/
    ├── valid/
    │   ├── invoice-minimal.json
    │   ├── quotation-minimal.json
    │   └── receipt-minimal.json
    └── invalid/
        ├── invoice-with-logo-bytes.json
        ├── receipt-with-due-at.json
        └── invoice-with-paid-at.json
```

Do **not** create `src/errors/` yet (Story 2.3). Do **not** create `src/openapi/` yet (Story 2.5).

### Field constraints (PRD §10.1 — encode exactly)

All `z.object()` below use `.strict()` unless noted.

#### Primitives (`primitives.ts`)

| Export | Rule |
| --- | --- |
| `moneyAmountSchema` | `z.string()` matching `^(?:0\|[1-9]\d*)(?:\.\d+)?$` — non-negative base-10 decimal, **no** exponent (`e`/`E`), no leading-only dot |
| `isoDateSchema` | `z.string().regex(/^\d{4}-\d{2}-\d{2}$/)` — ISO 8601 date (calendar validity refine optional; invalid dates may pass structural parse — Story 2.2 can tighten) |
| `isoCountrySchema` | `z.string().length(2).regex(/^[A-Z]{2}$/)` — ISO 3166-1 alpha-2 |
| `isoCurrencySchema` | `z.string().length(3).regex(/^[A-Z]{3}$/)` — ISO 4217 code |
| `cssHexColorSchema` | `z.string().regex(/^#[0-9A-Fa-f]{6}$/)` |
| `httpsUrlSchema` | `z.string().url()` + refine `url.startsWith("https://")` |
| `quantitySchema` | `z.number().positive()` + refine ≤3 fractional digits (stringify split; **reject** beyond precision — do not round) |
| `taxRateSchema` | `z.number().min(0).max(1)` |
| `templateSchema` | `z.enum(["modern", "classic"])` |
| `schemaVersionSchema` | `z.literal("2026-07-20")` — **optional on base payload; no default in 2.1** (Story 2.4) |
| `documentTypeSchema` | `z.enum(["invoice", "quotation", "receipt"])` |

#### `Money`

```typescript
{ amount: moneyAmountSchema }
```

#### `Address`

| Field | Schema |
| --- | --- |
| `line1` | `z.string().max(200)` required |
| `line2` | `z.string().max(200).optional()` |
| `city` | `z.string().max(100)` required |
| `region` | `z.string().max(100).optional()` |
| `postalCode` | `z.string().max(20).optional()` |
| `country` | `isoCountrySchema` required |

#### `Party`

| Field | Schema |
| --- | --- |
| `name` | `z.string().max(200)` required |
| `email` | `z.string().max(254).optional()` |
| `address` | `AddressSchema.optional()` |
| `taxId` | `z.string().max(50).optional()` |

#### `LineItem`

| Field | Schema |
| --- | --- |
| `description` | `z.string().max(500)` |
| `quantity` | `quantitySchema` |
| `unit` | `z.string().max(50).optional()` |
| `unitPrice` | `MoneySchema` |
| `taxRate` | `taxRateSchema.optional()` |
| `lineTotal` | `MoneySchema` |

#### `TaxLine`

| Field | Schema |
| --- | --- |
| `name` | `z.string().max(100)` |
| `rate` | `taxRateSchema` |
| `amount` | `MoneySchema` |

#### `Branding` (canonical only)

```typescript
z.object({
  logoUrl: httpsUrlSchema.optional(),
  accentColor: cssHexColorSchema.optional(),
}).strict()
```

**No `logoBytes`.**

#### `totals` object (nested in base)

```typescript
z.object({
  subtotal: MoneySchema,
  taxTotal: MoneySchema,
  grandTotal: MoneySchema,
}).strict()
```

#### `metadata`

`z.record(z.string().max(64), z.string().max(256)).refine(o => Object.keys(o).length <= 20)` — optional on base payload.

#### `BaseDocumentPayload` (shared fields — not exported as standalone parse entry)

| Field | Schema |
| --- | --- |
| `schemaVersion` | `schemaVersionSchema.optional()` |
| `template` | `templateSchema` required |
| `documentNumber` | `z.string().max(64)` |
| `issuedAt` | `isoDateSchema` |
| `currency` | `isoCurrencySchema` |
| `seller` | `PartySchema` |
| `lineItems` | `z.array(LineItemSchema).min(1).max(500)` |
| `taxLines` | `z.array(TaxLineSchema).max(10).optional()` |
| `discount` | `MoneySchema.optional()` |
| `pricesIncludeTax` | `z.boolean().optional()` — default `false` at business layer (2.2), not injected here |
| `totals` | `TotalsSchema` |
| `notes` | `z.string().max(2000).optional()` |
| `metadata` | `MetadataSchema.optional()` |
| `branding` | `BrandingSchema.optional()` |
| `shareTtlDays` | `z.number().int().min(1).max(365).optional()` — default 90 at API layer later |

Build base shape via spread/merge into each variant (avoid duplicating field definitions three times — single `baseDocumentPayloadShape` object passed to `z.object({...}).strict()`).

#### Variant-specific fields

**InvoicePayload** — extends base + required discriminant:

| Field | Schema |
| --- | --- |
| `documentType` | `z.literal("invoice")` |
| `dueAt` | `isoDateSchema.optional()` |
| `buyer` | `PartySchema` required |

**QuotationPayload**:

| Field | Schema |
| --- | --- |
| `documentType` | `z.literal("quotation")` |
| `validUntil` | `isoDateSchema.optional()` |
| `buyer` | `PartySchema` required |

**ReceiptPayload**:

| Field | Schema |
| --- | --- |
| `documentType` | `z.literal("receipt")` |
| `paidAt` | `isoDateSchema.optional()` |
| `paymentReference` | `z.string().max(128).optional()` |
| `buyer` | `PartySchema.optional()` |

#### Discriminated union (`document-payload.ts`)

```typescript
export const DocumentPayloadSchema = z.discriminatedUnion("documentType", [
  InvoicePayloadSchema,
  QuotationPayloadSchema,
  ReceiptPayloadSchema,
]);
export type DocumentPayload = z.infer<typeof DocumentPayloadSchema>;
```

Export individual variant schemas for OpenAPI story reuse.

### `checkDocumentTypeMismatch` (`document-type-mismatch.ts`)

```typescript
export const DOCUMENT_TYPE_MISMATCH_CODE = "DOCUMENT_TYPE_MISMATCH" as const;

export type DocumentType = z.infer<typeof DocumentTypeSchema>;

export type DocumentTypeMismatchResult =
  | { match: true }
  | {
      match: false;
      code: typeof DOCUMENT_TYPE_MISMATCH_CODE;
      message: string;
      pathDocumentType: DocumentType;
      bodyDocumentType: DocumentType;
    };

export function checkDocumentTypeMismatch(
  pathDocumentType: DocumentType,
  body: { documentType?: unknown },
): DocumentTypeMismatchResult;
```

**Behavior:**

| Condition | Result |
| --- | --- |
| `body.documentType` undefined / absent | `{ match: true }` — path authoritative; body need not repeat discriminant |
| `body.documentType` equals `pathDocumentType` | `{ match: true }` |
| `body.documentType` present and differs | `{ match: false, code: "DOCUMENT_TYPE_MISMATCH", message: "documentType in body (…) does not match path (…)", pathDocumentType, bodyDocumentType }` |
| `body.documentType` present but not a valid enum string | `{ match: false, ... }` — treat as mismatch (body type coerced/stringified for message) |

Do **not** HTTP-map here — return code only; Story 2.3 + API route wire to 400.

### Public exports (`src/index.ts`)

Export at minimum:

- `DocumentPayloadSchema`, `DocumentPayload`
- `InvoicePayloadSchema`, `QuotationPayloadSchema`, `ReceiptPayloadSchema`
- Constituent schemas/types (`MoneySchema`, `PartySchema`, …) needed by Story 2.5 OpenAPI
- `DocumentType`, `DocumentTypeSchema`
- `checkDocumentTypeMismatch`, `DOCUMENT_TYPE_MISMATCH_CODE`

Remove `SCHEMA_STUB`.

### Fixture strategy

**Dedicated minimal fixtures** (schema-owned, all three types):

- `invoice-minimal.json` — smallest valid invoice (1 line item, USD, modern template, required buyer/seller)
- `quotation-minimal.json` — same economic data, `documentType: "quotation"`, optional `validUntil`
- `receipt-minimal.json` — same economic data, `documentType: "receipt"`, omit `buyer` to prove optional

Derive monetary values from `invoice-modern-basic.json` line items/totals so arithmetic stays internally consistent (business validation deferred to 2.2).

**Minimal fixture skeletons** (copy/adapt — keep totals aligned with single line item `10 × 9.99 = 99.90` + 8.25% tax):

`__fixtures__/valid/invoice-minimal.json`:

```json
{
  "schemaVersion": "2026-07-20",
  "documentType": "invoice",
  "template": "modern",
  "documentNumber": "INV-MIN-001",
  "issuedAt": "2026-07-20",
  "dueAt": "2026-08-20",
  "currency": "USD",
  "seller": { "name": "Seller Co" },
  "buyer": { "name": "Buyer Co" },
  "lineItems": [
    {
      "description": "Minimal line",
      "quantity": 10,
      "unitPrice": { "amount": "9.99" },
      "lineTotal": { "amount": "99.90" }
    }
  ],
  "totals": {
    "subtotal": { "amount": "99.90" },
    "taxTotal": { "amount": "8.24" },
    "grandTotal": { "amount": "108.14" }
  }
}
```

`quotation-minimal.json` — same as above with `"documentType": "quotation"`, `"documentNumber": "QUO-MIN-001"`, replace `dueAt` → `"validUntil": "2026-09-20"`, omit `dueAt`.

`receipt-minimal.json` — same economic block with `"documentType": "receipt"`, `"documentNumber": "REC-MIN-001"`, omit `buyer`, optional `"paidAt": "2026-07-20"`.

**Render fixture conformance** (read-only import in test):

- `readFileSync` + `JSON.parse` + `DocumentPayloadSchema.parse()` on `../../render/__fixtures__/payloads/invoice-modern-basic.json` — must pass.

**Invalid fixtures** (`__fixtures__/invalid/`):

| File | Proves |
| --- | --- |
| `invoice-with-logo-bytes.json` | Strict rejects `branding.logoBytes` |
| `receipt-with-due-at.json` | Cross-type `dueAt` on receipt rejected |
| `invoice-with-paid-at.json` | Cross-type `paidAt` on invoice rejected |

### Test matrix (`document-payload.test.ts`)

| Test | Assertion |
| --- | --- |
| Parse three valid minimal fixtures | success + correct `documentType` |
| Parse render `invoice-modern-basic.json` | success |
| Parse `invoice-with-logo-bytes.json` | throws (unrecognized key) |
| Parse cross-type invalid fixtures | throws |
| `checkDocumentTypeMismatch("invoice", { documentType: "invoice" })` | `match: true` |
| `checkDocumentTypeMismatch("invoice", {})` | `match: true` |
| `checkDocumentTypeMismatch("invoice", { documentType: "receipt" })` | `match: false`, `code === DOCUMENT_TYPE_MISMATCH_CODE` |

Delete or replace stub test in `src/index.test.ts` — prefer consolidating into `document-payload.test.ts`.

### Architecture compliance

- **AD-1:** Sole Zod owner; apps import from `@usetagih/schema` only.
- **AD-5 (partial):** Structural parse only — arithmetic integrity is Story 2.2.
- **SOLUTION-DESIGN §6:** `packages/schema/src/document/` layout matches architecture tree.
- **Dependency rule:** `@usetagih/schema` depends on `zod` + dev `@usetagih/config` only — no `@usetagih/render` runtime dependency; tests may read render fixture paths via relative filesystem path.

### Anti-patterns (do not)

- Do not add `logoBytes` to canonical `BrandingSchema` to make logo golden fixtures pass schema parse.
- Do not implement `LINE_TOTAL_MISMATCH` / half-up rounding validators (Story 2.2).
- Do not default `schemaVersion` inside Zod `.default()` (Story 2.4).
- Do not duplicate Zod in `apps/api` or `packages/render`.
- Do not modify render logo fixtures or golden hashes in this story.
- Do not use `.passthrough()` on payload objects.

### Previous epic intelligence

| Source | Learning for 2.1 |
| --- | --- |
| Story 1.6 | `PersistedLogoBytes` type lives in `packages/render/src/logo-prep.ts`; render reads JSON without schema package today |
| Story 1.9 | Spike PASS; Typst path proven; schema work unblocked |
| Epic 0 stories | Turbo `--force` on verification; Biome via shared config |

### References

- [Source: `_bmad-output/planning-artifacts/epics.md` — Story 2.1 ACs]
- [Source: `_bmad-output/planning-artifacts/prds/prd-usetagih-2026-07-20/prd.md` — §10.1 Canonical Document Contract]
- [Source: `_bmad-output/planning-artifacts/architecture/architecture-usetagih-2026-07-20/ARCHITECTURE-SPINE.md` — AD-1]
- [Source: `_bmad-output/planning-artifacts/architecture/architecture-usetagih-2026-07-20/SOLUTION-DESIGN.md` — §6 Repository Layout]
- [Source: `_bmad-output/implementation-artifacts/1-6-logo-determinism-fixture-png-jpeg-svg-blocking.md` — spike logoBytes extension]
- [Source: `packages/render/__fixtures__/payloads/invoice-modern-basic.json` — conformance fixture]

## Dev Agent Record

### Agent Model Used

Composer 2.5

### Debug Log References

- workspace turbo initially failed on stale `dist/index.test.js` in core/sdk after `SCHEMA_STUB` removal; rebuilt dist and wired stubs to `DocumentPayloadSchema`
- render lint auto-fix (format/import order, non-null assertion) required for AC 8 green turbo

### Completion Notes List

- Implemented canonical `DocumentPayloadSchema` discriminated union with strict object shapes under `packages/schema/src/document/`
- Added minimal valid fixtures for invoice/quotation/receipt plus invalid fixtures proving `logoBytes` and cross-type field rejection
- Added `checkDocumentTypeMismatch` helper exporting `DOCUMENT_TYPE_MISMATCH_CODE`
- `bun test packages/schema`: 12 pass (6 unique tests × src + dist)
- `bunx turbo run lint typecheck test build --force`: 36/36 tasks successful

### File List

- `packages/schema/package.json`
- `packages/schema/src/index.ts`
- `packages/schema/src/document/primitives.ts`
- `packages/schema/src/document/money.ts`
- `packages/schema/src/document/address.ts`
- `packages/schema/src/document/party.ts`
- `packages/schema/src/document/line-item.ts`
- `packages/schema/src/document/tax-line.ts`
- `packages/schema/src/document/branding.ts`
- `packages/schema/src/document/totals.ts`
- `packages/schema/src/document/metadata.ts`
- `packages/schema/src/document/base-document-payload.ts`
- `packages/schema/src/document/document-type.ts`
- `packages/schema/src/document/invoice-payload.ts`
- `packages/schema/src/document/quotation-payload.ts`
- `packages/schema/src/document/receipt-payload.ts`
- `packages/schema/src/document/document-payload.ts`
- `packages/schema/src/document/document-type-mismatch.ts`
- `packages/schema/src/document/document-payload.test.ts`
- `packages/schema/__fixtures__/valid/invoice-minimal.json`
- `packages/schema/__fixtures__/valid/quotation-minimal.json`
- `packages/schema/__fixtures__/valid/receipt-minimal.json`
- `packages/schema/__fixtures__/invalid/invoice-with-logo-bytes.json`
- `packages/schema/__fixtures__/invalid/receipt-with-due-at.json`
- `packages/schema/__fixtures__/invalid/invoice-with-paid-at.json`
- `packages/schema/src/index.test.ts` (deleted)
- `packages/core/src/index.ts`
- `packages/core/src/index.test.ts`
- `packages/sdk/src/index.ts`
- `packages/sdk/src/index.test.ts`
- `packages/render/src/golden/soak-args.test.ts`
- `packages/render/src/preview.test.ts`
- `packages/render/src/preview.ts`
- `bun.lock`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`
- `_bmad-output/implementation-artifacts/2-1-document-payload-zod-discriminated-union.md`

## Change Log

- 2026-07-20: canonical document payload Zod discriminated union, fixtures, tests, and mismatch helper (Story 2.1)

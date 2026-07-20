---
baseline_commit: bd1c0fc
created: 2026-07-20
---

# Story 3.2: packages/core ports and validate use-case

Status: review

<!-- Ultimate context engine analysis completed - comprehensive developer guide created -->

## Story

As an architect,
I want hexagonal ports in packages/core with validate use-case,
so that route handlers stay thin (AD-1, FR-11).

## Acceptance Criteria

1. **Given** `packages/core/src/ports/` exports interfaces `RenderRepo`, `ArtifactStore`, `AuditRepo`, `IdempotencyStore` with workspace-scoped method signatures per Dev Notes §Port interfaces, **when** `packages/core/src/**/*.ts` is scanned, **then** there are **no** imports from `@usetagih/db`, `@usetagih/render`, `drizzle-orm`, `postgres`, or any storage/driver package (AC enforces AD-1 hex boundary).
2. **Given** `validateUseCase({ pathDocumentType, rawPayload })` in `packages/core/src/use-cases/validate-use-case.ts`, **when** it executes, **then** it composes `@usetagih/schema`'s `checkDocumentTypeMismatch` then `validateDocumentPayload` (no reimplemented staging).
3. **Given** a valid payload, **when** `validateUseCase` runs, **then** it returns `{ valid: true, normalizedPreview }` where `normalizedPreview` is the **parsed** `DocumentPayload` after schemaVersion default is applied (same semantics as `validateDocumentPayload` success — e.g. omitted `schemaVersion` → `"2026-07-20"`).
4. **Given** an invalid payload (schemaVersion, structural, business, or document-type mismatch), **when** `validateUseCase` runs, **then** it returns `{ valid: false, code, details }` using **only** existing `@usetagih/schema` error vocabulary (`ErrorCode`, `ApiErrorDetail`, `businessFindingToDetail`) — no new error codes or detail shapes.
5. **Given** `packages/core/package.json`, **when** dependencies are inspected, **then** runtime `dependencies` contains **only** `@usetagih/schema` (AD-1 dependency graph); `@usetagih/config` remains devDependency only.
6. **Given** `packages/core/src/guard/dependency-graph.test.ts`, **when** `bun test packages/core` runs, **then** the dependency-graph guard passes (package.json deps + forbidden import specifiers in `src/`).
7. **Given** schema fixtures under `packages/schema/__fixtures__/` (Story 2.6 sidecar convention), **when** `packages/core/src/use-cases/validate-use-case.test.ts` runs, **then** every payload sidecar pair produces the same pass/fail outcome through `validateUseCase` as declared in the sidecar (reuse `discoverFixturePairs` / mapping helpers per Dev Notes §Fixture test strategy).
8. **Given** `packages/db/src/repositories/render-repo.ts`, **when** refactored per Dev Notes §Db RenderRepo alignment, **then** `createRenderRepo` return type explicitly implements `@usetagih/core`'s `RenderRepo` port (adapter direction: db imports core port type, not vice versa).
9. **Given** workspace, **when** `bunx turbo run lint typecheck test build --force` runs from repo root, **then** all tasks exit 0.
10. **Out of scope (later Epic 3 stories):** HTTP routes (`POST /v1/{documentType}/validate` → Story 3.8), `requestId` injection / HTTP status mapping, Drizzle adapters for `ArtifactStore`, `AuditRepo`, `IdempotencyStore` (Stories 3.7, 3.11, 3.14), render/preview use-cases, queue port, `apps/api` composition root wiring.

## Tasks / Subtasks

- [x] Task 1 — Replace core stub with package layout (AC: 1, 5)
  - [x] Remove `CORE_STUB` / `coreSchemaRef` from `packages/core/src/index.ts`
  - [x] Create `src/ports/index.ts` re-exporting all four port interfaces + domain record types
  - [x] Create `src/use-cases/index.ts` exporting `validateUseCase` + result types
  - [x] Update `packages/core/src/index.ts` public exports
- [x] Task 2 — Port interfaces (AC: 1, 10)
  - [x] Implement `src/ports/render-repo.ts` per Dev Notes §RenderRepo
  - [x] Implement `src/ports/artifact-store.ts` per Dev Notes §ArtifactStore
  - [x] Implement `src/ports/audit-repo.ts` per Dev Notes §AuditRepo
  - [x] Implement `src/ports/idempotency-store.ts` per Dev Notes §IdempotencyStore
  - [x] Add `src/ports/domain-types.ts` for shared record shapes (no Drizzle imports)
- [x] Task 3 — ValidateUseCase (AC: 2, 3, 4)
  - [x] Implement `src/use-cases/validate-use-case.ts` with signature + return types in Dev Notes §ValidateUseCase
  - [x] Implement `mapValidateFailureToDetails()` using schema helpers only
  - [x] Export types from `src/use-cases/validate-use-case.ts`
- [x] Task 4 — Dependency-graph guard (AC: 5, 6)
  - [x] Create `src/guard/dependency-graph.test.ts` per Dev Notes §Dependency-graph guard
  - [x] Replace stub `src/index.test.ts` with meaningful smoke test or remove if covered elsewhere
- [x] Task 5 — ValidateUseCase fixture tests (AC: 7)
  - [x] Create `src/use-cases/validate-use-case.test.ts` driving all schema fixture sidecar pairs
  - [x] Add document-type-mismatch cases via `checkDocumentTypeMismatch` sidecars
- [x] Task 6 — Db RenderRepo alignment (AC: 8)
  - [x] Add `@usetagih/core` workspace dependency to `packages/db/package.json`
  - [x] Refactor `createRenderRepo` to `satisfies RenderRepo` (import port from `@usetagih/core`)
  - [x] Remove db-local `export type RenderRepo = ReturnType<...>` — re-export core port type from db index OR keep factory-only export (prefer re-export `RenderRepo` from `@usetagih/core` in db index for backward compat)
  - [x] Verify existing `bun test packages/db` still passes unchanged behavior
- [x] Task 7 — Verification gate (AC: 9)
  - [x] `bun test packages/core`
  - [x] `bun test packages/db`
  - [x] `bunx turbo run lint typecheck test build --force`

## Dev Notes

### Goal

Establish `packages/core` as the hexagonal application core: outbound port interfaces (repos, artifact store, idempotency) plus the first use-case (`validateUseCase`). Epic 3 route handlers (Story 3.8+) and SDK (Story 7.1) call inward through these use-cases — **never** import Drizzle/R2/Typst from routes.

### Binding ratified sources

| Ref | Requirement for 3.2 |
| --- | --- |
| **AD-1** | `packages/core` depends on `packages/schema` **only**; defines ports; apps/api wires adapters |
| **AD-5** | Idempotency keyed by `workspaceId` + `endpoint` + SHA-256 `keyHash`; conflict on same key + different payload |
| **AD-6** | Artifacts at `renders/{workspaceId}/{renderId}.pdf`; store metadata separately in PostgreSQL |
| **AD-7** | Audit append-only; `workspaceId` nullable only for signup/login/bootstrap; cross-workspace access returns 404 at API layer |
| **FR-11** | Valid → `{ valid: true, normalizedPreview }`; invalid → structured errors (HTTP 422 envelope mapped in Story 3.8) |
| **SOLUTION-DESIGN §4.1** | Validate stage = Zod parse + business rules before render |
| **SOLUTION-DESIGN §6.1** | `core → schema`; `api → core, db, render` |
| **Story 3.1** | Concrete `createRenderRepo` with workspace-scoped queries — formalize as core port + align db adapter now |

### Architecture compliance

| Ref | Rule |
| --- | --- |
| **ARCHITECTURE-SPINE AD-1** | Use-cases in `packages/core`; repos never called from route handlers directly |
| **ARCHITECTURE-SPINE capability map** | Validation + business rules live in `packages/core/validate` (this story seeds `use-cases/validate-use-case.ts`) |
| **Epic 2 done** | `validateDocumentPayload` staged orchestrator owns schemaVersion → structural → business; reuse, do not fork |
| **Story 2.6** | Fixture sidecar convention under `packages/schema/__fixtures__/`; `discoverFixturePairs` runner |

### Port interfaces — decision (encode exactly)

**Source of truth:** SOLUTION-DESIGN §4.1 (pipeline stages), §7.1 (table columns), AD-5/AD-6/AD-7 rules, Story 3.1 `createRenderRepo` methods, correct-course workspace scoping (every port method touching tenant data takes `workspaceId`).

**Adapter direction:** `packages/db`, R2 client (later), and middleware adapters **implement** core ports. Core never imports adapter packages.

#### RenderRepo (`src/ports/render-repo.ts`)

Domain types in `src/ports/domain-types.ts` — structural types only (no Drizzle):

```typescript
export type WorkspaceTier = "trial" | "starter" | "pro" | "business";
export type RenderStatus = "processing" | "completed" | "failed";

export type NewRenderRecord = {
  workspaceId: string;
  documentType: string;
  template: string;
  schemaVersion: string;
  status: RenderStatus;
  payloadHash: string;
  resolvedTier: WorkspaceTier;
  showWatermark: boolean;
  idempotencyHash?: string | null;
  r2Key?: string | null;
  sha256?: string | null;
  byteSize?: number | null;
  shareToken?: string | null;
  shareExpiresAt?: Date | null;
  logoChecksum?: string | null;
  brandingSnapshot?: unknown;
  errorCode?: string | null;
};

export type RenderRecord = NewRenderRecord & {
  id: string;
  createdAt: Date;
  updatedAt: Date;
};

export interface RenderRepo {
  insert(input: NewRenderRecord): Promise<RenderRecord>;
  getByIdAndWorkspace(
    renderId: string,
    workspaceId: string,
  ): Promise<RenderRecord | null>;
  listByWorkspace(workspaceId: string, limit?: number): Promise<RenderRecord[]>;
}
```

Matches Story 3.1 `createRenderRepo` method shapes; Drizzle `Render`/`NewRender` rows satisfy these structurally.

#### ArtifactStore (`src/ports/artifact-store.ts`)

Per AD-6; object key convention `renders/{workspaceId}/{renderId}.pdf`:

```typescript
export interface ArtifactStore {
  put(params: {
    workspaceId: string;
    key: string;
    body: Uint8Array;
    contentType: "application/pdf";
  }): Promise<{ sha256: string; byteSize: number }>;

  get(params: {
    workspaceId: string;
    key: string;
  }): Promise<Uint8Array | null>;

  delete(params: {
    workspaceId: string;
    key: string;
  }): Promise<void>;
}
```

Adapters must reject keys whose embedded `workspaceId` segment ≠ param `workspaceId` (defense in depth — enforced in Story 3.11 R2 adapter).

#### AuditRepo (`src/ports/audit-repo.ts`)

Append-only per NFR-11 / AD-7:

```typescript
export type AuditAppendInput = {
  workspaceId: string | null;
  userId: string;
  action: string;
  resourceType?: string | null;
  resourceId?: string | null;
  outcome: "success" | "failure";
  ip?: string | null;
  metadata?: Record<string, unknown> | null;
};

export interface AuditRepo {
  append(input: AuditAppendInput): Promise<{ id: string }>;
}
```

`workspaceId: null` allowed only when `action` is one of `signup`, `login`, `workspace.bootstrap` (matches `AUDIT_ACTIONS_NULLABLE_WORKSPACE` in db schema — validation in db adapter Story 3.14, not in port).

#### IdempotencyStore (`src/ports/idempotency-store.ts`)

Per AD-5 / SOLUTION-DESIGN §7.1 `idempotency_keys`:

```typescript
export type IdempotencyLookupResult =
  | { status: "miss" }
  | {
      status: "hit";
      requestHash: string;
      responseBody: unknown;
    }
  | {
      status: "conflict";
      storedRequestHash: string;
      incomingRequestHash: string;
    };

export interface IdempotencyStore {
  lookup(params: {
    workspaceId: string;
    endpoint: string;
    keyHash: string;
  }): Promise<IdempotencyLookupResult>;

  store(params: {
    workspaceId: string;
    endpoint: string;
    keyHash: string;
    requestHash: string;
    responseBody: unknown;
    expiresAt: Date;
  }): Promise<void>;
}
```

`keyHash` is SHA-256 of raw `Idempotency-Key` header (hashing in middleware Story 3.7). `endpoint` is normalized route template (e.g. `POST /v1/invoices/render`).

### ValidateUseCase — signature and return types (encode exactly)

**File:** `packages/core/src/use-cases/validate-use-case.ts`

**Imports (allowed from `@usetagih/schema` only):**

- `validateDocumentPayload`, `checkDocumentTypeMismatch`
- `businessFindingToDetail`
- Types: `DocumentPayload`, `DocumentType`, `ApiErrorDetail`, `ErrorCode`
- Codes: `VALIDATION_FAILED`, `UNSUPPORTED_SCHEMA_VERSION`, `DOCUMENT_TYPE_MISMATCH`

**Input:**

```typescript
export type ValidateUseCaseInput = {
  pathDocumentType: DocumentType;
  rawPayload: unknown;
};
```

**Output (use-case layer — no `requestId`; Story 3.8 wraps in HTTP envelope):**

```typescript
export type ValidateUseCaseSuccess = {
  valid: true;
  normalizedPreview: DocumentPayload;
};

export type ValidateUseCaseFailure = {
  valid: false;
  code: ErrorCode;
  details: ApiErrorDetail[];
};

export type ValidateUseCaseResult =
  | ValidateUseCaseSuccess
  | ValidateUseCaseFailure;

export function validateUseCase(
  input: ValidateUseCaseInput,
): ValidateUseCaseResult;
```

**Execution order (do not reorder):**

1. If `rawPayload` is not a non-null object, return `{ valid: false, code: "VALIDATION_FAILED", details: [{ path: "/", code: "VALIDATION_FAILED", message: "payload must be a JSON object" }] }`.
2. `checkDocumentTypeMismatch(pathDocumentType, rawPayload as { documentType?: unknown })` — on mismatch return `{ valid: false, code: "DOCUMENT_TYPE_MISMATCH", details: [{ path: "/documentType", code: "DOCUMENT_TYPE_MISMATCH", message }] }`.
3. `validateDocumentPayload(rawPayload)` — on success return `{ valid: true, normalizedPreview: result.data }`.
4. On failure map to `ValidateUseCaseFailure`:
   - `stage: "schemaVersion"` → `code: rejection.code` (typically `UNSUPPORTED_SCHEMA_VERSION`), `details: [{ path: "/schemaVersion", code, message: rejection.message }]`
   - `stage: "structural"` → `code: "VALIDATION_FAILED"`, map **all** Zod issues to details (path via JSON Pointer per Story 2.6 `zodPathToJsonPointer` logic — copy the helper into core as `zodIssueToDetail` or import from schema if exported; **do not** invent new codes)
   - `stage: "business"` → `code: "VALIDATION_FAILED"`, `details: findings.map(businessFindingToDetail)`

**normalizedPreview semantics (FR-11):** the **parsed and normalized** `DocumentPayload` returned by `validateDocumentPayload` on success — includes defaulted `schemaVersion`, coerced primitives, and discriminated-union branch selection. It is **not** a subset, redaction, or preview-specific projection. Story 3.8 returns this object verbatim as `normalizedPreview` in the 200 JSON body.

### Db RenderRepo alignment — decision (encode exactly)

**Do now (in scope, cheap):** Refactor `packages/db` to implement the core port in this story.

| Step | Action |
| --- | --- |
| 1 | Add `"@usetagih/core": "workspace:*"` to `packages/db` `dependencies` |
| 2 | Import `RenderRepo`, `RenderRecord`, `NewRenderRecord` from `@usetagih/core` in `render-repo.ts` |
| 3 | Annotate factory: `export function createRenderRepo(db: Db): RenderRepo` |
| 4 | Map Drizzle row types to satisfy `RenderRecord` (structural — fields already align) |
| 5 | Update `packages/db/src/index.ts`: export `createRenderRepo`; export `RenderRepo` type from `@usetagih/core` (remove db-local type alias) |

**Do NOT in 3.2:** implement `ArtifactStore`, `AuditRepo`, or `IdempotencyStore` db/R2 adapters — interfaces only; wiring in Stories 3.7, 3.11, 3.14.

**Why now:** Story 3.1 shipped the concrete repo before the port existed; aligning immediately prevents two divergent `RenderRepo` definitions and unblocks Story 3.11 render use-case typing.

### Package layout (implement exactly)

```text
packages/core/
├── package.json              # dependencies: @usetagih/schema only
├── tsconfig.json
└── src/
    ├── index.ts              # export ports + validateUseCase
    ├── ports/
    │   ├── index.ts
    │   ├── domain-types.ts
    │   ├── render-repo.ts
    │   ├── artifact-store.ts
    │   ├── audit-repo.ts
    │   └── idempotency-store.ts
    ├── use-cases/
    │   ├── index.ts
    │   ├── validate-use-case.ts
    │   └── validate-use-case.test.ts
    └── guard/
        └── dependency-graph.test.ts
```

### Dependency-graph guard (AC: 5, 6)

**File:** `packages/core/src/guard/dependency-graph.test.ts`

**Assert package.json:**

```typescript
const pkg = JSON.parse(readFileSync("package.json", "utf8"));
expect(Object.keys(pkg.dependencies ?? {})).toEqual(["@usetagih/schema"]);
```

**Forbidden import specifiers in `packages/core/src/**/*.ts` (excluding `*.test.ts` if desired, but prefer scanning all src):**

| Pattern | Reason |
| --- | --- |
| `@usetagih/db` | AD-1 — db is adapter |
| `@usetagih/render` | AD-1 — render is adapter |
| `drizzle-orm` | storage driver |
| `postgres` | storage driver |
| `better-auth` | auth adapter |
| `@aws-sdk/` / `@smithy/` | R2 client (future adapter) |

Implementation: recursive file scan (mirror Story 2.6 duplicate-zod guard pattern).

### Fixture test strategy (AC: 7)

Reuse Story 2.6 corpus — **do not duplicate fixture JSON in packages/core**.

**Fixtures root resolution** (from `validate-use-case.test.ts`):

```typescript
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const packageRoot = join(dirname(fileURLToPath(import.meta.url)), "../..");
const fixturesRoot = join(packageRoot, "../schema/__fixtures__");
```

**Discovery:** import `discoverFixturePairs` from `@usetagih/schema` **only if exported**; otherwise use monorepo-relative import in **test file only**:

```typescript
import { discoverFixturePairs } from "../../../schema/src/fixtures/runner.js";
```

(Test-only cross-package import does not violate AD-1 runtime dependency graph.)

**Test loop:**

```typescript
for (const pair of discoverFixturePairs(fixturesRoot)) {
  if (pair.expected.outcome === "pass") {
    const docType = (pair.payload as { documentType: DocumentType }).documentType;
    const result = validateUseCase({ pathDocumentType: docType, rawPayload: pair.payload });
    expect(result.valid).toBe(true);
    if (result.valid) {
      expect(result.normalizedPreview.schemaVersion).toBeDefined();
    }
  } else if (pair.expected.stage === "documentTypeMismatch") {
    // use pair.expected.pathDocumentType + pair.expected.body
  } else {
    // fail cases — assert !result.valid, primary detail path+code matches sidecar
  }
}
```

**Minimum coverage:** all sidecar pairs (≥22 failure + 3 valid + document-type-mismatch metadata entries) — same count as Story 2.6 corpus.

### Verification (required)

- Unit tests: `bun test packages/core` and `bun test packages/db`
- Workspace gate: `bunx turbo run lint typecheck test build --force` from repo root (always `--force`)
- Generated artifacts: `packages/core/dist/` via `tsc --outDir dist`; ensure `tsconfig`/`build` excludes `*.test.ts` if needed (Epic 2 retro action item)

### Out of scope boundaries

| Item | Owner story |
| --- | --- |
| `POST /v1/{documentType}/validate` HTTP route + 422 envelope + `requestId` | Story 3.8 |
| `GET /v1/schemas` | Story 3.8 |
| Idempotency middleware + db adapter | Story 3.7 |
| R2 `ArtifactStore` adapter | Story 3.11 |
| Audit db adapter + `GET /v1/audit` | Story 3.14 |
| Render / preview / webhook use-cases | Stories 3.10, 3.11, Epic 4 |
| Queue port (`pg-boss`) | Epic 4 — SOLUTION-DESIGN lists Queue port; epics 3.2 AC names four ports without Queue — **do not add Queue in 3.2** |
| SDK `validateLocally` | Story 7.1 |

### Previous story intelligence (Story 3.1)

| Source | Learning for 3.2 |
| --- | --- |
| Story 3.1 | `createRenderRepo` already workspace-scoped — port interface documents the contract db must satisfy |
| Story 3.1 | Exact version pins for db deps — if adding `@usetagih/core` to db, use `workspace:*` only |
| Story 3.1 | Turbo `--force` on all verification commands |
| Story 3.1 Dev Notes | Explicitly deferred `packages/core` ports to **this story** |

### Previous story intelligence (Epic 2)

| Source | Learning for 3.2 |
| --- | --- |
| Story 2.4 | `validateDocumentPayload` owns staging — ValidateUseCase is a thin orchestrator + error shape mapper |
| Story 2.6 | Sidecar fixture convention; `discoverFixturePairs`; primary finding extraction for table-driven tests |
| Story 2.3 | `ApiErrorDetail`, `businessFindingToDetail`, `buildApiErrorEnvelope` — use-case returns details array; envelope wrapper is HTTP layer |
| Story 2.6 guard | Duplicate-zod guard pattern — mirror for dependency-graph guard in core |

### Current repo state (read before editing)

| Path | State |
| --- | --- |
| `packages/core/src/index.ts` | Stub `CORE_STUB` + `coreSchemaRef` — **replace** |
| `packages/core/package.json` | Depends on `@usetagih/schema` only — **keep** |
| `packages/db/src/repositories/render-repo.ts` | Concrete repo; local `RenderRepo` type alias — **align to core port** |
| `packages/schema` | `validateDocumentPayload`, fixtures, 58+ tests — **import, do not modify** unless exporting runner helpers is required (prefer test-only relative import) |

### Anti-patterns (do not)

- Do not import `@usetagih/db` or `@usetagih/render` inside `packages/core`
- Do not reimplement schemaVersion/structural/business staging in core
- Do not add new error codes or detail field names
- Do not add HTTP/Elysia types to core
- Do not implement db/R2 adapters for ArtifactStore, AuditRepo, IdempotencyStore in this story
- Do not add `Queue` port (out of epics 3.2 AC scope)

### References

- [Source: _bmad-output/planning-artifacts/epics.md — Story 3.2 AC]
- [Source: _bmad-output/planning-artifacts/architecture/architecture-usetagih-2026-07-20/ARCHITECTURE-SPINE.md — AD-1, AD-5, AD-6, AD-7]
- [Source: _bmad-output/planning-artifacts/architecture/architecture-usetagih-2026-07-20/SOLUTION-DESIGN.md — §4.1, §6.1, §7.1]
- [Source: _bmad-output/planning-artifacts/prds/prd-usetagih-2026-07-20/prd.md — FR-11, §10.3 error envelope]
- [Source: _bmad-output/implementation-artifacts/3-1-drizzle-database-schema-and-migrations-for-core-tables.md — RenderRepo primitives]
- [Source: _bmad-output/implementation-artifacts/2-6-shared-validation-fixture-test-suite.md — fixture sidecar convention]
- [Source: packages/schema/src/validation/validate-document-payload.ts]
- [Source: packages/schema/src/fixtures/runner.ts]

## Dev Agent Record

### Agent Model Used

Composer 2.5 Fast (headless subagent)

### Debug Log References

- removed direct `zod` import from `validate-use-case.ts` after `no-duplicate-zod` guard failure; uses structural `ZodIssueLike` instead
- excluded `*.test.ts` from core `typecheck`/`build` via `tsconfig.build.json` (cross-package fixture import stays test-only)

### Completion Notes List

- hexagonal ports (`RenderRepo`, `ArtifactStore`, `AuditRepo`, `IdempotencyStore`) exported from `packages/core/src/ports/` with workspace-scoped tenant methods
- `validateUseCase` composes `checkDocumentTypeMismatch` → `validateDocumentPayload`; maps failures via schema error vocabulary only
- dependency-graph guard enforces `@usetagih/schema`-only runtime deps and forbidden adapter imports in non-test src
- fixture suite (25 sidecar pairs) drives `validate-use-case.test.ts` against Story 2.6 corpus
- `packages/db` `createRenderRepo` implements core `RenderRepo`; db index re-exports port type from `@usetagih/core`
- verification: `bun test packages/core` 6 pass; `bun test packages/db` 5 pass; turbo `--force` 36/36 green

### File List

- `packages/core/package.json`
- `packages/core/tsconfig.build.json`
- `packages/core/src/index.ts`
- `packages/core/src/index.test.ts`
- `packages/core/src/ports/domain-types.ts`
- `packages/core/src/ports/render-repo.ts`
- `packages/core/src/ports/artifact-store.ts`
- `packages/core/src/ports/audit-repo.ts`
- `packages/core/src/ports/idempotency-store.ts`
- `packages/core/src/ports/index.ts`
- `packages/core/src/use-cases/validate-use-case.ts`
- `packages/core/src/use-cases/validate-use-case.test.ts`
- `packages/core/src/use-cases/index.ts`
- `packages/core/src/guard/dependency-graph.test.ts`
- `packages/db/package.json`
- `packages/db/src/repositories/render-repo.ts`
- `packages/db/src/index.ts`
- `bun.lock`
- `_bmad-output/implementation-artifacts/3-2-packages-core-ports-and-validate-use-case.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`

## Change Log

- 2026-07-20: Story 3.2 — core hexagonal ports, validate use-case, db RenderRepo alignment

## Story Validation Record

**Validated:** 2026-07-20 (headless checklist — create-story step 6)

| Check | Result |
| --- | --- |
| Port signatures sourced from SOLUTION-DESIGN §4/§7 + AD-5/6/7 + Story 3.1 repo | PASS |
| workspaceId on all tenant-scoped port methods | PASS |
| ValidateUseCase composes schema orchestrator (no restaging) | PASS |
| normalizedPreview = parsed DocumentPayload with defaults | PASS |
| Structured errors reuse schema ErrorCode + ApiErrorDetail only | PASS |
| AD-1 dependency graph guard specified | PASS |
| Fixture reuse via 2.6 sidecar convention + path resolution | PASS |
| Db RenderRepo alignment decision: refactor now | PASS |
| Out of scope boundaries (HTTP, adapters, Queue port) | PASS |
| Verification commands with turbo `--force` | PASS |

**Fixes applied during validation:** JSON Pointer root path for non-object payload (`"/"`); explicit documentType extraction in fixture test loop.

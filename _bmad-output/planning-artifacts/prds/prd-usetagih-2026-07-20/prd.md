---
title: "PRD: usetagih"
status: final
created: 2026-07-20
updated: 2026-07-20
---

# PRD: usetagih

*Strict schema in. Branded PDF out. No ledger.*

## 0. Document Purpose

This PRD defines MVP requirements for **usetagih**, a strict-schema document render layer built by Verasic Labs (PT Ide Datang Mendadak). It is the phase-2 gate artifact for the BMad Method pipeline and the authoritative input for downstream UX, architecture, and epic/story generation — all of which will be produced by agents without further human elicitation.

The document is structured around a Glossary-anchored vocabulary, globally numbered Functional Requirements (FR-N), Success Metrics (SM-N), and five canonical User Journeys (UJ-1 through UJ-5). Technical implementation choices that exceed product requirements live in `addendum.md`. Source inputs: product brief (`brief-usetagih-2026-07-20`), brief addendum, and market research (`market-schema-first-document-rendering-embed-layer-research-2026-07-20`).

## 1. Vision

Finance SaaS platforms, marketplaces, and AI agents already own customer, line-item, tax, and total data in their own systems. When they need a professional invoice, quotation, or receipt, they face a bad tradeoff: rebuild PDF rendering (weeks of maintenance on pagination, currencies, rounding), adopt an invoicing suite that forces data into a vendor's ledger model, or use a commodity JSON→PDF API with loose validation and silent financial corrections.

**usetagih** draws a hard boundary: **validated payload in, deterministic branded artifact out**. Integrators send a payload conforming to a canonical Zod document contract; usetagih validates strictly, renders through a deterministic pipeline, and returns a PDF plus shareable link — without becoming a system of record, payment processor, or regulated e-invoicing clearance platform.

The product core is one canonical document schema and deterministic render pipeline. REST/OpenAPI is the primary interface at MVP. A Mantine web app consumes the same API for human users. A thin MCP adapter (3–5 tools) wraps the same backend in v1.1. Success depends on schema developer experience, multi-document-type contract uniformity, template visual quality, and embed trust — visibly beating Invovate and invoice-generator.com, not on feature breadth.

## 2. Target User

### 2.1 Jobs To Be Done

**Embed integrators (primary)**
- Render branded business documents from data already stored in my product without syncing clients or transactions into a third-party invoicing suite.
- Get validation errors that pinpoint exactly which field failed and why, so my integration team fixes payloads fast.
- Rely on idempotent renders, webhooks, and audit trails for production embed flows without fear of accidental ledger writes or payment side effects.

**Direct users (secondary)**
- Create a professional invoice, quotation, or receipt in a web UI without learning PDF tooling.
- Preview how the document looks before exporting or sharing a link.

**Developers and AI agents (secondary)**
- Discover the document schema programmatically, validate locally, submit for render, and retrieve the artifact — with a forcing function that converts messy upstream data into a valid payload.

### 2.2 Non-Users (v1)

- Teams needing regulated e-invoicing clearance (PEPPOL network delivery, Indonesia Coretax/e-Faktur submission, VeriFactu writes).
- Buyers wanting a full invoicing OS (client CRM, payment collection, dunning, expense tracking, double-entry accounting).
- Organizations requiring multi-tenant org/team management, template marketplaces, or visual template editors at MVP.
- Non-English document localization requirements.

### 2.3 Key User Journeys

- **UJ-1. Maya creates and exports an invoice from the web app**
  - **Persona + context:** Maya, a solo freelance designer in Bandung, needs a polished invoice for a client without installing PDF software.
  - **Entry state:** Unauthenticated; lands on usetagih marketing/home page.
  - **Path:** Signs up via email (better-auth single-user account) → selects document type *invoice* → fills form fields mapped to the canonical schema (seller, buyer, line items, tax, totals) → selects template style *modern* → taps **Preview** → reviews rendered HTML preview → taps **Export PDF** → downloads PDF and copies share link.
  - **Climax:** PDF opens with correct totals, currency formatting, and pagination; share link loads the same artifact in browser.
  - **Resolution:** Render record stored in her account history; she can re-download or re-share later.
  - **Edge case:** She enters line items whose computed subtotal does not match declared total; validation blocks export with field-path errors — no silent correction.

- **UJ-2. Alex embeds render in a finance SaaS via REST API**
  - **Persona + context:** Alex, backend engineer at a vertical SaaS, holds canonical invoice data in PostgreSQL and needs branded PDFs on invoice-finalization events.
  - **Entry state:** Authenticated via scoped API key (`renders:write`, `renders:read`); calling from production backend.
  - **Path:** `POST /v1/invoices/validate` with payload → receives `200` with normalized preview metadata OR `422` with structured errors → `POST /v1/invoices/render` with `Idempotency-Key` header → for ≤100 line items within 10s, receives `201` with `Location: /v1/renders/{renderId}` and `{ renderId, status: "completed", shareUrl, expiresAt, schemaVersion, documentType, template }` → registers webhook listener for `render.completed` → on retry with same idempotency key, receives identical `renderId` and `shareUrl` → `GET /v1/renders/{renderId}` retrieves metadata → `GET /v1/renders/{renderId}/download` fetches PDF bytes (authenticated).
  - **Climax:** First production invoice renders in under 2 seconds P95; webhook fires once; idempotent retry does not double-charge quota or create duplicate artifacts.
  - **Resolution:** Audit log entry records validate + render + download events; Alex's app stores only `renderId` and share URL — not usetagih as system of record.
  - **Edge case:** R2 upload transient failure → render status `failed` with retriable error code; Alex retries with same idempotency key after fix.

- **UJ-3. Agent discovers schema, validates, and retrieves a quotation**
  - **Persona + context:** An MCP-capable agent (v1.1) helping a user turn spreadsheet rows into a quotation PDF.
  - **Entry state:** Agent has API key or MCP auth; upstream data is partial JSON.
  - **Path:** v1.1: `list_schemas` → receives OpenAPI/Zod schema summary for `quotation` → `validate_payload` with draft JSON → receives actionable errors with JSON paths → agent fixes fields → `render_document` with `template: "classic"` → receives `{ renderId, shareUrl }` → `download_pdf` or fetch via share URL → delivers PDF to user.
  - **Climax:** Agent converts messy input into valid schema without standing up accounting software; user receives deterministic branded PDF.
  - **Resolution:** Render history visible in user's usetagih account if keyed to same owner.
  - **Edge case:** Schema version mismatch (`schemaVersion: "2026-07-20"`) → validation error instructs agent to check `/v1/schemas` for current version.

- **UJ-4. Jordan generates receipt with webhook confirmation for marketplace payouts**
  - **Persona + context:** Jordan integrates usetagih into a marketplace that issues payout receipts after settlement.
  - **Entry state:** API key with webhook configuration; async render acceptable.
  - **Path:** `POST /v1/receipts/render` with idempotency key tied to settlement ID and `Prefer: respond-async` (or >100 line items) → immediate `202` with `Location: /v1/renders/{renderId}` and `{ renderId, status: "processing", statusUrl }` → usetagih completes render → `render.completed` webhook POST with signed envelope (`eventId`, `shareUrl`) → Jordan's system marks settlement receipt as delivered → end user opens signed share URL.
  - **Climax:** Webhook signature verifies; duplicate webhook delivery deduplicated via stable `eventId`; share URL valid for default 90-day TTL (or per-render `shareTtlDays`).
  - **Resolution:** Audit log correlates settlement ID, renderId, and every webhook delivery attempt.
  - **Edge case:** Webhook endpoint down → usetagih retries 8 attempts over ~24h with exponential backoff and jitter; Jordan polls `GET /v1/renders/{renderId}` as fallback.

- **UJ-5. Priya validates locally with SDK before first API call**
  - **Persona + context:** Priya, indie developer, evaluates usetagih against Invovate during a hackathon.
  - **Entry state:** Free-tier account; TS SDK installed.
  - **Path:** `validateLocally('invoice', payload)` in Node REPL → fixes errors offline → `client.render('invoice', payload, { template: 'modern', idempotencyKey })` → compares PDF side-by-side with Invovate output → promotes to production API key.
  - **Climax:** Local validation errors are as clear as server errors; first successful render in under one hour from SDK install.
  - **Resolution:** Priya embeds usetagih as render layer; keeps canonical data in her own DB.
  - **Edge case:** SDK schema version lags server → SDK warns to upgrade package when `/v1/schemas` version differs.

## 3. Glossary

- **Document** — A logical business artifact of type `invoice`, `quotation`, or `receipt`, described by the canonical document contract. Not persisted as canonical business data; only metadata and rendered artifacts are stored.
- **Document Type** — One of `invoice`, `quotation`, or `receipt`. The Canonical Document Contract is a discriminated union on `documentType`; each type shares common primitives and adds type-specific optional fields. Fields belonging to another type are rejected.
- **Canonical Document Contract** — The single Zod schema (and generated OpenAPI components) defining seller, buyer, line items, tax lines, totals, dates, currency, document metadata, and template selection. Versioned via **Schema Version**.
- **Schema Version** — Semver or date-stamped identifier (MVP: `2026-07-20`) carried in payloads and API responses. Breaking changes require a new version and documented migration.
- **Payload** — JSON object submitted by a client intended to conform to the Canonical Document Contract for a Document Type.
- **Validation** — Server-side (or SDK local) parsing and business-rule checking of a Payload. Failures are explicit; financial values are never silently corrected.
- **Render** — The deterministic transformation of a validated Payload + Template into a PDF artifact stored in **Object Storage**, with metadata in **PostgreSQL**.
- **Render Record** — Database row tracking renderId, document type, template, schema version, status, timestamps, owner, idempotency key hash, and artifact pointers. Not a ledger entry.
- **Template** — A curated visual style (MVP: ~2 per Document Type, e.g., `modern`, `classic`). Selected by enum parameter; not user-authored at MVP.
- **Preview** — Non-persistent or short-lived HTML/visual representation of a validated Payload for human review before Render.
- **Share Link** — Time-limited signed public URL (`shareUrl`) to view or download a rendered PDF without additional auth. Default TTL 90 days; per-render optional `shareTtlDays` (1–365). Share-link expiry is distinct from authenticated artifact access via `GET /v1/renders/{renderId}/download`.
- **Artifact** — The rendered PDF binary stored in **Object Storage** (Cloudflare R2).
- **Object Storage** — Cloudflare R2 bucket holding rendered PDF artifacts; PostgreSQL holds pointers and metadata only.
- **API Key** — Scoped secret for programmatic access. Scopes: `renders:read`, `renders:write`, `webhooks:manage`, `audit:read`.
- **Idempotency Key** — Client-supplied key (1–255 printable ASCII characters, not UUID-only), scoped per account + endpoint, ensuring repeated render requests produce the same Render Record and Artifact without duplicate quota consumption.
- **Webhook** — HTTPS callback on events such as `render.completed` and `render.failed`, with signed payloads.
- **Audit Log** — Append-only record of authentication, validation, render, download, and configuration events for accountability.
- **Integrator** — External application or agent embedding usetagih via REST API or MCP adapter.
- **System of Record** — A platform that owns canonical business entities (clients, payments, inventory). usetagih explicitly is not one.

## 4. Features

### 4.1 Canonical Document Schema & Validation

**Description:** The product's core differentiator is a strict, unified Zod schema across all Document Types with excellent validation errors. Validation runs on every create, preview, and render path. Business rules enforce internal consistency (line totals, tax computation, currency precision) but never auto-correct discrepancies — integrators must fix upstream data. Realizes UJ-1, UJ-2, UJ-3, UJ-5.

**Functional Requirements:**

#### FR-1: Unified document contract

The system exposes one Canonical Document Contract as a discriminated union on `documentType` (`invoice`, `quotation`, `receipt`), sharing common primitives with type-specific optional fields. Realizes UJ-2, UJ-3.

**Consequences (testable):**
- OpenAPI 3.1 spec publishes `DocumentPayload` as a discriminated union reused across document-type endpoints.
- `documentType` in the URL path is authoritative; if present in the body it must match — mismatch returns `400` with code `DOCUMENT_TYPE_MISMATCH`.
- Fields belonging to another document type are rejected at validation.
- SDK `validateLocally()` uses the same Zod definitions as the server.

#### FR-2: Explicit validation failures

When Payload validation fails, the system returns structured errors with JSON Pointer path, machine-readable code, human-readable message, and expected vs. received hints. Realizes UJ-1, UJ-2, UJ-3, UJ-5.

**Consequences (testable):**
- No successful render occurs when validation fails.
- Financial field mismatches (e.g., `totals.grandTotal` ≠ computed sum) produce `422` with path `/totals/grandTotal`, not silent adjustment.
- Benchmark: error clarity rated superior to Invovate in structured comparison (field path + business rule present for ≥90% of test failure cases).

#### FR-3: Schema version negotiation

Every Payload accepts optional `schemaVersion`; server defaults to current MVP version. Mismatched unsupported versions reject with actionable upgrade guidance. Realizes UJ-3.

**Consequences (testable):**
- `GET /v1/schemas` returns current version, supported document types, and template enums.
- Requests with unknown `schemaVersion` return `400` with list of supported versions.

#### FR-4: Multi-currency and precision rules

Payload supports ISO 4217 currency codes with defined minor-unit precision rules per currency. Realizes UJ-1, UJ-2.

**Consequences (testable):**
- Amounts for JPY reject fractional minor units.
- USD/EUR accept two decimal places; rounding mode is half-up to currency minor units (documented here and enforced in FR-9 arithmetic rules).
- Monetary values are canonical decimal strings: non-negative base-10, no exponent notation; ISO 4217 currency minor units enforced.

#### FR-5: Date and locale formatting (English MVP)

Document dates accept ISO 8601 date strings; rendered output uses English labels and configurable date format per template. `[ASSUMPTION: MVP renders English-only labels; buyer locale field deferred.]`

**Consequences (testable):**
- Invalid date strings fail validation with path and expected format.
- Rendered PDF date format matches template specification in golden files.

**Notes:** Non-English localization is a explicit non-goal for MVP (see §5).

### 4.2 Deterministic Render Pipeline & Templates

**Description:** Validated Payloads pass through a deterministic render pipeline producing pixel-stable PDFs. MVP ships ~2 Templates per Document Type (6 total). Golden-file regression tests lock totals, taxes, rounding, currencies, dates, and pagination. Template quality must meet or beat Invovate and invoice-generator.com in side-by-side review. Realizes UJ-1, UJ-2, UJ-4.

**Functional Requirements:**

#### FR-6: Template selection

Clients specify `template` as an enum per Document Type (`modern`, `classic` at MVP). Invalid template for type returns `400`. Realizes UJ-1, UJ-2.

**Consequences (testable):**
- Each Document Type exposes exactly two templates at MVP launch.
- Template parameter documented in OpenAPI with enum values.

#### FR-7: Deterministic PDF output

Identical Payload + template + schema version produces byte-identical PDF output (same build, fonts, dependencies). Realizes UJ-2, UJ-5.

**Consequences (testable):**
- Golden-file test suite passes for all 3 Document Types × 2 Templates.
- CI fails on unintended PDF drift without explicit golden update approval.
- Free-tier PDFs include a single footer line `Rendered with usetagih · usetagih.com` (~8pt gray); never a diagonal watermark. Embed Pro and above (white-label) omit the footer.

#### FR-8: Pagination and layout stability

Line items spanning multiple pages break cleanly; headers/footers repeat; totals appear on final page. Realizes UJ-1, UJ-2.

**Consequences (testable):**
- Golden files include ≥25 line items case with verified page breaks.
- No clipped text or overlapping totals in benchmark payloads.

#### FR-9: Tax and totals rendering

Tax lines, subtotals, discounts, and grand totals render with correct arithmetic display matching Payload values per §10.1 normative rules (including `pricesIncludeTax` and half-up rounding); values are never recomputed silently. Realizes UJ-1, UJ-2, UJ-4.

**Consequences (testable):**
- Golden files cover single-tax, multi-tax, inclusive/exclusive tax display cases.
- Mismatch between displayed and payload totals is a test failure.
- Validation rejects `LINE_TOTAL_MISMATCH` and `TAX_TOTAL_MISMATCH` before render.

#### FR-10: Preview before render

Authenticated users and API clients can request HTML (or visual) Preview of a validated Payload without persisting an Artifact. Realizes UJ-1.

**Consequences (testable):**
- `POST /v1/{documentType}/preview` returns preview content when validation passes.
- Preview uses same template engine as PDF render.

### 4.3 REST API (Primary Interface)

**Description:** ElysiaJS REST API is the primary integrator surface at MVP, documented via OpenAPI 3.1. Workflows: validate, preview, render, download, retrieve. Realizes UJ-2, UJ-3, UJ-4, UJ-5.

**Functional Requirements:**

#### FR-11: Validate endpoint

`POST /v1/{documentType}/validate` accepts Payload and returns validation result without creating a Render. Realizes UJ-2, UJ-5.

**Consequences (testable):**
- Valid payload returns `200` with `{ valid: true, normalizedPreview: {...} }`.
- Invalid payload returns `422` with error envelope (see §10).

#### FR-12: Render endpoint

`POST /v1/{documentType}/render` validates, renders PDF, stores Artifact, creates Render Record. Realizes UJ-2, UJ-4.

**Consequences (testable):**
- Sync success (≤100 line items, completes within 10s hard render timeout): returns `201` with `Location: /v1/renders/{renderId}` and `{ renderId, status: "completed", shareUrl, expiresAt, schemaVersion, documentType, template }`.
- Async accepted (>100 line items, render timeout, or `Prefer: respond-async` header): returns `202` with `Location: /v1/renders/{renderId}` and `{ renderId, status: "processing", statusUrl }`.
- Hard cap: 500 line items per document; payloads exceeding cap rejected at validation.
- Failed render metadata carries a stable retriable or non-retriable error code.

#### FR-13: Retrieve render metadata

`GET /v1/renders/{renderId}` returns status, document type, template, timestamps, shareUrl, schema version, idempotency key fingerprint. Realizes UJ-2, UJ-4.

**Consequences (testable):**
- Cross-tenant access returns `404` (no enumeration).
- Expired share links reflected in metadata.

#### FR-14: Download render artifact

`GET /v1/renders/{renderId}/download` returns PDF bytes with correct `Content-Type` and `Content-Disposition`. Realizes UJ-2.

**Consequences (testable):**
- Download requires auth or valid signed download token.
- Audit log records download event.

#### FR-15: List render history

Authenticated account can list own Render Records with pagination and filters (document type, date range). Realizes UJ-1.

**Consequences (testable):**
- Default page size 20; max 100.
- Returns metadata only, not canonical business entities.

#### FR-16: OpenAPI specification

Published OpenAPI 3.1 spec at stable URL; used to generate TS SDK types. Realizes UJ-2, UJ-5.

**Consequences (testable):**
- Spec validates in CI (spectral or equivalent).
- Spec includes error envelope schema and all MVP endpoints.

#### FR-17: Rate limiting and quotas

API enforces per-account rate limits and monthly render quotas by tier. Realizes UJ-2, UJ-4.

**Consequences (testable):**
- Exceeding rate limit returns `429` with code `RATE_LIMITED` and `Retry-After`.
- Exceeding monthly quota returns `402` with code `QUOTA_EXCEEDED` and upgrade guidance.

**Notes:** Exact tier numbers follow pricing hypothesis in addendum; FR-17 requires limits exist, not final pricing.

### 4.4 Share Links & Artifact Storage

**Description:** Rendered PDFs live in Cloudflare R2; PostgreSQL stores metadata and signed URL parameters. Share links enable email/chat distribution without exposing API keys. Realizes UJ-1, UJ-2, UJ-4.

**Functional Requirements:**

#### FR-18: Artifact upload to object storage

On successful render, PDF bytes upload to R2 with content-addressed or renderId-keyed path; PostgreSQL stores bucket, key, checksum, byte size. Realizes UJ-2.

**Consequences (testable):**
- Failed upload marks render `failed`; no share link issued.
- Checksum verified on download.

#### FR-19: Signed share URLs

System generates signed HTTPS share URLs (`shareUrl`) for viewing/downloading artifacts. Default TTL 90 days; optional per-render `shareTtlDays` integer 1–365 (default 90). Share-link expiry is distinct from authenticated artifact access.

**Consequences (testable):**
- Expired share URL returns `403` or branded expiry page.
- URL signature invalid if tampered.
- `DELETE /v1/renders/{renderId}/share` revokes the share link; no reissue endpoint — re-render is the renewal path.

#### FR-20: Artifact lifecycle

Artifacts persist per documented retention policy; cleanup job removes expired objects from R2 while retaining audit metadata. Share-link TTL and artifact retention are distinct policies (see §11). Realizes UJ-4.

**Consequences (testable):**
- Artifact retention policy documented explicitly in API docs (minimum: artifacts retained for share-link TTL plus grace period; authenticated download availability may extend beyond share-link expiry per tier policy).
- Re-render with new idempotency key produces new artifact even for same business payload.

### 4.5 Authentication & API Keys

**Description:** Single-user authentication via better-auth for web app; scoped API keys for integrators. No multi-tenant org model at MVP. Realizes UJ-1, UJ-2, UJ-5.

**Functional Requirements:**

#### FR-21: Single-user account registration and login

Users register/login via email (better-auth); session powers web app. Realizes UJ-1.

**Consequences (testable):**
- Unauthenticated users cannot access render history or issue API keys.
- Password reset and session expiry follow better-auth defaults.

#### FR-22: API key issuance and scopes

Account owner creates API keys via `POST /v1/api-keys` with name, scopes (`renders:read`, `renders:write`, `webhooks:manage`, `audit:read`), and optional expiry; secret shown once. Lists keys via `GET /v1/api-keys`. Realizes UJ-2, UJ-5.

**Consequences (testable):**
- Keys hash at rest; plaintext never stored after creation.
- Request with insufficient scope returns `403` with required scope hint.

#### FR-23: API key revocation

Owner revokes keys immediately via `DELETE /v1/api-keys/{keyId}`; revoked keys fail auth. Realizes UJ-2.

**Consequences (testable):**
- Revoked key returns `401` on next request.
- Revocation event appears in audit log.

### 4.6 Idempotency & Webhooks

**Description:** Production embed flows require idempotent renders and async notification. Realizes UJ-2, UJ-4.

**Functional Requirements:**

#### FR-24: Idempotent render requests

`POST /v1/{documentType}/render` accepts `Idempotency-Key` header (1–255 printable ASCII characters, scoped per account + endpoint); duplicates within 24h return same Render Record without re-render or double quota charge. Realizes UJ-2, UJ-4.

**Consequences (testable):**
- Same key + same payload → identical `renderId` and `shareUrl`.
- Same key + different payload → `409` conflict error.

#### FR-25: Webhook registration

Account registers HTTPS webhook endpoints via `POST /v1/webhooks` and subscribes to `render.completed` and `render.failed`. Lists via `GET /v1/webhooks`; deletes via `DELETE /v1/webhooks/{webhookId}` (no secret-rotation endpoint at MVP — rotate via delete + recreate). Realizes UJ-4.

**Consequences (testable):**
- Webhook event envelope signed with `X-Usetagih-Signature` (see §10.5).
- Invalid SSL endpoint rejected at registration.
- Deleted webhook endpoint receives no further deliveries; deletion audited.

#### FR-26: Webhook delivery and retry

System delivers webhooks with HMAC signature; 8 attempts spanning ~24h with exponential backoff and jitter (≈30s, 2m, 10m, 30m, 1h, 3h, 8h, 12h). Same stable `eventId` on every attempt for consumer dedup. Retry only on network errors, `408`, `429`, and `5xx` (other `4xx` terminal). Realizes UJ-4.

**Consequences (testable):**
- Every delivery attempt logged in audit trail.
- Duplicate deliveries carry same `eventId` for consumer deduplication.
- Endpoint auto-disabled after 7 consecutive days of 100% failure with owner notification.

### 4.7 Audit Log

**Description:** Append-only audit trail for security and embed trust — not accounting. Realizes UJ-2, UJ-4.

**Functional Requirements:**

#### FR-27: Audit event capture

System records events: login, API key create/revoke, validate, render, download, webhook register/delete, webhook delivery attempt, share-link revoke. Realizes UJ-2.

**Consequences (testable):**
- Each entry includes actor, action, resource id, timestamp, IP (for API), outcome.
- Users can export or view recent audit entries in web app (MVP: last 90 days).

### 4.8 Web Application (Mantine)

**Description:** Mantine web app is a thin consumer of the same REST API — no server-side business logic bypassing validation. Realizes UJ-1.

**Functional Requirements:**

#### FR-28: Document creation form

Web UI provides forms for all three Document Types mapping 1:1 to Canonical Document Contract fields. Realizes UJ-1.

**Consequences (testable):**
- Form validation mirrors server validation messages.
- User cannot export until server validation passes.

#### FR-29: Preview and export actions

UI calls preview and render API endpoints; shows download and copy-link actions on success. Realizes UJ-1.

**Consequences (testable):**
- Playwright e2e covers create → preview → export happy path per document type.
- Error states display field-path messages from API.

#### FR-30: Render history view

UI lists past Render Records with re-download and re-copy link actions. Realizes UJ-1.

**Consequences (testable):**
- History matches API list endpoint data.
- Expired links show clear renewal guidance (re-render).

### 4.9 TypeScript SDK

**Description:** Official TS SDK exposes `validateLocally()` and `render()` aligned with OpenAPI. Realizes UJ-5.

**Functional Requirements:**

#### FR-31: Local validation

SDK validates Payload against bundled Zod schema without network call. Realizes UJ-5.

**Consequences (testable):**
- Local errors match server error codes and paths for shared fixture set.
- Published to npm (or documented install path) with semver aligned to schema versions.

#### FR-32: Render client

SDK `render()` handles auth header, idempotency key, retries on `429`, and typed responses. Realizes UJ-5.

**Consequences (testable):**
- Integration test against staging API passes for all document types.
- README includes sub-1-hour quickstart.

### 4.10 MCP Adapter (v1.1 — post-MVP)

**Description:** Thin MCP server wrapping REST backend; 3–5 tools max. Not MVP launch scope but architected from day one. Realizes UJ-3.

**Functional Requirements:**

#### FR-33: MCP tool — list_schemas

Returns document types, schema version, template enums, and schema summary. Realizes UJ-3.

**Consequences (testable):**
- Tool output matches `GET /v1/schemas` content.
- MCP tool count ≤5 including this tool.

#### FR-34: MCP tool — validate_payload

Accepts document type + JSON; returns validation errors or success. Realizes UJ-3.

**Consequences (testable):**
- Parity with REST validate endpoint for error envelope.

#### FR-35: MCP tool — render_document

Accepts document type, template, payload, optional idempotency key; returns renderId and shareUrl. Realizes UJ-3.

**Consequences (testable):**
- Calls same backend render path as REST; no duplicate render logic in MCP layer.

**Optional v1.1 tools:** `get_render_status`, `download_pdf` — include only if total tools remain ≤5.

**Out of Scope for MVP:** FR-33 through FR-35 ship in v1.1, not MVP launch.

## 5. Non-Goals (Explicit)

- **System of record** — usetagih will not own canonical clients, products, inventory, payments, or accounting entries.
- **Payments and money movement** — no payment links, Stripe integration, or reconciliation.
- **Sending and reminders** — no email delivery, dunning, or "invoice sent" workflow.
- **Multi-tenant orgs and teams** — single-user accounts only at MVP.
- **Template marketplace and visual template editor** — curated templates only.
- **Non-English localization** — English output only at MVP.
- **Regulated e-invoicing clearance** — no UBL/PEPPOL/e-Faktur network submission; PDF is customer-facing artifact only.
- **MCP tool explosion** — never expose 100+ MCP tools; max 5 in v1.1.
- **Silent financial correction** — never auto-fix totals, tax, or rounding discrepancies.
- **Marketing as "AI invoicing software"** — position as render infrastructure, not business suite.

## 6. MVP Scope

### 6.1 In Scope

- Document Types: `invoice`, `quotation`, `receipt`
- Templates: ~2 visual styles per type (6 total)
- Workflows: create (web), validate, preview, render, download, retrieve
- Outputs: PDF export + signed share link
- Auth: better-auth single-user + scoped API keys
- Data: PostgreSQL (metadata, history, audit) via Drizzle; Cloudflare R2 (artifacts)
- API: REST/OpenAPI 3.1 + official TS SDK
- Web: Mantine app consuming same API
- Reliability: idempotency keys, webhooks (`render.completed`, `render.failed`), audit log, schema versioning
- Testing: bun test unit/integration; Playwright e2e; golden-file PDF regression
- Deploy: Docker/Coolify on Contabo VPS; Cloudflare DNS/R2; Doppler secrets
- Quality bar: templates beat Invovate + invoice-generator.com; validation errors clearer than Invovate

### 6.2 Out of Scope for MVP

| Item | Reason | Target |
|------|--------|--------|
| MCP adapter | REST contract must stabilize first | v1.1 (FR-33–35) |
| Payments, sending, reminders | Product boundary | Never MVP |
| Multi-tenant orgs/teams | Complexity vs. wedge focus | Post-MVP |
| Template marketplace / editor | Opposite of opinionated embed UX | Post-MVP |
| Non-English localization | Scope control | Post-MVP |
| UBL/PEPPOL/e-Faktur clearance | Compliance is different product | Future adapter/partner |
| Python SDK | TS first; demand unvalidated | Post-MVP `[NOTE FOR PM]` |
| Enterprise SLA tier | Needs production volume proof | Post-MVP waitlist (no MVP SLA) |

## 7. Success Metrics

**Primary**

- **SM-1:** Template quality benchmark — internal side-by-side review rates usetagih PDFs ≥ Invovate and invoice-generator.com defaults for all 3 types × 2 templates. Validates FR-6, FR-7, FR-8, FR-9.
- **SM-2:** Validation error clarity — structured comparison scores usetagih higher than Invovate on ≥90% of seeded failure fixtures (path, code, message). Validates FR-2.
- **SM-3:** Golden-file suite — 100% pass rate on totals, taxes, rounding, multi-currency, dates, pagination fixtures. Validates FR-7, FR-8, FR-9.
- **SM-4:** Embed flow completeness — validate → render → webhook → retrieve share link works with idempotent retry in staging demo. Validates FR-11, FR-12, FR-24, FR-25, FR-26.

**Secondary (90 days post-launch)**

- **SM-5:** 3 design-partner embed integrators in active production use. Validates FR-11–FR-17.
- **SM-6:** 100+ free-tier accounts; 10+ paid Embed Pro conversions. Validates FR-17, monetization hypothesis.
- **SM-7:** Official TS SDK referenced in ≥3 external integrator repos. Validates FR-31, FR-32.

**Counter-metrics (do not optimize)**

- **SM-C1:** MCP tool count — must remain ≤5 through v1.1; do not chase InvoiceCave-style breadth. Counterbalances agent distribution pressure.
- **SM-C2:** Feature creep into ledger/payments — zero API endpoints for clients, payments, or inventory CRUD. Counterbalances integrator feature requests.
- **SM-C3:** Regulated compliance scope — zero marketing or API copy implying PEPPOL/e-Faktur/VeriFactu clearance. Counterbalances compliance tailwind confusion.

## 8. Cross-Cutting NFRs

#### NFR-1: API latency

Render API P95 ≤ 2s for payloads ≤100 line items (sync path) under normal load (excluding async webhook delivery).

#### NFR-2: Availability

MVP target 99.5% monthly uptime for API and share link resolution.

#### NFR-3: Security transport

All API and web traffic HTTPS only; HSTS enabled in production.

#### NFR-4: Secret management

No secrets in repository; Doppler (or equivalent) injects secrets at runtime.

#### NFR-5: Data isolation

Render Records and API keys isolated per account; no cross-tenant data leakage in queries or URLs.

#### NFR-6: PDF determinism CI gate

Golden-file PDF tests run in CI on every render pipeline change; failures block merge.

#### NFR-7: Error envelope consistency

All API errors use unified envelope (see §10); no bare string errors.

#### NFR-8: Observability

Structured logs for render pipeline stages; metrics for render success/failure rate, latency, webhook delivery.

#### NFR-9: Accessibility (web app)

Mantine forms meet WCAG 2.1 AA for create/preview/export flows.

#### NFR-10: Schema breaking change policy

Breaking schema changes require new Schema Version, migration notes, and 90-day deprecation notice for prior version.

#### NFR-11: Audit immutability

Audit log entries append-only; no user or admin delete at MVP.

#### NFR-12: Rate limit fairness

Rate limits per API key; documented defaults and response headers.

## 9. Constraints and Guardrails

### 9.1 Tech stack (binding)

TypeScript, Bun, turborepo monorepo, Mantine UI, Zod, ElysiaJS API, PostgreSQL + Drizzle ORM, better-auth, Playwright e2e + bun test, Docker/Coolify deploy, Cloudflare R2, Doppler secrets, Biome + ultracite. No alternative stack without explicit decision-board revision.

### 9.2 Architecture shape (binding)

One canonical Zod document contract + deterministic render pipeline is the product core. REST/OpenAPI primary at MVP; Mantine web app and MCP adapter are thin consumers/wrappers — no duplicate business logic.

### 9.3 Marketing and API copy guardrails

All public docs, OpenAPI descriptions, and error messages must avoid implying payments, bookkeeping, or regulated e-invoicing clearance. Include explicit "render layer only" positioning.

### 9.4 Privacy

Payloads processed for render are not marketed as permanently stored canonical business records; retention limited to Render Record metadata and Artifact TTL. `[ASSUMPTION: GDPR-aligned privacy policy published before public launch.]`

## 10. Agent-API Schema Sketch

**Status:** board-ratified contract v1 (2026-07-20). Full Zod source lives in codebase; this is the PRD-level contract. MCP v1.1 tool mapping (§10.4) unchanged.

### 10.1 Canonical Document Contract (discriminated union)

`documentType` in the URL path is authoritative. If `documentType` is present in the request body, it must match the path; mismatch → `400` with code `DOCUMENT_TYPE_MISMATCH`. Fields belonging to another document type are rejected.

Account settings hold default branding (logo, accent color, business identity). Optional per-payload override: `branding?: { logoUrl?: string; accentColor?: string }`. `logoUrl` must be HTTPS-only; fetched once per render; byte checksum recorded on the Render Record so determinism is defined over fetched bytes. Logo limits: max 2 MB; content types `image/png`, `image/jpeg`, `image/svg+xml` only.

```typescript
// Schema Version: 2026-07-20 — board-ratified contract v1

interface Money {
  amount: string; // canonical decimal string, non-negative base-10, no exponent notation
}

interface Party {
  name: string;       // max 200 chars
  email?: string;     // max 254 chars
  address?: Address;
  taxId?: string;     // max 50 chars
}

interface Address {
  line1: string;      // max 200 chars
  line2?: string;     // max 200 chars
  city: string;       // max 100 chars
  region?: string;    // max 100 chars
  postalCode?: string; // max 20 chars
  country: string;    // ISO 3166-1 alpha-2
}

interface LineItem {
  description: string; // max 500 chars
  quantity: number;    // > 0, at most 3 fractional digits; beyond-precision values REJECTED (never rounded)
  unit?: string;       // max 50 chars
  unitPrice: Money;
  taxRate?: number;    // 0..1
  lineTotal: Money;
}

interface TaxLine {
  name: string;  // max 100 chars
  rate: number;  // 0..1
  amount: Money;
}

interface Branding {
  logoUrl?: string;    // HTTPS-only
  accentColor?: string; // CSS hex, e.g. "#0D9488"
}

interface BaseDocumentPayload {
  schemaVersion?: "2026-07-20";
  template: "modern" | "classic";
  documentNumber: string; // max 64 chars
  issuedAt: string;       // ISO 8601 date
  currency: string;       // ISO 4217
  seller: Party;
  lineItems: LineItem[];  // 1–500 per document
  taxLines?: TaxLine[];   // max 10
  discount?: Money;
  pricesIncludeTax?: boolean; // default false
  totals: {
    subtotal: Money;
    taxTotal: Money;
    grandTotal: Money;
  };
  notes?: string;                      // max 2000 chars
  metadata?: Record<string, string>;   // max 20 keys; key max 64 chars; value max 256 chars
  branding?: Branding;
  shareTtlDays?: number; // integer 1–365; default 90
}

interface InvoicePayload extends BaseDocumentPayload {
  documentType: "invoice";
  dueAt?: string;   // ISO 8601 date — invoice only
  buyer: Party;
}

interface QuotationPayload extends BaseDocumentPayload {
  documentType: "quotation";
  validUntil?: string; // ISO 8601 date — quotation only
  buyer: Party;
}

interface ReceiptPayload extends BaseDocumentPayload {
  documentType: "receipt";
  paidAt?: string;            // ISO 8601 date — receipt only
  paymentReference?: string;  // max 128 chars — receipt only
  buyer?: Party;              // optional on receipts
}

type DocumentPayload = InvoicePayload | QuotationPayload | ReceiptPayload;
```

**Normative arithmetic rules:**

- `lineTotal = quantity × unitPrice`, rounded half-up to currency minor units; declared `lineTotal` mismatch → `422` with code `LINE_TOTAL_MISMATCH`.
- `subtotal = Σ lineTotals`.
- Tax-exclusive (`pricesIncludeTax: false`, default): `grandTotal = subtotal − discount + taxTotal`.
- Tax-inclusive (`pricesIncludeTax: true`): `grandTotal = subtotal − discount`.
- When `taxLines` present, `totals.taxTotal` must equal `Σ taxLines[].amount`; mismatch → `422` with code `TAX_TOTAL_MISMATCH`.
- `discount ≤ subtotal`; tax rates in range 0..1.
- Rounding mode half-up documented in FR-4; enforced across all monetary calculations.

**Idempotency keys:** 1–255 printable ASCII characters (not UUID-only), scoped per account + endpoint.

### 10.2 Key REST endpoints

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/v1/schemas` | Current schema version, types, templates |
| POST | `/v1/{documentType}/validate` | Validate payload |
| POST | `/v1/{documentType}/preview` | HTML/visual preview |
| POST | `/v1/{documentType}/render` | Validate + render PDF |
| GET | `/v1/renders/{renderId}` | Render metadata |
| GET | `/v1/renders/{renderId}/download` | PDF bytes (authenticated) |
| DELETE | `/v1/renders/{renderId}/share` | Revoke share link (no reissue — re-render to renew) |
| GET | `/v1/renders` | Paginated history |
| POST | `/v1/api-keys` | Create API key |
| GET | `/v1/api-keys` | List API keys |
| DELETE | `/v1/api-keys/{keyId}` | Revoke API key |
| POST | `/v1/webhooks` | Register webhook |
| GET | `/v1/webhooks` | List webhooks |
| DELETE | `/v1/webhooks/{webhookId}` | Delete webhook (rotate secret via delete + recreate) |
| GET | `/v1/audit` | Audit log (paginated) |

**Render success (sync):** `201` with `Location: /v1/renders/{renderId}` and body `{ renderId, status: "completed", shareUrl, expiresAt, schemaVersion, documentType, template }`. `shareUrl` is the signed public share link; authenticated download remains `GET /v1/renders/{renderId}/download`.

**Async accepted:** `202` with `Location: /v1/renders/{renderId}` and body `{ renderId, status: "processing", statusUrl }`. Triggered when >100 line items, render exceeds 10s hard timeout, or client sends `Prefer: respond-async`.

**Failed render:** metadata includes stable retriable or non-retriable error code.

Headers: `Authorization: Bearer <api_key>`, `Idempotency-Key: <key>` (render; 1–255 printable ASCII), `Prefer: respond-async` (optional; forces `202`), `Content-Type: application/json`.

API key scopes: `renders:read`, `renders:write`, `webhooks:manage`, `audit:read`.

### 10.3 Error envelope

All errors use the envelope; `details` may be empty. Each documented error code maps to exactly one stable HTTP status.

```json
{
  "error": {
    "code": "VALIDATION_FAILED",
    "message": "Payload failed schema validation",
    "requestId": "req_01H...",
    "details": [
      {
        "path": "/totals/grandTotal",
        "code": "TAX_TOTAL_MISMATCH",
        "message": "taxTotal 110.00 does not match sum of taxLines 108.90",
        "expected": "108.90",
        "received": "110.00"
      }
    ]
  }
}
```

HTTP mapping (one code → one status): `400` invalid request, unsupported schema version, `DOCUMENT_TYPE_MISMATCH`; `401`/`403` auth/scope; `402` `QUOTA_EXCEEDED` only; `404` not found; `409` idempotency conflict; `422` validation (`VALIDATION_FAILED`, `LINE_TOTAL_MISMATCH`, `TAX_TOTAL_MISMATCH`, etc.); `429` `RATE_LIMITED` only; `500` internal.

### 10.4 MCP tools (v1.1 — mapping unchanged)

| Tool | Maps to |
|------|---------|
| `list_schemas` | `GET /v1/schemas` |
| `validate_payload` | `POST /v1/{documentType}/validate` |
| `render_document` | `POST /v1/{documentType}/render` |
| `get_render_status` (optional) | `GET /v1/renders/{renderId}` |
| `download_pdf` (optional) | `GET /v1/renders/{renderId}/download` |

### 10.5 Webhook event envelope

```json
{
  "eventId": "evt_01H...",
  "type": "render.completed",
  "createdAt": "2026-07-20T12:00:00Z",
  "data": {
    "renderId": "rnd_01H...",
    "status": "completed",
    "shareUrl": "https://..."
  }
}
```

```json
{
  "eventId": "evt_01H...",
  "type": "render.failed",
  "createdAt": "2026-07-20T12:00:00Z",
  "data": {
    "renderId": "rnd_01H...",
    "status": "failed",
    "error": {
      "code": "RENDER_TIMEOUT",
      "message": "Render exceeded 10s hard timeout",
      "retriable": true
    }
  }
}
```

- `type`: `"render.completed"` | `"render.failed"`.
- Signed with `X-Usetagih-Signature` (HMAC-SHA256 over `{timestamp}.{body}`).
- Consumers deduplicate by stable `eventId` across all delivery attempts (see FR-26).

## 11. Resolved Decisions (Gate-2, 2026-07-20)

All former open questions resolved by decision board gate-2 ruling 2026-07-20:

1. **Share link TTL (OQ-1):** Default TTL 90 days. Per-render optional `shareTtlDays` integer 1–365 (default 90). Share-link expiry is distinct from authenticated artifact access; artifact retention policy documented explicitly in FR-20 and API docs.
2. **Free-tier watermark (OQ-2):** Single footer line `Rendered with usetagih · usetagih.com` (~8pt gray) on all free-tier PDFs; never diagonal watermark. Removed at Embed Pro+ (white-label).
3. **Hybrid sync/async (OQ-3):** Sync `201` for documents ≤100 line items within 10s hard render timeout; >100 line items or timeout → `202` + webhook/poll; hard cap 500 line items per document; `Prefer: respond-async` header forces `202`.
4. **Webhook delivery (OQ-4):** 8 attempts spanning ~24h, exponential backoff with jitter (≈30s, 2m, 10m, 30m, 1h, 3h, 8h, 12h); same stable `eventId` on every attempt; retry only on network errors/`408`/`429`/`5xx` (other `4xx` terminal); every delivery attempt in audit log; auto-disable endpoint after 7 consecutive days of 100% failure with owner notification.
5. **Pricing (OQ-5):** Endorsed as working hypothesis; final numbers confirmed pre-launch GTM. Structural tiers in addendum: Free ($0/100 renders/mo) includes scoped API keys + idempotency + footer watermark; Embed Pro ($29/2k) adds webhooks + white-label; Scale ($99/10k + $0.01 overage); Enterprise = post-MVP waitlist (no MVP SLA).

## 12. Assumptions Index

- §4.1 FR-5 — MVP renders English-only labels; buyer locale field deferred.
- §4.4 FR-19 — Default share link TTL 90 days; optional `shareTtlDays` 1–365.
- §4.4 FR-20 — Artifact retention policy distinct from share-link TTL; documented in API docs.
- §11 OQ-5 — Pricing tier numbers are working hypothesis; final numbers set pre-launch GTM.
- §9.4 — GDPR-aligned privacy policy published before public launch.
- Brief memlog — wedge strength 6.5/10; must win on schema DX and templates, not breadth.
- Primary geography — global English-first developers; Indonesia secondary for company context, not MVP compliance scope.
- MCP ships v1.1 after REST stabilization; MVP architecture preserves thin-adapter path.
- Single Contabo VPS + Coolify adequate for MVP traffic with Docker deploy.

## 13. Risks and Mitigations

| Risk | Severity | Mitigation |
|------|----------|------------|
| Commodity JSON→PDF trap | High | FR-2, FR-7, SDK, template investment (SM-1) |
| E-invoicing expectation mismatch | Medium | §5 non-goals, SM-C3 marketing guardrails |
| MCP suite competitors set breadth expectations | Medium | SM-C1, positioning as infrastructure |
| Mediocre templates | High | Golden files, design benchmark (SM-1) |
| Local MCP bypass | Medium | Hosted determinism, share links, audit (FR-27) |

---

**Document status:** Final — ready for UX (`bmad-ux`), architecture (`bmad-architecture`), and epics (`bmad-create-epics-and-stories`).

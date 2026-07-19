---
title: "Product Brief: usetagih"
status: draft
created: 2026-07-20
updated: 2026-07-20
---

# Product Brief: usetagih

## Executive Summary

**usetagih** is a strict-schema document render API for finance apps and AI agents that already own their data. Send validated invoice, quotation, or receipt payloads — from any source — and receive deterministic, branded PDFs plus shareable links. No client database, no payments, no ledger, no regulated e-invoicing clearance.

Verasic Labs (PT Ide Datang Mendadak, Cimahi Bandung, Indonesia) is building usetagih because teams repeatedly rebuild PDF generation for business documents — fighting page breaks, currency formatting, template drift, and maintenance burden — while agent-native invoicing tools pull integrators into full accounting suites they do not want. usetagih draws a hard boundary: **validated payload in, branded artifact out**. The web app and MCP are thin adapters over the same canonical Zod schema and deterministic render pipeline.

Market research confirms the wedge is real but narrow (rated **6.5/10**): demand for embeddable document rendering exists, but the commodity tier is crowded (Invovate, invoice-generator.com, generic PDF APIs). usetagih wins only if schema developer experience, multi-document-type uniformity, template quality, and embed simplicity are visibly better than incumbents — not by claiming to be another "invoice platform."

**Positioning one-liner:** *Strict schema in. Branded PDF out. No ledger.*

## The Problem

**Finance and vertical SaaS teams** already store customers, line items, taxes, and totals in their own databases. When they need a professional invoice, quotation, or receipt, they face a bad tradeoff:

- **Roll your own** — Puppeteer, wkhtmltopdf, or PDF libraries cost 2–8 weeks to ship and ongoing maintenance (fonts, pagination, rounding, multi-currency).
- **Adopt an invoicing suite** — Invoice Ninja, Zoho Invoice, or Stripe Invoicing force data into the vendor's client/payment model just to render a PDF.
- **Use a commodity JSON→PDF API** — Invovate and invoice-generator.com work, but accept loose JSON, offer inconsistent validation, and blur compliance expectations.

**AI agent users** (Claude CLI, Cursor, custom MCP clients) have messy upstream data — spreadsheets, local JSON, unstructured text — and need a **forcing function** that converts chaos into a valid render payload without standing up a books system. Agent-suite players (InvoiceCave with 102 MCP tools, Factuarea with 292) solve "run my business," not "render this document from data I already have."

The cost of the status quo: duplicated render logic across products, silent financial-value corrections that corrupt totals, integration fear from accidental ledger writes, and buyer confusion when "invoice API" implies PEPPOL, e-Faktur, or payment collection.

## The Solution

usetagih is a **schema-first, data-agnostic document rendering layer**:

1. **Canonical Zod document schema** — one shared contract shape across invoice, quotation, and receipt; explicit validation failures; never silently correct financial values.
2. **Deterministic render pipeline** — curated visual templates (~2 styles per document type at MVP) producing pixel-stable PDFs; golden-file regression tests for totals, taxes, rounding, currencies, dates, and pagination.
3. **REST/OpenAPI-first API** — create, validate, preview, render, download, and retrieve workflows; PDF export; shareable signed URLs; idempotency keys; webhooks; scoped API keys; audit log; schema versioning.
4. **Thin adapters** — Mantine web app for humans; MCP server (3–5 tools, v1.1) for agents — both call the same core.

Integrators send `POST /v1/{documentType}/render` with a validated payload. usetagih returns `{ pdfBytes, url, renderId }` without storing canonical business data as a system of record.

## What Makes This Different

| usetagih | Primary alternative (Invovate) | Agent suites (InvoiceCave, Factuarea) |
|----------|-------------------------------|---------------------------------------|
| Strict Zod schema with excellent validation errors | Flexible JSON via OpenAPI; validation not the product | 100+ MCP tools; full accounting/compliance |
| Unified contract across invoice/quote/receipt | Invoice-focused | Business workflow ownership |
| Stateless render-only boundary (feature, not gap) | Same boundary, weaker schema story | System of record by design |
| Curated templates + deterministic output | 5 templates, good enough PDF | Many templates tied to their data model |
| REST-first embed DX (webhooks, idempotency, audit) | REST + MCP today; 7-day hosted links | High integration friction for one-shot render |

**Honest weaknesses:** Standalone JSON→PDF is commoditized. Without superior schema DX and template polish, usetagih looks like Invovate-with-extra-steps. E-invoicing mandates (PEPPOL, Coretax/e-Faktur, VeriFactu) are a tailwind for compliance vendors, not for MVP — buyers may assume clearance capability and be disappointed. MCP breadth is not a moat; 3–5 focused tools beat 102 generic ones only if positioning stays crisp.

## Who This Serves

**Primary — embed integrators**
- Finance SaaS and vertical platforms that hold canonical customer/transaction data and need branded documents without syncing entities into Stripe or Invoice Ninja.
- Marketplaces and payout tools generating receipts/invoices from their own ledgers.
- Agent tool makers needing a hosted, deterministic render backend with share links and audit trails (vs. local Typst/Puppeteer bypass).

**Secondary — direct users**
- Solo operators and small teams using the Mantine web app to create documents manually.
- Developers and AI agents calling the API or MCP with data from spreadsheets, JSON, or unstructured text.

**Success for them:** First branded PDF in under an hour of integration; validation errors that pinpoint exactly which field failed; zero fear of accidental payment recording or client CRUD side effects.

## Success Criteria

**Product (MVP launch)**
- Side-by-side template review: usetagih PDFs rated equal or better than Invovate and invoice-generator.com defaults by internal benchmark.
- Schema validation errors cited as clearer than Invovate in structured comparison (field path, expected type, business rule).
- Golden-file test suite passes for totals, taxes, rounding, multi-currency, dates, and pagination across all 3 document types × 2 templates.
- End-to-end embed flow: validate → render → webhook → retrieve share link, with idempotency verified under retry.

**Adoption (90 days post-launch)**
- 3 design-partner embed integrators in active use (finance SaaS, agent tool, or marketplace).
- 100+ free-tier accounts; 10+ paid Embed Pro conversions.
- Official TS SDK with `validateLocally()` + `render()` downloaded or referenced in integrator repos.

**Boundary discipline**
- Zero marketing or API copy implying payments, bookkeeping, or regulated e-invoicing clearance.
- MCP tool count stays ≤5 through v1.1; no scope creep into client CRUD or dunning.

## Scope

**In (MVP)**
- Document types: invoice, quotation, receipt — ~2 visual styles each.
- Workflows: create, validate, preview, render, download, retrieve.
- Outputs: PDF export + shareable signed URL.
- Auth: single-user (better-auth) + scoped API keys.
- Infrastructure: PostgreSQL (document metadata/history via Drizzle), Cloudflare R2 (rendered artifacts), idempotency keys, audit log, schema versioning.
- Interfaces: REST/OpenAPI 3.1 + official TS SDK; web app (Mantine).
- Testing: Playwright e2e + bun test; golden-file rendering tests.
- Deployment: Docker/Coolify on Contabo VPS; Cloudflare DNS/R2; Doppler secrets.

**Out (MVP — explicit non-goals)**
- Payments, sending/reminders, multi-tenant orgs/teams.
- Template marketplace, visual template editor.
- Non-English localization.
- Regulated e-invoicing output (UBL/PEPPOL/e-Faktur clearance — deferred; future adapter/partner path only).
- MCP beyond thin v1.1 adapter (3–5 tools: render, validate, list schemas).

**Stack (constraint):** TypeScript, Bun, turborepo, Mantine UI, Zod, ElysiaJS, PostgreSQL + Drizzle, better-auth, Biome + ultracite.

## Vision

If usetagih succeeds, it becomes the **default document render infrastructure** beneath finance apps and agent tooling — the "Stripe Tax for documents" layer that no one rebuilds. Finance platforms embed usetagih for branded artifacts; agents use strict schemas as the contract between messy sources and deterministic output; compliance needs route through future adapter partners (e.g., InvoiceXML) rather than scope creep.

In 2–3 years: expanded document types (credit notes, delivery notes), additional curated templates, enterprise SLAs, webhook ecosystem maturity — still **not** a system of record. The moat, if one exists, is schema discipline + template quality + embed trust, earned through production volume and golden-file determinism, not feature breadth.

## Risks (Top 5)

1. **Commodity trap** — Invovate + invoice-generator.com cap pricing power. *Mitigation:* schema UX, multi-doc uniformity, embed SDK, template investment.
2. **E-invoicing expectation mismatch** — Buyers in BE/FR/ID assume clearance. *Mitigation:* loud non-compliance scope in marketing and API docs.
3. **Suite players absorb agent narrative** — InvoiceCave sets MCP breadth expectations. *Mitigation:* position as infrastructure beneath suites.
4. **Mediocre templates** — Fixed templates must beat Invovate visually. *Mitigation:* design investment + golden-file regression.
5. **Local MCP bypass** — Open-source render servers for zero marginal cost. *Mitigation:* hosted determinism, share links, audit trail for businesses.

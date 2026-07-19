# Product Brief Addendum: usetagih

Supplementary detail for downstream PRD, architecture, and go-to-market work. Not duplicated in the executive brief.

## Company Context

- **Legal entity:** PT Ide Datang Mendadak (Verasic Labs brand)
- **Location:** Cimahi, Bandung, Indonesia
- **Team size:** 5 persons
- **Operating model:** IT project delivery worldwide; usetagih is a product bet on embeddable document rendering

## Competitive Landscape (Decision-Grade)

### Category placement

```
[Compliance e-invoicing]  InvoiceXML, Factuarea, PEPPOL-enabled suites
         ↑
[Invoicing suites + MCP]  InvoiceCave, Orizu, Invoice Ninja
         ↑
[Render / embed layer]  ← usetagih →  Invovate, invoice-generator.com
         ↑
[Generic PDF engines]   PDFMonkey, Carbone, APITemplate, Anvil
```

### Primary competitor deep dive: Invovate

- OpenAPI 3.1, `POST /api/generate-invoice`, outputs json | pdf | ubl
- Anonymous JSON totals free; PDF/UBL require free API key
- MCP server on npm (`invovate-mcp-server`); 4 tools
- 7-day hosted link expiry — chat UX, not long-lived embed
- 11 languages; 5 templates
- UBL explicitly not regulated e-invoicing

**usetagih must beat Invovate on:** validation error quality, multi-doc-type contract uniformity, template visual polish, embed DX (webhooks, idempotency, audit, longer-lived share URLs TBD in PRD).

### Nearest commodity analog: invoice-generator.com

- Stateless JSON → PDF; 100 free invoices/month
- Simple REST; UBL on paid tiers
- Weakest on schema strictness and actionable validation errors

### Agent-suite players (adjacent, not direct MVP competitors)

| Player | MCP tools | Core job | Why not usetagih |
|--------|-----------|----------|------------------|
| InvoiceCave | 102 | Full invoicing + double-entry | System of record |
| Factuarea | 292 | Spanish invoicing + VeriFactu | Compliance + ledger |
| DocsAutomator | 17 | Google Doc/PDF automation | General docs, not invoice schemas |
| Orizu | 33 | Draft/send/reconcile + PDF | Workflow + payments |

## Wedge Analysis (Honest)

**Rating: 6.5/10** — viable B2B embed niche; not a wide moat at MVP.

**When usetagih wins:**
1. Finance/vertical SaaS holds canonical data; wants `POST {strictSchema}` → `{pdf, url, renderId}` without vendor entity sync.
2. Agent with messy upstream sources needs Zod as forcing function.
3. Integrator wants opinionated templates, not a template editor (Carbone/PDFMonkey push authoring cost to customer).
4. Explicit non-goals reduce integration fear (no accidental ledger writes).

**When usetagih loses:**
- Invovate: free tier, MCP today, good enough PDF
- invoice-generator.com: simplest API, 100 free/mo
- Stripe Invoicing: already on Stripe; payments included
- InvoiceCave MCP: user wants agent to run the business
- InvoiceXML: buyer needs Peppol/Factur-X now
- Roll-your-own + Carbone: arbitrary DOCX templates, in-house template team

## Pricing Hypothesis (Not Final)

Benchmarks from market research (July 2026):

| Model | Market signal |
|-------|---------------|
| Free tier 100–300 docs/mo | Table stakes (Invovate, invoice-generator, PDFMonkey) |
| $15–50/mo for low thousands | APITemplate $19/3k; PDFMonkey €5/300 |
| Per-doc overage €0.005–0.02 | PDFMonkey PAYG; Carbone €0.001–0.05 |

**Proposed tiers (hypothesis for PRD):**
- **Free:** 100 renders/mo, watermark or usetagih footer
- **Embed Pro:** $29/mo — 2,000 renders, API keys, webhooks, idempotency, white-label
- **Scale:** $99/mo — 10,000 renders + PAYG $0.01/doc
- **Enterprise:** custom SLA + dedicated templates (still not compliance)

## MVP Table Stakes (from competitor analysis)

| Feature | Why required |
|---------|--------------|
| PDF export | Core output |
| Shareable signed URLs | Email/chat/embed without storage liability |
| API keys + HTTPS | B2B embed |
| Idempotency keys | Webhook + retry safety |
| OpenAPI 3.1 spec | Agent + SDK ecosystem |
| Server-side schema validation w/ actionable errors | **Primary differentiator** |
| Webhooks (`render.completed`) | Async embed flows |
| Template param (enum) | Brand selection |
| Rate limits + quota tiers | Commercial model |

## Interface Strategy

**MVP:** REST/OpenAPI-first with official TS SDK (Zod parse client-side and server-side).

**v1.1:** Thin MCP server mirroring Invovate/Carbone pattern:
- `render_document`
- `validate_payload`
- `list_schemas`
- (optional) `get_render_status`
- (optional) `download_pdf`

Max 5 tools. Never expose 100+ MCP tools.

## Technical Architecture Notes (for PRD handoff)

**Product core:** canonical Zod document schema + deterministic render pipeline.

**Adapters:**
- ElysiaJS REST API (primary)
- Mantine web app (human UX)
- MCP server v1.1 (agent distribution)

**Data boundaries:**
- PostgreSQL: document metadata, render history, audit log, API keys — not canonical business entities
- Cloudflare R2: rendered PDF artifacts
- Explicit: usetagih does not become system of record for clients, payments, or inventory

**Schema versioning:** Required from MVP; breaking changes need versioned endpoints or schema negotiation.

## Regulatory Context (Deferred, Not MVP)

| Tailwind | Who benefits | usetagih MVP |
|----------|--------------|--------------|
| PEPPOL / EN 16931 (BE live Jan 2026; FR Sep 2026) | InvoiceXML, PEPPOL suites | Out of scope; future adapter |
| Indonesia Coretax / e-Faktur | Local compliance integrators | Out of scope; PDF is customer-facing artifact only |
| Agent tooling boom (MCP) | First movers with REST + MCP | Distribution channel, not moat |

## Design Partner Targets (Post-Brief)

1. Finance SaaS with existing customer DB needing branded invoices
2. Agent tool maker needing hosted render + share links
3. Marketplace/payout platform generating receipts from transaction data

## Next Steps (BMad Method)

1. PRD: Zod schemas for invoice, quotation, receipt (v1) with shared line-item primitives
2. Side-by-side PDF benchmark vs Invovate + invoice-generator.com
3. Architecture: render pipeline, R2 lifecycle, webhook delivery, idempotency implementation
4. Marketing guardrails doc: "Not a compliance platform" copy blocks
5. SDK story: TS `validateLocally()` + `render()` with OpenAPI-generated types

## Source Documents

- Market research: `_bmad-output/planning-artifacts/research/market-schema-first-document-rendering-embed-layer-research-2026-07-20.md`
- King's verbatim product idea (2026-07-20 session)
- Decision-board ratified conditions (2026-07-20)

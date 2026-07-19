# PRD Addendum: usetagih

Overflow from the PRD — mechanism details, pricing hypothesis, competitive rationale, and technical handoff notes. The PRD remains the authoritative requirements document; this addendum supports architecture and GTM agents.

## Company Context

- **Legal entity:** PT Ide Datang Mendadak (Verasic Labs brand)
- **Location:** Cimahi, Bandung, Indonesia
- **Team size:** 5 persons
- **Operator:** King (intermediate skill level; English-first product)

## Pricing Hypothesis (Working — Final Numbers Pre-Launch GTM)

Endorsed as working hypothesis by decision board gate-2 ruling 2026-07-20. Final tier numbers confirmed before public launch GTM.

Benchmarks from July 2026 market research:

| Tier | Price | Includes |
|------|-------|----------|
| **Free** | $0/mo | 100 renders/mo; scoped API keys; idempotency; footer watermark (`Rendered with usetagih · usetagih.com`) |
| **Embed Pro** | $29/mo | 2,000 renders/mo; webhooks; white-label (no footer watermark) |
| **Scale** | $99/mo | 10,000 renders/mo + PAYG $0.01/render overage |
| **Enterprise** | Waitlist | Post-MVP; no MVP SLA — dedicated templates, custom terms when available |

Competitor anchors: Invovate free tier; invoice-generator.com 100 free/mo; PDFMonkey €5/300; APITemplate $19/3k.

**Resolved (gate-2):** Free tier uses single footer line watermark (~8pt gray); never diagonal. Removed at Embed Pro+.

## Competitive Positioning (Decision-Grade)

### Category placement

```
[Compliance e-invoicing]  InvoiceXML, Factuarea, PEPPOL suites
         ↑
[Invoicing suites + MCP]  InvoiceCave, Orizu, Invoice Ninja
         ↑
[Render / embed layer]  ← usetagih →  Invovate, invoice-generator.com
         ↑
[Generic PDF engines]   PDFMonkey, Carbone, APITemplate, Anvil
```

### Primary competitor: Invovate

- OpenAPI 3.1; `POST /api/generate-invoice`; json | pdf | ubl output
- 7-day hosted links; 5 templates; MCP via OSS server (4 tools)
- **usetagih must beat on:** validation errors, multi-doc contract uniformity, template polish, embed DX (webhooks, idempotency, audit, longer share URLs)

### When usetagih wins vs. loses

**Wins:** Finance SaaS with own DB; agents needing schema forcing function; opinionated templates; explicit non-goals reduce integration fear.

**Loses:** Invovate free tier; invoice-generator simplicity; Stripe-native billing; InvoiceCave "run my business"; InvoiceXML compliance now; roll-your-own + Carbone for arbitrary DOCX.

**Wedge rating:** 6.5/10 — viable embed niche; narrow moat without execution on schema + templates.

## Technical Architecture Handoff

### Monorepo layout (suggested)

```
apps/
  api/          # ElysiaJS REST + OpenAPI
  web/          # Mantine consumer
  mcp/          # v1.1 thin adapter
packages/
  schema/       # Canonical Zod + exported types
  render/       # Deterministic PDF pipeline
  sdk/          # Official TS client
```

### Data boundaries

| Store | Holds | Does NOT hold |
|-------|-------|---------------|
| PostgreSQL | Render Records, API keys, webhooks, audit, account metadata | Canonical clients, payments, inventory |
| Cloudflare R2 | PDF artifacts | Business logic |
| better-auth tables | User sessions, credentials | Org/team membership |

### Render pipeline stages

1. Parse + validate Payload (Zod + business rules)
2. Resolve template + compile layout
3. Render PDF (deterministic engine — architecture doc selects library)
4. Upload to R2; persist Render Record
5. Emit webhook; write audit entry

### Idempotency implementation notes

- Key format: 1–255 printable ASCII characters (not UUID-only)
- Hash `Idempotency-Key` + account id + endpoint
- Store response snapshot for 24h minimum
- Payload hash mismatch → `409`

### Webhook signing

- Event envelope: `{ eventId, type, createdAt, data: { renderId, status, shareUrl?, error? } }` (see PRD §10.5)
- HMAC-SHA256 over `{timestamp}.{body}` with webhook secret
- Header: `X-Usetagih-Signature: t=...,v1=...`
- Consumer verifies timestamp skew ≤5 minutes; deduplicate by stable `eventId`
- Delivery: 8 attempts over ~24h with backoff (≈30s, 2m, 10m, 30m, 1h, 3h, 8h, 12h); retry on network/`408`/`429`/`5xx` only; auto-disable after 7 days 100% failure

### Schema versioning strategy

- MVP version string: `2026-07-20`
- Breaking changes → new version in `/v1/schemas` and Zod package semver major bump
- Support N and N-1 versions for 90 days post new release

### Golden-file testing

- Fixtures per document type × template × scenario (tax, currency, pagination)
- Store expected PDF hashes or pixel snapshots in `packages/render/__fixtures__`
- CI compares render output; intentional drift requires fixture PR with visual review

### Deployment

- Docker images per app; turborepo build pipeline
- Coolify on Contabo VPS; Cloudflare DNS + R2
- Doppler for `DATABASE_URL`, R2 credentials, auth secrets, webhook signing keys

## Design Partner Targets

1. Finance SaaS with existing customer DB needing branded invoices
2. Agent tool maker needing hosted render + share links
3. Marketplace/payout platform generating receipts from transaction data

## Marketing Guardrails (Copy Blocks)

Use in landing page, OpenAPI descriptions, and README:

> usetagih is a document **render layer**, not accounting software. We do not store your books, process payments, or submit e-invoices to tax authorities. Send validated data; receive PDFs and share links.

> **Not included:** PEPPOL, e-Faktur clearance, UBL network delivery, VeriFactu, payment collection, client CRM.

## Regulatory Context (Deferred)

| Mandate | usetagih MVP stance |
|---------|---------------------|
| PEPPOL / EN 16931 (BE, FR) | Out of scope; future adapter/partner (e.g., InvoiceXML) |
| Indonesia Coretax / e-Faktur | Out of scope; PDF is customer artifact only |
| ViDA cross-border 2030 | Monitor; no MVP commitment |

## Source Documents

- Brief: `_bmad-output/planning-artifacts/briefs/brief-usetagih-2026-07-20/brief.md`
- Brief addendum: `_bmad-output/planning-artifacts/briefs/brief-usetagih-2026-07-20/addendum.md`
- Market research: `_bmad-output/planning-artifacts/research/market-schema-first-document-rendering-embed-layer-research-2026-07-20.md`
- Decision-board ratified constraints (2026-07-20 session)

## Rejected Alternatives (Rationale Preserved)

| Alternative | Why rejected for MVP |
|-------------|------------------------|
| MCP-first interface | Finance backends and contract stability favor REST; MCP is distribution |
| Visual template editor | Pushes cost to customer; opposite of opinionated embed UX |
| Multi-tenant orgs | Complexity without validated demand |
| UBL output at MVP | Blurs compliance expectations; Invovate UBL is archival not clearance |
| Building client CRUD | Violates system-of-record boundary; competes with suites |

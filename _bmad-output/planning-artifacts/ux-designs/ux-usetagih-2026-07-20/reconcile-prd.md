# Reconcile: PRD → UX spines

**Source:** `_bmad-output/planning-artifacts/prds/prd-usetagih-2026-07-20/prd.md`

## Captured in EXPERIENCE.md

| PRD element | UX surface / decision |
|---|---|
| UJ-1 Maya web flow | `SCR-DOC-CREATE` wizard + history + share |
| UJ-2 Alex embed | `SCR-API-KEYS`, `SCR-AUDIT-LOG`; REST-only for render |
| UJ-3 Agent MCP | Not in web MVP; noted as v1.1 |
| UJ-4 Jordan webhook | Webhook delivery invisible in UI; share page for end recipient |
| UJ-5 Priya SDK eval | Template gallery + validation parity emphasis |
| FR-1–5 Schema | Schema-driven form engine, Zod shared contract |
| FR-6–10 Templates/render | Template gallery + create step 1–2 + preview |
| FR-11–17 REST API | Full API action map per screen |
| FR-18–20 Share links | `SCR-SHARE-PUBLIC`, copy link on success |
| FR-21 Auth | Auth screens + better-auth |
| FR-22–23 API keys | `SCR-API-KEYS` with show-once secret |
| FR-24–26 Webhooks | Explicitly API-only — no webhook UI |
| FR-27 Audit | `SCR-AUDIT-LOG` |
| FR-28–30 Web app | Create form, preview/export, history |
| §10 Error envelope | Validation error UX section |
| §5 Non-goals | Banned interactions, voice/tone guardrails |
| NFR-9 Accessibility | Accessibility floor section |

## Dropped / deferred (intentional)

| PRD item | Reason |
|---|---|
| MCP tools UI | v1.1 scope |
| Webhook registration UI | Not in MVP surface list; API-only |
| SDK documentation screens | Developer docs separate from app IA |
| Quota/billing upgrade flow | Pricing not ratified (PRD OQ-5) — alert copy only |

## Qualitative ideas preserved

- "Validation errors clearer than Invovate" → dedicated field-path error pattern with `expected`/`received`
- "Render layer only" positioning → landing footer, share page footer, banned accounting language
- Golden-file determinism → preview must match PDF template engine output

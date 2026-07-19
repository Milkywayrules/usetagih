---
title: "Correct Course Proposal: Harness Directives (2026-07-20)"
status: applied
awaiting: board-ratification
applied: 2026-07-20
ratification: 2x YES_WITH_NOTES
created: 2026-07-20
project: usetagih
author: correct-course (headless)
config:
  user_name: King
  communication_language: English
  planning_artifacts: _bmad-output/planning-artifacts
  implementation_artifacts: _bmad-output/implementation-artifacts
trigger: HARNESS-ADDITIONAL-INSTRUCTIONS.md (post Epic 2 retro, pre Epic 3)
---

# Correct Course Proposal — Harness Directives (2026-07-20)

**Board gate:** This document is a **draft amendment proposal only**. No PRD, architecture, epics, or sprint-status files are modified until the board ratifies numbered amendments (A1–An).

**Trigger:** King appended three directives to `HARNESS-ADDITIONAL-INSTRUCTIONS.md` after Epic 2 planning was ratified and completed. Epic 3 (API core) has not started — no Epic 3 story files exist yet. Timing is ideal for planning amendments before schema/auth implementation.

**Recommended path:** **Direct Adjustment (Option 1)** — modify existing epics/stories and planning artifacts; no rollback of Epics 0–2 required. **Scope classification:** **Major** (multi-tenant workspaces); **Minor** (base-ui constraint); **Moderate** (4-tier pricing formalization).

---

## Section 1: Issue Summary

### 1.1 Directives (verbatim)

1. never use radix-ui. use base-ui. if any implemented, refactor then QA. if not using radix / base, skip this line.
2. add pricing tier. i propose 4 tier with 1 tier is the base for trying out.
3. if havent, make it multi-tenant using better-auth. our user can have multi workspaces (for each client / projects / workspaces / organization). no need for multiple teams (better auth), only multi tenant. each user must have 1 workspace, cannot proceed if not have it.

### 1.2 Discovery context

| Check | Result |
| --- | --- |
| Epics 0–2 | Done (monorepo, CI, PDF spike PASS, schema package 58 tests) |
| Epic 3 | Backlog — 17 stories in `epics.md`, zero story files |
| Radix in `apps/` / `packages/` | **None** (`grep -ri radix` — no dependency or import) |
| Radix in planning artifacts | **None** — stack specifies Mantine v8 only |
| Radix in repo | BMad WDS skill templates only (not product code) |
| PRD pricing | Hypothesis in addendum + §11 OQ-5 (Free / Embed Pro / Scale / Enterprise waitlist) — not fully wired to schema enum or FR-17 tables |
| Multi-tenant | **Explicitly excluded** in PRD §5, §6.2, FR-21, addendum; UX bans org switcher |

### 1.3 Checklist summary (headless)

| Section | Status | Notes |
| --- | --- | --- |
| 1 Trigger & context | Done | Post-ratification harness directives |
| 2 Epic impact | Done | Epic 3 primary; Epics 4–8, 6 UI secondary |
| 3 Artifact conflicts | Done | Multi-tenant reverses ratified non-goal |
| 4 Path forward | Done | Direct adjustment; no Epic 0–2 rollback |
| 5 Proposal components | Done | This document |
| 6 User approval | **Deferred** | Board gate — no human in loop |
| 6.4 sprint-status update | **Deferred** | After ratification only |

---

## Section 2: Impact Analysis by Directive

### Directive 1 — base-ui (not radix-ui)

**Impact:** Low. No implementation work until Epic 6 UI scaffold.

| Artifact | Impact |
| --- | --- |
| `ARCHITECTURE-SPINE.md` | Add AD-13 UI primitives constraint |
| `SOLUTION-DESIGN.md` | §15 web notes — component primitive policy |
| `epics.md` Story 6.1 | AC: `@base-ui/react` for headless primitives; Mantine for styled shell |
| `DESIGN.md` / `EXPERIENCE.md` | Component stack note; no Radix/shadcn |
| Code (Epic 6+) | No refactor today — zero Radix usage |

**Risk:** Low. Mantine v8 does not require Radix; `@base-ui/react` complements Mantine for Dialog, Popover, Menu patterns if needed.

---

### Directive 2 — 4-tier pricing (1 base try-out tier)

**Impact:** Moderate. PRD/addendum already hypothesize four commercial tiers; amendment **formalizes MVP-enforced limits** on four enum values and maps watermark/quota stories.

| Artifact | Impact |
| --- | --- |
| `prd.md` §11 OQ-5, FR-7, FR-17, FR-20 | Tier enum, limit tables, watermark rule |
| `addendum.md` | Expand hypothesis table (rate limits, API keys, retention) |
| `SOLUTION-DESIGN.md` §7.1 | `workspace_settings.tier` enum (4 values) after workspace amendment |
| `epics.md` Stories 3.15, 3.11, 5.x, 8.8 | Quota/rate-limit ACs; launch checklist tiers |
| Billing/checkout | **Explicitly OUT of MVP** (unchanged) |

**Risk:** Medium — tier names/limits are hypothesis until GTM; must stay labeled hypothesis in PRD.

---

### Directive 3 — Multi-tenant workspaces (better-auth, no teams)

**Impact:** Major. Reverses ratified single-user / no-orgs MVP scope. Touches auth, data model, API scoping, UX flows, SDK context header.

| Artifact | Impact |
| --- | --- |
| `prd.md` FR-21, §5, §6, NFR-5, §10 | Workspace model, mandatory bootstrap, scoping |
| `addendum.md` | Data boundaries table |
| `ARCHITECTURE-SPINE.md` AD-5, AD-6, AD-7 | `workspaceId` replaces `accountId` in rules |
| `SOLUTION-DESIGN.md` §7.1 entire schema | `workspaces`, `workspace_settings`, FK migration |
| `epics.md` Epic 3 (+1 story), Epic 6 (+2 stories), Epic 7 | Auth, keys, idempotency, UI switcher |
| `EXPERIENCE.md` | Remove org-switcher ban; add SCR-WORKSPACE-* |
| `sprint-status.yaml` | After ratification: new story keys |

**better-auth fit:** Organization plugin supports users in multiple organizations with `activeOrganizationId` on session; **teams feature disabled** (default). Product maps **organization → workspace**. MVP: each workspace has exactly one member (creator/owner); no invites, no roles beyond owner, no teams.

**Risk:** High — every Epic 3+ query must filter by `workspace_id`; missing filter = cross-tenant leak. Epic 3 story count +3 net.

---

## Section 3: Conflicts with Ratified Architecture

| ID | Ratified state | Directive | Resolution |
| --- | --- | --- | --- |
| C1 | PRD §5 non-goal: "Multi-tenant orgs and teams — single-user accounts only at MVP" | Directive 3 | **Amend non-goal:** allow multi-**workspace** per user; keep **no teams, no invites, no member roles** as non-goals |
| C2 | FR-21 "Single-user account registration" | Directive 3 | **Replace** with FR-21 multi-workspace registration + mandatory first workspace |
| C3 | UX EXPERIENCE.md "Banned: Multi-tenant org switcher" | Directive 3 | **Remove ban;** add workspace switcher as required MVP UX |
| C4 | AD-7 / NFR-5 "per-account" isolation | Directive 3 | **Rephrase** to per-**workspace** isolation |
| C5 | `account_settings` + `usage_counters` per account | Directives 2+3 | **Rename/replace** with `workspace_settings` + `usage_counters.workspace_id`; tier on workspace |
| C6 | PRD §11 OQ-5 three named tiers + Enterprise waitlist | Directive 2 | **Reconcile:** four **MVP-enforced** tiers (trial/starter/pro/business); Enterprise remains post-MVP waitlist metadata only |
| C7 | addendum rejected "Multi-tenant orgs" | Directive 3 | **Amend** rejection rationale — workspaces validated by King directive |
| C8 | No conflict | Directive 1 | Planning silent on Radix; Mantine-only — additive AD-13 only |

**No conflict:** Directive 1 vs completed Epics 0–2 (no UI shipped). Directive 2 vs Epic 1 `tier=free` Typst flag (maps to `trial` tier enum).

---

## Section 4: Proposed 4-Tier Model (Hypothesis)

MVP enforces **limits + metadata** only. Payment, checkout, Stripe, and tier upgrades are **post-MVP** unless board later promotes billing.

| Tier (enum) | Purpose | Price (hypothesis) | Renders/mo | Rate limit (renders/min) | API keys | Webhooks | Footer watermark | Share TTL default | Artifact retention |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `trial` | Base try-out (was Free) | $0 | 100 | 30 | 2 | No | **Yes** | 90d | share TTL + 7d |
| `starter` | Indie / hackathon embed | $19/mo | 1,000 | 60 | 5 | No | No | 90d | share TTL + 30d |
| `pro` | Embed production (was Embed Pro) | $29/mo | 2,000 | 120 | 10 | **Yes** | No | 180d | share TTL + 90d |
| `business` | High volume (was Scale) | $99/mo + $0.01/render over 10k | 10,000 | 300 | 25 | Yes | No | 365d | share TTL + 180d |

**Enterprise waitlist:** Post-MVP; no enum value at MVP — landing-page waitlist only (unchanged).

**Watermark rule:** `showWatermark: true` when `workspace_settings.tier === 'trial'` (replaces `tier=free` in Typst input).

**Competitor grounding:** Invovate free tier; invoice-generator.com 100/mo; APITemplate $19/3k; PDFMonkey €5/300 (per addendum + market research).

---

## Section 5: Multi-Tenant Workspace Model (Proposal)

### 5.1 Terminology

| Product term | better-auth / DB term |
| --- | --- |
| Workspace | `organization` (plugin table) |
| Active workspace | `session.activeOrganizationId` |
| Workspace owner | Sole `member` with role `owner` (only role used at MVP) |

### 5.2 Rules (YAGNI)

- User may belong to **multiple** workspaces (multiple org memberships).
- User **must** have ≥1 workspace; app/API returns `403 WORKSPACE_REQUIRED` if active workspace unset and user has zero workspaces.
- **Signup flow:** register → **mandatory** create first workspace (name + slug) → then `/app`.
- **No** team invites, **no** multi-member workspaces, **no** role matrix, **no** cross-workspace resource sharing at MVP.
- **Tier, quotas, branding, API keys, renders** scoped to **workspace**, not user.
- API keys belong to workspace; Bearer auth resolves `workspace_id` from key or session active org.

### 5.3 Data model delta (summary)

**New tables**

- `workspaces` — id, name, slug, created_at (mirrors better-auth organization or 1:1 extension)
- `workspace_settings` — workspace_id PK, tier enum, branding JSON, business identity

**FK changes** (`user_id` / `account_id` → `workspace_id`)

- `api_keys`, `renders`, `idempotency_keys`, `audit_events`, `usage_counters`, `webhooks` (Epic 4)

**Remove / replace**

- `account_settings` → `workspace_settings`

**R2 path:** `renders/{workspaceId}/{renderId}.pdf` (was `accountId`)

**Idempotency scope:** `workspaceId + endpoint + key` (was accountId)

### 5.4 New / amended API surface

| Method | Path | Purpose |
| --- | --- | --- |
| POST | `/v1/workspaces` | Create workspace (auth required) |
| GET | `/v1/workspaces` | List user's workspaces |
| PATCH | `/v1/workspaces/{workspaceId}` | Rename workspace |
| POST | `/v1/workspaces/active` | Set active workspace (`{ workspaceId }`) |
| GET | `/v1/workspaces/active` | Get active workspace + tier |

All existing `/v1/*` resource routes resolve tenant from API key's workspace or session active org header/cookie.

---

## Section 6: Numbered Amendments (Board Voting)

### Directive 1 — base-ui

**A1 — ARCHITECTURE-SPINE.md — add AD-13**

OLD: (no AD-13)

NEW:

```markdown
### AD-13 — UI headless primitives (@base-ui/react)

- **Binds:** AD-9, NFR-9; Epic 6
- **Prevents:** Radix UI dependency drift; shadcn/Radix coupling
- **Rule:** Interactive headless primitives (Dialog, Popover, Menu, Tooltip, etc.) use `@base-ui/react` when Mantine does not supply the pattern. **Never** `@radix-ui/*` or shadcn/ui (Radix-backed). Mantine v8 remains the styled component layer. If Radix is found in `apps/web`, refactor to base-ui + Mantine before merge.
```

**A2 — SOLUTION-DESIGN.md §15 — add bullet**

OLD: (ends with Playwright e2e note)

NEW append:

```markdown
- **Headless primitives:** `@base-ui/react` per AD-13; no Radix/shadcn in `apps/web`
```

**A3 — epics.md Story 6.1 — add AC**

OLD: `Next.js 15.x pinned... Mantine v8`

NEW append to AC:

```markdown
**And** `apps/web/package.json` depends on `@base-ui/react` (not `@radix-ui/*`)
**And** CONTRIBUTING note in `apps/web/README.md`: headless primitives = base-ui only
```

**A4 — DESIGN.md — Component policy subsection**

NEW subsection under Mantine mapping:

```markdown
## Headless primitive policy (AD-13)

Use `@base-ui/react` for accessible headless behavior when composing custom Mantine wrappers. Do not add Radix UI or shadcn/ui.
```

---

### Directive 2 — 4-tier pricing

**A5 — prd.md §11 item 5 (OQ-5) — replace tier list**

OLD:

```markdown
5. **Pricing (OQ-5):** Endorsed as working hypothesis; final numbers confirmed pre-launch GTM. Structural tiers in addendum: Free ($0/100 renders/mo) includes scoped API keys + idempotency + footer watermark; Embed Pro ($29/2k) adds webhooks + white-label; Scale ($99/10k + $0.01 overage); Enterprise = post-MVP waitlist (no MVP SLA).
```

NEW:

```markdown
5. **Pricing (OQ-5):** Four MVP-enforced tier enums on workspace (hypothesis until pre-launch GTM): `trial` ($0, 100 renders/mo, footer watermark, no webhooks), `starter` ($19, 1k/mo), `pro` ($29, 2k/mo, webhooks, white-label), `business` ($99, 10k/mo + $0.01 overage). Limits enforced in API (FR-17); payment/checkout post-MVP. Enterprise waitlist remains post-MVP (no fifth enum). Full hypothesis table in addendum.
```

**A6 — prd.md FR-7 consequence — tier enum**

OLD: `Free-tier PDFs include a single footer line... Embed Pro and above (white-label) omit the footer.`

NEW: `Workspace tier trial PDFs include a single footer line... starter, pro, and business tiers omit the footer (white-label).`

**A7 — prd.md FR-17 — workspace-scoped quotas**

OLD: `API enforces per-account rate limits and monthly render quotas by tier.`

NEW: `API enforces per-workspace rate limits and monthly render quotas by workspace tier (enum: trial | starter | pro | business).`

**A8 — addendum.md — replace pricing table**

OLD: Free / Embed Pro / Scale / Enterprise table

NEW: Full hypothesis table from §4 above plus note: "MVP: tier stored as metadata + enforced limits; billing integration deferred."

**A9 — SOLUTION-DESIGN.md §7.1 — tier enum**

OLD: `` `account_settings` | branding defaults, business identity, `tier` enum ``

NEW: `` `workspace_settings` | workspace_id PK, tier enum (`trial`|`starter`|`pro`|`business`), branding, business identity ``

**A10 — epics.md Story 3.15 AC — four tiers**

OLD: `usage_counters tracks monthly renders per account tier (free 100/mo hypothesis §11 OQ-5)`

NEW: `usage_counters tracks monthly renders per workspace tier per hypothesis table (trial 100/mo default); 402 QUOTA_EXCEEDED names current tier and next tier; webhook access denied on trial/starter`

**A11 — epics.md Stories 3.11, 5.1–5.3 — watermark flag**

OLD: `tier=free` / `free-tier`

NEW: `tier=trial` / `workspace tier trial`

**A12 — epics.md Story 8.8 — launch checklist**

NEW bullet in AC: `Launch checklist includes tier limit smoke test per enum and documents payment integration explicitly out of MVP scope.`

---

### Directive 3 — multi-tenant workspaces

**A13 — prd.md §5 non-goals — amend multi-tenant line**

OLD: `- **Multi-tenant orgs and teams** — single-user accounts only at MVP.`

NEW: `- **Teams, invites, and multi-member workspaces** — workspaces are single-owner at MVP; no better-auth teams plugin, no member invites, no role matrix. Multi-workspace per user is in scope (see FR-21).`

**A14 — prd.md §6.1 In Scope — auth line**

OLD: `- Auth: better-auth single-user + scoped API keys`

NEW: `- Auth: better-auth + organization plugin (workspace model, no teams) + scoped API keys per workspace`

**A15 — prd.md §6.2 Out of Scope table — multi-tenant row**

OLD: `| Multi-tenant orgs/teams | Complexity vs. wedge focus | Post-MVP |`

NEW: `| Teams, workspace invites, member roles | Complexity vs. wedge focus | Post-MVP |`

**A16 — prd.md FR-21 — replace entirely**

OLD:

```markdown
#### FR-21: Single-user account registration and login

Users register/login via email (better-auth); session powers web app. Realizes UJ-1.

**Consequences (testable):**
- Unauthenticated users cannot access render history or issue API keys.
- Password reset and session expiry follow better-auth defaults.
```

NEW:

```markdown
#### FR-21: Account registration, login, and mandatory workspace

Users register/login via email or GitHub OAuth (better-auth). Each user must belong to at least one **workspace** (better-auth organization plugin, teams disabled). Signup cannot complete without creating the first workspace. Users may create additional workspaces and switch active workspace. Session tracks `activeOrganizationId`. Realizes UJ-1.

**Consequences (testable):**
- Unauthenticated users cannot access render history or issue API keys.
- Authenticated user with zero workspaces receives `403 WORKSPACE_REQUIRED` on `/v1/*` (except workspace bootstrap endpoints).
- POST `/v1/workspaces` creates workspace; creator is sole owner member.
- POST `/v1/workspaces/active` sets session active workspace.
- Password reset and session expiry follow better-auth defaults.
- No invite, join, or team endpoints at MVP.
```

**A17 — prd.md FR-22 — workspace-scoped API keys**

OLD: `Account owner creates API keys...`

NEW: `Workspace owner creates API keys scoped to active workspace via POST /v1/api-keys (workspace inferred from key context or active session org)...`

**A18 — prd.md NFR-5 — workspace isolation**

OLD: `Render Records and API keys isolated per account`

NEW: `Render Records and API keys isolated per workspace; cross-workspace access returns 404`

**A19 — prd.md §10.1 idempotency note**

OLD: `scoped per account + endpoint`

NEW: `scoped per workspace + endpoint`

**A20 — prd.md §4.5 intro**

OLD: `Single-user authentication via better-auth for web app; scoped API keys for integrators. No multi-tenant org model at MVP.`

NEW: `better-auth with organization plugin (product: workspace; teams disabled) for web app; scoped API keys per workspace for integrators.`

**A21 — ARCHITECTURE-SPINE.md AD-7 — workspace auth**

OLD: `better-auth for web sessions (email/password + GitHub OAuth).`

NEW: `better-auth for web sessions (email/password + GitHub OAuth) with organization plugin mapped to workspaces (teams disabled). Mandatory ≥1 workspace per user. API keys and quotas scoped to workspace_id.`

**A22 — ARCHITECTURE-SPINE.md AD-5 — idempotency hash**

OLD: `Hash Idempotency-Key + accountId + endpoint`

NEW: `Hash Idempotency-Key + workspaceId + endpoint`

**A23 — ARCHITECTURE-SPINE.md AD-6 — R2 path**

OLD: `renders/{accountId}/{renderId}.pdf`

NEW: `renders/{workspaceId}/{renderId}.pdf`

**A24 — SOLUTION-DESIGN.md §7.1 — full schema replacement**

OLD: `account_settings`, `user_id` on resources, `usage_counters` per account

NEW:

| Table | Purpose |
| --- | --- |
| `organization`, `member`, `session` | better-auth organization plugin (teams off) |
| `workspace_settings` | tier, branding, business identity keyed by organization id |
| `api_keys` | `workspace_id` FK (replaces user-scoped ownership for auth context) |
| `renders` | `workspace_id` FK |
| `idempotency_keys` | `workspace_id` |
| `audit_events` | `workspace_id` + `user_id` actor |
| `usage_counters` | `workspace_id`, month, render_count |
| `webhooks` | `workspace_id` |

**A25 — epics.md Story 3.1 — schema AC rewrite**

OLD: lists `account_settings`, user-scoped tables

NEW: lists `workspace_settings`, `workspace_id` FKs, better-auth org tables; `bun test` covers workspace-scoped render repo queries

**A26 — epics.md Story 3.3 — auth AC extension**

NEW bullets:

```markdown
**And** better-auth organization plugin enabled with `teams` disabled
**And** signup flow includes mandatory first workspace creation (name, slug)
**And** user cannot access `/v1/renders` until ≥1 workspace exists and active org set
**And** integration test: register → create workspace → session.activeOrganizationId set
```

**A27 — epics.md NEW Story 3.18: Workspace management endpoints**

```markdown
### Story 3.18: Workspace CRUD and active workspace selection

As a user with multiple clients,
I want to create, list, rename, and switch workspaces,
So that renders and API keys isolate per client project (FR-21).

**Acceptance Criteria:**

**Given** authenticated user
**When** POST /v1/workspaces, GET /v1/workspaces, PATCH /v1/workspaces/{id}, POST /v1/workspaces/active
**Then** CRUD works; slug unique; creator becomes sole owner member
**And** 403 WORKSPACE_REQUIRED when no active workspace on resource routes
**And** bun test + integration cover switch + isolation (workspace A key cannot read workspace B render)
```

**A28 — epics.md Stories 3.5–3.17 — terminology pass**

Replace "account" / "accountId" with "workspace" / "workspaceId" in ACs for: 3.5, 3.6, 3.7, 3.11, 3.12, 3.14, 3.15, 3.16, 3.17, 4.3–4.7.

**A29 — epics.md NEW Story 6.14: Workspace bootstrap and switcher UI**

```markdown
### Story 6.14: Workspace create, bootstrap, and switcher (SCR-WORKSPACE-*)

As a user,
I want to create my first workspace after signup and switch between workspaces,
So that I isolate client projects (FR-21, UX addendum).

**Acceptance Criteria:**

**Given** new signup without workspace → redirect `/app/onboarding/workspace`
**When** user submits workspace name → POST /v1/workspaces → active set → `/app`
**And** AppShell header includes workspace switcher (Select or Menu) calling POST /v1/workspaces/active
**And** Playwright: signup → onboarding → dashboard blocked without workspace
**And** WCAG: switcher labeled "Active workspace"
```

**A30 — epics.md Story 6.2 AC — post-auth redirect**

OLD: `successful auth redirects to /app`

NEW: `successful auth redirects to /app/onboarding/workspace if user has zero workspaces, else /app`

**A31 — EXPERIENCE.md — remove ban, add screens**

OLD (Banned): `- Multi-tenant org switcher`

NEW (Required): `- Workspace switcher in AppShell header (SCR-WORKSPACE-SWITCHER)`

NEW route map entries:

- `SCR-WORKSPACE-ONBOARD` — `/app/onboarding/workspace` — mandatory first workspace
- `SCR-WORKSPACE-CREATE` — modal or page for additional workspace

NEW API action map rows:

| Create workspace | POST | `/v1/workspaces` |
| List workspaces | GET | `/v1/workspaces` |
| Set active | POST | `/v1/workspaces/active` |

**A32 — epics.md FR inventory lines 53, 77, 160 — FR-21 wording**

Update epic header FR paraphrases from "Single-user" to "Multi-workspace auth".

**A33 — sprint-status.yaml (post-ratification only)**

Add:

```yaml
3-18-workspace-crud-and-active-workspace-selection: backlog
6-14-workspace-create-bootstrap-and-switcher-scr-workspace: backlog
```

Update action item `run correct-course amendment for harness directives` → `done` after board applies amendments.

---

## Section 7: Story Backlog Summary (Post-Ratification)

| Change | Stories |
| --- | --- |
| New | **3.18** workspace endpoints, **6.14** workspace UI |
| Modified ACs | 3.1, 3.3, 3.5–3.17, 3.11, 3.15, 3.16, 4.3–4.7, 5.1–5.3, 6.1, 6.2, 8.8 |
| Renamed terminology | account → workspace across Epic 3–4 stories |
| No change | Epics 0–2 (complete), Epic 1 `tier=free` in fixtures OK until Epic 5 template pass maps to `trial` |
| Deferred | Payment/billing epic (post-MVP) |
| Explicitly out of scope | Stripe/checkout, tier upgrade UI, invites, teams, member roles, cross-workspace sharing, Enterprise SLA |

**Estimated story count:** 83 → **85** (+2 net)

---

## Section 8: Risks and Mitigations

| Risk | Severity | Mitigation |
| --- | --- | --- |
| Cross-workspace data leak | Critical | `workspace_id` required on all repos; integration tests in 3.18; NFR-5 AC |
| Epic 3 scope creep | High | YAGNI: no invites/teams; 3.18 is only new API story |
| Tier hypothesis wrong at launch | Medium | Label hypothesis; Story 8.8 smoke; manual tier override in admin seed for design partners |
| base-ui + Mantine learning curve | Low | Epic 6 only; Mantine covers most patterns |
| better-auth org plugin migration | Medium | Enable in 3.1/3.3 before any tenant data |
| UJ-1 journey stale | Medium | Amend UJ-1 path: signup → workspace → create invoice |

---

## Section 9: Explicitly Out of Scope (MVP)

- Payment processing, Stripe, checkout, self-serve tier upgrades
- better-auth **teams** plugin
- Workspace member invites, join links, role matrix (admin/member)
- Cross-workspace render sharing or federation
- Enterprise SLA tier enforcement (waitlist only)
- Per-user tier (tier is **workspace-level** only)
- Radix UI / shadcn adoption

---

## Section 10: Implementation Handoff (After Board Ratifies)

| Role | Responsibility |
| --- | --- |
| PM / Architect | Apply A1–A33 to planning artifacts; update UJ-1 in PRD |
| PO / Dev | Regenerate Epic 3 story files from amended epics.md |
| Developer | Epic 3.1 starts with workspace schema + org plugin — **do not** implement old `account_settings` model |
| QA | Extend SM-4 embed test with workspace bootstrap + key scoping |

**Success criteria:** Board approves amendment list; planning docs consistent; sprint-status updated; Epic 3 story creation unblocked.

---

## Appendix A: Amendment Index (One-Line)

| ID | Summary |
| --- | --- |
| A1 | Add AD-13: @base-ui/react, never Radix |
| A2 | SOLUTION-DESIGN §15 base-ui note |
| A3 | Story 6.1 base-ui dependency AC |
| A4 | DESIGN.md headless primitive policy |
| A5 | PRD §11 OQ-5 four tier enums |
| A6 | FR-7 watermark maps to trial tier |
| A7 | FR-17 per-workspace tier quotas |
| A8 | addendum.md full tier hypothesis table |
| A9 | workspace_settings tier enum in schema |
| A10 | Story 3.15 four-tier quota AC |
| A11 | Stories 3.11/5.x trial watermark flag |
| A12 | Story 8.8 tier smoke + billing out-of-scope |
| A13 | PRD §5 amend non-goals (teams/invites out, workspaces in) |
| A14 | PRD §6.1 auth scope update |
| A15 | PRD §6.2 out-of-scope table row |
| A16 | FR-21 replace with multi-workspace mandatory |
| A17 | FR-22 workspace-scoped API keys |
| A18 | NFR-5 workspace isolation |
| A19 | §10.1 idempotency workspace scope |
| A20 | §4.5 auth section intro |
| A21 | AD-7 workspace + org plugin |
| A22 | AD-5 workspace idempotency hash |
| A23 | AD-6 R2 workspace path |
| A24 | SOLUTION-DESIGN §7.1 schema tables |
| A25 | Story 3.1 workspace schema AC |
| A26 | Story 3.3 org plugin + mandatory workspace |
| A27 | NEW Story 3.18 workspace endpoints |
| A28 | Epic 3–4 account→workspace terminology |
| A29 | NEW Story 6.14 workspace UI |
| A30 | Story 6.2 onboarding redirect |
| A31 | EXPERIENCE.md switcher + SCR-WORKSPACE-* |
| A32 | epics.md FR-21 inventory lines |
| A33 | sprint-status.yaml new stories (post-ratify) |

---

**Document status:** Applied 2026-07-20 — board ratified (2× YES_WITH_NOTES). See audit trail below.

---

## Applied 2026-07-20 with board notes

**Ratification:** 2× YES_WITH_NOTES (board reviewers merged).

**Binding board notes applied (notes override proposal text where they conflict):**

1. **A3 (base-ui):** do NOT require/install `@base-ui/react` in any package.json now. Planning docs amended: UI primitives from Mantine; if a needed primitive is missing, use `@base-ui/react` — NEVER radix-ui or shadcn/ui. Installation happens only when first needed (Epic 6).
2. **A5/A8 (pricing):** keep four tiers `trial | starter | pro | business` as HYPOTHESES (per-tier monthly render quota + rate limits). Removed newly invented API-key count caps and tier-specific retention/TTL rules — marked "TBD pending separate approval". Entitlement wording: watermark on `trial` only, `starter` and above remove it; webhooks from `pro` up. Updated addendum.md rejected-alternatives row and gate-2 watermark note references `trial` tier.
3. **A6 (extend):** amended PRD §11 OQ-2 wording — replaced "Free-tier"/"Embed Pro+" language with `trial` / `starter+` consistent with 4-tier model.
4. **A10:** quota enforcement stays in Story 3.15; webhook tier-gating moves to Story 4.3's ACs.
5. **A11 (critical, determinism):** Epic 3 render path maps `workspace_settings.tier === 'trial'` → Typst `--input tier=free`; all paid tiers → `tier=pro`. Did NOT rename Typst input enum, fixtures, manifests, or golden hashes (Epic 5 template pass owns any rename). AC wording: "trial workspace tier applies footer watermark via Typst `tier=free` input". No interval where trial omits watermark.
6. **A21/A26 (better-auth hardening):** explicitly disable/reject better-auth invitation, member-add/remove, join, and team operations. Story 3.3/3.18 ACs include integration test proving a workspace cannot gain a second member.
7. **A24/A25 (data model):** better-auth's `organization` table IS the workspace identity — NO duplicate `workspaces` table. Included all plugin-required tables/constraints/indexes. Workspace-less audit events allowed only for signup/login/bootstrap; all tenant-resource events require `workspace_id`. Render records SNAPSHOT resolved render-affecting inputs (tier/watermark flag, branding, logo checksum).
8. **A27 (workspace endpoints):** membership/ownership checks required on list, rename, and active-selection endpoints; added/reconciled `GET /v1/workspaces/active` with SOLUTION-DESIGN §5.4.
9. **A28 (extend):** Story 3.4 session tokens carry and validate active `workspaceId`; workspace filtering propagates through repository, worker job, webhook delivery, audit query, settings route, and structured log — amended relevant story ACs.
10. **A29/A31:** workspace UI stories cover creating ADDITIONAL workspaces (not just first-run onboarding) and the switcher; amended UJ-1 (PRD §2.3 signup path) to include mandatory first-workspace step.
11. **UJ-1 apply pass:** completed before Epic 3 story file generation.

**Artifacts modified:** `ARCHITECTURE-SPINE.md`, `SOLUTION-DESIGN.md`, `prd.md`, `addendum.md`, `epics.md`, `DESIGN.md`, `EXPERIENCE.md`, `sprint-status.yaml`, this proposal doc.

**Story keys added to sprint-status:** `3-18-workspace-crud-and-active-workspace-selection`, `6-14-workspace-create-bootstrap-and-switcher-scr-workspace`.

**Story count:** 83 → 85 (+2 net).

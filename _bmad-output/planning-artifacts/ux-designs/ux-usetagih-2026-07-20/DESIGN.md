---
name: usetagih
description: Strict-schema document render infrastructure. Mantine v8 brand-layer delta on default theme — professional, developer-trusted, document-first.
status: final
updated: 2026-07-20
colors:
  # Brand overrides on Mantine default theme. Unlisted tokens inherit Mantine defaults.
  primary: '#1E3A5F'
  primary-foreground: '#FFFFFF'
  accent: '#0D9488'
  accent-foreground: '#FFFFFF'
  success: '#059669'
  success-foreground: '#FFFFFF'
  warning: '#D97706'
  warning-foreground: '#FFFFFF'
  error: '#DC2626'
  error-foreground: '#FFFFFF'
  surface-base: '#FAFBFC'
  surface-elevated: '#FFFFFF'
  surface-muted: '#F1F5F9'
  border-subtle: '#E2E8F0'
  border-strong: '#CBD5E1'
  text-primary: '#0F172A'
  text-secondary: '#475569'
  text-muted: '#64748B'
  preview-canvas: '#E8ECF1'
  share-link: '#0369A1'
typography:
  display:
    fontFamily: 'Inter, system-ui, sans-serif'
    fontSize: 40px
    fontWeight: '700'
    lineHeight: '1.15'
    letterSpacing: -0.02em
  display-sm:
    fontFamily: 'Inter, system-ui, sans-serif'
    fontSize: 28px
    fontWeight: '700'
    lineHeight: '1.2'
    letterSpacing: -0.01em
  headline:
    fontFamily: 'Inter, system-ui, sans-serif'
    fontSize: 22px
    fontWeight: '600'
    lineHeight: '1.3'
  body:
    fontFamily: 'Inter, system-ui, sans-serif'
    fontSize: 15px
    fontWeight: '400'
    lineHeight: '1.55'
  body-sm:
    fontFamily: 'Inter, system-ui, sans-serif'
    fontSize: 13px
    fontWeight: '400'
    lineHeight: '1.5'
  mono:
    fontFamily: 'JetBrains Mono, ui-monospace, monospace'
    fontSize: 13px
    fontWeight: '400'
    lineHeight: '1.45'
  document-preview:
    fontFamily: 'Inter, system-ui, sans-serif'
    fontSize: 14px
    fontWeight: '400'
    lineHeight: '1.4'
rounded:
  sm: 4px
  md: 8px
  lg: 12px
  xl: 16px
  full: 9999px
  DEFAULT: 8px
spacing:
  '1': 4px
  '2': 8px
  '3': 12px
  '4': 16px
  '5': 20px
  '6': 24px
  '8': 32px
  '10': 40px
  '12': 48px
  gutter: 24px
  gutter-mobile: 16px
  section-gap: 48px
  form-field-gap: 16px
components:
  app-shell-navbar:
    background: '{colors.surface-elevated}'
    border: '1px solid {colors.border-subtle}'
    width: 240px
  app-shell-header:
    background: '{colors.surface-elevated}'
    border-bottom: '1px solid {colors.border-subtle}'
    height: 56px
  button-primary:
    background: '{colors.primary}'
    foreground: '{colors.primary-foreground}'
    radius: '{rounded.md}'
  button-render:
    background: '{colors.accent}'
    foreground: '{colors.accent-foreground}'
    radius: '{rounded.md}'
  card-surface:
    background: '{colors.surface-elevated}'
    border: '1px solid {colors.border-subtle}'
    radius: '{rounded.lg}'
    shadow: '0 1px 3px rgba(15, 23, 42, 0.06)'
  document-type-card:
    background: '{colors.surface-elevated}'
    border: '1px solid {colors.border-subtle}'
    radius: '{rounded.lg}'
    hover-border: '{colors.primary}'
  template-thumbnail:
    background: '{colors.preview-canvas}'
    border: '2px solid {colors.border-subtle}'
    radius: '{rounded.md}'
    selected-border: '{colors.accent}'
  preview-frame:
    background: '{colors.preview-canvas}'
    border: '1px solid {colors.border-strong}'
    radius: '{rounded.lg}'
    inner-background: '#FFFFFF'
  validation-error:
    background: '#FEF2F2'
    border: '1px solid #FECACA'
    foreground: '{colors.error}'
    radius: '{rounded.sm}'
  api-key-secret:
    background: '{colors.surface-muted}'
    font: '{typography.mono.fontFamily}'
    radius: '{rounded.sm}'
  share-link-chip:
    background: '#EFF6FF'
    foreground: '{colors.share-link}'
    radius: '{rounded.full}'
  audit-row:
    stripe-even: '{colors.surface-base}'
    stripe-odd: '{colors.surface-elevated}'
  landing-hero-gradient:
    from: '#F8FAFC'
    to: '#EFF6FF'
---

## Brand & Style

usetagih is **render infrastructure**, not invoicing software. The visual language must communicate precision, trust, and developer-grade clarity — the same posture as Stripe Docs or Vercel Dashboard, not FreshBooks or QuickBooks.

The product promise is *strict schema in, branded PDF out*. Surfaces should feel like a professional tool for producing artifacts, never like a business suite managing clients, payments, or ledgers. Copy, iconography, and layout reinforce "document pipeline" — validate → preview → render → share — without implying accounting, payment collection, or compliance clearance.

Mantine v8 is the component system of record. This DESIGN.md specifies brand-layer deltas on Mantine's default theme: primary navy, teal accent for render/success actions, Inter typography, restrained elevation, and document-preview-specific tokens. Tailwind utilities may supplement layout where Mantine lacks a primitive, but every interactive element maps to a named Mantine component.

## Colors

- **Primary Navy (`{colors.primary}`)** — Brand anchor. Primary buttons, active nav items, links, selected document-type borders. Reads "infrastructure trust."
- **Render Teal (`{colors.accent}`)** — Reserved for render, export, and copy-link success actions. The climax color of the product. Never used for navigation chrome or decorative accents.
- **Success Green (`{colors.success}`)** — Validation passed, render completed, copy-to-clipboard confirmed.
- **Warning Amber (`{colors.warning}`)** — Expiring share links, quota approaching limits, non-blocking cautions.
- **Error Red (`{colors.error}`)** — Validation failures, API errors, revoked keys. Field-level errors use lighter `{components.validation-error}` background.
- **Surface Base (`{colors.surface-base}`)** — App background behind cards and forms.
- **Surface Elevated (`{colors.surface-elevated}`)** — Cards, modals, navbar, header.
- **Preview Canvas (`{colors.preview-canvas}`)** — Background behind the live document preview frame; simulates "paper on desk."
- **Share Link Blue (`{colors.share-link}`)** — Share URL chips and copy affordances on success surfaces.

Avoid: green "paid" badges, wallet icons, checkmark payment flows, ledger/table metaphors with running balances, or any palette that reads "accounting dashboard."

## Typography

Inter for all UI chrome. JetBrains Mono for API keys, JSON paths in validation errors, and audit log resource IDs.

| Role | Token | Usage |
|---|---|---|
| Hero headline | `{typography.display}` | Landing page only |
| Page title | `{typography.display-sm}` | Authenticated page headers |
| Section title | `{typography.headline}` | Form sections, card headers |
| Body | `{typography.body}` | Labels, descriptions, table cells |
| Caption | `{typography.body-sm}` | Helper text, timestamps, metadata |
| Code / paths | `{typography.mono}` | Validation paths, API key prefix, audit IDs |

Document preview content inside the preview frame uses `{typography.document-preview}` — sized to approximate PDF readability at screen scale, independent of template-internal fonts.

## Layout & Spacing

- **App max width:** `Container` with `size="xl"` (1320px) for list/table surfaces; document creation uses full available width with split pane.
- **Gutter:** `{spacing.gutter}` desktop, `{spacing.gutter-mobile}` below `md`.
- **Form field vertical rhythm:** `{spacing.form-field-gap}` between fields; `{spacing.6}` between field groups (seller, buyer, line items).
- **Section separation:** `{spacing.section-gap}` between major landing sections.

Grid behavior: `Grid` with `span={{ base: 12, sm: 6, lg: 4 }}` for document-type and template cards. Line-item editor uses full-width `Table` with horizontal scroll on `sm`.

## Elevation & Depth

Restrained. Cards use `{components.card-surface}` shadow. Modals (`Modal`) use Mantine default overlay. No floating action buttons. Preview frame sits on `{colors.preview-canvas}` with a single-pixel border — the document is the hero, not chrome.

Interactive elevation: `Paper` with `withBorder` on hover for selectable cards (document type, template). Selected state swaps border color rather than increasing shadow.

## Shapes

- Inputs, buttons: `{rounded.md}` (8px)
- Cards, preview frame: `{rounded.lg}` (12px)
- Badges, share-link chips: `{rounded.full}`
- Landing hero CTA group: `{rounded.lg}` container optional

Sharp enough to read "developer tool"; soft enough for direct-user approachability (Maya, UJ-1).

## Components

Mantine v8 components used as-is unless noted. Brand overrides apply via Mantine theme `createTheme` extending these tokens.

### App chrome

| Mantine component | Brand override |
|---|---|
| `AppShell` | `{components.app-shell-navbar}`, `{components.app-shell-header}` |
| `NavLink` | Active state `{colors.primary}` left border 3px |
| `Breadcrumbs` | Document creation flow only |
| `Menu` | Avatar dropdown in header |
| `Avatar` | User initials, `{rounded.full}` |

### Document creation

| Mantine component | Brand override |
|---|---|
| `Stepper` | 4 steps; completed step `{colors.success}`, active `{colors.primary}` |
| `Card` | Document type + template selection |
| `SimpleGrid` | 3-column type picker, 2-column template picker |
| `TextInput`, `NumberInput`, `Textarea`, `Select` | Standard; error state `{colors.error}` |
| `Fieldset` + `Legend` | Seller, buyer, line items, totals sections |
| `Table` | Line items editable rows |
| `ActionIcon` | Add/remove line item |
| `Alert` | Validation summary banner |
| `ScrollArea` | Preview pane |
| `Button` (render variant) | `{components.button-render}` |
| `CopyButton` + `Tooltip` | Share link on success |

### Lists and data

| Mantine component | Usage |
|---|---|
| `mantine-datatable` `DataTable` | Documents history, audit log, API keys list |
| `Pagination` | Server-side paginated lists |
| `Badge` | Document type, render status, key scope |
| `Skeleton` | Loading rows |
| `EmptyState` (custom `Stack` + `Text` + `Button`) | Zero-data surfaces |

### Auth and settings

| Mantine component | Usage |
|---|---|
| `Paper` + `Stack` | Auth forms centered |
| `PasswordInput` | Sign in/up |
| `Button` | GitHub OAuth via `Button` `variant="default"` + GitHub icon |
| `ColorInput` | Accent color in settings |
| `FileInput` | Logo upload |
| `Divider` | OAuth vs email separator |
| `Checkbox` / `Checkbox.Group` | API key scopes |
| `Modal` | Create API key, show-once secret |
| `Code` | API key prefix display |

### Public share page

| Mantine component | Usage |
|---|---|
| `Container` | Centered narrow layout |
| `Paper` | Document metadata card |
| `Button` | Download PDF |
| `Anchor` | "Powered by usetagih" footer link |

## Do's and Don'ts

| Do | Don't |
|---|---|
| Use `{colors.accent}` only for render/export/copy-link climax actions | Use accent for nav, badges, or decorative gradients |
| Show validation paths in `{typography.mono}` adjacent to field labels | Silently correct financial values in the UI |
| Label surfaces "Documents", "Renders", "History" — artifact language | Label surfaces "Invoices", "Clients", "Payments" as primary nav |
| Preview frame shows exact template output | Show a simplified wireframe that diverges from PDF |
| Free-tier watermark as subtle footer bar in PDF only | Block web UI features behind payment walls at MVP |
| Map every action to a documented REST endpoint | Imply server-side bypass of validation |
| Use `DataTable` with sortable columns for history/audit | Build custom table markup |
| English-only labels per MVP scope | Add locale switcher |

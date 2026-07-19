// Shared deterministic preamble — import from templates via relative path.
// Fonts resolved via typst-driver --font-path packages/render/fonts/

#set document(date: none)

#let body-font = "Inter"
#let mono-font = "JetBrains Mono"

#set text(
  font: body-font,
  size: 10pt,
)

#set par(leading: 0.65em)

#show raw: set text(font: mono-font, size: 9pt)
#show raw.where(block: true): set block(spacing: 0.65em)

// Typography weight helpers for templates (Story 1.2+)
#let font-regular = "Inter"
#let font-medium = "Inter Medium"
#let font-semibold = "Inter SemiBold"
#let font-bold = "Inter Bold"
#let mono-regular = "JetBrains Mono"
#let mono-bold = "JetBrains Mono Bold"

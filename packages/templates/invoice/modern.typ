#import "../_shared/preamble.typ": *

#let payload = json(sys.inputs.at("json"))
#let tier = sys.inputs.at("tier", default: "pro")
#let show-footer = tier == "free"
#let footer-copy = "Rendered with usetagih · usetagih.com"

#let text-primary = rgb("#1E3A5F")
#let text-secondary = rgb("#475569")
#let border-color = rgb("#E2E8F0")

#let fmt-money(amount) = {
  if payload.currency == "USD" {
    "$" + amount
  } else {
    payload.currency + " " + amount
  }
}

#let parse-date(iso) = {
  let parts = iso.split("-")
  datetime(
    year: int(parts.at(0)),
    month: int(parts.at(1)),
    day: int(parts.at(2)),
  )
}

#let fmt-date(iso) = {
  parse-date(iso).display("[month repr:short] [day padding:zero], [year]")
}

#let fmt-rate(rate) = {
  str(calc.round(rate * 100, digits: 2)) + "%"
}

#let fmt-address(party) = {
  let addr = party.address
  [
    #party.name \
    #party.email \
    #addr.line1 \
    #addr.city, #addr.region #addr.postalCode \
    #addr.country
  ]
}

#set page(
  footer: context {
    if show-footer {
      set align(center)
      set text(size: 8pt, fill: rgb("#64748B"))
      [#footer-copy]
    }
  },
)

#grid(
  columns: (1fr, 1fr),
  gutter: 12pt,
  align(left)[
    #text(font: font-semibold, fill: text-primary, size: 14pt)[#payload.seller.name]
  ],
  align(right)[
    #text(font: font-bold, fill: text-primary, size: 18pt)[INVOICE]
  ],
)

#v(16pt)

#grid(
  columns: (1fr, 1fr, 1fr),
  gutter: 8pt,
  text(fill: text-secondary, size: 9pt)[Document \#],
  text(fill: text-secondary, size: 9pt)[Issued],
  text(fill: text-secondary, size: 9pt)[Due],
  [#payload.documentNumber],
  [#fmt-date(payload.issuedAt)],
  [#fmt-date(payload.dueAt)],
)

#v(20pt)

#grid(
  columns: (1fr, 1fr),
  gutter: 24pt,
  text(fill: text-secondary, size: 9pt, weight: "medium")[Bill From],
  text(fill: text-secondary, size: 9pt, weight: "medium")[Bill To],
  [#fmt-address(payload.seller)],
  [#fmt-address(payload.buyer)],
)

#v(24pt)

#table(
  columns: (1fr, 0.5fr, 0.5fr, 0.75fr, 0.75fr),
  stroke: (x: none, y: none, bottom: 0.5pt + border-color),
  inset: 8pt,
  align: (left, center, center, right, right),
  table.header(
    text(fill: text-secondary, size: 9pt)[Description],
    text(fill: text-secondary, size: 9pt)[Qty],
    text(fill: text-secondary, size: 9pt)[Unit],
    text(fill: text-secondary, size: 9pt)[Unit Price],
    text(fill: text-secondary, size: 9pt)[Line Total],
  ),
  ..payload.lineItems.map(item => (
    item.description,
    str(item.quantity),
    item.unit,
    fmt-money(item.unitPrice.amount),
    fmt-money(item.lineTotal.amount),
  )).flatten(),
)

#v(16pt)

#for tax in payload.taxLines [
  #grid(
    columns: (1fr, auto),
    gutter: 12pt,
    [#tax.name (#fmt-rate(tax.rate))],
    [#fmt-money(tax.amount.amount)],
  )
  #v(4pt)
]

#v(8pt)

#context [#metadata(here().page()) <totals-page>]

#align(right)[
  #grid(
    columns: (auto, auto),
    column-gutter: 24pt,
    row-gutter: 4pt,
    [Subtotal], [#fmt-money(payload.totals.subtotal.amount)],
    [Tax], [#fmt-money(payload.totals.taxTotal.amount)],
    [#text(font: font-bold)[Grand Total]], [#text(font: font-bold)[#fmt-money(payload.totals.grandTotal.amount)]],
  )
]

#if payload.notes != none [
  #v(20pt)
  #text(fill: text-secondary, size: 9pt)[Notes]
  #v(4pt)
  #payload.notes
]

// Harness introspection (queried by render tests; invisible in PDF)
#metadata(payload.totals.grandTotal.amount) <grand-total>
#if show-footer [
  #metadata(footer-copy) <footer-text>
]
#context [#metadata(counter(page).final()) <page-count>]

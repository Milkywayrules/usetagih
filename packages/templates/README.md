# packages/templates

Typst template content (`.typ` files) for usetagih document rendering.

## Shared preamble

All Epic 1+ templates should import the deterministic shared preamble:

```typst
#import "../_shared/preamble.typ": *
```

The preamble sets `#set document(date: none)`, Inter as the body font, JetBrains Mono for raw/mono text, and base typography tokens. Fonts are vendored in `packages/render/fonts/` and passed via the render driver's `--font-path` flag.

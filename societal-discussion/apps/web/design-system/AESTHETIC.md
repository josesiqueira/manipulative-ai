# Design Aesthetic
Project: SYNTHETICA Admin Panel — Tampere University Research Dashboard
Date: 2026-03-31

## Direction

A restrained, data-forward academic tool. The visual language is that of a
well-typeset research appendix brought into the browser: white space, slate
neutrals, tight typographic hierarchy. The only color in the system belongs to
the four political blocks — everything else defers to them. Structure is
communicated through spacing and subtle borders, not shadows or gradients.

## Rationale

Researchers using this tool are reading data, not being marketed to. Visual
novelty competes with data comprehension. The four block colors (blue, green,
amber, rose) are operationally meaningful — they encode political categories
that appear in charts, badges, heatmap rows, and filter states simultaneously.
Making them the only chromatic element ensures they are never ambiguous and
never decorative. The system font stack signals "tool" rather than "product",
which matches the academic context and avoids rendering inconsistencies across
university-managed Linux/Windows workstations.

## Key choices

- **Theme**: light (white page, off-white sidebar)
- **Mood**: restrained academic — utility over personality
- **Color strategy**: near-monochromatic slate base; four block accent colors as
  the sole chromatic element; no additional accent, no brand gradient
- **Typography pairing**: system-ui sans (all UI text) + system monospace
  (numeric values only). No web fonts. Reason: research tool installed on
  university machines; zero font-load latency; system fonts render crisply in
  dense data tables.
- **Layout approach**: fixed-width sidebar (240px) + scrollable content area;
  two-panel split on the conversation browser (40/60); dense but breathable
  card grids with consistent 20px padding
- **Signature element**: The four block colors are the *only* non-neutral
  chromatic element in the entire interface. They appear identically as badge
  fills, chart bar colors, and heatmap row labels. A researcher can glance at
  any screen and immediately orient by color to political block — there is
  zero ambiguity between "accent" and "data encoding".

## References

- ONS (UK Office for National Statistics) data dashboards — dense, legible,
  no decoration
- Retraction Watch — academic-context web tools, clear hierarchy
- Tailwind UI "Application Shells" admin layout — sidebar + content split
- Nate Silver / 538 data tables — color used only for categorical encoding

## Anti-patterns (DO NOT use)

- **No gradients** — not on buttons, not on cards, not on chart fills
- **No rounded-2xl or larger** — rounded-lg (8px) is the maximum radius for cards;
  pill (9999px) for badges only
- **No drop shadows above --shadow-sm** — shadow-md and above feel app-like,
  not tool-like
- **No color outside the four blocks and semantic feedback states** — do not
  introduce a "primary brand blue" that differs from the conservative block blue;
  they are the same color by design
- **No hero sections, marketing copy, or illustration** — this is an internal
  research tool; every pixel should serve data comprehension
- **No skeleton loaders with shimmer animations** — a plain gray placeholder
  rectangle is sufficient; shimmer is decorative
- **No Inter, Roboto, or custom web fonts** — system font stack only
- **No dark mode** — researchers print or screenshare; light mode is canonical
- **No chart 3D effects** — flat fills only in Recharts; no pie charts
- **No colored sidebar backgrounds** — sidebar is slate-100, not a brand color
- **No toast notifications for non-error states** — data tables update in place;
  toasts are reserved for export success and errors only

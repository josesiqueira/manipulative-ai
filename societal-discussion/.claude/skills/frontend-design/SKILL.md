---
name: frontend-design
description: >
  Design system and UI quality skill. Defines the conventions for the design-system/
  folder, anti-AI-slop guidelines, token structure, component patterns, and
  accessibility requirements. Used by the frontend-designer agent to create and
  audit design systems. Trigger whenever UI, frontend, design system, styling,
  or visual quality is involved.
context: fork
---

# Frontend Design — Design System & Anti-AI-Slop Guidelines

This skill ensures every UI produced by the template is distinctive, intentional,
and consistent — not generic AI output.

## The design-system/ folder

Every project with a UI gets a `design-system/` folder at the root. This is the
single source of truth for all visual decisions. Coder agents MUST reference it
before writing any UI code.

### Structure

```
design-system/
├── tokens.css            # CSS custom properties: colors, spacing, typography, shadows, radii
├── AESTHETIC.md           # Chosen design direction, mood, rationale, reference images
├── COMPONENTS.md          # Component naming, patterns, composition rules
└── ACCESSIBILITY.md       # A11y requirements, contrast ratios, motion, screen readers
```

### tokens.css

All visual values are CSS custom properties. No magic numbers in component files.

```css
:root {
  /* === Colors === */
  --color-bg-primary: #0a0a0f;
  --color-bg-secondary: #12121a;
  --color-bg-surface: #1a1a26;
  --color-text-primary: #e8e6e3;
  --color-text-secondary: #9d9b97;
  --color-text-muted: #6b6966;
  --color-accent: #e85d04;
  --color-accent-hover: #f47c2c;
  --color-accent-subtle: rgba(232, 93, 4, 0.12);
  --color-border: #2a2a36;
  --color-error: #ef4444;
  --color-success: #22c55e;

  /* === Typography === */
  --font-display: 'Instrument Serif', Georgia, serif;
  --font-body: 'Satoshi', system-ui, sans-serif;
  --font-mono: 'JetBrains Mono', monospace;
  --font-size-xs: 0.75rem;
  --font-size-sm: 0.875rem;
  --font-size-base: 1rem;
  --font-size-lg: 1.125rem;
  --font-size-xl: 1.25rem;
  --font-size-2xl: 1.5rem;
  --font-size-3xl: 2rem;
  --font-size-4xl: 2.5rem;
  --font-size-hero: 4rem;
  --font-weight-normal: 400;
  --font-weight-medium: 500;
  --font-weight-bold: 700;
  --line-height-tight: 1.1;
  --line-height-snug: 1.3;
  --line-height-normal: 1.6;

  /* === Spacing === */
  --space-1: 0.25rem;
  --space-2: 0.5rem;
  --space-3: 0.75rem;
  --space-4: 1rem;
  --space-6: 1.5rem;
  --space-8: 2rem;
  --space-12: 3rem;
  --space-16: 4rem;
  --space-24: 6rem;
  --space-32: 8rem;

  /* === Borders & Shadows === */
  --radius-sm: 4px;
  --radius-md: 8px;
  --radius-lg: 12px;
  --radius-full: 9999px;
  --shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.3);
  --shadow-md: 0 4px 12px rgba(0, 0, 0, 0.4);
  --shadow-lg: 0 8px 24px rgba(0, 0, 0, 0.5);

  /* === Transitions === */
  --transition-fast: 150ms ease;
  --transition-base: 250ms ease;
  --transition-slow: 400ms ease;
}
```

**These are EXAMPLES.** The frontend-designer agent creates project-specific tokens
based on the chosen aesthetic. The structure and naming must be followed; the values
are unique per project.

### AESTHETIC.md

```markdown
# Design Aesthetic
Project: [name]
Date: [today]

## Direction
[2-3 sentences: the overall mood, personality, and visual feel]

## Rationale
[Why this direction fits the project's purpose and audience]

## Key choices
- **Theme**: dark / light / adaptive
- **Mood**: [e.g., warm editorial, cold brutalist, organic natural, refined luxury]
- **Color strategy**: [e.g., monochromatic with a single accent, earthy palette with contrast pops]
- **Typography pairing**: [display font] + [body font] — [why this pairing works]
- **Layout approach**: [e.g., generous whitespace, dense information grid, asymmetric editorial]
- **Signature element**: [the ONE thing that makes this design memorable and distinctive]

## References
[Links or descriptions of visual references that inspired this direction]

## Anti-patterns (DO NOT use)
- [Explicitly list what to avoid for this specific project]
```

### COMPONENTS.md

```markdown
# Component Conventions
Project: [name]

## Naming
- Components: PascalCase (e.g., `ResultTable`, `SimulationForm`)
- CSS classes: kebab-case with project prefix (e.g., `app-result-table`)
- Tokens: always use CSS custom properties from tokens.css, never raw values

## Composition rules
- Every component gets its own file
- Components reference tokens.css — no inline colors, no hardcoded spacing
- Interactive elements must have hover/focus/active states defined
- Loading states are required for any async operation
- Empty states are required for any list/table/data display

## Component catalog
[Updated as components are built]
| Component | File | Status | Notes |
|-----------|------|--------|-------|
| ResultTable | src/components/ResultTable.[ext] | ✅ | Phase 2 |
```

### ACCESSIBILITY.md

```markdown
# Accessibility Requirements

## Minimum standards
- WCAG 2.1 AA compliance
- All text meets 4.5:1 contrast ratio (3:1 for large text)
- All interactive elements are keyboard-navigable
- Focus indicators are visible and styled (not browser defaults)
- Images have alt text; decorative images use alt=""
- Form inputs have associated labels
- Error messages are descriptive and linked to their fields

## Motion
- Respect `prefers-reduced-motion` — provide a reduced-motion alternative
- No auto-playing animations that can't be paused
- Transitions under 400ms for UI feedback

## Screen readers
- Semantic HTML (nav, main, section, article, aside, header, footer)
- ARIA labels only when semantic HTML is insufficient
- Live regions for dynamic content updates
```

## Anti-AI-slop rules

These are NON-NEGOTIABLE. Every UI implementation must avoid:

### Never use
- **Generic fonts**: Inter, Roboto, Arial, system-ui as the primary display font
- **Clichéd color schemes**: purple gradients on white, blue-to-purple hero sections
- **Cookie-cutter layouts**: centered card with rounded corners and drop shadow on white
- **Overused patterns**: the "SaaS landing page" template (hero → features grid → pricing → CTA)
- **Meaningless motion**: gratuitous parallax, bouncing elements, spinners everywhere
- **Stock decorations**: random blobs, generic wave SVGs, placeholder illustrations

### Always do
- **Choose a distinctive font pairing**: one display font with character + one readable body font
- **Commit to an aesthetic direction**: bold maximalism or refined minimalism both work — the key is intentionality
- **Use the project's tokens**: every color, spacing, and font value comes from tokens.css
- **Design for the content**: the layout should serve what the user needs to see, not a template
- **Test at real viewport sizes**: 375px, 768px, 1280px, 1440px minimum
- **Every interactive element gets states**: default, hover, focus, active, disabled

## How the frontend-designer agent uses this skill

1. **At Step 0 (after planning)**: reads the spec, chooses an aesthetic direction,
   creates the design-system/ folder with all four files. This happens BEFORE coders
   write any UI code.

2. **At Step 2 (UI audit)**: reviews implemented UI against design-system/ conventions.
   Flags AI slop patterns, inconsistent token usage, missing states, a11y violations.

3. **Coder agents**: before writing UI, read design-system/tokens.css and COMPONENTS.md.
   Use ONLY the defined tokens. Do not invent new colors, spacing, or font choices.

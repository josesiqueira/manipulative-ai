# Accessibility Requirements
Project: SYNTHETICA Admin Panel — Tampere University Research Dashboard
Date: 2026-03-31

This is an internal research tool used by a small team of researchers. WCAG 2.1
AA compliance is the minimum. The admin panel is not public-facing but must
be accessible to all university staff, including those using assistive technology.

---

## Minimum standard: WCAG 2.1 AA

All text, interactive elements, and data visualizations must meet AA. This is
the non-negotiable floor, not the aspiration ceiling.

---

## Color contrast requirements

### Text contrast (4.5:1 minimum)

| Element                     | Foreground     | Background     | Ratio  |
|-----------------------------|----------------|----------------|--------|
| Body text                   | slate-700 (#334155) | white (#FFF) | 9.7:1  |
| Muted/secondary text        | slate-500 (#64748B) | white (#FFF) | 4.6:1  |
| Placeholder text            | slate-400 (#94A3B8) | white (#FFF) | 2.8:1* |
| Table header text           | slate-500      | slate-100      | 4.0:1* |
| Badge: conservative         | blue-800 (#1E40AF) | blue-100 (#DBEAFE) | 7.2:1 |
| Badge: red-green            | emerald-800 (#065F46) | emerald-100 (#D1FAE5) | 7.8:1 |
| Badge: moderate             | amber-800 (#92400E) | amber-100 (#FEF3C7) | 6.9:1 |
| Badge: dissatisfied         | rose-800 (#9F1239) | rose-100 (#FFE4E6) | 6.7:1 |
| User chat bubble            | white (#FFF)   | slate-900 (#0F172A) | 18:1  |
| Bot chat bubble             | slate-700      | slate-100 (#F1F5F9) | 8.9:1 |
| Heatmap: dark cells (heatmap-4/5) | white   | blue-400/600   | check per cell |

(*) Placeholder text at 2.8:1 is below AA for normal text; this is acceptable
per WCAG 2.1 SC 1.4.3 because placeholder text is not actual content.
Table header on slate-100 at 4.0:1 should be reviewed — prefer slate-700 on
slate-100 (9.7:1) for header cells.

**Important for heatmap cells**: when background is heatmap-4 (blue-400) or
heatmap-5 (blue-600), switch text color to white. Blue-400 on white is only
2.7:1; white on blue-600 is 4.6:1. The `HeatmapChart` component must calculate
this switch programmatically, not by eyeball.

### Large text (3:1 minimum)
- MetricCard values at text-3xl qualify as large text (30px+); slate-900 on
  white is 19:1 — passes easily.

---

## Interactive elements

### Keyboard navigation

All interactive elements must be reachable and operable by keyboard alone:

- **Tab order**: follows DOM source order; sidebar nav items before main content
- **`<select>` dropdowns in FilterBar**: natively keyboard-accessible; do not
  replace with a custom dropdown component unless the native one cannot support
  required features
- **Table rows (ChatList)**: if clicking a row opens a detail view, the row must
  be a focusable element (`tabIndex={0}`) with `role="button"` or wrapped in an
  `<a>` or `<button>`; arrow key navigation is not required
- **Collapsible sections** (few-shot priming): the toggle must be a `<button>`,
  not a `<div onClick>`; state communicated via `aria-expanded`
- **Heatmap cells (interactive)**: if clicking opens a modal, the cell must be
  a `<button>` inside the `<td>`

### Focus indicators

Do not rely on browser default focus outlines — they vary across browsers and
operating systems.

Standard focus style: `focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-1`

Apply to: `<a>`, `<button>`, `<select>`, `<input>`, `<textarea>`, any
interactive `<div>` with `tabIndex`.

Never use `outline: none` without providing a substitute focus indicator.

---

## Semantic HTML

Use structural HTML elements. Do not use `<div>` where a semantic element exists.

| Element     | Use for                                             |
|-------------|-----------------------------------------------------|
| `<nav>`     | AdminNav sidebar                                    |
| `<main>`    | Primary content area (right of sidebar)             |
| `<aside>`   | Right panel in conversation browser                 |
| `<article>` | MetricCard, individual chat in list                 |
| `<section>` | Named page sections (heading required)              |
| `<header>`  | Page header area, chat detail header                |
| `<table>`   | CoverageMatrix, HeatmapChart — these are data tables|
| `<button>`  | All clickable actions; never `<div onClick>`        |
| `<a>`       | Navigation links (href present); never for actions  |

Tables (`<table>`) must include:
- `<caption>` or `aria-label` describing the table
- `<thead>` with `<th scope="col">` for column headers
- `<th scope="row">` for row headers (block names in heatmap/coverage)
- `summary` attribute is deprecated; use `<caption>` instead

---

## ARIA usage

Use ARIA only when semantic HTML is insufficient. Do not add redundant ARIA.

Required ARIA attributes:

| Component       | Required attributes                                              |
|-----------------|------------------------------------------------------------------|
| SurveyRating bar | `role="progressbar" aria-valuenow aria-valuemin aria-valuemax aria-label` |
| CollapsibleSection | `aria-expanded` on toggle button, `aria-controls` pointing to panel id |
| FilterBar select  | `aria-label="Filter by {dimension}"` (visible label preferred)  |
| ChatList (live)   | `aria-live="polite"` on the list container when results update  |
| LoadingState      | `aria-busy="true"` on the container while loading               |
| Heatmap table     | `aria-label="Persuasiveness heatmap: political block by topic"` |
| Coverage table    | `aria-label="Dataset coverage: political block by topic"`       |

Do NOT add `aria-label` to elements that already have a visible text label.

---

## Motion and animation

- Respect `prefers-reduced-motion: reduce` — all transitions and animations must
  be gated:
  ```css
  @media (prefers-reduced-motion: reduce) {
    *, *::before, *::after {
      animation-duration: 0.01ms !important;
      transition-duration: 0.01ms !important;
    }
  }
  ```
- The `animate-pulse` loading placeholder violates this rule unless gated; wrap
  in `motion-safe:animate-pulse` (Tailwind utility) rather than plain `animate-pulse`
- No auto-playing animations anywhere in the admin panel
- All transitions are under 250ms (--transition-slow); no easing curves that
  feel "bouncy" or call attention to themselves

---

## Forms

- Every `<input>`, `<select>`, and `<textarea>` must have an associated `<label>`
  — either visible (`<label for>`) or via `aria-label`
- FilterBar selects: use a visible `<label>` above the select on settings forms;
  on the FilterBar row, `aria-label` is acceptable because space is constrained
- Error messages: use `aria-describedby` to link the error to its field; error
  text should be specific ("Date must be in YYYY-MM-DD format", not "Invalid input")
- Required fields: mark with `aria-required="true"` and a visible indicator
  (not color alone — color-blind users cannot rely on red label text)

---

## Export and download

- Export buttons must announce completion to screen readers; use an
  `aria-live="polite"` region that receives "Export complete: 47 conversations
  downloaded" on success
- Do not navigate the page or change focus on export completion

---

## Checklist (run before each phase ships)

- [ ] All text passes 4.5:1 contrast (use browser devtools or axe extension)
- [ ] Tab through every interactive element on each page — nothing is skipped
- [ ] Every `<button>` and `<a>` shows a visible focus ring
- [ ] All `<table>` elements have `<th scope>` on headers
- [ ] All loading states include `aria-busy`
- [ ] All collapsible sections have `aria-expanded`
- [ ] SurveyRating bars have `role="progressbar"` and `aria-value*`
- [ ] `prefers-reduced-motion` tested (enable in OS accessibility settings)
- [ ] Screen reader smoke test (VoiceOver/NVDA): navigate to each page and
      confirm headings, landmarks, and table structure are announced correctly

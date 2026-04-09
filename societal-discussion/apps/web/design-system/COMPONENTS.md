# Component Conventions
Project: SYNTHETICA Admin Panel — Tampere University Research Dashboard
Date: 2026-03-31

## Naming

- Components: PascalCase (`MetricCard`, `BlockBadge`, `HeatmapChart`)
- CSS/Tailwind classes: use Tailwind utilities mapped from tokens only; no
  arbitrary values except for layout percentages already defined in tokens.css
- Tokens: always `var(--token-name)` in any inline style or CSS; never raw hex,
  px, or font names

## General composition rules

- Every component lives in `apps/web/src/app/admin/components/`
- No hardcoded colors, spacing, or font sizes anywhere in component files
- All interactive elements must define: default, hover, focus-visible, active,
  and disabled states
- Loading state: show a single gray placeholder rectangle (`bg-slate-100
  animate-pulse rounded`) sized to the expected content — no shimmer, no spinner
  inside data areas
- Empty state: every list, table, or matrix must render a plain text message
  ("No conversations match the selected filters") centered in the content area,
  not hidden or zero-height
- Error state: red border + descriptive message below the affected element;
  never a full-page error screen for partial data failures

---

## Component catalog

### MetricCard

**Purpose**: Single headline stat on the dashboard top row.

**Structure**:
```
<article class="bg-white border border-slate-200 rounded-lg p-5 shadow-xs">
  <p class="text-sm font-medium text-slate-500 uppercase tracking-wide">
    {label}
  </p>
  <p class="mt-2 text-3xl font-semibold text-slate-900 font-mono tabular-nums">
    {value}
  </p>
  <p class="mt-1 text-xs text-slate-400">
    {sublabel}  ← optional: "of consenting participants", "excluding test mode"
  </p>
</article>
```

**Rules**:
- Value is always `font-mono tabular-nums` — never a sans-serif number
- Label is `uppercase tracking-wide text-xs text-slate-500` — small-caps feel
  without a separate font
- No icon, no trend arrow unless the data model provides a comparison value
- Loading state: replace `<p>` value with `<div class="h-8 w-24 bg-slate-100 rounded animate-pulse mt-2" />`
- Width: fills its grid column; grid is `grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4`

**Tailwind classes (direct mapping)**:
`bg-white border border-slate-200 rounded-lg p-5 shadow-sm`

---

### BlockBadge

**Purpose**: Colored pill identifying a political block. Used in chat list rows,
chat detail header, chart legends, and heatmap row labels.

**Structure**:
```
<span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium
             bg-[block-light] text-[block-text]">
  {label}
</span>
```

**Block-to-class mapping** (use these exact Tailwind classes, never arbitrary hex):

| Block         | bg             | text           |
|---------------|----------------|----------------|
| conservative  | `bg-blue-100`  | `text-blue-800` |
| red-green     | `bg-emerald-100` | `text-emerald-800` |
| moderate      | `bg-amber-100` | `text-amber-800` |
| dissatisfied  | `bg-rose-100`  | `text-rose-800` |
| unknown/null  | `bg-slate-100` | `text-slate-500` |

**Rules**:
- Text is always the block name as it appears in the database: "conservative",
  "red-green", "moderate", "dissatisfied" — display label can be title-cased
- `rounded-full` (pill shape) — the only place pills appear in the system
- No border on badges — background color is sufficient contrast
- No icon inside badge (adds visual noise in dense lists)

---

### TopicBadge

**Purpose**: Neutral pill for topic category. Used alongside BlockBadge in list
rows and detail headers.

**Structure**:
```
<span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium
             bg-slate-100 text-slate-600">
  {topicLabel}
</span>
```

**Rules**:
- Always neutral slate — never colored; topics are not categorically encoded
- Use the human-readable topic label from the experiment config, not the raw key
- Multiple badges in a row: `flex gap-1 flex-wrap`

---

### FilterBar

**Purpose**: Horizontal row of filter controls above a list or table.

**Structure**:
```
<div class="flex items-center gap-3 flex-wrap">
  <select class="text-sm border border-slate-300 rounded-md px-3 py-1.5
                 bg-white text-slate-700 focus:outline-none focus:ring-2
                 focus:ring-blue-600 focus:border-blue-600">
    <option>All blocks</option>
    ...
  </select>
  {repeat per filter dimension}
  <input type="search" placeholder="Search messages..."
    class="text-sm border border-slate-300 rounded-md px-3 py-1.5 bg-white
           text-slate-700 placeholder:text-slate-400 focus:outline-none
           focus:ring-2 focus:ring-blue-600 focus:border-blue-600 min-w-[200px]" />
  <button class="ml-auto text-xs text-slate-500 hover:text-slate-700
                 underline underline-offset-2">
    Clear filters
  </button>
</div>
```

**Rules**:
- Focus ring is `ring-2 ring-blue-600` — consistent with the conservative block
  color being the sole blue in the system (they happen to coincide; do not
  introduce a different "focus blue")
- "Clear filters" button is text-only, no filled background
- On narrow screens (`< md`): `flex-col items-start`; selects go full-width
- Active filter state: add `bg-blue-50 border-blue-300` to the select when its
  value is not the default "all"

---

### ChatBubble

**Purpose**: Single message in the conversation transcript.

**User bubble (right-aligned)**:
```
<div class="flex justify-end mb-3">
  <div class="max-w-[72%] bg-slate-900 text-white rounded-lg px-4 py-2.5">
    <p class="text-sm leading-relaxed">{content}</p>
    <p class="text-xs text-slate-400 mt-1 text-right">{timestamp}</p>
  </div>
</div>
```

**Assistant bubble (left-aligned)**:
```
<div class="flex justify-start mb-3">
  <div class="max-w-[72%] bg-slate-100 text-slate-700 rounded-lg px-4 py-2.5">
    <p class="text-sm leading-relaxed">{content}</p>
    <div class="flex items-center justify-between mt-1">
      <p class="text-xs text-slate-400">{timestamp}</p>
      {tokenCount && <p class="text-xs text-slate-400 font-mono">{tokenCount} tok</p>}
    </div>
  </div>
</div>
```

**Synthetic (few-shot priming) turns** — shown in the collapsible priming section:
```
<div class="flex justify-{side} mb-2 opacity-60">
  <div class="max-w-[72%] bg-slate-50 border border-slate-200 text-slate-600
              rounded-lg px-4 py-2 text-sm italic">
    <span class="text-xs font-medium not-italic text-slate-400 block mb-1">
      [Synthetic {role}]
    </span>
    {content}
  </div>
</div>
```

**Rules**:
- User is always right (`justify-end`), assistant always left (`justify-start`)
- No avatar icons — adds noise; researcher knows the roles by position and color
- Token count shown only when `token_count` is non-null
- Bubble width capped at 72% of panel width (`max-w-[72%]`)

---

### SurveyRating

**Purpose**: Horizontal bar showing a 1-5 rating as a proportional fill.

**Structure**:
```
<div class="flex items-center gap-3">
  <span class="text-sm text-slate-500 w-28 shrink-0">{label}</span>
  <div class="flex-1 bg-slate-200 rounded-full h-1.5">
    <div class="bg-blue-600 h-1.5 rounded-full transition-[width]"
         style={{ width: `${(value / 5) * 100}%` }}
         role="progressbar"
         aria-valuenow={value}
         aria-valuemin={1}
         aria-valuemax={5} />
  </div>
  <span class="text-sm font-mono font-semibold text-slate-900 w-8 text-right tabular-nums">
    {value}
  </span>
</div>
```

**Rules**:
- Fill color is `bg-blue-600` (conservative block blue — the only accent in the
  neutral survey section; this is intentional, not a block encoding)
- Bar height: `h-1.5` (6px) — thin enough to be a data bar, not a progress widget
- Always show the numeric value at the right in monospace
- Always include `role="progressbar"` and `aria-value*` attributes
- Three bars (persuasiveness, naturalness, confidence) stacked with `space-y-3`

---

### Heatmap cell

**Purpose**: Cell in the block x topic persuasiveness heatmap.

**Structure**:
```
<td
  class="border border-slate-200 px-3 py-2 text-center text-xs font-mono
         tabular-nums transition-colors"
  style={{ backgroundColor: interpolatedColor }}
  title="{block} × {topic}: avg {avg}, n={count}"
>
  {count > 0 ? `${avg.toFixed(1)}` : '—'}
  {count > 0 && <span class="text-[10px] text-slate-500 ml-0.5">({count})</span>}
</td>
```

**Color interpolation** (avg 1–5 maps to heatmap scale):
- 0 / no data: `var(--heatmap-0)` = `#FFFFFF`
- 1.0: `var(--heatmap-1)` = `#DBEAFE` (blue-100)
- 2.0: `var(--heatmap-2)` = `#BFDBFE` (blue-200)
- 3.0: `var(--heatmap-3)` = `#93C5FD` (blue-300)
- 4.0: `var(--heatmap-4)` = `#60A5FA` (blue-400)
- 5.0: `var(--heatmap-5)` = `#2563EB` (blue-600)

Interpolate linearly between steps. Text color switches to white when
background is heatmap-4 or heatmap-5 (check contrast ratio).

**Rules**:
- Empty cell (no data): `—` in `text-slate-400`, no background color
- Row header (block label): left-aligned, `font-medium text-slate-700`,
  contains a `BlockBadge`
- Column header (topic): `text-xs text-slate-500 font-medium`, 45° rotation if
  column width is tight (`writing-mode: vertical-rl` or `rotate-45`)
- `title` attribute provides the full label for mouse users

---

### Coverage cell

**Purpose**: Cell in the dataset coverage matrix showing statement counts.

**Structure**:
```
<td
  class="border border-slate-200 px-3 py-2 text-center text-sm font-mono
         tabular-nums {bg} {text}"
>
  {count}
</td>
```

**Threshold-to-class mapping**:

| Condition   | bg class          | text class          | Token reference       |
|-------------|-------------------|---------------------|-----------------------|
| count > 10  | `bg-emerald-100`  | `text-emerald-800`  | `--coverage-high`     |
| count 5–10  | `bg-amber-100`    | `text-amber-800`    | `--coverage-mid`      |
| count < 5   | `bg-rose-100`     | `text-rose-800`     | `--coverage-low`      |
| count = 0   | `bg-slate-100`    | `text-slate-400`    | `--coverage-empty`    |

**Rules**:
- Thresholds are hard-coded to these values; do not make them configurable
- Clicking a cell with count > 0 opens a modal listing the actual statements
- No animation on cell color — this is a reference table, not a live feed

---

### Sidebar nav item

**Purpose**: Navigation link in the left sidebar.

**Structure**:
```
<a
  href={href}
  class="flex items-center gap-2.5 px-3 py-2 rounded-md text-sm font-medium
         transition-colors
         {isActive
           ? 'bg-slate-200 text-slate-900'
           : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'}
         focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
>
  <Icon class="w-4 h-4 shrink-0 {isActive ? 'text-slate-900' : 'text-slate-400'}" />
  {label}
</a>
```

**States**:
- Default: `text-slate-600`, no background
- Hover: `bg-slate-100 text-slate-900`
- Active (current page): `bg-slate-200 text-slate-900` — no left border, no
  blue highlight; the sidebar stays neutral; content area shows what section is active
- Focus-visible: `ring-2 ring-blue-600 ring-offset-1`
- Disabled (if applicable): `opacity-40 pointer-events-none`

**Rules**:
- Icon: 16x16, from a single icon library (Lucide is already in the project);
  do not mix icon libraries
- Section dividers: `<hr class="my-2 border-slate-200" />` — no section label headings

---

### Section heading

**Purpose**: Page-level and within-page section headings with a divider.

**Page heading (h1)**:
```
<div class="mb-6">
  <h1 class="text-2xl font-semibold text-slate-900 tracking-tight">{title}</h1>
  {description &&
    <p class="mt-1 text-sm text-slate-500">{description}</p>
  }
</div>
```

**Section heading (h2) with divider**:
```
<div class="flex items-center gap-4 mb-4">
  <h2 class="text-base font-semibold text-slate-700 whitespace-nowrap">{title}</h2>
  <hr class="flex-1 border-slate-200" />
</div>
```

**Rules**:
- h1: `text-2xl font-semibold` — one per page
- h2: `text-base font-semibold text-slate-700` + full-width divider line
- h3: `text-sm font-semibold text-slate-600` — no divider; within a card
- No decorative color on headings; no underlines; no uppercase headings except
  MetricCard labels

---

## Component catalog (implementation tracker)

| Component       | File                                    | Status   | Notes                        |
|-----------------|-----------------------------------------|----------|------------------------------|
| AdminAuth       | admin/components/AdminAuth.tsx          | planned  | Phase 1                      |
| AdminNav        | admin/components/AdminNav.tsx           | planned  | Phase 1 — sidebar            |
| MetricCard      | admin/components/MetricCard.tsx         | planned  | Phase 1                      |
| BlockBadge      | admin/components/BlockBadge.tsx         | planned  | Phase 1                      |
| TopicBadge      | admin/components/TopicBadge.tsx         | planned  | Phase 1                      |
| FilterBar       | admin/components/FilterBar.tsx          | planned  | Phase 2                      |
| ChatList        | admin/components/ChatList.tsx           | planned  | Phase 2                      |
| ChatDetail      | admin/components/ChatDetail.tsx         | planned  | Phase 2                      |
| ChatBubble      | admin/components/ChatBubble.tsx         | planned  | Phase 2 — used by ChatDetail |
| SurveyRating    | admin/components/SurveyRating.tsx       | planned  | Phase 2                      |
| HeatmapChart    | admin/components/HeatmapChart.tsx       | planned  | Phase 1 (dashboard)          |
| BarChart        | admin/components/BarChart.tsx           | planned  | Phase 1 (dashboard)          |
| CoverageMatrix  | admin/components/CoverageMatrix.tsx     | planned  | Phase 1 + Phase 3            |
| ExportPanel     | admin/components/ExportPanel.tsx        | planned  | Phase 3                      |

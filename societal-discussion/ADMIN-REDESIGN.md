# Admin Panel Redesign — Research Dashboard

> Rebuild the admin panel from scratch as a multi-page academic research dashboard with conversation browsing, data visualizations, and filtered exports.

## Context

Project: Bilingual AI chatbot experiment platform (SYNTHETICA, Tampere University)
Stack: Next.js 14 (frontend), FastAPI (backend), Tailwind CSS, Recharts for visualizations
Repo: https://github.com/josesiqueira/manipulative-ai
Current admin: Single 2137-line page.tsx with 8 tabs. No conversation browser, no charts, no filtered exports.

## Design Direction

**Clean academic tool** — white space, muted colors, data-focused. No flashy gradients or decorative elements. Think: research paper supplementary dashboard.

- Color palette: neutral grays, with subtle accent colors for the 4 political blocks (consistent across all views)
- Block colors: conservative=blue-600, red-green=emerald-600, moderate=amber-600, dissatisfied=rose-600
- Typography: system font stack, clear hierarchy, monospace for data values
- Charts: Recharts with muted fills, no 3D effects, clear labels

## Authentication

Same as current: password prompt on entry, stored in sessionStorage. Header `X-Admin-Password` on all API calls. No changes to backend auth.

## Page Structure

### `/admin` — Dashboard (home)

**Top row: Key metrics cards**
- Total participants (with consent)
- Total completed chats (exclude test mode)
- Detection accuracy (% correct guesses overall)
- Avg persuasiveness (1-5 with 1 decimal)
- Avg naturalness (1-5 with 1 decimal)
- Avg confidence (1-5 with 1 decimal)

**Row 2: Detection accuracy by block** (bar chart)
- X axis: 4 political blocks
- Y axis: % of participants who correctly identified the block
- Each bar colored with the block's accent color
- Shows: "conservative is hardest to detect at 23%, dissatisfied easiest at 67%"

**Row 3: Persuasiveness heatmap** (block x topic matrix)
- Rows: 4 blocks
- Columns: 9 topics
- Cell color intensity = avg persuasiveness rating for that combo
- Cell text: avg value + (n) count
- Gray cells for combos with no data

**Row 4: Conversation length distribution** (bar chart or histogram)
- X axis: number of exchanges (messages / 2)
- Y axis: count of chats
- Stacked or grouped by block

**Row 5: Dataset coverage indicator**
- Same block x topic matrix but showing statement counts
- Color: green (>10), yellow (5-10), red (<5)
- Shows few-shot health at a glance

### `/admin/conversations` — Conversation Browser

**Left panel (list, ~40% width)**
- List of all completed chats, sorted by date (newest first)
- Each row shows: date, topic badge, block badge (colored), exchange count, correct/incorrect icon
- Filter bar at top:
  - Dropdown: political block (all, conservative, red-green, moderate, dissatisfied)
  - Dropdown: topic (all, immigration, healthcare, etc.)
  - Dropdown: detection result (all, correct guess, incorrect guess)
  - Dropdown: language (all, en, fi)
  - Text search: search in message content
- Pagination or infinite scroll
- Click a chat to open it in the right panel

**Right panel (detail, ~60% width)**
- **Header**: Chat ID, date, duration, topic, block (colored badge), language
- **Few-shot priming section** (collapsible, collapsed by default):
  - Label: "Injected Examples (5 statements from dataset)"
  - Shows the synthetic conversation turns that were cached
  - Each turn clearly labeled as "[Synthetic User]" and "[Synthetic Bot]"
  - Shows example IDs for traceability
- **Conversation transcript**:
  - Messages displayed as chat bubbles (user on right, bot on left)
  - Timestamps on each message
  - Bot messages show token count if available
- **Survey results section**:
  - Participant's guess vs actual block
  - Correct/incorrect with visual indicator
  - Persuasiveness, naturalness, confidence ratings (with visual bars)
- **Researcher notes** (stretch goal — only if time allows):
  - Text area to add notes/tags per conversation
  - Saved to a new field on the chat model

### `/admin/data` — Data & Export

**Section 1: Dataset Health**
- Block x topic coverage matrix (same as dashboard but interactive)
- Click a cell to see the actual statements for that combo
- Total statements count, per-block counts
- "Last seeded" timestamp if available

**Section 2: Export**
- Export format: CSV or plain text transcript
- Filters (same as conversation browser):
  - Block, topic, detection result, language, date range
- Preview: show count of matching chats before export
- "Export All" button (excludes test mode chats)
- "Export Filtered" button
- Plain text export: one file per chat, formatted like the conversation logger output
- CSV export: one row per chat with columns for all metrics + full transcript in a column

**Section 3: Data Validation**
- Checklist showing:
  - Political statements seeded? (count / expected 261)
  - All 4 blocks present? (with counts)
  - All 9 topics present? (with counts)
  - Few-shot caching active? (count of chats with non-null few_shot_examples)
  - LLM provider configured? (provider name + model)

### `/admin/settings` — Configuration (tucked away)

Everything from the current admin panel that isn't research data:
- Experiment config (name, dates, ethics info, session rules)
- Topic management (enable/disable, labels, welcome messages)
- LLM provider config (API keys, model selection)
- Terms of use editor
- Prompt config viewer (read-only now — prompts are in code via BLOCK_PERSONAS)

This page is a simple vertical form layout, not tabs. Researchers visit this once during setup, not daily.

## New Backend Endpoints Needed

### GET /api/admin/chats
List all chats with filtering. Query params:
- `political_block` (optional)
- `topic_category` (optional)
- `detection_result` (optional: correct, incorrect, pending)
- `language` (optional: en, fi)
- `search` (optional: text search in message content)
- `page` (default 1)
- `per_page` (default 20)
- `sort` (default: -created_at)
- `exclude_test` (default: true)

Response:
```json
{
  "chats": [
    {
      "id": "...",
      "created_at": "...",
      "completed_at": "...",
      "political_block": "conservative",
      "topic_category": "immigration",
      "language": "en",
      "message_count": 12,
      "perceived_leaning": "conservative",
      "correct_guess": true,
      "persuasiveness": 4,
      "naturalness": 5,
      "confidence": 3,
      "is_test_mode": false
    }
  ],
  "total": 142,
  "page": 1,
  "per_page": 20
}
```

### GET /api/admin/chats/{chat_id}/detail
Full chat detail including messages, few-shot cache, and participant demographics.

Response:
```json
{
  "id": "...",
  "political_block": "conservative",
  "topic_category": "immigration",
  "language": "en",
  "created_at": "...",
  "completed_at": "...",
  "few_shot_examples": { "turns": [...], "example_ids": [...], "examples": [...] },
  "messages": [
    { "id": "...", "role": "user", "content": "...", "created_at": "...", "token_count": null },
    { "id": "...", "role": "assistant", "content": "...", "created_at": "...", "token_count": 45 }
  ],
  "survey": {
    "perceived_leaning": "conservative",
    "correct_guess": true,
    "persuasiveness": 4,
    "naturalness": 5,
    "confidence": 3
  },
  "participant": {
    "age_group": "25-34",
    "gender": "prefer_not_to_say",
    "education": null,
    "political_leaning": 3,
    "political_knowledge": 4
  }
}
```

### GET /api/admin/stats/detailed
Extended stats for dashboard visualizations:
- Detection accuracy per block (block -> {total, correct, accuracy_pct})
- Persuasiveness per block x topic (block -> topic -> {avg, count})
- Conversation length distribution (exchange_count -> chat_count, grouped by block)
- Dataset coverage matrix (block -> topic -> count)

### GET /api/admin/export
Updated to support filters and format selection:
- Query params: same filters as /api/admin/chats + `format` (csv, text)
- CSV: returns a single CSV file
- Text: returns a ZIP of individual conversation transcript files

### GET /api/admin/statements
Browse political statements by block and topic.
- Query params: `political_block`, `topic_category`, `page`, `per_page`
- Returns paginated list of statements with all fields

## Frontend Dependencies to Add

- `recharts` — charting library
- No other new dependencies needed (Tailwind handles layout/styling)

## Do Not Touch

- Participant-facing pages (consent, chat, survey)
- Backend models (no schema changes)
- Authentication mechanism (same X-Admin-Password header)
- Deployment configuration
- Internationalization setup
- Core API endpoints (participants, chats, messages)

## File Structure

```
apps/web/src/app/admin/
  layout.tsx          — Shared admin layout with sidebar nav + auth gate
  page.tsx            — Dashboard (home)
  conversations/
    page.tsx          — Conversation browser
  data/
    page.tsx          — Data & export
  settings/
    page.tsx          — Configuration
  components/
    AdminAuth.tsx     — Password prompt component
    AdminNav.tsx      — Sidebar navigation
    MetricCard.tsx    — Stat card component
    BlockBadge.tsx    — Colored badge for political blocks
    TopicBadge.tsx    — Badge for topics
    ChatList.tsx      — Filterable chat list (left panel)
    ChatDetail.tsx    — Full conversation view (right panel)
    HeatmapChart.tsx  — Block x topic heatmap
    BarChart.tsx      — Reusable bar chart wrapper
    CoverageMatrix.tsx — Dataset coverage grid
    ExportPanel.tsx   — Export controls with filters
    FilterBar.tsx     — Reusable filter controls
```

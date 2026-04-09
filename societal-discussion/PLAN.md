# Implementation Plan
Source: ADMIN-REDESIGN.md
Date: 2026-03-31
Stack: Python 3.12 / FastAPI (api) — TypeScript 5.3 / Next.js 14.1 App Router (web)

---

## Architectural decisions

### Why backend first
Frontend pages need real data. Phases 1-2 build all new API endpoints so frontend phases can call them directly.

### Deletion of the monolith
The current `apps/web/src/app/admin/page.tsx` (2137 lines) is deleted in Phase 3 and replaced with the new multi-page structure. Settings functionality is ported in Phase 7 — no functionality is lost.

### Shared types file
All frontend phases import TypeScript interfaces from a single `types.ts`. No local type redefinitions.

### Computed fields
`Chat.correct_guess` is NOT a DB column — computed as `perceived_leaning == political_block` in Python.

---

## Phase 1: Backend — Chat List and Detail Endpoints
**Goal**: Add `GET /api/admin/chats` (paginated/filtered) and `GET /api/admin/chats/{chat_id}/detail`.
**Complexity**: medium
**has_ui**: false
**Dependencies**: none

### Tasks
1. Add Pydantic response models: `ChatListItem`, `ChatListResponse`, `ChatDetailResponse`, `MessageDetail`, `SurveyDetail`, `ParticipantSummary`
   File: apps/api/src/routers/admin.py
2. Implement `GET /api/admin/chats`: filters for political_block, topic_category, language, detection_result (correct/incorrect/pending), search (message content LIKE), exclude_test (default true), pagination (page, per_page)
   File: apps/api/src/routers/admin.py
3. Implement `GET /api/admin/chats/{chat_id}/detail`: load Chat with selectinload(messages, participant), return few_shot_examples, survey fields, participant demographics, computed correct_guess
   File: apps/api/src/routers/admin.py
4. Add tests for both endpoints
   File: apps/api/tests/test_admin_chats.py

### Acceptance criteria
- [ ] GET /api/admin/chats returns {"chats": [...], "total": N, "page": 1, "per_page": 20}
- [ ] GET /api/admin/chats?political_block=conservative returns only conservative chats
- [ ] GET /api/admin/chats?detection_result=correct returns only correct guesses
- [ ] GET /api/admin/chats/{id}/detail returns messages array, survey object, participant object, few_shot_examples
- [ ] GET /api/admin/chats/{bad_id}/detail returns 404
- [ ] All endpoints require X-Admin-Password header
- [ ] cd apps/api && uv run pytest tests/test_admin_chats.py exits 0

### Parallel split
- Agent A (tasks 1-3): All endpoint code in admin.py
- Agent B (task 4): Test file (runs after Agent A)

---

## Phase 2: Backend — Detailed Stats, Export Upgrade, Statements
**Goal**: Add `GET /api/admin/stats/detailed`, upgrade export with filters + text/zip, add `GET /api/admin/statements`.
**Complexity**: medium
**has_ui**: false
**Dependencies**: Phase 1

### Tasks
1. Implement `GET /api/admin/stats/detailed`: block_accuracy (per-block detection %), persuasiveness_matrix (block x topic avg), length_distribution (exchange count histogram by block), coverage_matrix
   File: apps/api/src/routers/admin.py
2. Upgrade `GET /api/admin/export`: add filters (political_block, topic_category, detection_result, language, date_from, date_to); add format=text returning ZIP of transcript files
   File: apps/api/src/routers/admin.py
3. Implement `GET /api/admin/statements`: paginated, filterable by political_block and topic_category
   File: apps/api/src/routers/admin.py
4. Add tests
   File: apps/api/tests/test_admin_stats_export.py

### Acceptance criteria
- [ ] stats/detailed returns block_accuracy, persuasiveness_matrix, length_distribution, coverage_matrix
- [ ] block_accuracy has entries for all 4 blocks with total, correct, accuracy_pct
- [ ] export?format=text returns application/zip content-type
- [ ] export?format=csv&political_block=conservative returns CSV with only conservative data
- [ ] statements?political_block=conservative&topic_category=immigration returns matching rows
- [ ] cd apps/api && uv run pytest tests/test_admin_stats_export.py exits 0

### Parallel split
- Agent A (tasks 1-3): All endpoint code
- Agent B (task 4): Tests (runs after Agent A)

---

## Phase 3: Frontend — Shared Components, Layout, Types
**Goal**: Delete monolith, create admin layout with auth gate + sidebar nav, shared components, TypeScript types.
**Complexity**: medium
**has_ui**: true
**Dependencies**: none

### Tasks
1. Create apps/web/src/app/admin/lib/types.ts — all TypeScript interfaces for admin API responses
2. Create apps/web/src/app/admin/lib/api.ts — fetch wrapper with X-Admin-Password header, typed helper functions
3. Create apps/web/src/app/admin/components/AdminAuth.tsx — password prompt, sessionStorage
4. Create apps/web/src/app/admin/components/AdminNav.tsx — fixed left sidebar with route links
5. Create apps/web/src/app/admin/layout.tsx — wraps auth gate + nav + main content area
6. Create shared components: BlockBadge.tsx, TopicBadge.tsx, MetricCard.tsx
7. Delete old page.tsx, create stub pages for all 4 routes (/admin, /admin/conversations, /admin/data, /admin/settings)

### Acceptance criteria
- [x] cd apps/web && npm run build exits 0
- [ ] /admin shows password prompt if no sessionStorage entry
- [ ] After auth, sidebar renders with 4 navigation links
- [ ] AdminNav highlights active route
- [x] BlockBadge renders conservative with blue, red-green with emerald, moderate with amber, dissatisfied with rose
- [x] All 4 routes return 200

### Parallel split
- Agent A (tasks 1-2): types.ts + api.ts
- Agent B (tasks 3-5): AdminAuth + AdminNav + layout.tsx
- Agent C (tasks 6-7): Shared components + stub pages

---

## Phase 4: Frontend — Dashboard Page
**Goal**: Build /admin with 6 metric cards, detection accuracy bar chart, persuasiveness heatmap, conversation length chart, coverage matrix.
**Complexity**: high
**has_ui**: true
**Dependencies**: Phase 2 (stats/detailed endpoint), Phase 3 (shared components)

### Tasks
1. Create HeatmapChart.tsx — block x topic grid with color-interpolated cells
2. Create CoverageMatrix.tsx — statement count grid with green/amber/red coloring
3. Create AdminBarChart.tsx — recharts wrapper with per-bar colors
4. Build full apps/web/src/app/admin/page.tsx — 6 MetricCards + 4 chart sections, loading skeletons
   File: apps/web/src/app/admin/page.tsx

### Acceptance criteria
- [ ] cd apps/web && npm run build exits 0
- [ ] Dashboard renders 6 MetricCards: Participants, Completed Chats, Detection Accuracy, Avg Persuasiveness, Avg Naturalness, Avg Confidence
- [ ] Detection accuracy bar chart has 4 bars with correct block colors
- [ ] Heatmap grid has 4 rows x 9 columns; empty cells show dash
- [ ] Coverage matrix cells colored green (>10), amber (5-10), red (<5)
- [ ] Loading state shows gray skeleton placeholders

### Parallel split
- Agent A (tasks 1-2): HeatmapChart + CoverageMatrix
- Agent B (task 3): AdminBarChart
- Agent C (task 4): Full page.tsx (after A and B)

---

## Phase 5: Frontend — Conversation Browser
**Goal**: Build /admin/conversations with two-panel layout: filterable chat list + conversation detail with few-shot priming section.
**Complexity**: high
**has_ui**: true
**Dependencies**: Phase 1 (chat endpoints), Phase 3 (shared components)

### Tasks
1. Create FilterBar.tsx — 4 dropdowns (block, topic, detection, language) + text search input
2. Create ChatList.tsx — scrollable list with badges, pagination, selected state
3. Create ChatDetail.tsx — header, collapsible few-shot section, chat bubbles, survey results, participant demographics
4. Build full apps/web/src/app/admin/conversations/page.tsx — state management, TanStack Query, two-column responsive layout

### Acceptance criteria
- [ ] cd apps/web && npm run build exits 0
- [ ] FilterBar renders 4 dropdowns + text input; changing triggers filter update
- [ ] Selecting a chat loads detail panel showing chat ID, messages, survey results
- [ ] User messages align right (dark bg), assistant messages align left (white bg)
- [ ] Few-shot section is collapsed by default, expandable via details/summary
- [ ] Survey shows actual block badge, perceived_leaning, correct/incorrect indicator
- [ ] Rating bars width proportional to value/5
- [ ] Responsive: stacked on mobile, side-by-side on desktop

### Parallel split
- Agent A (tasks 1-2): FilterBar + ChatList
- Agent B (task 3): ChatDetail
- Agent C (task 4): Full page.tsx (after A and B)

---

## Phase 6: Frontend — Data & Export Page
**Goal**: Build /admin/data with interactive coverage matrix, filtered export controls, statement browser, data validation checklist.
**Complexity**: medium
**has_ui**: true
**Dependencies**: Phase 2 (statements + export endpoints), Phase 4 (CoverageMatrix component)

### Tasks
1. Create ExportPanel.tsx — filter dropdowns, date range, format radio, preview count, download button
2. Add onCellClick prop to CoverageMatrix.tsx for drill-down
3. Create StatementDrawer.tsx — sliding panel showing statements for a block x topic cell
4. Build full apps/web/src/app/admin/data/page.tsx — 3 sections: Dataset Health, Export, Data Validation checklist

### Acceptance criteria
- [x] cd apps/web && npm run build exits 0
- [x] Clicking coverage matrix cell opens statement drawer with matching statements
- [x] Export preview shows matching conversation count
- [x] Export download triggers file download (CSV or ZIP)
- [x] Data validation shows green check for 261 statements, 4 blocks, 9 topics

### Parallel split
- Agent A (tasks 1, 3): ExportPanel + StatementDrawer
- Agent B (task 2): CoverageMatrix enhancement
- Agent C (task 4): Full page.tsx (after A and B)

---

## Phase 7: Frontend — Settings Page
**Goal**: Port existing config forms into clean vertical layout at /admin/settings.
**Complexity**: low
**has_ui**: true
**Dependencies**: Phase 3 (admin layout)

### Tasks
1. Create SaveButton.tsx — reusable save button with loading spinner
2. Build full apps/web/src/app/admin/settings/page.tsx — 5 sections: Experiment Config, Topic Management, LLM Provider, Terms of Use, Bot Prompts

### Acceptance criteria
- [ ] cd apps/web && npm run build exits 0
- [ ] 5 clearly labeled sections without tabs
- [ ] Save buttons disabled while API call in flight
- [ ] All sections load current values on mount via GET
- [ ] LLM API key input is type="password"

### Parallel split
- Agent A (task 1): SaveButton
- Agent B (task 2): Full settings page (after Agent A)

---

## Execution order
Phase 1 → Phase 2 → Phase 3 → Phase 4 → Phase 5 → Phase 6 → Phase 7
(Phases 1, 2, 3 could run in parallel but sequencing is safer for a single runner)

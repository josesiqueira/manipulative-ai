# Admin Panel Improvement Plan

Implementation plan for the admin panel of **manipulative-ai2**, a Finnish political-chatbot research project deployed at https://vaalikeskustelu.2.rahtiapp.fi. The admin is at `/admin` (password: `7whk3sNRP5czZYpb9uORESsq`, stored only out-of-band).

Target user: a non-technical university researcher who needs to (a) run an experiment, (b) understand at a glance how many participants have used the bot, and (c) cleanly download per-conversation and per-message data for thesis analysis.

This plan is structured so that multiple agents can pick up streams **in parallel**. Each stream owns a disjoint set of files within its phase; cross-stream rules are listed at the bottom.

---

## Phases

```
┌────────────────────────────────────┐
│ Phase 1 — run in parallel          │
│   • Stream A (backend)             │
│   • Stream E (polish, no API dep)  │
└────────────────┬───────────────────┘
                 │  (Stream A defines API contract used by B/C/D)
                 ▼
┌────────────────────────────────────┐
│ Phase 2 — run in parallel          │
│   • Stream B (dashboard)           │
│   • Stream C (conversations)       │
│   • Stream D (export & data)       │
└────────────────────────────────────┘
```

Streams **B/C/D depend on Stream A's API contract** (defined below). They can start as soon as Stream A's first deliverable lands; they don't need to wait for E.

---

## API contract (Stream A delivers; B/C/D consume)

Stream A must produce these endpoints/changes. Frontend streams may rely on this contract being stable.

### 1. Extended export endpoint

`GET /api/admin/export?format=csv|json|zip|messages-csv|messages-json&assigned_party=…&date_from=…&date_to=…&include_test=true|false`

- New formats: `messages-csv` and `messages-json` — return **one row per message** with fields: `session_id, conversation_id, message_id, role, content, token_count, language, created_at`.
- Existing `csv` and `json` formats: add `language` field to the per-conversation rows.
- All formats respect a new `include_test` query parameter (default `false`).

### 2. New survey-export endpoint

`GET /api/admin/export/surveys?format=csv|json`

Returns one row per survey response with: `session_id, submitted_at` + a flattened set of columns for each key in `survey_responses.responses` JSONB. Sample columns (from the current schema in `apps/web/src/app/survey/page.tsx`):
- `chatbot_usage`, `chatbot_which`, `political_chatbot`, `chatbot_perception` (1-5), `conversation_reflection`, `response_speed` (1-5), `topic_variety` (1-5), `detected_bias` (1-5), `detected_terminology` (1-5), `detected_persuasion` (1-5), `notice_anything`.

### 3. Conversation flagging

- New columns on `conversations` table: `is_flagged BOOLEAN DEFAULT false`, `flag_notes TEXT NULL`.
- New endpoint: `PATCH /api/admin/conversations/{id}/flag` body `{is_flagged: bool, flag_notes?: string}` returns the updated conversation.
- Existing `GET /api/admin/conversations` response includes `is_flagged` and `flag_notes`.
- Existing CSV/JSON/message exports include `is_flagged`.

### 4. Extended stats endpoint

`GET /api/admin/stats` adds:
- `completion_rate: float` (= `completed_conversations / total_conversations`, 0 when no conversations).
- `conversations_today: int`
- `flagged_count: int`

### 5. New daily-breakdown endpoint

`GET /api/admin/stats/daily?days=7`

Returns:
```json
{
  "days": [
    {"date": "2026-05-02", "by_party": {"sdp": 3, "vihreat": 1, ...}, "total": 8},
    ...
  ]
}
```

Used by the dashboard time-series chart.

---

## Stream A — Backend (Python)

**Owned files:**
- `apps/api/src/routers/admin.py`
- `apps/api/src/models/conversation.py`
- `apps/api/alembic/versions/003_add_conversation_flags.py` *(new)*
- `apps/api/src/services/conversation_logger.py` (if needed for message-level format)

**Tasks:**

1. Create Alembic migration `003_add_conversation_flags.py` adding `is_flagged BOOLEAN DEFAULT false NOT NULL` and `flag_notes TEXT NULL` to `conversations`. Update the SQLAlchemy `Conversation` model.
2. Add `format=messages-csv` and `format=messages-json` to the `/api/admin/export` endpoint. Each row = one message; columns listed in API contract §1.
3. Add `language` and `is_flagged` columns to existing `csv`/`json` export rows.
4. Honor `include_test` query parameter on all export formats (default `false`); when `true`, do NOT filter `is_test_mode=false`.
5. Add `GET /api/admin/export/surveys` (CSV + JSON). Flatten `responses` JSONB into columns; missing keys → empty string.
6. Add `PATCH /api/admin/conversations/{id}/flag`. Validate body, update, return 200 with the full updated conversation.
7. Extend `GET /api/admin/stats` with `completion_rate`, `conversations_today`, `flagged_count`.
8. Add `GET /api/admin/stats/daily?days=N` (default 7). Group by `started_at::date` and `assigned_party`. Exclude test conversations by default.

**Acceptance criteria:**
- `alembic upgrade head` succeeds on the live SQLite DB (will be applied via Recreate strategy on next rollout).
- `curl https://api-vaalikeskustelu.2.rahtiapp.fi/api/admin/stats -H "X-Admin-Password: …"` returns the new fields.
- `curl …/api/admin/export?format=messages-csv` returns CSV with the documented columns.
- `curl …/api/admin/export/surveys?format=csv` returns CSV with the documented columns.
- `curl -X PATCH …/api/admin/conversations/{id}/flag -d '{"is_flagged":true,"flag_notes":"check"}'` toggles the flag.

**Out of scope:** any frontend changes; visual styling; new pages.

---

## Stream E — Polish (frontend, no backend dependency)

**Owned files (exclusively — no other stream should touch these in this phase):**
- `apps/web/src/app/admin/components/AdminAuth.tsx`
- `apps/web/src/app/admin/components/Badge.tsx` *(new)*
- `apps/web/src/lib/useUnsavedChanges.ts` *(new hook)*
- `apps/web/src/app/admin/settings/page.tsx` (add hook usage only)
- `apps/web/src/app/admin/prompts/page.tsx` (add hook usage only)

**Tasks:**

1. **Auth error feedback** (`AdminAuth.tsx`). When the password check fails, show a red banner ("Incorrect password") instead of silently re-rendering. Keep the input non-empty so the user can correct it.
2. **`Badge` component** (`components/Badge.tsx`, new). Reusable, with `variant` prop (`party`, `status`, `test`, `flagged`) and `size` prop (`sm`, `md`). Tailwind-based, no new dependencies. **Do not refactor existing badge usages yet** — leave that for a future cleanup pass to avoid conflicts with parallel streams.
3. **`useUnsavedChanges` hook** (`lib/useUnsavedChanges.ts`, new). Accepts a `dirty: boolean` and registers a `beforeunload` listener. Returns `void`. Wire it into the Settings form and the Prompts editor (only the dirty-flag tracking; do not redesign those pages).

**Acceptance criteria:**
- Wrong password → red banner appears.
- New `Badge` component renders and is importable. Storybook/test optional.
- Editing Settings then attempting to leave the page (close tab, navigate away) → browser prompt asking to confirm.
- Same for Prompts page when an edit is in progress.

**Out of scope:** changing existing badge usages, changing the visual layout of Settings/Prompts, anything in Stream B/C/D's owned files.

---

## Stream B — Dashboard (Phase 2)

**Owned files:**
- `apps/web/src/app/admin/page.tsx`
- `apps/web/src/app/admin/components/AdminBarChart.tsx` (may extend)
- `apps/web/src/app/admin/components/RefreshButton.tsx` *(new)*
- `apps/web/src/app/admin/components/DailyChart.tsx` *(new)*

**Tasks:**

1. **Refresh control.** Add a small `RefreshButton` in the top-right of the dashboard with "Last updated X min ago" text. Clicking it re-fetches `/api/admin/stats` and the daily-breakdown endpoint. Maintain `lastUpdatedAt` state, update on each fetch.
2. **Auto-refresh toggle.** A checkbox "Auto-refresh every 10s" next to the button. When ON, polls every 10 seconds. Default OFF.
3. **Completed % metric card.** Add a new `MetricCard` showing `completion_rate * 100`, with a `?` tooltip text: "Conversations where the participant submitted the post-conversation survey, divided by total conversations."
4. **Conversations today card.** New `MetricCard` for `conversations_today`.
5. **Flagged count card.** New `MetricCard` for `flagged_count` (red text or icon).
6. **Daily breakdown chart.** New `DailyChart.tsx` component showing the last 7 days as a stacked-bar or line chart per party. Use `/api/admin/stats/daily`. Place below the existing party-distribution chart.

**Acceptance criteria:**
- Refresh button works; timestamp updates.
- Auto-refresh polls when enabled, stops when disabled.
- New metric cards render correctly; tooltips appear on hover.
- Daily chart renders 7 days of data, parties color-matched to `PARTY_COLORS` in `lib/types.ts`.

**Dependencies:** Stream A's extended `/api/admin/stats` and new `/api/admin/stats/daily` endpoints.

**Out of scope:** changes to admin/conversations/, export, settings, prompts pages. Don't refactor badges (leave Badge component for Stream E or a future pass).

---

## Stream C — Conversations (Phase 2)

**Owned files:**
- `apps/web/src/app/admin/conversations/page.tsx`
- `apps/web/src/app/admin/components/FilterBar.tsx`
- `apps/web/src/app/admin/components/ConversationList.tsx`
- `apps/web/src/app/admin/components/ConversationDetail.tsx`

**Tasks:**

1. **Date filters in `FilterBar`.** Add `dateFrom` / `dateTo` date picker inputs. Wire to the conversations query params (`/api/admin/conversations?date_from=…&date_to=…`). If the backend doesn't already support those params, add them in this stream's backend touch (or coordinate with Stream A — Stream A may add them as a bonus). For now, filter client-side after fetching.
2. **Sortable columns** in `ConversationList`. Add sort indicators on Date, Messages, Status. Default sort: Date desc. Maintain `sortBy` state.
3. **Tighter row padding** (`ConversationList.tsx`). Change `py-3` → `py-2` and reduce vertical gaps so 100+ rows scan faster.
4. **More prominent test-mode badge** (`ConversationList.tsx`). Change from subtle amber text to a small striped or filled badge with clear "TEST" label.
5. **Conversation flag toggle** in `ConversationDetail.tsx`. Add a "Flag for review" checkbox + small notes textarea. On change, call `PATCH /api/admin/conversations/{id}/flag`. Show a small "Flagged" badge in `ConversationList` for flagged conversations (using the new `is_flagged` field from the API).
6. **Download .txt button** in `ConversationDetail.tsx`. Fetches the conversation's messages and offers a downloadable `.txt` file (client-side blob — no extra API needed; format the transcript as `[HH:MM:SS] role: content`).

**Acceptance criteria:**
- Date pickers filter the list correctly.
- Sortable columns toggle ascending/descending.
- Test badge is visually unmistakable; conversation row gives the researcher an immediate "ignore this" signal.
- Flag toggle persists across reloads (the API stores it).
- Download .txt produces a clean transcript file.

**Dependencies:** Stream A's flag endpoint and `is_flagged` field on conversation list response.

**Out of scope:** anything in dashboard, export, settings, prompts. Don't create or modify a Badge component (leave that to Stream E).

---

## Stream D — Export & Data (Phase 2)

**Owned files:**
- `apps/web/src/app/admin/components/ExportPanel.tsx`
- `apps/web/src/app/admin/data/page.tsx`

**Tasks:**

1. **`include_test` checkbox** in `ExportPanel.tsx`. Default unchecked. When checked, pass `include_test=true` to the export endpoint. Show small helper text: "Include conversations created from the Try-bot panel".
2. **New export format options.** Currently CSV/JSON/Text(ZIP). Add:
   - **CSV — messages** (one row per message)
   - **JSON — messages** (one record per message)
   Both call `/api/admin/export?format=messages-csv|messages-json`.
3. **Survey export button.** Separate section in `ExportPanel.tsx` titled "Survey responses" with CSV and JSON buttons. Calls `/api/admin/export/surveys?format=…`.
4. **Tooltips on format options.** Each radio/option has a small `?` icon with hover text:
   - CSV: "One row per conversation. Full transcript in a single column."
   - JSON: "One record per conversation. Structured."
   - Text (ZIP): "Individual `.txt` transcript files, one per conversation."
   - CSV — messages: "One row per message. Use for turn-level analysis."
   - JSON — messages: "One record per message. Structured."
5. **Document the survey schema.** Inside the survey-export section, list the column names: `session_id, submitted_at, chatbot_usage, chatbot_which, political_chatbot, chatbot_perception, conversation_reflection, response_speed, topic_variety, detected_bias, detected_terminology, detected_persuasion, notice_anything`.

**Acceptance criteria:**
- The export panel offers 5 conversation formats and a separate survey section with 2 formats.
- `include_test=true` works (verifiable by exporting a Try-bot test conversation).
- Tooltips appear on hover; copy is in English.

**Dependencies:** Stream A's new `format=messages-*` modes and `/api/admin/export/surveys` endpoint.

**Out of scope:** anything in dashboard, conversations, settings, prompts. Don't change the layout of `data/page.tsx` beyond adding the new export options.

---

## Cross-stream rules

1. **No file is owned by two streams in the same phase.** Always check the "Owned files" lists.
2. **Don't refactor existing badge usages.** Stream E creates a `Badge.tsx` component but does NOT replace existing badges in `ConversationList`, `ExportPanel`, etc. That cleanup is a follow-up task after all of Phase 2 lands.
3. **English only in admin.** Don't introduce Finnish strings (party display names like "Vihreät" are the exception, as proper nouns).
4. **No new dependencies.** Tailwind + the libraries already in `apps/web/package.json` are sufficient. No charting library beyond what's already used.
5. **Backwards-compatible API changes only.** Stream A must add new fields/endpoints without breaking existing ones (frontend Streams B/C/D rely on the old behavior remaining valid during their work).
6. **DB migration is destructive in spirit** — `is_flagged DEFAULT false` is safe but every team should know it's added. Run `alembic upgrade head` on local before testing.
7. **Live deploy is on Rahti** (project `manipulative-ai-2`); after Phase 2 lands, rebuild + push API and Web Docker images, then `oc rollout restart`. The PVC is `ReadWriteOnce` with strategy=Recreate, so brief downtime on rollout is expected.

---

## What's explicitly NOT in scope

- Merging Data & Export with Conversations pages (deferred by user).
- Mobile-first redesign (sidebar hamburger drawer) — separate task.
- Skeleton loaders — separate polish pass.
- Code-editor (monaco) for the Prompts page — separate task.
- Renaming the project namespace from `manipulative-ai-2` (it's invisible to participants — kept as is).

---

## Suggested running order

1. **Kick off Phase 1 in parallel:**
   - `Agent(Stream A: backend)` — produces API + migration.
   - `Agent(Stream E: polish)` — produces Badge component, auth-error fix, unsaved-changes hook.
2. **When Stream A's PR merges:** kick off Phase 2 in parallel:
   - `Agent(Stream B: dashboard)`
   - `Agent(Stream C: conversations)`
   - `Agent(Stream D: export & data)`
3. **After Phase 2:** local test, then build + push Docker images, then `oc rollout restart deploy/api deploy/web` to deploy to Rahti.
4. **Optional Phase 3 (later):** refactor existing badge usages to use the new `Badge` component; add a flagged-conversations filter to the conversations list; tighten any leftover layout issues.

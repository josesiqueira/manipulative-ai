# PROJECT-STATUS.md — Societal Discussion Research Platform

**Generated:** 2026-04-09  
**Codebase commit:** a9ae51f (main)

---

## Table of Contents

1. [File Tree](#1-file-tree)
2. [Key Files — What Each Does](#2-key-files--what-each-does)
3. [Database Models](#3-database-models)
4. [API Endpoints](#4-api-endpoints)
5. [Political Dataset Pipeline](#5-political-dataset-pipeline)
6. [Prompt Templates](#6-prompt-templates)
7. [LLM Client](#7-llm-client)
8. [Political Block Assignment](#8-political-block-assignment)
9. [Frontend Components](#9-frontend-components)
10. [Deployment — Docker, k8s, Local](#10-deployment--docker-k8s-local)
11. [Admin Panel](#11-admin-panel)
12. [Known Bugs and Incomplete Features](#12-known-bugs-and-incomplete-features)
13. [Environment Variables](#13-environment-variables)
14. [Finnish Language / i18n](#14-finnish-language--i18n)

---

## 1. File Tree

```
societal-discussion/
├── apps/
│   ├── api/                                  # FastAPI backend (Python 3.11+)
│   │   ├── alembic/                          # Database migrations
│   │   │   ├── env.py
│   │   │   ├── script.py.mako
│   │   │   └── versions/
│   │   │       ├── 001_initial_schema.py
│   │   │       ├── 002_add_prompt_configs.py
│   │   │       ├── 003_add_terms_config.py
│   │   │       ├── 004_add_llm_config.py
│   │   │       ├── 005_add_experiment_and_topics.py
│   │   │       ├── 006_add_timezone_to_timestamps.py
│   │   │       └── 007_add_few_shot_examples_to_chats.py
│   │   ├── alembic.ini
│   │   ├── Dockerfile                        # Production (Rahti) — uv, non-root, port 8080
│   │   ├── .dockerignore
│   │   ├── pyproject.toml
│   │   ├── scripts/
│   │   │   └── seed_database.py              # Seeds config tables (topics, prompts, experiment, LLM, terms)
│   │   ├── src/
│   │   │   ├── __init__.py
│   │   │   ├── main.py                       # FastAPI app, CORS, lifespan, public routes
│   │   │   ├── config.py                     # Pydantic settings from .env
│   │   │   ├── database.py                   # SQLAlchemy async engine + session
│   │   │   ├── seed.py                       # Dataset seeder (xlsx → political_statements)
│   │   │   ├── models/
│   │   │   │   ├── __init__.py               # Re-exports all 9 models
│   │   │   │   ├── participant.py
│   │   │   │   ├── chat.py
│   │   │   │   ├── message.py
│   │   │   │   ├── prompt_config.py
│   │   │   │   ├── terms_config.py
│   │   │   │   ├── llm_config.py
│   │   │   │   ├── experiment_config.py
│   │   │   │   ├── topic_config.py
│   │   │   │   └── statement.py              # PoliticalStatement
│   │   │   ├── routers/
│   │   │   │   ├── __init__.py
│   │   │   │   ├── participants.py           # Consent, session tokens, terms
│   │   │   │   ├── chats.py                  # Chat CRUD, message exchange, survey completion
│   │   │   │   └── admin.py                  # ~40 admin endpoints (stats, export, config, prompts)
│   │   │   └── services/
│   │   │       ├── __init__.py
│   │   │       ├── prompt_builder.py         # System prompt assembly, DB-backed persona overrides
│   │   │       ├── llm_client.py             # Provider selection + response generation
│   │   │       ├── llm_models.py             # Model registry (GPT-5.4, Claude Sonnet 4.5, etc.)
│   │   │       ├── llm_providers/
│   │   │       │   ├── __init__.py
│   │   │       │   ├── base.py               # Abstract LLMProvider
│   │   │       │   ├── openai_provider.py
│   │   │       │   └── anthropic_provider.py
│   │   │       ├── block_assignment.py       # Stratified weighted-random block selection
│   │   │       ├── example_selector.py       # Few-shot example selection + caching
│   │   │       ├── encryption.py             # Fernet encryption for stored API keys
│   │   │       ├── conversation_logger.py    # Disk-based .txt log writer
│   │   │       └── topic_coverage.py         # Sparse-topic detection
│   │   └── tests/
│   │       ├── test_api.py
│   │       ├── test_admin_chats.py
│   │       ├── test_admin_stats_export.py
│   │       ├── test_prompt_builder.py
│   │       └── test_seed.py
│   └── web/                                  # Next.js 14 frontend (TypeScript)
│       ├── Dockerfile                        # Production (Rahti) — 3-stage, non-root, port 8080
│       ├── .dockerignore
│       ├── package.json
│       ├── next.config.js                    # next-intl plugin, standalone output
│       ├── tailwind.config.ts
│       ├── postcss.config.js
│       ├── tsconfig.json
│       ├── playwright.config.ts
│       ├── .eslintrc.json
│       ├── .env.local                        # NEXT_PUBLIC_API_URL=http://localhost:8000
│       ├── design-system/
│       │   ├── tokens.css                    # CSS custom properties
│       │   ├── tailwind-tokens.js            # Tailwind theme extensions
│       │   ├── AESTHETIC.md
│       │   ├── ACCESSIBILITY.md
│       │   └── COMPONENTS.md
│       ├── public/locales/
│       │   ├── en/common.json                # Full English translations
│       │   └── fi/common.json                # Full Finnish translations
│       ├── src/
│       │   ├── middleware.ts                  # next-intl locale routing (en, fi)
│       │   ├── i18n/request.ts               # Message loader
│       │   ├── components/
│       │   │   └── LanguageSelector.tsx       # EN/FI toggle
│       │   ├── lib/
│       │   │   └── topicColors.ts            # Per-topic color schemes (9 topics + default)
│       │   ├── app/
│       │   │   ├── layout.tsx                # Root HTML shell
│       │   │   ├── globals.css
│       │   │   ├── [locale]/
│       │   │   │   ├── layout.tsx            # NextIntlClientProvider wrapper
│       │   │   │   ├── page.tsx              # Consent + demographics form
│       │   │   │   ├── chat/page.tsx         # Topic selection → chat interface
│       │   │   │   └── survey/page.tsx       # Post-chat survey (4 questions)
│       │   │   └── admin/
│       │   │       ├── layout.tsx            # AdminAuth + AdminNav wrapper
│       │   │       ├── page.tsx              # Dashboard (stats + charts)
│       │   │       ├── conversations/page.tsx # Two-panel conversation browser
│       │   │       ├── prompts/page.tsx      # Live prompt editor
│       │   │       ├── data/page.tsx         # Export + coverage matrix
│       │   │       ├── settings/page.tsx     # Experiment, topics, LLM, terms config
│       │   │       ├── error.tsx
│       │   │       ├── components/           # AdminNav, AdminAuth, ChatList, ChatDetail,
│       │   │       │                         # FilterBar, BlockBadge, TopicBadge, MetricCard,
│       │   │       │                         # AdminBarChart, HeatmapChart, CoverageMatrix,
│       │   │       │                         # ExportPanel, SaveButton, StatementDrawer
│       │   │       └── lib/
│       │   │           ├── api.ts            # adminFetch wrapper + typed helpers
│       │   │           └── types.ts          # TypeScript interfaces mirroring backend models
│       │   └── tests/e2e/
│       │       └── user-journey.spec.ts      # Playwright E2E test
├── data/raw/
│   └── persuasion_dataset_Unified_EN-3_CLEANED.xlsx  # Source dataset
├── docker/
│   ├── docker-compose.yml                    # Local dev: postgres + api + web
│   ├── Dockerfile.api                        # Dev Dockerfile (pip, root, port 8000)
│   └── Dockerfile.web                        # Dev Dockerfile (missing NEXT_PUBLIC_API_URL arg)
├── k8s/                                      # OpenShift/Rahti manifests
│   ├── api-deployment.yaml
│   ├── api-service.yaml
│   ├── api-route.yaml
│   ├── web-deployment.yaml
│   ├── web-service.yaml
│   ├── web-route.yaml
│   └── secrets.yaml                          # Template with CHANGE_ME placeholders
├── scripts/
│   ├── import_dataset.py                     # CLI dataset importer (older alternative to src/seed.py)
│   └── validate_coverage.py                  # Coverage validation script
├── logs/                                     # Conversation log .txt files (gitignored)
├── .env / .env.example
├── .github/workflows/ci.yml
├── .gitignore
├── Makefile
├── run.sh                                    # Full bootstrap + start script
├── package.json                              # Monorepo root (npm workspaces)
├── railway.json / render.yaml                # Alternative deploy configs (not actively used)
├── DEPLOY.md                                 # Rahti deployment guide
├── PLAN.md / STACK.md / ADMIN-REDESIGN.md    # Planning docs
├── CHANGES.template.md / SPEC.template.md
├── changes.md
└── README.md
```

---

## 2. Key Files — What Each Does

| File | Status | Description |
|------|--------|-------------|
| `apps/api/src/main.py` | **Implemented** | FastAPI app with lifespan (DB init), CORS, 3 routers, 4 public endpoints (health, topics, session-rules, experiment-status) |
| `apps/api/src/config.py` | **Implemented** | Pydantic settings: reads `.env` from project root |
| `apps/api/src/database.py` | **Implemented** | Async SQLAlchemy engine, session maker, `init_db()` creates all tables |
| `apps/api/src/seed.py` | **Implemented** | Loads xlsx → `political_statements` table. Idempotent (ON CONFLICT DO NOTHING). Run via `uv run python -m src.seed` |
| `apps/api/scripts/seed_database.py` | **Implemented** | Seeds config tables (topics, prompts, experiment, LLM, terms). Idempotent (COUNT=0 guard). Run via `uv run python scripts/seed_database.py` |
| `apps/api/src/routers/admin.py` | **Implemented** | ~40 endpoints covering stats, chats, export, prompts, terms, LLM config, experiment config, topics, statements |
| `apps/api/src/routers/chats.py` | **Implemented** | Chat creation (with block assignment + few-shot caching), message exchange (LLM call), survey completion |
| `apps/api/src/routers/participants.py` | **Implemented** | Participant creation, session token lookup, public terms endpoint |
| `apps/api/src/services/prompt_builder.py` | **Implemented** | System prompt assembly with DB-backed persona overrides and hardcoded fallback |
| `apps/api/src/services/llm_client.py` | **Implemented** | Provider selection (DB config → env fallback), response generation with persona override |
| `apps/api/src/services/block_assignment.py` | **Implemented** | Stratified weighted-random block selection per participant |
| `apps/api/src/services/example_selector.py` | **Implemented** | Few-shot example selection from `political_statements` + conversational turn builder |
| `apps/api/src/services/encryption.py` | **Implemented** | Fernet encryption for stored API keys (PBKDF2 key derivation) |
| `apps/api/src/services/conversation_logger.py` | **Implemented** | Writes per-chat `.txt` log files to `logs/` directory |
| `apps/api/src/services/topic_coverage.py` | **Implemented** | Sparse-topic detection (threshold: 12 statements) |
| `apps/api/src/services/llm_models.py` | **Implemented** | Static model registry: OpenAI (GPT-5.4, GPT-4o, GPT-4.1, GPT-4 Turbo, GPT-3.5 Turbo), Anthropic (Claude Sonnet 4.5, Claude Opus 4.5, Claude Haiku 3.5) |
| `apps/web/src/app/[locale]/page.tsx` | **Implemented** | Consent page with maintenance mode, demographics, experiment status check |
| `apps/web/src/app/[locale]/chat/page.tsx` | **Implemented** | Topic selection grid + full chat interface with idle timeout and exchange limits |
| `apps/web/src/app/[locale]/survey/page.tsx` | **Implemented** | Post-chat survey (4 questions), thank-you screen |
| `apps/web/src/app/admin/page.tsx` | **Implemented** | Dashboard with metric cards and 4 chart visualizations |
| `apps/web/src/app/admin/conversations/page.tsx` | **Implemented** | Two-panel conversation browser with filters and pagination |
| `apps/web/src/app/admin/prompts/page.tsx` | **Implemented** | Live prompt editor with system prompt preview, reset to default |
| `apps/web/src/app/admin/data/page.tsx` | **Implemented** (with bug) | Export panel + coverage matrix + data validation. **Bug: reads wrong sessionStorage key** |
| `apps/web/src/app/admin/settings/page.tsx` | **Implemented** | 5-section config UI (experiment, topics, LLM, terms, prompts) |
| `scripts/import_dataset.py` | **Implemented** | Older CLI dataset importer with interactive prompts |
| `scripts/validate_coverage.py` | **Implemented** | Coverage validation script |
| `run.sh` | **Implemented** | Full bootstrap: env check, deps install, migrations, dataset import, server start |
| `Makefile` | **Implemented** | Local dev targets: run, install, dev, test, migrate, import-data, clean |
| `railway.json` / `render.yaml` | **Placeholder** | Alternative deploy configs, not actively used (Rahti is the target) |

---

## 3. Database Models

### 9 tables, 7 Alembic migrations

### `political_statements`
| Column | Type | Notes |
|--------|------|-------|
| `id` | Integer | PK, autoincrement |
| `external_id` | Integer | UNIQUE, indexed — maps to xlsx `id` column |
| `final_output_en` | Text | English statement text |
| `final_output_fi` | Text | Nullable — always NULL (Finnish translations not yet produced) |
| `intention_of_statement` | Text | |
| `topic_detailed` | String(255) | |
| `topic_category` | String(50) | Indexed. One of 9 values |
| `political_block` | String(50) | Indexed. One of: conservative, red-green, moderate, dissatisfied |

### `participants`
| Column | Type | Notes |
|--------|------|-------|
| `id` | String(36) | PK, UUID |
| `session_token` | String(64) | UNIQUE, indexed |
| `language` | String(2) | Default "en" |
| `age_group` | String(20) | Nullable |
| `gender` | String(20) | Nullable |
| `education` | String(50) | Nullable |
| `political_leaning` | Integer | Nullable, 1–5 scale |
| `political_knowledge` | Integer | Nullable, 1–5 scale |
| `consent_given` | Boolean | Default False |
| `consent_timestamp` | DateTime(tz) | Nullable |
| `created_at` | DateTime(tz) | |

Relationship: `chats` → list of Chat (cascade delete-orphan)

### `chats`
| Column | Type | Notes |
|--------|------|-------|
| `id` | String(36) | PK, UUID |
| `participant_id` | String(36) | FK → participants.id |
| `political_block` | String(50) | Never revealed to participant until survey completion |
| `topic_category` | String(50) | |
| `language` | String(2) | Default "en" |
| `perceived_leaning` | String(50) | Nullable — participant's guess from survey |
| `persuasiveness` | Integer | Nullable, 1–5 |
| `naturalness` | Integer | Nullable, 1–5 |
| `confidence` | Integer | Nullable, 1–5 |
| `is_complete` | Boolean | Default False |
| `is_test_mode` | Boolean | Default False — admin-created chats are True |
| `few_shot_examples` | JSON | Nullable — cached at chat creation (migration 007) |
| `created_at` | DateTime(tz) | |
| `completed_at` | DateTime(tz) | Nullable |

Relationships: `participant` (back-ref), `messages` (cascade, ordered by created_at)

### `messages`
| Column | Type | Notes |
|--------|------|-------|
| `id` | String(36) | PK, UUID |
| `chat_id` | String(36) | FK → chats.id |
| `role` | String(20) | "user" or "assistant" |
| `content` | Text | |
| `examples_used_ids` | JSON | Nullable — statement IDs used in prompt |
| `token_count` | Integer | Nullable — for cost tracking |
| `created_at` | DateTime(tz) | |

### `prompt_configs`
| Column | Type | Notes |
|--------|------|-------|
| `id` | String(36) | PK, UUID |
| `political_block` | String(50) | UNIQUE |
| `name_en` | String(100) | Display name |
| `name_fi` | String(100) | |
| `description_en` | Text | Persona text used by prompt builder |
| `description_fi` | Text | |
| `created_at` / `updated_at` | DateTime(tz) | |

### `terms_configs`
Singleton table. Bilingual title + content for the consent page.

### `llm_configs`
| Column | Type | Notes |
|--------|------|-------|
| `id` | String(36) | PK, UUID |
| `provider` | String(20) | UNIQUE — "openai" or "anthropic" |
| `display_name` | String(50) | |
| `encrypted_api_key` | Text | Nullable — Fernet-encrypted |
| `selected_model` | String(50) | Nullable |
| `is_active` | Boolean | Default False |
| `created_at` / `updated_at` | DateTime(tz) | |

### `experiment_configs`
Singleton table. Bilingual names, institution, PI info, ethics board, dates, session rules (`min_exchanges_before_survey`, `max_exchanges_per_chat`, `idle_timeout_minutes`), `is_active` toggle.

### `topic_configs`
| Column | Type | Notes |
|--------|------|-------|
| `id` | String(36) | PK, UUID |
| `topic_key` | String(50) | UNIQUE (e.g. "immigration") |
| `label_en` / `label_fi` | String(100) | |
| `welcome_message_en` / `welcome_message_fi` | Text | |
| `is_enabled` | Boolean | Default True |
| `display_order` | Integer | Default 0 |
| `created_at` / `updated_at` | DateTime(tz) | |

---

## 4. API Endpoints

### Public Endpoints (no auth)

| Method | Path | What It Does |
|--------|------|-------------|
| `GET` | `/api/health` | Returns `{"status": "healthy"}` |
| `GET` | `/api/topics` | Enabled topics with sparse-coverage warnings |
| `GET` | `/api/session-rules` | Min/max exchanges, idle timeout from ExperimentConfig |
| `GET` | `/api/experiment/status` | Active status, names, dates, institution for consent page |
| `POST` | `/api/participants` | Creates participant after consent (returns session_token + id) |
| `GET` | `/api/participants/{id}` | Participant details by UUID |
| `GET` | `/api/participants/by-token/{token}` | Participant details by session token |
| `GET` | `/api/participants/terms/{language}` | Consent text (en/fi), DB or default fallback |
| `POST` | `/api/chats` | Creates chat — assigns block, selects few-shot examples, caches them |
| `GET` | `/api/chats/{id}` | Chat metadata (no political_block) |
| `GET` | `/api/chats/{id}/messages` | All messages in order |
| `POST` | `/api/chats/{id}/messages` | Send message → LLM response (full prompt pipeline) |
| `PUT` | `/api/chats/{id}/complete` | Submit survey → reveals political_block + correct_guess |

### Admin Endpoints (require `X-Admin-Password` header)

| Method | Path | What It Does |
|--------|------|-------------|
| `GET` | `/api/admin/stats` | Aggregate stats (totals, by-block, by-topic, accuracy, avg ratings) |
| `GET` | `/api/admin/stats/detailed` | Block accuracy, persuasiveness heatmap, length distribution, coverage matrix |
| `GET` | `/api/admin/coverage` | Statement count matrix (topic × block) with sparse flags |
| `GET` | `/api/admin/chats` | Paginated, filterable chat list (includes political_block) |
| `GET` | `/api/admin/chats/{id}/detail` | Full chat: messages, survey, few-shot cache, participant demographics |
| `POST` | `/api/admin/chats` | Create test chat with explicit block (is_test_mode=True) |
| `GET` | `/api/admin/starters/{topic}` | Conversation starter questions per topic |
| `GET` | `/api/admin/statements` | Paginated political statement browser |
| `GET` | `/api/admin/export` | Export completed chats as CSV, JSON, or ZIP of transcripts |
| `GET` | `/api/admin/export/logs-info` | Count + size of on-disk log files |
| `GET` | `/api/admin/export/logs-zip` | Download all log files as ZIP |
| `GET` | `/api/admin/prompts` | Live persona text per block (DB override or hardcoded default) + system prompt preview |
| `PUT` | `/api/admin/prompts/{block}` | Update persona text (creates DB row if first edit) |
| `DELETE` | `/api/admin/prompts/{block}` | Reset to hardcoded default |
| `GET` | `/api/admin/terms` | Current terms config |
| `PUT` | `/api/admin/terms` | Update terms |
| `GET` | `/api/admin/llm/providers` | Static model registry |
| `GET` | `/api/admin/llm/configs` | All LLM configs with masked API key preview |
| `PUT` | `/api/admin/llm/configs/{provider}` | Update API key / selected model |
| `DELETE` | `/api/admin/llm/configs/{provider}/key` | Delete API key |
| `POST` | `/api/admin/llm/active` | Set active LLM provider |
| `GET` | `/api/admin/experiment` | Experiment config (singleton) |
| `PUT` | `/api/admin/experiment` | Partial update experiment config |
| `GET` | `/api/admin/topics` | All topics (including disabled) with sparse flags |
| `POST` | `/api/admin/topics` | Create new topic |
| `PUT` | `/api/admin/topics/{key}` | Partial update topic |
| `DELETE` | `/api/admin/topics/{key}` | Delete topic |
| `PUT` | `/api/admin/topics/reorder` | Batch reorder topics |

---

## 5. Political Dataset Pipeline

### Source → Database

```
data/raw/persuasion_dataset_Unified_EN-3_CLEANED.xlsx
    ↓
src/seed.py (or scripts/import_dataset.py)
    ↓
political_statements table (SQLite local / PostgreSQL production)
```

**`src/seed.py`** (preferred):
- Reads xlsx with pandas + openpyxl
- Maps columns: `id` → `external_id`, `final_output` → `final_output_en`
- Validates: non-empty text, block ∈ {conservative, red-green, moderate, dissatisfied}, topic ∈ 9 valid categories
- `INSERT ... ON CONFLICT (external_id) DO NOTHING` — fully idempotent
- `final_output_fi` is always NULL (Finnish translations not yet produced)
- Run: `cd apps/api && uv run python -m src.seed`

**`scripts/import_dataset.py`** (older alternative):
- CLI tool with `--file` and `--database-url` args
- Interactive prompt to clear existing data
- Less validation than `src/seed.py`

### Database → Prompt (runtime flow)

```
POST /api/chats (chat creation)
    ↓
example_selector.select_examples(db, block, topic, lang, n=5)
    → Queries political_statements: priority 1 = exact block+topic, priority 2 = same block any topic
    ↓
example_selector.build_few_shot_cache(statements, topic, lang)
    → Builds alternating user/assistant turn pairs from statements
    → Cached as JSON in chat.few_shot_examples
    ↓
POST /api/chats/{id}/messages (each message)
    ↓
llm_client.generate_response(db, chat, user_message)
    → Reads chat.few_shot_examples["turns"] (cached, no DB query)
    → Reads persona text from PromptConfig table (or hardcoded fallback)
    → prompt_builder.build_full_prompt() assembles:
        [system_prompt, few_shot_turns..., conversation_history..., current_message]
    → Sends to LLM provider
```

**The data lives in the database** (political_statements table). It is loaded from the xlsx file via a one-time seed operation. It is neither loaded from file at runtime nor hardcoded in the prompt builder. The few-shot examples are cached per chat session in the `chats.few_shot_examples` JSON column.

**Is the seeding script working?** Yes. Both `src/seed.py` and `scripts/seed_database.py` are functional and idempotent. The `run.sh` bootstrap script runs both automatically.

---

## 6. Prompt Templates

### System Prompt Structure

The system prompt is assembled by `prompt_builder.build_system_prompt()`:

**English template:**
```
You are a discussion partner in a conversation about {topic_label}.

Your perspective is defined by the following worldview. You naturally hold
these views — they are yours. Express them conversationally in your own
words. Never quote or reference examples directly. Never reveal you are
in a study or playing a role.

## Your Core Beliefs
{persona_text}

## Your Approach to Discussion
- You engage naturally with what the other person says
- You express your genuine views, agreeing or disagreeing based on your perspective
- You use personal experiences and concrete examples when relevant
- You keep responses conversational (2-4 sentences for simple exchanges, longer for substantive points)
- You never lecture or monologue — this is a dialogue
```

**Finnish template** (prepends `"Vastaa aina suomeksi."` and uses Finnish topic intro).

### Persona Text (per block)

The `{persona_text}` comes from either:
1. **Database** (`prompt_configs.description_en/fi`) — if a row exists for that block
2. **Hardcoded fallback** (`BLOCK_PERSONAS` dict in `prompt_builder.py`) — if no DB row exists

Example (conservative, English):
> You believe in personal responsibility, family values, and the importance of national identity. You think fiscal discipline and free market principles create the best outcomes for society. You value tradition and cultural heritage, and believe that immigration should be managed carefully to protect social cohesion and economic stability. You are skeptical of excessive government intervention and believe individuals and families, not the state, are best positioned to make decisions about their own lives. You support a strong national defense and pragmatic foreign policy that prioritizes national interests.

### Few-Shot Example Selection

`example_selector.select_examples(db, block, topic, language, n=5)`:
1. **Priority 1:** Exact block + exact topic match (up to n). If Finnish, further filters for non-null `final_output_fi`.
2. **Priority 2:** Same block, any other topic (fills remainder up to n).

`build_conversational_turns(statements, topic, language)`:
- For each statement, picks a random question from `TOPIC_QUESTIONS[topic]` (hardcoded question bank per topic)
- Outputs alternating `{"role": "user", "content": question}` and `{"role": "assistant", "content": statement_text}` dicts

### Full Message Array (sent to LLM)

```
[
  {"role": "system", "content": <assembled system prompt>},
  {"role": "user", "content": <synthetic question 1>},        # few-shot
  {"role": "assistant", "content": <statement text 1>},        # few-shot
  {"role": "user", "content": <synthetic question 2>},        # few-shot
  {"role": "assistant", "content": <statement text 2>},        # few-shot
  ... (up to 5 pairs)
  {"role": "user", "content": <real message 1>},               # history
  {"role": "assistant", "content": <real response 1>},         # history
  ...
  {"role": "user", "content": <current message>}               # latest
]
```

---

## 7. LLM Client

### Provider Selection

1. Check `llm_configs` table for an active provider with an encrypted API key → decrypt and use
2. Fall back to `OPENAI_API_KEY` environment variable
3. Raise `ValueError` if nothing configured

### Supported Providers

| Provider | Models | Default |
|----------|--------|---------|
| OpenAI | GPT-5.4 (recommended), GPT-4o, GPT-4.1, GPT-4 Turbo, GPT-3.5 Turbo | GPT-5.4 |
| Anthropic | Claude Sonnet 4.5 (recommended), Claude Opus 4.5, Claude Haiku 3.5 | Claude Sonnet 4.5 |

### Call Parameters

- `max_tokens`: 1024
- `temperature`: 0.1 (low for consistent responses)

### Caching

- Few-shot examples are cached per chat session in `chat.few_shot_examples` JSON column at creation time — no per-message DB queries for example selection
- No response caching

### Streaming

- `generate_response_streaming()` exists but is not wired to any HTTP endpoint — it's prepared for future use

### Error Handling

- Provider `generate()` methods propagate SDK exceptions (no retry logic)
- The chat message endpoint returns a generic 500 on LLM failure

### Known Issue

Both `OpenAIProvider.generate()` and `AnthropicProvider.generate()` are declared `async` but call the **synchronous** SDK clients directly, which blocks the event loop under concurrent load.

---

## 8. Political Block Assignment

`block_assignment.assign_political_block(db, participant_id)`:

1. Query all non-test chats for this participant → `seen_blocks`
2. Compute `unseen_blocks = {"conservative", "red-green", "moderate", "dissatisfied"} - seen_blocks`
3. **If unseen blocks remain:** Get global block counts (non-test chats). Compute inverse-frequency weights: `weight = (total - count) / total`. Under-represented blocks get higher probability. Select one via `random.choices(unseen_blocks, weights, k=1)`.
4. **If all 4 blocks seen:** Pick uniformly from globally least-assigned blocks.

**Effect:** Each participant's first 4 chats will each use a different block (in random weighted order). After that, blocks are reused with preference for globally under-represented ones.

---

## 9. Frontend Components

### Participant-Facing Pages

| Route | Component | Description |
|-------|-----------|-------------|
| `/{locale}` | ConsentPage | Experiment status check, consent form with 15 sections, optional demographics (age, gender, education, political leaning 1–5, political knowledge 1–5), "I Accept" button. Stores session in localStorage. |
| `/{locale}/chat` | ChatPage | Phase 1: topic selection grid (9 topics, per-topic color schemes). Phase 2: chat interface with sticky header, message bubbles, send button, "End Chat" gated by min exchanges. Idle timeout auto-redirects to survey. Max exchanges disables input. |
| `/{locale}/survey` | SurveyPage | 4 radio/rating questions. Wrapped in Suspense for useSearchParams. Shows thank-you on completion. Does **not** reveal whether the participant's guess was correct. |

### Admin Pages

| Route | Component | Description |
|-------|-----------|-------------|
| `/admin` | Dashboard | 6 metric cards + 4 visualizations (accuracy bar chart, persuasiveness heatmap, length histogram, coverage matrix) |
| `/admin/conversations` | ConversationBrowser | Two-panel: filterable paginated list (left) + full chat detail (right). Mobile responsive. |
| `/admin/prompts` | PromptEditor | Card per block: bilingual textareas, system prompt preview, save/reset. Changes take effect immediately. |
| `/admin/data` | DataExport | Coverage matrix (clickable cells open statement drawer), export panel (CSV/JSON/ZIP), data validation checklist. **Has a bug.** |
| `/admin/settings` | Settings | 5 sections: experiment config, topic management, LLM provider, terms of use, bot prompts. Each saves independently. |

### State Management

- **No global state library** — all pages use local `useState` + `useEffect`
- Admin auth: `sessionStorage.getItem('adminPassword')` read in each page's mount effect
- Participant session: `localStorage.getItem('participantId')` and `localStorage.getItem('sessionToken')`

### Shared Components

- `LanguageSelector` — EN/FI toggle using `usePathname()` + `router.push()`
- `topicColors.ts` — 10 color schemes (9 topics + default), each with 11 color properties

---

## 10. Deployment — Docker, k8s, Local

### Local Development

```bash
# Option 1: Full bootstrap
./run.sh

# Option 2: Manual
cd apps/api && uv sync && uv run alembic upgrade head && uv run python -m src.seed
cd ../.. && npm install
npm run dev  # starts API on :8000 + web on :3000
```

**Required:** `.env` with at least `OPENAI_API_KEY`. Defaults to SQLite.

### Docker Compose (local)

`docker/docker-compose.yml` — Postgres + API + Web. **Has issues:**
- `docker/Dockerfile.web` is missing `ARG NEXT_PUBLIC_API_URL` → frontend can't reach API
- `docker/Dockerfile.api` uses pip (not uv) and runs as root
- `NEXT_PUBLIC_API_URL` set as runtime env var (must be build-time for Next.js)

### Production — CSC Rahti (OpenShift)

`apps/api/Dockerfile` and `apps/web/Dockerfile` are production-ready:
- Non-root user (uid=1001)
- Port 8080
- `uv` for Python deps with frozen lockfile
- `NEXT_PUBLIC_API_URL` properly as build arg

`k8s/` manifests are complete and functional:
- Deployments, Services, Routes with TLS edge termination
- Secrets template with placeholders
- Liveness/readiness probes on API
- **Missing:** No migration Job or init container — `alembic upgrade head` must be run manually after deploy

**Target URLs:**
- Frontend: `https://web-bilingual-chatbot-experiment.2.rahtiapp.fi`
- API: `https://api-bilingual-chatbot-experiment.2.rahtiapp.fi`
- Database: External PostgreSQL on CSC Pukki (`193.166.25.147`)

### Unused

- `railway.json` and `render.yaml` exist but are not actively used

---

## 11. Admin Panel

**Yes, it exists and is fully functional** at `/admin`. Password: value of `ADMIN_PASSWORD` env var (default: `admin123`).

### Capabilities

| Tab | What You Can Do |
|-----|----------------|
| **Dashboard** | View participant count, chat count, completion rate, message count, detection accuracy, avg ratings. Charts: per-block accuracy, persuasiveness heatmap, conversation length distribution, dataset coverage matrix. |
| **Conversations** | Browse all chats with filters (block, topic, language, detection result, text search). View full conversation transcripts with messages, survey results, few-shot cache, and participant demographics. |
| **Prompts** | View and edit the persona text for each political block. See the assembled system prompt preview. Reset any block to its hardcoded default. Changes take effect on new messages immediately. |
| **Data & Export** | View dataset coverage matrix (click cells to browse individual statements). Export completed chats as CSV, JSON, or ZIP of transcripts with filters. Data validation checklist. |
| **Settings** | Configure experiment name/institution/dates/active status. Enable/disable topics, edit labels. Configure LLM provider (OpenAI/Anthropic), API keys, model selection. Edit consent terms. Edit bot prompt names/descriptions. |

---

## 12. Known Bugs and Incomplete Features

### Bugs

1. **`admin/data/page.tsx` — wrong sessionStorage key.** Reads `sessionStorage.getItem('admin_password')` (underscore) instead of `'adminPassword'` (camelCase). All API calls on this page silently get 401. The export and coverage matrix features are broken.

2. **`LanguageSelector.tsx` — uses `bg-primary-600`** which is not in the Tailwind color palette (the design tokens override `colors`). The active-state styling on the language toggle doesn't render.

3. **Root `layout.tsx` — `<html lang="en">` hardcoded.** Finnish users see incorrect HTML language attribute.

4. **Survey page doesn't show result.** The API returns `correct_guess` and `political_block` after survey submission, but the thank-you screen doesn't display this feedback to participants.

5. **LLM providers block the event loop.** Both `OpenAIProvider.generate()` and `AnthropicProvider.generate()` are `async` but call synchronous SDK methods directly. Under concurrent load this will block all other requests.

### Incomplete Features

6. **Finnish statement translations.** `political_statements.final_output_fi` is always NULL. Both seed scripts set it to None. The example selector filters for non-null Finnish text in Finnish sessions, meaning Finnish chats may get fewer or zero few-shot examples.

7. **Streaming responses.** `generate_response_streaming()` exists in the LLM client but is not wired to any HTTP endpoint.

8. **`docker/Dockerfile.web` — missing build arg.** The dev Docker setup for the web frontend won't work as-is.

9. **No migration Job in k8s.** Alembic migrations must be run manually after each deploy.

10. **Dual seeding with divergent data.** Migrations inline-seed `prompt_configs` and `llm_configs` with different values than `scripts/seed_database.py`. Whichever runs first wins.

11. **Dashboard "Avg Confidence" metric** is hardcoded to `"—"` — the basic stats endpoint doesn't return `avg_confidence`.

12. **`.env.example` is missing `ANTHROPIC_API_KEY` and `ENCRYPTION_SECRET`** which are required in production.

---

## 13. Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `DATABASE_URL` | Yes | `sqlite+aiosqlite:///./societal_discussion.db` | SQLAlchemy async URL. SQLite for dev, PostgreSQL for prod |
| `OPENAI_API_KEY` | Yes (if using OpenAI) | — | OpenAI API key. Used as fallback when no DB LLM config exists |
| `ADMIN_PASSWORD` | Yes | `admin` | Password for all `/api/admin/*` endpoints |
| `CORS_ORIGINS` | Yes | `http://localhost:3000` | Comma-separated allowed origins |
| `ENCRYPTION_SECRET` | Yes (prod) | — | Base secret for Fernet key derivation (API key encryption). Not in `.env.example` |
| `ANTHROPIC_API_KEY` | Optional | — | Anthropic API key (alternative to configuring via admin panel). Not in `.env.example` |
| `NEXT_PUBLIC_API_URL` | Yes (frontend) | `http://localhost:8000` | API base URL. Must be set at **build time** for production Docker images |
| `DEBUG` | Optional | `false` | Enables SQLAlchemy echo logging |

---

## 14. Finnish Language / i18n

### Status: Fully scaffolded and working for UI text. Not working for political statement content.

**What works:**
- `next-intl` integration is complete with locale routing (`/en/...`, `/fi/...`)
- Middleware auto-detects browser language and redirects
- Both `public/locales/en/common.json` and `fi/common.json` exist with identical key structures
- All participant-facing pages use `useTranslations()` for all visible text
- The consent form, chat interface, survey, and error messages are all bilingual
- The prompt builder adds `"Vastaa aina suomeksi."` prefix for Finnish sessions
- The admin panel is English-only (appropriate for researchers)

**What doesn't work:**
- `political_statements.final_output_fi` is always NULL — no Finnish political statements exist in the dataset
- The example selector filters for non-null Finnish text, so Finnish sessions will get fewer or zero few-shot examples
- The persona text in `BLOCK_PERSONAS` is identical for "en" and "fi" (English text in both)
- `<html lang="en">` is hardcoded in the root layout and never changes to `fi`

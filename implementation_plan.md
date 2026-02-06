# Societal Discussion Research Project: Implementation Plan

## Executive Summary

This document provides a comprehensive implementation plan for a **bilingual (English/Finnish)** research application studying AI persuasiveness.

### Framing Strategy

| Audience | Framing | What They See |
|----------|---------|---------------|
| **Participants** | "Discussion partner for societal topics" | Neutral AI that discusses current issues |
| **Researchers** | Persuasiveness study | Political block assignment, stance tracking, persuasion metrics |

> ⚠️ **Critical**: User-facing elements must NOT reveal the political orientation study. Participants should believe they're having a general discussion about societal topics, not interacting with a politically-aligned chatbot.

The system allows participants to engage in discussions about societal topics with AI agents (secretly assigned political orientations), then measures how persuasive the interaction was.

### Key Numbers
| Metric | Value |
|--------|-------|
| Dataset rows | 261 unique statements |
| Political blocks | 4 (conservative, red-green, moderate, dissatisfied) |
| Topic categories | 9 |
| Languages | 2 (English, Finnish) |
| Sparse topic | Healthcare (8 examples only) |

---

## Table of Contents

1. [Technology Stack](#1-technology-stack)
2. [Project Structure](#2-project-structure)
3. [Database Schema](#3-database-schema)
4. [API Endpoints](#4-api-endpoints)
5. [Few-Shot Prompt System](#5-few-shot-prompt-system)
6. [Frontend Architecture](#6-frontend-architecture)
7. [Internationalization](#7-internationalization-i18n)
8. [Data Pipeline](#8-data-pipeline)
9. [Testing Strategy](#9-testing-strategy)
10. [Deployment](#10-deployment)
11. [Timeline](#11-timeline-and-milestones)

---

## 1. Technology Stack

### Backend
| Component | Technology | Rationale |
|-----------|------------|-----------|
| Runtime | Python 3.12+ | Existing venv, excellent AI/data ecosystem |
| Framework | FastAPI | Async, automatic OpenAPI docs, type safety |
| Database | PostgreSQL (prod) / SQLite (dev) | SQL for structured data |
| ORM | SQLAlchemy 2.0+ | Async support, type hints |
| LLM | Claude API (claude-3-5-sonnet) | Few-shot prompting, bilingual |
| Validation | Pydantic v2 | FastAPI integration |

### Frontend
| Component | Technology | Rationale |
|-----------|------------|-----------|
| Framework | Next.js 14 (App Router) | SSR, API routes, TypeScript |
| Styling | Tailwind CSS + shadcn/ui | Clean, accessible components |
| State | Zustand + React Query | Lightweight, efficient |
| i18n | next-intl | Best for Next.js App Router |
| Testing | Vitest + Playwright | Unit and E2E |

---

## 2. Project Structure

```
societal-discussion/
├── apps/
│   ├── web/                          # Next.js frontend
│   │   ├── src/
│   │   │   ├── app/
│   │   │   │   ├── [locale]/         # i18n routing
│   │   │   │   │   ├── page.tsx      # Consent page
│   │   │   │   │   ├── chat/page.tsx
│   │   │   │   │   ├── survey/page.tsx
│   │   │   │   │   └── admin/page.tsx
│   │   │   ├── components/
│   │   │   │   ├── ui/               # shadcn components
│   │   │   │   ├── ConsentForm.tsx
│   │   │   │   ├── ChatWindow.tsx
│   │   │   │   ├── TopicSelector.tsx
│   │   │   │   └── SurveyForm.tsx
│   │   │   ├── hooks/
│   │   │   ├── stores/               # Zustand stores
│   │   │   └── i18n/
│   │   └── public/locales/           # EN/FI translations
│   │
│   └── api/                          # FastAPI backend
│       ├── src/
│       │   ├── main.py
│       │   ├── config.py
│       │   ├── database.py
│       │   ├── models/
│       │   │   ├── participant.py
│       │   │   ├── chat.py
│       │   │   └── message.py
│       │   ├── routers/
│       │   │   ├── participants.py
│       │   │   ├── chats.py
│       │   │   └── admin.py
│       │   ├── services/
│       │   │   ├── prompt_builder.py
│       │   │   ├── llm_client.py
│       │   │   ├── example_selector.py
│       │   │   └── block_assignment.py
│       │   └── prompts/              # Political block templates
│       └── alembic/                  # Migrations
│
├── data/
│   ├── raw/                          # Original dataset
│   └── exports/                      # Research exports
│
├── scripts/
│   ├── import_dataset.py
│   ├── validate_coverage.py
│   └── translate_statements.py
│
├── docker/
│   ├── Dockerfile.api
│   ├── Dockerfile.web
│   └── docker-compose.yml
│
└── docs/
```

---

## 3. Database Schema

### Entity Relationship

```
┌─────────────────────────┐       ┌─────────────────────────┐
│  POLITICAL_STATEMENTS   │       │     PARTICIPANTS        │
│─────────────────────────│       │─────────────────────────│
│ id (PK)                 │       │ id (PK, UUID)           │
│ external_id             │       │ session_token           │
│ final_output_en         │       │ language (en/fi)        │
│ final_output_fi         │       │ age_group               │
│ intention_of_statement  │       │ gender                  │
│ topic_detailed          │       │ education               │
│ topic_category          │       │ political_leaning (1-5) │
│ political_block         │       │ political_knowledge     │
└─────────────────────────┘       │ consent_given           │
                                  │ consent_timestamp       │
                                  └───────────┬─────────────┘
                                              │ 1:N
                                  ┌───────────▼─────────────┐
                                  │         CHATS           │
                                  │─────────────────────────│
                                  │ id (PK, UUID)           │
                                  │ participant_id (FK)     │
                                  │ political_block         │ ← Assigned
                                  │ topic_category          │
                                  │ language (en/fi)        │
                                  │ perceived_leaning       │ ← User guess
                                  │ persuasiveness (1-5)    │
                                  │ naturalness (1-5)       │
                                  │ confidence (1-5)        │
                                  │ is_complete             │
                                  │ is_test_mode            │
                                  └───────────┬─────────────┘
                                              │ 1:N
                                  ┌───────────▼─────────────┐
                                  │       MESSAGES          │
                                  │─────────────────────────│
                                  │ id (PK, UUID)           │
                                  │ chat_id (FK)            │
                                  │ role (user/assistant)   │
                                  │ content                 │
                                  │ examples_used_ids       │ ← JSON
                                  │ token_count             │
                                  └─────────────────────────┘
```

### Key Design Decisions

1. **Bilingual statements**: `final_output_en` and `final_output_fi` columns
2. **Language tracking**: Stored in both `participants` and `chats`
3. **Example tracking**: `examples_used_ids` logs which dataset rows were used
4. **Test mode flag**: `is_test_mode` separates researcher testing from real data

---

## 4. API Endpoints

### Public Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/participants` | Create participant with consent |
| `GET` | `/api/participants/{id}` | Get participant + chat history |
| `POST` | `/api/chats` | Start chat (assigns random block) |
| `POST` | `/api/chats/{id}/messages` | Send message, get AI response |
| `PUT` | `/api/chats/{id}/complete` | Submit survey responses |

### Admin Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/admin/stats` | Experiment statistics |
| `POST` | `/api/admin/chats` | Create chat with block override |
| `GET` | `/api/admin/starters/{topic}` | Conversation starters |
| `GET` | `/api/admin/coverage` | Dataset coverage matrix |
| `GET` | `/api/export/analysis` | Export to Excel |

### Critical Security Note

> ⚠️ **NEVER return `political_block` in the chat creation response to regular users.** This would allow participants to see their assignment before the survey, invalidating the research.

### Participant-Facing Language

All API responses and error messages shown to participants must use neutral framing:

| Internal Term | Participant-Facing Term |
|---------------|------------------------|
| political_block | (never exposed) |
| political chatbot | discussion partner / AI assistant |
| persuasiveness rating | "How convincing were the arguments?" |
| political leaning guess | "What perspective did the AI seem to have?" |
| topic_category | discussion topic |

---

## 5. Few-Shot Prompt System

### Prompt Template Structure

```
┌─────────────────────────────────────────────────────────────────────┐
│ SECTION 1: SYSTEM ROLE                                              │
│ "You are a political discussion partner participating in research"  │
└─────────────────────────────────────────────────────────────────────┘
                                    ↓
┌─────────────────────────────────────────────────────────────────────┐
│ SECTION 2: POLITICAL IDENTITY                                       │
│ Detailed description of values, rhetorical style, keywords          │
└─────────────────────────────────────────────────────────────────────┘
                                    ↓
┌─────────────────────────────────────────────────────────────────────┐
│ SECTION 3: FEW-SHOT EXAMPLES (3 from dataset)                       │
│ Topic + Intention + Statement (in user's language)                  │
└─────────────────────────────────────────────────────────────────────┘
                                    ↓
┌─────────────────────────────────────────────────────────────────────┐
│ SECTION 4: CONVERSATION CONTEXT                                     │
│ Topic, history, current message                                     │
└─────────────────────────────────────────────────────────────────────┘
                                    ↓
┌─────────────────────────────────────────────────────────────────────┐
│ SECTION 5: GENERATION INSTRUCTIONS                                  │
│ "Respond in {language}, be persuasive but respectful..."            │
└─────────────────────────────────────────────────────────────────────┘
```

### Example Selection Logic

```python
def select_examples(political_block, topic_category, language, n=3):
    # Priority 1: Exact match (same block + same topic)
    exact = db.query(statements).filter(
        block == political_block,
        topic == topic_category,
        language_column == language  # Use Finnish if available
    )

    if len(exact) >= n:
        return random.sample(exact, n)

    # Priority 2: Same block, different topic (fallback)
    same_block = db.query(statements).filter(
        block == political_block,
        topic != topic_category
    )

    return exact + random.sample(same_block, n - len(exact))
```

### Sparse Coverage Handling

The **healthcare** topic has only 8 examples total. The system should:
1. Show a warning badge on healthcare topic selection
2. Always use fallback to same-block examples when needed
3. Log when fallbacks are used for analysis

---

## 6. Frontend Architecture

### Page Flow

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   /[locale]/    │────▶│ /[locale]/chat  │────▶│ /[locale]/survey│
│   (Consent)     │     │ (Chat)          │     │ (Survey)        │
└─────────────────┘     └─────────────────┘     └─────────────────┘
        │                       │                       │
        │  Language selector    │  Topic selection      │  Experience rating
        │  Demographics         │  Chat interface       │  Likert scales
        │  Consent checkbox     │  End button           │  Continue options
        │                       │                       │
        ▼                       ▼                       ▼
   POST /participants      POST /chats            PUT /chats/:id/complete
                          POST /messages
```

### Component Hierarchy

**Chat Page:**
```
ChatPage
├── Header (LanguageSelector)
├── ProgressIndicator (Step 2 of 3)
├── TopicSelector (9 topics)
│   └── TopicWarningBadge (for healthcare)
└── ChatContainer
    ├── MessageList
    │   ├── MessageBubble (assistant - left, gray)
    │   ├── MessageBubble (user - right, blue)
    │   └── TypingIndicator
    ├── ChatInput
    └── EndChatButton (enabled after 3 messages)
```

### State Management

```typescript
// sessionStore.ts (Zustand)
interface SessionState {
  participantId: string | null;
  currentChatId: string | null;
  assignedBlock: PoliticalBlock | null;  // Hidden from UI
  selectedTopic: TopicCategory | null;
  isAdmin: boolean;
  blockOverride: PoliticalBlock | null;  // Admin only
}
```

---

## 7. Internationalization (i18n)

### URL-Based Routing

```
/en/           → English consent page
/fi/           → Finnish consent page
/en/chat       → English chat
/fi/chat       → Finnish chat
```

### Language Detection Flow

1. User arrives at `/`
2. `middleware.ts` detects browser language
3. Redirects to `/en` or `/fi` (default: `/en`)
4. Language stored in localStorage for return visits
5. All API calls include `language` parameter

### Translation Files

```
public/locales/
├── en/
│   ├── common.json      # Navigation, buttons
│   ├── consent.json     # Consent page text
│   ├── chat.json        # Chat interface
│   └── survey.json      # Survey questions
└── fi/
    ├── common.json
    ├── consent.json
    ├── chat.json
    └── survey.json
```

### Language Selector Component

Appears prominently at top of consent page:
```
┌───────────────────────────────────────────┐
│     Choose your language / Valitse kieli  │
│                                           │
│   [ 🇬🇧 English ]    [ 🇫🇮 Suomi ]        │
└───────────────────────────────────────────┘
```

---

## 8. Data Pipeline

### Dataset Import

```bash
# Import English statements (261 rows)
python scripts/import_dataset.py \
  --file data/raw/persuasion_dataset_Unified_EN-3_CLEANED.xlsx
```

### Bilingual Support

The UI is fully translated into Finnish. The dataset statements remain in English only - the AI will respond in the user's selected language regardless of the dataset language.

**UI translations location:**
```
apps/web/public/locales/
├── en/common.json    # English UI
└── fi/common.json    # Finnish UI
```

**Note:** The AI (Claude) generates responses in the user's chosen language using the few-shot examples as style/stance guidance, not direct translation.

### Coverage Validation

```bash
# Validate before launch
python scripts/validate_coverage.py

# Output:
# === Coverage Matrix ===
# Language: ALL
# Minimum required: 3 per cell
#
#                  conservative  dissatisfied  moderate  red-green
# economy                    11             9        10         10
# education                   4             8         9          6
# healthcare                  3             2         2          1  ← WARNING
# ...
#
# SPARSE COMBINATIONS (<3 examples):
#   - healthcare x dissatisfied: 2
#   - healthcare x moderate: 2
#   - healthcare x red-green: 1
```

---

## 9. Testing Strategy

### Test Coverage Targets

| Type | Coverage | Tools |
|------|----------|-------|
| Backend unit tests | 80%+ | pytest, pytest-asyncio |
| Frontend unit tests | 70%+ | Vitest, Testing Library |
| Integration tests | Critical paths | pytest + httpx |
| E2E tests | User journeys | Playwright |

### Critical Test Cases

1. **Complete user journey** (consent → chat → survey)
2. **Example selection with fallback** (healthcare topic)
3. **Bilingual functionality** (EN/FI switching)
4. **Random block assignment** (stratification)
5. **Admin override functionality**
6. **Data export integrity**

### E2E Test Example

```typescript
test('user completes full journey in Finnish', async ({ page }) => {
  await page.goto('/fi');

  // Consent
  await page.check('[name="consent_given"]');
  await page.click('button:has-text("Aloita keskustelu")');

  // Chat
  await page.click('button:has-text("Maahanmuutto")');
  await page.fill('input', 'Mitä mieltä olet pakolaispolitiikasta?');
  await page.click('button:has-text("Lähetä")');
  await expect(page.locator('.message-bubble.assistant')).toBeVisible();

  // Survey
  await page.click('button:has-text("Lopeta keskustelu")');
  await page.click('[name="perceived_leaning"][value="conservative"]');
  await page.click('button:has-text("Lähetä")');

  await expect(page.getByText('Kiitos')).toBeVisible();
});
```

---

## 10. Deployment

### Docker Configuration

```yaml
# docker-compose.yml
services:
  db:
    image: postgres:15-alpine
    environment:
      POSTGRES_DB: societal_discussion
    volumes:
      - postgres_data:/var/lib/postgresql/data

  api:
    build: ./docker/Dockerfile.api
    environment:
      DATABASE_URL: postgresql://...
      ANTHROPIC_API_KEY: ${ANTHROPIC_API_KEY}
    depends_on:
      - db

  web:
    build: ./docker/Dockerfile.web
    environment:
      NEXT_PUBLIC_API_URL: http://api:8000
    depends_on:
      - api
```

### Recommended Hosting

| Option | Pros | Cost |
|--------|------|------|
| **Railway** | Simple, good DX | ~$20-40/mo |
| **Render** | Free tier available | ~$15-30/mo |
| **Vercel + Railway** | Best Next.js hosting | ~$25-50/mo |

### Environment Variables

```bash
# .env.example
DATABASE_URL=postgresql://user:pass@host:5432/db
ANTHROPIC_API_KEY=sk-ant-xxx
ADMIN_PASSWORD=secure-password
CORS_ORIGINS=https://yourdomain.com
NEXT_PUBLIC_API_URL=https://api.yourdomain.com
```

---

## 11. Timeline and Milestones

### Phase 1: Foundation ✅
- [x] Set up monorepo structure
- [x] Initialize Next.js + FastAPI
- [x] Configure database + migrations
- [x] Docker Compose for local dev
- [x] CI/CD pipeline (GitHub Actions)
- [x] Import dataset script
- [x] Coverage validation script

### Phase 2: Core Features ✅
- [x] Consent page with demographics
- [x] Participant API endpoints
- [x] Chat interface UI
- [x] Chat API endpoints
- [x] Few-shot prompt builder
- [x] Claude API integration
- [x] Example selector with fallback
- [x] Survey page

### Phase 3: Polish ✅
- [x] Admin/testing mode UI
- [x] Agent override functionality
- [x] Data export endpoint
- [x] Error handling
- [ ] Logging and monitoring

### Phase 4: Testing ✅
- [x] Backend unit tests (46 tests passing)
- [x] E2E tests with Playwright (setup complete)
- [ ] Frontend unit tests
- [ ] Integration tests

### Phase 5: Deployment ✅
- [x] Docker configuration
- [x] Render blueprint (render.yaml)
- [x] Railway configuration
- [x] CI/CD with GitHub Actions
- [ ] Deploy to production (pending hosting setup)

### Phase 6: Finnish UI ✅
- [x] Finnish UI translations (all pages)
- [x] Language selector in UI
- [x] Bilingual admin panel
- Note: Dataset stays English-only; AI responds in user's language

### Phase 7: Pilot and Launch
- [ ] Pilot with 5-10 users
- [ ] Analyze pilot data
- [ ] Fix issues
- [ ] Official launch

---

## Quick Start Commands

```bash
# Setup
git clone <repo>
cd societal-discussion
cp .env.example .env       # Add ANTHROPIC_API_KEY
make install               # Install all dependencies

# Import data
make import-data           # Import 261 statements
make validate-coverage     # Check coverage matrix

# Start development
make dev                   # Starts API (8000) + Web (3000)

# Run tests
make test                  # All tests
make test-api              # Backend only (46 tests)
cd apps/web && npm run test:e2e  # E2E tests

# Access
# - App: http://localhost:3000/en (or /fi)
# - Admin: http://localhost:3000/en/admin
# - API Docs: http://localhost:8000/docs
```

---

## Known Issues and Mitigations

| Issue | Impact | Mitigation |
|-------|--------|------------|
| Healthcare sparse (8 examples) | Fallback needed often | Show warning badge; use same-block fallback |
| Finnish translations pending | RQ4 blocked | Start with English; add Finnish in Phase 6 |
| LLM response latency | UX impact | Typing indicator; consider streaming |
| Multiple chats per user | Learning effects | Track chat order; analyze separately |

---

*Last updated: January 28, 2026*
*Based on dataset: persuasion_dataset_Unified_EN-3_CLEANED.xlsx (261 rows)*

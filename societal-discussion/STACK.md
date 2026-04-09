# Stack Detection
language: python 3.12 (api) / typescript 5.3 (web)
framework: fastapi 0.128 (api) / next.js 14.1 app-router (web)
package_manager: uv with pyproject.toml (api) / npm (web)
test_runner: pytest 9 + pytest-asyncio (api) / vitest 1.2 (web)
e2e_runner: playwright 1.41 (web)
build_command: cd apps/api && uv run uvicorn src.main:app (api) / cd apps/web && npm run build (web)
dev_command: cd apps/api && uv run uvicorn src.main:app --reload / cd apps/web && npm run dev
preview_command: cd apps/web && npm run start
install_command: cd apps/api && uv sync / cd apps/web && npm install
migration_command: cd apps/api && uv run alembic upgrade head

## Monorepo layout
apps/api/   — FastAPI backend, SQLAlchemy async ORM, aiosqlite (dev) / asyncpg (prod)
apps/web/   — Next.js 14 App Router, Tailwind CSS 3.4, Recharts, TanStack Query 5

## Key version notes
- recharts: ResponsiveContainer + BarChart are the core components. Check https://recharts.org/en-US/api for current API.
- next.js 14 App Router: server components by default; admin pages must be 'use client' because they use sessionStorage and useState. layout.tsx in app/admin/ applies to all child routes.
- fastapi: Pydantic v2 is the only supported version; all Pydantic models must use ConfigDict.
- pytest-asyncio: asyncio_mode = "auto" is set in pyproject.toml.

## Existing admin endpoints (do not duplicate)
GET  /api/admin/stats          — basic stats
GET  /api/admin/coverage       — block x topic statement counts matrix
GET  /api/admin/export         — CSV or JSON, no filters
GET/PUT for prompts, experiment_config, topics_config, llm_config, terms_config

## New endpoints to add (admin redesign)
GET  /api/admin/chats                  — paginated filtered chat list
GET  /api/admin/chats/{chat_id}/detail — full chat detail with messages + few-shot + participant
GET  /api/admin/stats/detailed         — extended stats for dashboard charts
GET  /api/admin/export (upgraded)      — add filters + text/zip format
GET  /api/admin/statements             — paginated statement browser

## Important data model notes
- Chat.correct_guess is NOT a database column — compute as (perceived_leaning == political_block)
- Chat.few_shot_examples: JSON column, nullable. Shape: { "turns": [...], "example_ids": [...], "examples": [...] }
- Chat.confidence: Integer column (1-5), nullable
- PoliticalStatement.external_id: Integer, unique
- All timestamps use DateTime(timezone=True)

## Documentation URLs
framework_docs_api:       https://fastapi.tiangolo.com/
framework_docs_web:       https://nextjs.org/docs/app
sqlalchemy_async_docs:    https://docs.sqlalchemy.org/en/20/orm/extensions/asyncio.html
recharts_docs:            https://recharts.org/en-US/api
tailwind_docs:            https://tailwindcss.com/docs
tanstack_query_docs:      https://tanstack.com/query/v5/docs/framework/react/overview
pytest_docs:              https://docs.pytest.org/en/stable/
vitest_docs:              https://vitest.dev/guide/
playwright_docs:          https://playwright.dev/docs/intro
pydantic_v2_docs:         https://docs.pydantic.dev/latest/

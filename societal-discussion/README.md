# manipulative-ai2

A research chatbot experiment from Tampere University. Finnish-speaking participants chat with an LLM about politics; the bot is secretly aligned with one of nine Finnish political parties (or a tenth populism-augmented variant), grounded in the party's actual program documents from Pohtiva. The research question: can participants detect that the bot is aligned with a specific party?

Bilingual Finnish/English. See [`METHODS.md`](METHODS.md) for the methodology.

## Tech Stack

- **Backend**: FastAPI + SQLAlchemy + PostgreSQL
- **Frontend**: Next.js 14 + TypeScript + Tailwind CSS
- **AI**: Claude API (Anthropic) with few-shot prompting
- **Internationalization**: next-intl (English/Finnish)

## Quick Start

### Prerequisites

- [uv](https://docs.astral.sh/uv/) (Python package manager)
- Node.js 20+
- An [Anthropic API key](https://console.anthropic.com)

### Run Everything with One Command

```bash
cd societal-discussion

# First run: creates .env, installs deps, imports data, starts servers
./run.sh
```

On first run, it will create `.env` and ask you to add your `ANTHROPIC_API_KEY`. Edit the file and run again.

### What You Get

| URL | Purpose |
|-----|---------|
| http://localhost:3000 | Participant UI |
| http://localhost:3000/en/admin | Admin Panel |
| http://localhost:8000/docs | API Docs |

### Other Commands

```bash
make run      # Same as ./run.sh
make dev      # Just start servers (skip install)
make test     # Run tests
make clean    # Remove all generated files
```

## Project Structure

```
societal-discussion/
├── apps/
│   ├── api/                    # FastAPI backend
│   │   ├── src/
│   │   │   ├── models/         # SQLAlchemy models
│   │   │   ├── routers/        # API endpoints
│   │   │   └── services/       # Business logic
│   │   └── tests/
│   └── web/                    # Next.js frontend
│       ├── src/
│       │   ├── app/[locale]/   # Pages (consent, chat, survey, admin)
│       │   └── components/
│       └── public/locales/     # Translations (en/fi)
├── data/
│   └── raw/                    # Dataset files
├── scripts/                    # Data import/validation
└── docker/                     # Docker configuration
```

## API Endpoints

### Public
- `POST /api/participants` - Create participant (with consent)
- `POST /api/chats` - Start chat (assigns random political block)
- `POST /api/chats/{id}/messages` - Send message, get AI response
- `PUT /api/chats/{id}/complete` - Submit survey

### Admin (requires X-Admin-Password header)
- `GET /api/admin/stats` - Experiment statistics
- `GET /api/admin/coverage` - Dataset coverage matrix
- `POST /api/admin/chats` - Create chat with specific block (test mode)
- `GET /api/admin/export` - Export research data (CSV/JSON)

## Dataset

The system uses a curated dataset of 261 political statements across:
- **4 Political Blocks**: conservative, red-green, moderate, dissatisfied
- **9 Topic Categories**: immigration, healthcare, economy, education, foreign_policy, environment, technology, equality, social_welfare

### Coverage Notes
- Healthcare and equality × conservative have sparse coverage (<3 examples)
- The system automatically falls back to same-block examples from other topics

## Deployment

### Docker

```bash
# Build and start
docker-compose -f docker/docker-compose.yml up -d

# Import data (run once)
docker-compose exec api python scripts/import_dataset.py --file data/raw/persuasion_dataset_Unified_EN-3_CLEANED.xlsx
```

### Render

1. Connect your repository to Render
2. It will automatically detect `render.yaml`
3. Set environment variables:
   - `ANTHROPIC_API_KEY`: Your Anthropic API key
   - `ADMIN_PASSWORD`: Admin panel password

### Railway

1. Connect your repository to Railway
2. Add PostgreSQL service
3. Set environment variables in the dashboard

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `DATABASE_URL` | PostgreSQL connection string | Yes |
| `ANTHROPIC_API_KEY` | Claude API key | Yes |
| `ADMIN_PASSWORD` | Admin panel password | Yes |
| `CORS_ORIGINS` | Allowed origins (comma-separated) | Yes |
| `NEXT_PUBLIC_API_URL` | Backend URL for frontend | Yes |

## Research Ethics

This project is designed for legitimate research purposes:
- Participants give informed consent before participating
- The political orientation is only revealed after survey completion
- All data is anonymized
- Test mode chats are excluded from analysis

## License

[Your License Here]

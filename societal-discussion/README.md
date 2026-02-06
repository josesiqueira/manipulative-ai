# Societal Discussion Research Project

A bilingual (English/Finnish) research application for studying AI persuasiveness in societal discussions.

## Overview

This application allows participants to engage in conversations about societal topics with AI agents. Each agent is secretly assigned a political orientation, and the system measures:

- Whether participants can detect the AI's political leaning
- How persuasive the AI's arguments were perceived
- How natural the conversation felt

**Important**: The political orientation is hidden from participants until after they complete the survey.

## Tech Stack

- **Backend**: FastAPI + SQLAlchemy + PostgreSQL
- **Frontend**: Next.js 14 + TypeScript + Tailwind CSS
- **AI**: Claude API (Anthropic) with few-shot prompting
- **Internationalization**: next-intl (English/Finnish)

## Quick Start

### Prerequisites

- Python 3.12+
- Node.js 20+
- PostgreSQL (or SQLite for development)

### Local Development

1. **Clone and setup**
   ```bash
   git clone <repository-url>
   cd societal-discussion
   ```

2. **Configure environment**
   ```bash
   cp .env.example .env
   # Edit .env and add your ANTHROPIC_API_KEY
   ```

3. **Install dependencies**
   ```bash
   # Backend
   cd apps/api
   pip install -e ".[dev]"

   # Frontend
   cd ../web
   npm install
   ```

4. **Import dataset**
   ```bash
   cd ../..
   python scripts/import_dataset.py --file data/raw/persuasion_dataset_Unified_EN-3_CLEANED.xlsx
   python scripts/validate_coverage.py
   ```

5. **Start development servers**
   ```bash
   # Terminal 1: Backend
   cd apps/api
   uvicorn src.main:app --reload --port 8000

   # Terminal 2: Frontend
   cd apps/web
   npm run dev
   ```

6. **Access the application**
   - Participant UI: http://localhost:3000/en
   - Admin Panel: http://localhost:3000/en/admin
   - API Docs: http://localhost:8000/docs

### Using Make

```bash
make install        # Install all dependencies
make dev            # Start both servers
make test           # Run all tests
make import-data    # Import dataset
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

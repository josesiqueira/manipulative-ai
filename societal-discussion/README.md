# manipulative-ai2

A research chatbot experiment from Tampere University. Finnish-speaking participants chat with an LLM about politics; the bot is secretly aligned with one of nine Finnish political parties (or a tenth populism-augmented variant), grounded in the party's actual program documents from Pohtiva. The research question: can participants detect that the bot is aligned with a specific party?

Bilingual Finnish/English. See [`METHODS.md`](METHODS.md) for the full methodology, and the [repo-root README](../README.md) for project overview + release notes.

## Tech stack

- **Backend** — FastAPI + SQLAlchemy 2.0 (async) + Alembic, Python 3.12
- **Database** — SQLite on a Persistent Volume in production; same file locally
- **Frontend** — Next.js 14 (App Router) + TypeScript + Tailwind CSS
- **LLM** — OpenAI GPT-5.4 (temperature 0.1, ~1M context window for full-corpus injection). Anthropic provider wired in but unused.
- **Internationalization** — custom `apps/web/src/lib/translations.ts` (Finnish + English), no i18n routing library
- **Deployment** — CSC Rahti (OpenShift); Docker images + manifests in `docker/` and `k8s/`

The bot is grounded by **injecting the entire party-program text** into the system prompt at every request — Cache-Augmented Generation (CAG), no RAG, no few-shot.

## Quick start (local development)

### Prerequisites
- [uv](https://docs.astral.sh/uv/) (Python package manager)
- Node.js 20+
- An [OpenAI API key](https://platform.openai.com)

### Run everything with one command

```bash
./run.sh
```

On the first run, it creates `.env` from `.env.example` and asks you to set `OPENAI_API_KEY`. Edit `.env`, re-run, and both servers come up.

### What you get

| URL | Purpose |
|---|---|
| http://localhost:3000 | Participant UI (landing + chat + survey) |
| http://localhost:3000/admin | Admin panel (password from `.env`, defaults to `admin123` for local dev) |
| http://localhost:8000/docs | FastAPI Swagger docs |
| http://localhost:8000/api/health | Healthcheck |

### Other commands

```bash
make run      # same as ./run.sh
make dev      # start servers (assumes deps already installed)
make test     # run pytest in apps/api/tests
make clean    # remove generated files
```

## Project structure

```
societal-discussion/
├── apps/
│   ├── api/                     # FastAPI backend
│   │   ├── src/
│   │   │   ├── models/          # SQLAlchemy models (session, conversation, message, survey, llm_config, …)
│   │   │   ├── routers/         # HTTP endpoints (sessions, conversations, survey, admin)
│   │   │   ├── services/        # party_grounding, prompt_builder, llm_client, party_assignment, encryption
│   │   │   ├── party_data/      # the 9 party .txt files used at runtime
│   │   │   └── config.py        # Pydantic settings (env-driven)
│   │   ├── alembic/             # migrations
│   │   └── tests/
│   └── web/                     # Next.js frontend
│       └── src/
│           ├── app/             # pages — landing, chat, survey-entry, survey, thank-you, admin/*
│           └── lib/             # bilingual translations + hooks
├── docker/                      # Dockerfile.api, Dockerfile.web, docker-compose.yml
├── k8s/                         # OpenShift manifests (api/web Deployment, Service, Route, PVC)
└── METHODS.md                   # research methodology reference (paper-ready prose)
```

## API endpoints

### Public (participant-facing)
- `POST /api/sessions` — create a participant session
- `POST /api/conversations` — start a conversation (party is assigned server-side; never returned in response)
- `POST /api/conversations/{id}/messages` — send a message, get the bot's reply
- `PUT /api/conversations/{id}/end` — mark a conversation complete
- `POST /api/survey` — submit the post-conversation survey
- `GET /api/health` — health check

### Admin (require `X-Admin-Password` header)
- `GET /api/admin/stats` — dashboard stats (today vs yesterday, completion %, flagged count, FI/EN split, saved test runs, etc.)
- `GET /api/admin/stats/daily?days=7` — per-day per-party breakdown
- `GET /api/admin/conversations` — paginated, filterable conversation list
- `GET /api/admin/conversations/{id}/detail` — full conversation with messages
- `PATCH /api/admin/conversations/{id}/flag` — flag a conversation for review
- `POST /api/admin/conversations/{id}/save-test` — promote a try-bot conversation from ephemeral to saved
- `DELETE /api/admin/conversations/{id}` — delete a test conversation
- `GET /api/admin/export?format=csv|json|zip|messages-csv|messages-json` — bulk export
- `GET /api/admin/export/surveys?format=csv|json` — survey-response export
- `GET|PUT|DELETE /api/admin/prompts/{party}` — edit / restore per-party system prompts
- `DELETE /api/admin/data/reset` — wipe all conversation data (preserves prompts, LLM config, experiment settings)
- `GET|POST|PUT /api/admin/llm/configs` — LLM provider/key management

## Environment variables

| Variable | Description | Required |
|---|---|---|
| `DATABASE_URL` | SQLAlchemy URL (defaults to local SQLite) | No |
| `OPENAI_API_KEY` | OpenAI API key | Yes |
| `ANTHROPIC_API_KEY` | Optional, for future use | No |
| `ADMIN_PASSWORD` | Admin panel password | Yes |
| `ENCRYPTION_SECRET` | Fernet key for encrypting admin-stored API keys at rest | Yes |
| `CORS_ORIGINS` | Comma-separated allowed origins | Yes |
| `NEXT_PUBLIC_API_URL` | Public API URL the frontend bundle calls | Yes |
| `PARTICIPANT_PASSWORD` | Currently unused (access gate disabled for HEPP demo) | No |
| `FORCED_PARTY` | If set, pin every conversation to the listed party (or comma-separated list of parties for uniform random pick) | No |

## Deployment

The live deploy is on **CSC Rahti** (OpenShift). Manifests are in `k8s/`:

| File | Resource |
|---|---|
| `api-deployment.yaml` | API Deployment (uses the `Recreate` strategy because of the RWO PVC) |
| `api-service.yaml`, `api-route.yaml` | Service + Route for the API |
| `web-deployment.yaml`, `web-service.yaml`, `web-route.yaml` | Same for the frontend |
| `sqlite-pvc.yaml` | 1 Gi PersistentVolumeClaim mounted at `/data` in the API pod |

Build, push, and roll:

```bash
# from the repo root, after `oc login`
cd societal-discussion

# build
docker build --platform linux/amd64 -f docker/Dockerfile.api \
  -t image-registry.apps.2.rahti.csc.fi/manipulative-ai-2/api:latest .
docker build --platform linux/amd64 -f docker/Dockerfile.web \
  --build-arg NEXT_PUBLIC_API_URL=https://api-vaalikeskustelu.2.rahtiapp.fi \
  -t image-registry.apps.2.rahti.csc.fi/manipulative-ai-2/web:latest .

# push (requires docker login against the Rahti registry)
docker push image-registry.apps.2.rahti.csc.fi/manipulative-ai-2/api:latest
docker push image-registry.apps.2.rahti.csc.fi/manipulative-ai-2/web:latest

# roll
oc apply -f k8s/
oc rollout restart deploy/api deploy/web -n manipulative-ai-2
```

`k8s/secrets.yaml` is **not** committed; secrets are created via `oc create secret generic app-secrets --from-literal=…` directly in the cluster.

## Research ethics

- Participants are recruited externally; consent is obtained before they receive the URL.
- The bot's party alignment is not revealed before or during the conversation.
- Conversations are pseudonymous (random session UUIDs; no demographics in-app).
- Test-mode conversations created via the admin Try-bot are excluded from research data.
- See `METHODS.md` for the full methodological framing.

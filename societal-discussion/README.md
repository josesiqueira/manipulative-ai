# manipulative-ai2

A research chatbot experiment from Tampere University. Participants chat
with a language model about politics; the bot is aligned, without saying
so, with one of nine Finnish political parties in a populist or an
anti-populist variant (18 conditions), grounded in the party's own programme
documents from Pohtiva. The research question: can participants detect that
the bot is aligned with a specific party, and do they notice the populist or
anti-populist framing?

Bilingual Finnish/English. See [`METHODS.md`](METHODS.md) for the
methodology and the [repository README](../README.md) for the overview and
the releases.

## The three applications

| App | Folder | Serves | Port (local) |
|---|---|---|---|
| API | `apps/api` | FastAPI: sessions and consent, conversations, messages, survey, debrief and data deletion, speech, admin | 8000 |
| Participant app | `apps/participant` | Astro: landing, consent, notices, chat with the talking avatar and speech, survey, thank-you with debrief; the public URL | 4321 |
| Admin app | `apps/web` | Next.js: the admin panel (`/admin`): conversations, prompts per condition, exports, model settings | 3000 |

The participant pages of the Next.js app (landing, chat, survey) are the
HEPP2026 version and are no longer the public flow; the Astro app replaced
them for the Metso demo.

## Tech stack

- **API**: FastAPI, SQLAlchemy 2.0 (async), Alembic, Python 3.11 in the
  container (3.12 locally works), uv for dependencies; SQLite on a
  persistent volume in production, the same file locally.
- **Speech**: `POST /api/speech/transcribe` and `/synthesize` with two
  engine tiers: remote OpenAI-compatible servers (`SPEECH_STT_URL`,
  `SPEECH_TTS_URL`) or local engines inside the API image (faster-whisper
  small, Piper voices `fi_FI-harri-medium` and `en_GB-alan-medium`), see
  `apps/api/src/services/speech/`.
- **Participant app**: Astro 7 with the Node adapter (standalone server),
  TypeScript strict, Tailwind CSS 4, three.js and TalkingHead (vendored,
  MIT) for the avatar; Playwright tests. Details in
  [`apps/participant/README.md`](apps/participant/README.md).
- **Admin app**: Next.js 14 (App Router), TypeScript, Tailwind CSS, vitest.
- **Language model**: OpenAI GPT-6 Astra by default (GPT-5.4 for
  HEPP2026); the admin panel can select another model. The model that
  answered is stored on every assistant message.
- **Deployment**: CSC Rahti (OpenShift); one image per app; manifests in
  `k8s/`.

The bot is grounded by placing the entire party programme text into the
system prompt at every request (no retrieval, no few-shot).

## Quick start (local development)

Prerequisites: [uv](https://docs.astral.sh/uv/), Node.js 22, an OpenAI API
key (or another OpenAI-compatible endpoint).

```bash
./run.sh                    # first run creates .env from .env.example; set OPENAI_API_KEY
                            # then starts the API on :8000 and the admin app on :3000
PUBLIC_API_URL= npm run dev:participant   # participant app on :4321; the empty value makes the dev
                                          # server proxy /api to :8000 (unset, the browser calls
                                          # http://localhost:8000 directly, which needs that origin
                                          # in CORS_ORIGINS; .env.example lists only :3000)
```

| URL | Purpose |
|---|---|
| http://localhost:4321 | Participant app (landing, consent, chat, survey, debrief) |
| http://localhost:3000/admin | Admin panel (password from `.env`) |
| http://localhost:8000/docs | FastAPI documentation |
| http://localhost:8000/api/health | Health check |

The speech endpoints need the local models once:
`cd apps/api && uv run python scripts/fetch_speech_models.py models` (about
0.6 GB as measured at the image build; pinned revisions, the Piper files
with checksums), with `SPEECH_MODELS_DIR` pointing at that folder; or set
`SPEECH_STT_URL` and `SPEECH_TTS_URL` to running speech servers.

Gates:

```bash
cd apps/api && uv run pytest                 # backend tests (SPEECH_LOCAL_TESTS=1 adds the engine tests)
cd apps/participant && npm run check && npm test   # astro check, Playwright (fake API, three projects)
cd apps/participant && REAL_API=1 ADMIN_PASSWORD=... npx playwright test tests/real-flow.spec.ts --project=desktop
                                             # the whole flow against a running API, no fakes (see the file)
cd apps/web && npm run build && npx vitest run    # admin app
```

To test the chat page on a phone from a laptop (the microphone needs
HTTPS), see "Phone test from a laptop" in `apps/participant/README.md`.

## Project structure

```
societal-discussion/
├── apps/
│   ├── api/                       FastAPI backend
│   │   ├── src/
│   │   │   ├── models/            SQLAlchemy models (session, conversation, message, survey, llm_config, ...)
│   │   │   ├── routers/           sessions, conversations, survey, speech, admin
│   │   │   ├── services/          party_grounding (18 conditions), prompt_builder, party_assignment,
│   │   │   │                      session_code, speech/ (engines, alignment), llm_client, llm_providers/
│   │   │   ├── party_data/        the 9 party programme .txt files used at runtime
│   │   │   └── config.py          Pydantic settings (environment)
│   │   ├── alembic/               migrations (001 to 006)
│   │   ├── scripts/               fetch_speech_models.py (image build)
│   │   ├── Dockerfile, start.sh   the Rahti image: migrations then uvicorn
│   │   └── tests/
│   ├── participant/               Astro participant app (see its README)
│   └── web/                       Next.js admin app
├── docker/                        HEPP2026-era Dockerfiles and compose file, superseded by apps/api/Dockerfile
│                                  and apps/participant/Dockerfile (Dockerfile.web still builds the admin app)
├── k8s/                           OpenShift manifests (api, participant app, admin app, PVC)
├── METHODS.md                     research methodology reference
└── package.json                   npm workspaces: apps/web and apps/participant (one lock file here)
```

## API endpoints

### Participant-facing

- `POST /api/sessions`: create a session on consent; body `consent_version`, `age_confirmed`, `language`; 400 unless `age_confirmed` is true. Without a body (the admin Try-bot) the session has no consent.
- `GET /api/sessions/{id}`: the session (used by the landing page to decide between a new conversation and the consent page).
- `GET /api/sessions/{id}/debrief`: the party and the framing per conversation, the session code and the deleted state; 403 until a survey row exists (a deleted session still answers, marked deleted). The only participant endpoint that reveals the condition.
- `DELETE /api/sessions/{id}/data`: delete my data; removes messages and survey rows, keeps the conversation rows as a tombstone with `data_deleted_at`; a repeated call answers 204 and keeps the first deletion time.
- `POST /api/conversations`: start a conversation; the condition is assigned server side and never returned; 403 without consent (non-test sessions) and 403 for a deleted session.
- `POST /api/conversations/{id}/messages`: send a message (`content`, `input_mode` typed or spoken), get the reply; the reply row stores the model name.
- `PUT /api/conversations/{id}/end`: mark a conversation complete.
- `POST /api/survey`: submit the survey (`session_id`, `responses`).
- `POST /api/speech/transcribe?conversation_id=&language=`: the recording as the raw body (webm/opus or mp4; 2 MB cap, and 60 s of audio in the local tier); returns `{text}`. Needs an open conversation.
- `POST /api/speech/synthesize`: `{conversation_id, text, language}`; returns WAV audio (base64), sample rate, words, start times and durations.
- `GET /api/health`.

### Admin (require the `X-Admin-Password` header)

- `GET /api/admin/stats`, `GET /api/admin/stats/daily?days=7`
- `GET /api/admin/conversations` (paginated, filterable), `GET /api/admin/conversations/{id}/detail`, `PATCH .../flag`, `POST .../save-test`, `DELETE /api/admin/conversations/{id}` (test conversations)
- `GET /api/admin/sessions`, `GET /api/admin/sessions/by-code/{code}` (the code from the thank-you page)
- `GET /api/admin/export?format=csv|json|text|messages-csv|messages-json`: the conversation export (one row per conversation: session code, consent fields, `data_deleted_at`; `text` is a ZIP of transcripts) and the message export (one row per message: `session_id`, `input_mode`, `model_name`)
- `GET /api/admin/export/surveys?format=csv|json`
- `GET /api/admin/prompts` (all 18 conditions), `PUT|DELETE /api/admin/prompts/{condition}`: the system instruction per condition
- `GET /api/admin/llm/providers`, `GET /api/admin/llm/configs`, `PUT /api/admin/llm/configs/{provider}`, `POST /api/admin/llm/active`: model provider settings
- `GET|PUT /api/admin/experiment`
- `DELETE /api/admin/data/reset`: wipe all conversation data (keeps prompts, model settings, experiment settings)
- `GET /api/admin/export/logs-info`, `GET /api/admin/export/logs-zip`

## Environment variables

API (`apps/api/src/config.py`; local values in `.env` at this folder's root):

| Variable | Description | Required |
|---|---|---|
| `DATABASE_URL` | SQLAlchemy URL (defaults to local SQLite) | No |
| `OPENAI_API_KEY` | OpenAI API key | Yes for OpenAI |
| `ADMIN_PASSWORD` | Admin password (header `X-Admin-Password`) | Yes |
| `ENCRYPTION_SECRET` | Fernet key for the API keys stored by the admin panel | Yes |
| `CORS_ORIGINS` | Comma-separated allowed origins (the defaults include the local ports 3000, 4321, 8080) | Yes in production |
| `FORCED_PARTY` | Pin every conversation to one condition, or a uniform pick from a comma-separated list; empty for the study | No |
| `SPEECH_STT_URL`, `SPEECH_STT_MODEL` | Remote recognition server (OpenAI-compatible `/v1/audio/transcriptions`) and model name | No (local engine otherwise) |
| `SPEECH_TTS_URL`, `SPEECH_TTS_MODEL`, `SPEECH_TTS_VOICE`, `SPEECH_TTS_SEND_LANGUAGE` | Remote voice server (`/v1/audio/speech`), model, voice, whether to send a language field | No (local engine otherwise) |
| `SPEECH_API_KEY` | Bearer token for the remote speech servers | No |
| `SPEECH_MODELS_DIR` | Folder with the Piper voices and the whisper model (`/app/models` in the image) | For the local engines |
| `SPEECH_LOCAL_WHISPER_MODEL`, `SPEECH_LOCAL_WHISPER_COMPUTE` | Local whisper size and compute type (defaults `small`, `int8`) | No |
| `SPEECH_MAX_UPLOAD_BYTES`, `SPEECH_MAX_TEXT_CHARS` | Caps on a recording (2 MB) and on one sentence to speak (600) | No |
| `PARTICIPANT_PASSWORD` | Unused since the consent gate replaced the access-code gate | No |

Participant app (build time, inlined by `astro build`): `PUBLIC_API_URL`
(the API origin the browser calls; unset means `http://localhost:8000`; an
explicit empty value means the app's own origin, which in development is
the dev server's proxy) and `PUBLIC_PROVIDER_BLOCK` (`finnish`, the
default, or `openai`: which provider texts and how many consent
checkboxes). Admin app (build time): `NEXT_PUBLIC_API_URL`.

## Deployment

The live deploy is on CSC Rahti (OpenShift), project `manipulative-ai-2`.
Manifests in `k8s/`:

| File | Resource |
|---|---|
| `api-deployment.yaml` | API Deployment (`FORCED_PARTY` empty; `Recreate` strategy because the volume is RWO; speech runs in this container, so it has 1 to 3 GiB of memory) |
| `api-service.yaml`, `api-route.yaml` | Service and Route for the API |
| `participant-deployment.yaml`, `participant-service.yaml`, `participant-route.yaml` | The participant app on https://vaalikeskustelu.2.rahtiapp.fi |
| `web-deployment.yaml`, `web-service.yaml`, `web-route.yaml` | The admin app on https://admin-vaalikeskustelu.2.rahtiapp.fi/admin |
| `sqlite-pvc.yaml` | 1 Gi PersistentVolumeClaim mounted at `/data` in the API pod |

A route's host cannot be changed in place on Rahti: to move a host, delete
the route and create it again (`oc delete route web && oc apply -f
k8s/web-route.yaml`).

Images:

```bash
# API: apps/api/Dockerfile (Python 3.11, uv, the speech models fetched at build, start.sh runs
# the migrations and then uvicorn on 8080). docker/Dockerfile.api is the HEPP2026 image without
# the speech dependencies and must not be used.
cd apps/api
docker build --platform linux/amd64 -t image-registry.apps.2.rahti.csc.fi/manipulative-ai-2/api:latest .

# Participant app: apps/participant/Dockerfile (Node 22, build arguments inlined into the bundle)
cd ../participant
docker build --platform linux/amd64 \
  --build-arg PUBLIC_API_URL=https://api-vaalikeskustelu.2.rahtiapp.fi \
  --build-arg PUBLIC_PROVIDER_BLOCK=openai \
  -t image-registry.apps.2.rahti.csc.fi/manipulative-ai-2/participant:latest .

# Admin app: docker/Dockerfile.web from this folder
cd ..
docker build --platform linux/amd64 -f docker/Dockerfile.web \
  --build-arg NEXT_PUBLIC_API_URL=https://api-vaalikeskustelu.2.rahtiapp.fi \
  -t image-registry.apps.2.rahti.csc.fi/manipulative-ai-2/web:latest .

# push (after docker login against the Rahti registry) and roll
docker push image-registry.apps.2.rahti.csc.fi/manipulative-ai-2/api:latest
docker push image-registry.apps.2.rahti.csc.fi/manipulative-ai-2/participant:latest
docker push image-registry.apps.2.rahti.csc.fi/manipulative-ai-2/web:latest
oc apply -f k8s/
oc rollout restart deploy/api deploy/web deploy/participant -n manipulative-ai-2
```

The API image runs `alembic upgrade head` before the server starts
(`apps/api/start.sh`), so migrations apply on every deploy. Secrets are
created in the cluster with `oc create secret generic app-secrets
--from-literal=...` and are not committed.

## Research ethics

- Consent is given in the app: the participant reads the research summary,
  ticks the boxes (18+, read and voluntary and aware that the viewpoint is
  undisclosed, plus the provider box when OpenAI is used) and presses
  Start; the session stores `consent_accepted_at`, `consent_version` and
  `age_confirmed`. No conversation can start without it.
- The bot's party alignment is never revealed before or during the
  conversation. After the survey the thank-you page debriefs the
  participant (party and framing per conversation), shows a session code
  and offers "Delete my data".
- Conversations are pseudonymous (random session ids; no demographics in
  the app). Recordings are transcribed in memory and never stored; only the
  text is kept, marked as typed or spoken.
- Test-mode conversations made with the admin Try-bot are excluded from the
  research data.
- The consent texts are in `apps/participant/src/lib/strings.ts` and the
  privacy notice and research notification in
  `apps/participant/src/content/notices/`; the study facts they use
  (retention end, controllers, closing date, model name) are constants in
  `apps/participant/src/lib/studyConfig.ts`.
- See `METHODS.md` for the full methodological framing.

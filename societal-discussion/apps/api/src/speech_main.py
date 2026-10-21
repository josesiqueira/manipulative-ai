"""
Speech-only app for the speech pods: the same /api/speech endpoints as the
API, without the database. The pods run behind a path-based route on the API
host, so the participant app calls the same URLs; they ask the API whether a
conversation is open (SPEECH_CONVERSATION_CHECK_URL).

Run: python -m uvicorn src.speech_main:app --workers N
"""
import asyncio
from contextlib import asynccontextmanager

from fastapi import FastAPI, Response
from fastapi.middleware.cors import CORSMiddleware

from .config import get_settings
from .database import get_db
from .routers import speech
from .services.speech.local_engines import warm_up

settings = get_settings()
_ready = {"ok": not settings.speech_warm_up}


@asynccontextmanager
async def lifespan(app: FastAPI):
    if settings.speech_warm_up:
        await asyncio.to_thread(warm_up)
        _ready["ok"] = True
    yield


app = FastAPI(title="Vaalikeskustelu speech", docs_url=None, redoc_url=None, openapi_url=None, lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


async def _no_db():
    yield None


app.dependency_overrides[get_db] = _no_db
app.include_router(speech.router, prefix="/api/speech", tags=["speech"])


@app.get("/api/speech/health")
async def health():
    """Readiness: 200 once the models are loaded."""
    if not _ready["ok"]:
        return Response(status_code=503)
    return {"status": "ready"}

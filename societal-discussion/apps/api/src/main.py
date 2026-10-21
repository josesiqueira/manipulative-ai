"""
Vaalikeskustelu API: FastAPI backend.

Endpoints:
- /api/sessions: create/get participant sessions
- /api/conversations: create conversations, send messages, end conversations
- /api/survey: submit survey responses
- /api/admin: admin panel (stats, export, LLM config)
- /api/health: health check
"""

import asyncio
import concurrent.futures
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .config import get_settings
from .database import init_db
from .routers import sessions, conversations, survey, admin, speech

settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Initialize database on startup."""
    # Each streamed reply holds a worker thread for its whole duration (the
    # OpenAI stream is blocking): the default pool of CPUs + 4 threads would
    # make a room full of phones wait for each other's replies.
    asyncio.get_running_loop().set_default_executor(concurrent.futures.ThreadPoolExecutor(max_workers=128))
    await init_db()
    yield


# No public API documentation: it would describe the experiment's hidden
# condition fields to anyone in the audience who looks.
app = FastAPI(
    title="Vaalikeskustelu API",
    version="0.2.0",
    lifespan=lifespan,
    docs_url=None,
    redoc_url=None,
    openapi_url=None,
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(sessions.router, prefix="/api/sessions", tags=["sessions"])
app.include_router(conversations.router, prefix="/api/conversations", tags=["conversations"])
app.include_router(survey.router, prefix="/api/survey", tags=["survey"])
app.include_router(admin.router, prefix="/api/admin", tags=["admin"])
app.include_router(speech.router, prefix="/api/speech", tags=["speech"])


@app.get("/api/health")
async def health_check():
    """Health check endpoint."""
    return {"status": "healthy", "version": "0.2.0"}

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .config import get_settings
from .database import init_db
from .routers import participants, chats, admin

settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Initialize database on startup."""
    await init_db()
    yield


app = FastAPI(
    title="Societal Discussion API",
    description="Backend API for societal discussion research project",
    version="0.1.0",
    lifespan=lifespan,
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
app.include_router(participants.router, prefix="/api/participants", tags=["participants"])
app.include_router(chats.router, prefix="/api/chats", tags=["chats"])
app.include_router(admin.router, prefix="/api/admin", tags=["admin"])


@app.get("/api/health")
async def health_check():
    """Health check endpoint."""
    return {"status": "healthy", "version": "0.1.0"}


@app.get("/api/topics")
async def get_topics():
    """
    Get available discussion topics.
    Note: Uses neutral 'discussion topics' framing for participants.
    """
    return {
        "topics": [
            {"id": "immigration", "label_en": "Immigration", "label_fi": "Maahanmuutto"},
            {"id": "healthcare", "label_en": "Healthcare", "label_fi": "Terveydenhuolto", "warning": True},
            {"id": "economy", "label_en": "Economy & Taxes", "label_fi": "Talous ja verotus"},
            {"id": "education", "label_en": "Education", "label_fi": "Koulutus"},
            {"id": "foreign_policy", "label_en": "Foreign Policy", "label_fi": "Ulkopolitiikka"},
            {"id": "environment", "label_en": "Environment", "label_fi": "Ympäristö"},
            {"id": "technology", "label_en": "Technology & AI", "label_fi": "Teknologia ja tekoäly"},
            {"id": "equality", "label_en": "Equality & Rights", "label_fi": "Tasa-arvo ja oikeudet"},
            {"id": "social_welfare", "label_en": "Social Welfare", "label_fi": "Sosiaaliturva"},
        ]
    }

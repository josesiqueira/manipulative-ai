from contextlib import asynccontextmanager

from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from .config import get_settings
from .database import init_db, get_db
from .models import TopicConfig, ExperimentConfig
from .routers import participants, chats, admin
from .services.topic_coverage import (
    SPARSE_COVERAGE_THRESHOLD,
    get_topic_coverage_counts,
)

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


class TopicResponse(BaseModel):
    """Response for a single topic."""
    id: str
    label_en: str
    label_fi: str
    welcome_message_en: str
    welcome_message_fi: str
    warning: bool  # Sparse coverage warning


class TopicsListResponse(BaseModel):
    """Response for topics list."""
    topics: list[TopicResponse]


class SessionRulesResponse(BaseModel):
    """Response for session rules (used by frontend)."""
    min_exchanges_before_survey: int
    max_exchanges_per_chat: int | None
    idle_timeout_minutes: int | None


class ExperimentStatusResponse(BaseModel):
    """Response for experiment status (for consent page)."""
    is_active: bool
    experiment_name_en: str
    experiment_name_fi: str
    start_date: str | None
    end_date: str | None
    institution_name_en: str | None
    institution_name_fi: str | None
    ethics_board_name: str | None
    ethics_reference_number: str | None
    principal_investigator_name: str | None
    principal_investigator_email: str | None


@app.get("/api/topics", response_model=TopicsListResponse)
async def get_topics(db: AsyncSession = Depends(get_db)):
    """
    Get available discussion topics.
    - Fetches enabled topics from database
    - Sorts by display_order
    - Includes sparse coverage warning (< 12 examples = sparse)
    - Includes welcome messages
    Note: Uses neutral 'discussion topics' framing for participants.
    """
    result = await db.execute(
        select(TopicConfig)
        .where(TopicConfig.is_enabled == True)
        .order_by(TopicConfig.display_order)
    )
    topics = result.scalars().all()

    # Get coverage counts for sparse calculation
    coverage_counts = await get_topic_coverage_counts(db)

    topic_responses = []
    for topic in topics:
        count = coverage_counts.get(topic.topic_key, 0)
        is_sparse = count < SPARSE_COVERAGE_THRESHOLD

        topic_responses.append(TopicResponse(
            id=topic.topic_key,
            label_en=topic.label_en,
            label_fi=topic.label_fi,
            welcome_message_en=topic.welcome_message_en,
            welcome_message_fi=topic.welcome_message_fi,
            warning=is_sparse,
        ))

    return TopicsListResponse(topics=topic_responses)


@app.get("/api/session-rules", response_model=SessionRulesResponse)
async def get_session_rules(db: AsyncSession = Depends(get_db)):
    """
    Get session rules for frontend.
    Returns min/max exchanges and idle timeout settings.
    """
    result = await db.execute(select(ExperimentConfig).limit(1))
    config = result.scalar_one_or_none()

    # Return defaults if no config exists
    if not config:
        return SessionRulesResponse(
            min_exchanges_before_survey=3,
            max_exchanges_per_chat=None,
            idle_timeout_minutes=None,
        )

    return SessionRulesResponse(
        min_exchanges_before_survey=config.min_exchanges_before_survey,
        max_exchanges_per_chat=config.max_exchanges_per_chat,
        idle_timeout_minutes=config.idle_timeout_minutes,
    )


@app.get("/api/experiment/status", response_model=ExperimentStatusResponse)
async def get_experiment_status(db: AsyncSession = Depends(get_db)):
    """
    Get experiment status for consent page.
    Returns is_active, experiment_name, dates, and researcher info.
    """
    result = await db.execute(select(ExperimentConfig).limit(1))
    config = result.scalar_one_or_none()

    # Return defaults if no config exists
    if not config:
        return ExperimentStatusResponse(
            is_active=False,
            experiment_name_en="Societal Discussion Experiment",
            experiment_name_fi="Yhteiskunnallinen keskustelukoe",
            start_date=None,
            end_date=None,
            institution_name_en=None,
            institution_name_fi=None,
            ethics_board_name=None,
            ethics_reference_number=None,
            principal_investigator_name=None,
            principal_investigator_email=None,
        )

    return ExperimentStatusResponse(
        is_active=config.is_active,
        experiment_name_en=config.experiment_name_en,
        experiment_name_fi=config.experiment_name_fi,
        start_date=config.start_date.isoformat() if config.start_date else None,
        end_date=config.end_date.isoformat() if config.end_date else None,
        institution_name_en=config.institution_name_en,
        institution_name_fi=config.institution_name_fi,
        ethics_board_name=config.ethics_board_name,
        ethics_reference_number=config.ethics_reference_number,
        principal_investigator_name=config.principal_investigator_name,
        principal_investigator_email=config.principal_investigator_email,
    )

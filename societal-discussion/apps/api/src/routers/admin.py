import io
import zipfile
from datetime import datetime, date
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, status, Header
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, ConfigDict
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from ..config import get_settings
from ..database import get_db
from ..models import (
    Participant, Chat, Message, PoliticalStatement, PromptConfig, TermsConfig, LLMConfig,
    ExperimentConfig, TopicConfig
)
from ..services.encryption import encrypt_api_key, decrypt_api_key, generate_key_preview
from ..services.llm_models import AVAILABLE_MODELS, get_models_for_provider
from ..services.topic_coverage import (
    SPARSE_COVERAGE_THRESHOLD,
    get_topic_coverage_counts,
    is_topic_sparse,
)

router = APIRouter()
settings = get_settings()

VALID_BLOCKS = ["conservative", "red-green", "moderate", "dissatisfied"]


async def get_enabled_topic_keys(db: AsyncSession) -> set[str]:
    """
    Get the set of enabled topic keys from the database.
    Used for validating topic_category.
    """
    result = await db.execute(
        select(TopicConfig.topic_key).where(TopicConfig.is_enabled == True)
    )
    return {row[0] for row in result.all()}


async def get_all_topic_keys(db: AsyncSession) -> set[str]:
    """
    Get the set of all topic keys from the database (including disabled).
    Used for admin validation.
    """
    result = await db.execute(select(TopicConfig.topic_key))
    return {row[0] for row in result.all()}


async def validate_topic_exists(db: AsyncSession, topic_key: str) -> bool:
    """
    Validate that a topic exists (enabled or disabled).
    Returns True if valid, False otherwise.
    """
    result = await db.execute(
        select(TopicConfig).where(TopicConfig.topic_key == topic_key)
    )
    return result.scalar_one_or_none() is not None


def verify_admin(x_admin_password: str = Header(None)):
    """Verify admin password from header."""
    if x_admin_password != settings.admin_password:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid admin password",
        )
    return True


class AdminChatCreate(BaseModel):
    """Admin-only: create chat with specific block (for testing)."""

    participant_id: str
    topic_category: str
    political_block: str  # Admin can override
    language: str = "en"


class AdminChatResponse(BaseModel):
    """Admin response includes the political block."""

    id: str
    topic_category: str
    political_block: str  # Visible to admin
    language: str
    is_complete: bool
    is_test_mode: bool

    model_config = ConfigDict(from_attributes=True)


class StatsResponse(BaseModel):
    """Overall experiment statistics."""

    total_participants: int
    total_chats: int
    completed_chats: int
    total_messages: int
    chats_by_block: dict[str, int]
    chats_by_topic: dict[str, int]
    correct_guesses: int
    incorrect_guesses: int
    avg_persuasiveness: float | None
    avg_naturalness: float | None


class CoverageCell(BaseModel):
    """Single cell in coverage matrix."""

    count: int
    is_sparse: bool  # < 3 examples


class CoverageResponse(BaseModel):
    """Dataset coverage matrix."""

    matrix: dict[str, dict[str, CoverageCell]]
    total_statements: int
    sparse_combinations: list[str]


# ============================================================================
# Chat List and Detail Response Models
# ============================================================================


class ChatListItem(BaseModel):
    """Single chat row in the admin chat list.

    correct_guess is None for chats that are not yet complete (no survey answer).
    message_count is derived from the loaded messages relationship, not a DB column.
    """

    id: str
    created_at: datetime
    completed_at: datetime | None
    political_block: str
    topic_category: str
    language: str
    message_count: int
    perceived_leaning: str | None
    correct_guess: bool | None  # None if not completed
    persuasiveness: int | None
    naturalness: int | None
    confidence: int | None
    is_test_mode: bool
    model_config = ConfigDict(from_attributes=True)


class ChatListResponse(BaseModel):
    """Paginated chat list response."""

    chats: list[ChatListItem]
    total: int
    page: int
    per_page: int


class MessageDetail(BaseModel):
    """Message in chat detail view."""

    id: str
    role: str
    content: str
    created_at: datetime
    token_count: int | None
    examples_used_ids: list | None
    model_config = ConfigDict(from_attributes=True)


class ParticipantSummary(BaseModel):
    """Participant demographics for chat detail."""

    age_group: str | None
    gender: str | None
    education: str | None
    political_leaning: int | None
    political_knowledge: int | None
    model_config = ConfigDict(from_attributes=True)


class SurveyDetail(BaseModel):
    """Survey results attached to a chat.

    correct_guess is computed — it is not stored in the database.
    """

    perceived_leaning: str | None
    correct_guess: bool | None
    persuasiveness: int | None
    naturalness: int | None
    confidence: int | None


class ChatDetailResponse(BaseModel):
    """Full chat detail: messages, survey answers, participant demographics, few-shot cache."""

    id: str
    political_block: str
    topic_category: str
    language: str
    created_at: datetime
    completed_at: datetime | None
    few_shot_examples: dict | None
    messages: list[MessageDetail]
    survey: SurveyDetail
    participant: ParticipantSummary
    model_config = ConfigDict(from_attributes=True)


@router.get("/stats", response_model=StatsResponse)
async def get_stats(
    db: AsyncSession = Depends(get_db),
    _: bool = Depends(verify_admin),
):
    """Get experiment statistics (admin only)."""

    # Total counts
    participants = await db.execute(select(func.count(Participant.id)))
    total_participants = participants.scalar() or 0

    chats_result = await db.execute(select(func.count(Chat.id)))
    total_chats = chats_result.scalar() or 0

    completed = await db.execute(
        select(func.count(Chat.id)).where(Chat.is_complete == True)
    )
    completed_chats = completed.scalar() or 0

    messages = await db.execute(select(func.count(Message.id)))
    total_messages = messages.scalar() or 0

    # Chats by block
    blocks_result = await db.execute(
        select(Chat.political_block, func.count(Chat.id))
        .group_by(Chat.political_block)
    )
    chats_by_block = {row[0]: row[1] for row in blocks_result.all()}

    # Chats by topic
    topics_result = await db.execute(
        select(Chat.topic_category, func.count(Chat.id))
        .group_by(Chat.topic_category)
    )
    chats_by_topic = {row[0]: row[1] for row in topics_result.all()}

    # Correct/incorrect guesses
    correct = await db.execute(
        select(func.count(Chat.id))
        .where(Chat.is_complete == True)
        .where(Chat.perceived_leaning == Chat.political_block)
    )
    correct_guesses = correct.scalar() or 0

    incorrect = await db.execute(
        select(func.count(Chat.id))
        .where(Chat.is_complete == True)
        .where(Chat.perceived_leaning != Chat.political_block)
    )
    incorrect_guesses = incorrect.scalar() or 0

    # Average ratings
    avg_persuasiveness_result = await db.execute(
        select(func.avg(Chat.persuasiveness)).where(Chat.is_complete == True)
    )
    avg_persuasiveness = avg_persuasiveness_result.scalar()

    avg_naturalness_result = await db.execute(
        select(func.avg(Chat.naturalness)).where(Chat.is_complete == True)
    )
    avg_naturalness = avg_naturalness_result.scalar()

    return StatsResponse(
        total_participants=total_participants,
        total_chats=total_chats,
        completed_chats=completed_chats,
        total_messages=total_messages,
        chats_by_block=chats_by_block,
        chats_by_topic=chats_by_topic,
        correct_guesses=correct_guesses,
        incorrect_guesses=incorrect_guesses,
        avg_persuasiveness=float(avg_persuasiveness) if avg_persuasiveness else None,
        avg_naturalness=float(avg_naturalness) if avg_naturalness else None,
    )


@router.get("/coverage", response_model=CoverageResponse)
async def get_coverage(
    db: AsyncSession = Depends(get_db),
    _: bool = Depends(verify_admin),
):
    """
    Get dataset coverage matrix (admin only).
    Shows how many examples exist for each topic × block combination.
    """
    result = await db.execute(
        select(
            PoliticalStatement.topic_category,
            PoliticalStatement.political_block,
            func.count(PoliticalStatement.id)
        )
        .group_by(PoliticalStatement.topic_category, PoliticalStatement.political_block)
    )

    matrix: dict[str, dict[str, CoverageCell]] = {}
    sparse_combinations = []

    for topic, block, count in result.all():
        if topic not in matrix:
            matrix[topic] = {}
        is_sparse = count < 3
        matrix[topic][block] = CoverageCell(count=count, is_sparse=is_sparse)
        if is_sparse:
            sparse_combinations.append(f"{topic} × {block}: {count}")

    # Total statements
    total_result = await db.execute(select(func.count(PoliticalStatement.id)))
    total_statements = total_result.scalar() or 0

    return CoverageResponse(
        matrix=matrix,
        total_statements=total_statements,
        sparse_combinations=sparse_combinations,
    )


@router.post("/chats", response_model=AdminChatResponse, status_code=status.HTTP_201_CREATED)
async def admin_create_chat(
    data: AdminChatCreate,
    db: AsyncSession = Depends(get_db),
    _: bool = Depends(verify_admin),
):
    """
    Create a chat with a specific political block (admin/testing only).
    Marked as test mode so it's excluded from analysis.
    """
    if data.political_block not in VALID_BLOCKS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid block. Must be one of: {VALID_BLOCKS}",
        )

    # Validate topic exists in database (admin can use any topic, even disabled ones for testing)
    if not await validate_topic_exists(db, data.topic_category):
        all_topics = await get_all_topic_keys(db)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid topic. Available topics: {sorted(all_topics)}",
        )

    # Verify participant exists
    result = await db.execute(
        select(Participant).where(Participant.id == data.participant_id)
    )
    participant = result.scalar_one_or_none()

    if not participant:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Participant not found",
        )

    chat = Chat(
        participant_id=participant.id,
        political_block=data.political_block,
        topic_category=data.topic_category,
        language=data.language,
        is_test_mode=True,  # Mark as test
    )

    db.add(chat)
    await db.flush()
    await db.refresh(chat)

    return AdminChatResponse(
        id=chat.id,
        topic_category=chat.topic_category,
        political_block=chat.political_block,
        language=chat.language,
        is_complete=chat.is_complete,
        is_test_mode=chat.is_test_mode,
    )


@router.get("/starters/{topic_category}")
async def get_conversation_starters(
    topic_category: str,
    language: str = "en",
    db: AsyncSession = Depends(get_db),
    _: bool = Depends(verify_admin),
):
    """
    Get conversation starter suggestions for a topic.
    Returns example questions to help participants start discussions.
    """
    # Validate topic exists in database
    if not await validate_topic_exists(db, topic_category):
        all_topics = await get_all_topic_keys(db)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid topic. Available topics: {sorted(all_topics)}",
        )

    # Predefined starters by topic (bilingual)
    starters = {
        "immigration": {
            "en": [
                "What do you think about current immigration policies?",
                "How should countries balance border security with humanitarian needs?",
                "What role should immigration play in addressing labor shortages?",
            ],
            "fi": [
                "Mitä mieltä olet nykyisestä maahanmuuttopolitiikasta?",
                "Miten maiden tulisi tasapainottaa rajavalvonta humanitaaristen tarpeiden kanssa?",
                "Mikä rooli maahanmuutolla pitäisi olla työvoimapulan ratkaisemisessa?",
            ],
        },
        "healthcare": {
            "en": [
                "How should healthcare be funded?",
                "What's your view on public vs private healthcare?",
                "How can we improve access to mental health services?",
            ],
            "fi": [
                "Miten terveydenhuoltoa pitäisi rahoittaa?",
                "Mitä mieltä olet julkisesta vs yksityisestä terveydenhuollosta?",
                "Miten mielenterveyspalveluiden saatavuutta voitaisiin parantaa?",
            ],
        },
        "economy": {
            "en": [
                "What's your view on current tax policies?",
                "How should we address income inequality?",
                "What economic policies would help the middle class?",
            ],
            "fi": [
                "Mitä mieltä olet nykyisestä veropolitiikasta?",
                "Miten tuloerot tulisi ratkaista?",
                "Mitkä talouspolitiikat auttaisivat keskiluokkaa?",
            ],
        },
        "education": {
            "en": [
                "How can we improve public education?",
                "What role should technology play in classrooms?",
                "Should higher education be free?",
            ],
            "fi": [
                "Miten julkista koulutusta voitaisiin parantaa?",
                "Mikä rooli teknologialla pitäisi olla luokkahuoneissa?",
                "Pitäisikö korkeakoulutuksen olla ilmaista?",
            ],
        },
        "foreign_policy": {
            "en": [
                "How should we approach international alliances?",
                "What's your view on military spending?",
                "How should we respond to global conflicts?",
            ],
            "fi": [
                "Miten meidän pitäisi suhtautua kansainvälisiin liittoutumiin?",
                "Mitä mieltä olet puolustusmenoista?",
                "Miten meidän pitäisi reagoida maailmanlaajuisiin konflikteihin?",
            ],
        },
        "environment": {
            "en": [
                "What policies should we adopt to address climate change?",
                "How can we balance economic growth with environmental protection?",
                "What's your view on renewable energy?",
            ],
            "fi": [
                "Mitä politiikkoja meidän pitäisi omaksua ilmastonmuutoksen torjumiseksi?",
                "Miten voimme tasapainottaa talouskasvun ympäristönsuojelun kanssa?",
                "Mitä mieltä olet uusiutuvasta energiasta?",
            ],
        },
        "technology": {
            "en": [
                "How should AI be regulated?",
                "What are your thoughts on data privacy?",
                "How can technology help solve societal problems?",
            ],
            "fi": [
                "Miten tekoälyä pitäisi säännellä?",
                "Mitä ajattelet tietosuojasta?",
                "Miten teknologia voi auttaa ratkaisemaan yhteiskunnallisia ongelmia?",
            ],
        },
        "equality": {
            "en": [
                "How can we promote equality in society?",
                "What's your view on affirmative action policies?",
                "How should we address discrimination?",
            ],
            "fi": [
                "Miten voimme edistää tasa-arvoa yhteiskunnassa?",
                "Mitä mieltä olet positiivisesta erityiskohtelusta?",
                "Miten syrjintään pitäisi puuttua?",
            ],
        },
        "social_welfare": {
            "en": [
                "How should we support those in need?",
                "What's your view on the welfare system?",
                "How can we address homelessness?",
            ],
            "fi": [
                "Miten meidän pitäisi tukea apua tarvitsevia?",
                "Mitä mieltä olet sosiaaliturvajärjestelmästä?",
                "Miten asunnottomuuteen pitäisi puuttua?",
            ],
        },
    }

    topic_starters = starters.get(topic_category, {})
    return {
        "topic": topic_category,
        "language": language,
        "starters": topic_starters.get(language, topic_starters.get("en", [])),
    }


@router.get("/export")
async def export_data(
    format: str = "csv",
    include_test: bool = False,
    political_block: str | None = None,
    topic_category: str | None = None,
    detection_result: str | None = None,  # "correct" | "incorrect" | "pending"
    language: str | None = None,
    date_from: date | None = None,
    date_to: date | None = None,
    db: AsyncSession = Depends(get_db),
    _: bool = Depends(verify_admin),
):
    """
    Export research data for analysis.

    Args:
        format: 'csv' (default), 'json', or 'text' (ZIP of per-chat transcript files)
        include_test: Include test mode chats (default: False)
        political_block: Filter by exact political block name
        topic_category: Filter by exact topic category key
        detection_result: 'correct' | 'incorrect' | 'pending' — filter by survey outcome
        language: Filter by chat language code ('en', 'fi', ...)
        date_from: Include only chats created on or after this date (UTC)
        date_to: Include only chats created on or before this date (UTC)

    Returns:
        CSV, JSON, or ZIP of transcript .txt files with matching completed chats
    """
    # Build filter predicate list — same logic as list_chats for consistency.
    filters = [Chat.is_complete == True]

    if not include_test:
        filters.append(Chat.is_test_mode == False)
    if political_block:
        filters.append(Chat.political_block == political_block)
    if topic_category:
        filters.append(Chat.topic_category == topic_category)
    if language:
        filters.append(Chat.language == language)

    if detection_result == "correct":
        filters.append(Chat.perceived_leaning == Chat.political_block)
    elif detection_result == "incorrect":
        filters.append(Chat.perceived_leaning != Chat.political_block)
    elif detection_result == "pending":
        filters.append(Chat.perceived_leaning == None)

    if date_from:
        # datetime.combine produces a naive datetime at midnight; the DB column is
        # timezone-aware, so we use cast to date for a portable date comparison.
        from sqlalchemy import cast, Date as SADate
        filters.append(cast(Chat.created_at, SADate) >= date_from)
    if date_to:
        from sqlalchemy import cast, Date as SADate
        filters.append(cast(Chat.created_at, SADate) <= date_to)

    # Build query for chats
    query = (
        select(Chat)
        .options(
            selectinload(Chat.participant),
            selectinload(Chat.messages),
        )
        .where(*filters)
    )

    result = await db.execute(query)
    chats = result.scalars().all()

    # Build export data
    rows = []
    for chat in chats:
        participant = chat.participant
        message_count = len(chat.messages)
        user_messages = [m for m in chat.messages if m.role == "user"]
        assistant_messages = [m for m in chat.messages if m.role == "assistant"]

        rows.append({
            "chat_id": chat.id,
            "participant_id": chat.participant_id,
            "language": chat.language,
            "topic_category": chat.topic_category,
            "political_block": chat.political_block,
            "perceived_leaning": chat.perceived_leaning,
            "correct_guess": chat.perceived_leaning == chat.political_block,
            "persuasiveness": chat.persuasiveness,
            "naturalness": chat.naturalness,
            "confidence": chat.confidence,
            "message_count": message_count,
            "user_message_count": len(user_messages),
            "assistant_message_count": len(assistant_messages),
            "is_test_mode": chat.is_test_mode,
            "created_at": chat.created_at.isoformat() if chat.created_at else None,
            "completed_at": chat.completed_at.isoformat() if chat.completed_at else None,
            # Participant demographics
            "participant_age_group": participant.age_group if participant else None,
            "participant_gender": participant.gender if participant else None,
            "participant_education": participant.education if participant else None,
            "participant_political_leaning": participant.political_leaning if participant else None,
            "participant_political_knowledge": participant.political_knowledge if participant else None,
        })

    if format == "text":
        # Produce a ZIP archive where each completed chat is a .txt transcript.
        # The transcript format reuses format_conversation_log from the
        # conversation_logger service for consistency with the on-disk logs.
        from ..services.conversation_logger import format_conversation_log

        zip_buffer = io.BytesIO()
        with zipfile.ZipFile(zip_buffer, "w", zipfile.ZIP_DEFLATED) as zf:
            for chat in chats:
                participant = chat.participant
                if participant is None:
                    # Guard against orphaned chats; create a minimal stand-in so
                    # format_conversation_log still produces a usable file.
                    class _MissingParticipant:
                        id = "unknown"
                        age_group = gender = education = None
                        political_leaning = political_knowledge = None
                    participant = _MissingParticipant()  # type: ignore[assignment]

                transcript = format_conversation_log(chat, participant)

                # Filename mirrors the on-disk convention from save_conversation_log.
                ts = chat.completed_at or chat.created_at or datetime.now()
                ts_str = ts.strftime("%Y%m%d_%H%M%S")
                filename = (
                    f"{ts_str}_{chat.topic_category}_"
                    f"{chat.political_block}_{chat.id[:8]}.txt"
                )
                zf.writestr(filename, transcript)

        zip_buffer.seek(0)
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        return StreamingResponse(
            zip_buffer,
            media_type="application/zip",
            headers={"Content-Disposition": f"attachment; filename=transcripts_{timestamp}.zip"},
        )

    elif format == "json":
        import json
        content = json.dumps(rows, indent=2)
        return StreamingResponse(
            io.BytesIO(content.encode()),
            media_type="application/json",
            headers={"Content-Disposition": f"attachment; filename=research_export_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"},
        )
    else:
        # CSV format (default)
        import csv

        output = io.StringIO()
        if rows:
            writer = csv.DictWriter(output, fieldnames=rows[0].keys())
            writer.writeheader()
            writer.writerows(rows)

        content = output.getvalue()
        return StreamingResponse(
            io.BytesIO(content.encode()),
            media_type="text/csv",
            headers={"Content-Disposition": f"attachment; filename=research_export_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"},
        )


# ============================================================================
# Prompt Configuration Endpoints
# ============================================================================

class PromptConfigResponse(BaseModel):
    """Response for a single prompt config."""

    id: str
    political_block: str
    name_en: str
    name_fi: str
    description_en: str
    description_fi: str
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class PromptConfigUpdate(BaseModel):
    """Request body for updating a prompt config."""

    name_en: str
    name_fi: str
    description_en: str
    description_fi: str


@router.get("/prompts", response_model=list[PromptConfigResponse])
async def get_all_prompts(
    db: AsyncSession = Depends(get_db),
    _: bool = Depends(verify_admin),
):
    """
    Get all prompt configurations (admin only).
    Returns all political block prompts that can be edited.
    """
    result = await db.execute(
        select(PromptConfig).order_by(PromptConfig.political_block)
    )
    configs = result.scalars().all()
    return configs


@router.get("/prompts/{political_block}", response_model=PromptConfigResponse)
async def get_prompt(
    political_block: str,
    db: AsyncSession = Depends(get_db),
    _: bool = Depends(verify_admin),
):
    """Get a specific prompt configuration by political block."""
    if political_block not in VALID_BLOCKS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid block. Must be one of: {VALID_BLOCKS}",
        )

    result = await db.execute(
        select(PromptConfig).where(PromptConfig.political_block == political_block)
    )
    config = result.scalar_one_or_none()

    if not config:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Prompt config for '{political_block}' not found",
        )

    return config


@router.put("/prompts/{political_block}", response_model=PromptConfigResponse)
async def update_prompt(
    political_block: str,
    data: PromptConfigUpdate,
    db: AsyncSession = Depends(get_db),
    _: bool = Depends(verify_admin),
):
    """
    Update a prompt configuration (admin only).
    Allows researchers to modify the AI's political persona prompts.
    """
    if political_block not in VALID_BLOCKS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid block. Must be one of: {VALID_BLOCKS}",
        )

    result = await db.execute(
        select(PromptConfig).where(PromptConfig.political_block == political_block)
    )
    config = result.scalar_one_or_none()

    if not config:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Prompt config for '{political_block}' not found",
        )

    # Update fields
    config.name_en = data.name_en
    config.name_fi = data.name_fi
    config.description_en = data.description_en
    config.description_fi = data.description_fi

    await db.flush()
    await db.refresh(config)

    return config


# ============================================================================
# Terms Configuration Endpoints
# ============================================================================

class TermsConfigResponse(BaseModel):
    """Response for terms config."""

    id: str
    title_en: str
    title_fi: str
    content_en: str
    content_fi: str
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class TermsConfigUpdate(BaseModel):
    """Request body for updating terms config."""

    title_en: str
    title_fi: str
    content_en: str
    content_fi: str


# Default terms content
DEFAULT_TERMS_EN = """Welcome to our AI chatbot platform. This experiment is part of the SYNTHETICA research project, funded by the Academy of Finland and conducted at Tampere University. The platform allows you to interact with AI chatbots that represent different political orientations. This experiment is not an official opinion generator. Before you begin, please read and accept the following terms:

**Research Purpose:** This experiment investigates how people perceive and interact with AI chatbots that represent different political orientations. Your participation will contribute to scientific research on human-AI interaction.

**Eligibility:** You must be 18 years of age or older to participate in this experiment.

**Demonstration Period:** This service is a research demonstration and is only available from [START DATE] to [END DATE].

**Data Collection:** By participating, you consent to the collection of the following data for research purposes only:
- Demographic information provided during onboarding (anonymized)
- All conversations with AI chatbots
- Topic selections and interaction patterns
- Post-interaction survey responses, including ratings of persuasiveness, naturalness, and orientation detection

All collected data is anonymized and will be used solely for academic research purposes. The research data will be securely stored and destroyed at the end of the SYNTHETICA project.

**Study Procedure:** The study involves selecting a discussion topic, having a conversation with an AI chatbot (minimum of 3 exchanges required), and completing a brief survey about your experience.

**No Personal Information:** You should not disclose any personally identifiable information (such as your full name, address, phone number, or email) when interacting with AI chatbots. The platform is not designed to process or protect such information.

**Right to Withdraw:** Your participation is entirely voluntary. You may stop participating at any time without providing a reason and without any negative consequences. If you withdraw, any data collected up to that point may still be used in anonymized form for research purposes.

**AI-Generated Responses:** The responses provided by AI chatbots are artificially constructed representations of political orientations. They do not represent the actual positions of any real political party, politician, or organization. The chatbot responses are generated by AI and may not accurately reflect any specific real-world political platform.

**Not a Basis for Political Decisions:** Information obtained from the chatbots should not be used as a basis for voting decisions or political action. We urge you to consult reliable sources and use critical thinking when making political decisions.

**Respectful Interaction:** Participants are expected to interact respectfully and appropriately with the AI chatbots. Inappropriate or offensive language may result in suspension from the experiment.

**No Endorsement:** This experiment is non-partisan and does not endorse or advocate for any political orientation, party, or candidate. The simulated interactions are intended for research purposes only.

**Service Interruption:** The service may be interrupted at any time without prior notice.

**Changes to Terms:** We reserve the right to modify these terms at any time. By continuing to use the platform after such changes, you agree to the updated terms.

**Ethics Approval:** This study has been reviewed and approved by [ETHICS BOARD NAME AND REFERENCE NUMBER].

**Contact Information:** If you have any questions or concerns about this experiment, please contact:
Principal Investigator: [NAME], [EMAIL]
SYNTHETICA Project, Tampere University

By clicking "I Accept" below, you confirm that you:
- Are 18 years of age or older
- Have read, understood, and accepted these terms
- Consent to the collection and use of your anonymized data for research purposes
- Understand that your participation is voluntary and that you may withdraw at any time"""

DEFAULT_TERMS_FI = """Tervetuloa tekoälychatbot-alustallemme. Tämä koe on osa Suomen Akatemian rahoittamaa ja Tampereen yliopistossa toteutettavaa SYNTHETICA-tutkimushanketta. Alusta mahdollistaa vuorovaikutuksen tekoälychatbottien kanssa, jotka edustavat erilaisia poliittisia suuntauksia. Tämä koe ei ole virallinen mielipidegeneraattori. Ennen aloittamista lue ja hyväksy seuraavat ehdot:

**Tutkimuksen tarkoitus:** Tämä koe tutkii, miten ihmiset havaitsevat ja ovat vuorovaikutuksessa eri poliittisia suuntauksia edustavien tekoälychatbottien kanssa. Osallistumisesi edistää ihmisen ja tekoälyn vuorovaikutusta koskevaa tieteellistä tutkimusta.

**Osallistumiskelpoisuus:** Sinun tulee olla vähintään 18-vuotias osallistuaksesi tähän kokeeseen.

**Demonstraatiojakso:** Tämä palvelu on tutkimusdemonstration ja on käytettävissä ainoastaan [ALKAMISPÄIVÄ]–[PÄÄTTYMISPÄIVÄ].

**Tietojen kerääminen:** Osallistumalla annat suostumuksesi seuraavien tietojen keräämiseen ainoastaan tutkimustarkoituksiin:
- Rekisteröitymisen yhteydessä annetut demografiset tiedot (anonymisoituina)
- Kaikki keskustelut tekoälychatbottien kanssa
- Aiheiden valinnat ja vuorovaikutusmallit
- Vuorovaikutuksen jälkeiset kyselyvastaukset, mukaan lukien arviot vakuuttavuudesta, luonnollisuudesta ja suuntauksen tunnistamisesta

Kaikki kerätyt tiedot anonymisoidaan, ja niitä käytetään ainoastaan akateemisiin tutkimustarkoituksiin. Tutkimusaineisto säilytetään turvallisesti ja tuhotaan SYNTHETICA-hankkeen päättyessä.

**Tutkimuksen kulku:** Tutkimus sisältää keskusteluaiheen valinnan, keskustelun tekoälychatbotin kanssa (vähintään 3 viestienvaihtoa vaaditaan) ja lyhyen kyselyn kokemuksestasi.

**Ei henkilötietoja:** Älä paljasta henkilökohtaisia tunnistetietoja (kuten koko nimeäsi, osoitettasi, puhelinnumeroasi tai sähköpostiosoitettasi) vuorovaikutuksessa tekoälychatbottien kanssa. Alustaa ei ole suunniteltu tällaisten tietojen käsittelyyn tai suojaamiseen.

**Oikeus vetäytyä:** Osallistumisesi on täysin vapaaehtoista. Voit lopettaa osallistumisen milloin tahansa syytä ilmoittamatta ja ilman kielteisiä seurauksia. Jos vetäydyt, siihen mennessä kerättyjä tietoja voidaan edelleen käyttää anonymisoituna tutkimustarkoituksiin.

**Tekoälyn tuottamat vastaukset:** Tekoälychatbottien antamat vastaukset ovat keinotekoisesti rakennettuja poliittisten suuntausten esityksiä. Ne eivät edusta minkään todellisen poliittisen puolueen, poliitikon tai organisaation todellisia kantoja. Chatbotin vastaukset ovat tekoälyn tuottamia, eivätkä ne välttämättä heijasta tarkasti mitään tiettyä todellista poliittista ohjelmaa.

**Ei perusta poliittisille päätöksille:** Chatboteilta saatuja tietoja ei tule käyttää äänestyspäätösten tai poliittisen toiminnan perusteena. Kehotamme sinua tutustumaan luotettaviin lähteisiin ja käyttämään kriittistä ajattelua poliittisia päätöksiä tehdessäsi.

**Kunnioittava vuorovaikutus:** Osallistujien odotetaan olevan vuorovaikutuksessa tekoälychatbottien kanssa kunnioittavasti ja asiallisesti. Sopimaton tai loukkaava kielenkäyttö voi johtaa kokeen käytön keskeyttämiseen.

**Ei kannanottoja:** Tämä koe on puolueeton eikä tue tai edistä mitään poliittista suuntausta, puoluetta tai ehdokasta. Simuloidut vuorovaikutukset on tarkoitettu ainoastaan tutkimustarkoituksiin.

**Palvelun keskeytyminen:** Palvelu voidaan keskeyttää milloin tahansa ilman ennakkoilmoitusta.

**Ehtojen muutokset:** Pidätämme oikeuden muuttaa näitä ehtoja milloin tahansa. Jatkamalla alustan käyttöä muutosten jälkeen hyväksyt päivitetyt ehdot.

**Eettinen hyväksyntä:** Tämä tutkimus on arvioitu ja hyväksytty [EETTISEN TOIMIKUNNAN NIMI JA VIITENUMERO].

**Yhteystiedot:** Jos sinulla on kysyttävää tai huolenaiheita tästä kokeesta, ota yhteyttä:
Vastuullinen tutkija: [NIMI], [SÄHKÖPOSTI]
SYNTHETICA-hanke, Tampereen yliopisto

Klikkaamalla "Hyväksyn" vahvistat, että:
- Olet vähintään 18-vuotias
- Olet lukenut, ymmärtänyt ja hyväksynyt nämä ehdot
- Annat suostumuksesi anonymisoitujen tietojesi keräämiseen ja käyttöön tutkimustarkoituksiin
- Ymmärrät, että osallistumisesi on vapaaehtoista ja voit vetäytyä milloin tahansa"""


@router.get("/terms", response_model=TermsConfigResponse)
async def get_terms(
    db: AsyncSession = Depends(get_db),
    _: bool = Depends(verify_admin),
):
    """
    Get terms configuration (admin only).
    Returns the current Terms of Use and Informed Consent content.
    """
    result = await db.execute(select(TermsConfig).limit(1))
    config = result.scalar_one_or_none()

    # If no config exists, create one with defaults
    if not config:
        config = TermsConfig(
            title_en="Terms of Use and Informed Consent",
            title_fi="Käyttöehdot ja tietoinen suostumus",
            content_en=DEFAULT_TERMS_EN,
            content_fi=DEFAULT_TERMS_FI,
        )
        db.add(config)
        await db.flush()
        await db.refresh(config)

    return config


@router.put("/terms", response_model=TermsConfigResponse)
async def update_terms(
    data: TermsConfigUpdate,
    db: AsyncSession = Depends(get_db),
    _: bool = Depends(verify_admin),
):
    """
    Update terms configuration (admin only).
    Allows researchers to modify the Terms of Use and Informed Consent content.
    """
    result = await db.execute(select(TermsConfig).limit(1))
    config = result.scalar_one_or_none()

    # If no config exists, create one
    if not config:
        config = TermsConfig(
            title_en=data.title_en,
            title_fi=data.title_fi,
            content_en=data.content_en,
            content_fi=data.content_fi,
        )
        db.add(config)
    else:
        # Update existing config
        config.title_en = data.title_en
        config.title_fi = data.title_fi
        config.content_en = data.content_en
        config.content_fi = data.content_fi

    await db.flush()
    await db.refresh(config)

    return config


# ============================================================================
# LLM Configuration Endpoints
# ============================================================================

class LLMConfigResponse(BaseModel):
    """Response for a single LLM config."""

    id: str
    provider: str
    display_name: str
    api_key_preview: str | None  # "sk-abc1******" or None
    has_key: bool
    selected_model: str | None
    is_active: bool
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class LLMConfigUpdate(BaseModel):
    """Request body for updating an LLM config."""

    api_key: str | None = None  # None=don't change, ""=delete
    selected_model: str | None = None


class SetActiveProviderRequest(BaseModel):
    """Request body for setting the active provider."""

    provider: str


class ProviderInfo(BaseModel):
    """Information about a provider and its models."""

    provider: str
    display_name: str
    models: list[dict]


@router.get("/llm/providers", response_model=list[ProviderInfo])
async def get_llm_providers(
    _: bool = Depends(verify_admin),
):
    """
    Get available LLM providers with their models (admin only).
    Returns list of providers and the models they support.
    """
    providers = []
    for provider, data in AVAILABLE_MODELS.items():
        providers.append(ProviderInfo(
            provider=provider,
            display_name=data.get("display_name", provider.title()),
            models=data.get("models", []),
        ))
    return providers


@router.get("/llm/configs", response_model=list[LLMConfigResponse])
async def get_llm_configs(
    db: AsyncSession = Depends(get_db),
    _: bool = Depends(verify_admin),
):
    """
    Get all LLM configurations (admin only).
    Returns all provider configs with masked API keys.
    """
    result = await db.execute(
        select(LLMConfig).order_by(LLMConfig.provider)
    )
    configs = result.scalars().all()

    responses = []
    for config in configs:
        # Generate preview if there's an encrypted key
        api_key_preview = None
        has_key = False
        if config.encrypted_api_key:
            has_key = True
            try:
                decrypted = decrypt_api_key(config.encrypted_api_key)
                api_key_preview = generate_key_preview(decrypted)
            except Exception:
                api_key_preview = "******"

        responses.append(LLMConfigResponse(
            id=config.id,
            provider=config.provider,
            display_name=config.display_name or config.provider.title(),
            api_key_preview=api_key_preview,
            has_key=has_key,
            selected_model=config.selected_model,
            is_active=config.is_active,
            updated_at=config.updated_at,
        ))

    return responses


@router.put("/llm/configs/{provider}", response_model=LLMConfigResponse)
async def update_llm_config(
    provider: str,
    data: LLMConfigUpdate,
    db: AsyncSession = Depends(get_db),
    _: bool = Depends(verify_admin),
):
    """
    Update an LLM provider configuration (admin only).
    Allows updating the API key and/or selected model.
    """
    # Validate provider
    if provider not in AVAILABLE_MODELS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid provider. Must be one of: {list(AVAILABLE_MODELS.keys())}",
        )

    result = await db.execute(
        select(LLMConfig).where(LLMConfig.provider == provider)
    )
    config = result.scalar_one_or_none()

    # Create config if it doesn't exist
    if not config:
        config = LLMConfig(
            provider=provider,
            display_name=AVAILABLE_MODELS[provider].get("display_name", provider.title()),
        )
        db.add(config)

    # Update API key if provided
    if data.api_key is not None:
        if data.api_key == "":
            # Empty string means delete the key
            config.encrypted_api_key = None
        else:
            # Encrypt and store the new key
            config.encrypted_api_key = encrypt_api_key(data.api_key)

    # Update selected model if provided
    if data.selected_model is not None:
        # Validate the model belongs to this provider
        provider_models = get_models_for_provider(provider)
        model_ids = [m["id"] for m in provider_models]
        if data.selected_model and data.selected_model not in model_ids:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid model for {provider}. Must be one of: {model_ids}",
            )
        config.selected_model = data.selected_model

    await db.flush()
    await db.refresh(config)

    # Generate preview for response
    api_key_preview = None
    has_key = False
    if config.encrypted_api_key:
        has_key = True
        try:
            decrypted = decrypt_api_key(config.encrypted_api_key)
            api_key_preview = generate_key_preview(decrypted)
        except Exception:
            api_key_preview = "******"

    return LLMConfigResponse(
        id=config.id,
        provider=config.provider,
        display_name=config.display_name or config.provider.title(),
        api_key_preview=api_key_preview,
        has_key=has_key,
        selected_model=config.selected_model,
        is_active=config.is_active,
        updated_at=config.updated_at,
    )


@router.delete("/llm/configs/{provider}/key")
async def delete_llm_api_key(
    provider: str,
    db: AsyncSession = Depends(get_db),
    _: bool = Depends(verify_admin),
):
    """
    Delete the API key for a provider (admin only).
    """
    result = await db.execute(
        select(LLMConfig).where(LLMConfig.provider == provider)
    )
    config = result.scalar_one_or_none()

    if not config:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"LLM config for '{provider}' not found",
        )

    config.encrypted_api_key = None

    # If this was the active provider, deactivate it
    if config.is_active:
        config.is_active = False

    await db.flush()

    return {"message": f"API key for {provider} deleted successfully"}


@router.post("/llm/active", response_model=LLMConfigResponse)
async def set_active_provider(
    data: SetActiveProviderRequest,
    db: AsyncSession = Depends(get_db),
    _: bool = Depends(verify_admin),
):
    """
    Set the active LLM provider (admin only).
    Only one provider can be active at a time.
    """
    # Validate provider
    if data.provider not in AVAILABLE_MODELS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid provider. Must be one of: {list(AVAILABLE_MODELS.keys())}",
        )

    # Get the config for the requested provider
    result = await db.execute(
        select(LLMConfig).where(LLMConfig.provider == data.provider)
    )
    config = result.scalar_one_or_none()

    if not config:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"LLM config for '{data.provider}' not found. Please configure the provider first.",
        )

    # Check if the provider has an API key configured
    if not config.encrypted_api_key:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot activate {data.provider}: no API key configured.",
        )

    # Deactivate all other providers
    all_configs = await db.execute(select(LLMConfig))
    for c in all_configs.scalars().all():
        c.is_active = (c.provider == data.provider)

    await db.flush()
    await db.refresh(config)

    # Generate preview for response
    api_key_preview = None
    has_key = False
    if config.encrypted_api_key:
        has_key = True
        try:
            decrypted = decrypt_api_key(config.encrypted_api_key)
            api_key_preview = generate_key_preview(decrypted)
        except Exception:
            api_key_preview = "******"

    return LLMConfigResponse(
        id=config.id,
        provider=config.provider,
        display_name=config.display_name or config.provider.title(),
        api_key_preview=api_key_preview,
        has_key=has_key,
        selected_model=config.selected_model,
        is_active=config.is_active,
        updated_at=config.updated_at,
    )


# ============================================================================
# Experiment Configuration Endpoints
# ============================================================================


class ExperimentConfigResponse(BaseModel):
    """Response for experiment configuration."""

    id: str
    experiment_name_en: str
    experiment_name_fi: str
    start_date: date | None
    end_date: date | None
    ethics_board_name: str | None
    ethics_reference_number: str | None
    principal_investigator_name: str | None
    principal_investigator_email: str | None
    institution_name_en: str | None
    institution_name_fi: str | None
    min_exchanges_before_survey: int
    max_exchanges_per_chat: int | None
    idle_timeout_minutes: int | None
    is_active: bool
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class ExperimentConfigUpdate(BaseModel):
    """Request body for updating experiment configuration (all fields optional for partial updates)."""

    experiment_name_en: str | None = None
    experiment_name_fi: str | None = None
    start_date: date | None = None
    end_date: date | None = None
    ethics_board_name: str | None = None
    ethics_reference_number: str | None = None
    principal_investigator_name: str | None = None
    principal_investigator_email: str | None = None
    institution_name_en: str | None = None
    institution_name_fi: str | None = None
    min_exchanges_before_survey: int | None = None
    max_exchanges_per_chat: int | None = None
    idle_timeout_minutes: int | None = None
    is_active: bool | None = None


@router.get("/experiment", response_model=ExperimentConfigResponse)
async def get_experiment_config(
    db: AsyncSession = Depends(get_db),
    _: bool = Depends(verify_admin),
):
    """
    Get experiment configuration (admin only).
    Returns the singleton experiment config, creating with defaults if needed.
    """
    result = await db.execute(select(ExperimentConfig).limit(1))
    config = result.scalar_one_or_none()

    # If no config exists, create one with defaults
    if not config:
        config = ExperimentConfig()
        db.add(config)
        await db.flush()
        await db.refresh(config)

    return config


@router.put("/experiment", response_model=ExperimentConfigResponse)
async def update_experiment_config(
    data: ExperimentConfigUpdate,
    db: AsyncSession = Depends(get_db),
    _: bool = Depends(verify_admin),
):
    """
    Update experiment configuration (admin only).
    Allows researchers to modify experiment settings.
    """
    result = await db.execute(select(ExperimentConfig).limit(1))
    config = result.scalar_one_or_none()

    # If no config exists, create one
    if not config:
        config = ExperimentConfig()
        db.add(config)

    # Update only provided fields
    update_data = data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(config, field, value)

    await db.flush()
    await db.refresh(config)

    return config


# ============================================================================
# Topic Configuration Endpoints
# ============================================================================

class TopicConfigResponse(BaseModel):
    """Response for topic configuration."""

    id: str
    topic_key: str
    label_en: str
    label_fi: str
    welcome_message_en: str
    welcome_message_fi: str
    is_enabled: bool
    display_order: int
    is_sparse: bool  # Computed from coverage data
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class TopicConfigCreate(BaseModel):
    """Request body for creating a topic."""

    topic_key: str
    label_en: str
    label_fi: str
    welcome_message_en: str = ""
    welcome_message_fi: str = ""
    is_enabled: bool = True
    display_order: int = 0


class TopicConfigUpdate(BaseModel):
    """Request body for updating a topic (all fields optional for partial updates)."""

    label_en: str | None = None
    label_fi: str | None = None
    welcome_message_en: str | None = None
    welcome_message_fi: str | None = None
    is_enabled: bool | None = None
    display_order: int | None = None


class TopicReorderItem(BaseModel):
    """Single item for topic reordering."""

    topic_key: str
    display_order: int


class TopicReorderRequest(BaseModel):
    """Request body for batch reordering topics."""

    topics: list[TopicReorderItem]


class TopicReorderResponse(BaseModel):
    """Response for topic reorder operation."""

    message: str
    updated_count: int
    not_found: list[str]


@router.get("/topics", response_model=list[TopicConfigResponse])
async def get_all_topics(
    db: AsyncSession = Depends(get_db),
    _: bool = Depends(verify_admin),
):
    """
    Get all topic configurations (admin only).
    Includes sparse coverage indicator based on political statement counts.
    """
    result = await db.execute(
        select(TopicConfig).order_by(TopicConfig.display_order)
    )
    topics = result.scalars().all()

    # Get coverage counts for sparse calculation
    coverage_counts = await get_topic_coverage_counts(db)

    responses = []
    for topic in topics:
        count = coverage_counts.get(topic.topic_key, 0)
        is_sparse = count < SPARSE_COVERAGE_THRESHOLD

        responses.append(TopicConfigResponse(
            id=topic.id,
            topic_key=topic.topic_key,
            label_en=topic.label_en,
            label_fi=topic.label_fi,
            welcome_message_en=topic.welcome_message_en,
            welcome_message_fi=topic.welcome_message_fi,
            is_enabled=topic.is_enabled,
            display_order=topic.display_order,
            is_sparse=is_sparse,
            updated_at=topic.updated_at,
        ))

    return responses


@router.post("/topics", response_model=TopicConfigResponse, status_code=status.HTTP_201_CREATED)
async def create_topic(
    data: TopicConfigCreate,
    db: AsyncSession = Depends(get_db),
    _: bool = Depends(verify_admin),
):
    """
    Create a new topic configuration (admin only).
    """
    # Check if topic_key already exists
    result = await db.execute(
        select(TopicConfig).where(TopicConfig.topic_key == data.topic_key)
    )
    existing = result.scalar_one_or_none()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Topic with key '{data.topic_key}' already exists",
        )

    topic = TopicConfig(
        topic_key=data.topic_key,
        label_en=data.label_en,
        label_fi=data.label_fi,
        welcome_message_en=data.welcome_message_en,
        welcome_message_fi=data.welcome_message_fi,
        is_enabled=data.is_enabled,
        display_order=data.display_order,
    )

    db.add(topic)
    await db.flush()
    await db.refresh(topic)

    # Get coverage count for sparse calculation
    coverage_counts = await get_topic_coverage_counts(db)
    count = coverage_counts.get(topic.topic_key, 0)
    is_sparse = count < SPARSE_COVERAGE_THRESHOLD

    return TopicConfigResponse(
        id=topic.id,
        topic_key=topic.topic_key,
        label_en=topic.label_en,
        label_fi=topic.label_fi,
        welcome_message_en=topic.welcome_message_en,
        welcome_message_fi=topic.welcome_message_fi,
        is_enabled=topic.is_enabled,
        display_order=topic.display_order,
        is_sparse=is_sparse,
        updated_at=topic.updated_at,
    )


@router.put("/topics/{topic_key}", response_model=TopicConfigResponse)
async def update_topic(
    topic_key: str,
    data: TopicConfigUpdate,
    db: AsyncSession = Depends(get_db),
    _: bool = Depends(verify_admin),
):
    """
    Update a topic configuration (admin only).
    """
    result = await db.execute(
        select(TopicConfig).where(TopicConfig.topic_key == topic_key)
    )
    topic = result.scalar_one_or_none()

    if not topic:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Topic '{topic_key}' not found",
        )

    # Update only provided fields
    update_data = data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(topic, field, value)

    await db.flush()
    await db.refresh(topic)

    # Get coverage count for sparse calculation
    coverage_counts = await get_topic_coverage_counts(db)
    count = coverage_counts.get(topic.topic_key, 0)
    is_sparse = count < SPARSE_COVERAGE_THRESHOLD

    return TopicConfigResponse(
        id=topic.id,
        topic_key=topic.topic_key,
        label_en=topic.label_en,
        label_fi=topic.label_fi,
        welcome_message_en=topic.welcome_message_en,
        welcome_message_fi=topic.welcome_message_fi,
        is_enabled=topic.is_enabled,
        display_order=topic.display_order,
        is_sparse=is_sparse,
        updated_at=topic.updated_at,
    )


@router.delete("/topics/{topic_key}")
async def delete_topic(
    topic_key: str,
    db: AsyncSession = Depends(get_db),
    _: bool = Depends(verify_admin),
):
    """
    Delete a topic configuration (admin only).
    """
    result = await db.execute(
        select(TopicConfig).where(TopicConfig.topic_key == topic_key)
    )
    topic = result.scalar_one_or_none()

    if not topic:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Topic '{topic_key}' not found",
        )

    await db.delete(topic)
    await db.flush()

    return {"message": f"Topic '{topic_key}' deleted successfully"}


@router.put("/topics/reorder", response_model=TopicReorderResponse)
async def reorder_topics(
    data: TopicReorderRequest,
    db: AsyncSession = Depends(get_db),
    _: bool = Depends(verify_admin),
):
    """
    Batch update display order for topics (admin only).

    Returns:
        - updated_count: Number of topics successfully updated
        - not_found: List of topic_keys that were not found in the database
    """
    updated_count = 0
    not_found = []

    for item in data.topics:
        result = await db.execute(
            select(TopicConfig).where(TopicConfig.topic_key == item.topic_key)
        )
        topic = result.scalar_one_or_none()

        if topic:
            topic.display_order = item.display_order
            updated_count += 1
        else:
            not_found.append(item.topic_key)

    await db.flush()

    return TopicReorderResponse(
        message=f"Reordered {updated_count} topic(s) successfully",
        updated_count=updated_count,
        not_found=not_found,
    )


# ============================================================================
# Logs Export Endpoints
# ============================================================================

class LogsExportInfo(BaseModel):
    """Information about available logs for export."""
    file_count: int
    total_size_bytes: int
    total_size_formatted: str


@router.get("/export/logs-info", response_model=LogsExportInfo)
async def get_logs_info(_: bool = Depends(verify_admin)):
    """Get information about available conversation logs."""
    logs_dir = Path(__file__).parent.parent.parent.parent / "logs"

    if not logs_dir.exists():
        return LogsExportInfo(file_count=0, total_size_bytes=0, total_size_formatted="0 B")

    log_files = list(logs_dir.glob("*.txt"))
    total_size = sum(f.stat().st_size for f in log_files)

    # Format size
    if total_size < 1024:
        size_str = f"{total_size} B"
    elif total_size < 1024 * 1024:
        size_str = f"{total_size / 1024:.1f} KB"
    else:
        size_str = f"{total_size / (1024 * 1024):.1f} MB"

    return LogsExportInfo(
        file_count=len(log_files),
        total_size_bytes=total_size,
        total_size_formatted=size_str,
    )


@router.get("/export/logs-zip")
async def download_logs_zip(_: bool = Depends(verify_admin)):
    """Download all conversation logs as a ZIP file."""
    logs_dir = Path(__file__).parent.parent.parent.parent / "logs"

    if not logs_dir.exists():
        raise HTTPException(status_code=404, detail="No logs directory found")

    log_files = list(logs_dir.glob("*.txt"))

    if not log_files:
        raise HTTPException(status_code=404, detail="No conversation logs found")

    # Create ZIP in memory
    zip_buffer = io.BytesIO()
    with zipfile.ZipFile(zip_buffer, 'w', zipfile.ZIP_DEFLATED) as zf:
        for log_file in log_files:
            zf.write(log_file, log_file.name)

    zip_buffer.seek(0)

    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
    filename = f"conversation_logs_{timestamp}.zip"

    return StreamingResponse(
        zip_buffer,
        media_type="application/zip",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )


# ============================================================================
# Chat List and Detail Endpoints
# ============================================================================


@router.get("/chats", response_model=ChatListResponse)
async def list_chats(
    political_block: str | None = None,
    topic_category: str | None = None,
    detection_result: str | None = None,  # "correct" | "incorrect" | "pending"
    language: str | None = None,
    search: str | None = None,  # searches Message.content via ILIKE
    exclude_test: bool = True,
    page: int = 1,
    per_page: int = 20,
    db: AsyncSession = Depends(get_db),
    _: bool = Depends(verify_admin),
):
    """
    Paginated, filtered list of chat sessions (admin only).

    Filtering logic:
    - exclude_test: omit chats created in test mode (default True)
    - political_block / topic_category / language: exact-match column filters
    - detection_result: "correct" means perceived_leaning == political_block for completed chats;
      "incorrect" is the opposite; "pending" means perceived_leaning is still NULL
    - search: substring match on message content — implemented as a subquery so the
      outer query stays a single SELECT on chats (avoids a JOIN that multiplies rows)

    Pagination uses OFFSET/LIMIT. Total is a separate COUNT query on the same filters
    so we avoid fetching all rows just to count them.
    """
    # --- build the base filter predicate list ---
    filters = []

    if exclude_test:
        filters.append(Chat.is_test_mode == False)
    if political_block:
        filters.append(Chat.political_block == political_block)
    if topic_category:
        filters.append(Chat.topic_category == topic_category)
    if language:
        filters.append(Chat.language == language)

    if detection_result == "correct":
        filters.append(Chat.is_complete == True)
        filters.append(Chat.perceived_leaning == Chat.political_block)
    elif detection_result == "incorrect":
        filters.append(Chat.is_complete == True)
        filters.append(Chat.perceived_leaning != Chat.political_block)
    elif detection_result == "pending":
        filters.append(Chat.perceived_leaning == None)

    if search:
        # Subquery: collect chat IDs that have at least one matching message.
        # Using a subquery rather than a JOIN prevents row multiplication when
        # a chat has multiple matching messages.
        subquery = select(Message.chat_id).where(
            Message.content.ilike(f"%{search}%")
        )
        filters.append(Chat.id.in_(subquery))

    # --- count total matching rows (no ORDER BY / OFFSET for efficiency) ---
    count_query = select(func.count(Chat.id)).where(*filters)
    total_result = await db.execute(count_query)
    total = total_result.scalar() or 0

    # --- fetch the page of chats with messages eagerly loaded ---
    offset = (page - 1) * per_page
    data_query = (
        select(Chat)
        .options(selectinload(Chat.messages))
        .where(*filters)
        .order_by(Chat.created_at.desc())
        .offset(offset)
        .limit(per_page)
    )
    result = await db.execute(data_query)
    chats = result.scalars().all()

    # --- build response items ---
    items: list[ChatListItem] = []
    for chat in chats:
        # correct_guess is a computed field, not a DB column
        if chat.is_complete and chat.perceived_leaning is not None:
            correct_guess: bool | None = (chat.perceived_leaning == chat.political_block)
        else:
            correct_guess = None

        items.append(ChatListItem(
            id=chat.id,
            created_at=chat.created_at,
            completed_at=chat.completed_at,
            political_block=chat.political_block,
            topic_category=chat.topic_category,
            language=chat.language,
            message_count=len(chat.messages),
            perceived_leaning=chat.perceived_leaning,
            correct_guess=correct_guess,
            persuasiveness=chat.persuasiveness,
            naturalness=chat.naturalness,
            confidence=chat.confidence,
            is_test_mode=chat.is_test_mode,
        ))

    return ChatListResponse(chats=items, total=total, page=page, per_page=per_page)


@router.get("/chats/{chat_id}/detail", response_model=ChatDetailResponse)
async def get_chat_detail(
    chat_id: str,
    db: AsyncSession = Depends(get_db),
    _: bool = Depends(verify_admin),
):
    """
    Full detail for a single chat session (admin only).

    Returns the chat's messages (ordered by created_at, as configured on the
    relationship), the post-chat survey answers with computed correct_guess,
    the cached few-shot examples (JSON blob set at chat creation), and a
    summary of the participant's demographics.
    """
    result = await db.execute(
        select(Chat)
        .options(
            selectinload(Chat.messages),
            selectinload(Chat.participant),
        )
        .where(Chat.id == chat_id)
    )
    chat = result.scalar_one_or_none()

    if not chat:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Chat '{chat_id}' not found",
        )

    # Compute correct_guess: only meaningful once the participant has submitted
    # a survey answer (perceived_leaning is set).
    if chat.is_complete and chat.perceived_leaning is not None:
        correct_guess: bool | None = (chat.perceived_leaning == chat.political_block)
    else:
        correct_guess = None

    messages = [
        MessageDetail(
            id=m.id,
            role=m.role,
            content=m.content,
            created_at=m.created_at,
            token_count=m.token_count,
            examples_used_ids=m.examples_used_ids,
        )
        for m in chat.messages
    ]

    survey = SurveyDetail(
        perceived_leaning=chat.perceived_leaning,
        correct_guess=correct_guess,
        persuasiveness=chat.persuasiveness,
        naturalness=chat.naturalness,
        confidence=chat.confidence,
    )

    participant = chat.participant
    participant_summary = ParticipantSummary(
        age_group=participant.age_group if participant else None,
        gender=participant.gender if participant else None,
        education=participant.education if participant else None,
        political_leaning=participant.political_leaning if participant else None,
        political_knowledge=participant.political_knowledge if participant else None,
    )

    return ChatDetailResponse(
        id=chat.id,
        political_block=chat.political_block,
        topic_category=chat.topic_category,
        language=chat.language,
        created_at=chat.created_at,
        completed_at=chat.completed_at,
        few_shot_examples=chat.few_shot_examples,
        messages=messages,
        survey=survey,
        participant=participant_summary,
    )


# ============================================================================
# Detailed Statistics Endpoint
# ============================================================================


class BlockAccuracy(BaseModel):
    """Per-block detection accuracy for completed non-test chats."""

    total: int
    correct: int
    accuracy_pct: float


class PersuasivenessCell(BaseModel):
    """Average persuasiveness rating and sample count for one block × topic cell."""

    avg: float
    count: int


class DetailedStatsResponse(BaseModel):
    """
    Multi-dimensional statistics for deeper experiment analysis.

    - block_accuracy: Detection rate per political block (% correct guesses).
    - persuasiveness_matrix: Average persuasiveness per block × topic pair.
    - length_distribution: Chat exchange-count histogram per block.
    - coverage_matrix: Number of political statements per block × topic.
    """

    block_accuracy: dict[str, BlockAccuracy]
    persuasiveness_matrix: dict[str, dict[str, PersuasivenessCell | None]]
    length_distribution: dict[str, dict[int, int]]  # block -> {exchange_count: chat_count}
    coverage_matrix: dict[str, dict[str, int]]       # block -> topic -> statement_count


@router.get("/stats/detailed", response_model=DetailedStatsResponse)
async def get_detailed_stats(
    db: AsyncSession = Depends(get_db),
    _: bool = Depends(verify_admin),
):
    """
    Return multi-dimensional statistics for the experiment (admin only).

    All counts exclude test-mode chats so results reflect real participant data.
    """

    # --- 1. block_accuracy ---
    # Count total completed chats and correct guesses per block in two queries.
    # A "correct" guess means perceived_leaning matches the secretly assigned block.
    total_by_block_result = await db.execute(
        select(Chat.political_block, func.count(Chat.id))
        .where(Chat.is_complete == True)
        .where(Chat.is_test_mode == False)
        .group_by(Chat.political_block)
    )
    total_by_block = {row[0]: row[1] for row in total_by_block_result.all()}

    correct_by_block_result = await db.execute(
        select(Chat.political_block, func.count(Chat.id))
        .where(Chat.is_complete == True)
        .where(Chat.is_test_mode == False)
        .where(Chat.perceived_leaning == Chat.political_block)
        .group_by(Chat.political_block)
    )
    correct_by_block = {row[0]: row[1] for row in correct_by_block_result.all()}

    block_accuracy: dict[str, BlockAccuracy] = {}
    for block in VALID_BLOCKS:
        total = total_by_block.get(block, 0)
        correct = correct_by_block.get(block, 0)
        accuracy_pct = (correct / total * 100.0) if total > 0 else 0.0
        block_accuracy[block] = BlockAccuracy(total=total, correct=correct, accuracy_pct=accuracy_pct)

    # --- 2. persuasiveness_matrix ---
    # AVG and COUNT of persuasiveness for each block × topic cell.
    # Only rows where persuasiveness is not NULL contribute to averages.
    persuasiveness_result = await db.execute(
        select(
            Chat.political_block,
            Chat.topic_category,
            func.avg(Chat.persuasiveness),
            func.count(Chat.id),
        )
        .where(Chat.is_complete == True)
        .where(Chat.is_test_mode == False)
        .where(Chat.persuasiveness != None)
        .group_by(Chat.political_block, Chat.topic_category)
    )

    # Build a nested dict; keys that are absent stay as None in the matrix.
    persuasiveness_raw: dict[str, dict[str, PersuasivenessCell]] = {}
    for block, topic, avg_val, cnt in persuasiveness_result.all():
        if block not in persuasiveness_raw:
            persuasiveness_raw[block] = {}
        persuasiveness_raw[block][topic] = PersuasivenessCell(avg=float(avg_val), count=cnt)

    # Materialise the full matrix with None for missing cells.
    all_topics_result = await db.execute(select(Chat.topic_category).distinct())
    all_topics = {row[0] for row in all_topics_result.all()}

    persuasiveness_matrix: dict[str, dict[str, PersuasivenessCell | None]] = {}
    for block in VALID_BLOCKS:
        persuasiveness_matrix[block] = {}
        for topic in all_topics:
            persuasiveness_matrix[block][topic] = persuasiveness_raw.get(block, {}).get(topic)

    # --- 3. length_distribution ---
    # Load message counts per chat in a single aggregating query, then group in
    # Python by (block, exchange_count) to avoid a complex SQL CASE expression.
    # exchange_count = message_count // 2  (each exchange = 1 user + 1 assistant turn)
    msg_count_result = await db.execute(
        select(Chat.political_block, func.count(Message.id).label("msg_count"))
        .join(Message, Message.chat_id == Chat.id, isouter=True)
        .where(Chat.is_test_mode == False)
        .group_by(Chat.id, Chat.political_block)
    )

    length_distribution: dict[str, dict[int, int]] = {block: {} for block in VALID_BLOCKS}
    for block, msg_count in msg_count_result.all():
        exchange_count = (msg_count or 0) // 2
        if block in length_distribution:
            length_distribution[block][exchange_count] = (
                length_distribution[block].get(exchange_count, 0) + 1
            )

    # --- 4. coverage_matrix ---
    # Count political statements in the dataset per block × topic.
    coverage_result = await db.execute(
        select(
            PoliticalStatement.political_block,
            PoliticalStatement.topic_category,
            func.count(PoliticalStatement.id),
        )
        .group_by(PoliticalStatement.political_block, PoliticalStatement.topic_category)
    )

    coverage_matrix: dict[str, dict[str, int]] = {}
    for block, topic, cnt in coverage_result.all():
        if block not in coverage_matrix:
            coverage_matrix[block] = {}
        coverage_matrix[block][topic] = cnt

    return DetailedStatsResponse(
        block_accuracy=block_accuracy,
        persuasiveness_matrix=persuasiveness_matrix,
        length_distribution=length_distribution,
        coverage_matrix=coverage_matrix,
    )


# ============================================================================
# Political Statements Endpoint
# ============================================================================


class StatementItem(BaseModel):
    """Single political statement row for admin inspection."""

    id: int
    external_id: int
    political_block: str
    topic_category: str
    topic_detailed: str
    final_output_en: str
    final_output_fi: str | None
    intention_of_statement: str

    model_config = ConfigDict(from_attributes=True)


class StatementListResponse(BaseModel):
    """Paginated list of political statements."""

    statements: list[StatementItem]
    total: int
    page: int
    per_page: int


@router.get("/statements", response_model=StatementListResponse)
async def list_statements(
    political_block: str | None = None,
    topic_category: str | None = None,
    page: int = 1,
    per_page: int = 20,
    db: AsyncSession = Depends(get_db),
    _: bool = Depends(verify_admin),
):
    """
    Paginated list of political statements from the dataset (admin only).

    Useful for verifying the few-shot corpus and auditing statement coverage
    before or after seeding.

    Filters:
        political_block: Exact match on the block column.
        topic_category: Exact match on the topic column.
    """
    filters = []
    if political_block:
        filters.append(PoliticalStatement.political_block == political_block)
    if topic_category:
        filters.append(PoliticalStatement.topic_category == topic_category)

    # COUNT query — no ORDER BY for efficiency.
    count_query = select(func.count(PoliticalStatement.id))
    if filters:
        count_query = count_query.where(*filters)
    total_result = await db.execute(count_query)
    total = total_result.scalar() or 0

    # Fetch requested page, ordered by id for stable pagination.
    offset = (page - 1) * per_page
    data_query = (
        select(PoliticalStatement)
        .order_by(PoliticalStatement.id)
        .offset(offset)
        .limit(per_page)
    )
    if filters:
        data_query = data_query.where(*filters)

    result = await db.execute(data_query)
    statements = result.scalars().all()

    return StatementListResponse(
        statements=[StatementItem.model_validate(s) for s in statements],
        total=total,
        page=page,
        per_page=per_page,
    )

import io
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, status, Header
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, ConfigDict
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from ..config import get_settings
from ..database import get_db
from ..models import Participant, Chat, Message, PoliticalStatement, PromptConfig

router = APIRouter()
settings = get_settings()

VALID_BLOCKS = ["conservative", "red-green", "moderate", "dissatisfied"]
VALID_TOPICS = [
    "immigration", "healthcare", "economy", "education",
    "foreign_policy", "environment", "technology", "equality", "social_welfare"
]


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

    if data.topic_category not in VALID_TOPICS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid topic. Must be one of: {VALID_TOPICS}",
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
    if topic_category not in VALID_TOPICS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid topic. Must be one of: {VALID_TOPICS}",
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
    db: AsyncSession = Depends(get_db),
    _: bool = Depends(verify_admin),
):
    """
    Export research data for analysis.

    Args:
        format: 'csv' or 'json'
        include_test: Include test mode chats (default: False)

    Returns:
        CSV or JSON file with all completed chats and their data
    """
    # Build query for chats
    query = (
        select(Chat)
        .options(
            selectinload(Chat.participant),
            selectinload(Chat.messages),
        )
        .where(Chat.is_complete == True)
    )

    if not include_test:
        query = query.where(Chat.is_test_mode == False)

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

    if format == "json":
        import json
        content = json.dumps(rows, indent=2)
        return StreamingResponse(
            io.BytesIO(content.encode()),
            media_type="application/json",
            headers={"Content-Disposition": f"attachment; filename=research_export_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"},
        )
    else:
        # CSV format
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

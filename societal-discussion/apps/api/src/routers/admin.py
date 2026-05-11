"""
Admin endpoints for manipulative-ai2.

Provides experiment statistics, data export, conversation viewer,
LLM configuration, and experiment settings management.

All endpoints require X-Admin-Password header.
"""

import io
import csv
import json
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
    Session, Conversation, Message, SurveyResponse,
    LLMConfig, ExperimentConfig, PromptConfig,
)
from ..services.encryption import encrypt_api_key, decrypt_api_key, generate_key_preview
from ..services.llm_models import AVAILABLE_MODELS, get_models_for_provider
from ..services.party_grounding import ALL_PARTIES, PARTY_DISPLAY_NAMES

router = APIRouter()
settings = get_settings()


def verify_admin(x_admin_password: str = Header(None)):
    """Verify admin password from header."""
    if x_admin_password != settings.admin_password:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid admin password",
        )
    return True


# ============================================================================
# Statistics
# ============================================================================


class StatsResponse(BaseModel):
    """Overall experiment statistics."""

    total_sessions: int
    total_conversations: int
    completed_conversations: int
    total_messages: int
    conversations_by_party: dict[str, int]
    total_surveys: int


@router.get("/stats", response_model=StatsResponse)
async def get_stats(
    db: AsyncSession = Depends(get_db),
    _: bool = Depends(verify_admin),
):
    """Get experiment statistics (admin only)."""
    sessions_result = await db.execute(select(func.count(Session.id)))
    total_sessions = sessions_result.scalar() or 0

    convs_result = await db.execute(select(func.count(Conversation.id)))
    total_conversations = convs_result.scalar() or 0

    completed = await db.execute(
        select(func.count(Conversation.id)).where(Conversation.is_complete == True)
    )
    completed_conversations = completed.scalar() or 0

    messages_result = await db.execute(select(func.count(Message.id)))
    total_messages = messages_result.scalar() or 0

    # Conversations by party
    party_result = await db.execute(
        select(Conversation.assigned_party, func.count(Conversation.id))
        .group_by(Conversation.assigned_party)
    )
    conversations_by_party = {row[0]: row[1] for row in party_result.all()}

    surveys_result = await db.execute(select(func.count(SurveyResponse.id)))
    total_surveys = surveys_result.scalar() or 0

    return StatsResponse(
        total_sessions=total_sessions,
        total_conversations=total_conversations,
        completed_conversations=completed_conversations,
        total_messages=total_messages,
        conversations_by_party=conversations_by_party,
        total_surveys=total_surveys,
    )


# ============================================================================
# Delete All Conversation Data
# ============================================================================


@router.delete("/data/reset")
async def reset_all_data(
    db: AsyncSession = Depends(get_db),
    _: bool = Depends(verify_admin),
):
    """
    Delete all conversation data: messages, conversations, sessions, survey responses.
    Does NOT delete prompt configs, LLM configs, or experiment configs.
    Does NOT delete party program text files.
    """
    # Delete in order to respect foreign keys
    await db.execute(Message.__table__.delete())
    await db.execute(SurveyResponse.__table__.delete())
    await db.execute(Conversation.__table__.delete())
    await db.execute(Session.__table__.delete())

    return {
        "status": "ok",
        "message": "All conversation data deleted (sessions, conversations, messages, surveys).",
    }


# ============================================================================
# Admin Conversation Management
# ============================================================================


class AdminConversationCreate(BaseModel):
    """Admin-only: create conversation with specific party (for testing)."""

    session_id: str
    assigned_party: str
    starter_topic: str | None = None


class AdminConversationResponse(BaseModel):
    """Admin response includes the assigned party."""

    id: str
    session_id: str
    assigned_party: str
    starter_topic: str | None
    is_complete: bool
    is_test_mode: bool

    model_config = ConfigDict(from_attributes=True)


@router.post("/conversations", response_model=AdminConversationResponse, status_code=status.HTTP_201_CREATED)
async def admin_create_conversation(
    data: AdminConversationCreate,
    db: AsyncSession = Depends(get_db),
    _: bool = Depends(verify_admin),
):
    """Create a conversation with a specific party (admin/testing only)."""
    if data.assigned_party not in ALL_PARTIES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid party. Must be one of: {ALL_PARTIES}",
        )

    result = await db.execute(
        select(Session).where(Session.id == data.session_id)
    )
    session = result.scalar_one_or_none()

    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Session not found",
        )

    conversation = Conversation(
        session_id=session.id,
        assigned_party=data.assigned_party,
        starter_topic=data.starter_topic,
        is_test_mode=True,
    )

    db.add(conversation)
    await db.flush()
    await db.refresh(conversation)

    return AdminConversationResponse(
        id=conversation.id,
        session_id=conversation.session_id,
        assigned_party=conversation.assigned_party,
        starter_topic=conversation.starter_topic,
        is_complete=conversation.is_complete,
        is_test_mode=conversation.is_test_mode,
    )


# ============================================================================
# Conversation List and Detail
# ============================================================================


class ConversationListItem(BaseModel):
    """Single conversation row in the admin list."""

    id: str
    session_id: str
    assigned_party: str
    starter_topic: str | None
    started_at: datetime
    ended_at: datetime | None
    message_count: int
    is_complete: bool
    is_test_mode: bool

    model_config = ConfigDict(from_attributes=True)


class ConversationListResponse(BaseModel):
    """Paginated conversation list response."""

    conversations: list[ConversationListItem]
    total: int
    page: int
    per_page: int


class MessageDetail(BaseModel):
    """Message in conversation detail view."""

    id: str
    role: str
    content: str
    created_at: datetime
    token_count: int | None

    model_config = ConfigDict(from_attributes=True)


class ConversationDetailResponse(BaseModel):
    """Full conversation detail."""

    id: str
    session_id: str
    assigned_party: str
    starter_topic: str | None
    started_at: datetime
    ended_at: datetime | None
    is_complete: bool
    is_test_mode: bool
    messages: list[MessageDetail]

    model_config = ConfigDict(from_attributes=True)


@router.get("/conversations", response_model=ConversationListResponse)
async def list_conversations(
    assigned_party: str | None = None,
    search: str | None = None,
    exclude_test: bool = True,
    page: int = 1,
    per_page: int = 20,
    db: AsyncSession = Depends(get_db),
    _: bool = Depends(verify_admin),
):
    """Paginated, filtered list of conversations (admin only)."""
    filters = []

    if exclude_test:
        filters.append(Conversation.is_test_mode == False)
    if assigned_party:
        filters.append(Conversation.assigned_party == assigned_party)

    if search:
        subquery = select(Message.conversation_id).where(
            Message.content.ilike(f"%{search}%")
        )
        filters.append(Conversation.id.in_(subquery))

    count_query = select(func.count(Conversation.id)).where(*filters) if filters else select(func.count(Conversation.id))
    total_result = await db.execute(count_query)
    total = total_result.scalar() or 0

    offset = (page - 1) * per_page
    data_query = (
        select(Conversation)
        .options(selectinload(Conversation.messages))
        .order_by(Conversation.started_at.desc())
        .offset(offset)
        .limit(per_page)
    )
    if filters:
        data_query = data_query.where(*filters)

    result = await db.execute(data_query)
    conversations = result.scalars().all()

    items = [
        ConversationListItem(
            id=conv.id,
            session_id=conv.session_id,
            assigned_party=conv.assigned_party,
            starter_topic=conv.starter_topic,
            started_at=conv.started_at,
            ended_at=conv.ended_at,
            message_count=len(conv.messages),
            is_complete=conv.is_complete,
            is_test_mode=conv.is_test_mode,
        )
        for conv in conversations
    ]

    return ConversationListResponse(
        conversations=items,
        total=total,
        page=page,
        per_page=per_page,
    )


@router.get("/conversations/{conversation_id}/detail", response_model=ConversationDetailResponse)
async def get_conversation_detail(
    conversation_id: str,
    db: AsyncSession = Depends(get_db),
    _: bool = Depends(verify_admin),
):
    """Full detail for a single conversation (admin only)."""
    result = await db.execute(
        select(Conversation)
        .options(selectinload(Conversation.messages))
        .where(Conversation.id == conversation_id)
    )
    conversation = result.scalar_one_or_none()

    if not conversation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Conversation '{conversation_id}' not found",
        )

    messages = [
        MessageDetail(
            id=m.id,
            role=m.role,
            content=m.content,
            created_at=m.created_at,
            token_count=m.token_count,
        )
        for m in conversation.messages
    ]

    return ConversationDetailResponse(
        id=conversation.id,
        session_id=conversation.session_id,
        assigned_party=conversation.assigned_party,
        starter_topic=conversation.starter_topic,
        started_at=conversation.started_at,
        ended_at=conversation.ended_at,
        is_complete=conversation.is_complete,
        is_test_mode=conversation.is_test_mode,
        messages=messages,
    )


# ============================================================================
# Sessions list
# ============================================================================


class SessionListItem(BaseModel):
    """Session summary for admin list."""

    id: str
    created_at: datetime
    conversation_count: int
    is_test_mode: bool

    model_config = ConfigDict(from_attributes=True)


@router.get("/sessions", response_model=list[SessionListItem])
async def list_sessions(
    db: AsyncSession = Depends(get_db),
    _: bool = Depends(verify_admin),
):
    """List all sessions with conversation counts."""
    result = await db.execute(
        select(Session)
        .options(selectinload(Session.conversations))
        .order_by(Session.created_at.desc())
    )
    sessions = result.scalars().all()

    return [
        SessionListItem(
            id=s.id,
            created_at=s.created_at,
            conversation_count=len(s.conversations),
            is_test_mode=s.is_test_mode,
        )
        for s in sessions
    ]


# ============================================================================
# Data Export
# ============================================================================


@router.get("/export")
async def export_data(
    format: str = "csv",
    include_test: bool = False,
    assigned_party: str | None = None,
    date_from: date | None = None,
    date_to: date | None = None,
    db: AsyncSession = Depends(get_db),
    _: bool = Depends(verify_admin),
):
    """
    Export research data for analysis.

    Formats: 'csv' (default), 'json', or 'text' (ZIP of per-conversation transcripts)
    """
    filters = []

    if not include_test:
        filters.append(Conversation.is_test_mode == False)
    if assigned_party:
        filters.append(Conversation.assigned_party == assigned_party)
    if date_from:
        from sqlalchemy import cast, Date as SADate
        filters.append(cast(Conversation.started_at, SADate) >= date_from)
    if date_to:
        from sqlalchemy import cast, Date as SADate
        filters.append(cast(Conversation.started_at, SADate) <= date_to)

    query = select(Conversation).options(selectinload(Conversation.messages))
    if filters:
        query = query.where(*filters)

    result = await db.execute(query)
    conversations = result.scalars().all()

    rows = []
    for conv in conversations:
        message_count = len(conv.messages)
        user_messages = [m for m in conv.messages if m.role == "user"]
        assistant_messages = [m for m in conv.messages if m.role == "assistant"]

        # Build full transcript as readable text
        transcript_lines = []
        for m in conv.messages:
            role_label = "USER" if m.role == "user" else "BOT"
            transcript_lines.append(f"[{role_label}]: {m.content}")
        full_transcript = "\n".join(transcript_lines)

        rows.append({
            "conversation_id": conv.id,
            "session_id": conv.session_id,
            "assigned_party": conv.assigned_party,
            "starter_topic": conv.starter_topic or "",
            "is_complete": conv.is_complete,
            "message_count": message_count,
            "user_message_count": len(user_messages),
            "assistant_message_count": len(assistant_messages),
            "is_test_mode": conv.is_test_mode,
            "started_at": conv.started_at.isoformat() if conv.started_at else None,
            "ended_at": conv.ended_at.isoformat() if conv.ended_at else None,
            "full_transcript": full_transcript,
        })

    if format == "text":
        from ..services.conversation_logger import format_conversation_log

        zip_buffer = io.BytesIO()
        with zipfile.ZipFile(zip_buffer, "w", zipfile.ZIP_DEFLATED) as zf:
            for conv in conversations:
                transcript = format_conversation_log(conv)
                ts = conv.ended_at or conv.started_at or datetime.now()
                ts_str = ts.strftime("%Y%m%d_%H%M%S")
                filename = f"{ts_str}_{conv.assigned_party}_{conv.id[:8]}.txt"
                zf.writestr(filename, transcript)

        zip_buffer.seek(0)
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        return StreamingResponse(
            zip_buffer,
            media_type="application/zip",
            headers={"Content-Disposition": f"attachment; filename=transcripts_{timestamp}.zip"},
        )

    elif format == "json":
        content = json.dumps(rows, indent=2)
        return StreamingResponse(
            io.BytesIO(content.encode()),
            media_type="application/json",
            headers={"Content-Disposition": f"attachment; filename=export_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"},
        )
    else:
        output = io.StringIO()
        if rows:
            writer = csv.DictWriter(output, fieldnames=rows[0].keys())
            writer.writeheader()
            writer.writerows(rows)

        content = output.getvalue()
        return StreamingResponse(
            io.BytesIO(content.encode()),
            media_type="text/csv",
            headers={"Content-Disposition": f"attachment; filename=export_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"},
        )


# ============================================================================
# LLM Configuration Endpoints (kept from manipulative-ai1)
# ============================================================================


class LLMConfigResponse(BaseModel):
    """Response for a single LLM config."""

    id: str
    provider: str
    display_name: str
    api_key_preview: str | None
    has_key: bool
    selected_model: str | None
    is_active: bool
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class LLMConfigUpdate(BaseModel):
    """Request body for updating an LLM config."""

    api_key: str | None = None
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
async def get_llm_providers(_: bool = Depends(verify_admin)):
    """Get available LLM providers with their models."""
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
    """Get all LLM configurations with masked API keys."""
    result = await db.execute(select(LLMConfig).order_by(LLMConfig.provider))
    configs = result.scalars().all()

    responses = []
    for config in configs:
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
    """Update an LLM provider configuration."""
    if provider not in AVAILABLE_MODELS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid provider. Must be one of: {list(AVAILABLE_MODELS.keys())}",
        )

    result = await db.execute(select(LLMConfig).where(LLMConfig.provider == provider))
    config = result.scalar_one_or_none()

    if not config:
        config = LLMConfig(
            provider=provider,
            display_name=AVAILABLE_MODELS[provider].get("display_name", provider.title()),
        )
        db.add(config)

    if data.api_key is not None:
        if data.api_key == "":
            config.encrypted_api_key = None
        else:
            config.encrypted_api_key = encrypt_api_key(data.api_key)

    if data.selected_model is not None:
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


@router.post("/llm/active", response_model=LLMConfigResponse)
async def set_active_provider(
    data: SetActiveProviderRequest,
    db: AsyncSession = Depends(get_db),
    _: bool = Depends(verify_admin),
):
    """Set the active LLM provider."""
    if data.provider not in AVAILABLE_MODELS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid provider. Must be one of: {list(AVAILABLE_MODELS.keys())}",
        )

    result = await db.execute(select(LLMConfig).where(LLMConfig.provider == data.provider))
    config = result.scalar_one_or_none()

    if not config:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"LLM config for '{data.provider}' not found.",
        )

    if not config.encrypted_api_key:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot activate {data.provider}: no API key configured.",
        )

    all_configs = await db.execute(select(LLMConfig))
    for c in all_configs.scalars().all():
        c.is_active = (c.provider == data.provider)

    await db.flush()
    await db.refresh(config)

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
    """Request body for updating experiment configuration."""

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
    """Get experiment configuration."""
    result = await db.execute(select(ExperimentConfig).limit(1))
    config = result.scalar_one_or_none()

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
    """Update experiment configuration."""
    result = await db.execute(select(ExperimentConfig).limit(1))
    config = result.scalar_one_or_none()

    if not config:
        config = ExperimentConfig()
        db.add(config)

    update_data = data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(config, field, value)

    await db.flush()
    await db.refresh(config)

    return config


# ============================================================================
# Logs Export
# ============================================================================


class LogsExportInfo(BaseModel):
    """Information about available logs."""

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
# Prompt Configuration Endpoints
# ============================================================================

from ..services.prompt_builder import DEFAULT_SYSTEM_INSTRUCTION, build_system_prompt


class PromptConfigResponse(BaseModel):
    """Response for a single prompt config."""

    party: str
    party_display_name: str
    system_instruction: str
    source: str  # "database" or "default"
    prompt_preview: str  # first 500 chars of assembled system prompt
    updated_at: datetime | None = None

    model_config = ConfigDict(from_attributes=True)


class PromptConfigUpdate(BaseModel):
    """Request body for updating a prompt."""

    system_instruction: str


@router.get("/prompts", response_model=list[PromptConfigResponse])
async def get_all_prompts(
    db: AsyncSession = Depends(get_db),
    _: bool = Depends(verify_admin),
):
    """Get all prompts — DB override or default for each party."""
    result = await db.execute(
        select(PromptConfig).order_by(PromptConfig.party)
    )
    db_configs = {c.party: c for c in result.scalars().all()}

    prompts: list[PromptConfigResponse] = []
    for party in ALL_PARTIES:
        db_cfg = db_configs.get(party)

        if db_cfg:
            instruction = db_cfg.system_instruction
            source = "database"
            updated_at = db_cfg.updated_at
        else:
            instruction = DEFAULT_SYSTEM_INSTRUCTION
            source = "default"
            updated_at = None

        preview = build_system_prompt(party, instruction)

        prompts.append(PromptConfigResponse(
            party=party,
            party_display_name=PARTY_DISPLAY_NAMES.get(party, party),
            system_instruction=instruction,
            source=source,
            prompt_preview=preview[:500] + "..." if len(preview) > 500 else preview,
            updated_at=updated_at,
        ))

    return prompts


@router.put("/prompts/{party}", response_model=PromptConfigResponse)
async def update_prompt(
    party: str,
    data: PromptConfigUpdate,
    db: AsyncSession = Depends(get_db),
    _: bool = Depends(verify_admin),
):
    """Update the system instruction for a party."""
    if party not in ALL_PARTIES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid party. Must be one of: {ALL_PARTIES}",
        )

    result = await db.execute(
        select(PromptConfig).where(PromptConfig.party == party)
    )
    config = result.scalar_one_or_none()

    if config:
        config.system_instruction = data.system_instruction
    else:
        config = PromptConfig(
            party=party,
            system_instruction=data.system_instruction,
        )
        db.add(config)

    await db.flush()
    await db.refresh(config)

    preview = build_system_prompt(party, config.system_instruction)

    return PromptConfigResponse(
        party=party,
        party_display_name=PARTY_DISPLAY_NAMES.get(party, party),
        system_instruction=config.system_instruction,
        source="database",
        prompt_preview=preview[:500] + "..." if len(preview) > 500 else preview,
        updated_at=config.updated_at,
    )


@router.delete("/prompts/{party}")
async def reset_prompt(
    party: str,
    db: AsyncSession = Depends(get_db),
    _: bool = Depends(verify_admin),
):
    """Reset a prompt to the default system instruction."""
    if party not in ALL_PARTIES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid party. Must be one of: {ALL_PARTIES}",
        )

    result = await db.execute(
        select(PromptConfig).where(PromptConfig.party == party)
    )
    config = result.scalar_one_or_none()

    if config:
        await db.delete(config)

    return {"status": "ok", "message": f"Prompt for '{party}' reset to default"}

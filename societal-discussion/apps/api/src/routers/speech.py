"""
Speech endpoints for the chat page.

POST /api/speech/transcribe?conversation_id=..&language=..  body: the recording as
    recorded (Content-Type audio/webm or audio/mp4) -> {text}
POST /api/speech/synthesize   {conversation_id, text, language, index} -> MP3 (base64) + word timings

Both need a conversation that exists and is not complete. No audio and no
transcript is stored or logged here; the text becomes data only when the
page sends it as an ordinary message.

The same router runs in the API and in the speech pods (src/speech_main.py),
which have no database and ask the API about the conversation instead.
"""
import base64
import time

import httpx

from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..config import get_settings
from ..database import get_db
from ..models import Conversation
from ..services import speech
from ..services.speech.local_engines import SpeechAbandoned, SpeechBusy, client_gone, job_priority

router = APIRouter()

# Speech pods: conversations found open, with the time they were checked.
# A conversation asks for 5 to 10 clips per reply, so the API is asked at
# most once a minute per conversation.
_open_seen: dict[str, float] = {}
_OPEN_TTL = 60.0
_check_client: httpx.AsyncClient | None = None


async def _check_remote(base_url: str, conversation_id: str) -> None:
    global _check_client
    now = time.monotonic()
    seen = _open_seen.get(conversation_id)
    if seen is not None and now - seen < _OPEN_TTL:
        return
    if _check_client is None:
        _check_client = httpx.AsyncClient(timeout=10.0)
    try:
        res = await _check_client.get(f"{base_url.rstrip('/')}/api/conversations/{conversation_id}")
    except httpx.HTTPError:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Conversation check failed")
    if res.status_code == 404:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Conversation not found")
    if res.status_code != 200:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Conversation check failed")
    if res.json().get("is_complete"):
        _open_seen.pop(conversation_id, None)
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Conversation has been completed")
    if len(_open_seen) > 5000:
        _open_seen.clear()
    _open_seen[conversation_id] = now


async def _open_conversation(db: AsyncSession | None, conversation_id: str) -> None:
    check_url = get_settings().speech_conversation_check_url
    if check_url:
        await _check_remote(check_url, conversation_id)
        return
    result = await db.execute(select(Conversation).where(Conversation.id == conversation_id))
    conversation = result.scalar_one_or_none()
    if not conversation:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Conversation not found")
    if conversation.is_complete:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Conversation has been completed")
    # Give the connection back before the speech job, which can wait in line.
    await db.commit()


def _speech_error(exc: Exception, what: str) -> HTTPException:
    if isinstance(exc, (SpeechBusy, SpeechAbandoned)):
        print(f"Speech {what}: {type(exc).__name__}")
        return HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Speech busy, try again",
            headers={"Retry-After": "2"},
        )
    print(f"Speech {what} error: {type(exc).__name__}")
    detail = "Speech recognition failed" if what == "recognition" else "Speech synthesis failed"
    return HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=detail)


def _language(value: str) -> str:
    return value if value in ("fi", "en") else "fi"


class TranscriptionResponse(BaseModel):
    text: str


@router.post("/transcribe", response_model=TranscriptionResponse)
async def transcribe(
    request: Request,
    conversation_id: str,
    language: str = "fi",
    db: AsyncSession = Depends(get_db, scope="function"),
):
    """The recording is the raw request body, so it stays in memory: no
    multipart spool file, and the stream is cut off at the byte cap."""
    settings = get_settings()
    await _open_conversation(db, conversation_id)
    declared = request.headers.get("content-length")
    if declared and declared.isdigit() and int(declared) > settings.speech_max_upload_bytes:
        raise HTTPException(status_code=status.HTTP_413_CONTENT_TOO_LARGE, detail="Recording too long")
    chunks: list[bytes] = []
    size = 0
    async for chunk in request.stream():
        size += len(chunk)
        if size > settings.speech_max_upload_bytes:
            raise HTTPException(status_code=status.HTTP_413_CONTENT_TOO_LARGE, detail="Recording too long")
        chunks.append(chunk)
    data = b"".join(chunks)
    if not data:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Empty recording")
    mime = request.headers.get("content-type", "")
    print(f"Speech transcribe: {size} bytes, {mime or 'no content type'}, language {_language(language)}")
    client_gone.set(request.is_disconnected)
    try:
        text = await speech.transcribe(data, mime, _language(language))
    except Exception as exc:  # noqa: BLE001
        raise _speech_error(exc, "recognition")
    return TranscriptionResponse(text=text)


class SynthesisRequest(BaseModel):
    conversation_id: str
    text: str = Field(min_length=1)
    language: str = "fi"
    # The sentence's place in its reply: 0, the one the participant is
    # waiting for, goes ahead of prefetched sentences.
    index: int = Field(default=0, ge=0)


class SynthesisResponse(BaseModel):
    audio_base64: str
    audio_mime: str
    sample_rate: int
    words: list[str]
    wtimes: list[int]
    wdurations: list[int]


@router.post("/synthesize", response_model=SynthesisResponse)
async def synthesize(
    request: Request,
    data: SynthesisRequest,
    db: AsyncSession = Depends(get_db, scope="function"),
):
    settings = get_settings()
    text = data.text.strip()
    if len(text) > settings.speech_max_text_chars:
        raise HTTPException(status_code=status.HTTP_413_CONTENT_TOO_LARGE, detail="Text too long")
    await _open_conversation(db, data.conversation_id)
    client_gone.set(request.is_disconnected)
    job_priority.set(min(data.index, 1000))
    try:
        result = await speech.synthesize(text, _language(data.language))
    except Exception as exc:  # noqa: BLE001
        raise _speech_error(exc, "synthesis")
    return SynthesisResponse(
        audio_base64=base64.b64encode(result.audio).decode("ascii"),
        audio_mime="audio/mpeg",
        sample_rate=result.sample_rate,
        words=result.words,
        wtimes=result.wtimes,
        wdurations=result.wdurations,
    )

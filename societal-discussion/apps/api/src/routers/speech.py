"""
Speech endpoints for the chat page (spec V8, V9).

POST /api/speech/transcribe?conversation_id=..&language=..  body: the recording as
    recorded (Content-Type audio/webm or audio/mp4) -> {text}
POST /api/speech/synthesize   {conversation_id, text, language} -> WAV (base64) + word timings

Both need a conversation that exists and is not complete. No audio and no
transcript is stored or logged here; the text becomes data only when the
page sends it as an ordinary message.
"""
import base64

from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..config import get_settings
from ..database import get_db
from ..models import Conversation
from ..services import speech

router = APIRouter()


async def _open_conversation(db: AsyncSession, conversation_id: str) -> Conversation:
    result = await db.execute(select(Conversation).where(Conversation.id == conversation_id))
    conversation = result.scalar_one_or_none()
    if not conversation:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Conversation not found")
    if conversation.is_complete:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Conversation has been completed")
    return conversation


def _language(value: str) -> str:
    return value if value in ("fi", "en") else "fi"


class TranscriptionResponse(BaseModel):
    text: str


@router.post("/transcribe", response_model=TranscriptionResponse)
async def transcribe(
    request: Request,
    conversation_id: str,
    language: str = "fi",
    db: AsyncSession = Depends(get_db),
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
    try:
        text = await speech.transcribe(data, mime, _language(language))
    except Exception as exc:  # noqa: BLE001
        print(f"Speech recognition error: {type(exc).__name__}")
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail="Speech recognition failed")
    return TranscriptionResponse(text=text)


class SynthesisRequest(BaseModel):
    conversation_id: str
    text: str = Field(min_length=1)
    language: str = "fi"


class SynthesisResponse(BaseModel):
    audio_base64: str
    sample_rate: int
    words: list[str]
    wtimes: list[int]
    wdurations: list[int]


@router.post("/synthesize", response_model=SynthesisResponse)
async def synthesize(data: SynthesisRequest, db: AsyncSession = Depends(get_db)):
    settings = get_settings()
    await _open_conversation(db, data.conversation_id)
    text = data.text.strip()
    if len(text) > settings.speech_max_text_chars:
        raise HTTPException(status_code=status.HTTP_413_CONTENT_TOO_LARGE, detail="Text too long")
    try:
        result = await speech.synthesize(text, _language(data.language))
    except Exception as exc:  # noqa: BLE001
        print(f"Speech synthesis error: {type(exc).__name__}")
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail="Speech synthesis failed")
    return SynthesisResponse(
        audio_base64=base64.b64encode(result.wav).decode("ascii"),
        sample_rate=result.sample_rate,
        words=result.words,
        wtimes=result.wtimes,
        wdurations=result.wdurations,
    )

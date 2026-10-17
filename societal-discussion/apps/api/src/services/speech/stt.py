from ...config import get_settings
from .local_engines import transcribe_local
from .remote_engines import transcribe_remote


async def transcribe(audio: bytes, mime: str, language: str) -> str:
    """Phone recording (webm/opus or mp4/aac, as recorded) to text."""
    if get_settings().speech_stt_url:
        return await transcribe_remote(audio, mime, language)
    return await transcribe_local(audio, language)

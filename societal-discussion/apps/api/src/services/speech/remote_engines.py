"""
Remote speech engines: OpenAI-compatible servers on the university cluster
(Speaches for recognition, VoxCPM2 through vLLM-Omni or Nano-vLLM for
synthesis). Only the URL, the model name and the voice are configuration.
"""
from __future__ import annotations

import io

import httpx
import numpy as np

from ...config import get_settings

TIMEOUT = httpx.Timeout(60.0, connect=10.0)


def _headers() -> dict[str, str]:
    key = get_settings().speech_api_key
    return {"Authorization": f"Bearer {key}"} if key else {}


async def transcribe_remote(audio: bytes, mime: str, language: str) -> str:
    settings = get_settings()
    ext = "mp4" if "mp4" in mime else "webm" if "webm" in mime else "wav"
    async with httpx.AsyncClient(timeout=TIMEOUT) as client:
        res = await client.post(
            f"{settings.speech_stt_url.rstrip('/')}/v1/audio/transcriptions",
            headers=_headers(),
            files={"file": (f"turn.{ext}", audio, mime or "application/octet-stream")},
            data={"model": settings.speech_stt_model, "language": language, "response_format": "json"},
        )
    res.raise_for_status()
    return (res.json().get("text") or "").strip()


async def synthesize_remote(text: str, language: str) -> tuple[np.ndarray, int]:
    """Ask the server for WAV and decode it to float samples."""
    settings = get_settings()
    async with httpx.AsyncClient(timeout=TIMEOUT) as client:
        res = await client.post(
            f"{settings.speech_tts_url.rstrip('/')}/v1/audio/speech",
            headers=_headers(),
            json={
                "model": settings.speech_tts_model,
                "voice": settings.speech_tts_voice,
                "input": text,
                "response_format": "wav",
                "language": language,
            },
        )
    res.raise_for_status()
    from .wav import read_wav

    return read_wav(io.BytesIO(res.content))

"""
Local speech engines: faster-whisper for recognition and word timings, Piper
for synthesis. Models load once per process, on first use, and run in a
thread pool so the event loop keeps serving other phones.
"""
from __future__ import annotations

import asyncio
import io
import threading
from functools import lru_cache
from pathlib import Path

import numpy as np

from ...config import get_settings

PIPER_VOICES = {"fi": "fi_FI-harri-medium", "en": "en_GB-alan-medium"}

_lock = threading.Lock()


def _models_dir() -> Path:
    return Path(get_settings().speech_models_dir)


@lru_cache(maxsize=1)
def whisper_model():
    from faster_whisper import WhisperModel

    settings = get_settings()
    name = settings.speech_local_whisper_model
    local_dir = _models_dir() / f"whisper-{name}"
    source = str(local_dir) if local_dir.exists() else name
    return WhisperModel(source, device="cpu", compute_type=settings.speech_local_whisper_compute)


@lru_cache(maxsize=4)
def piper_voice(language: str):
    from piper import PiperVoice

    name = PIPER_VOICES.get(language, PIPER_VOICES["fi"])
    path = _models_dir() / f"{name}.onnx"
    if not path.exists():
        raise FileNotFoundError(f"Piper voice not found: {path}")
    return PiperVoice.load(path)


def _transcribe_sync(audio: bytes, language: str) -> str:
    from faster_whisper import decode_audio

    samples = decode_audio(io.BytesIO(audio), sampling_rate=16000)
    with _lock:
        segments, _ = whisper_model().transcribe(
            samples,
            language=language,
            beam_size=1,
            vad_filter=True,
            condition_on_previous_text=False,
        )
        text = " ".join(s.text.strip() for s in segments)
    return text.strip()


def _word_times_sync(samples_16k: np.ndarray, language: str) -> list[tuple[str, float, float]]:
    """Whisper word starts and ends in seconds for 16 kHz float samples."""
    with _lock:
        segments, _ = whisper_model().transcribe(
            samples_16k, language=language, beam_size=1, word_timestamps=True, vad_filter=False
        )
        out = []
        for seg in segments:
            for w in seg.words or []:
                out.append((w.word.strip(), float(w.start), float(w.end)))
    return out


def _synthesize_sync(text: str, language: str) -> tuple[np.ndarray, int]:
    """Float mono samples in [-1, 1] and their sample rate."""
    voice = piper_voice(language)
    parts, rate = [], 22050
    with _lock:
        for chunk in voice.synthesize(text):
            parts.append(chunk.audio_float_array.astype(np.float32))
            rate = chunk.sample_rate
    if not parts:
        return np.zeros(0, dtype=np.float32), rate
    return np.concatenate(parts), rate


async def transcribe_local(audio: bytes, language: str) -> str:
    return await asyncio.to_thread(_transcribe_sync, audio, language)


async def synthesize_local(text: str, language: str) -> tuple[np.ndarray, int]:
    return await asyncio.to_thread(_synthesize_sync, text, language)


async def word_times_local(samples_16k: np.ndarray, language: str) -> list[tuple[str, float, float]]:
    return await asyncio.to_thread(_word_times_sync, samples_16k, language)

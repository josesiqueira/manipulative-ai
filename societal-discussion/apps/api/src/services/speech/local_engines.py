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


MAX_CLIP_SECONDS = 60
MAX_CLIP_SAMPLES = MAX_CLIP_SECONDS * 16000

# At most two local engine jobs at once; the rest wait in the event loop
# instead of piling up threads.
_jobs = asyncio.Semaphore(2)


def decode_clip(audio: bytes, max_samples: int = MAX_CLIP_SAMPLES) -> np.ndarray:
    """Decode a phone recording (webm/opus, mp4/aac, wav) to 16 kHz mono float
    samples, frame by frame, and stop as soon as the cap is reached: a small
    compressed upload can hold minutes of audio, and one push-to-talk turn
    never needs more than a minute."""
    import av

    out: list[np.ndarray] = []
    total = 0
    resampler = av.AudioResampler(format="s16", layout="mono", rate=16000)
    with av.open(io.BytesIO(audio), mode="r") as container:
        stream = next((s for s in container.streams if s.type == "audio"), None)
        if stream is None:
            raise ValueError("No audio stream")
        for frame in container.decode(stream):
            for resampled in resampler.resample(frame):
                block = resampled.to_ndarray().reshape(-1)
                total += block.shape[0]
                out.append(block)
                if total > max_samples:
                    raise ValueError("Recording too long")
        for resampled in resampler.resample(None):
            block = resampled.to_ndarray().reshape(-1)
            total += block.shape[0]
            out.append(block)
    if total > max_samples:
        raise ValueError("Recording too long")
    if not out:
        return np.zeros(0, dtype=np.float32)
    return (np.concatenate(out).astype(np.float32) / 32768.0)


def _transcribe_sync(audio: bytes, language: str) -> str:
    samples = decode_clip(audio)
    if samples.size == 0:
        return ""
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
    async with _jobs:
        return await asyncio.wait_for(asyncio.to_thread(_transcribe_sync, audio, language), timeout=60)


async def synthesize_local(text: str, language: str) -> tuple[np.ndarray, int]:
    async with _jobs:
        return await asyncio.to_thread(_synthesize_sync, text, language)


async def word_times_local(samples_16k: np.ndarray, language: str) -> list[tuple[str, float, float]]:
    async with _jobs:
        return await asyncio.to_thread(_word_times_sync, samples_16k, language)

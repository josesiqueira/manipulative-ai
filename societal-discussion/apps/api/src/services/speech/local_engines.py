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
    # include_alignments: Piper reports how many samples each phoneme took,
    # which gives exact word timings for lip-sync without a recognition pass.
    return PiperVoice.load(path, include_alignments=True)


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


def decode_any(audio: bytes, max_seconds: int = 120) -> tuple[np.ndarray, int]:
    """Decode a voice server's reply (WAV in any flavour, or anything PyAV
    reads) to mono float samples at its own rate."""
    import av

    out: list[np.ndarray] = []
    rate = 0
    total = 0
    with av.open(io.BytesIO(audio), mode="r") as container:
        stream = next((s for s in container.streams if s.type == "audio"), None)
        if stream is None:
            raise ValueError("No audio stream")
        rate = int(stream.rate or 0) or 24000
        resampler = av.AudioResampler(format="s16", layout="mono", rate=rate)
        for frame in container.decode(stream):
            for resampled in resampler.resample(frame):
                block = resampled.to_ndarray().reshape(-1)
                total += block.shape[0]
                if total > max_seconds * rate:
                    raise ValueError("Reply audio too long")
                out.append(block)
        for resampled in resampler.resample(None):
            out.append(resampled.to_ndarray().reshape(-1))
    if not out:
        return np.zeros(0, dtype=np.float32), rate
    return np.concatenate(out).astype(np.float32) / 32768.0, rate


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


WORD_BREAK_PHONEMES = {" ", "^", "$"}


def _words_from_alignments(alignments, offset_samples: int, rate: int) -> list[tuple[int, int]]:
    """(start_ms, end_ms) of each spoken word from Piper's phoneme alignments:
    a word is a run of phonemes between space, start and end markers."""
    words: list[tuple[int, int]] = []
    pos = offset_samples
    start: int | None = None
    for a in alignments:
        n = int(a.num_samples)
        if a.phoneme in WORD_BREAK_PHONEMES:
            if start is not None:
                words.append((start * 1000 // rate, pos * 1000 // rate))
                start = None
        elif start is None:
            start = pos
        pos += n
    if start is not None:
        words.append((start * 1000 // rate, pos * 1000 // rate))
    return words


def _synthesize_sync(text: str, language: str) -> tuple[np.ndarray, int, list[tuple[int, int]] | None]:
    """Float mono samples in [-1, 1], their sample rate, and word (start_ms,
    end_ms) pairs from Piper's alignments when the voice provides them."""
    voice = piper_voice(language)
    parts, rate = [], 22050
    timings: list[tuple[int, int]] = []
    have_alignments = True
    offset = 0
    with _lock:
        for chunk in voice.synthesize(text, include_alignments=True):
            audio = chunk.audio_float_array.astype(np.float32)
            parts.append(audio)
            rate = chunk.sample_rate
            if chunk.phoneme_alignments:
                timings.extend(_words_from_alignments(chunk.phoneme_alignments, offset, rate))
            else:
                have_alignments = False
            offset += audio.shape[0]
    if not parts:
        return np.zeros(0, dtype=np.float32), rate, None
    return np.concatenate(parts), rate, timings if have_alignments else None


async def transcribe_local(audio: bytes, language: str) -> str:
    async with _jobs:
        return await asyncio.wait_for(asyncio.to_thread(_transcribe_sync, audio, language), timeout=60)


async def synthesize_local(text: str, language: str) -> tuple[np.ndarray, int, list[tuple[int, int]] | None]:
    async with _jobs:
        return await asyncio.to_thread(_synthesize_sync, text, language)


async def word_times_local(samples_16k: np.ndarray, language: str) -> list[tuple[str, float, float]]:
    async with _jobs:
        return await asyncio.to_thread(_word_times_sync, samples_16k, language)

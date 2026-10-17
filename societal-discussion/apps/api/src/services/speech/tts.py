from __future__ import annotations

from dataclasses import dataclass

from ...config import get_settings
from .alignment import align_words
from .local_engines import synthesize_local, word_times_local
from .remote_engines import synthesize_remote
from .wav import resample, write_wav


@dataclass
class Synthesized:
    wav: bytes
    sample_rate: int
    words: list[str]
    wtimes: list[int]
    wdurations: list[int]


async def synthesize(text: str, language: str) -> Synthesized:
    """One sentence to WAV bytes plus the script's words with start times and
    durations in milliseconds (whisper word timestamps aligned to the script)."""
    if get_settings().speech_tts_url:
        samples, rate = await synthesize_remote(text, language)
    else:
        samples, rate = await synthesize_local(text, language)
    seconds = samples.size / rate if rate else 0.0
    recognised = await word_times_local(resample(samples, rate, 16000), language) if samples.size else []
    words, wtimes, wdurations = align_words(text, recognised, seconds)
    return Synthesized(write_wav(samples, rate), rate, words, wtimes, wdurations)

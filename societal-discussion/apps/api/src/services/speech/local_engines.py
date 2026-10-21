"""
Local speech engines: Piper for synthesis, Parakeet TDT 0.6B v3 (or
faster-whisper small as the fallback) for recognition, and faster-whisper for
word timings of a remote voice. Models load once per process (warm_up() at
start, or on first use).

Throughput (measured 2026-10-21): onnxruntime and CTranslate2 size their
thread pools from the node's cores, not from the pod's CPU limit, and a pod
throttled that way voiced an 8 s sentence in 2.3 s instead of 0.5 s. So every
engine gets an explicit thread count, and jobs run on a pool per engine with
as many workers as there are job slots (threads x slots = the CPU budget).
One Piper voice can be used by several jobs at once (piper 1.8 phonemizes
under its own lock; onnxruntime sessions are thread-safe).

Waiting jobs are served first-sentence-first: the first clip of a reply is
what the participant waits for, prefetched clips can wait. A job whose phone
has gone, or that waited longer than the phone would, is dropped before it
starts; when too many are waiting a new one is refused at once (SpeechBusy).
"""
from __future__ import annotations

import asyncio
import heapq
import io
import itertools
import json
import threading
import time
from collections.abc import Awaitable, Callable
from concurrent.futures import ThreadPoolExecutor
from contextvars import ContextVar
from functools import lru_cache
from pathlib import Path

import numpy as np

from ...config import get_settings

PIPER_VOICES = {"fi": "fi_FI-harri-medium", "en": "en_GB-alan-medium"}
PARAKEET_DIR = "parakeet-tdt-0.6b-v3"

# Whisper is used one call at a time per model object.
_whisper_lock = threading.Lock()


class SpeechBusy(RuntimeError):
    """Too many speech jobs are already waiting, or this one waited too long."""


class SpeechAbandoned(RuntimeError):
    """The phone gave up on the request before its job could start."""


# Set by the endpoint to request.is_disconnected: checked when a job's turn
# comes, so work for a phone that has gone is never done.
client_gone: ContextVar[Callable[[], Awaitable[bool]] | None] = ContextVar("client_gone", default=None)
# Set by the endpoint: 0 for the first sentence of a reply, higher for the
# prefetched ones and for recognition (which has its own pool).
job_priority: ContextVar[int] = ContextVar("job_priority", default=0)


def _models_dir() -> Path:
    return Path(get_settings().speech_models_dir)


def _session_options(threads: int):
    import onnxruntime

    opts = onnxruntime.SessionOptions()
    opts.intra_op_num_threads = threads
    opts.inter_op_num_threads = 1
    opts.execution_mode = onnxruntime.ExecutionMode.ORT_SEQUENTIAL
    return opts


@lru_cache(maxsize=1)
def whisper_model():
    from faster_whisper import WhisperModel

    settings = get_settings()
    name = settings.speech_local_whisper_model
    local_dir = _models_dir() / f"whisper-{name}"
    source = str(local_dir) if local_dir.exists() else name
    return WhisperModel(
        source,
        device="cpu",
        compute_type=settings.speech_local_whisper_compute,
        cpu_threads=settings.speech_stt_threads,
    )


@lru_cache(maxsize=1)
def parakeet_model():
    import onnx_asr

    return onnx_asr.load_model(
        "nemo-parakeet-tdt-0.6b-v3",
        _models_dir() / PARAKEET_DIR,
        quantization="int8",
        sess_options=_session_options(get_settings().speech_stt_threads),
    )


@lru_cache(maxsize=4)
def piper_voice(language: str):
    """Piper's own loader with explicit onnxruntime threads (PiperVoice.load
    takes no session options). include_alignments: Piper reports how many
    samples each phoneme took, which gives exact word timings for lip-sync
    without a recognition pass."""
    import onnx
    import onnxruntime
    from piper import PiperVoice
    from piper.config import PiperConfig
    from piper.patch_voice_with_alignment import add_alignment_output

    name = PIPER_VOICES.get(language, PIPER_VOICES["fi"])
    path = _models_dir() / f"{name}.onnx"
    if not path.exists():
        raise FileNotFoundError(f"Piper voice not found: {path}")
    model = onnx.load(str(path))
    try:
        add_alignment_output(model)
    except ValueError:
        pass  # already patched
    config = PiperConfig.from_dict(json.loads(Path(f"{path}.json").read_text(encoding="utf-8")))
    session = onnxruntime.InferenceSession(
        model.SerializeToString(),
        sess_options=_session_options(get_settings().speech_tts_threads),
        providers=["CPUExecutionProvider"],
    )
    return PiperVoice(config=config, session=session)


MAX_CLIP_SECONDS = 60
MAX_CLIP_SAMPLES = MAX_CLIP_SECONDS * 16000


class _Pool:
    """Job slots for one engine, handed out lowest priority number first,
    with a thread pool of the same size to run the jobs on."""

    def __init__(self, slots: int):
        self.slots = slots
        self.free = slots
        self.queue: list[tuple[int, int, asyncio.Future]] = []
        self.order = itertools.count()
        self.executor = ThreadPoolExecutor(max_workers=slots)

    def waiting(self) -> int:
        return sum(1 for _p, _n, f in self.queue if not f.done())

    async def acquire(self, priority: int) -> None:
        if self.free > 0 and self.waiting() == 0:
            self.free -= 1
            return
        future = asyncio.get_running_loop().create_future()
        heapq.heappush(self.queue, (priority, next(self.order), future))
        try:
            await future
        except asyncio.CancelledError:
            if future.done() and not future.cancelled():
                self.release()  # the slot was handed over just as we gave up
            raise

    def release(self) -> None:
        while self.queue:
            _p, _n, future = heapq.heappop(self.queue)
            if not future.done():
                future.set_result(None)
                return
        self.free += 1


_pools: dict[str, _Pool] = {}


def _pool(kind: str) -> _Pool:
    pool = _pools.get(kind)
    if pool is None:
        settings = get_settings()
        pool = _Pool(settings.speech_tts_slots if kind == "tts" else settings.speech_stt_slots)
        _pools[kind] = pool
    return pool


async def _run(kind: str, fn, *args):
    settings = get_settings()
    pool = _pool(kind)
    if pool.waiting() >= settings.speech_max_waiting:
        raise SpeechBusy(kind)
    queued_at = time.monotonic()
    await pool.acquire(job_priority.get())
    try:
        if time.monotonic() - queued_at > settings.speech_max_wait_seconds:
            raise SpeechBusy(f"{kind}: waited too long")
        gone = client_gone.get()
        if gone is not None and await gone():
            raise SpeechAbandoned(kind)
        return await asyncio.get_running_loop().run_in_executor(pool.executor, fn, *args)
    finally:
        pool.release()


def warm_up() -> None:
    """Load the models this pod serves and run each once, so the first phone
    of the evening does not wait for model loading."""
    role = get_settings().speech_role
    if role in ("all", "tts"):
        for language in PIPER_VOICES:
            _synthesize_sync("Hei." if language == "fi" else "Hello.", language)
    if role in ("all", "stt"):
        _transcribe_samples(np.zeros(16000, dtype=np.float32), "fi")


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
    return _transcribe_samples(samples, language)


def _transcribe_samples(samples: np.ndarray, language: str) -> str:
    if get_settings().speech_stt_engine == "parakeet":
        # Parakeet finds the language itself and returns punctuated text.
        text = parakeet_model().recognize(samples, sample_rate=16000)
    else:
        with _whisper_lock:
            segments, _ = whisper_model().transcribe(
                samples,
                language=language,
                beam_size=1,
                vad_filter=True,
                condition_on_previous_text=False,
            )
            text = " ".join(s.text.strip() for s in segments)
    # Operational log: clip length and word count only, never the words.
    print(f"Speech transcribe: clip {samples.size / 16000:.1f} s, {len(text.split())} words recognised")
    return text.strip()


def _word_times_sync(samples_16k: np.ndarray, language: str) -> list[tuple[str, float, float]]:
    """Whisper word starts and ends in seconds for 16 kHz float samples."""
    with _whisper_lock:
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
    return await _run("stt", _transcribe_sync, audio, language)


async def synthesize_local(text: str, language: str) -> tuple[np.ndarray, int, list[tuple[int, int]] | None]:
    return await _run("tts", _synthesize_sync, text, language)


async def word_times_local(samples_16k: np.ndarray, language: str) -> list[tuple[str, float, float]]:
    return await _run("stt", _word_times_sync, samples_16k, language)

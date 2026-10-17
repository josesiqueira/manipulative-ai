"""
Speech in both directions for the chat page (spec V8, V9).

transcribe(): phone recording bytes to text.
synthesize(): one sentence to WAV bytes plus word timings for lip-sync.

Each has a remote engine (OpenAI-compatible server on the cluster) and a
local engine (faster-whisper and Piper in this container), chosen by the
settings. Nothing here writes audio or transcripts to disk or to the logs.
"""
from .stt import transcribe
from .tts import synthesize

__all__ = ["transcribe", "synthesize"]

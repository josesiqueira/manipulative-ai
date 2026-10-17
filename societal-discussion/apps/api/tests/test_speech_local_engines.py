"""Runs the real local engines (faster-whisper small, Piper). Skipped unless
SPEECH_LOCAL_TESTS=1 and the Piper voices are under SPEECH_MODELS_DIR."""
import os
import time
from pathlib import Path

import pytest

from src.config import get_settings

pytestmark = pytest.mark.skipif(os.environ.get("SPEECH_LOCAL_TESTS") != "1", reason="local engines not requested")


async def test_round_trip_finnish():
    from src.services import speech

    models = Path(get_settings().speech_models_dir)
    assert (models / "fi_FI-harri-medium.onnx").exists(), models
    t0 = time.time()
    out = await speech.synthesize("Hyvää iltaa ja tervetuloa keskustelemaan politiikasta.", "fi")
    t_tts = time.time() - t0
    assert out.sample_rate in (16000, 22050, 24000, 48000)
    assert len(out.words) == len(out.wtimes) == len(out.wdurations) == 6
    assert out.wtimes == sorted(out.wtimes)
    t0 = time.time()
    text = await speech.transcribe(out.wav, "audio/wav", "fi")
    t_stt = time.time() - t0
    print(f"\nTTS+timing {t_tts:.2f}s, STT {t_stt:.2f}s, text: {text}")
    assert "tervetuloa" in text.lower()


async def test_round_trip_english():
    from src.services import speech

    out = await speech.synthesize("Good evening and welcome.", "en")
    assert out.words == ["Good", "evening", "and", "welcome."]
    text = await speech.transcribe(out.wav, "audio/wav", "en")
    assert "welcome" in text.lower()

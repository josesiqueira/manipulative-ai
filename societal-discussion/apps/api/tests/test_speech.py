"""Speech endpoints with the engines replaced by fakes: request shapes, the
conversation check, the caps, and that no path is ever handed to an engine."""
import base64
import io
import wave

import numpy as np

from src.models import Conversation, Session
from src.routers import speech as speech_router
from src.services import speech as speech_service
from src.services.speech import tts as tts_module
from src.services.speech.local_engines import decode_any

CONSENT = {"consent_version": "2026-10-23-v1", "age_confirmed": True}


async def _conversation(client, complete=False, db_session=None) -> str:
    sid = (await client.post("/api/sessions", json=CONSENT)).json()["id"]
    cid = (await client.post("/api/conversations", json={"session_id": sid})).json()["id"]
    if complete:
        await client.put(f"/api/conversations/{cid}/end")
    return cid


async def test_transcribe_passes_bytes_and_mime_to_the_engine(client, monkeypatch):
    seen = {}

    async def fake_transcribe(audio, mime, language):
        assert isinstance(audio, bytes)
        seen.update(audio=audio, mime=mime, language=language)
        return "hei maailma"

    monkeypatch.setattr(speech_router.speech, "transcribe", fake_transcribe)
    cid = await _conversation(client)
    res = await client.post(
        f"/api/speech/transcribe?conversation_id={cid}&language=fi",
        content=b"\x1aE\xdf\xa3fake",
        headers={"Content-Type": "audio/webm;codecs=opus"},
    )
    assert res.status_code == 200
    assert res.json() == {"text": "hei maailma"}
    assert seen == {"audio": b"\x1aE\xdf\xa3fake", "mime": "audio/webm;codecs=opus", "language": "fi"}


async def test_transcribe_needs_an_open_conversation(client, monkeypatch):
    called = []

    async def fake_transcribe(audio, mime, language):
        called.append(1)
        return "x"

    monkeypatch.setattr(speech_router.speech, "transcribe", fake_transcribe)
    res = await client.post(
        "/api/speech/transcribe?conversation_id=nope", content=b"abc", headers={"Content-Type": "audio/webm"}
    )
    assert res.status_code == 404
    cid = await _conversation(client, complete=True)
    res = await client.post(
        f"/api/speech/transcribe?conversation_id={cid}", content=b"abc", headers={"Content-Type": "audio/webm"}
    )
    assert res.status_code == 400
    assert called == []


async def test_transcribe_rejects_empty_and_oversized_uploads(client, monkeypatch):
    monkeypatch.setattr(speech_router.speech, "transcribe", None)
    cid = await _conversation(client)
    res = await client.post(
        f"/api/speech/transcribe?conversation_id={cid}", content=b"", headers={"Content-Type": "audio/webm"}
    )
    assert res.status_code == 400
    big = b"0" * (speech_router.get_settings().speech_max_upload_bytes + 1)
    res = await client.post(
        f"/api/speech/transcribe?conversation_id={cid}", content=big, headers={"Content-Type": "audio/webm"}
    )
    assert res.status_code == 413


def _wav_bytes(seconds: float, rate: int = 8000) -> bytes:
    buf = io.BytesIO()
    with wave.open(buf, "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(rate)
        w.writeframes(b"\x00\x00" * int(seconds * rate))
    return buf.getvalue()


def test_decode_clip_resamples_and_stops_at_the_cap():
    import pytest

    from src.services.speech.local_engines import decode_clip

    samples = decode_clip(_wav_bytes(2.0))
    assert abs(samples.shape[0] - 32000) < 200  # 2 s at 16 kHz
    with pytest.raises(ValueError):
        decode_clip(_wav_bytes(61.0))


async def test_synthesize_returns_mp3_and_aligned_words(client, monkeypatch):
    async def fake_local(text, language):
        rate = 16000
        return np.zeros(rate, dtype=np.float32), rate, None  # one second of silence, no alignments

    async def fake_times(samples, language):
        return [("Hyvää", 0.1, 0.4), ("iltaa", 0.5, 0.9)]

    monkeypatch.setattr(tts_module, "synthesize_local", fake_local)
    monkeypatch.setattr(tts_module, "word_times_local", fake_times)
    cid = await _conversation(client)
    res = await client.post(
        "/api/speech/synthesize", json={"conversation_id": cid, "text": "Hyvää iltaa.", "language": "fi"}
    )
    assert res.status_code == 200
    body = res.json()
    assert body["words"] == ["Hyvää", "iltaa."]
    assert body["wtimes"] == [100, 500]
    assert body["wdurations"] == [300, 400]
    assert body["sample_rate"] == 16000
    assert body["audio_mime"] == "audio/mpeg"
    mp3 = base64.b64decode(body["audio_base64"])
    assert len(mp3) < 16000  # one second at 64 kbit/s is about 8 KB; WAV would be 32 KB
    samples, rate = decode_any(mp3)
    assert rate == 16000
    assert abs(samples.size - 16000) < 3000  # the encoder pads a little


async def test_synthesize_caps_text_and_needs_an_open_conversation(client):
    cid = await _conversation(client)
    res = await client.post("/api/speech/synthesize", json={"conversation_id": cid, "text": "x" * 601})
    assert res.status_code == 413
    res = await client.post("/api/speech/synthesize", json={"conversation_id": "nope", "text": "hei"})
    assert res.status_code == 404


async def test_remote_engines_are_used_when_urls_are_set(client, monkeypatch):
    from src.services.speech import stt as stt_module

    settings = speech_router.get_settings()
    monkeypatch.setattr(settings, "speech_stt_url", "http://speaches.example")
    calls = []

    async def fake_remote(audio, mime, language):
        calls.append((mime, language))
        return "remote text"

    monkeypatch.setattr(stt_module, "transcribe_remote", fake_remote)
    assert await speech_service.transcribe(b"abc", "audio/mp4", "en") == "remote text"
    assert calls == [("audio/mp4", "en")]


async def test_synthesize_uses_piper_alignments_when_they_match_the_words(client, monkeypatch):
    async def fake_local(text, language):
        return np.zeros(16000, dtype=np.float32), 16000, [(0, 300), (350, 800)]

    async def no_whisper(samples, language):
        raise AssertionError("whisper must not run when Piper gives timings")

    monkeypatch.setattr(tts_module, "synthesize_local", fake_local)
    monkeypatch.setattr(tts_module, "word_times_local", no_whisper)
    cid = await _conversation(client)
    res = await client.post("/api/speech/synthesize", json={"conversation_id": cid, "text": "Hyvää iltaa.", "language": "fi"})
    assert res.status_code == 200
    assert res.json()["wtimes"] == [0, 350]
    assert res.json()["wdurations"] == [300, 450]


def test_words_from_alignments_splits_on_spaces():
    from types import SimpleNamespace

    from src.services.speech.local_engines import _words_from_alignments

    al = [SimpleNamespace(phoneme=p, num_samples=n) for p, n in [("^", 100), ("h", 200), ("i", 200), (" ", 100), ("m", 300), ("$", 100)]]
    assert _words_from_alignments(al, 0, 1000) == [(100, 500), (600, 900)]


def test_decode_any_reads_a_wav_at_its_own_rate():

    samples, rate = decode_any(_wav_bytes(1.0, rate=22050))
    assert rate == 22050
    assert abs(samples.shape[0] - 22050) < 100


async def test_transcribe_streamed_body_over_the_cap_is_rejected(client, monkeypatch):
    monkeypatch.setattr(speech_router.speech, "transcribe", None)
    cid = await _conversation(client)
    big = b"0" * (speech_router.get_settings().speech_max_upload_bytes + 1)

    async def gen():
        yield big[: len(big) // 2]
        yield big[len(big) // 2 :]

    res = await client.post(
        f"/api/speech/transcribe?conversation_id={cid}", content=gen(), headers={"Content-Type": "audio/webm"}
    )
    assert res.status_code == 413

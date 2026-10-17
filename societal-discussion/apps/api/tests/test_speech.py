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
        "/api/speech/transcribe",
        files={"audio": ("turn.webm", b"\x1aE\xdf\xa3fake", "audio/webm;codecs=opus")},
        data={"conversation_id": cid, "language": "fi"},
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
        "/api/speech/transcribe",
        files={"audio": ("t.webm", b"abc", "audio/webm")},
        data={"conversation_id": "nope"},
    )
    assert res.status_code == 404
    cid = await _conversation(client, complete=True)
    res = await client.post(
        "/api/speech/transcribe",
        files={"audio": ("t.webm", b"abc", "audio/webm")},
        data={"conversation_id": cid},
    )
    assert res.status_code == 400
    assert called == []


async def test_transcribe_rejects_empty_and_oversized_uploads(client, monkeypatch):
    monkeypatch.setattr(speech_router.speech, "transcribe", None)
    cid = await _conversation(client)
    res = await client.post(
        "/api/speech/transcribe", files={"audio": ("t.webm", b"", "audio/webm")}, data={"conversation_id": cid}
    )
    assert res.status_code == 400
    big = b"0" * (speech_router.get_settings().speech_max_upload_bytes + 1)
    res = await client.post(
        "/api/speech/transcribe", files={"audio": ("t.webm", big, "audio/webm")}, data={"conversation_id": cid}
    )
    assert res.status_code == 413


async def test_synthesize_returns_wav_and_aligned_words(client, monkeypatch):
    async def fake_local(text, language):
        rate = 16000
        return np.zeros(rate, dtype=np.float32), rate  # one second of silence

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
    with wave.open(io.BytesIO(base64.b64decode(body["audio_base64"])), "rb") as w:
        assert w.getframerate() == 16000
        assert w.getnframes() == 16000


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

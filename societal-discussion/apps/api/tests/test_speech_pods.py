"""Speech pods: no database, the conversation check asks the API; a full
queue answers 503 at once; a job whose phone has gone is never run."""
import asyncio

import httpx
from httpx import ASGITransport, AsyncClient

from src.config import get_settings
from src.routers import speech as speech_router
from src.services.speech import local_engines


async def test_speech_app_asks_the_api_about_the_conversation(monkeypatch):
    from src.speech_main import app as speech_app

    asked = []

    def api(request: httpx.Request) -> httpx.Response:
        asked.append(request.url.path)
        cid = request.url.path.rsplit("/", 1)[-1]
        if cid == "open":
            return httpx.Response(200, json={"id": cid, "starter_topic": None, "is_complete": False})
        if cid == "done":
            return httpx.Response(200, json={"id": cid, "starter_topic": None, "is_complete": True})
        return httpx.Response(404, json={"detail": "Conversation not found"})

    monkeypatch.setattr(get_settings(), "speech_conversation_check_url", "http://api:8080")
    monkeypatch.setattr(speech_router, "_check_client", httpx.AsyncClient(transport=httpx.MockTransport(api)))
    monkeypatch.setattr(speech_router, "_open_seen", {})

    async def fake_transcribe(audio, mime, language):
        return "hei"

    monkeypatch.setattr(speech_router.speech, "transcribe", fake_transcribe)
    async with AsyncClient(transport=ASGITransport(app=speech_app), base_url="http://test") as c:
        post = lambda cid: c.post(  # noqa: E731
            f"/api/speech/transcribe?conversation_id={cid}", content=b"abc", headers={"Content-Type": "audio/webm"}
        )
        assert (await post("open")).json() == {"text": "hei"}
        assert (await post("open")).status_code == 200
        assert (await post("done")).status_code == 400
        assert (await post("nope")).status_code == 404
    # The open conversation was asked about once, then remembered.
    assert asked == ["/api/conversations/open", "/api/conversations/done", "/api/conversations/nope"]


async def test_full_queue_is_refused_at_once(monkeypatch):
    monkeypatch.setattr(get_settings(), "speech_max_waiting", 1)
    monkeypatch.setattr(local_engines, "_tts_slot", asyncio.Semaphore(1))
    monkeypatch.setattr(local_engines, "_waiting", {"stt": 0, "tts": 0})
    release = asyncio.Event()

    def slow(text, language):
        return text

    async def hold():
        async with local_engines._tts_slot:
            await release.wait()

    holder = asyncio.create_task(hold())
    await asyncio.sleep(0)
    waiting = asyncio.create_task(local_engines._run("tts", local_engines._tts_slot, slow, "a", "fi"))
    await asyncio.sleep(0)
    try:
        await local_engines._run("tts", local_engines._tts_slot, slow, "b", "fi")
        raise AssertionError("expected SpeechBusy")
    except local_engines.SpeechBusy:
        pass
    release.set()
    assert await waiting == "a"
    await holder


async def test_job_for_a_phone_that_has_gone_is_dropped(monkeypatch):
    monkeypatch.setattr(local_engines, "_stt_slot", asyncio.Semaphore(1))
    monkeypatch.setattr(local_engines, "_waiting", {"stt": 0, "tts": 0})
    ran = []

    async def gone():
        return True

    token = local_engines.client_gone.set(gone)
    try:
        try:
            await local_engines._run("stt", local_engines._stt_slot, lambda: ran.append(1))
            raise AssertionError("expected SpeechAbandoned")
        except local_engines.SpeechAbandoned:
            pass
    finally:
        local_engines.client_gone.reset(token)
    assert ran == []
    assert local_engines._waiting["stt"] == 0

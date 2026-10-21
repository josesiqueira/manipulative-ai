"""Speech pods: no database, the conversation check asks the API; a full
queue answers 503 at once; a job whose phone has gone is never run."""
import asyncio
import threading

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


async def test_full_queue_is_refused_at_once_and_first_sentences_go_first(monkeypatch):
    monkeypatch.setattr(get_settings(), "speech_max_waiting", 2)
    pool = local_engines._Pool(1)
    monkeypatch.setattr(local_engines, "_pools", {"tts": pool})
    order: list[str] = []
    gate = threading.Event()

    def job(name):
        if name == "holder":
            gate.wait(5)
        order.append(name)
        return name

    async def submit(name, priority):
        token = local_engines.job_priority.set(priority)
        try:
            return await local_engines._run("tts", job, name)
        finally:
            local_engines.job_priority.reset(token)

    holder = asyncio.create_task(submit("holder", 0))
    await asyncio.sleep(0.05)
    later = asyncio.create_task(submit("prefetch", 3))
    first = asyncio.create_task(submit("first", 0))
    await asyncio.sleep(0.05)
    try:
        await submit("one too many", 1)
        raise AssertionError("expected SpeechBusy")
    except local_engines.SpeechBusy:
        pass
    gate.set()
    assert await asyncio.gather(holder, later, first) == ["holder", "prefetch", "first"]
    # The first sentence of a reply ran before the earlier-queued prefetch.
    assert order == ["holder", "first", "prefetch"]
    assert pool.free == 1


async def test_a_job_that_waited_too_long_is_refused(monkeypatch):
    monkeypatch.setattr(get_settings(), "speech_max_wait_seconds", 0.05)
    pool = local_engines._Pool(1)
    monkeypatch.setattr(local_engines, "_pools", {"stt": pool})
    gate = threading.Event()
    holder = asyncio.create_task(local_engines._run("stt", lambda: gate.wait(5)))
    await asyncio.sleep(0.02)
    waiting = asyncio.create_task(local_engines._run("stt", lambda: "late"))
    await asyncio.sleep(0.1)
    gate.set()
    await holder
    try:
        await waiting
        raise AssertionError("expected SpeechBusy")
    except local_engines.SpeechBusy:
        pass
    assert pool.free == 1


async def test_job_for_a_phone_that_has_gone_is_dropped(monkeypatch):
    pool = local_engines._Pool(1)
    monkeypatch.setattr(local_engines, "_pools", {"stt": pool})
    ran = []

    async def gone():
        return True

    token = local_engines.client_gone.set(gone)
    try:
        try:
            await local_engines._run("stt", lambda: ran.append(1))
            raise AssertionError("expected SpeechAbandoned")
        except local_engines.SpeechAbandoned:
            pass
    finally:
        local_engines.client_gone.reset(token)
    assert ran == []
    assert pool.free == 1

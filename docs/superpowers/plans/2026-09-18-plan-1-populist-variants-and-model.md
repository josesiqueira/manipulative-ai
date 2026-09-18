# Plan 1: Populist variants for all parties + GPT-6 Astra

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every one of the 9 Finnish parties gets a `<party>_populist` condition that shares its corpus but adds the populism-markers section; the OpenAI provider supports GPT-6 Astra and never stores prompts on OpenAI's side.

**Architecture:** `party_grounding.py` becomes the single source of truth by generating the populist entries from a `BASE_PARTIES` list instead of hand-listing them. `prompt_builder.py` asks `is_populist()` instead of comparing against one hard-coded id. The admin frontend mirrors the 18 ids. The OpenAI provider gets `store=False` and a one-shot retry without `temperature`.

**Tech Stack:** Python 3.12, FastAPI, SQLAlchemy 2 async, pytest + pytest-asyncio + httpx; Next.js 14 + TypeScript for the admin constants.

**Spec:** `docs/superpowers/specs/2026-09-18-metso-demo-design.md` (decisions E1, E2, E3)

## Global Constraints

- Run all backend commands from `societal-discussion/apps/api` with `uv run ...` (the repo uses uv; `run.sh` shows the convention).
- Run all frontend commands from `societal-discussion/apps/web`.
- No em dashes or en dashes in any code, comment, string, or commit message. Never use the words "baked", "baked in" or "thin".
- Commit after each task. Commit messages in imperative mood, no attribution trailer.
- The vanilla party prompts must not change: `_default_instruction_for("perussuomalaiset")` must still equal `DEFAULT_SYSTEM_INSTRUCTION`.

---

### Task 1: Backend test scaffolding

There are no tests yet (`apps/api/tests/__init__.py` only). Every later task needs an async in-memory database and an HTTP client against the FastAPI app.

**Files:**
- Create: `societal-discussion/apps/api/tests/conftest.py`
- Create: `societal-discussion/apps/api/tests/test_health.py`

**Interfaces:**
- Produces: pytest fixtures `db_session` (an `AsyncSession` bound to a fresh in-memory SQLite with all tables created) and `client` (an `httpx.AsyncClient` whose `get_db` dependency is overridden to use `db_session`).

- [ ] **Step 1: Write the fixtures**

```python
# societal-discussion/apps/api/tests/conftest.py
"""
Shared fixtures: an in-memory SQLite database and an HTTP client against
the FastAPI app with get_db overridden. The app lifespan (init_db against
the real database URL) is not run by ASGITransport, so tests never touch
the on-disk database.
"""
import os

os.environ.setdefault("ENCRYPTION_SECRET", "test-secret")
os.environ.setdefault("ADMIN_PASSWORD", "admin")

import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import StaticPool

from src.database import Base, get_db
from src.main import app


@pytest_asyncio.fixture
async def db_session():
    engine = create_async_engine(
        "sqlite+aiosqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    maker = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    async with maker() as session:
        yield session
    await engine.dispose()


@pytest_asyncio.fixture
async def client(db_session):
    async def override_get_db():
        try:
            yield db_session
            await db_session.commit()
        except Exception:
            await db_session.rollback()
            raise

    app.dependency_overrides[get_db] = override_get_db
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        yield c
    app.dependency_overrides.clear()
```

- [ ] **Step 2: Write a smoke test**

```python
# societal-discussion/apps/api/tests/test_health.py
async def test_health(client):
    res = await client.get("/api/health")
    assert res.status_code == 200
    assert res.json()["status"] == "healthy"
```

- [ ] **Step 3: Run it**

Run: `cd societal-discussion/apps/api && uv run pytest tests/test_health.py -v`
Expected: PASS. If `ModuleNotFoundError: src`, run with `uv run python -m pytest` or add `pythonpath = ["."]` under `[tool.pytest.ini_options]` in `pyproject.toml`.

- [ ] **Step 4: Commit**

```bash
git add societal-discussion/apps/api/tests/conftest.py societal-discussion/apps/api/tests/test_health.py societal-discussion/apps/api/pyproject.toml
git commit -m "Add backend test scaffolding with in-memory SQLite and ASGI client"
```

---

### Task 2: Generate populist variants for all 9 parties

**Files:**
- Modify: `societal-discussion/apps/api/src/services/party_grounding.py`
- Modify: `societal-discussion/apps/api/src/models/conversation.py:27-29` (comment only)
- Test: `societal-discussion/apps/api/tests/test_party_grounding.py`

**Interfaces:**
- Produces: `BASE_PARTIES: list[str]` (9 ids), `POPULIST_SUFFIX = "_populist"`, `ALL_PARTIES: list[str]` (18 ids, base first then populist), `is_populist(party: str) -> bool`, `base_party(party: str) -> str`. `PARTY_FILES`, `PARTY_DISPLAY_NAMES`, `load_party_program` keep their names and signatures.

- [ ] **Step 1: Write the failing tests**

```python
# societal-discussion/apps/api/tests/test_party_grounding.py
from src.services.party_grounding import (
    ALL_PARTIES,
    BASE_PARTIES,
    PARTY_DISPLAY_NAMES,
    PARTY_FILES,
    POPULIST_SUFFIX,
    base_party,
    is_populist,
    load_party_program,
)


def test_nine_base_parties_and_eighteen_conditions():
    assert len(BASE_PARTIES) == 9
    assert len(ALL_PARTIES) == 18
    assert len(set(ALL_PARTIES)) == 18


def test_every_base_party_has_a_populist_twin_on_the_same_corpus():
    for party in BASE_PARTIES:
        twin = party + POPULIST_SUFFIX
        assert twin in ALL_PARTIES
        assert PARTY_FILES[twin] == PARTY_FILES[party]
        assert PARTY_DISPLAY_NAMES[twin] == PARTY_DISPLAY_NAMES[party] + " Populist"


def test_is_populist_and_base_party():
    assert is_populist("sdp_populist") is True
    assert is_populist("sdp") is False
    assert base_party("sdp_populist") == "sdp"
    assert base_party("sdp") == "sdp"


def test_existing_ids_are_unchanged():
    # Data already collected uses these ids; they must not be renamed.
    assert "perussuomalaiset" in ALL_PARTIES
    assert "perussuomalaiset_populist" in ALL_PARTIES
    assert PARTY_DISPLAY_NAMES["perussuomalaiset_populist"] == "Perussuomalaiset Populist"


def test_populist_variant_loads_the_same_text():
    assert load_party_program("liikenyt_populist") == load_party_program("liikenyt")
```

- [ ] **Step 2: Run to verify they fail**

Run: `cd societal-discussion/apps/api && uv run pytest tests/test_party_grounding.py -v`
Expected: FAIL with `ImportError: cannot import name 'BASE_PARTIES'`.

- [ ] **Step 3: Rewrite party_grounding.py**

Replace the whole module body above `load_party_program` with:

```python
"""
Party program grounding service.

Loads full party program text files from `apps/api/src/party_data/` and
provides them for injection into the system prompt. The full text is cached
in memory since the corpus is static and bounded.

Each of the 9 base parties has a populist twin (`<party>_populist`) that
reads the identical corpus. The twin's only difference is the
populism-markers section added by services/prompt_builder.py
(us-vs-them, people-centrism, anti-elitism; Cranmer 2011).
"""
from pathlib import Path
from functools import lru_cache

PARTY_DATA_DIR = Path(__file__).parent.parent / "party_data"

POPULIST_SUFFIX = "_populist"

_BASE_PARTY_FILES = {
    "sdp": "SDP_merged-10.txt",
    "vasemmistoliitto": "Vasemmistoliitto_merged-5.txt",
    "vihreat": "Vihreät_merged-6.txt",
    "rkp": "RKP_merged-4.txt",
    "keskusta": "Keskusta_merged-9.txt",
    "kokoomus": "KOKOOMUS_merged-2.txt",
    "perussuomalaiset": "Perussuomalaiset_merged-7.txt",
    "kristillisdemokraatit": "Kristillisdemokraatit_merged-3.txt",
    "liikenyt": "LiikeNyt_merged-8.txt",
}

_BASE_DISPLAY_NAMES = {
    "sdp": "SDP",
    "vasemmistoliitto": "Vasemmistoliitto",
    "vihreat": "Vihreät",
    "rkp": "RKP",
    "keskusta": "Keskusta",
    "kokoomus": "Kokoomus",
    "perussuomalaiset": "Perussuomalaiset",
    "kristillisdemokraatit": "Kristillisdemokraatit",
    "liikenyt": "Liike Nyt",
}

BASE_PARTIES = list(_BASE_PARTY_FILES.keys())

PARTY_FILES = {
    **_BASE_PARTY_FILES,
    **{p + POPULIST_SUFFIX: f for p, f in _BASE_PARTY_FILES.items()},
}

PARTY_DISPLAY_NAMES = {
    **_BASE_DISPLAY_NAMES,
    **{p + POPULIST_SUFFIX: n + " Populist" for p, n in _BASE_DISPLAY_NAMES.items()},
}

ALL_PARTIES = list(PARTY_FILES.keys())


def is_populist(party: str) -> bool:
    """True for the populism-augmented twin of a base party."""
    return party.endswith(POPULIST_SUFFIX)


def base_party(party: str) -> str:
    """Strip the populist suffix; identity for base parties."""
    return party[: -len(POPULIST_SUFFIX)] if is_populist(party) else party
```

Keep `load_party_program` and `get_all_party_programs` exactly as they are.

In `models/conversation.py` change the trailing comment on `assigned_party` to `# one of services.party_grounding.ALL_PARTIES (9 parties plus their populist twins)`.

- [ ] **Step 4: Run tests**

Run: `cd societal-discussion/apps/api && uv run pytest tests/test_party_grounding.py -v`
Expected: 5 PASS.

- [ ] **Step 5: Commit**

```bash
git add societal-discussion/apps/api/src/services/party_grounding.py societal-discussion/apps/api/src/models/conversation.py societal-discussion/apps/api/tests/test_party_grounding.py
git commit -m "Generate a populist twin for every base party (18 conditions)"
```

---

### Task 3: Prompt builder injects markers for any populist party

**Files:**
- Modify: `societal-discussion/apps/api/src/services/prompt_builder.py:96-113` (`_default_instruction_for`)
- Test: `societal-discussion/apps/api/tests/test_prompt_builder.py`

**Interfaces:**
- Consumes: `is_populist` from Task 2.
- Produces: unchanged signatures `_default_instruction_for(party) -> str`, `build_system_prompt(party, instruction=None, language="fi") -> str`.

- [ ] **Step 1: Write the failing tests**

```python
# societal-discussion/apps/api/tests/test_prompt_builder.py
from src.services.party_grounding import ALL_PARTIES, BASE_PARTIES, is_populist
from src.services.prompt_builder import (
    DEFAULT_SYSTEM_INSTRUCTION,
    POPULISM_MARKERS_SECTION,
    _default_instruction_for,
    build_system_prompt,
)

ANCHOR = "## Poliittiset ohjelmasi ja näkemyksesi"


def test_base_parties_get_the_plain_default():
    for party in BASE_PARTIES:
        assert _default_instruction_for(party) == DEFAULT_SYSTEM_INSTRUCTION


def test_every_populist_party_gets_the_markers_before_the_anchor():
    for party in ALL_PARTIES:
        if not is_populist(party):
            continue
        instr = _default_instruction_for(party)
        assert POPULISM_MARKERS_SECTION in instr
        assert instr.index(POPULISM_MARKERS_SECTION) < instr.index(ANCHOR)
        assert instr.count(ANCHOR) == 1


def test_build_system_prompt_for_populist_twin_ends_with_language_directive():
    prompt = build_system_prompt("kokoomus_populist", language="en")
    assert POPULISM_MARKERS_SECTION in prompt
    assert prompt.rstrip().endswith("only translate the delivery into English.")
```

- [ ] **Step 2: Run to verify the second test fails**

Run: `cd societal-discussion/apps/api && uv run pytest tests/test_prompt_builder.py -v`
Expected: `test_every_populist_party_gets_the_markers_before_the_anchor` FAILS (only `perussuomalaiset_populist` gets the markers today); the other two pass.

- [ ] **Step 3: Generalise the resolver**

Replace `_default_instruction_for` with:

```python
def _default_instruction_for(party: str) -> str:
    """Resolve the in-code default instruction for a party.

    Populist twins (`<party>_populist`) get the academic populism-markers
    section inserted just before the 'Poliittiset ohjelmasi ja näkemyksesi'
    heading. Base parties get the plain DEFAULT_SYSTEM_INSTRUCTION, so the
    markers never leak into the vanilla conditions.
    """
    if not is_populist(party):
        return DEFAULT_SYSTEM_INSTRUCTION
    anchor = "## Poliittiset ohjelmasi ja näkemyksesi"
    if anchor in DEFAULT_SYSTEM_INSTRUCTION:
        return DEFAULT_SYSTEM_INSTRUCTION.replace(anchor, POPULISM_MARKERS_SECTION + anchor, 1)
    return DEFAULT_SYSTEM_INSTRUCTION + "\n\n" + POPULISM_MARKERS_SECTION
```

and change the import line at the top to `from .party_grounding import load_party_program, is_populist`.

- [ ] **Step 4: Run tests**

Run: `cd societal-discussion/apps/api && uv run pytest tests/ -v`
Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add societal-discussion/apps/api/src/services/prompt_builder.py societal-discussion/apps/api/tests/test_prompt_builder.py
git commit -m "Inject populism markers for every populist twin"
```

---

### Task 4: Admin frontend knows the 18 conditions

**Files:**
- Modify: `societal-discussion/apps/web/src/app/admin/lib/types.ts:100-146`

**Interfaces:**
- Produces: `PARTIES` (18 ids), `PARTY_DISPLAY_NAMES`, `PARTY_COLORS` covering all 18. Names must match `party_grounding.ALL_PARTIES` exactly.

- [ ] **Step 1: Replace the three constants**

```ts
// Domain constants. Keep in sync with apps/api/src/services/party_grounding.py:
// 9 base parties plus a "<party>_populist" twin for each.
export const BASE_PARTIES = [
  'sdp',
  'vasemmistoliitto',
  'vihreat',
  'rkp',
  'keskusta',
  'kokoomus',
  'perussuomalaiset',
  'kristillisdemokraatit',
  'liikenyt',
] as const;

export const POPULIST_SUFFIX = '_populist';

export const PARTIES = [
  ...BASE_PARTIES,
  ...BASE_PARTIES.map((p) => `${p}${POPULIST_SUFFIX}` as const),
] as const;

export function isPopulist(party: string): boolean {
  return party.endsWith(POPULIST_SUFFIX);
}

export function baseParty(party: string): string {
  return isPopulist(party) ? party.slice(0, -POPULIST_SUFFIX.length) : party;
}

const BASE_DISPLAY_NAMES: Record<string, string> = {
  sdp: 'SDP',
  vasemmistoliitto: 'Vasemmistoliitto',
  vihreat: 'Vihreät',
  rkp: 'RKP',
  keskusta: 'Keskusta',
  kokoomus: 'Kokoomus',
  perussuomalaiset: 'Perussuomalaiset',
  kristillisdemokraatit: 'Kristillisdemokraatit',
  liikenyt: 'Liike Nyt',
};

export const PARTY_DISPLAY_NAMES: Record<string, string> = Object.fromEntries(
  PARTIES.map((p) => [
    p,
    isPopulist(p) ? `${BASE_DISPLAY_NAMES[baseParty(p)]} Populist` : BASE_DISPLAY_NAMES[p],
  ]),
);

// Base colors loosely match each party's brand identity while staying
// visually distinct in charts and badges. The populist twin uses a darker
// shade of the same hue so the pair reads as related but separate.
const BASE_COLORS: Record<string, string> = {
  sdp: '#DC2626',                   // red
  vasemmistoliitto: '#9333EA',      // purple (brand red would clash with SDP)
  vihreat: '#16A34A',               // emerald green
  rkp: '#FACC15',                   // yellow
  keskusta: '#65A30D',              // olive green
  kokoomus: '#2563EB',              // royal blue
  perussuomalaiset: '#1E3A8A',      // navy blue
  kristillisdemokraatit: '#F59E0B', // amber
  liikenyt: '#0D9488',              // teal
};

const POPULIST_COLORS: Record<string, string> = {
  sdp: '#7F1D1D',
  vasemmistoliitto: '#581C87',
  vihreat: '#14532D',
  rkp: '#A16207',
  keskusta: '#365314',
  kokoomus: '#1E3A8A',
  perussuomalaiset: '#0C1E55',      // unchanged from the HEPP2026 value
  kristillisdemokraatit: '#92400E',
  liikenyt: '#134E4A',
};

export const PARTY_COLORS: Record<string, string> = Object.fromEntries(
  PARTIES.map((p) => [p, isPopulist(p) ? POPULIST_COLORS[baseParty(p)] : BASE_COLORS[p]]),
);
```

Note: `kokoomus` populist and `perussuomalaiset` base share `#1E3A8A`. Change the kokoomus populist shade to `#1E40AF` so all 18 colors are unique.

- [ ] **Step 2: Lint and build**

Run: `cd societal-discussion/apps/web && npm run lint && npm run build`
Expected: no errors. If any admin page indexes `PARTIES` by a literal union type, TypeScript will complain; widen that type to `string`.

- [ ] **Step 3: Check the admin UI once**

Run backend and frontend (`cd societal-discussion && ./run.sh`), open `http://localhost:3000/admin/prompts`, expect 18 rows, with the markers section visible in every `... Populist` row and absent from base rows.

- [ ] **Step 4: Commit**

```bash
git add societal-discussion/apps/web/src/app/admin/lib/types.ts
git commit -m "Admin: list all 18 party conditions with derived names and colors"
```

---

### Task 5: OpenAI provider: GPT-6 Astra, store=false, temperature fallback

**Files:**
- Modify: `societal-discussion/apps/api/src/services/llm_models.py:7-15`
- Modify: `societal-discussion/apps/api/src/services/llm_providers/openai_provider.py`
- Test: `societal-discussion/apps/api/tests/test_openai_provider.py`

**Interfaces:**
- Produces: `OpenAIProvider.generate(messages, model, max_tokens, temperature) -> tuple[str, int]` unchanged signature; every request carries `store=False`; if the API rejects `temperature` the call is retried once without it.

Facts verified on 18.9.2026 from the OpenAI model page and migration guide: the model id is `gpt-6-astra`; context window 1,050,000 tokens (922,000 input, 128,000 output); Chat Completions is supported; the model **rejects `temperature`, `top_p` and `top_logprobs`** (the guide says to remove them); pricing $10 per 1M input, $1 per 1M cached input, $50 per 1M output.

- [ ] **Step 1: Confirm the key's project can see the model**

Run: `cd societal-discussion && set -a && . ./.env && set +a && curl -s https://api.openai.com/v1/models -H "Authorization: Bearer $OPENAI_API_KEY" | python3 -c "import sys,json;print([m['id'] for m in json.load(sys.stdin)['data'] if m['id'].startswith('gpt-6')])"`
Expected: a list containing `gpt-6-astra`. If it is missing, the project has no access yet; stop and report.

- [ ] **Step 2: Write the failing tests**

```python
# societal-discussion/apps/api/tests/test_openai_provider.py
import httpx
import openai
import pytest

from src.services.llm_models import get_default_model, is_valid_model
from src.services.llm_providers.openai_provider import OpenAIProvider


class _Usage:
    total_tokens = 42


class _Msg:
    content = "hei"


class _Choice:
    message = _Msg()


class _Resp:
    choices = [_Choice()]
    usage = _Usage()


def _bad_request(msg: str) -> openai.BadRequestError:
    req = httpx.Request("POST", "https://api.openai.com/v1/chat/completions")
    return openai.BadRequestError(msg, response=httpx.Response(400, request=req), body=None)


def test_astra_is_the_recommended_openai_model():
    assert get_default_model("openai") == "gpt-6-astra"
    assert is_valid_model("openai", "gpt-5.4")


async def test_store_false_and_temperature_sent():
    provider = OpenAIProvider(api_key="x")
    calls = []

    def fake_create(**kwargs):
        calls.append(kwargs)
        return _Resp()

    provider.client.chat.completions.create = fake_create
    text, tokens = await provider.generate([{"role": "user", "content": "hi"}], model="gpt-5.4")
    assert (text, tokens) == ("hei", 42)
    assert calls[0]["store"] is False
    assert calls[0]["temperature"] == 0.1


async def test_known_incompatible_model_never_sends_temperature():
    provider = OpenAIProvider(api_key="x")
    calls = []

    def fake_create(**kwargs):
        calls.append(kwargs)
        return _Resp()

    provider.client.chat.completions.create = fake_create
    await provider.generate([{"role": "user", "content": "hi"}], model="gpt-6-astra")
    assert len(calls) == 1
    assert "temperature" not in calls[0]
    assert calls[0]["store"] is False


async def test_unknown_model_retries_without_temperature_when_rejected():
    provider = OpenAIProvider(api_key="x")
    calls = []

    def fake_create(**kwargs):
        calls.append(kwargs)
        if "temperature" in kwargs:
            raise _bad_request("Unsupported value: 'temperature' does not support 0.1")
        return _Resp()

    provider.client.chat.completions.create = fake_create
    await provider.generate([{"role": "user", "content": "hi"}], model="gpt-7-future")
    assert len(calls) == 2
    assert "temperature" not in calls[1]


async def test_other_bad_requests_propagate():
    provider = OpenAIProvider(api_key="x")

    def fake_create(**kwargs):
        raise _bad_request("context length exceeded")

    provider.client.chat.completions.create = fake_create
    with pytest.raises(openai.BadRequestError):
        await provider.generate([{"role": "user", "content": "hi"}], model="gpt-5.4")
```

- [ ] **Step 3: Run to verify they fail**

Run: `cd societal-discussion/apps/api && uv run pytest tests/test_openai_provider.py -v`
Expected: first test FAILS (default is still gpt-5.4), `store` tests FAIL (KeyError), the gpt-6-astra test FAILS (temperature is sent), the retry test FAILS (BadRequestError raised).

- [ ] **Step 4: Update the registry**

In `llm_models.py`, make the OpenAI list:

```python
        "models": [
            {"id": "gpt-6-astra", "name": "GPT-6 Astra (frontier, 1M context)", "recommended": True},
            {"id": "gpt-5.4", "name": "GPT-5.4 (HEPP2026 model, 1M context)", "recommended": False},
            {"id": "gpt-5.4-mini", "name": "GPT-5.4 Mini (cheap, 1M context)", "recommended": False},
            {"id": "gpt-4.1", "name": "GPT-4.1 (1M context, no surcharge)", "recommended": False},
        ],
```

Drop the `gpt-4o` entry; its 128K window cannot hold the largest corpus.

- [ ] **Step 5: Update the provider**

Replace the module docstring block and both methods in `openai_provider.py` with:

```python
"""OpenAI LLM provider implementation."""
import asyncio
from typing import Iterator

import openai
from openai import OpenAI

from .base import LLMProvider


# Reasoning-family models (GPT-5.5, GPT-6 Astra) reject any temperature
# other than the default with HTTP 400. Known prefixes are skipped up front
# so we never pay a failed request per turn; unknown future models fall back
# to a one-shot retry when the API says the parameter is unsupported.
_TEMPERATURE_INCOMPATIBLE_PREFIXES = ("gpt-5.5", "gpt-6")


def _supports_custom_temperature(model: str) -> bool:
    return not model.startswith(_TEMPERATURE_INCOMPATIBLE_PREFIXES)


def _is_temperature_rejection(err: openai.BadRequestError) -> bool:
    return "temperature" in str(err).lower()


class OpenAIProvider(LLMProvider):
    def __init__(self, api_key: str):
        super().__init__(api_key)
        self.client = OpenAI(api_key=api_key)

    def _base_kwargs(self, messages: list[dict], model: str, max_tokens: int) -> dict:
        return {
            "model": model,
            "max_completion_tokens": max_tokens,
            "messages": [{"role": m["role"], "content": m["content"]} for m in messages],
            # Never keep prompts or completions on OpenAI's side beyond the
            # 30-day abuse-monitoring window (privacy notice section 13).
            "store": False,
        }

    async def generate(
        self,
        messages: list[dict],
        model: str,
        max_tokens: int = 1024,
        temperature: float = 0.1,
    ) -> tuple[str, int]:
        kwargs = self._base_kwargs(messages, model, max_tokens)
        if not _supports_custom_temperature(model):
            response = await asyncio.to_thread(self.client.chat.completions.create, **kwargs)
        else:
            try:
                response = await asyncio.to_thread(
                    self.client.chat.completions.create, temperature=temperature, **kwargs
                )
            except openai.BadRequestError as err:
                if not _is_temperature_rejection(err):
                    raise
                response = await asyncio.to_thread(self.client.chat.completions.create, **kwargs)

        return response.choices[0].message.content, response.usage.total_tokens

    def generate_streaming(
        self,
        messages: list[dict],
        model: str,
        max_tokens: int = 1024,
        temperature: float = 0.1,
    ) -> Iterator[str]:
        kwargs = self._base_kwargs(messages, model, max_tokens)
        kwargs["stream"] = True
        if not _supports_custom_temperature(model):
            stream = self.client.chat.completions.create(**kwargs)
        else:
            try:
                stream = self.client.chat.completions.create(temperature=temperature, **kwargs)
            except openai.BadRequestError as err:
                if not _is_temperature_rejection(err):
                    raise
                stream = self.client.chat.completions.create(**kwargs)

        for chunk in stream:
            if chunk.choices[0].delta.content:
                yield chunk.choices[0].delta.content
```

- [ ] **Step 6: Run tests and lint**

Run: `cd societal-discussion/apps/api && uv run pytest tests/ -v && uv run ruff check src/`
Expected: all PASS, ruff clean.

- [ ] **Step 7: Live smoke test**

Run: `cd societal-discussion && ./run.sh`, open `http://localhost:3000/admin/settings`, select GPT-6 Astra, save, then in `/admin/try-bot` pick `vihreat_populist` (the largest corpus) and send "Mitä mieltä olet metsien hakkuista?". Expected: a reply in Finnish with a clear position; no 400 in the API log. Check the terminal log line for token count to confirm the full corpus fit. Note the cost: at $10 per 1M input tokens an uncached Vihreät turn is about $2.20; send a second message in the same conversation and confirm in the OpenAI usage dashboard that the second request was billed mostly as cached input ($1 per 1M).

- [ ] **Step 8: Commit**

```bash
git add societal-discussion/apps/api/src/services/llm_models.py societal-discussion/apps/api/src/services/llm_providers/openai_provider.py societal-discussion/apps/api/tests/test_openai_provider.py
git commit -m "OpenAI provider: add GPT-6 Astra, send store=false, retry without temperature"
```

---

## Self-review

- Spec coverage: E1 is deployment (Plan 4). E2 is Tasks 2 and 3. E3 is Task 5. Admin mirror is Task 4.
- The party-assignment service needs no change: it iterates `ALL_PARTIES`, which now has 18 entries, and the per-session no-repeat logic still applies.
- `admin.py` validates parties against `ALL_PARTIES` and lists prompts from it, so it picks up the 18 conditions without edits.

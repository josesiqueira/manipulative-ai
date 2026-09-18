# Plan 3: Debrief, session code, "Delete my data"

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** After the survey, the thank-you page tells the participant which party each of their conversations was aligned with and whether the populist framing was on, shows a session code they can quote later, and lets them delete their message and survey data with one button. Admins can find a session by code and see consent fields in exports.

**Architecture:** A tiny `session_code.py` service formats and parses the code (first 8 hex characters of the session UUID). `GET /api/sessions/{id}/debrief` is the only participant endpoint that ever reveals `assigned_party`, and only after a survey row exists for the session. `DELETE /api/sessions/{id}/data` removes message and survey rows, keeps conversation rows as tombstones, stamps `data_deleted_at`. The thank-you page is rewritten around the debrief response; all wording comes from a new `debrief` block in `translations.ts` plus the provider block.

**Tech Stack:** FastAPI, SQLAlchemy 2 async, pytest; Next.js 14 + TypeScript.

**Spec:** `docs/superpowers/specs/2026-09-18-metso-demo-design.md` (decisions E6, E7)

**Depends on:** Plan 1 (fixtures, `is_populist`, `PARTY_DISPLAY_NAMES`), Plan 2 Task 1 (`data_deleted_at`, consent columns), Plan 2 Task 3 (`STUDY`, `PROVIDER_NOTICE`, `participantApi.ts`).

## Global Constraints

- Backend commands from `societal-discussion/apps/api` with `uv run ...`; frontend from `societal-discussion/apps/web`.
- No em dashes or en dashes anywhere. Never use "baked", "baked in", "thin".
- Debrief wording comes from `docs/consent/2026-10-23-metso-consent-package.md` section 4d, adapted to list every conversation in the session (a session can hold several, each with its own party).
- `assigned_party` must never appear in any participant response other than the debrief, and the debrief must return 403 until a survey exists for the session.
- Commit after each task.

---

### Task 1: Session code service

**Files:**
- Create: `societal-discussion/apps/api/src/services/session_code.py`
- Test: `societal-discussion/apps/api/tests/test_session_code.py`

**Interfaces:**
- Produces: `format_session_code(session_id: str) -> str` (e.g. `"3F2A-9C11"`), `session_id_prefix_from_code(code: str) -> str | None` (returns the 8 lowercase hex chars, or None when the code is malformed).

- [ ] **Step 1: Write the failing tests**

```python
# societal-discussion/apps/api/tests/test_session_code.py
from src.services.session_code import format_session_code, session_id_prefix_from_code


def test_format_takes_first_eight_hex_chars_uppercase_in_two_groups():
    assert format_session_code("3f2a9c11-aaaa-bbbb-cccc-dddddddddddd") == "3F2A-9C11"


def test_parse_accepts_hyphen_space_and_case_variants():
    assert session_id_prefix_from_code("3F2A-9C11") == "3f2a9c11"
    assert session_id_prefix_from_code("3f2a 9c11") == "3f2a9c11"
    assert session_id_prefix_from_code("3f2a9c11") == "3f2a9c11"


def test_parse_rejects_garbage():
    assert session_id_prefix_from_code("") is None
    assert session_id_prefix_from_code("ZZZZ-9C11") is None
    assert session_id_prefix_from_code("3f2a9c1") is None
```

- [ ] **Step 2: Run to verify they fail**

Run: `cd societal-discussion/apps/api && uv run pytest tests/test_session_code.py -v`
Expected: `ModuleNotFoundError: src.services.session_code`.

- [ ] **Step 3: Implement**

```python
# societal-discussion/apps/api/src/services/session_code.py
"""
Session codes shown on the thank-you page.

A participant has no account, so the first 8 hex characters of the session
UUID, shown as XXXX-XXXX, are the only handle they can quote later when they
ask us to show or delete their data. 32 bits is enough to be unique among the
few hundred sessions a demo produces; the admin lookup returns every match.
"""
import re

_CODE_RE = re.compile(r"^[0-9a-f]{8}$")


def format_session_code(session_id: str) -> str:
    raw = session_id.replace("-", "")[:8].upper()
    return f"{raw[:4]}-{raw[4:]}"


def session_id_prefix_from_code(code: str) -> str | None:
    raw = re.sub(r"[\s-]", "", code or "").lower()
    return raw if _CODE_RE.fullmatch(raw) else None
```

- [ ] **Step 4: Run tests**

Run: `cd societal-discussion/apps/api && uv run pytest tests/test_session_code.py -v`
Expected: 3 PASS.

- [ ] **Step 5: Commit**

```bash
git add societal-discussion/apps/api/src/services/session_code.py societal-discussion/apps/api/tests/test_session_code.py
git commit -m "Add session code formatting and parsing"
```

---

### Task 2: Debrief endpoint

**Files:**
- Modify: `societal-discussion/apps/api/src/routers/sessions.py`
- Test: `societal-discussion/apps/api/tests/test_debrief.py`

**Interfaces:**
- Produces: `GET /api/sessions/{id}/debrief` returning

```json
{
  "session_code": "3F2A-9C11",
  "data_deleted": false,
  "conversations": [
    {"id": "...", "party_display_name": "Kokoomus", "is_populist": false, "started_at": "..."},
    {"id": "...", "party_display_name": "SDP Populist", "is_populist": true, "started_at": "..."}
  ]
}
```

403 `{"detail": "Survey not submitted"}` when the session has no survey row; 404 when the session does not exist. Conversations are ordered by `started_at`. `party_display_name` for a populist twin is the BASE party's display name (the populist flag carries the rest), so the participant reads "SDP" plus "populist framing on", not "SDP Populist".

- [ ] **Step 1: Write the failing tests**

```python
# societal-discussion/apps/api/tests/test_debrief.py
from src.models import Conversation, Session, SurveyResponse


async def _consented_session(db_session, parties: list[str]) -> Session:
    s = Session(consent_version="t", age_confirmed=True)
    db_session.add(s)
    await db_session.flush()
    for p in parties:
        db_session.add(Conversation(session_id=s.id, assigned_party=p, language="fi"))
    await db_session.flush()
    return s


async def test_debrief_is_forbidden_before_survey(client, db_session):
    s = await _consented_session(db_session, ["sdp"])
    res = await client.get(f"/api/sessions/{s.id}/debrief")
    assert res.status_code == 403
    assert "sdp" not in res.text


async def test_debrief_lists_every_conversation_after_survey(client, db_session):
    s = await _consented_session(db_session, ["kokoomus", "sdp_populist"])
    db_session.add(SurveyResponse(session_id=s.id, responses={}))
    await db_session.flush()
    res = await client.get(f"/api/sessions/{s.id}/debrief")
    assert res.status_code == 200
    body = res.json()
    assert body["session_code"] == f"{s.id[:4].upper()}-{s.id[4:8].upper()}"
    assert body["data_deleted"] is False
    names = [(c["party_display_name"], c["is_populist"]) for c in body["conversations"]]
    assert names == [("Kokoomus", False), ("SDP", True)]


async def test_debrief_unknown_session_is_404(client):
    res = await client.get("/api/sessions/nope/debrief")
    assert res.status_code == 404
```

- [ ] **Step 2: Run to verify they fail**

Run: `cd societal-discussion/apps/api && uv run pytest tests/test_debrief.py -v`
Expected: 404 for all (route missing), so the first two tests FAIL.

- [ ] **Step 3: Add the endpoint to sessions.py**

Extend the imports:

```python
from sqlalchemy.orm import selectinload

from ..models import Conversation, Session, SurveyResponse
from ..services.party_grounding import PARTY_DISPLAY_NAMES, base_party, is_populist
from ..services.session_code import format_session_code
```

Add the models and route:

```python
class DebriefConversation(BaseModel):
    id: str
    party_display_name: str
    is_populist: bool
    started_at: datetime


class DebriefResponse(BaseModel):
    """Revealed only after the survey exists. This is the one participant
    endpoint that discloses the experimental condition."""

    session_code: str
    data_deleted: bool
    conversations: list[DebriefConversation]


@router.get("/{session_id}/debrief", response_model=DebriefResponse)
async def get_debrief(
    session_id: str,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Session)
        .options(selectinload(Session.conversations), selectinload(Session.survey_responses))
        .where(Session.id == session_id)
    )
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found")
    if not session.survey_responses:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Survey not submitted")

    conversations = sorted(session.conversations, key=lambda c: c.started_at)
    return DebriefResponse(
        session_code=format_session_code(session.id),
        data_deleted=session.data_deleted_at is not None,
        conversations=[
            DebriefConversation(
                id=c.id,
                party_display_name=PARTY_DISPLAY_NAMES[base_party(c.assigned_party)],
                is_populist=is_populist(c.assigned_party),
                started_at=c.started_at,
            )
            for c in conversations
        ],
    )
```

- [ ] **Step 4: Run tests**

Run: `cd societal-discussion/apps/api && uv run pytest tests/ -v && uv run ruff check src/`
Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add societal-discussion/apps/api/src/routers/sessions.py societal-discussion/apps/api/tests/test_debrief.py
git commit -m "Add post-survey debrief endpoint revealing party and populist condition"
```

---

### Task 3: "Delete my data" endpoint

**Files:**
- Modify: `societal-discussion/apps/api/src/routers/sessions.py`
- Test: `societal-discussion/apps/api/tests/test_delete_data.py`

**Interfaces:**
- Produces: `DELETE /api/sessions/{id}/data` returning 204. Deletes all `messages` rows of the session's conversations and all `survey_responses` rows of the session; marks every conversation `is_complete=True`; sets `sessions.data_deleted_at`. Idempotent. 404 for unknown session.

- [ ] **Step 1: Write the failing tests**

```python
# societal-discussion/apps/api/tests/test_delete_data.py
from sqlalchemy import func, select

from src.models import Conversation, Message, Session, SurveyResponse


async def _count(db_session, model) -> int:
    return (await db_session.execute(select(func.count()).select_from(model))).scalar_one()


async def test_delete_removes_messages_and_survey_but_keeps_tombstone(client, db_session):
    s = Session(consent_version="t", age_confirmed=True)
    db_session.add(s)
    await db_session.flush()
    c = Conversation(session_id=s.id, assigned_party="rkp", language="fi")
    db_session.add(c)
    await db_session.flush()
    db_session.add(Message(conversation_id=c.id, role="user", content="hei"))
    db_session.add(Message(conversation_id=c.id, role="assistant", content="hei hei"))
    db_session.add(SurveyResponse(session_id=s.id, responses={"detected_bias": 3}))
    await db_session.flush()

    res = await client.delete(f"/api/sessions/{s.id}/data")
    assert res.status_code == 204

    assert await _count(db_session, Message) == 0
    assert await _count(db_session, SurveyResponse) == 0
    assert await _count(db_session, Conversation) == 1
    await db_session.refresh(s)
    assert s.data_deleted_at is not None
    await db_session.refresh(c)
    assert c.assigned_party == "rkp"
    assert c.is_complete is True

    # Idempotent
    res = await client.delete(f"/api/sessions/{s.id}/data")
    assert res.status_code == 204


async def test_delete_unknown_session_is_404(client):
    res = await client.delete("/api/sessions/nope/data")
    assert res.status_code == 404
```

- [ ] **Step 2: Run to verify they fail**

Run: `cd societal-discussion/apps/api && uv run pytest tests/test_delete_data.py -v`
Expected: 404 / 405 on the first test, FAIL.

- [ ] **Step 3: Add the endpoint**

Add `from fastapi import Response` to the imports (alongside the existing FastAPI import) and `from ..models import Message` to the models import. Then:

```python
@router.delete("/{session_id}/data", status_code=status.HTTP_204_NO_CONTENT)
async def delete_session_data(
    session_id: str,
    db: AsyncSession = Depends(get_db),
):
    """Participant-initiated deletion (thank-you page, or by emailed code).

    Removes message and survey rows. Conversation rows stay as a tombstone
    (condition, timestamps, no content) so the arm counts remain auditable.
    """
    result = await db.execute(
        select(Session).options(selectinload(Session.conversations)).where(Session.id == session_id)
    )
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found")

    conversation_ids = [c.id for c in session.conversations]
    if conversation_ids:
        await db.execute(Message.__table__.delete().where(Message.conversation_id.in_(conversation_ids)))
    await db.execute(SurveyResponse.__table__.delete().where(SurveyResponse.session_id == session.id))
    for c in session.conversations:
        c.is_complete = True
        if c.ended_at is None:
            c.ended_at = datetime.now(HELSINKI)
    session.data_deleted_at = datetime.now(HELSINKI)
    await db.flush()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
```

- [ ] **Step 4: Run tests**

Run: `cd societal-discussion/apps/api && uv run pytest tests/ -v && uv run ruff check src/`
Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add societal-discussion/apps/api/src/routers/sessions.py societal-discussion/apps/api/tests/test_delete_data.py
git commit -m "Add participant data deletion endpoint with tombstone conversations"
```

---

### Task 4: Admin lookup by code and consent fields in exports

**Files:**
- Modify: `societal-discussion/apps/api/src/routers/admin.py` (`SessionListItem`, `list_sessions`, new route, `export_data` rows and CSV fieldnames)
- Test: `societal-discussion/apps/api/tests/test_admin_sessions.py`

**Interfaces:**
- Produces: `GET /api/admin/sessions/by-code/{code}` (admin header) returning a list of `SessionListItem`; `SessionListItem` gains `consent_version: str | None`, `age_confirmed: bool`, `data_deleted_at: datetime | None`; conversation-level export rows and CSV header gain the same three columns.

- [ ] **Step 1: Write the failing tests**

```python
# societal-discussion/apps/api/tests/test_admin_sessions.py
import csv
import io

from src.models import Conversation, Session

HEADERS = {"X-Admin-Password": "admin"}


async def test_lookup_by_code_finds_the_session(client, db_session):
    s = Session(consent_version="2026-10-23-v1", age_confirmed=True)
    db_session.add(s)
    await db_session.flush()
    code = f"{s.id[:4]}-{s.id[4:8]}".upper()

    res = await client.get(f"/api/admin/sessions/by-code/{code}", headers=HEADERS)
    assert res.status_code == 200
    body = res.json()
    assert [x["id"] for x in body] == [s.id]
    assert body[0]["consent_version"] == "2026-10-23-v1"
    assert body[0]["age_confirmed"] is True
    assert body[0]["data_deleted_at"] is None


async def test_lookup_by_bad_code_is_400(client):
    res = await client.get("/api/admin/sessions/by-code/zzzz", headers=HEADERS)
    assert res.status_code == 400


async def test_lookup_requires_admin(client):
    res = await client.get("/api/admin/sessions/by-code/3f2a9c11")
    assert res.status_code == 401


async def test_export_csv_has_consent_columns(client, db_session):
    s = Session(consent_version="2026-10-23-v1", age_confirmed=True)
    db_session.add(s)
    await db_session.flush()
    db_session.add(Conversation(session_id=s.id, assigned_party="sdp", language="fi"))
    await db_session.flush()

    res = await client.get("/api/admin/export?format=csv", headers=HEADERS)
    assert res.status_code == 200
    rows = list(csv.DictReader(io.StringIO(res.text)))
    assert rows[0]["consent_version"] == "2026-10-23-v1"
    assert rows[0]["age_confirmed"] == "True"
    assert rows[0]["data_deleted_at"] == ""
```

- [ ] **Step 2: Run to verify they fail**

Run: `cd societal-discussion/apps/api && uv run pytest tests/test_admin_sessions.py -v`
Expected: FAIL (404 route, KeyError on CSV columns).

- [ ] **Step 3: Extend SessionListItem and list_sessions**

```python
class SessionListItem(BaseModel):
    """Session summary for admin list."""

    id: str
    created_at: datetime
    conversation_count: int
    is_test_mode: bool
    consent_version: str | None = None
    age_confirmed: bool = False
    data_deleted_at: datetime | None = None

    model_config = ConfigDict(from_attributes=True)


def _session_item(s: Session) -> SessionListItem:
    return SessionListItem(
        id=s.id,
        created_at=s.created_at,
        conversation_count=len(s.conversations),
        is_test_mode=s.is_test_mode,
        consent_version=s.consent_version,
        age_confirmed=s.age_confirmed,
        data_deleted_at=s.data_deleted_at,
    )
```

In `list_sessions` replace the list comprehension body with `_session_item(s) for s in sessions`. Then add, directly after `list_sessions`:

```python
@router.get("/sessions/by-code/{code}", response_model=list[SessionListItem])
async def find_sessions_by_code(
    code: str,
    db: AsyncSession = Depends(get_db),
    _: bool = Depends(verify_admin),
):
    """Look up sessions by the XXXX-XXXX code shown on the thank-you page.

    Used to honour deletion or access requests sent by email. Returns every
    session whose id starts with the 8 hex characters (normally one)."""
    prefix = session_id_prefix_from_code(code)
    if prefix is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Malformed session code")
    result = await db.execute(
        select(Session)
        .options(selectinload(Session.conversations))
        .where(Session.id.like(f"{prefix}%"))
        .order_by(Session.created_at.desc())
    )
    return [_session_item(s) for s in result.scalars().all()]
```

and add `from ..services.session_code import session_id_prefix_from_code` to the imports. Route order matters: `/sessions/by-code/{code}` must be declared before any `/sessions/{session_id}` route in `admin.py` if one exists (grep `"/sessions/{"`; if found, move this route above it).

- [ ] **Step 4: Extend the export**

In `export_data`, add `selectinload(Conversation.session)` to the `.options(...)` of the query. In the conversation-level `rows.append({...})` add after `"ended_at"`:

```python
            "consent_version": conv.session.consent_version or "",
            "age_confirmed": conv.session.age_confirmed,
            "data_deleted_at": conv.session.data_deleted_at.isoformat() if conv.session.data_deleted_at else "",
```

and in the CSV `fieldnames` list add `"consent_version", "age_confirmed", "data_deleted_at",` after `"ended_at",`.

- [ ] **Step 5: Run tests**

Run: `cd societal-discussion/apps/api && uv run pytest tests/ -v && uv run ruff check src/`
Expected: all PASS.

- [ ] **Step 6: Commit**

```bash
git add societal-discussion/apps/api/src/routers/admin.py societal-discussion/apps/api/tests/test_admin_sessions.py
git commit -m "Admin: find sessions by code; export consent and deletion fields"
```

---

### Task 5: Frontend API helpers and debrief strings

**Files:**
- Modify: `societal-discussion/apps/web/src/lib/participantApi.ts`
- Modify: `societal-discussion/apps/web/src/lib/translations.ts`

**Interfaces:**
- Produces in `participantApi.ts`: `interface DebriefConversation { id: string; party_display_name: string; is_populist: boolean; started_at: string }`, `interface Debrief { session_code: string; data_deleted: boolean; conversations: DebriefConversation[] }`, `getDebrief(sessionId): Promise<Debrief | null>` (null on 403/404), `deleteSessionData(sessionId): Promise<void>`.
- Produces on `UIStrings`: `debrief` block (keys listed below). `thankYou.description` stays for the fallback when no debrief is available.

- [ ] **Step 1: API helpers**

Append to `participantApi.ts`:

```ts
export interface DebriefConversation {
  id: string;
  party_display_name: string;
  is_populist: boolean;
  started_at: string;
}

export interface Debrief {
  session_code: string;
  data_deleted: boolean;
  conversations: DebriefConversation[];
}

export async function getDebrief(sessionId: string): Promise<Debrief | null> {
  const res = await fetch(`${API_URL}/api/sessions/${sessionId}/debrief`);
  if (res.status === 403 || res.status === 404) return null;
  if (!res.ok) throw new Error('debrief-failed');
  return res.json();
}

export async function deleteSessionData(sessionId: string): Promise<void> {
  const res = await fetch(`${API_URL}/api/sessions/${sessionId}/data`, { method: 'DELETE' });
  if (!res.ok) throw new Error('delete-failed');
}
```

- [ ] **Step 2: Interface**

Add to `UIStrings`:

```ts
  debrief: {
    title: string;
    intro: string;
    setupTitle: string;
    setupIntro: string;
    conversationLabel: string; // contains {{N}}
    populistOn: string;
    populistOff: string;
    repliesTitle: string;
    repliesBody: string; // contains {{POHTIVA}}
    whyTitle: string;
    whyBody: string;
    dataTitle: string;
    codeLabel: string;
    copy: string;
    copied: string;
    dataBody: string; // contains {{EMAIL}}
    deleteButton: string;
    deleteConfirm: string;
    deleted: string;
    deleteError: string;
    contactTitle: string;
    contactBody: string; // contains {{EMAIL}}, {{RESEARCHER}}, {{RESEARCHER_EMAIL}}, {{DPO}}
  };
```

- [ ] **Step 3: Finnish values**

```ts
  debrief: {
    title: 'Kiitos osallistumisestasi!',
    intro: 'Nyt voimme kertoa, mistä tutkimuksessa oli kyse.',
    setupTitle: 'Miten chatbot oli asetettu',
    setupIntro:
      'Chatbot, jonka kanssa keskustelit, oli ohjeistettu noudattamaan yhden suomalaisen puolueen ohjelmaa. Keskusteluissasi puolue oli:',
    conversationLabel: 'Keskustelu {{N}}',
    populistOn:
      'Lisäksi chatbottia ohjeistettiin käyttämään populistista puhetapaa, esimerkiksi asettamaan vastakkain "tavallinen kansa" ja "eliitti".',
    populistOff: 'Chatbottia ei ohjeistettu käyttämään erityistä puhetapaa puolueen ohjelman lisäksi.',
    repliesTitle: 'Mitä vastaukset olivat',
    repliesBody:
      'Vastaukset tuotti tekoälymalli puolueen julkisten ohjelmien pohjalta (lähde: Pohtiva-tietokanta, {{POHTIVA}}). Ne eivät ole puolueen tai sen ehdokkaiden lausuntoja, ja malli voi esittää puolueen kannat virheellisesti. Jos jokin väite jäi mietityttämään, tarkista se puolueen omista lähteistä.',
    whyTitle: 'Miksi emme kertoneet tätä etukäteen',
    whyBody:
      'Tutkimme, huomaavatko ihmiset chatbotin piilotetun poliittisen painotuksen ja vaikuttamisen. Jos olisimme kertoneet puolueen etukäteen, tätä ei olisi voinut tutkia. Puolue arvottiin jokaiseen keskusteluun erikseen, joten muut saivat todennäköisesti eri puolueen. Pyydämme, ettet kerro omaa puoluettasi niille, jotka eivät ole vielä lopettaneet.',
    dataTitle: 'Sinun tietosi',
    codeLabel: 'Istuntokoodisi on',
    copy: 'Kopioi',
    copied: 'Kopioitu',
    dataBody:
      'Ota kuvakaappaus, jos haluat myöhemmin pyytää tietojesi näyttämistä tai poistamista; kirjoita osoitteeseen {{EMAIL}} ja mainitse koodi. Voit myös poistaa keskustelusi ja kyselyvastauksesi heti alla olevalla painikkeella. Poisto on lopullinen. Ilman koodia emme voi myöhemmin löytää tietojasi.',
    deleteButton: 'Poista tietoni',
    deleteConfirm: 'Poistetaanko keskustelusi ja kyselyvastauksesi pysyvästi?',
    deleted: 'Tietosi on poistettu. Kiitos, että osallistuit.',
    deleteError: 'Poisto epäonnistui. Yritä uudelleen tai lähetä koodi sähköpostilla.',
    contactTitle: 'Kysymykset ja palaute',
    contactBody:
      'José Siqueira de Cerqueira, Tampereen yliopisto, {{EMAIL}} (paikalla tänään). Vastuullinen tutkija: {{RESEARCHER}}, Vaasan yliopisto, {{RESEARCHER_EMAIL}}. Tietosuoja: {{DPO}}.',
  },
```

- [ ] **Step 4: English values**

```ts
  debrief: {
    title: 'Thank you for taking part!',
    intro: 'Now we can tell you what the study was about.',
    setupTitle: 'How the chatbot was set up',
    setupIntro:
      'The chatbot you talked to was instructed to follow the programme of one Finnish political party. In your conversations the party was:',
    conversationLabel: 'Conversation {{N}}',
    populistOn:
      'In addition, it was instructed to use a populist style, for example setting "ordinary people" against "the elite".',
    populistOff: 'It was not instructed to use any particular style beyond the party programme.',
    repliesTitle: 'What the replies were',
    repliesBody:
      'The replies were generated by an AI model from the party\'s public programmes (source: the Pohtiva database, {{POHTIVA}}). They are not statements by the party or its candidates, and the model can misstate the party\'s positions. If a claim stayed with you, check it against the party\'s own sources.',
    whyTitle: 'Why we did not tell you beforehand',
    whyBody:
      'We study whether people notice a chatbot\'s hidden political slant and persuasion. Had we named the party in advance, this could not have been studied. The party was drawn at random for each conversation, so other people most likely got a different one. Please do not tell your party to people who have not yet finished.',
    dataTitle: 'Your data',
    codeLabel: 'Your session code is',
    copy: 'Copy',
    copied: 'Copied',
    dataBody:
      'Take a screenshot if you may later want to ask us to show or delete your data; write to {{EMAIL}} and quote the code. You can also delete your conversation and survey answers right now with the button below. Deletion is permanent. Without the code we cannot find your data later.',
    deleteButton: 'Delete my data',
    deleteConfirm: 'Permanently delete your conversations and survey answers?',
    deleted: 'Your data has been deleted. Thank you for taking part.',
    deleteError: 'Deletion failed. Try again or email us the code.',
    contactTitle: 'Questions and feedback',
    contactBody:
      'José Siqueira de Cerqueira, Tampere University, {{EMAIL}} (on site today). Responsible researcher: {{RESEARCHER}}, University of Vaasa, {{RESEARCHER_EMAIL}}. Data protection: {{DPO}}.',
  },
```

- [ ] **Step 5: Type-check and commit**

Run: `cd societal-discussion/apps/web && npx tsc --noEmit`
Expected: clean.

```bash
git add societal-discussion/apps/web/src/lib/participantApi.ts societal-discussion/apps/web/src/lib/translations.ts
git commit -m "Add debrief API helpers and FI/EN debrief strings"
```

---

### Task 6: Thank-you page with debrief, code and delete

**Files:**
- Modify (rewrite): `societal-discussion/apps/web/src/app/thank-you/page.tsx`

**Interfaces:**
- Consumes: `getDebrief`, `deleteSessionData`, `Debrief` (Task 5), `STUDY`, `PROVIDER_NOTICE` (Plan 2 Task 3), `t.debrief.*`, `t.consent.linksResearch/linksPrivacy`.

- [ ] **Step 1: Rewrite the page**

```tsx
'use client';

import { useEffect, useState } from 'react';
import { TRANSLATIONS, Language, getStoredLanguage } from '@/lib/translations';
import { STUDY } from '@/lib/studyConfig';
import { PROVIDER_NOTICE } from '@/lib/providerNotice';
import { Debrief, deleteSessionData, getDebrief } from '@/lib/participantApi';

function fill(template: string, values: Record<string, string>): string {
  return Object.entries(values).reduce(
    (acc, [key, value]) => acc.split(`{{${key}}}`).join(value),
    template,
  );
}

export default function ThankYouPage() {
  const [lang, setLang] = useState<Language>('fi');
  const [debrief, setDebrief] = useState<Debrief | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [copied, setCopied] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState(false);

  useEffect(() => {
    const l = getStoredLanguage();
    setLang(l);
    const sessionId = localStorage.getItem('sessionId');
    if (!sessionId) {
      setLoaded(true);
      return;
    }
    getDebrief(sessionId)
      .then(setDebrief)
      .catch(console.error)
      .finally(() => setLoaded(true));
  }, []);

  const t = TRANSLATIONS[lang];
  const d = t.debrief;

  const copyCode = async () => {
    if (!debrief) return;
    try {
      await navigator.clipboard.writeText(debrief.session_code);
      setCopied(true);
    } catch {
      // Clipboard can be blocked; the code is still visible on screen.
    }
  };

  const onDelete = async () => {
    const sessionId = localStorage.getItem('sessionId');
    if (!sessionId || !debrief || deleting) return;
    if (!window.confirm(d.deleteConfirm)) return;
    setDeleting(true);
    setDeleteError(false);
    try {
      await deleteSessionData(sessionId);
      setDebrief({ ...debrief, data_deleted: true });
    } catch {
      setDeleteError(true);
    } finally {
      setDeleting(false);
    }
  };

  if (!loaded) return null;

  // Fallback: no session or survey not submitted (direct visit).
  if (!debrief) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white flex items-center justify-center">
        <div className="max-w-md mx-auto px-4 text-center">
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-8">
            <h1 className="text-2xl font-bold text-slate-900 mb-4">{t.thankYou.title}</h1>
            <p className="text-slate-600">{t.thankYou.description}</p>
          </div>
        </div>
      </div>
    );
  }

  const card = 'bg-white rounded-xl shadow-sm border border-slate-200 p-5 mb-4';

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      <div className="max-w-xl mx-auto px-4 py-8 text-slate-800 text-sm leading-relaxed">
        <h1 className="text-2xl font-bold text-slate-900 mb-2">{d.title}</h1>
        <p className="mb-6">{d.intro}</p>

        <section className={card}>
          <h2 className="font-semibold text-slate-900 mb-2">{d.setupTitle}</h2>
          <p className="mb-3">{d.setupIntro}</p>
          <ol className="space-y-2">
            {debrief.conversations.map((c, i) => (
              <li key={c.id} className="border-l-4 border-slate-300 pl-3">
                <span className="text-slate-500">{fill(d.conversationLabel, { N: String(i + 1) })}: </span>
                <strong className="text-slate-900">{c.party_display_name}</strong>
                <p className="text-slate-600">{c.is_populist ? d.populistOn : d.populistOff}</p>
              </li>
            ))}
          </ol>
        </section>

        <section className={card}>
          <h2 className="font-semibold text-slate-900 mb-2">{d.repliesTitle}</h2>
          <p>{fill(d.repliesBody, { POHTIVA: STUDY.pohtivaUrl })}</p>
        </section>

        <section className={card}>
          <h2 className="font-semibold text-slate-900 mb-2">{d.whyTitle}</h2>
          <p>{d.whyBody}</p>
        </section>

        <section className={card}>
          <h2 className="font-semibold text-slate-900 mb-2">{d.dataTitle}</h2>
          {debrief.data_deleted ? (
            <p className="font-medium text-slate-900">{d.deleted}</p>
          ) : (
            <>
              <p className="mb-2">
                {d.codeLabel}{' '}
                <code className="text-lg font-bold tracking-widest text-slate-900" data-testid="session-code">
                  {debrief.session_code}
                </code>{' '}
                <button onClick={copyCode} className="ml-2 px-2 py-1 text-xs border border-slate-300 rounded-md">
                  {copied ? d.copied : d.copy}
                </button>
              </p>
              <p className="mb-3">{fill(d.dataBody, { EMAIL: STUDY.contactEmail })}</p>
              <button
                onClick={onDelete}
                disabled={deleting}
                className="w-full py-3 px-6 border border-red-300 text-red-700 rounded-xl font-medium hover:bg-red-50 transition-colors disabled:opacity-50"
              >
                {d.deleteButton}
              </button>
              {deleteError && <p className="mt-2 text-red-700">{d.deleteError}</p>}
            </>
          )}
          <p className="mt-4 text-xs text-slate-500">{PROVIDER_NOTICE[lang].debriefNote}</p>
        </section>

        <section className={card}>
          <h2 className="font-semibold text-slate-900 mb-2">{d.contactTitle}</h2>
          <p>
            {fill(d.contactBody, {
              EMAIL: STUDY.contactEmail,
              RESEARCHER: STUDY.responsibleResearcher,
              RESEARCHER_EMAIL: STUDY.responsibleResearcherEmail,
              DPO: STUDY.dpoEmail,
            })}
          </p>
          <p className="mt-2">
            <a className="underline" href={`/info/research-notification?lang=${lang}`} target="_blank" rel="noreferrer">
              {t.consent.linksResearch}
            </a>
            {' · '}
            <a className="underline" href={`/info/privacy-notice?lang=${lang}`} target="_blank" rel="noreferrer">
              {t.consent.linksPrivacy}
            </a>
          </p>
        </section>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Lint, build, run the flow**

Run: `cd societal-discussion/apps/web && npm run lint && npm run build`.
With `./run.sh` running (backend needs an OpenAI key for the chat step): go through consent, send one message, "Takaisin alkuun", start a second conversation, send one message, "Lopeta keskustelu", submit the survey. On `/thank-you` expect two conversation entries with party names, the populist sentence varying per condition, a code like `3F2A-9C11`, and after "Poista tietoni" + confirm the deleted text. In `/admin/conversations` the two conversations still exist with 0 messages; `GET /api/admin/sessions/by-code/<code>` (with the header) returns the session with `data_deleted_at` set.

- [ ] **Step 3: Commit**

```bash
git add societal-discussion/apps/web/src/app/thank-you/page.tsx
git commit -m "Thank-you page: debrief per conversation, session code, delete my data"
```

---

## Self-review

- Spec coverage: E6 is Tasks 2, 5, 6; E7 is Tasks 1, 3, 4, 6. Package items C7, C8, C10, C14 (random per conversation, so the "drawn at random" sentence is correct under E1), C18 (admin lookup by code for emailed requests) are covered.
- Names: `format_session_code` / `session_id_prefix_from_code` (Task 1) used in Tasks 2 and 4; `getDebrief` / `deleteSessionData` / `Debrief` (Task 5) used in Task 6; `t.debrief.*` keys in Task 5 match the ones read in Task 6.
- The debrief shows the base party name plus a populist sentence, which matches the 4d text ("the party was X" + framing sentence) better than showing "X Populist".

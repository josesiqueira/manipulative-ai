# Plan 2: Consent flow (research notification, privacy notice, consent gate)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A participant cannot reach the chat without reading a phone-sized summary, ticking three boxes, and having that acceptance recorded on the session; declining stores nothing; the full research notification and privacy notice are readable in the app in FI and EN.

**Architecture:** The session record gains consent columns (migration 005). `POST /api/sessions` takes an optional consent body; participant conversations require a consented session; try-bot sessions (no body) are unaffected because try-bot uses the admin conversation endpoint. The frontend gets a `/consent` page that owns session creation, a `/declined` page, two `/info/*` pages, and small edits to `/` and `/chat`. All provider-specific wording sits in `lib/providerNotice.ts`; all study facts that the DPO may still change sit in `lib/studyConfig.ts`.

**Tech Stack:** FastAPI + SQLAlchemy 2 async + Alembic; Next.js 14 App Router + TypeScript + Tailwind; `react-markdown` (new dependency) for the notice pages; Playwright for the gate test.

**Spec:** `docs/superpowers/specs/2026-09-18-metso-demo-design.md` (decisions E4, E5, E8, E10)

**Depends on:** Plan 1 Task 1 (test fixtures).

## Global Constraints

- Backend commands from `societal-discussion/apps/api` with `uv run ...`; frontend from `societal-discussion/apps/web`.
- No em dashes or en dashes anywhere (code, strings, commits). Never use "baked", "baked in", "thin".
- Participant-facing copy comes verbatim from `docs/consent/2026-10-23-metso-consent-package.md` section 4c, with two substitutions: the storage bullet says "stored on CSC servers in Finland; only the research team has access" (no "encrypted"), and `[RETENTION END]` becomes the `retentionEnd` value from `studyConfig.ts`.
- Never expose `assigned_party` on any participant endpoint in this plan (the debrief endpoint is Plan 3 and is gated on survey submission).
- Commit after each task.

---

### Task 1: Session consent columns + migration

**Files:**
- Modify: `societal-discussion/apps/api/src/models/session.py`
- Create: `societal-discussion/apps/api/alembic/versions/005_add_session_consent.py`
- Test: `societal-discussion/apps/api/tests/test_session_model.py`

**Interfaces:**
- Produces: `Session.consent_accepted_at: datetime | None`, `Session.consent_version: str | None`, `Session.age_confirmed: bool` (default False), `Session.data_deleted_at: datetime | None`.

- [ ] **Step 1: Write the failing test**

```python
# societal-discussion/apps/api/tests/test_session_model.py
from src.models import Session


async def test_new_session_has_no_consent_by_default(db_session):
    s = Session()
    db_session.add(s)
    await db_session.flush()
    await db_session.refresh(s)
    assert s.consent_accepted_at is None
    assert s.consent_version is None
    assert s.age_confirmed is False
    assert s.data_deleted_at is None
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd societal-discussion/apps/api && uv run pytest tests/test_session_model.py -v`
Expected: FAIL with `AttributeError: 'Session' object has no attribute 'consent_accepted_at'`.

- [ ] **Step 3: Add the columns**

In `models/session.py`, after `is_test_mode`:

```python
    # Consent (participant flow only; try-bot sessions leave these empty).
    # Checkboxes are TENK ethics consent, not the GDPR legal basis; see
    # docs/consent/2026-10-23-metso-consent-package.md section 1.3.
    consent_accepted_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    consent_version: Mapped[str | None] = mapped_column(String(40), nullable=True)
    age_confirmed: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, server_default="false"
    )
    # Set when the participant used "Delete my data"; message and survey rows
    # are gone, conversation rows stay as a tombstone (condition, timestamps).
    data_deleted_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
```

- [ ] **Step 4: Write the migration**

```python
# societal-discussion/apps/api/alembic/versions/005_add_session_consent.py
"""add consent and deletion columns to sessions

Metso public demo (23.10.2026): the consent page records acceptance on the
session; "Delete my data" stamps data_deleted_at.

Revision ID: 005_consent
Revises: 004_tsv
Create Date: 2026-09-18
"""
from alembic import op
import sqlalchemy as sa


revision = '005_consent'
down_revision = '004_tsv'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('sessions', sa.Column('consent_accepted_at', sa.DateTime(timezone=True), nullable=True))
    op.add_column('sessions', sa.Column('consent_version', sa.String(40), nullable=True))
    op.add_column(
        'sessions',
        sa.Column('age_confirmed', sa.Boolean(), nullable=False, server_default='false'),
    )
    op.add_column('sessions', sa.Column('data_deleted_at', sa.DateTime(timezone=True), nullable=True))


def downgrade() -> None:
    op.drop_column('sessions', 'data_deleted_at')
    op.drop_column('sessions', 'age_confirmed')
    op.drop_column('sessions', 'consent_version')
    op.drop_column('sessions', 'consent_accepted_at')
```

- [ ] **Step 5: Run the test and the migration locally**

Run: `cd societal-discussion/apps/api && uv run pytest tests/test_session_model.py -v && uv run alembic upgrade head && uv run alembic current`
Expected: PASS; `alembic current` prints `005_consent (head)`.

- [ ] **Step 6: Commit**

```bash
git add societal-discussion/apps/api/src/models/session.py societal-discussion/apps/api/alembic/versions/005_add_session_consent.py societal-discussion/apps/api/tests/test_session_model.py
git commit -m "Add consent and deletion columns to sessions (migration 005)"
```

---

### Task 2: `POST /api/sessions` records consent; conversations require it

**Files:**
- Modify: `societal-discussion/apps/api/src/routers/sessions.py`
- Modify: `societal-discussion/apps/api/src/routers/conversations.py:76-100`
- Test: `societal-discussion/apps/api/tests/test_sessions_consent.py`

**Interfaces:**
- Produces: `POST /api/sessions` body (optional) `{"consent_version": str, "age_confirmed": bool}`; response `{"id", "created_at", "consent_accepted_at"}`. `GET /api/sessions/{id}` returns the same shape. `POST /api/conversations` returns 403 `{"detail": "Consent required"}` when the session is not test-mode and has no `consent_accepted_at`.

- [ ] **Step 1: Write the failing tests**

```python
# societal-discussion/apps/api/tests/test_sessions_consent.py
from src.models import Session


async def test_session_without_body_has_no_consent(client):
    res = await client.post("/api/sessions")
    assert res.status_code == 201
    assert res.json()["consent_accepted_at"] is None


async def test_session_with_consent_is_recorded(client):
    res = await client.post(
        "/api/sessions", json={"consent_version": "2026-10-23-v1", "age_confirmed": True}
    )
    assert res.status_code == 201
    body = res.json()
    assert body["consent_accepted_at"] is not None
    got = await client.get(f"/api/sessions/{body['id']}")
    assert got.json()["consent_accepted_at"] == body["consent_accepted_at"]


async def test_consent_without_age_confirmation_is_rejected(client):
    res = await client.post(
        "/api/sessions", json={"consent_version": "2026-10-23-v1", "age_confirmed": False}
    )
    assert res.status_code == 400


async def test_conversation_requires_consent(client):
    sid = (await client.post("/api/sessions")).json()["id"]
    res = await client.post("/api/conversations", json={"session_id": sid, "language": "fi"})
    assert res.status_code == 403
    assert res.json()["detail"] == "Consent required"


async def test_conversation_allowed_after_consent(client):
    sid = (
        await client.post(
            "/api/sessions", json={"consent_version": "2026-10-23-v1", "age_confirmed": True}
        )
    ).json()["id"]
    res = await client.post("/api/conversations", json={"session_id": sid, "language": "fi"})
    assert res.status_code == 201
    assert "assigned_party" not in res.json()


async def test_test_mode_session_needs_no_consent(client, db_session):
    s = Session(is_test_mode=True)
    db_session.add(s)
    await db_session.flush()
    res = await client.post("/api/conversations", json={"session_id": s.id, "language": "fi"})
    assert res.status_code == 201
```

- [ ] **Step 2: Run to verify they fail**

Run: `cd societal-discussion/apps/api && uv run pytest tests/test_sessions_consent.py -v`
Expected: `consent_accepted_at` KeyErrors and 201 where 403/400 is expected.

- [ ] **Step 3: Rewrite sessions.py**

```python
"""
Session management endpoints.

A participant session is created by the consent page after the participant
ticks every box. Try-bot creates sessions without a body; those never carry
consent and are only usable through the admin conversation endpoint.
"""

from datetime import datetime
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, ConfigDict
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..database import get_db
from ..models import Session

HELSINKI = ZoneInfo("Europe/Helsinki")

router = APIRouter()


class SessionCreate(BaseModel):
    """Optional consent payload sent by the participant consent page."""

    consent_version: str
    age_confirmed: bool = False


class SessionResponse(BaseModel):
    """Session as seen by the participant. Never includes parties."""

    id: str
    created_at: datetime
    consent_accepted_at: datetime | None = None

    model_config = ConfigDict(from_attributes=True)


def _to_response(session: Session) -> SessionResponse:
    return SessionResponse(
        id=session.id,
        created_at=session.created_at,
        consent_accepted_at=session.consent_accepted_at,
    )


@router.post("", response_model=SessionResponse, status_code=status.HTTP_201_CREATED)
async def create_session(
    data: SessionCreate | None = None,
    db: AsyncSession = Depends(get_db),
):
    """Create a session. With a body, record consent (age confirmation required)."""
    session = Session()
    if data is not None:
        if not data.age_confirmed:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Age confirmation required",
            )
        session.consent_version = data.consent_version
        session.age_confirmed = True
        session.consent_accepted_at = datetime.now(HELSINKI)

    db.add(session)
    await db.flush()
    await db.refresh(session)
    return _to_response(session)


@router.get("/{session_id}", response_model=SessionResponse)
async def get_session(
    session_id: str,
    db: AsyncSession = Depends(get_db),
):
    """Get session details."""
    result = await db.execute(select(Session).where(Session.id == session_id))
    session = result.scalar_one_or_none()

    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Session not found",
        )

    return _to_response(session)
```

- [ ] **Step 4: Add the consent check in conversations.py**

Right after the `if not session: raise HTTPException(404 ...)` block in `create_conversation`, insert:

```python
    # Participants must have accepted the research notification on the
    # consent page. Try-bot sessions are exempt (is_test_mode).
    if not session.is_test_mode and session.consent_accepted_at is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Consent required",
        )
```

- [ ] **Step 5: Run all tests**

Run: `cd societal-discussion/apps/api && uv run pytest tests/ -v && uv run ruff check src/`
Expected: all PASS.

- [ ] **Step 6: Commit**

```bash
git add societal-discussion/apps/api/src/routers/sessions.py societal-discussion/apps/api/src/routers/conversations.py societal-discussion/apps/api/tests/test_sessions_consent.py
git commit -m "Record consent on session creation; require it before a participant conversation"
```

---

### Task 3: Frontend config modules (study facts, provider block, participant API)

**Files:**
- Create: `societal-discussion/apps/web/src/lib/studyConfig.ts`
- Create: `societal-discussion/apps/web/src/lib/providerNotice.ts`
- Create: `societal-discussion/apps/web/src/lib/participantApi.ts`

**Interfaces:**
- Produces:
  - `STUDY: { consentVersion: string; retentionEnd: { fi: string; en: string }; controllers: { fi: string; en: string }; contactEmail: string; responsibleResearcher: string; responsibleResearcherEmail: string; dpoEmail: string; pohtivaUrl: string }`
  - `PROVIDER_NOTICE: Record<Language, { bullet: string; checkbox: string | null; debriefNote: string }>`
  - `createSession(consentVersion: string): Promise<string>` (returns id, throws on non-2xx)
  - `getSession(id: string): Promise<{ id: string; consent_accepted_at: string | null } | null>` (null on 404)
  - `createConversation(sessionId: string, lang: Language): Promise<string>` (returns conversation id; throws `Error('session-missing')` on 404 and `Error('consent-required')` on 403)

- [ ] **Step 1: studyConfig.ts**

```ts
// Facts that appear in participant-facing texts and that the DPOs or the
// ethics committee may still change. Recommended values from
// docs/consent/2026-10-23-metso-consent-package.md section 2; confirm each
// before the 23.10.2026 deploy.
export const STUDY = {
  // Bump whenever the consent screen, research notification or privacy
  // notice wording changes; stored on every session.
  consentVersion: '2026-10-23-v1',
  retentionEnd: { fi: '31.12.2028', en: '31 December 2028' },
  controllers: {
    fi: 'Tampereen yliopisto ja Vaasan yliopisto',
    en: 'Tampere University and the University of Vaasa',
  },
  contactEmail: 'jose.siqueiradecerqueira@tuni.fi',
  responsibleResearcher: 'Rebekah Rousi',
  responsibleResearcherEmail: 'rebekah.rousi@uwasa.fi',
  dpoEmail: 'tietosuojavastaava@uwasa.fi',
  pohtivaUrl: 'https://www.fsd.tuni.fi/pohtiva/',
} as const;
```

- [ ] **Step 2: providerNotice.ts**

```ts
import type { Language } from './translations';

// Everything that depends on WHICH model runs WHERE lives here. If the
// project moves to a model hosted by GPT-Lab (Tampere University, Finland),
// replace the texts with the 4f blocks from
// docs/consent/2026-10-23-metso-consent-package.md and set checkbox to null;
// the consent page then renders two checkboxes instead of three.
export interface ProviderNotice {
  bullet: string;
  checkbox: string | null;
  debriefNote: string;
}

export const PROVIDER_NOTICE: Record<Language, ProviderNotice> = {
  fi: {
    bullet:
      'Vastausten tuottamiseksi sovellus lähettää viestisi OpenAI-yhtiölle Yhdysvaltoihin. OpenAI säilyttää niitä enintään 30 päivää eikä käytä niitä mallien kouluttamiseen.',
    checkbox: 'Ymmärrän, että viestini käsitellään OpenAI:n palvelimilla Yhdysvalloissa.',
    debriefNote:
      'Tekninen huomautus: vastaukset tuotti OpenAI:n kielimalli GPT-6 Astra Yhdysvalloissa sijaitsevilla palvelimilla. OpenAI:n järjestelmissä olevat kopiot poistuvat sen käytännön mukaan viimeistään 30 päivän kuluttua; niitä emme voi poistaa itse.',
  },
  en: {
    bullet:
      'To produce its replies, the app sends your messages to OpenAI in the United States. OpenAI keeps them for up to 30 days and does not use them to train its models.',
    checkbox: 'I understand that my messages are processed on OpenAI\'s servers in the United States.',
    debriefNote:
      'Technical note: the replies were generated by OpenAI\'s model GPT-6 Astra on servers in the United States. Copies held by OpenAI expire under its policy after at most 30 days; we cannot delete those ourselves.',
  },
};
```

- [ ] **Step 3: participantApi.ts**

```ts
import type { Language } from './translations';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export async function createSession(consentVersion: string): Promise<string> {
  const res = await fetch(`${API_URL}/api/sessions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ consent_version: consentVersion, age_confirmed: true }),
  });
  if (!res.ok) throw new Error('session-create-failed');
  const data = await res.json();
  return data.id as string;
}

export async function getSession(
  id: string,
): Promise<{ id: string; consent_accepted_at: string | null } | null> {
  const res = await fetch(`${API_URL}/api/sessions/${id}`);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error('session-fetch-failed');
  return res.json();
}

export async function createConversation(sessionId: string, lang: Language): Promise<string> {
  const res = await fetch(`${API_URL}/api/conversations`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ session_id: sessionId, starter_topic: null, language: lang }),
  });
  if (res.status === 404) throw new Error('session-missing');
  if (res.status === 403) throw new Error('consent-required');
  if (!res.ok) throw new Error('conversation-create-failed');
  const data = await res.json();
  return data.id as string;
}
```

- [ ] **Step 4: Lint**

Run: `cd societal-discussion/apps/web && npm run lint`
Expected: clean (unused exports are fine).

- [ ] **Step 5: Commit**

```bash
git add societal-discussion/apps/web/src/lib/studyConfig.ts societal-discussion/apps/web/src/lib/providerNotice.ts societal-discussion/apps/web/src/lib/participantApi.ts
git commit -m "Add study config, provider notice block and participant API helpers"
```

---

### Task 4: Consent, declined and info strings in translations.ts

**Files:**
- Modify: `societal-discussion/apps/web/src/lib/translations.ts` (interface `UIStrings`, objects `fi` and `en`)

**Interfaces:**
- Produces on `UIStrings`: `landing.studyLine: string`, `chat.privacyHint: string`, `consent: { heading; intro; briefTitle; bullets: string[]; confirmTitle; checkboxAge; checkboxRead; start; decline; linksResearch; linksPrivacy; linksHint; error }`, `declined: { title; body; back }`, `info: { back; privacyTitle; researchTitle }`. `bullets` contain the tokens `{{PROVIDER_BULLET}}` and `{{RETENTION_END}}`, which the page replaces.

- [ ] **Step 1: Extend the interface**

Add to `UIStrings.landing`: `studyLine: string;`. Add to `UIStrings.chat`: `privacyHint: string;`. Add three new blocks after `thankYou`:

```ts
  consent: {
    heading: string;
    intro: string;
    briefTitle: string;
    bullets: string[];
    confirmTitle: string;
    checkboxAge: string;
    checkboxRead: string;
    start: string;
    decline: string;
    linksResearch: string;
    linksPrivacy: string;
    linksHint: string;
    error: string;
  };
  declined: { title: string; body: string; back: string };
  info: { back: string; privacyTitle: string; researchTitle: string };
```

- [ ] **Step 2: Finnish values**

In `fi.landing` add `studyLine: 'Tieteellinen tutkimus (Tampereen yliopisto, SYNTHETICA). Vain täysi-ikäisille (18+). Osallistuminen on vapaaehtoista ja nimetöntä.',`. In `fi.chat` add `privacyHint: 'Älä kirjoita nimiä tai muita henkilötietoja.',`. Add:

```ts
  consent: {
    heading: 'Ennen kuin aloitat',
    intro:
      'Tämä keskustelu on osa tieteellistä tutkimusta. Lue tämä yhteenveto (noin minuutti) ja vahvista osallistumisesi.',
    briefTitle: 'Lyhyesti',
    bullets: [
      'Tutkimuksen tekee Tampereen yliopisto ja Vaasan yliopisto SYNTHETICA-hankkeessa. Tutkimme, miten ihmiset kokevat politiikasta keskustelevan tekoälychatbotin.',
      'Keskustelet niin kauan kuin haluat ja vastaat sitten lyhyeen kyselyyn (noin 3 minuuttia). Lopuksi kerromme, miten chatbot oli asetettu.',
      'Chatbot voi olla ohjeistettu esittämään tietyn puolueen näkökantaa. Emme kerro sitä etukäteen. Vastaukset tuottaa tekoäly, eivätkä ne ole minkään puolueen lausuntoja.',
      'Emme kerää nimeäsi, sähköpostiasi, IP-osoitettasi emmekä puoluekantaasi. Sinun ei tarvitse kertoa omia mielipiteitäsi: kysy neutraalisti tai esitä minkä tahansa puolueen kannattajaa. Älä kirjoita nimiä tai muita henkilötietoja.',
      '{{PROVIDER_BULLET}}',
      'Keskustelusi ja kyselyvastauksesi tallennetaan CSC:n palvelimille Suomeen. Vain tutkimusryhmä pääsee niihin, niitä käytetään vain tutkimukseen ja ne hävitetään viimeistään {{RETENTION_END}}.',
      'Voit lopettaa milloin tahansa sulkemalla sivun. Lopussa saat istuntokoodin ja voit poistaa omat tietosi yhdellä painikkeella.',
    ],
    confirmTitle: 'Vahvista',
    checkboxAge: 'Olen täyttänyt 18 vuotta.',
    checkboxRead:
      'Olen lukenut edellä olevan yhteenvedon ja osallistun vapaaehtoisesti. Ymmärrän, että chatbotin mahdollista poliittista näkökantaa ei kerrota minulle etukäteen.',
    start: 'Aloita keskustelu',
    decline: 'En osallistu',
    linksResearch: 'Tutkimustiedote',
    linksPrivacy: 'Tietosuojailmoitus',
    linksHint: '(avautuvat uuteen välilehteen)',
    error: 'Aloitus epäonnistui. Yritä uudelleen.',
  },
  declined: {
    title: 'Kiitos kiinnostuksestasi.',
    body: 'Mitään tietoja ei tallennettu. Mukavaa luentoa.',
    back: 'Takaisin alkuun',
  },
  info: {
    back: 'Takaisin',
    privacyTitle: 'Tietosuojailmoitus',
    researchTitle: 'Tutkimustiedote',
  },
```

- [ ] **Step 3: English values**

In `en.landing` add `studyLine: 'Scientific study (Tampere University, SYNTHETICA). Adults only (18+). Taking part is voluntary and you give no name.',`. In `en.chat` add `privacyHint: 'Do not type names or other personal details.',`. Add:

```ts
  consent: {
    heading: 'Before you start',
    intro:
      'This conversation is part of a scientific study. Read this summary (about a minute) and confirm your participation.',
    briefTitle: 'In brief',
    bullets: [
      'The study is run by Tampere University and the University of Vaasa in the SYNTHETICA project. We study how people experience an AI chatbot that talks about politics.',
      'You chat for as long as you like, then answer a short survey (about 3 minutes). At the end we tell you how the chatbot was set up.',
      'The chatbot may be instructed to express a particular party\'s viewpoint. We do not tell you in advance. Its replies are generated by an AI and are not statements by any party.',
      'We do not collect your name, email, IP address or party preference. You never have to state your own opinions: ask neutral questions or play the supporter of any party. Do not type names or other personal details.',
      '{{PROVIDER_BULLET}}',
      'Your conversation and survey answers are stored on CSC servers in Finland. Only the research team has access, they are used only for research, and they are deleted by {{RETENTION_END}}.',
      'You can stop at any time by closing the page. At the end you get a session code and can delete your own data with one button.',
    ],
    confirmTitle: 'Confirm',
    checkboxAge: 'I am 18 or older.',
    checkboxRead:
      'I have read the summary above and take part voluntarily. I understand that the chatbot\'s possible political viewpoint is not disclosed to me in advance.',
    start: 'Start the conversation',
    decline: 'I do not take part',
    linksResearch: 'Research notification',
    linksPrivacy: 'Privacy notice',
    linksHint: '(open in a new tab)',
    error: 'Could not start. Please try again.',
  },
  declined: {
    title: 'Thank you for your interest.',
    body: 'No data was stored. Enjoy the lecture.',
    back: 'Back to start',
  },
  info: {
    back: 'Back',
    privacyTitle: 'Privacy notice',
    researchTitle: 'Research notification',
  },
```

- [ ] **Step 4: Type-check**

Run: `cd societal-discussion/apps/web && npx tsc --noEmit`
Expected: no errors (both objects satisfy the interface).

- [ ] **Step 5: Commit**

```bash
git add societal-discussion/apps/web/src/lib/translations.ts
git commit -m "Add consent, declined and info strings in FI and EN"
```

---

### Task 5: `/consent` and `/declined` pages; landing no longer creates sessions

**Files:**
- Create: `societal-discussion/apps/web/src/app/consent/page.tsx`
- Create: `societal-discussion/apps/web/src/app/declined/page.tsx`
- Modify: `societal-discussion/apps/web/src/app/page.tsx`

**Interfaces:**
- Consumes: `STUDY`, `PROVIDER_NOTICE`, `createSession`, `getSession`, `createConversation`, translations from Tasks 3 and 4.
- Produces: `localStorage.sessionId` is set only by `/consent`; `/` reuses it when `getSession` says it is consented.

- [ ] **Step 1: Consent page**

```tsx
// societal-discussion/apps/web/src/app/consent/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { TRANSLATIONS, Language, getStoredLanguage } from '@/lib/translations';
import { STUDY } from '@/lib/studyConfig';
import { PROVIDER_NOTICE } from '@/lib/providerNotice';
import { createConversation, createSession } from '@/lib/participantApi';

export default function ConsentPage() {
  const router = useRouter();
  const [lang, setLang] = useState<Language>('fi');
  const [age, setAge] = useState(false);
  const [read, setRead] = useState(false);
  const [transfer, setTransfer] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLang(getStoredLanguage());
  }, []);

  const t = TRANSLATIONS[lang];
  const provider = PROVIDER_NOTICE[lang];
  const needsTransferBox = provider.checkbox !== null;
  const allTicked = age && read && (!needsTransferBox || transfer);

  const bullets = t.consent.bullets.map((b) =>
    b
      .replace('{{PROVIDER_BULLET}}', provider.bullet)
      .replace('{{RETENTION_END}}', STUDY.retentionEnd[lang]),
  );

  const accept = async () => {
    if (!allTicked || busy) return;
    setBusy(true);
    setError(null);
    try {
      const sessionId = await createSession(STUDY.consentVersion);
      localStorage.setItem('sessionId', sessionId);
      const conversationId = await createConversation(sessionId, lang);
      localStorage.setItem('conversationId', conversationId);
      localStorage.removeItem('starterTopic');
      router.push('/chat');
    } catch (err) {
      console.error(err);
      setError(t.consent.error);
    } finally {
      setBusy(false);
    }
  };

  const checkboxRow = (
    checked: boolean,
    onChange: (v: boolean) => void,
    label: string,
    id: string,
  ) => (
    <label htmlFor={id} className="flex gap-3 items-start text-slate-800 text-sm leading-relaxed">
      <input
        id={id}
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-1 h-5 w-5 shrink-0"
      />
      <span>{label}</span>
    </label>
  );

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      <div className="max-w-xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold text-slate-900 mb-2">{t.consent.heading}</h1>
        <p className="text-slate-700 mb-6">{t.consent.intro}</p>

        <section className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 mb-6">
          <h2 className="font-semibold text-slate-900 mb-3">{t.consent.briefTitle}</h2>
          <ul className="list-disc pl-5 space-y-2 text-sm text-slate-800 leading-relaxed">
            {bullets.map((b) => (
              <li key={b}>{b}</li>
            ))}
          </ul>
        </section>

        <section className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 mb-6 space-y-4">
          <h2 className="font-semibold text-slate-900">{t.consent.confirmTitle}</h2>
          {checkboxRow(age, setAge, t.consent.checkboxAge, 'cb-age')}
          {checkboxRow(read, setRead, t.consent.checkboxRead, 'cb-read')}
          {needsTransferBox && checkboxRow(transfer, setTransfer, provider.checkbox!, 'cb-transfer')}
        </section>

        {error && <p className="text-sm text-red-700 mb-4">{error}</p>}

        <button
          onClick={accept}
          disabled={!allTicked || busy}
          data-testid="consent-start"
          className="w-full mb-3 py-4 px-6 bg-slate-900 text-white rounded-xl font-semibold text-lg hover:bg-slate-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {t.consent.start}
        </button>
        <button
          onClick={() => router.push('/declined')}
          data-testid="consent-decline"
          className="w-full mb-6 py-3 px-6 border border-slate-300 text-slate-600 rounded-xl font-medium hover:bg-slate-100 transition-colors"
        >
          {t.consent.decline}
        </button>

        <p className="text-sm text-slate-600 text-center">
          <a className="underline" href={`/info/research-notification?lang=${lang}`} target="_blank" rel="noreferrer">
            {t.consent.linksResearch}
          </a>
          {' · '}
          <a className="underline" href={`/info/privacy-notice?lang=${lang}`} target="_blank" rel="noreferrer">
            {t.consent.linksPrivacy}
          </a>{' '}
          {t.consent.linksHint}
        </p>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Declined page**

```tsx
// societal-discussion/apps/web/src/app/declined/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { TRANSLATIONS, getStoredLanguage } from '@/lib/translations';

export default function DeclinedPage() {
  const router = useRouter();
  const [t, setT] = useState(TRANSLATIONS.fi);

  useEffect(() => {
    setT(TRANSLATIONS[getStoredLanguage()]);
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white flex items-center justify-center">
      <div className="max-w-md mx-auto px-4 text-center">
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-8">
          <h1 className="text-2xl font-bold text-slate-900 mb-4">{t.declined.title}</h1>
          <p className="text-slate-600 mb-8">{t.declined.body}</p>
          <button
            onClick={() => router.push('/')}
            className="w-full py-3 px-6 border border-slate-300 text-slate-600 rounded-xl font-medium hover:bg-slate-100 transition-colors"
          >
            {t.declined.back}
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Rewrite the landing page logic**

In `page.tsx` replace the imports, the state, the `initSession` effect and `startConversation` with:

```tsx
import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  TRANSLATIONS,
  Language,
  LANGUAGES,
  getStoredLanguage,
  setStoredLanguage,
} from '@/lib/translations';
import { createConversation, getSession } from '@/lib/participantApi';

export default function LandingPage() {
  const router = useRouter();
  const [isStarting, setIsStarting] = useState(false);
  const [lang, setLang] = useState<Language>('fi');

  useEffect(() => {
    setLang(getStoredLanguage());
  }, []);

  const handleLanguageChange = (newLang: Language) => {
    setLang(newLang);
    setStoredLanguage(newLang);
  };

  // A session exists only after the consent page created one. If the stored
  // session is gone or never consented, the participant goes to /consent.
  const startConversation = useCallback(async () => {
    if (isStarting) return;
    setIsStarting(true);
    try {
      const existing = localStorage.getItem('sessionId');
      const session = existing ? await getSession(existing) : null;
      if (!session || !session.consent_accepted_at) {
        localStorage.removeItem('sessionId');
        router.push('/consent');
        return;
      }
      const conversationId = await createConversation(session.id, lang);
      localStorage.setItem('conversationId', conversationId);
      localStorage.removeItem('starterTopic');
      router.push('/chat');
    } catch (err) {
      console.error('Error starting chat:', err);
      localStorage.removeItem('sessionId');
      router.push('/consent');
    } finally {
      setIsStarting(false);
    }
  }, [isStarting, lang, router]);
```

Delete the `API_URL` constant, `sessionId` and `isCreatingSession` state. Change the start button's `disabled` to `disabled={isStarting}`. Under the title `<h1>` add:

```tsx
        <p className="text-sm text-slate-600 text-center mb-6">{t.landing.studyLine}</p>
```

- [ ] **Step 4: Lint, build, click through**

Run: `cd societal-discussion/apps/web && npm run lint && npm run build`
Then with `./run.sh` running: open `http://localhost:3000`, clear localStorage, click Start: expect `/consent`; Start button disabled; tick three boxes; Start enabled; click: expect `/chat`. Click "Takaisin alkuun", click Start again: expect `/chat` directly (no second consent). Click "En osallistu" from a fresh browser: expect `/declined` and no new row in the sessions table (`sqlite3 apps/api/societal_discussion.db 'select count(*) from sessions'` unchanged).

- [ ] **Step 5: Commit**

```bash
git add societal-discussion/apps/web/src/app/consent/page.tsx societal-discussion/apps/web/src/app/declined/page.tsx societal-discussion/apps/web/src/app/page.tsx
git commit -m "Add consent gate: session is created only after acceptance"
```

---

### Task 6: Chat privacy hint

**Files:**
- Modify: `societal-discussion/apps/web/src/app/chat/page.tsx` (input block near the end)

- [ ] **Step 1: Add the hint under the input row**

Inside the `{/* Input */}` div, after the `<div className="max-w-2xl mx-auto flex gap-2">...</div>` block, add:

```tsx
        <p className="max-w-2xl mx-auto mt-2 text-xs text-slate-500">{t.chat.privacyHint}</p>
```

- [ ] **Step 2: Lint and eyeball**

Run: `cd societal-discussion/apps/web && npm run lint`. Open `/chat` on a phone-width viewport (DevTools, 390 px): the hint sits under the input without horizontal scroll.

- [ ] **Step 3: Commit**

```bash
git add societal-discussion/apps/web/src/app/chat/page.tsx
git commit -m "Chat: remind participants not to type personal details"
```

---

### Task 7: Full notice pages (`/info/privacy-notice`, `/info/research-notification`)

**Files:**
- Create: `societal-discussion/apps/web/src/content/notices.ts`
- Create: `societal-discussion/apps/web/src/app/info/[doc]/page.tsx`
- Modify: `societal-discussion/apps/web/package.json` (add `react-markdown`)

**Interfaces:**
- Produces: `NOTICES: Record<'privacy-notice' | 'research-notification', Record<Language, string>>` holding Markdown.

- [ ] **Step 1: Install react-markdown**

Run: `cd societal-discussion/apps/web && npm install react-markdown@9`

- [ ] **Step 2: Create notices.ts from the package**

Open `docs/consent/2026-10-23-metso-consent-package.md`. Copy section **4a-EN** (privacy notice, English, sections 1 to 17) into the `en` string of `'privacy-notice'`, **4a-FI** into `fi`, **4b-EN** and **4b-FI** into `'research-notification'`. Keep the `<!-- MODEL-PROVIDER-BLOCK -->` comments (react-markdown drops HTML comments). Replace `[RETENTION END]` / `[SÄILYTYSAJAN PÄÄTTYMISPÄIVÄ]` with `${STUDY.retentionEnd.en}` / `${STUDY.retentionEnd.fi}` via template literals. Leave the other `[SQUARE BRACKET]` items in place; they are the human decisions listed in the package and must be resolved before deploy (Plan 4 has a checklist step for that).

```ts
// societal-discussion/apps/web/src/content/notices.ts
import type { Language } from '@/lib/translations';
import { STUDY } from '@/lib/studyConfig';

export type NoticeId = 'privacy-notice' | 'research-notification';

export const NOTICES: Record<NoticeId, Record<Language, string>> = {
  'privacy-notice': {
    en: `
# Privacy notice for scientific research
... (section 4a-EN verbatim, retention date via ${STUDY.retentionEnd.en}) ...
`,
    fi: `
# Tieteellisen tutkimuksen tietosuojailmoitus
... (section 4a-FI verbatim, retention date via ${STUDY.retentionEnd.fi}) ...
`,
  },
  'research-notification': {
    en: `
# Research notification
... (section 4b-EN verbatim) ...
`,
    fi: `
# Tutkimustiedote
... (section 4b-FI verbatim) ...
`,
  },
};
```

Backticks inside the copied text must be escaped as `` \` ``.

- [ ] **Step 3: The page**

```tsx
// societal-discussion/apps/web/src/app/info/[doc]/page.tsx
'use client';

import { Suspense, useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import ReactMarkdown from 'react-markdown';
import { TRANSLATIONS, Language, getStoredLanguage } from '@/lib/translations';
import { NOTICES, NoticeId } from '@/content/notices';

// useSearchParams needs a Suspense boundary in Next 14 or `next build`
// refuses to prerender the page.
export default function InfoPage() {
  return (
    <Suspense fallback={null}>
      <InfoContent />
    </Suspense>
  );
}

function InfoContent() {
  const params = useParams<{ doc: string }>();
  const search = useSearchParams();
  const [lang, setLang] = useState<Language>('fi');

  useEffect(() => {
    const q = search.get('lang');
    setLang(q === 'en' || q === 'fi' ? q : getStoredLanguage());
  }, [search]);

  const doc = params.doc as NoticeId;
  const t = TRANSLATIONS[lang];
  const markdown = NOTICES[doc]?.[lang];

  if (!markdown) {
    return <div className="p-8 text-slate-600">Not found.</div>;
  }

  return (
    <div className="min-h-screen bg-white">
      <div className="notice max-w-2xl mx-auto px-4 py-8 text-slate-800">
        <ReactMarkdown>{markdown}</ReactMarkdown>
        <p className="mt-8">
          <a className="underline" href="/consent">
            {t.info.back}
          </a>
        </p>
      </div>
    </div>
  );
}
```

Add to the end of `societal-discussion/apps/web/src/app/globals.css` (the project does not use the Tailwind typography plugin):

```css
/* Markdown notices served at /info/* */
.notice h1 { font-size: 1.5rem; font-weight: 700; margin: 1rem 0; }
.notice h2 { font-size: 1.15rem; font-weight: 600; margin: 1.25rem 0 0.5rem; }
.notice h3 { font-size: 1rem; font-weight: 600; margin: 1rem 0 0.4rem; }
.notice p, .notice li { margin: 0.4rem 0; line-height: 1.55; font-size: 0.95rem; }
.notice ul { list-style: disc; padding-left: 1.25rem; }
.notice ol { list-style: decimal; padding-left: 1.25rem; }
.notice table { border-collapse: collapse; margin: 0.75rem 0; font-size: 0.9rem; }
.notice td, .notice th { border: 1px solid #cbd5e1; padding: 0.3rem 0.5rem; vertical-align: top; }
.notice a { text-decoration: underline; }
```

- [ ] **Step 4: Build and open**

Run: `cd societal-discussion/apps/web && npm run lint && npm run build`. Open `/info/privacy-notice?lang=fi` and `/info/research-notification?lang=en`: headings render, no raw `<!--` visible, retention date shows 31.12.2028.

- [ ] **Step 5: Commit**

```bash
git add societal-discussion/apps/web/package.json societal-discussion/apps/web/package-lock.json societal-discussion/apps/web/src/content/notices.ts societal-discussion/apps/web/src/app/info societal-discussion/apps/web/src/app/globals.css
git commit -m "Serve the full privacy notice and research notification in FI and EN"
```

---

### Task 8: Playwright test for the consent gate

**Files:**
- Create: `societal-discussion/apps/web/tests/e2e/consent.spec.ts`

- [ ] **Step 1: Write the test**

```ts
// societal-discussion/apps/web/tests/e2e/consent.spec.ts
import { test, expect } from '@playwright/test';

test('start button stays disabled until every box is ticked', async ({ page }) => {
  await page.goto('/consent');
  const start = page.getByTestId('consent-start');
  await expect(start).toBeDisabled();
  await page.locator('#cb-age').check();
  await page.locator('#cb-read').check();
  await expect(start).toBeDisabled();
  await page.locator('#cb-transfer').check();
  await expect(start).toBeEnabled();
});

test('declining goes to /declined and stores no session', async ({ page }) => {
  await page.goto('/consent');
  await page.getByTestId('consent-decline').click();
  await expect(page).toHaveURL(/\/declined$/);
  const stored = await page.evaluate(() => localStorage.getItem('sessionId'));
  expect(stored).toBeNull();
});

test('landing sends a fresh visitor to /consent', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.getByRole('button', { name: /Aloita keskustelu|Start conversation/ }).click();
  await expect(page).toHaveURL(/\/consent$/);
});
```

- [ ] **Step 2: Run it**

Run: `cd societal-discussion/apps/web && npx playwright install chromium && npm run test:e2e -- tests/e2e/consent.spec.ts`
Expected: 3 passed. (The dev server starts via `playwright.config.ts`; the backend is not needed for these three tests.)

- [ ] **Step 3: Commit**

```bash
git add societal-discussion/apps/web/tests/e2e/consent.spec.ts
git commit -m "e2e: consent gate and decline path"
```

---

## Self-review

- Spec coverage: E4 (Tasks 1, 2, 5, 8), E5 (Task 3), E8 (Task 4 wording), E10 (Task 3 `STUDY`). The "18+" landing line and chat hint (package C6, C11, C15) are Tasks 5 and 6. Full documents (C5) are Task 7. Consent stored with version (C2) is Tasks 1 and 2. Session only after acceptance (C3) is Task 5.
- Names used across tasks: `createSession`, `getSession`, `createConversation` (Task 3) are what Task 5 imports; `t.consent.*`, `t.declined.*`, `t.info.*` (Task 4) are what Tasks 5 and 7 read; `data-testid` values in Task 5 match Task 8.
- Try-bot is untouched: it still calls `POST /api/sessions` without a body (allowed) and the admin conversation endpoint (no consent check).

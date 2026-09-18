# Metso public demo (23 October 2026): design

Status: draft for review. Companion documents: `docs/consent/2026-10-23-metso-consent-package.md` (validated consent, privacy notice, research notification, debrief and slide texts) and the four plans in `docs/superpowers/plans/2026-09-18-plan-*.md`.

## 1. Goal

Run the Vaalikeskustelu chatbot as a public demo at the Yleisöluento "Kohti älykkyyttä, ja sen ohi!" (Metso, Lehmus-sali, Tampere, 16:00 to 18:00, in Finnish). Members of the public scan a QR code, accept a research notification on their phone, chat with a party-aligned bot, answer the survey, and get a debrief. Two changes to the experiment itself: every one of the 9 parties gets a populism-augmented variant (18 conditions), and the model becomes OpenAI GPT-6 Astra.

## 2. Decisions taken in this design (override by editing this file)

| # | Decision | Choice | Why |
|---|----------|--------|-----|
| E1 | Assignment on 23.10 | All 18 conditions, weighted random, no repeat within a session (`FORCED_PARTY=""`) | Cleanest data for the paper; the populist treatment is constant across parties so the per-party contrast is interpretable. A paired vanilla-vs-populist design (same party twice per participant) is a possible follow-up, not built now. |
| E2 | Populism markers | One identical `POPULISM_MARKERS_SECTION` for all 9 populist variants | Keeps the treatment constant. The corpus defines who "we" and "they" are; the markers only add people-centrism, anti-elitism, us-vs-them. |
| E3 | Model | Add `gpt-6-astra` to the registry as the recommended OpenAI model; the provider never sends `temperature` to `gpt-5.5*` or `gpt-6*` (both reject it) and retries once without it for unknown models; `store=False` on every call | Verified 18.9.2026 on the OpenAI model page: 1,050,000-token window (922K in, 128K out), Chat Completions supported, temperature rejected. Pricing $10 / $1 cached / $50 per 1M tokens, so prompt caching of the 20K to 220K-token system prompt matters; set a spend limit. |
| E4 | Consent | New `/consent` page between landing and chat. Three checkboxes (18+, read and voluntary and aware of undisclosed viewpoint, US-transfer acknowledgement). Session is created only on acceptance. Checkboxes are TENK ethics consent, not GDPR consent (legal basis Art 6(1)(e) and 9(2)(j), see package section 1.3). | Validator's resolution of the two expert drafts. |
| E5 | Provider block | All provider-specific texts (consent bullet, checkbox, debrief note) live in one frontend module `providerNotice.ts` with a nullable checkbox | A later switch to a GPT-Lab model hosted in Finland changes one file and drops the checkbox. |
| E6 | Debrief | Thank-you page reveals, per conversation in the session, the party display name and whether the populist framing was on; only after the survey is submitted | TENK requires disclosure of the true nature of the study. |
| E7 | Data rights | Thank-you page shows a session code (first 8 hex chars of the session UUID as `XXXX-XXXX`), a copy button, and a "Delete my data" button. Deletion removes message rows and survey rows, keeps conversation rows as a tombstone (condition, timestamps), sets `sessions.data_deleted_at`. Admin can look a session up by code. | Makes the withdrawal promise in the notices true. |
| E8 | Storage wording | Consent text says "stored on CSC servers in Finland, access restricted to the research team", not "encrypted" | Messages are stored in plain text in SQLite; only API keys are encrypted (`services/encryption.py`). Do not promise encryption unless a message-encryption task is added. |
| E9 | Survey | Unchanged; all fields already optional | Nothing to build. |
| E10 | Placeholder values | Retention end 31.12.2028, controllers "Tampere University and University of Vaasa", consent version `2026-10-23-v1` | Recommended values from the package; each is a constant in `studyConfig.ts` and must be confirmed by the DPOs before deploy. |

## 3. Participant flow after the change

```
/ (landing)  --Start-->  has consented session in localStorage?
                            yes -> POST /api/conversations -> /chat
                            no  -> /consent
/consent  --all 3 boxes + Start-->  POST /api/sessions {consent_version, age_confirmed}
                                    POST /api/conversations -> /chat
/consent  --I do not take part-->   /declined (nothing stored)
/chat  --End conversation-->  /survey-entry -> /survey -> POST /api/survey -> /thank-you
/thank-you  GET /api/sessions/{id}/debrief (403 until survey exists)
            shows parties + populist flag per conversation, session code, delete button
            DELETE /api/sessions/{id}/data
/info/privacy-notice, /info/research-notification  (full texts, FI/EN, linked from /consent and /thank-you)
```

`Back to start` from the chat keeps the session, so a second conversation does not re-ask consent.

## 4. Backend changes

- `services/party_grounding.py`: `BASE_PARTIES` (9), `POPULIST_SUFFIX = "_populist"`, `PARTY_FILES` and `PARTY_DISPLAY_NAMES` generated for both, `is_populist(party)`, `base_party(party)`. `ALL_PARTIES` has 18 entries.
- `services/prompt_builder.py`: `_default_instruction_for` injects the markers for any `is_populist` party.
- `services/llm_models.py`: GPT-6 Astra entry, recommended.
- `services/llm_providers/openai_provider.py`: `store=False`; no `temperature` for `gpt-5.5*` / `gpt-6*`; one retry without it for unknown models that reject it.
- `models/session.py` + migration `005_consent`: `consent_accepted_at`, `consent_version`, `age_confirmed`, `data_deleted_at`.
- `routers/sessions.py`: `POST /api/sessions` takes an optional body; with a body it requires `age_confirmed=true` and records consent. New `GET /{id}/debrief` and `DELETE /{id}/data`.
- `routers/conversations.py`: refuses to create a conversation for a non-test session without consent (403).
- `routers/admin.py`: `GET /sessions/by-code/{code}`; exports gain `consent_version`, `age_confirmed`, `data_deleted_at`.

## 5. Frontend changes

- `lib/studyConfig.ts`: retention end, controllers, consent version, contact emails, Pohtiva link.
- `lib/providerNotice.ts`: provider block texts per language, nullable checkbox.
- `lib/participantApi.ts`: `createSession`, `createConversation`, `getSession`, `getDebrief`, `deleteSessionData`.
- `lib/translations.ts`: new `consent`, `declined`, `debrief`, `info` blocks; landing gains the "Tutkimus, 18+" line; chat gains the "Do not type names" hint.
- `content/notices.ts`: full privacy notice and research notification texts (FI/EN) copied from the package.
- Pages: `/consent`, `/declined`, `/info/privacy-notice`, `/info/research-notification`; rewritten `/thank-you`; edited `/` and `/chat`.
- `admin/lib/types.ts`: 18 parties, display names, colors.

## 6. Deployment and operations

- `k8s/api-deployment.yaml`: `FORCED_PARTY: ""`.
- Confirm the Rahti build uses `docker/Dockerfile.api` (runs `alembic upgrade head` on start) so migration 005 applies.
- Admin panel: select GPT-6 Astra after verifying the model id.
- Close the QR link on 24.10.2026 (scale web deployment to 0), export the database, delete the Rahti volume on the retention date.
- `METHODS.md` and `README.md` updated to describe 18 conditions, consent, debrief, session code.

## 7. Out of scope (explicitly)

- Paired vanilla-vs-populist assignment.
- Message encryption at rest.
- Demographic survey questions.
- Access-code gate (stays disabled).

## 8. Human decisions still open (from the package, section 2)

Controller, legal basis sign-off by the DPO, retention end date, age threshold, ethics review path (start now: committees take 4 to 8 weeks), DPIA, OpenAI account settings and DPA, contact person, researcher list, link closure date. The code uses the recommended values as defaults so nothing blocks implementation.

## 9. Testing

- Backend: pytest with an in-memory SQLite database and httpx `ASGITransport`; every new endpoint and every party helper has a test.
- Frontend: `npm run lint && npm run build` per task; one Playwright spec for the consent gate (button disabled until all boxes are ticked, decline path stores nothing).
- Manual: full flow on a phone against a local backend before deploy; verify the debrief shows the right party for two conversations in one session.

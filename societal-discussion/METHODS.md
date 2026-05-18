# Methods — manipulative-ai2

Reference summary of the technical and methodological choices behind the
manipulative-ai2 chatbot experiment. Use this as a starting point for the
methods section of the thesis / paper.

---

## 1. Experimental goal

The project tests **whether participants can detect that a chatbot's
responses are aligned with a specific Finnish political party**. The bias
is hidden: the participant is told they're talking to a chatbot about
politics, but the bot's underlying political alignment is the experimental
manipulation. There are 9 conditions (one per party). A single
participant's session can contain multiple conversations, each randomly
assigned to a *different* party (no repeats until the full pool is used).

## 2. Grounding technique — Cache-Augmented Generation (CAG)

The bot is not given few-shot examples, persona descriptions, or
vector-database retrieval. Instead, **the entire party-program corpus**
for the assigned party is concatenated into the system prompt at every
request. This is the **CAG approach** (sometimes called *long-context
grounding* or, in the 2026 literature, *deeply contextualised persona
prompting*).

- **Corpus size per party**: 62 KB (Liike Nyt) → 687 KB (Vihreät), Finnish
  UTF-8 text from **Pohtiva** (the Finnish political-program archive),
  aggregating each party's election programs, policy programs, and
  manifestos from 2022–2025.
- **Tokenization**: ~20 K (smallest) to ~220 K (largest) tokens of source
  material per system prompt.
- **Why CAG over RAG?** The corpus is *bounded and static* during the
  experiment — exactly the situation where CAG outperforms
  retrieval-augmented generation: zero retrieval-failure modes, source
  fidelity preserved, no embedding distortion, simpler implementation,
  and better persona stability per recent literature.
- **Code**: `apps/api/src/services/party_grounding.py` loads the text
  file for the assigned party; `apps/api/src/services/prompt_builder.py`
  injects it into the system prompt.

## 3. Three-layer system prompt structure

Each LLM request is built from three layers, concatenated in order:

```
[1. Behavioral instructions in Finnish]   ← from prompt_configs DB row,
                                            or DEFAULT_SYSTEM_INSTRUCTION
[2. Full party program corpus (Finnish)]  ← from apps/api/src/party_data/
[3. Language directive]                   ← appended at the very end:
                                              FI: "Vastaa aina suomeksi…"
                                              EN: "Override any earlier
                                                   instructions: respond
                                                   ALWAYS in English…"
```

Layer 3 sits **after** the corpus so it dominates the model's attention.
This is how the FI/EN toggle works without translating the corpus.

## 4. Turn-1 anchor + voice-locking instruction

The default behavioral instruction (layer 1) contains a top section
called **Äänesi ja ilmaisutapasi** ("Your voice and expression") with
three explicit rules:

1. **No hedging.** *"Open every reply with a clear position, never with
   a caveat. Do not use 'on the one hand … on the other hand'
   constructions, do not present a neutral view, do not leave the
   conclusion to the reader."* Counters the RLHF-trained default of
   GPT-family models to produce balanced/neutral responses.
2. **Voice locking.** *"Use vivid, party-characteristic language. Draw
   word choices, metaphors, and argumentation styles directly from the
   party program below."* Plus an explicit list of hedge phrases to
   avoid (*"riippuu monista tekijöistä"*, *"tasapaino on tärkeää"*,
   *"molemmilla puolilla on hyviä huomioita"*).
3. **Turn-1 importance.** *"Your first reply sets the tone for the whole
   conversation; if it's neutral, the conversation drifts to neutral."*

The third rule reflects a published finding: LLMs imitate their own
earlier behavior, so the **first reply disproportionately anchors the
rest of the conversation**. Locking the voice on turn 1 makes the persona
more detectable downstream without adding a new intervention variable.

## 5. Language handling — one toggle, no parallel prompt

Bilingual (FI/EN) is delivered via a **single user choice on the landing
page**, persisted in `localStorage`, propagated through every page
(chat, survey, thank-you) and into the conversation record as
`conversations.language`. The party corpus stays Finnish; only layer 3
(the language directive) changes. **One Finnish prompt covers both
languages.** Translating the corpus would have introduced a
translation-quality confound.

## 6. Party assignment — stratified, no-repeat, balanced

When a participant clicks "Start conversation":

- The backend (`apps/api/src/services/party_assignment.py`) picks one of
  the 9 parties using **weighted random favoring globally
  underrepresented parties**, drawn from the pool of parties **not yet
  used in this participant's session**.
- When all 9 have been used, the pool resets.
- This produces approximately balanced sampling across parties as the
  study progresses, *without revealing the assignment to the participant*.

## 7. Vaalikone-derived topic prompts

The 30+ topic cards on the landing page are derived from real Finnish
voting-advice applications: **HS Eduskuntavaalikone 2023** and **HS / Yle
Kuntavaalikone 2025**, organized into 8 issue clusters:

1. Talous & verotus (economy & taxation)
2. Sosiaaliturva & terveydenhuolto (social security & healthcare)
3. Koulutus (education)
4. Ympäristö & ilmasto (environment & climate)
5. Työmarkkinat & maahanmuutto (labor market & immigration)
6. Turvallisuus & ulkopolitiikka (security & foreign policy)
7. Arvot & yhteiskunta (values & society)
8. Kaupunkikehitys & liikenne (urban development & traffic)

The participant either clicks a topic (which becomes their first user
message) or chooses "Free conversation" (no preset starter). Each topic
card is translated to EN if the participant chose English mode.
Vaalikone is used **only as a topic source**, not as few-shot examples
for the bot. (A 3-shot Vaalikone calibration scheme was considered and
deliberately deferred — see §11.)

## 8. Language model

- **Model**: OpenAI **GPT-5.5** (April 2026 flagship release).
- **Context window**: 1M tokens via the API. Vihreät's 220 K-token corpus
  + system prompt (~2 K) + history (~5–10 K) + output budget (~4 K) →
  ~240 K total per request, comfortably under the 272 K input threshold
  where OpenAI applies a 2× input / 1.5× output surcharge.
- **Temperature**: 0.1 — favors response consistency.

## 9. Participant access gate

To protect against random URL visitors burning OpenAI tokens:

- `POST /api/conversations` requires an `X-Participant-Password` header.
  Defaults to the admin password, overridable via a `PARTICIPANT_PASSWORD`
  env var.
- The landing page shows a one-time modal asking for the access code on
  the first conversation-start; verified codes are cached in
  `sessionStorage` for the rest of the session.
- This protects only conversation creation, not subsequent message sends
  within an already-started conversation — sufficient for the threat
  model (gates random URL access without making the participant flow
  heavy).

## 10. Data collected per conversation

| Field                                                                      | Source                                       |
|----------------------------------------------------------------------------|----------------------------------------------|
| `session_id`, `created_at`, `is_test_mode`                                 | `sessions` table                             |
| `assigned_party`, `language`, `starter_topic`, `started_at`, `ended_at`, `is_complete`, `is_flagged`, `flag_notes`, `is_test_saved` | `conversations` table                        |
| `role`, `content`, `token_count`, `created_at`                             | `messages` table (one row per turn)          |
| `responses` JSONB (chatbot_usage, chatbot_perception, conversation_reflection, response_speed, topic_variety, **detected_bias**, **detected_terminology**, **detected_persuasion**, notice_anything, …) | `survey_responses` table                     |

The three **bolded** survey items are the masked detection measures —
embedded among decoy items (response speed, topic variety) so the
bias-detection intent isn't telegraphed to the participant.

## 11. What's deliberately *not* used

- **No few-shot prompting.** The 2025–2026 literature shows few-shot on
  top of full-corpus grounding has diminishing returns and adds a
  confounded intervention variable. A 3-shot Vaalikone calibration
  scheme is documented as a potential follow-up study but is not used in
  the primary protocol.
- **No vector RAG / embedding retrieval.** The static-corpus + 1M-token
  context window makes retrieval unnecessary and avoids
  retrieval-failure modes.
- **No fine-tuning.** Same model + different system prompt is the
  manipulation — keeps the experimental condition pure and reproducible.
- **No persona "you are a Politician X" labels.** The bot is told to
  *internalize* the views in the corpus as its own, never to *play* a
  party — this avoids the model's RLHF-trained tendency to refuse or
  hedge when role-playing political figures.

## 12. Methodological notes worth citing

- **Persona drift** (degradation of voice consistency after ~8–12 turns)
  is documented in the recent literature. The 3–5 minute target
  conversation length (typically 5–10 turns) sits *before* the drift
  cliff. GPT-5.5's 1M context window further mitigates this versus older
  models.
- **CAG vs RAG**: corpus is static and bounded — textbook CAG use case;
  no need for retrieval infrastructure.
- **Manipulation simplicity**: by deliberately keeping the intervention
  to "system prompt + party corpus + language toggle + turn-1 anchor",
  the experimental claim ("can participants detect *corpus-grounded*
  party alignment?") is clean and reproducible. Heavier interventions
  (few-shot examples, theoretical scaffolding) are reserved for planned
  follow-up studies.

## 13. References used in design choices

| Topic | Source |
|---|---|
| CAG vs RAG for static corpora; persona stability | "Deeply Contextualised Persona Prompting" (Emergent Mind, 2026); "Consistently Simulating Human Personas" (arXiv 2511.00222) |
| Persona drift; turn-by-turn voice consistency | "Stable Personas: Dual-Assessment of Temporal Stability" (arXiv 2601.22812); "Persona Drift" — Echo Protocol framework |
| Few-shot vs grounding tradeoffs | "Are LLMs Enough for Hyperpartisan/Bias Detection? ICL vs Fine-Tuning" (arXiv 2509.07768); "CEA-LIST at CheckThat! 2025" (arXiv 2507.07539) |
| Persona prompting risks; double-edged effects | "Persona Prompting as a Lens on LLM Social Reasoning" (EACL 2026); "Persona is a Double-Edged Sword: Rethinking Role-play Prompts in Zero-shot Reasoning Tasks" (OpenReview) |
| Dashboard design (admin side) | "Dashboard Design Patterns" (144-dashboard study, ResearchGate); "Dashboard Design in 2026: Do's and Don'ts" (think.design) |
| Source corpus | Pohtiva (Finnish political program archive) |
| Topic prompts | HS Eduskuntavaalikone 2023; HS / Yle Kuntavaalikone 2025 |
| Populism markers (potential per-party scaffolding) | Cranmer 2011 — us-vs-them, people-centrism, anti-elitism |

---

## Quick reference: file map

| Concern                          | Location                                                         |
|----------------------------------|------------------------------------------------------------------|
| Party corpus files (9 .txt)      | `apps/api/src/party_data/`                                       |
| CAG injection                    | `apps/api/src/services/prompt_builder.py`                        |
| Party list + display names       | `apps/api/src/services/party_grounding.py`                       |
| No-repeat weighted assignment    | `apps/api/src/services/party_assignment.py`                      |
| Conversation creation endpoint   | `apps/api/src/routers/conversations.py`                          |
| Access-code gate                 | `apps/api/src/routers/conversations.py` (`verify_participant_password`) |
| Admin endpoints (stats, exports) | `apps/api/src/routers/admin.py`                                  |
| LLM provider abstraction         | `apps/api/src/services/llm_client.py`, `llm_providers/`          |
| Model registry (selectable)      | `apps/api/src/services/llm_models.py`                            |
| FI/EN translations (UI)          | `apps/web/src/lib/translations.ts`                               |
| Landing page + access modal      | `apps/web/src/app/page.tsx`                                      |
| Chat page                        | `apps/web/src/app/chat/page.tsx`                                 |
| Survey                           | `apps/web/src/app/survey/page.tsx`                               |
| Admin dashboard                  | `apps/web/src/app/admin/page.tsx`                                |
| Admin prompts editor             | `apps/web/src/app/admin/prompts/page.tsx`                        |
| Try-bot (testing)                | `apps/web/src/app/admin/try-bot/page.tsx`                        |
| Conversation list / detail       | `apps/web/src/app/admin/conversations/`                          |
| Data export + survey schema      | `apps/web/src/app/admin/components/ExportPanel.tsx`              |

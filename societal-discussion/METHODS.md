# Methods: manipulative-ai2, version 3 (Metso demo, 23 October 2026)

Reference summary of the technical and methodological choices behind the
manipulative-ai2 chatbot experiment, as the code stands for the public demo
at the Yleisöluento in Metso, Tampere (23.10.2026). Use this as the starting
point for the methods section of the thesis or paper. Every statement names
the file that implements it; the version this text describes is the commit
that carries it in `git log -- societal-discussion/METHODS.md`.

What changed from the HEPP2026 release: 18 conditions instead of 10 (an
anti-populist variant replaces the standard one), a consent gate before any
conversation, a public participant app with a talking avatar and speech in
both directions, a debrief with data rights after the survey, two new fields
on every message (input mode and the model that answered), a cleaned party
corpus (print furniture and one duplicated document removed, the parties'
text unchanged), the framing section moved after the programme, and three
model providers that can be switched at runtime, with the answering provider
recorded on every session. The survey questions are unchanged.

---

## 1. Experimental goal

The project tests **whether participants can detect that a chatbot's
responses are aligned with a specific Finnish political party**, and whether
a populist or an anti-populist framing on top of the party line is noticed. The bias is hidden:
the participant is told they are talking to a chatbot about politics and
the coming elections, but the bot's political alignment is the experimental
manipulation.

There are **18 conditions**: each of the 9 parties in a populist variant
(`<party>_populist`) and an anti-populist variant (`<party>_antipopulist`).
Both variants read the identical party corpus and the identical
behavioural instruction, and add one fixed framing section after the
programme (section 3), so each treatment is the same for every party and the
two differ only in that section. The list is
generated from one base list of nine parties in
`apps/api/src/services/party_grounding.py` (`BASE_PARTIES`, `ALL_PARTIES`,
`is_populist()`, `is_antipopulist()`, `framing()`, `base_party()`).

Until October 2026 (HEPP2026 data) the second variant was a standard one
without any framing section, under the bare id `<party>`. Those ids still
resolve (display name, corpus, the plain instruction, `framing()` returns
none) so earlier data can be read, but they are no longer assigned.

A participant's session can contain several conversations, each assigned
to a different condition (no repeat within the session until all 18 have
been used).

## 2. Grounding technique: the whole party programme in the prompt

The bot is not given few-shot examples, persona descriptions or
vector-database retrieval. Instead, **the entire party-programme corpus**
for the assigned party is placed in the system prompt at every request.
This is the approach the literature calls cache-augmented generation (CAG)
or long-context grounding.

- **Corpus per party**: 59 KB (Liike Nyt) to 651 KB (Vihreät) of Finnish
  UTF-8 text from **Pohtiva** (the Finnish political-programme archive, FSD),
  merging each party's election programmes, policy programmes and
  manifestos from 2022 to 2025 (the sources are listed in
  `../Party Program dataset/`). The files are in `apps/api/src/party_data/`.
- **Three stages of the data** in `../Party Program dataset/`: `Party
  program 9 pdfs/` (the merged Pohtiva prints), `Party program 9 txts/`
  (their extracted text) and `Party program 9 txts cleaned/` (the text the
  bot reads; `apps/api/src/party_data/` holds identical copies for the API
  image).
- **Print furniture removed**: since 22 October 2026 the cleaned files are
  made from the extracted text by
  `apps/api/scripts/clean_party_corpus.py`, which removes only whole lines
  added by the Pohtiva print service: each document's cover block (archive
  header and URLs, "Tulostettu Pohtiva ...", the archive's party name and
  title, and the Puolue, Otsikko, Vuosi and Ohjelmatyyppi fields) and the
  lines at every page break (header, URL, print timestamp, page number).
  One page number that the text extraction attached to the end of a line of
  party text ("1 / 16" in Liike Nyt's 2023 election programme) is removed as
  well, by a rule that accepts only the page missing from its document's
  page sequence.
  Every remaining line is the original line, byte for byte and in order; the
  script checks this. The party's own text, including its titles, slogans
  and every mention of the party, is unchanged. Removed: 4.8 to 6.3 percent
  of the characters per party (3,920 lines in all). The archive lines named
  the party in every document and at every page break. Until that date (and
  in the HEPP2026 release) the prints were used as they are.
- **One duplicated document removed**: the merged RKP file held "RKP:n
  puolueohjelma 2025" twice, as a plain document (PDF pages 48 to 57) and
  as RKP's designed brochure of the same text (pages 58 to 73). The
  brochure copy (653 lines) is removed as one block, identified in the
  script by its first and last line, line count and SHA-256; the plain copy
  holds every word of the brochure copy in the same order. Until
  22 October 2026 the RKP bot read this programme twice. The evidence and
  the per-party figures are in `../Party Program dataset/README.md`.
- **Tokens**: each tokenizer counts differently. Anthropic's free token
  count gives 32,053 (Liike Nyt) to 333,396 (Vihreät) tokens per system
  prompt on the cleaned corpus (22 October 2026); GPT-6 Astra reported
  207,766 prompt tokens for the first Vihreät request on the uncleaned
  corpus (20 October 2026). The code does not count tokens before sending;
  every reply stores the total the provider reported (section 13).
- **Why not retrieval**: the corpus is bounded and static during the
  experiment, so there is nothing to retrieve, no retrieval failures, and
  the source text reaches the model unchanged.
- **Code**: `party_grounding.py` loads the file for the base party of the
  assigned condition (`PARTY_FILES` maps all 18 ids to the 9 files);
  `apps/api/src/services/prompt_builder.py` puts it into the system prompt.

## 3. System prompt structure

Each model request is built from four layers, in order
(`prompt_builder.py`, `build_system_parts()`):

```
[1. Behavioural instruction in Finnish]   from the prompt_configs table
                                          (admin override per condition),
                                          else DEFAULT_SYSTEM_INSTRUCTION;
                                          the same for all 18 conditions
[2. Full party programme (Finnish)]       from apps/api/src/party_data/
[3. Framing section]                      POPULISM_MARKERS_SECTION or
                                          ANTIPOPULISM_MARKERS_SECTION,
                                          from framing_section_for()
[4. Language directive]                   appended last:
                                          FI "Vastaa aina suomeksi ..."
                                          EN "... respond ALWAYS in English"
```

`framing_section_for()` returns `POPULISM_MARKERS_SECTION` for every id
that `is_populist()` accepts and `ANTIPOPULISM_MARKERS_SECTION` for every
id that `is_antipopulist()` accepts. The framing follows the programme so
that layers 1 and 2 are the same text for the four versions of a party
(two framings, two languages); the provider's prompt cache can then reuse
one cached copy of the programme for all four. The request carries the
layers as two system parts: layers 1 and 2, then layers 3 and 4.
Anthropic receives them as two system blocks and caches the first; OpenAI
and GPT Lab receive them joined into one system message, the same text as
before the split. Until 22 October 2026 (and in the HEPP2026 release) the
markers section sat inside layer 1, before the heading "Poliittiset
ohjelmasi ja näkemyksesi", that is before the programme.

The two framing sections ask the model to internalise three features without naming the theory,
in the same structure (three dimensions, the middle one with the triad of
advocacy, accountability and legitimacy):

| Populist (Cranmer 2011) | Anti-populist |
|---|---|
| Us versus them | Pluralism: opponents and their voters are legitimate participants, not enemies |
| People-centrism: the will, the interest and the authority of "the people" | Pluralist democracy: fundamental and group rights, accountability to citizens and kept commitments, legitimacy from the constitution and democratic procedures instead of a single "will of the people" (Mudde 2004, pp. 543-544) |
| Anti-elitism: common sense; against international institutions, high culture and mainstream media | Defending institutions: research evidence and expertise, decisions still made democratically; independent courts, the central bank, free media, the EU and international cooperation, changed only through agreed procedures; criticism of power without labelling people |

The anti-populist condition is a pluralist, liberal-democratic counter-framing
written for this study from the pluralist pole of the populism literature
(Mudde 2004) and the institutional-defence and civility features of
anti-populist discourse; it is not a published validated scale. Its wording
lets every party keep its programme positions, including proposals to reform
or leave institutions, while changing how it argues for them. The admin panel can store a different
instruction per condition (all 18) in the `prompt_configs` table; a stored
instruction replaces layer 1 only, and the framing section is always added.

Layer 4 sits after the corpus so it dominates the model's attention. This
is how the FI/EN choice works without translating the corpus.

## 4. Turn-1 anchor and voice locking

The default behavioural instruction (layer 1) opens with a section
"Äänesi ja ilmaisutapasi" ("Your voice and expression") with three rules:

1. **No hedging.** Open every reply with a clear position, never with a
   caveat; no "on the one hand, on the other hand"; no neutral view; do not
   leave the conclusion to the reader. This counters the trained default of
   chat models to produce balanced answers.
2. **Voice locking.** Use vivid, party-characteristic language; draw word
   choices, metaphors and argument styles from the party programme. An
   explicit list of hedge phrases to avoid is given ("riippuu monista
   tekijöistä", "tasapaino on tärkeää", "molemmilla puolilla on hyviä
   huomioita").
3. **Turn-1 importance.** The first reply sets the tone for the whole
   conversation; if it is neutral, the conversation drifts to neutral.

The third rule reflects a published finding: language models imitate
their own earlier behaviour, so the first reply anchors the rest of the
conversation. Locking the voice on turn 1 makes the persona more
detectable downstream without adding an intervention variable.

## 5. Language handling: one choice, no parallel prompt

The participant app is bilingual (FI/EN) through the URL: every page lives
under `/fi/` or `/en/` (`apps/participant/src/pages/[lang]/`), the choice is
remembered in the browser (`localStorage` key `language`, `src/lib/session.ts`)
and sent with the session (`consent_language`) and with each conversation
(`conversations.language`). The party corpus stays Finnish; only layer 4
changes. One Finnish prompt covers both languages, so no translation of the
corpus confounds the comparison. Speech recognition and the voice follow the
page language (section 9).

## 6. Condition assignment: weighted random, no repeat within a session

When a conversation is created (`POST /api/conversations`), the backend
(`apps/api/src/services/party_assignment.py`) picks one of the 18
conditions:

- from the pool of conditions not yet used in this session (test-mode
  conversations excluded); when all 18 have been used the pool resets;
- by weighted random that favours conditions with fewer conversations so
  far across the whole study, so the sample stays roughly balanced;
- without revealing the assignment to the participant: the condition is
  never in any participant response until the debrief (section 11).

`FORCED_PARTY` (environment) can pin every conversation to one condition or
to a uniform pick from a comma-separated list; it is empty in the Metso
deployment (`k8s/api-deployment.yaml`).

## 7. Conversation start

In version 3 the participant app has no topic cards: after consent the
participant lands on the chat page and opens with their own words, typed or
spoken (the conversation is created with `starter_topic: null`,
`apps/participant/src/lib/participantApi.ts`). The Vaalikone-derived topic
list that the HEPP2026 landing page offered still exists in the admin app's
translations (`apps/web/src/lib/translations.ts`), but no participant page
shows it. "Back to
start" on the chat page ends the conversation and the landing page's Start
creates a new one for the same session; "End conversation" leads to the
survey entry page and from there to the survey.

## 8. Language model

- **Which provider answers** is chosen at runtime, without a restart: the
  active provider and model in the admin panel (or
  `apps/api/scripts/use_provider.sh openai|anthropic|gptlab [model]`, which
  sets the same), else the environment (`LLM_PROVIDER`, `LLM_MODEL`)
  (`resolve_provider()` in `apps/api/src/services/llm_client.py`). The API
  keys come from the environment. Which provider answered on the day is
  therefore read from the data (below), not from this text.
- **First provider**: OpenAI `gpt-6.1-sol`, the default in
  `apps/api/src/services/llm_models.py` since 22 October 2026, through
  `apps/api/src/services/llm_providers/openai_provider.py`, with
  `reasoning_effort: "low"` (its lowest setting) on the default service
  tier. Until that date the default was `gpt-6-astra` with
  `reasoning_effort: "low"` (ordinary replies keep their length and style,
  the hidden reasoning is cut to about 30 tokens, measured 21 October 2026)
  on the priority tier, which OpenAI renamed Fast mode, at twice the token
  price; at the standard tier GPT-6.1 Sol costs a fifth of GPT-6 Astra per
  input and output token. GPT-6 Astra stays selectable in the admin panel.
- **Second provider**: Anthropic (`claude-sonnet-5-5` by default, or
  `claude-opus-5-5` or `claude-haiku-5-5`), through
  `apps/api/src/services/llm_providers/anthropic_provider.py`, chosen with
  `LLM_PROVIDER` or in the admin panel. It receives the same prompt; the
  first system part (instruction and programme) is written to Anthropic's
  one-hour prompt cache, so the four versions of a party share one cached
  copy. No temperature is sent (the model's default). Anthropic's tokenizer
  counts the prompts at 32,053 (Liike Nyt) to 333,396 (Vihreät) tokens
  (free token count, 22 October 2026); all Claude 5 models accept 1M.
- **Third provider**: GPT Lab (`gptlab`), open models on Tampere
  University's GPU-farmi-004 (Ollama, OpenAI-compatible API): `qwen3.8:27b`
  by default, `qwen3.6:35b-a3b-q4_K_M` or `gemma4:31b-it-q4_K_M`, through
  `GPTLabProvider` in `openai_provider.py`. Qwen's thinking is turned off
  (`reasoning_effort: "none"`). The models' own sampling is kept: Ollama's
  OpenAI-compatible endpoint would replace a missing temperature and top_p
  with 1.0, so the values the three models publish in the Ollama registry
  (temperature 1, top_p 0.95) are sent explicitly.
  Reading a whole programme the first time takes minutes there (measured
  18 to 20 October 2026), so the programmes are read once before use.
- **The provider is on the record and in the notices**: the participant
  pages read `GET /api/provider` and show the data protection texts of the
  provider that answers; the session stores it with the consent
  (`consent_version` ends in `+openai`, `+anthropic` or `+gptlab`), each
  reply stores its model, and the thank-you page shows the note of every
  provider that answered in the session.
- **Temperature**: no current model gets a value of our own;
  each runs at its own default. GPT-5.5 and GPT-6 models accept only the
  default (1.0) (`_supports_custom_temperature`); the Anthropic requests
  send none; the GPT Lab requests send the models' own published values. The value 0.1 is still sent to older OpenAI models
  that accept it, such as GPT-5.4 (HEPP2026).
- **The model is on the record**: every assistant message stores the model
  identifier the request was made with (the model selected in the admin
  panel, or the provider's default: `messages.model_name`, written in
  `apps/api/src/routers/conversations.py` from the third value that
  `generate_response` in `services/llm_client.py` returns), so the analysis
  knows which model produced each reply even if the model changes during
  the day.
- **Context**: the largest corpus (Vihreät) plus the instruction, the
  history and the output budget must fit the model's context window. With
  GPT-6 Astra the first Vihreät request measured 207,766 prompt tokens and
  answered in 16.6 s (20 October 2026).

HEPP2026 data was collected with GPT-5.4 at temperature 0.1.

## 9. Participant flow and the consent gate

The HEPP2026 access-code gate (a password header on conversation creation
and a one-time modal) no longer exists; `PARTICIPANT_PASSWORD` remains only
as an unused setting in `apps/api/src/config.py`. It is replaced by a consent
gate that is part of the research protocol:

1. **Landing** (`/fi/` or `/en/`, `apps/participant/src/pages/[lang]/index.astro`):
   the study line ("scientific study, Tampere University, 18+") and Start.
2. **Consent** (`consent.astro`): a plain institutional page with the
   consent summary from the consent package (section 4c), links to the full
   privacy notice and research notification (`info/[doc].astro`, texts in
   `src/content/notices/`), and unticked checkboxes that must all be ticked
   before Start works: age 18+, and read-and-voluntary-and-aware that the
   bot's viewpoint is undisclosed; a third box about the transfer outside
   the EU appears when the answering provider is OpenAI or Anthropic
   (`src/lib/providerNotice.ts`, read from `GET /api/provider`; Start stays
   disabled until the provider is known). "I do not
   take part" leads to `declined.astro` and nothing is sent.
3. **Session** is created only on acceptance (`POST /api/sessions` with
   `consent_version`, `age_confirmed`, `language`); the backend rejects
   the request (400) unless `age_confirmed` is true, and then stamps
   `consent_accepted_at` (`apps/api/src/routers/sessions.py`); a request
   without a body (the admin Try-bot) creates a session without consent.
   `POST /api/conversations` answers 403 for a session without consent,
   except test-mode sessions (`routers/conversations.py`).
4. **Chat** (`chat.astro`, logic in `src/scripts/chat.ts`): typed or spoken
   turns, the reply as text and speech from one avatar (section 10).
5. **Survey entry, survey, thank-you with debrief** (section 11).

The consent version is a constant (`studyConfig.ts`, `2026-10-23-v1`) and
is bumped whenever the consent wording changes; the consent page adds the
provider whose texts the participant read (`2026-10-23-v1+anthropic`, and
likewise `+openai` or `+gptlab`), and the result is stored on every
session.

## 10. Avatar, voice and speech input

One avatar and one voice for all 18 conditions, so nothing on the chat page
differs by condition. The head is a male sample head (the
AvatarSDK example from the TalkingHead repository, as recorded in
`src/scripts/avatar.ts`), stored as
`apps/participant/public/avatar/man.glb`, with a male Finnish and English
voice to match, and a still image fallback. The sample head's teal
long-sleeve shirt, printed with the vendor's logo, is drawn in plain
charcoal (`#3a3d42`) since 23 October 2026 (`recolourShirt()` in
`avatar.ts`): teal lies between colours used by three Finnish parties,
while grey is used by none. The still image still shows the teal shirt. It belongs to no party and no
person; it is not gender-neutral, and the head and voice pair is still an
open choice (a woman's head with a woman's voice is the alternative).

- **Rendering and lip-sync**: TalkingHead (met4citizen, MIT), vendored in
  `apps/participant/src/vendor/talkinghead/` with its Finnish and English
  lip-sync modules; the mouth is driven by the word timings that come with
  each audio clip (`speakAudio`). If WebGL or the head file fails, the page
  shows the still face and the voice still plays (`src/scripts/avatar.ts`).
- **Voice output**: every assistant reply is shown as text and spoken,
  sentence by sentence (`src/lib/sentences.ts` splits; `chat.ts` fetches the
  next sentence while the current one plays; the words light up as they are
  spoken). Each sentence goes to `POST /api/speech/synthesize`
  (`apps/api/src/routers/speech.py`), which returns WAV audio plus the
  words with start times and durations.
- **Speech input**: a hold-to-talk microphone button; the browser asks for
  permission on first use; the recording (webm/opus or mp4) is sent as the
  raw request body to `POST /api/speech/transcribe` with the page language
  (Parakeet, the engine in use, finds the language itself);
  the text comes back and is sent as an ordinary message with
  `input_mode: spoken`. The phone's own speech recognition and voices are
  never used, so no audio or text goes to a phone vendor's cloud.
- **Engines in the Metso deployment** (`apps/api/src/services/speech/`):
  recognition with NVIDIA Parakeet TDT 0.6B v3 (CC BY 4.0, int8 ONNX export
  run with onnx-asr; it returned fewer Finnish errors than faster-whisper
  `small` and needed 0.9 s for an 8 s Finnish clip on 4 CPU, measured
  21 October 2026) and speech with the Piper voices `fi_FI-harri-medium`
  and `en_GB-alan-medium`. Both run on CPU in our own CSC Rahti project,
  in two pods of their own built from the API image
  (`apps/api/src/speech_main.py`, `k8s/speech-stt-*.yaml`,
  `k8s/speech-tts-*.yaml`): `speech-stt` (0.9 CPU, one job at a time) and
  `speech-tts` (2 CPU, two jobs at a time). A path-based route on the API
  host sends `/api/speech/transcribe` and `/api/speech/synthesize` to these
  pods, so the participant app calls the same URLs; the pods have no
  database and ask the API whether the conversation is open. The models are
  fetched at image build from pinned Hugging Face revisions with SHA-256
  checks (`apps/api/scripts/fetch_speech_models.py`). Word timings come
  from Piper's phoneme alignments. Waiting sentences are served
  first-sentence-first, and a job that waited longer than 8 s, or whose
  phone has gone, is dropped.
- **Other engines the code supports, not used at Metso**: faster-whisper
  `small` (int8) for recognition (`SPEECH_STT_ENGINE=whisper`), and remote
  servers with an OpenAI-compatible API (`SPEECH_STT_URL`,
  `SPEECH_TTS_URL`; the defaults name faster-whisper large-v3-turbo and
  VoxCPM2, the models chosen for the university cluster), where a remote
  voice gets whisper word timestamps aligned to the script
  (`services/speech/alignment.py`).
- **Cost**: speech adds no per-use cost; no paid speech service is called.
  It uses the CPU of our Rahti project. Only the language model is paid
  per token.
- **Limits and privacy**: recordings are capped at 2 MB and at 60 s of
  decoded audio; they are decoded in memory, never written to disk. The
  speech logs carry the byte size, the content type, the language, the
  clip length and the recognised word count, never the audio or the
  words.

## 11. Debrief and data rights

After the survey the thank-you page (`apps/participant/src/pages/[lang]/thank-you.astro`)
calls `GET /api/sessions/{id}/debrief`, the one participant endpoint that
discloses the condition, and only once a survey row exists for the session
(403 before that). It shows, per conversation, the party's display name and
which framing was used (populist or anti-populist); what the replies were (a model's text
from public programmes, not the party's statements); why the study did not
say so beforehand; the session code; "Delete my data"; a note for each
provider that answered in the session (the debrief lists the models that
answered, `models`, in order of first use); and the contacts and notice
links.

- **Session code**: the first 8 hex characters of the session id as
  `XXXX-XXXX` (`apps/api/src/services/session_code.py`), shown with a copy
  button. The participant keeps it to ask for their data later; researchers
  find the session with `GET /api/admin/sessions/by-code/{code}`.
- **Delete my data**: `DELETE /api/sessions/{id}/data` removes the message
  rows and the survey rows and stamps `data_deleted_at`; the conversation
  rows stay as a tombstone with the condition and timestamps; a repeated
  call answers 204 and keeps the first deletion time. A deleted session
  refuses new conversations (403), the debrief still answers for it marked
  `data_deleted`, and the conversation exports carry `data_deleted_at`.

Consent texts, privacy notice and research notification: the consent page
and UI strings in `apps/participant/src/lib/strings.ts`, the notices in
`apps/participant/src/content/notices/`.

## 12. Survey

The survey (`survey.astro`) is unchanged from HEPP2026: the same questions,
sections, scale labels and response keys as the Next.js page they were
copied from (`apps/web/src/app/survey/page.tsx`), every answer optional.
It is submitted once per session (`POST /api/survey`, responses stored as
one JSON document); the once-only rule is kept by the browser (a stored
flag sends a second visit straight to the thank-you page), not by the
API. The three masked detection items (`detected_bias`,
`detected_terminology`, `detected_persuasion`) sit among decoy items
(response speed, topic variety) so the detection intent is not telegraphed.

## 13. Data collected

| Table | Fields |
|---|---|
| `sessions` | `id`, `created_at`, `is_test_mode`, `consent_accepted_at`, `consent_version`, `consent_language`, `age_confirmed`, `data_deleted_at` |
| `conversations` | `session_id`, `assigned_party` (one of the 18 condition ids), `language`, `starter_topic`, `started_at`, `ended_at`, `is_complete`, `is_flagged`, `flag_notes`, `is_test_mode`, `is_test_saved` |
| `messages` | `conversation_id`, `role`, `content`, `token_count`, `input_mode` (`typed` or `spoken`), `model_name`, `created_at` |
| `survey_responses` | `session_id`, `responses` (JSON: `chatbot_usage`, `chatbot_which`, `political_chatbot`, `chatbot_perception`, `conversation_reflection`, `response_speed`, `topic_variety`, `detected_bias`, `detected_terminology`, `detected_persuasion`, `notice_anything`) |

Models: `apps/api/src/models/`; migrations 005 (consent) and 006 (input mode
and model name) in `apps/api/alembic/versions/`. Three exports
(`apps/api/src/routers/admin.py`): the conversation export
(`GET /api/admin/export?format=csv|json|text`) carries one row per
conversation with the session code, the consent fields and
`data_deleted_at`; the message export (`format=messages-csv|messages-json`)
carries one row per message with `session_id`, `input_mode` and
`model_name`; the survey export (`GET /api/admin/export/surveys`) carries
`session_id`, the submission time and the eleven response keys.

`token_count` is the total the provider reported for the request: the
whole prompt (including any part read from the prompt cache) plus the
reply. The provider of each session is the suffix of `consent_version`;
the model of each reply is `model_name`.

Message text is stored as plain text in SQLite on the Rahti volume. The
consent summary (`apps/participant/src/lib/strings.ts`) says "stored on CSC
servers in Finland" and never "encrypted"; the full privacy notice
(`src/content/notices/privacy-notice.*.md`) names encryption in transit
(TLS) only.

## 14. What is deliberately not used

- **No few-shot prompting.** Few-shot on top of full-corpus grounding has
  diminishing returns and adds a confounded intervention variable.
- **No vector retrieval.** The static corpus and the long context window
  make retrieval unnecessary.
- **No fine-tuning.** Same model plus a different system prompt is the
  manipulation; the condition stays pure and reproducible.
- **No "you are Politician X" labels.** The bot is told to internalise the
  views in the corpus as its own, never to play a party, which avoids the
  model's tendency to refuse or hedge when role-playing political figures.
- **No phone speech services.** Recognition and voice run on our servers
  (section 10).

## 15. Methodological notes worth citing

- **Persona drift** (loss of voice consistency after roughly 8 to 12
  turns) is documented in the recent literature. The 3 to 5 minute target
  conversation (typically 5 to 10 turns) sits before the drift cliff.
- **Grounding over retrieval**: the corpus is static and bounded, the
  textbook case for putting the whole text in the prompt.
- **One identical treatment per framing** across nine parties lets the
  framing effect be separated from the party effect. Because the
  anti-populist register is close to how some parties already talk and far
  from others, the analysis should include a party by framing interaction.
- **Provider as a covariate**: the model is not part of the manipulation,
  but if the provider changes during data collection, replies from
  different models must be separated or balanced in the analysis
  (`model_name`, the `consent_version` suffix).
- **Manipulation simplicity**: the intervention is "system prompt + party
  corpus + populist or anti-populist markers + language directive + turn-1 anchor";
  the avatar and the voice are constant across conditions and therefore not
  part of the manipulation.

## 16. References used in design choices

| Topic | Source |
|---|---|
| Grounding with the full corpus; persona stability | "Deeply Contextualised Persona Prompting" (Emergent Mind, 2026); "Consistently Simulating Human Personas" (arXiv 2511.00222) |
| Persona drift; turn-by-turn voice consistency | "Stable Personas: Dual-Assessment of Temporal Stability" (arXiv 2601.22812); "Persona Drift", Echo Protocol framework |
| Few-shot versus grounding | "Are LLMs Enough for Hyperpartisan/Bias Detection? ICL vs Fine-Tuning" (arXiv 2509.07768); "CEA-LIST at CheckThat! 2025" (arXiv 2507.07539) |
| Persona prompting risks | "Persona Prompting as a Lens on LLM Social Reasoning" (EACL 2026); "Persona is a Double-Edged Sword" (OpenReview) |
| Populism markers | Cranmer 2011: us versus them, people-centrism, anti-elitism |
| Anti-populist markers | Mudde 2004 (pluralism, pp. 543-544) |
| Debriefing | TENK 2019 (Finnish National Board on Research Integrity): disclosure of the true nature of the study |
| Source corpus | Pohtiva (Finnish political programme archive, FSD) |
| Talking avatar | TalkingHead (met4citizen), MIT licence (`apps/participant/src/vendor/talkinghead/LICENSE`); the head file is the AvatarSDK example from the same repository as recorded in `avatar.ts`; its licence is still to be confirmed |
| Speech | Parakeet TDT 0.6B v3 (NVIDIA, CC BY 4.0) with onnx-asr, Piper (Rhasspy); faster-whisper (Systran) as the fallback; VoxCPM2 and whisper large-v3-turbo for the cluster tier |

---

## Quick reference: file map

| Concern | Location |
|---|---|
| Party corpus files (9 .txt) | `apps/api/src/party_data/` |
| 18 condition ids, display names, populist helpers | `apps/api/src/services/party_grounding.py` |
| Party corpus cleaning | `apps/api/scripts/clean_party_corpus.py`, `../Party Program dataset/README.md` |
| System prompt (two parts), populist and anti-populist framing sections | `apps/api/src/services/prompt_builder.py` |
| Weighted no-repeat assignment | `apps/api/src/services/party_assignment.py` |
| Sessions, consent, debrief, delete | `apps/api/src/routers/sessions.py` |
| Conversations, messages (input mode, model name) | `apps/api/src/routers/conversations.py` |
| Survey | `apps/api/src/routers/survey.py` |
| Speech endpoints and engines | `apps/api/src/routers/speech.py`, `apps/api/src/services/speech/`, `apps/api/src/speech_main.py` (the speech pods), `k8s/speech-stt-*.yaml`, `k8s/speech-tts-*.yaml` |
| Speech models fetched at build | `apps/api/scripts/fetch_speech_models.py`, `apps/api/Dockerfile` |
| Session code | `apps/api/src/services/session_code.py` |
| Admin endpoints (stats, exports, by-code lookup) | `apps/api/src/routers/admin.py` |
| Model providers and the runtime switch | `apps/api/src/services/llm_client.py`, `llm_providers/`, `llm_models.py`, `apps/api/scripts/use_provider.sh` |
| Public provider endpoint | `apps/api/src/routers/provider.py` (`GET /api/provider`) |
| Participant app (Astro) | `apps/participant/` |
| Consent, declined, notices | `apps/participant/src/pages/[lang]/consent.astro`, `declined.astro`, `info/[doc].astro`, `src/content/notices/` |
| Study constants and provider texts | `apps/participant/src/lib/studyConfig.ts`, `providerNotice.ts` |
| Chat page, avatar, audio | `apps/participant/src/pages/[lang]/chat.astro`, `src/scripts/chat.ts`, `avatar.ts`, `audio.ts`, `src/vendor/talkinghead/` |
| Survey entry, survey, thank-you with debrief | `apps/participant/src/pages/[lang]/survey-entry.astro`, `survey.astro`, `thank-you.astro` |
| Participant strings (FI, EN) | `apps/participant/src/lib/strings.ts` |
| Browser tests, including the real-API flow | `apps/participant/tests/` |
| Admin app (Next.js) | `apps/web/src/app/admin/` (18 conditions in `admin/lib/types.ts`) |

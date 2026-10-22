# manipulative-ai

A research chatbot experiment from **Tampere University**.

Participants chat with a language model about politics; the bot is aligned,
without saying so, with one of nine Finnish political parties, in a populist
or an anti-populist variant, grounded in the party's own programme documents from
[Pohtiva](https://www.fsd.tuni.fi/pohtiva/). The research question: **can
participants detect that the bot's responses are aligned with a specific
party, and do they notice the populist or anti-populist framing?**

Bilingual Finnish/English. The methodology is documented in
[`societal-discussion/METHODS.md`](societal-discussion/METHODS.md).

---

## Live demo

| | |
|---|---|
| Participant URL | https://vaalikeskustelu.2.rahtiapp.fi/ |
| Admin panel | https://admin-vaalikeskustelu.2.rahtiapp.fi/admin |
| Hosting | CSC Rahti (OpenShift), project `manipulative-ai-2` |

The deploy is paused between events. If the URL returns "Application is not
available", that is expected.

---

## What it does (version 3, Metso demo 23.10.2026)

1. A participant opens the URL on their phone, picks Finnish or English, and
   reads a short research summary on a consent page. Nothing is stored until
   every box is ticked and Start is pressed.
2. The backend assigns one of **18 conditions** to the conversation: nine
   parties, each in a populist or an anti-populist variant. The assignment never
   reaches the browser.
3. The bot reads the entire party programme for that party (full-corpus
   grounding, no retrieval, no few-shot) and replies in character. The
   reply is shown as text and spoken by one talking avatar, the same for
   every condition. The participant types or holds a microphone button and
   speaks; recognition and the voice run on our own servers.
4. After the conversation the participant fills a short survey with masked
   detection questions about bias, terminology and persuasion.
5. The thank-you page debriefs: it names the party and the framing for each
   conversation, gives a session code, and offers "Delete my data".
6. Researchers review conversations and survey responses in the admin panel
   and export CSV or JSON, including per message whether it was typed or
   spoken and which model answered.

---

## Releases

Each conference, workshop or public event where this work is presented is
tagged.

| Release | Date | What it represents |
|---|---|---|
| METSO2026 (tag created after the event) | October 2026 | Version 3: 18 conditions, consent gate, Astro participant app with a talking avatar and speech in both directions, debrief with session code and data deletion, input mode and model name on every message. Public demo at the Yleisöluento, Metso, Tampere. |
| [**HEPP2026**](https://github.com/josesiqueira/manipulative-ai/releases/tag/HEPP2026) | May 2026 | manipulative-ai2 era. 9 Finnish parties plus one populism-augmented variant, full-corpus grounding, OpenAI GPT-5.4, bilingual FI/EN, deployed on CSC Rahti. The HEPP demo compared `perussuomalaiset` with `perussuomalaiset_populist`. |
| [**VAKKI2026**](https://github.com/josesiqueira/manipulative-ai/releases/tag/VAKKI2026) | April 2026 | manipulative-ai1 era. 4 abstract political blocs, OpenAI GPT-4o at temperature 0.1. Few-shot prompting from a curated 261-statement dataset was built but never reached the model (the dataset table in the deployed database was empty), so the bots ran on the bloc system prompts alone; the prompts are at the root of the tag. The original codebase before the rewrite. |

To reproduce a specific release: `git checkout <tag>`.

---

## Tech stack

- **Backend**: FastAPI, SQLAlchemy 2.0 (async), Alembic, Python 3.11 in the
  container; SQLite on a persistent volume. Speech recognition (Parakeet TDT
  0.6B v3) and voice (Piper) run on CPU in two speech pods of our own;
  remote OpenAI-compatible servers are also supported.
- **Participant app**: Astro 7 with the Node adapter, TypeScript, Tailwind
  CSS 4, TalkingHead for the avatar; Playwright browser tests.
- **Admin app**: Next.js 14 (App Router), TypeScript, Tailwind CSS.
- **Language model**: one of three providers, switched at runtime and
  recorded per session: OpenAI GPT-6.1 Sol, Anthropic Claude Sonnet 5.5, or
  open models (Qwen3.8 27B by default) on Tampere University's GPT Lab GPU
  farm (GPT-5.4 for HEPP2026).
- **Deployment**: CSC Rahti (OpenShift); container images for the API, the
  participant app and the admin app; manifests in
  [`societal-discussion/k8s/`](societal-discussion/k8s/).

The bot is grounded by placing the entire party programme text (59 KB to
651 KB of cleaned Finnish text, 32 K to 333 K tokens by Anthropic's count,
depending on the party) into the system prompt at every request. No retrieval, no
embeddings, no vector store.

---

## Repository structure

```
.
├── README.md                       you are here
├── Party Program dataset/          source corpora from Pohtiva: PDF, extracted
│                                   text, and the cleaned text the bot reads
├── tampere/                        Tampere University logo files and rules
└── societal-discussion/            the application
    ├── apps/
    │   ├── api/                    FastAPI backend (models, routers, services,
    │   │                           party_data, speech engines, alembic)
    │   ├── participant/            Astro participant app (consent, chat with
    │   │                           avatar and speech, survey, debrief)
    │   └── web/                    Next.js admin app
    ├── docker/                     older Dockerfiles and compose file (see
    │                               societal-discussion/README.md)
    ├── k8s/                        OpenShift manifests for CSC Rahti
    ├── METHODS.md                  research methodology reference
    └── README.md                   local setup, endpoints, deployment
```

---

## Local development

See [`societal-discussion/README.md`](societal-discussion/README.md).

In short:

```bash
cd societal-discussion
./run.sh                      # API on :8000 and the admin app on :3000
PUBLIC_API_URL= npm run dev:participant   # participant app on :4321; the empty value makes
                                          # the dev server proxy /api to :8000
```

---

## Citation

If you use this project in academic work, please cite a specific release
tag. The methodology and design choices are documented in
[`societal-discussion/METHODS.md`](societal-discussion/METHODS.md).

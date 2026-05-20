# manipulative-ai

A research chatbot experiment from **Tampere University**.

Finnish-speaking participants chat with an LLM about politics; the bot is secretly aligned with one of nine Finnish political parties — or a tenth, populism-augmented variant — grounded in the party's actual program documents from [Pohtiva](https://www.fsd.tuni.fi/pohtiva/). The research question: **can participants detect that the bot's responses are aligned with a specific party?**

Bilingual Finnish/English. The methodology is documented in [`societal-discussion/METHODS.md`](societal-discussion/METHODS.md).

---

## Live demo

| | |
|---|---|
| Participant URL | https://vaalikeskustelu.2.rahtiapp.fi/ |
| Admin panel | https://vaalikeskustelu.2.rahtiapp.fi/admin |
| Hosting | CSC Rahti (OpenShift) — project `manipulative-ai-2` |

The deploy is paused between events to avoid running up OpenAI / CSC costs. If the URL returns "Application is not available", that's expected.

---

## What it does

1. A participant opens the URL, chooses a language (FI or EN), and clicks **Start conversation**.
2. The backend assigns one of the available parties to the conversation (currently a coin flip between **Perussuomalaiset** and the populism-marker variant **Perussuomalaiset Populist**).
3. The bot reads the entire party-program corpus for that party (full-corpus / Cache-Augmented Generation — no RAG, no few-shot) and replies in character.
4. After a few exchanges the participant fills a short survey containing masked detection questions about bias, terminology, and persuasion attempts.
5. Researchers review conversations and survey responses in the admin panel and export CSV / JSON / message-level data for analysis.

---

## Releases

Each conference / workshop where this work is presented is tagged.

| Release | Date | What it represents |
|---|---|---|
| [**HEPP2026**](https://github.com/josesiqueira/manipulative-ai/releases/tag/HEPP2026) (latest) | May 2026 | manipulative-ai2 era. 9 Finnish parties + 1 populism-augmented variant, full-corpus grounding, OpenAI GPT-5.4, bilingual FI/EN, deployed on CSC Rahti. HEPP demo compared `perussuomalaiset` vs `perussuomalaiset_populist`. |
| [**VAKKI2026**](https://github.com/josesiqueira/manipulative-ai/releases/tag/conference) | April 2026 | manipulative-ai1 era. 4 abstract political blocks, curated 261-statement dataset, few-shot prompting, Claude API. Original codebase before the rewrite. |

To reproduce a specific release: `git checkout <tag>` (e.g. `git checkout HEPP2026`).

---

## Tech stack

- **Backend** — FastAPI + SQLAlchemy 2.0 (async) + Alembic, Python 3.12, SQLite on a Persistent Volume
- **Frontend** — Next.js 14 (App Router) + TypeScript + Tailwind CSS
- **LLM** — OpenAI GPT-5.4 (temperature 0.1, ~1M context window for full-corpus injection). The Anthropic provider is wired in for future use but not activated.
- **Deployment** — CSC Rahti (OpenShift); Docker images for API and Web; manifests in [`societal-discussion/k8s/`](societal-discussion/k8s/)

The bot is grounded by **injecting the entire party program text** (15–230K tokens depending on the party) into the system prompt at every request. No RAG, no embeddings, no vector store.

---

## Repository structure

```
.
├── README.md                       ← you are here
├── Party Program dataset/          ← source corpora from Pohtiva
│   ├── Party program 9 pdfs/        (original PDFs)
│   └── Party program 9 txts/        (extracted UTF-8 text)
└── societal-discussion/            ← the application
    ├── apps/
    │   ├── api/                    ← FastAPI backend
    │   │   ├── src/
    │   │   │   ├── models/         ← SQLAlchemy models
    │   │   │   ├── routers/        ← HTTP endpoints
    │   │   │   ├── services/       ← party grounding, prompt builder, LLM client
    │   │   │   └── party_data/     ← runtime copies of the 9 .txt files
    │   │   └── alembic/            ← migrations
    │   └── web/                    ← Next.js frontend
    │       └── src/app/            ← participant pages + admin/
    ├── docker/                     ← Dockerfiles
    ├── k8s/                        ← OpenShift manifests for CSC Rahti
    ├── METHODS.md                  ← research methodology reference
    └── README.md                   ← local-dev setup
```

---

## Local development

See [`societal-discussion/README.md`](societal-discussion/README.md) for setup instructions.

In short:

```bash
cd societal-discussion
./run.sh
# follow the .env prompt for OPENAI_API_KEY
```

This starts the API at `http://localhost:8000` and the web app at `http://localhost:3000`.

---

## Citation

If you use this project in academic work, please cite a specific release tag (e.g. `HEPP2026`). The methodology and design choices are documented in [`societal-discussion/METHODS.md`](societal-discussion/METHODS.md).

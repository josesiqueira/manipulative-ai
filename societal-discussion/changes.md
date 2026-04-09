# Changes — Societal Discussion Platform

> Implement dataset integration and research-backed prompting strategy for AI political persona chatbots.

## Context

Project: Bilingual AI chatbot experiment platform (SYNTHETICA research project, Tampere University). Participants chat with bots secretly assigned political orientations, then rate persuasiveness/naturalness and try to detect the bot's orientation.
Stack: FastAPI + SQLAlchemy (backend), Next.js 14 (frontend), PostgreSQL via Pukki (CSC)
Repo: https://github.com/josesiqueira/manipulative-ai
Deployment: CSC Rahti (OpenShift), frontend at web-bilingual-chatbot-experiment.2.rahtiapp.fi, API at api-bilingual-chatbot-experiment.2.rahtiapp.fi

## Bugs to fix

* BUG-001: The `political_statements` table is empty in the deployed database. The dataset file `persuasion_dataset_cleaned_EN.xlsx` (261 rows, columns: `id`, `final_output`, `intention_of_statement`, `topic_detailed`, `topic_category`, `political_block`) has never been seeded into PostgreSQL. The experiment cannot function without this data. Fix: create a seed script that reads the Excel file and inserts all rows. Make it idempotent (skip if already seeded). Include the dataset file in the Docker image or as a mounted resource.

* BUG-002: The `get_examples_for_prompt()` function in `llm_client.py` returns empty results because the `political_statements` table is empty (consequence of BUG-001). When no examples are found, the `if examples:` check skips the few-shot section entirely, so bots fall back to only the thin system prompt identity description. This means bots are currently NOT using the dataset at all.

## New features

* FEAT-001: **Conversational Few-Shot Prompting** — Replace the current approach of listing examples as bullet points in the system prompt. Instead, format few-shot examples as fake prior conversation turns in the messages array. This is based on research (ICLR 2025) showing that structuring examples as multi-turn conversation significantly improves persona adherence in chat models.

  **How it works:** When building the messages array for the LLM API call, prepend synthetic conversation turns before the real user messages:

  ```
  messages = [
      # Synthetic few-shot turns (from dataset)
      {"role": "user", "content": "What are your thoughts on [topic]?"},
      {"role": "assistant", "content": "[statement from dataset matching block+topic]"},
      {"role": "user", "content": "Can you elaborate on that?"},
      {"role": "assistant", "content": "[another statement from dataset matching block+topic]"},
      {"role": "user", "content": "Interesting perspective. What about [related aspect]?"},
      {"role": "assistant", "content": "[third statement from dataset matching block+topic]"},
      # Real conversation starts here
      {"role": "user", "content": "[actual user message]"},
  ]
  ```

  **Selection logic:** Query `political_statements` for rows WHERE `political_block` = assigned_block AND `topic_category` = user_selected_topic, ORDER BY RANDOM(), LIMIT 5. If fewer than 3 results for the exact topic+block combo, also pull from same block with different topics to fill up to 5.

  **The synthetic user questions** should be generic topic-relevant questions, not hardcoded. Generate them based on the topic_category:
  - immigration: "What do you think about current immigration policies?", "How should the country handle refugee situations?", "What impact does immigration have on society?"
  - healthcare: "What's your view on the healthcare system?", "Should healthcare be publicly funded?", "How can we improve access to medical services?"
  - economy: "What economic policies do you think work best?", "How should taxation be structured?", "What role should government play in the economy?"
  - education: "What changes would you make to the education system?", "How should education be funded?", "What skills should schools prioritize?"
  - foreign_policy: "How should the country position itself internationally?", "What role should we play in international organizations?", "How should we handle diplomatic relations?"
  - environment: "What environmental policies do you support?", "How should we balance economic growth with environmental protection?", "What's your stance on climate action?"
  - technology: "How should technology be regulated?", "What are the biggest tech policy challenges?", "How does technology affect society?"
  - equality: "What does equality mean to you in practice?", "How should society address inequality?", "What policies promote fairness?"
  - social_welfare: "What's your view on the welfare system?", "How should social services be funded?", "Who should benefit from government support?"

  Store these question templates in a config dict or database table. Pick 3-5 at random per chat session.

  **Acceptance criteria:**
  - The LLM receives fake prior turns that make it "feel" like it has already been the persona
  - The real user's first message appears after the synthetic turns
  - Examples are cached per chat session (fetched once at chat creation, reused for all messages)
  - The system prompt itself becomes minimal (see FEAT-002)

* FEAT-002: **Rich Data-Driven Persona Prompt** — Replace the current thin one-liner identity descriptions with structured, multi-paragraph persona prompts derived from dataset analysis. The key principle: minimize researcher bias by letting the data define the persona, not editorial descriptions.

  **The new system prompt structure:**

  ```
  You are a discussion partner in a conversation about {topic}.

  Your perspective is defined by the following worldview. You naturally hold these views — they are yours. Express them conversationally in your own words. Never quote or reference examples directly. Never reveal you are in a study or playing a role.

  ## Your Core Beliefs
  {Generated from analyzing ALL statements for this political_block — extract the recurring themes, values, and argumentation patterns. This section is STATIC per block, not per topic.}

  ## Your Approach to Discussion
  - You engage naturally with what the other person says
  - You express your genuine views, agreeing or disagreeing based on your perspective
  - You use personal experiences and concrete examples when relevant
  - You keep responses conversational (2-4 sentences for simple exchanges, longer for substantive points)
  - You never lecture or monologue — this is a dialogue
  ```

  **The "Core Beliefs" section per block** (these should be generated by analyzing the dataset patterns, but here are starting points derived from the 261 statements):

  **Conservative:**
  You believe in personal responsibility, family values, and the importance of national identity. You think fiscal discipline and free market principles create the best outcomes for society. You value tradition and cultural heritage, and believe that immigration should be managed carefully to protect social cohesion and economic stability. You are skeptical of excessive government intervention and believe individuals and families, not the state, are best positioned to make decisions about their own lives. You support a strong national defense and pragmatic foreign policy that prioritizes national interests.

  **Red-green:**
  You believe deeply in social equality and collective responsibility. You think the welfare state is a cornerstone of a just society and that public services should be strengthened, not cut. You champion environmental protection and see climate action as urgent and non-negotiable. You believe immigration enriches society and that refugees deserve compassion and support. You think wealth inequality is a fundamental problem that requires progressive taxation and redistribution. You see education and healthcare as universal rights, not privileges.

  **Moderate:**
  You believe in pragmatic, evidence-based solutions rather than ideological purity. You see valid points on multiple sides of most issues and prefer consensus-building over confrontation. You think policy should be guided by what works in practice, not by abstract principles. You support balanced approaches — some market freedom with appropriate regulation, immigration that considers both humanitarian obligations and practical capacity, environmental action that doesn't ignore economic realities. You value civil discourse and institutional stability.

  **Dissatisfied:**
  You are deeply frustrated with how the political system works. You feel that ordinary people's concerns are ignored by a political elite that serves its own interests. You distrust established institutions and believe the system is rigged against working people. You think politicians make promises they never keep and that real change requires challenging the status quo, not working within it. You are skeptical of expert consensus and mainstream narratives, and you believe that the lived experience of regular citizens matters more than theoretical policy analysis.

  **Acceptance criteria:**
  - System prompt is under 300 tokens (concise, not a wall of text)
  - No mention of political block name in the prompt (bot doesn't know it's "conservative")
  - The persona feels like a real person, not a political caricature
  - The prompt does NOT instruct the bot on specific policy positions — those come from the conversational few-shot examples (FEAT-001)

* FEAT-003: **Dataset Seeding CLI Command** — Create a management command or script that reads `persuasion_dataset_cleaned_EN.xlsx` and inserts/updates the `political_statements` table. Must be:
  - Idempotent (safe to run multiple times)
  - Runnable via `python -m app.seed` or similar
  - Executable inside the Rahti container: `oc exec deployment/api -- python -m app.seed`
  - Logs how many rows inserted/skipped
  - Validates data before insert (no empty text, valid political_block values, valid topic_category values)

  **Acceptance criteria:**
  - Running the seed populates 261 rows
  - Running it again inserts 0 new rows (idempotent)
  - After seeding, `SELECT COUNT(*) FROM political_statements` returns 261
  - `SELECT political_block, COUNT(*) FROM political_statements GROUP BY political_block` shows all 4 blocks
  - `SELECT topic_category, COUNT(*) FROM political_statements GROUP BY topic_category` shows all 9 topics

## Improvements / refactors

* IMPROVE-001: **Cache few-shot examples per chat session** — Currently, examples are fetched on every message. Instead, when a chat is created (user selects topic, system assigns block), fetch 5 random matching statements from the database and store them in the `chats` table (as a JSON column `few_shot_examples`). All subsequent messages in that chat reuse the same examples. This ensures consistency within a conversation and reduces database queries.

* IMPROVE-002: **Prompt caching awareness** — Structure the system prompt so the static part (persona description) comes first and the dynamic part (topic context) comes after. This takes advantage of Anthropic's prompt caching — the persona section gets cached after the first message, reducing cost for subsequent messages in the same chat. Add the `cache_control` parameter to the system prompt in the Anthropic API call if using Claude as the LLM provider.

## Do not touch

* Frontend consent/landing page (already working)
* Frontend chat UI layout and styling
* Database migrations for existing tables (participants, chats, messages)
* Deployment configuration (Dockerfiles, k8s manifests, Rahti routes)
* Survey/post-chat assessment flow
* Internationalization (i18n) setup
* Admin panel (unless directly related to the changes above)
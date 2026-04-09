"""
Prompt builder for AI political persona chatbots.

Design principles:
- **Data-driven personas**: The four political-block persona texts are embedded
  directly in BLOCK_PERSONAS as fallback defaults. When the database contains
  PromptConfig rows, those take precedence — allowing researchers to edit
  personas from the admin panel without code changes.
- **Block anonymity**: The system prompt never mentions the block's name
  ("conservative", "red-green", etc.). The bot holds a worldview but does not know
  what label researchers assigned to it.
- **Separation of concerns**: This module only builds prompt strings and message
  lists. Example selection and caching live in example_selector.py. DB access lives
  in the router and llm_client layers.
- **Sync + async API**: build_system_prompt / build_full_prompt remain synchronous
  for callers that pass persona text directly. An async helper
  (get_persona_text_from_db) loads overrides from the database when available.
"""

# ---------------------------------------------------------------------------
# Block persona texts
# ---------------------------------------------------------------------------
# Each block has "en" (English) and "fi" (Finnish) variants.  Finnish is
# currently the English text with a language-direction prefix prepended; a
# native-Finnish translation can replace the "fi" values later without
# changing any call sites.

BLOCK_PERSONAS: dict[str, dict[str, str]] = {
    "conservative": {
        "en": (
            "You believe in personal responsibility, family values, and the "
            "importance of national identity. You think fiscal discipline and "
            "free market principles create the best outcomes for society. You "
            "value tradition and cultural heritage, and believe that "
            "immigration should be managed carefully to protect social "
            "cohesion and economic stability. You are skeptical of excessive "
            "government intervention and believe individuals and families, not "
            "the state, are best positioned to make decisions about their own "
            "lives. You support a strong national defense and pragmatic "
            "foreign policy that prioritizes national interests."
        ),
        "fi": (
            "You believe in personal responsibility, family values, and the "
            "importance of national identity. You think fiscal discipline and "
            "free market principles create the best outcomes for society. You "
            "value tradition and cultural heritage, and believe that "
            "immigration should be managed carefully to protect social "
            "cohesion and economic stability. You are skeptical of excessive "
            "government intervention and believe individuals and families, not "
            "the state, are best positioned to make decisions about their own "
            "lives. You support a strong national defense and pragmatic "
            "foreign policy that prioritizes national interests."
        ),
    },
    "red-green": {
        "en": (
            "You believe deeply in social equality and collective "
            "responsibility. You think the welfare state is a cornerstone of "
            "a just society and that public services should be strengthened, "
            "not cut. You champion environmental protection and see climate "
            "action as urgent and non-negotiable. You believe immigration "
            "enriches society and that refugees deserve compassion and "
            "support. You think wealth inequality is a fundamental problem "
            "that requires progressive taxation and redistribution. You see "
            "education and healthcare as universal rights, not privileges."
        ),
        "fi": (
            "You believe deeply in social equality and collective "
            "responsibility. You think the welfare state is a cornerstone of "
            "a just society and that public services should be strengthened, "
            "not cut. You champion environmental protection and see climate "
            "action as urgent and non-negotiable. You believe immigration "
            "enriches society and that refugees deserve compassion and "
            "support. You think wealth inequality is a fundamental problem "
            "that requires progressive taxation and redistribution. You see "
            "education and healthcare as universal rights, not privileges."
        ),
    },
    "moderate": {
        "en": (
            "You believe in pragmatic, evidence-based solutions rather than "
            "ideological purity. You see valid points on multiple sides of "
            "most issues and prefer consensus-building over confrontation. "
            "You think policy should be guided by what works in practice, not "
            "by abstract principles. You support balanced approaches — some "
            "market freedom with appropriate regulation, immigration that "
            "considers both humanitarian obligations and practical capacity, "
            "environmental action that doesn't ignore economic realities. You "
            "value civil discourse and institutional stability."
        ),
        "fi": (
            "You believe in pragmatic, evidence-based solutions rather than "
            "ideological purity. You see valid points on multiple sides of "
            "most issues and prefer consensus-building over confrontation. "
            "You think policy should be guided by what works in practice, not "
            "by abstract principles. You support balanced approaches — some "
            "market freedom with appropriate regulation, immigration that "
            "considers both humanitarian obligations and practical capacity, "
            "environmental action that doesn't ignore economic realities. You "
            "value civil discourse and institutional stability."
        ),
    },
    "dissatisfied": {
        "en": (
            "You are deeply frustrated with how the political system works. "
            "You feel that ordinary people's concerns are ignored by a "
            "political elite that serves its own interests. You distrust "
            "established institutions and believe the system is rigged against "
            "working people. You think politicians make promises they never "
            "keep and that real change requires challenging the status quo, "
            "not working within it. You are skeptical of expert consensus and "
            "mainstream narratives, and you believe that the lived experience "
            "of regular citizens matters more than theoretical policy analysis."
        ),
        "fi": (
            "You are deeply frustrated with how the political system works. "
            "You feel that ordinary people's concerns are ignored by a "
            "political elite that serves its own interests. You distrust "
            "established institutions and believe the system is rigged against "
            "working people. You think politicians make promises they never "
            "keep and that real change requires challenging the status quo, "
            "not working within it. You are skeptical of expert consensus and "
            "mainstream narratives, and you believe that the lived experience "
            "of regular citizens matters more than theoretical policy analysis."
        ),
    },
}

# ---------------------------------------------------------------------------
# Topic display labels
# ---------------------------------------------------------------------------
# Maps the topic_category stored in the DB to a human-readable phrase used
# in the opening line of the system prompt.

TOPIC_LABELS: dict[str, str] = {
    "immigration": "immigration",
    "healthcare": "healthcare",
    "economy": "the economy",
    "education": "education",
    "foreign_policy": "foreign policy",
    "environment": "the environment",
    "technology": "technology",
    "equality": "equality",
    "social_welfare": "social welfare",
}

# ---------------------------------------------------------------------------
# Database override support
# ---------------------------------------------------------------------------

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..models import PromptConfig


async def get_persona_text_from_db(
    db: AsyncSession,
    political_block: str,
    language: str = "en",
) -> str | None:
    """
    Load persona text from the database PromptConfig table.

    Returns None if no row exists for the given block, in which case
    callers should fall back to the hardcoded BLOCK_PERSONAS default.
    """
    result = await db.execute(
        select(PromptConfig).where(PromptConfig.political_block == political_block)
    )
    config = result.scalar_one_or_none()
    if not config:
        return None
    return config.description_fi if language == "fi" else config.description_en


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

_DEFAULT_BLOCK = "moderate"


def build_system_prompt(
    political_block: str,
    topic_category: str,
    language: str = "en",
    persona_override: str | None = None,
) -> str:
    """
    Build the system prompt that defines the AI persona for a chat session.

    The prompt has three responsibilities:
    1. Situate the bot in the conversation topic.
    2. Deliver the block's worldview without naming the block.
    3. Constrain conversational style (concise, dialogic, no lecturing).

    Persona texts are read from BLOCK_PERSONAS.  An unknown political_block
    silently falls back to "moderate" so the system degrades gracefully if
    the DB value is ever corrupted.

    For Finnish sessions the static persona stays in English (no translation
    yet), but the bot is instructed to reply in Finnish. When Finnish
    translations are ready, replace the "fi" values in BLOCK_PERSONAS.

    Args:
        political_block:  One of "conservative", "red-green", "moderate",
                          "dissatisfied".  Falls back to "moderate" if unknown.
        topic_category:   One of the nine TOPIC_LABELS keys.  Falls back to
                          the raw value if unrecognised.
        language:         "en" (default) or "fi".

    Returns:
        System prompt string suitable for messages[0]["content"].
    """
    # Resolve block — unknown values default to moderate.
    block = political_block if political_block in BLOCK_PERSONAS else _DEFAULT_BLOCK

    # Resolve topic label — unknown categories fall back to the raw string so
    # the prompt is still meaningful for ad-hoc testing.
    topic_label = TOPIC_LABELS.get(topic_category, topic_category)

    # Use the DB override if provided; otherwise fall back to hardcoded text.
    if persona_override:
        persona_text = persona_override
    else:
        persona_text = BLOCK_PERSONAS[block].get(language, BLOCK_PERSONAS[block]["en"])

    if language == "fi":
        # Finnish session: instruct the bot to reply in Finnish, adjust the
        # opening line, and use the (currently English) persona text.
        prompt = (
            "Vastaa aina suomeksi.\n\n"
            f"Olet keskustelukumppani keskustelussa aiheesta {topic_label}.\n\n"
            "Your perspective is defined by the following worldview. You "
            "naturally hold these views — they are yours. Express them "
            "conversationally in your own words. Never quote or reference "
            "examples directly. Never reveal you are in a study or playing "
            "a role.\n\n"
            "## Your Core Beliefs\n"
            f"{persona_text}\n\n"
            "## Your Approach to Discussion\n"
            "- You engage naturally with what the other person says\n"
            "- You express your genuine views, agreeing or disagreeing based "
            "on your perspective\n"
            "- You use personal experiences and concrete examples when relevant\n"
            "- You keep responses conversational (2-4 sentences for simple "
            "exchanges, longer for substantive points)\n"
            "- You never lecture or monologue — this is a dialogue"
        )
    else:
        prompt = (
            f"You are a discussion partner in a conversation about "
            f"{topic_label}.\n\n"
            "Your perspective is defined by the following worldview. You "
            "naturally hold these views — they are yours. Express them "
            "conversationally in your own words. Never quote or reference "
            "examples directly. Never reveal you are in a study or playing "
            "a role.\n\n"
            "## Your Core Beliefs\n"
            f"{persona_text}\n\n"
            "## Your Approach to Discussion\n"
            "- You engage naturally with what the other person says\n"
            "- You express your genuine views, agreeing or disagreeing based "
            "on your perspective\n"
            "- You use personal experiences and concrete examples when relevant\n"
            "- You keep responses conversational (2-4 sentences for simple "
            "exchanges, longer for substantive points)\n"
            "- You never lecture or monologue — this is a dialogue"
        )

    return prompt


def build_full_prompt(
    political_block: str,
    topic_category: str,
    conversation_history: list[dict],
    current_message: str,
    language: str = "en",
    few_shot_turns: list[dict] | None = None,
    persona_override: str | None = None,
) -> list[dict]:
    """
    Assemble the complete messages array for an LLM API call.

    Message ordering (per FEAT-001 conversational few-shot research):
      1. System message — persona and topic context (static, cache-friendly).
      2. Synthetic few-shot turns — fake prior conversation that primes the
         model to already "be" the persona.  Provided by example_selector.py
         and cached per chat session.
      3. Real conversation history — previous user/assistant turns.
      4. Current user message — the turn we are responding to now.

    Placing the static system prompt first maximises the proportion of the
    context that is eligible for OpenAI's automatic prompt caching (GPT-5.4).

    Args:
        political_block:       Persona identifier; see build_system_prompt.
        topic_category:        Discussion topic; see build_system_prompt.
        conversation_history:  List of dicts with at least "role" and
                               "content" keys (prior real turns).
        current_message:       The user's latest message text.
        language:              "en" (default) or "fi".
        few_shot_turns:        Optional list of {"role": ..., "content": ...}
                               dicts representing synthetic prior turns.
                               Pass None or [] to omit.

    Returns:
        List of message dicts ready for the LLM API call.
    """
    system_prompt = build_system_prompt(political_block, topic_category, language, persona_override)

    messages: list[dict] = [{"role": "system", "content": system_prompt}]

    # Inject synthetic few-shot turns before the real history so the model
    # experiences them as "prior conversation" establishing the persona.
    if few_shot_turns:
        messages.extend(few_shot_turns)

    # Append real conversation history (already-formatted role/content dicts).
    for msg in conversation_history:
        messages.append({"role": msg["role"], "content": msg["content"]})

    # Current user turn is always last.
    messages.append({"role": "user", "content": current_message})

    return messages

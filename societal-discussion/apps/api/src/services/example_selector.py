import random
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..models import PoliticalStatement


# Generic conversational questions per topic category.
# Used to build synthetic prior-conversation turns for few-shot prompting.
# Questions are deliberately neutral so they do not bias the persona.
TOPIC_QUESTIONS: dict[str, list[str]] = {
    "immigration": [
        "What do you think about current immigration policies?",
        "How should the country handle refugee situations?",
        "What impact does immigration have on society?",
    ],
    "healthcare": [
        "What's your view on the healthcare system?",
        "Should healthcare be publicly funded?",
        "How can we improve access to medical services?",
    ],
    "economy": [
        "What economic policies do you think work best?",
        "How should taxation be structured?",
        "What role should government play in the economy?",
    ],
    "education": [
        "What changes would you make to the education system?",
        "How should education be funded?",
        "What skills should schools prioritize?",
    ],
    "foreign_policy": [
        "How should the country position itself internationally?",
        "What role should we play in international organizations?",
        "How should we handle diplomatic relations?",
    ],
    "environment": [
        "What environmental policies do you support?",
        "How should we balance economic growth with environmental protection?",
        "What's your stance on climate action?",
    ],
    "technology": [
        "How should technology be regulated?",
        "What are the biggest tech policy challenges?",
        "How does technology affect society?",
    ],
    "equality": [
        "What does equality mean to you in practice?",
        "How should society address inequality?",
        "What policies promote fairness?",
    ],
    "social_welfare": [
        "What's your view on the welfare system?",
        "How should social services be funded?",
        "Who should benefit from government support?",
    ],
}

# Fallback questions used when a topic is not found in TOPIC_QUESTIONS.
_GENERIC_QUESTIONS: list[str] = [
    "What are your thoughts on this issue?",
    "How do you think society should address this?",
    "What policies would you prioritize here?",
]


async def select_examples(
    db: AsyncSession,
    political_block: str,
    topic_category: str,
    language: str = "en",
    n: int = 5,
) -> list[PoliticalStatement]:
    """
    Select few-shot examples for prompting.

    Priority order:
    1. Exact match: same block + same topic + has content in requested language
    2. Same block, different topic (fallback when exact match is insufficient)

    Args:
        db: Database session
        political_block: The assigned political block (e.g., "conservative")
        topic_category: The discussion topic (e.g., "immigration")
        language: Requested language ("en" or "fi")
        n: Number of examples to select (default 5)

    Returns:
        List of PoliticalStatement objects for few-shot prompting
    """
    selected: list[PoliticalStatement] = []
    used_ids: set[int] = set()

    # Priority 1: Exact match (same block + same topic)
    exact_query = select(PoliticalStatement).where(
        PoliticalStatement.political_block == political_block,
        PoliticalStatement.topic_category == topic_category,
    )

    # If Finnish requested, prefer statements that have Finnish translations
    if language == "fi":
        exact_query = exact_query.where(
            PoliticalStatement.final_output_fi.isnot(None)
        )

    exact_result = await db.execute(exact_query)
    exact_matches = list(exact_result.scalars().all())

    if exact_matches:
        sample_size = min(n, len(exact_matches))
        sampled = random.sample(exact_matches, sample_size)
        selected.extend(sampled)
        used_ids.update(s.id for s in sampled)

    # Priority 2: Same block, different topic (if we still need more)
    if len(selected) < n:
        remaining = n - len(selected)

        fallback_query = select(PoliticalStatement).where(
            PoliticalStatement.political_block == political_block,
            PoliticalStatement.topic_category != topic_category,
        )

        if used_ids:
            fallback_query = fallback_query.where(
                PoliticalStatement.id.notin_(used_ids)
            )

        if language == "fi":
            fallback_query = fallback_query.where(
                PoliticalStatement.final_output_fi.isnot(None)
            )

        fallback_result = await db.execute(fallback_query)
        fallback_matches = list(fallback_result.scalars().all())

        if fallback_matches:
            sample_size = min(remaining, len(fallback_matches))
            sampled = random.sample(fallback_matches, sample_size)
            selected.extend(sampled)

    return selected


def build_conversational_turns(
    statements: list[PoliticalStatement],
    topic_category: str,
    language: str = "en",
) -> list[dict]:
    """
    Build synthetic conversation turns from dataset statements.

    Each statement is paired with a randomly chosen question from TOPIC_QUESTIONS
    for the given topic, producing alternating user/assistant message dicts that
    simulate a prior conversation demonstrating the persona's voice and stance.

    The synthetic history is inserted between the system prompt and the real
    conversation, giving the model concrete in-context examples without requiring
    explicit "Example:" formatting in the system prompt.

    Returns alternating user/assistant message dicts:
    [
        {"role": "user", "content": "What do you think about...?"},
        {"role": "assistant", "content": "[statement text from dataset]"},
        {"role": "user", "content": "How should...?"},
        {"role": "assistant", "content": "[another statement]"},
        ...
    ]

    The number of turns matches the number of statements (one question per statement).
    Questions are randomly selected from TOPIC_QUESTIONS for the given topic,
    with replacement if there are more statements than available questions.

    Args:
        statements: PoliticalStatement objects selected by select_examples
        topic_category: Topic key used to look up TOPIC_QUESTIONS
        language: Language code for statement.get_content()

    Returns:
        Flat list of alternating {"role": ..., "content": ...} dicts
    """
    question_pool = TOPIC_QUESTIONS.get(topic_category, _GENERIC_QUESTIONS)

    # random.choices allows replacement, ensuring we always get len(statements) questions
    # even when the pool has fewer entries than the number of statements.
    questions = random.choices(question_pool, k=len(statements))

    turns: list[dict] = []
    for question, statement in zip(questions, statements):
        turns.append({"role": "user", "content": question})
        turns.append({"role": "assistant", "content": statement.get_content(language)})

    return turns


def build_few_shot_cache(
    statements: list[PoliticalStatement],
    topic_category: str,
    language: str = "en",
) -> dict:
    """
    Build the JSON payload to cache in chats.few_shot_examples.

    Stores three parallel representations of the same examples:
    - "turns": ready-to-use message dicts for the LLM messages array
    - "example_ids": DB primary keys for audit/logging
    - "examples": structured metadata for debugging and admin inspection

    This self-describing format avoids a DB JOIN on every message request.

    Args:
        statements: PoliticalStatement objects selected by select_examples
        topic_category: Topic key passed to build_conversational_turns
        language: Language code for statement content extraction

    Returns:
        Dict suitable for JSON serialisation into chats.few_shot_examples
    """
    turns = build_conversational_turns(statements, topic_category, language)
    example_ids = [s.id for s in statements]
    examples = [
        {
            "text": s.get_content(language),
            "topic_detailed": s.topic_detailed,
            "intention": s.intention_of_statement,
        }
        for s in statements
    ]
    return {
        "turns": turns,
        "example_ids": example_ids,
        "examples": examples,
    }

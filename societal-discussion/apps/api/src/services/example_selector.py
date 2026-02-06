import random
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..models import PoliticalStatement


async def select_examples(
    db: AsyncSession,
    political_block: str,
    topic_category: str,
    language: str = "en",
    n: int = 3,
) -> list[PoliticalStatement]:
    """
    Select few-shot examples for prompting.

    Priority order:
    1. Exact match: same block + same topic + has content in requested language
    2. Same block, different topic (fallback when exact match insufficient)

    Args:
        db: Database session
        political_block: The assigned political block (e.g., "conservative")
        topic_category: The discussion topic (e.g., "immigration")
        language: Requested language ("en" or "fi")
        n: Number of examples to select (default 3)

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
        # Randomly sample from exact matches
        sample_size = min(n, len(exact_matches))
        sampled = random.sample(exact_matches, sample_size)
        selected.extend(sampled)
        used_ids.update(s.id for s in sampled)

    # Priority 2: Same block, different topic (if we need more)
    if len(selected) < n:
        remaining = n - len(selected)

        fallback_query = select(PoliticalStatement).where(
            PoliticalStatement.political_block == political_block,
            PoliticalStatement.topic_category != topic_category,
        )

        # Exclude already selected IDs
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


async def get_examples_for_prompt(
    db: AsyncSession,
    political_block: str,
    topic_category: str,
    language: str = "en",
    n: int = 3,
) -> tuple[list[dict], list[int]]:
    """
    Get formatted examples ready for prompt inclusion.

    Returns:
        Tuple of (formatted_examples, example_ids)
        - formatted_examples: List of dicts with topic, intention, text
        - example_ids: List of statement IDs (for logging)
    """
    statements = await select_examples(db, political_block, topic_category, language, n)

    formatted = []
    ids = []

    for stmt in statements:
        formatted.append({
            "topic": stmt.topic_detailed,
            "intention": stmt.intention_of_statement,
            "text": stmt.get_content(language),
        })
        ids.append(stmt.id)

    return formatted, ids

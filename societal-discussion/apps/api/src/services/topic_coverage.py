"""
Topic coverage utilities.

Shared functions and constants for topic coverage calculation.
"""

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from ..models import PoliticalStatement


# Threshold for considering a topic as having sparse coverage
# Topics with fewer than this many political statements will show a warning
SPARSE_COVERAGE_THRESHOLD = 12


async def get_topic_coverage_counts(db: AsyncSession) -> dict[str, int]:
    """
    Get the count of political statements for each topic.
    Used to determine sparse coverage.

    Returns:
        Dictionary mapping topic_key to count of political statements
    """
    result = await db.execute(
        select(
            PoliticalStatement.topic_category,
            func.count(PoliticalStatement.id)
        )
        .group_by(PoliticalStatement.topic_category)
    )
    return {row[0]: row[1] for row in result.all()}


def is_topic_sparse(count: int) -> bool:
    """
    Check if a topic has sparse coverage.

    Args:
        count: Number of political statements for the topic

    Returns:
        True if the topic has sparse coverage (below threshold)
    """
    return count < SPARSE_COVERAGE_THRESHOLD

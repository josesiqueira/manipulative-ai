import random

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from ..models import Conversation
from .party_grounding import ALL_PARTIES


async def assign_party(db: AsyncSession, session_id: str) -> str:
    """
    Assign a party for a new conversation.

    Rules:
    - Must NOT repeat a party already used in this session
    - If all parties have been used, reset the pool
    - Uses weighted random favoring globally underrepresented parties
    """
    result = await db.execute(
        select(Conversation.assigned_party)
        .where(Conversation.session_id == session_id)
        .where(Conversation.is_test_mode == False)  # noqa: E712
    )
    used_parties = {row[0] for row in result.all()}

    available = [p for p in ALL_PARTIES if p not in used_parties]
    if not available:
        available = list(ALL_PARTIES)

    # Use weighted random: favor globally underrepresented parties
    global_counts = await get_global_party_counts(db)
    total = sum(global_counts.values()) + len(ALL_PARTIES)
    weights = []
    for party in available:
        count = global_counts.get(party, 0)
        weight = (total - count) / total
        weights.append(weight)

    return random.choices(available, weights=weights, k=1)[0]


async def get_global_party_counts(db: AsyncSession) -> dict[str, int]:
    """Get count of non-test conversations per party."""
    result = await db.execute(
        select(Conversation.assigned_party, func.count(Conversation.id))
        .where(Conversation.is_test_mode == False)  # noqa: E712
        .group_by(Conversation.assigned_party)
    )
    counts = {party: 0 for party in ALL_PARTIES}
    for party, count in result.all():
        counts[party] = count
    return counts

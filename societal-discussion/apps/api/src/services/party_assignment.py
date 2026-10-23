import random

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from ..config import get_settings
from ..models import Conversation
from .party_grounding import ALL_PARTIES, base_party


def assignable_parties() -> list[str]:
    """The conditions participants can be assigned: ALL_PARTIES limited to
    the base parties in ACTIVE_PARTIES (both framings each), or all 18."""
    active = {p.strip() for p in get_settings().active_parties.split(",") if p.strip()}
    pool = [p for p in ALL_PARTIES if base_party(p) in active] if active else list(ALL_PARTIES)
    return pool or list(ALL_PARTIES)


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

    pool = assignable_parties()
    available = [p for p in pool if p not in used_parties]
    if not available:
        available = list(pool)

    # Use weighted random: favor globally underrepresented parties
    global_counts = await get_global_party_counts(db)
    total = sum(global_counts.get(p, 0) for p in pool) + len(pool)
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

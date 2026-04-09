import random
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from ..models import Chat

POLITICAL_BLOCKS = ["conservative", "red-green", "moderate", "dissatisfied"]


async def assign_political_block(db: AsyncSession, participant_id: str) -> str:
    """
    Assign a political block to a new chat using stratified randomization.

    Strategy:
    1. For participant's first chat: pure random assignment
    2. For subsequent chats: prefer blocks they haven't seen yet
    3. Overall: balance total assignments across all participants

    This ensures:
    - Each participant experiences variety (if they do multiple chats)
    - Overall distribution is balanced across the study
    """
    # Get blocks this participant has already seen
    result = await db.execute(
        select(Chat.political_block)
        .where(Chat.participant_id == participant_id)
        .where(Chat.is_test_mode == False)
    )
    seen_blocks = {row[0] for row in result.all()}

    # If participant hasn't seen all blocks, prefer unseen ones
    unseen_blocks = [b for b in POLITICAL_BLOCKS if b not in seen_blocks]

    if unseen_blocks:
        # Participant hasn't seen all blocks yet
        # Use weighted random: slightly favor globally underrepresented blocks
        global_counts = await get_global_block_counts(db)

        # Calculate weights: inverse of count (less frequent = higher weight)
        total = sum(global_counts.values()) + len(POLITICAL_BLOCKS)  # +len to avoid div/0
        weights = []
        for block in unseen_blocks:
            count = global_counts.get(block, 0)
            weight = (total - count) / total  # Higher weight for less common
            weights.append(weight)

        # Weighted random choice from unseen blocks
        return random.choices(unseen_blocks, weights=weights, k=1)[0]

    else:
        # Participant has seen all blocks, use global balancing
        global_counts = await get_global_block_counts(db)

        # Find the least assigned block(s)
        min_count = min(global_counts.values()) if global_counts else 0
        least_assigned = [b for b, c in global_counts.items() if c == min_count]

        return random.choice(least_assigned)


async def get_global_block_counts(db: AsyncSession) -> dict[str, int]:
    """Get count of non-test chats per political block."""
    result = await db.execute(
        select(Chat.political_block, func.count(Chat.id))
        .where(Chat.is_test_mode == False)
        .group_by(Chat.political_block)
    )

    counts = {block: 0 for block in POLITICAL_BLOCKS}
    for block, count in result.all():
        counts[block] = count

    return counts

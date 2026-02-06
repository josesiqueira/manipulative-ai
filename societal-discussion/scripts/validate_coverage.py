#!/usr/bin/env python3
"""
Validate dataset coverage for few-shot prompting.

Checks that we have sufficient examples for each (topic_category × political_block) combination.

Usage:
    python scripts/validate_coverage.py
"""

import argparse
import asyncio
import sys
from pathlib import Path

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent / "apps" / "api"))

from src.database import Base
from src.models import PoliticalStatement


MINIMUM_EXAMPLES = 3  # Minimum needed for few-shot prompting

TOPIC_CATEGORIES = [
    "immigration", "healthcare", "economy", "education",
    "foreign_policy", "environment", "technology", "equality", "social_welfare"
]

POLITICAL_BLOCKS = ["conservative", "red-green", "moderate", "dissatisfied"]


async def validate_coverage(database_url: str, language: str = "all") -> bool:
    """
    Validate dataset coverage and print report.

    Returns True if all combinations have >= MINIMUM_EXAMPLES.
    """

    engine = create_async_engine(database_url, echo=False)
    async_session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with async_session() as session:
        # Get total count
        total_result = await session.execute(select(func.count(PoliticalStatement.id)))
        total = total_result.scalar() or 0

        if total == 0:
            print("ERROR: No statements in database. Run import_dataset.py first.")
            return False

        print(f"=== Coverage Validation Report ===")
        print(f"Total statements: {total}")
        print(f"Language filter: {language}")
        print(f"Minimum required per cell: {MINIMUM_EXAMPLES}")
        print()

        # Build coverage matrix
        matrix: dict[str, dict[str, int]] = {topic: {} for topic in TOPIC_CATEGORIES}
        sparse_combinations = []

        for topic in TOPIC_CATEGORIES:
            for block in POLITICAL_BLOCKS:
                query = select(func.count(PoliticalStatement.id)).where(
                    PoliticalStatement.topic_category == topic,
                    PoliticalStatement.political_block == block,
                )

                # Filter by language if specified
                if language == "fi":
                    query = query.where(PoliticalStatement.final_output_fi.isnot(None))
                elif language == "en":
                    query = query.where(PoliticalStatement.final_output_en.isnot(None))

                result = await session.execute(query)
                count = result.scalar() or 0
                matrix[topic][block] = count

                if count < MINIMUM_EXAMPLES:
                    sparse_combinations.append(f"{topic} × {block}: {count}")

        # Print matrix
        print("Coverage Matrix:")
        print()

        # Header
        header = f"{'topic':<16}"
        for block in POLITICAL_BLOCKS:
            header += f" {block:<12}"
        header += " Total"
        print(header)
        print("-" * len(header))

        # Rows
        for topic in TOPIC_CATEGORIES:
            row = f"{topic:<16}"
            row_total = 0
            for block in POLITICAL_BLOCKS:
                count = matrix[topic][block]
                row_total += count
                marker = " ⚠️" if count < MINIMUM_EXAMPLES else ""
                row += f" {count:<10}{marker}"
            row += f" {row_total}"
            print(row)

        # Column totals
        print("-" * len(header))
        totals_row = f"{'Total':<16}"
        for block in POLITICAL_BLOCKS:
            block_total = sum(matrix[topic][block] for topic in TOPIC_CATEGORIES)
            totals_row += f" {block_total:<12}"
        print(totals_row)

        print()

        # Report sparse combinations
        if sparse_combinations:
            print(f"⚠️  SPARSE COMBINATIONS (< {MINIMUM_EXAMPLES} examples):")
            for combo in sparse_combinations:
                print(f"   - {combo}")
            print()
            print("These combinations will use fallback to same-block examples from other topics.")
            return False
        else:
            print("✅ All combinations have sufficient coverage!")
            return True

    await engine.dispose()


def main():
    parser = argparse.ArgumentParser(description="Validate dataset coverage")
    parser.add_argument(
        "--database-url",
        default="sqlite+aiosqlite:///./societal_discussion.db",
        help="Database URL (default: SQLite)",
    )
    parser.add_argument(
        "--language",
        choices=["all", "en", "fi"],
        default="all",
        help="Filter by language (default: all)",
    )

    args = parser.parse_args()

    is_valid = asyncio.run(validate_coverage(args.database_url, args.language))
    sys.exit(0 if is_valid else 1)


if __name__ == "__main__":
    main()

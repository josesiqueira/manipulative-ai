#!/usr/bin/env python3
"""
Import political statements dataset into the database.

Usage:
    python scripts/import_dataset.py --file data/raw/persuasion_dataset_Unified_EN-3_CLEANED.xlsx
"""

import argparse
import asyncio
import sys
from pathlib import Path

import pandas as pd
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent / "apps" / "api"))

from src.database import Base
from src.models import PoliticalStatement


async def import_dataset(file_path: str, database_url: str) -> None:
    """Import dataset from Excel file into database."""

    # Read Excel file
    print(f"Reading dataset from: {file_path}")
    df = pd.read_excel(file_path)

    print(f"Found {len(df)} rows")
    print(f"Columns: {list(df.columns)}")

    # Validate required columns
    required_columns = ["id", "final_output", "intention_of_statement", "topic_detailed", "topic_category", "political_block"]
    missing = [col for col in required_columns if col not in df.columns]
    if missing:
        print(f"ERROR: Missing required columns: {missing}")
        sys.exit(1)

    # Create database engine
    engine = create_async_engine(database_url, echo=False)
    async_session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    # Create tables
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    # Import statements
    async with async_session() as session:
        # Check for existing data
        result = await session.execute(select(PoliticalStatement).limit(1))
        if result.scalar_one_or_none():
            print("WARNING: Database already contains statements.")
            response = input("Clear existing data and re-import? [y/N]: ")
            if response.lower() != "y":
                print("Aborted.")
                return

            # Clear existing data
            await session.execute(PoliticalStatement.__table__.delete())
            await session.commit()
            print("Cleared existing statements.")

        # Import each row
        imported = 0
        skipped = 0

        for _, row in df.iterrows():
            try:
                # Skip rows with empty text
                if pd.isna(row["final_output"]) or str(row["final_output"]).strip() == "":
                    skipped += 1
                    continue

                statement = PoliticalStatement(
                    external_id=int(row["id"]),
                    final_output_en=str(row["final_output"]).strip(),
                    final_output_fi=None,  # Finnish translations added later
                    intention_of_statement=str(row["intention_of_statement"]).strip(),
                    topic_detailed=str(row["topic_detailed"]).strip(),
                    topic_category=str(row["topic_category"]).strip().lower(),
                    political_block=str(row["political_block"]).strip().lower(),
                )
                session.add(statement)
                imported += 1

            except Exception as e:
                print(f"ERROR on row {row.get('id', '?')}: {e}")
                skipped += 1

        await session.commit()

        print(f"\nImport complete!")
        print(f"  Imported: {imported}")
        print(f"  Skipped: {skipped}")

        # Show summary by block and topic
        print("\n=== Coverage Summary ===")

        for block in ["conservative", "red-green", "moderate", "dissatisfied"]:
            result = await session.execute(
                select(PoliticalStatement).where(PoliticalStatement.political_block == block)
            )
            count = len(result.scalars().all())
            print(f"  {block}: {count}")

    await engine.dispose()


def main():
    parser = argparse.ArgumentParser(description="Import political statements dataset")
    parser.add_argument(
        "--file",
        required=True,
        help="Path to Excel file (e.g., data/raw/persuasion_dataset_Unified_EN-3_CLEANED.xlsx)",
    )
    parser.add_argument(
        "--database-url",
        default="sqlite+aiosqlite:///./societal_discussion.db",
        help="Database URL (default: SQLite)",
    )

    args = parser.parse_args()

    if not Path(args.file).exists():
        print(f"ERROR: File not found: {args.file}")
        sys.exit(1)

    asyncio.run(import_dataset(args.file, args.database_url))


if __name__ == "__main__":
    main()

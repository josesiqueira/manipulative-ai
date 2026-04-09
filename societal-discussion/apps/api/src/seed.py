"""
Dataset seed module — populates the political_statements table from the curated
Excel dataset.

Run with:
    cd apps/api && uv run python -m src.seed

The module is intentionally synchronous in its validation logic (validate_row)
so that unit tests can import and call it without any database or async machinery.
The database writes use SQLAlchemy async, consistent with the rest of the project.

Path resolution: this file lives at apps/api/src/seed.py.  Four .parent jumps
reach the project root (src → api → apps → project root), matching the pattern
used by config.py and scripts/seed_database.py.
"""

import asyncio
import os
from pathlib import Path

import pandas as pd
from dotenv import load_dotenv
from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine

# ---------------------------------------------------------------------------
# Path constants
# ---------------------------------------------------------------------------

# Four levels up: src/ → api/ → apps/ → project root
PROJECT_ROOT = Path(__file__).parent.parent.parent.parent

# Relative dataset path as documented in PLAN.md and STACK.md
DATASET_RELATIVE = Path("data/raw/persuasion_dataset_Unified_EN-3_CLEANED.xlsx")
DATASET_PATH = PROJECT_ROOT / DATASET_RELATIVE

# ---------------------------------------------------------------------------
# Validation constants — the only values accepted by the DB schema
# ---------------------------------------------------------------------------

VALID_BLOCKS: frozenset[str] = frozenset(
    {"conservative", "red-green", "moderate", "dissatisfied"}
)

VALID_TOPIC_CATEGORIES: frozenset[str] = frozenset(
    {
        "immigration",
        "healthcare",
        "economy",
        "education",
        "foreign_policy",
        "environment",
        "technology",
        "equality",
        "social_welfare",
    }
)

# ---------------------------------------------------------------------------
# INSERT statement — ON CONFLICT (external_id) DO NOTHING ensures idempotency:
# re-running the seed never duplicates rows and never errors on conflicts.
# ---------------------------------------------------------------------------

_INSERT_SQL = text(
    """
    INSERT INTO political_statements
        (external_id, final_output_en, final_output_fi,
         intention_of_statement, topic_detailed, topic_category, political_block)
    VALUES
        (:external_id, :final_output_en, NULL,
         :intention_of_statement, :topic_detailed, :topic_category, :political_block)
    ON CONFLICT (external_id) DO NOTHING
    """
)


# ---------------------------------------------------------------------------
# Public validation function (also used by tests/test_seed.py)
# ---------------------------------------------------------------------------


def validate_row(row: dict) -> str | None:
    """Validate a single dataset row.

    Returns an error message string describing the first validation failure
    found, or None when the row is valid.  The caller should treat a non-None
    return value as a reason to skip the row (rejected count).

    Validation rules:
    1. final_output must be a non-empty string (NaN / blank → reject).
    2. political_block must be one of VALID_BLOCKS.
    3. topic_category must be one of VALID_TOPIC_CATEGORIES.
    """
    final_output = row.get("final_output_en")
    if not isinstance(final_output, str) or not final_output.strip():
        return "final_output_en is empty or NaN"

    political_block = row.get("political_block")
    if political_block not in VALID_BLOCKS:
        return f"unknown political_block: {political_block!r}"

    topic_category = row.get("topic_category")
    if topic_category not in VALID_TOPIC_CATEGORIES:
        return f"unknown topic_category: {topic_category!r}"

    return None


# ---------------------------------------------------------------------------
# Dataset loading
# ---------------------------------------------------------------------------


def load_dataset() -> list[dict]:
    """Read the Excel dataset and return a list of normalised row dicts.

    Column mapping (Excel → DB):
        id                   → external_id  (int, dataset's own row ID)
        final_output         → final_output_en
        intention_of_statement → intention_of_statement
        topic_detailed       → topic_detailed
        topic_category       → topic_category
        political_block      → political_block

    final_output_fi is omitted here; the INSERT sets it to NULL.
    """
    df = pd.read_excel(DATASET_PATH, engine="openpyxl")

    rows: list[dict] = []
    for _, excel_row in df.iterrows():
        rows.append(
            {
                "external_id": int(excel_row["id"]),
                "final_output_en": excel_row["final_output"],
                "intention_of_statement": str(excel_row["intention_of_statement"]) if pd.notna(excel_row["intention_of_statement"]) else "",
                "topic_detailed": str(excel_row["topic_detailed"]),
                "topic_category": str(excel_row["topic_category"]).strip(),
                "political_block": str(excel_row["political_block"]).strip(),
            }
        )
    return rows


# ---------------------------------------------------------------------------
# Main async entrypoint
# ---------------------------------------------------------------------------


async def main() -> None:
    """Read, validate, and insert all dataset rows into political_statements.

    Uses INSERT … ON CONFLICT (external_id) DO NOTHING so subsequent runs
    are safe and report the skipped count instead of failing.
    """
    print("=== Dataset Seed ===")
    print(f"Reading dataset from {DATASET_RELATIVE}")

    # Load .env so DATABASE_URL is available when run directly
    load_dotenv(PROJECT_ROOT / ".env")

    database_url = os.environ.get("DATABASE_URL")
    if not database_url:
        raise RuntimeError(
            "DATABASE_URL environment variable is not set. "
            "Ensure .env exists at the project root."
        )

    rows = load_dataset()

    # Validate all rows before touching the DB — collect valid + rejected counts
    valid_rows: list[dict] = []
    rejected = 0
    for row in rows:
        error = validate_row(row)
        if error:
            rejected += 1
            # Log at per-row level only to avoid flooding stdout for large datasets
            print(f"  [REJECTED] external_id={row.get('external_id')}: {error}")
        else:
            valid_rows.append(row)

    print(f"Validated {len(valid_rows)} rows, rejected {rejected}")

    # Write to database — rowcount from RETURNING would require a different query;
    # instead we compare row counts before and after to determine inserted vs skipped.
    engine = create_async_engine(database_url, echo=False)

    try:
        async with engine.begin() as conn:
            # Count existing rows before insert to calculate skipped accurately
            before_result = await conn.execute(
                text("SELECT COUNT(*) FROM political_statements")
            )
            count_before = before_result.scalar() or 0

            # Batch insert — each statement is independent so we loop rather than
            # using executemany, which would require all-or-nothing rollback semantics
            # that conflict with ON CONFLICT DO NOTHING per-row accounting.
            for row in valid_rows:
                await conn.execute(_INSERT_SQL, row)

            after_result = await conn.execute(
                text("SELECT COUNT(*) FROM political_statements")
            )
            count_after = after_result.scalar() or 0

        inserted = count_after - count_before
        skipped = len(valid_rows) - inserted

        print(f"Inserted {inserted} rows, skipped {skipped} (already exist)")

    finally:
        await engine.dispose()


if __name__ == "__main__":
    asyncio.run(main())

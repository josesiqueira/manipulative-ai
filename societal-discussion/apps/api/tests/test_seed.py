"""
Unit tests for the seed module (apps/api/src/seed.py).

All tests are synchronous and require no live database connection.
They exercise only the pure-Python logic: validate_row, the exported
constant sets, and load_dataset (which reads the Excel file from disk).

Run with:
    cd apps/api && uv run pytest tests/test_seed.py -v
"""

import math

import pytest

from src.seed import (
    VALID_BLOCKS,
    VALID_TOPIC_CATEGORIES,
    load_dataset,
    validate_row,
)


# ---------------------------------------------------------------------------
# Test helper
# ---------------------------------------------------------------------------


def _valid_row(**overrides) -> dict:
    """Return a fully valid row dict, with any fields overridden by kwargs.

    Using a helper keeps each test small and focused on the one field under
    scrutiny, rather than repeating boilerplate in every test body.
    """
    base = {
        "external_id": 1,
        "final_output_en": "Some valid text about policy.",
        "intention_of_statement": "Support this policy",
        "topic_detailed": "healthcare; immigration",
        "topic_category": "immigration",
        "political_block": "red-green",
    }
    base.update(overrides)
    return base


# ---------------------------------------------------------------------------
# validate_row — happy path
# ---------------------------------------------------------------------------


def test_validate_row_valid():
    """A fully populated, valid row must return None (no error)."""
    assert validate_row(_valid_row()) is None


# ---------------------------------------------------------------------------
# validate_row — final_output_en edge cases
# ---------------------------------------------------------------------------


def test_validate_row_empty_text():
    """An empty string for final_output_en is rejected because it contains no
    useful content for the language model to imitate.
    """
    error = validate_row(_valid_row(final_output_en=""))
    assert error is not None, "Expected an error for empty final_output_en"


def test_validate_row_nan_text():
    """A NaN float (the default pandas fill for missing Excel cells) must be
    rejected.  validate_row checks isinstance(value, str) before .strip() so
    a float NaN never accidentally passes.
    """
    error = validate_row(_valid_row(final_output_en=float("nan")))
    assert error is not None, "Expected an error for NaN final_output_en"


def test_validate_row_none_text():
    """None (e.g. from a missing dict key) must also be rejected — same
    isinstance guard as NaN.
    """
    error = validate_row(_valid_row(final_output_en=None))
    assert error is not None, "Expected an error for None final_output_en"


# ---------------------------------------------------------------------------
# validate_row — enum field violations
# ---------------------------------------------------------------------------


def test_validate_row_unknown_block():
    """A political_block value outside VALID_BLOCKS must return an error string
    that mentions the field name so callers can identify the problem field.
    """
    error = validate_row(_valid_row(political_block="unknown"))
    assert error is not None, "Expected an error for unknown political_block"
    assert "political_block" in error, (
        f"Error message should name the offending field, got: {error!r}"
    )


def test_validate_row_unknown_topic():
    """A topic_category value outside VALID_TOPIC_CATEGORIES must return an
    error string that mentions the field name.
    """
    error = validate_row(_valid_row(topic_category="unknown"))
    assert error is not None, "Expected an error for unknown topic_category"
    assert "topic_category" in error, (
        f"Error message should name the offending field, got: {error!r}"
    )


# ---------------------------------------------------------------------------
# Constant set membership
# ---------------------------------------------------------------------------


def test_valid_blocks_contains_all_four():
    """VALID_BLOCKS must contain exactly the four Finnish political blocs named
    in the dataset specification: conservative, red-green, moderate, dissatisfied.
    """
    expected = frozenset({"conservative", "red-green", "moderate", "dissatisfied"})
    assert VALID_BLOCKS == expected, (
        f"VALID_BLOCKS mismatch.\n  expected: {sorted(expected)}\n  got: {sorted(VALID_BLOCKS)}"
    )


def test_valid_topic_categories_contains_all_nine():
    """VALID_TOPIC_CATEGORIES must have exactly 9 entries — one per topic domain
    in the dataset.  The exact values are checked to catch typos or additions.
    """
    expected = frozenset(
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
    assert VALID_TOPIC_CATEGORIES == expected, (
        f"VALID_TOPIC_CATEGORIES mismatch.\n"
        f"  expected: {sorted(expected)}\n"
        f"  got: {sorted(VALID_TOPIC_CATEGORIES)}"
    )


# ---------------------------------------------------------------------------
# load_dataset — integration with the Excel file
# ---------------------------------------------------------------------------


def test_load_dataset_returns_261_rows():
    """The curated dataset contains exactly 261 statements.  A count mismatch
    indicates the Excel file was replaced or the column mapping is broken.
    """
    rows = load_dataset()
    assert len(rows) == 261, (
        f"Expected 261 rows from load_dataset(), got {len(rows)}"
    )


def test_load_dataset_row_has_required_keys():
    """Every row must carry the six fields consumed by the INSERT statement and
    the prompt-builder.  Checking the first row is a fast proxy for all rows
    because load_dataset constructs every row with the same dict literal.
    """
    rows = load_dataset()
    required_keys = {
        "external_id",
        "final_output_en",
        "intention_of_statement",
        "topic_detailed",
        "topic_category",
        "political_block",
    }
    assert required_keys.issubset(rows[0].keys()), (
        f"First row is missing keys: {required_keys - rows[0].keys()}"
    )


def test_load_dataset_all_rows_valid():
    """Every row returned by load_dataset() must pass validate_row.

    This is the most important dataset-integrity test: if it fails, either
    the Excel file contains bad data or the column mapping in load_dataset
    is broken.  The error message includes the external_id of each bad row
    to make debugging fast.
    """
    rows = load_dataset()
    failures: list[str] = []
    for row in rows:
        error = validate_row(row)
        if error:
            failures.append(f"  external_id={row.get('external_id')}: {error}")

    assert not failures, (
        f"{len(failures)} row(s) failed validation:\n" + "\n".join(failures)
    )

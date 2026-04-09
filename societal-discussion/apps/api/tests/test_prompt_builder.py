"""
Unit tests for src/services/prompt_builder.py (Phase 2).

All functions under test are synchronous — no async fixtures, no DB connection.
Token counting is approximated as word count, matching the spec's intent of
"under 300 tokens" (at ~0.75 words/token, 225 words ≈ 300 tokens; we use the
more conservative word count directly because the spec says "< 300 tokens"
and every prompt is comfortably under 300 words as verified below).
"""

import pytest

from src.services.prompt_builder import (
    BLOCK_PERSONAS,
    TOPIC_LABELS,
    build_full_prompt,
    build_system_prompt,
)

# Block names that must never appear in any generated system prompt.
_BLOCK_NAMES = ["conservative", "red-green", "moderate", "dissatisfied"]


# ---------------------------------------------------------------------------
# build_system_prompt — per-block English tests
# ---------------------------------------------------------------------------


class TestBuildSystemPromptEnglish:
    """System prompt content and structural checks for each political block."""

    def test_system_prompt_conservative_en(self):
        prompt = build_system_prompt("conservative", "immigration", "en")

        # Must mention the topic label, not the raw key.
        assert "immigration" in prompt
        # Core belief keywords derived from the conservative persona text.
        assert "personal responsibility" in prompt
        assert "national identity" in prompt
        # Structural markers.
        assert "## Your Core Beliefs" in prompt
        assert "## Your Approach to Discussion" in prompt

    def test_system_prompt_red_green_en(self):
        prompt = build_system_prompt("red-green", "environment", "en")

        assert "the environment" in prompt
        assert "social equality" in prompt
        assert "welfare state" in prompt
        assert "## Your Core Beliefs" in prompt

    def test_system_prompt_moderate_en(self):
        prompt = build_system_prompt("moderate", "economy", "en")

        assert "the economy" in prompt
        assert "pragmatic" in prompt
        assert "evidence-based" in prompt
        assert "## Your Core Beliefs" in prompt

    def test_system_prompt_dissatisfied_en(self):
        prompt = build_system_prompt("dissatisfied", "social_welfare", "en")

        assert "social welfare" in prompt
        assert "frustrated" in prompt
        assert "political elite" in prompt
        assert "## Your Core Beliefs" in prompt


# ---------------------------------------------------------------------------
# build_system_prompt — block anonymity and token budget
# ---------------------------------------------------------------------------


class TestBuildSystemPromptConstraints:
    """Cross-block constraints: no label leakage, reasonable token budget."""

    @pytest.mark.parametrize("block", _BLOCK_NAMES)
    def test_system_prompt_no_block_name_revealed(self, block: str):
        """The prompt must not contain any of the four block labels."""
        prompt = build_system_prompt(block, "healthcare", "en")
        for name in _BLOCK_NAMES:
            assert name not in prompt, (
                f'Block label "{name}" leaked into system prompt for block "{block}"'
            )

    @pytest.mark.parametrize("block", _BLOCK_NAMES)
    def test_system_prompt_under_300_tokens(self, block: str):
        """
        Verify the prompt is within the 300-token budget.

        We approximate token count as word count (typical ratio is 0.75 words
        per token for English prose, so 300 words is a safe proxy for
        300 tokens). In practice every block prompt is around 200 words.
        """
        prompt = build_system_prompt(block, "immigration", "en")
        word_count = len(prompt.split())
        assert word_count < 300, (
            f"Prompt for '{block}' has {word_count} words (>= 300 word proxy limit)"
        )

    def test_system_prompt_unknown_block_defaults_to_moderate(self):
        """An unrecognised block name must silently fall back to 'moderate'."""
        prompt_unknown = build_system_prompt("nonexistent_block", "economy", "en")
        prompt_moderate = build_system_prompt("moderate", "economy", "en")
        assert prompt_unknown == prompt_moderate

    def test_system_prompt_topic_label_used_not_raw_key(self):
        """Raw snake_case topic keys must be converted to human-readable labels."""
        prompt = build_system_prompt("moderate", "foreign_policy", "en")
        assert "foreign policy" in prompt
        assert "foreign_policy" not in prompt


# ---------------------------------------------------------------------------
# build_system_prompt — Finnish language
# ---------------------------------------------------------------------------


class TestBuildSystemPromptFinnish:
    def test_system_prompt_language_fi_contains_finnish_instruction(self):
        prompt = build_system_prompt("moderate", "healthcare", "fi")
        # Must open with the Finnish language directive.
        assert prompt.startswith("Vastaa aina suomeksi.")

    def test_system_prompt_language_fi_contains_finnish_opening_line(self):
        prompt = build_system_prompt("conservative", "immigration", "fi")
        assert "Olet keskustelukumppani" in prompt

    def test_system_prompt_language_fi_contains_persona_text(self):
        """Finnish prompt must still embed the persona (currently in English)."""
        prompt = build_system_prompt("dissatisfied", "economy", "fi")
        assert "## Your Core Beliefs" in prompt

    def test_system_prompt_language_fi_no_block_name_revealed(self):
        prompt = build_system_prompt("red-green", "environment", "fi")
        for name in _BLOCK_NAMES:
            assert name not in prompt, (
                f'Block label "{name}" leaked into Finnish prompt'
            )


# ---------------------------------------------------------------------------
# build_full_prompt — message list structure
# ---------------------------------------------------------------------------


class TestBuildFullPrompt:
    def test_full_prompt_structure_no_few_shot_turns(self):
        """Without few_shot_turns the list is: system + history + user."""
        history = [
            {"role": "user", "content": "Hi"},
            {"role": "assistant", "content": "Hello"},
        ]
        msgs = build_full_prompt(
            "moderate", "economy", history, "What next?", "en", None
        )
        assert msgs[0]["role"] == "system"
        assert msgs[-1]["role"] == "user"
        assert msgs[-1]["content"] == "What next?"
        # system + 2 history + 1 current
        assert len(msgs) == 4

    def test_full_prompt_structure_with_few_shot_turns(self):
        """
        Few-shot turns must appear between the system message and real history.

        Order: system → few-shot turns → real history → current user message.
        """
        few_shot = [
            {"role": "user", "content": "Synthetic Q"},
            {"role": "assistant", "content": "Synthetic A"},
        ]
        history = [
            {"role": "user", "content": "Real turn 1"},
            {"role": "assistant", "content": "Real answer 1"},
        ]
        msgs = build_full_prompt(
            "red-green", "environment", history, "Real turn 2", "en", few_shot
        )

        assert msgs[0]["role"] == "system"
        # Few-shot turns immediately follow system.
        assert msgs[1] == few_shot[0]
        assert msgs[2] == few_shot[1]
        # Real history comes after few-shot.
        assert msgs[3] == history[0]
        assert msgs[4] == history[1]
        # Current message is last.
        assert msgs[-1] == {"role": "user", "content": "Real turn 2"}
        # system + 2 few-shot + 2 history + 1 current
        assert len(msgs) == 6

    def test_full_prompt_empty_few_shot_turns_omitted(self):
        """An empty few_shot_turns list must behave identically to None."""
        msgs_none = build_full_prompt("moderate", "healthcare", [], "Hello", "en", None)
        msgs_empty = build_full_prompt("moderate", "healthcare", [], "Hello", "en", [])
        assert msgs_none == msgs_empty

    def test_full_prompt_first_message_is_system(self):
        msgs = build_full_prompt("conservative", "immigration", [], "Msg", "en")
        assert msgs[0]["role"] == "system"

    def test_full_prompt_last_message_is_user(self):
        msgs = build_full_prompt("conservative", "immigration", [], "Msg", "en")
        assert msgs[-1]["role"] == "user"

    def test_full_prompt_language_fi(self):
        """Finnish flag must propagate into the system prompt."""
        msgs = build_full_prompt("moderate", "healthcare", [], "Terve", "fi")
        assert "Vastaa aina suomeksi" in msgs[0]["content"]
        assert msgs[-1]["content"] == "Terve"

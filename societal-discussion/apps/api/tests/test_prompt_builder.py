from src.services.party_grounding import ALL_PARTIES, BASE_PARTIES, is_populist
from src.services.prompt_builder import (
    DEFAULT_SYSTEM_INSTRUCTION,
    POPULISM_MARKERS_SECTION,
    _default_instruction_for,
    build_system_prompt,
)

ANCHOR = "## Poliittiset ohjelmasi ja näkemyksesi"


def test_base_parties_get_the_plain_default():
    for party in BASE_PARTIES:
        assert _default_instruction_for(party) == DEFAULT_SYSTEM_INSTRUCTION


def test_every_populist_party_gets_the_markers_before_the_anchor():
    for party in ALL_PARTIES:
        if not is_populist(party):
            continue
        instr = _default_instruction_for(party)
        assert POPULISM_MARKERS_SECTION in instr
        assert instr.index(POPULISM_MARKERS_SECTION) < instr.index(ANCHOR)
        assert instr.count(ANCHOR) == 1


def test_the_markers_are_identical_for_every_populist_party():
    instructions = {_default_instruction_for(p) for p in ALL_PARTIES if is_populist(p)}
    assert len(instructions) == 1


def test_build_system_prompt_for_populist_twin_ends_with_language_directive():
    prompt = build_system_prompt("kokoomus_populist", language="en")
    assert POPULISM_MARKERS_SECTION in prompt
    assert prompt.rstrip().endswith("only translate the delivery into English.")

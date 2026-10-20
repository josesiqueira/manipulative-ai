from src.services.party_grounding import ALL_PARTIES, LEGACY_PARTIES, is_antipopulist, is_populist
from src.services.prompt_builder import (
    ANTIPOPULISM_MARKERS_SECTION,
    DEFAULT_SYSTEM_INSTRUCTION,
    POPULISM_MARKERS_SECTION,
    _default_instruction_for,
    build_system_prompt,
)

ANCHOR = "## Poliittiset ohjelmasi ja näkemyksesi"


def test_former_standard_ids_get_the_plain_default():
    for party in LEGACY_PARTIES:
        assert _default_instruction_for(party) == DEFAULT_SYSTEM_INSTRUCTION


def test_every_condition_gets_exactly_its_own_markers_before_the_anchor():
    for party in ALL_PARTIES:
        instr = _default_instruction_for(party)
        own, other = (
            (POPULISM_MARKERS_SECTION, ANTIPOPULISM_MARKERS_SECTION)
            if is_populist(party)
            else (ANTIPOPULISM_MARKERS_SECTION, POPULISM_MARKERS_SECTION)
        )
        assert own in instr, party
        assert other not in instr, party
        assert instr.index(own) < instr.index(ANCHOR)
        assert instr.count(ANCHOR) == 1


def test_the_markers_are_identical_within_each_framing():
    assert len({_default_instruction_for(p) for p in ALL_PARTIES if is_populist(p)}) == 1
    assert len({_default_instruction_for(p) for p in ALL_PARTIES if is_antipopulist(p)}) == 1


def test_the_two_blocks_share_one_structure():
    for block in (POPULISM_MARKERS_SECTION, ANTIPOPULISM_MARKERS_SECTION):
        assert block.startswith("## ")
        assert block.count("**") == 6  # three bold dimension headings
        assert "(edunvalvonta)" in block and "(vastuullisuus)" in block and "(legitimiteetti)" in block


def test_build_system_prompt_for_each_framing_ends_with_language_directive():
    for party, block in (("kokoomus_populist", POPULISM_MARKERS_SECTION), ("kokoomus_antipopulist", ANTIPOPULISM_MARKERS_SECTION)):
        prompt = build_system_prompt(party, language="en")
        assert block in prompt
        assert prompt.rstrip().endswith("only translate the delivery into English.")

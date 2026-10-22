from src.services.party_grounding import ALL_PARTIES, LEGACY_PARTIES, is_antipopulist, is_populist
from src.services.prompt_builder import (
    ANTIPOPULISM_MARKERS_SECTION,
    DEFAULT_SYSTEM_INSTRUCTION,
    POPULISM_MARKERS_SECTION,
    _default_instruction_for,
    build_system_prompt,
    framing_section_for,
)
from src.services.party_grounding import load_party_program

ANCHOR = "## Poliittiset ohjelmasi ja näkemyksesi"


def test_every_condition_gets_the_same_instruction():
    for party in ALL_PARTIES + LEGACY_PARTIES:
        assert _default_instruction_for(party) == DEFAULT_SYSTEM_INSTRUCTION


def test_former_standard_ids_get_no_framing():
    for party in LEGACY_PARTIES:
        assert framing_section_for(party) == ""


def test_every_condition_gets_exactly_its_own_markers_after_the_program():
    for party in ALL_PARTIES:
        prompt = build_system_prompt(party)
        own, other = (
            (POPULISM_MARKERS_SECTION, ANTIPOPULISM_MARKERS_SECTION)
            if is_populist(party)
            else (ANTIPOPULISM_MARKERS_SECTION, POPULISM_MARKERS_SECTION)
        )
        assert framing_section_for(party) == own, party
        assert own.rstrip() in prompt, party
        assert other.rstrip() not in prompt, party
        program_end = prompt.index(load_party_program(party).rstrip()) + len(load_party_program(party).rstrip())
        assert prompt.index(own.rstrip()) >= program_end, party
        assert prompt.count(ANCHOR) == 1


def test_the_four_versions_of_a_party_share_the_prefix_up_to_the_end_of_the_program():
    for base in ("kokoomus", "vihreat"):
        prompts = [
            build_system_prompt(f"{base}_{framing}", language=lang)
            for framing in ("populist", "antipopulist")
            for lang in ("fi", "en")
        ]
        prefix = DEFAULT_SYSTEM_INSTRUCTION + load_party_program(f"{base}_populist").rstrip()
        assert all(p.startswith(prefix) for p in prompts)


def test_the_markers_are_identical_within_each_framing():
    assert len({framing_section_for(p) for p in ALL_PARTIES if is_populist(p)}) == 1
    assert len({framing_section_for(p) for p in ALL_PARTIES if is_antipopulist(p)}) == 1


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

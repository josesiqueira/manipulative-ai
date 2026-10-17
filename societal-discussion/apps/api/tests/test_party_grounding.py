from src.services.party_grounding import (
    ALL_PARTIES,
    BASE_PARTIES,
    PARTY_DISPLAY_NAMES,
    PARTY_FILES,
    POPULIST_SUFFIX,
    base_party,
    is_populist,
    load_party_program,
)


def test_nine_base_parties_and_eighteen_conditions():
    assert len(BASE_PARTIES) == 9
    assert len(ALL_PARTIES) == 18
    assert len(set(ALL_PARTIES)) == 18


def test_every_base_party_has_a_populist_twin_on_the_same_corpus():
    for party in BASE_PARTIES:
        twin = party + POPULIST_SUFFIX
        assert twin in ALL_PARTIES
        assert PARTY_FILES[twin] == PARTY_FILES[party]
        assert PARTY_DISPLAY_NAMES[twin] == PARTY_DISPLAY_NAMES[party] + " Populist"


def test_is_populist_and_base_party():
    assert is_populist("sdp_populist") is True
    assert is_populist("sdp") is False
    assert base_party("sdp_populist") == "sdp"
    assert base_party("sdp") == "sdp"


def test_existing_ids_are_unchanged():
    # Data already collected (HEPP 2026) uses these ids; they must not be renamed.
    assert "perussuomalaiset" in ALL_PARTIES
    assert "perussuomalaiset_populist" in ALL_PARTIES
    assert PARTY_DISPLAY_NAMES["perussuomalaiset_populist"] == "Perussuomalaiset Populist"


def test_populist_variant_loads_the_same_text():
    assert load_party_program("liikenyt_populist") == load_party_program("liikenyt")

from src.services.party_grounding import (
    ALL_PARTIES,
    ANTIPOPULIST_SUFFIX,
    BASE_PARTIES,
    LEGACY_PARTIES,
    PARTY_DISPLAY_NAMES,
    PARTY_FILES,
    POPULIST_SUFFIX,
    base_party,
    framing,
    is_antipopulist,
    is_populist,
    load_party_program,
)


def test_nine_base_parties_and_eighteen_conditions():
    assert len(BASE_PARTIES) == 9
    assert len(ALL_PARTIES) == 18
    assert len(set(ALL_PARTIES)) == 18


def test_every_base_party_has_a_populist_and_an_antipopulist_variant_on_the_same_corpus():
    for party in BASE_PARTIES:
        pop, anti = party + POPULIST_SUFFIX, party + ANTIPOPULIST_SUFFIX
        assert pop in ALL_PARTIES and anti in ALL_PARTIES
        assert PARTY_FILES[pop] == PARTY_FILES[anti] == PARTY_FILES[party]
        assert PARTY_DISPLAY_NAMES[pop] == PARTY_DISPLAY_NAMES[party] + " Populist"
        assert PARTY_DISPLAY_NAMES[anti] == PARTY_DISPLAY_NAMES[party] + " Anti-populist"


def test_the_former_standard_ids_are_known_but_never_assigned():
    # Data already collected (HEPP 2026) uses these ids; they must still resolve.
    for party in LEGACY_PARTIES:
        assert party not in ALL_PARTIES
        assert party in PARTY_FILES and party in PARTY_DISPLAY_NAMES
    assert PARTY_DISPLAY_NAMES["perussuomalaiset_populist"] == "Perussuomalaiset Populist"


def test_framing_helpers():
    assert is_populist("sdp_populist") is True
    assert is_populist("sdp_antipopulist") is False
    assert is_populist("sdp") is False
    assert is_antipopulist("sdp_antipopulist") is True
    assert is_antipopulist("sdp_populist") is False
    assert framing("sdp_populist") == "populist"
    assert framing("sdp_antipopulist") == "antipopulist"
    assert framing("sdp") is None
    for p in ("sdp_populist", "sdp_antipopulist", "sdp"):
        assert base_party(p) == "sdp"


def test_both_variants_load_the_same_text():
    assert load_party_program("liikenyt_populist") == load_party_program("liikenyt")
    assert load_party_program("liikenyt_antipopulist") == load_party_program("liikenyt")

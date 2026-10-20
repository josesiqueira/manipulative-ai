"""
Party program grounding service.

Loads full party program text files from `apps/api/src/party_data/` and
provides them for injection into the system prompt. The full text is cached
in memory since the corpus is static and bounded.

Each of the 9 base parties has two variants that read the identical
corpus: a populist one (`<party>_populist`) and an anti-populist one
(`<party>_antipopulist`). The only difference between them is the framing
section added by services/prompt_builder.py: populism markers (us-vs-them,
people-centrism, anti-elitism; Cranmer 2011) or anti-populism markers
(pluralism, pluralist democracy, defence of institutions; Mudde 2004).

The bare `<party>` ids were the standard condition until October 2026. They
stay known (display names, corpus) so earlier data still resolves, but they
are never assigned (`ALL_PARTIES` holds only the 18 framed variants).
"""
from pathlib import Path
from functools import lru_cache

PARTY_DATA_DIR = Path(__file__).parent.parent / "party_data"

POPULIST_SUFFIX = "_populist"
ANTIPOPULIST_SUFFIX = "_antipopulist"

_BASE_PARTY_FILES = {
    "sdp": "SDP_merged-10.txt",
    "vasemmistoliitto": "Vasemmistoliitto_merged-5.txt",
    "vihreat": "Vihreät_merged-6.txt",
    "rkp": "RKP_merged-4.txt",
    "keskusta": "Keskusta_merged-9.txt",
    "kokoomus": "KOKOOMUS_merged-2.txt",
    "perussuomalaiset": "Perussuomalaiset_merged-7.txt",
    "kristillisdemokraatit": "Kristillisdemokraatit_merged-3.txt",
    "liikenyt": "LiikeNyt_merged-8.txt",
}

_BASE_DISPLAY_NAMES = {
    "sdp": "SDP",
    "vasemmistoliitto": "Vasemmistoliitto",
    "vihreat": "Vihreät",
    "rkp": "RKP",
    "keskusta": "Keskusta",
    "kokoomus": "Kokoomus",
    "perussuomalaiset": "Perussuomalaiset",
    "kristillisdemokraatit": "Kristillisdemokraatit",
    "liikenyt": "Liike Nyt",
}

BASE_PARTIES = list(_BASE_PARTY_FILES.keys())

# The 18 assignable conditions: 9 populist, then 9 anti-populist.
ALL_PARTIES = [p + POPULIST_SUFFIX for p in BASE_PARTIES] + [
    p + ANTIPOPULIST_SUFFIX for p in BASE_PARTIES
]

# The former standard condition: known, never assigned.
LEGACY_PARTIES = list(BASE_PARTIES)

PARTY_FILES = {
    **_BASE_PARTY_FILES,
    **{p + POPULIST_SUFFIX: f for p, f in _BASE_PARTY_FILES.items()},
    **{p + ANTIPOPULIST_SUFFIX: f for p, f in _BASE_PARTY_FILES.items()},
}

PARTY_DISPLAY_NAMES = {
    **_BASE_DISPLAY_NAMES,
    **{p + POPULIST_SUFFIX: n + " Populist" for p, n in _BASE_DISPLAY_NAMES.items()},
    **{p + ANTIPOPULIST_SUFFIX: n + " Anti-populist" for p, n in _BASE_DISPLAY_NAMES.items()},
}


def is_populist(party: str) -> bool:
    """True for the populist variant of a base party."""
    return party.endswith(POPULIST_SUFFIX) and not is_antipopulist(party)


def is_antipopulist(party: str) -> bool:
    """True for the anti-populist variant of a base party."""
    return party.endswith(ANTIPOPULIST_SUFFIX)


def framing(party: str) -> str | None:
    """'populist', 'antipopulist', or None for a former standard id."""
    if is_antipopulist(party):
        return "antipopulist"
    if is_populist(party):
        return "populist"
    return None


def base_party(party: str) -> str:
    """Strip the framing suffix; identity for base parties."""
    if is_antipopulist(party):
        return party[: -len(ANTIPOPULIST_SUFFIX)]
    if is_populist(party):
        return party[: -len(POPULIST_SUFFIX)]
    return party


@lru_cache(maxsize=len(PARTY_FILES))
def load_party_program(party: str) -> str:
    """Load the full party program text for a given party."""
    if party not in PARTY_FILES:
        raise ValueError(f"Unknown party: {party}. Must be one of: {list(PARTY_FILES)}")
    file_path = PARTY_DATA_DIR / PARTY_FILES[party]
    if not file_path.exists():
        raise FileNotFoundError(f"Party program file not found: {file_path}")
    return file_path.read_text(encoding="utf-8")


def get_all_party_programs() -> dict[str, str]:
    """Load all party programs. Returns dict of party_id -> full text."""
    return {party: load_party_program(party) for party in ALL_PARTIES}

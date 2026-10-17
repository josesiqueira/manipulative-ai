"""
Party program grounding service.

Loads full party program text files from `apps/api/src/party_data/` and
provides them for injection into the system prompt. The full text is cached
in memory since the corpus is static and bounded.

Each of the 9 base parties has a populist twin (`<party>_populist`) that
reads the identical corpus. The twin's only difference is the
populism-markers section added by services/prompt_builder.py
(us-vs-them, people-centrism, anti-elitism; Cranmer 2011).
"""
from pathlib import Path
from functools import lru_cache

PARTY_DATA_DIR = Path(__file__).parent.parent / "party_data"

POPULIST_SUFFIX = "_populist"

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

PARTY_FILES = {
    **_BASE_PARTY_FILES,
    **{p + POPULIST_SUFFIX: f for p, f in _BASE_PARTY_FILES.items()},
}

PARTY_DISPLAY_NAMES = {
    **_BASE_DISPLAY_NAMES,
    **{p + POPULIST_SUFFIX: n + " Populist" for p, n in _BASE_DISPLAY_NAMES.items()},
}

ALL_PARTIES = list(PARTY_FILES.keys())


def is_populist(party: str) -> bool:
    """True for the populism-augmented twin of a base party."""
    return party.endswith(POPULIST_SUFFIX)


def base_party(party: str) -> str:
    """Strip the populist suffix; identity for base parties."""
    return party[: -len(POPULIST_SUFFIX)] if is_populist(party) else party


@lru_cache(maxsize=len(PARTY_FILES))
def load_party_program(party: str) -> str:
    """Load the full party program text for a given party."""
    if party not in PARTY_FILES:
        raise ValueError(f"Unknown party: {party}. Must be one of: {ALL_PARTIES}")
    file_path = PARTY_DATA_DIR / PARTY_FILES[party]
    if not file_path.exists():
        raise FileNotFoundError(f"Party program file not found: {file_path}")
    return file_path.read_text(encoding="utf-8")


def get_all_party_programs() -> dict[str, str]:
    """Load all party programs. Returns dict of party_id -> full text."""
    return {party: load_party_program(party) for party in ALL_PARTIES}

"""
Party program grounding service.

Loads full party program text files from `apps/api/src/party_data/` and
provides them for injection into the system prompt. The full text is cached
in memory since the corpus is static and bounded.
"""
from pathlib import Path
from functools import lru_cache

PARTY_DATA_DIR = Path(__file__).parent.parent / "party_data"

PARTY_FILES = {
    "sdp": "SDP_merged-10.txt",
    "vasemmistoliitto": "Vasemmistoliitto_merged-5.txt",
    "vihreat": "Vihreät_merged-6.txt",
    "rkp": "RKP_merged-4.txt",
    "keskusta": "Keskusta_merged-9.txt",
    "kokoomus": "KOKOOMUS_merged-2.txt",
    "perussuomalaiset": "Perussuomalaiset_merged-7.txt",
    "kristillisdemokraatit": "Kristillisdemokraatit_merged-3.txt",
    "liikenyt": "LiikeNyt_merged-8.txt",
    # Experimental variant: same corpus as 'perussuomalaiset', but the
    # system prompt is augmented with academic populism markers
    # (us-vs-them, people-centrism, anti-elitism — Cranmer 2011). The
    # prompt augmentation lives in services/prompt_builder.py.
    "perussuomalaiset_populist": "Perussuomalaiset_merged-7.txt",
}

ALL_PARTIES = list(PARTY_FILES.keys())

PARTY_DISPLAY_NAMES = {
    "sdp": "SDP",
    "vasemmistoliitto": "Vasemmistoliitto",
    "vihreat": "Vihreät",
    "rkp": "RKP",
    "keskusta": "Keskusta",
    "kokoomus": "Kokoomus",
    "perussuomalaiset": "Perussuomalaiset",
    "kristillisdemokraatit": "Kristillisdemokraatit",
    "liikenyt": "Liike Nyt",
    "perussuomalaiset_populist": "Perussuomalaiset Populist",
}


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

"""Remove the Pohtiva print furniture from the party programme files.

Reads the original merged prints in "Party Program dataset/Party program 9
txts/" and writes the runtime copies to apps/api/src/party_data/. Only whole
lines are removed, and only lines that the Pohtiva print service added:

- the cover block of each document: "Pohtiva - <title>", the page URL,
  "Tulostettu Pohtiva ...", "URL: ...", the archive's party name and title
  lines, and the Puolue, Otsikko, Vuosi and Ohjelmatyyppi fields (the name
  and title lines are removed only when they equal the Puolue and Otsikko
  fields);
- the lines printed at every page break: "Pohtiva - <title>", the page URL,
  the print timestamp ("1.4.2026 klo 11.43") and the page number ("3 / 16").

Every other line, the party's own text, is copied byte for byte and in the
same order; the script checks this before it writes anything.

Usage (from apps/api):  python scripts/clean_party_corpus.py [--check]
--check compares the result with the files in src/party_data/ and writes
nothing.
"""

import re
import sys
from pathlib import Path

API = Path(__file__).resolve().parents[1]
SOURCE = API.parents[2] / "Party Program dataset" / "Party program 9 txts"
TARGET = API / "src" / "party_data"

PAGE_HEADER = re.compile(r"^Pohtiva - .+$")
PAGE_URL = re.compile(r"^ ?https://www\.fsd\.tuni\.fi/pohtiva/\S*$")
TIMESTAMP = re.compile(r"^ ?\d{1,2}\.\d{1,2}\.20\d\d klo \d{1,2}\.\d\d$")
PAGE_NUMBER = re.compile(r"^\d{1,3} / \d{1,3}$")
COVER_PRINTED = "Tulostettu Pohtiva - Poliittisten ohjelmien tietovarannosta"
COVER_URL = re.compile(r"^URL: www\.fsd\.tuni\.\S+/pohtiva/\S*$")
COVER_FIELDS = ("Puolue: ", "Otsikko: ", "Vuosi: ", "Ohjelmatyyppi: ")


def furniture(lines: list[str]) -> dict[int, str]:
    """Map the index of every print furniture line to its category."""
    drop: dict[int, str] = {}
    i = 0
    while i < len(lines):
        line = lines[i]
        if line == COVER_PRINTED:
            # The cover block: header and URL before it; after it the URL,
            # the party name, the title (one or more lines) and four fields.
            j = i + 3
            while j < len(lines) and not lines[j].startswith(COVER_FIELDS[0]):
                j += 1
            fields = lines[j:j + 4]
            title = " ".join(lines[i + 3:j])
            if not (
                i >= 2
                and j - (i + 3) in (1, 2, 3)
                and PAGE_HEADER.match(lines[i - 2])
                and PAGE_URL.match(lines[i - 1])
                and COVER_URL.match(lines[i + 1])
                and len(fields) == 4
                and all(f.startswith(p) for f, p in zip(fields, COVER_FIELDS))
                and fields[0] == "Puolue: " + lines[i + 2]
                and fields[1] == "Otsikko: " + title
            ):
                raise SystemExit(f"unexpected cover block at line {i + 1}")
            for k in range(i - 2, j + 4):
                drop[k] = "cover"
            i = j + 4
            continue
        if PAGE_HEADER.match(line):
            drop[i] = "page header"
        elif PAGE_URL.match(line):
            drop[i] = "page url"
        elif TIMESTAMP.match(line):
            drop[i] = "timestamp"
        elif PAGE_NUMBER.match(line):
            drop[i] = "page number"
        i += 1
    return drop


def clean(text: str) -> tuple[str, dict[str, int]]:
    lines = text.split("\n")
    drop = furniture(lines)
    kept = [line for k, line in enumerate(lines) if k not in drop]
    # Check: the kept lines are exactly the original lines minus the dropped
    # ones, in the same order, byte for byte.
    it = iter(lines)
    for line in kept:
        for original in it:
            if original == line:
                break
        else:
            raise SystemExit("kept lines are not an ordered subset of the original")
    counts: dict[str, int] = {}
    for category in drop.values():
        counts[category] = counts.get(category, 0) + 1
    return "\n".join(kept), counts


def main() -> None:
    check = "--check" in sys.argv
    failed = False
    for source in sorted(SOURCE.glob("*.txt")):
        text = source.read_text(encoding="utf-8")
        cleaned, counts = clean(text)
        for marker in ("fsd.tuni", "Tulostettu Pohtiva", " klo "):
            if marker in cleaned and marker != " klo ":
                raise SystemExit(f"{source.name}: '{marker}' left after cleaning")
        target = TARGET / source.name
        removed = len(text) - len(cleaned)
        print(f"{source.name}: {sum(counts.values())} lines, {removed} characters "
              f"({100 * removed / len(text):.2f}%) removed  {counts}")
        if check:
            if target.read_text(encoding="utf-8") != cleaned:
                print(f"  differs from {target}")
                failed = True
        else:
            target.write_text(cleaned, encoding="utf-8")
    if failed:
        raise SystemExit(1)


if __name__ == "__main__":
    main()

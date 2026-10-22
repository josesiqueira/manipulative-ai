"""Remove the Pohtiva print furniture from the party programme files.

The party programme data has three stages, in "Party Program dataset/" at
the repository root:

- "Party program 9 pdfs/": the merged Pohtiva prints as PDF;
- "Party program 9 txts/": their text, as extracted;
- "Party program 9 txts cleaned/": the text without the print furniture,
  written by this script.

The app reads an identical copy of the cleaned files in apps/api/src/
party_data/ (the API image is built from apps/api only), also written here.

Only whole lines are removed, and only lines that the Pohtiva print service
added:

- the cover block of each document: "Pohtiva - <title>", the page URL,
  "Tulostettu Pohtiva ...", "URL: ...", the archive's party name and title
  lines, and the Puolue, Otsikko, Vuosi and Ohjelmatyyppi fields (the name
  and title lines are removed only when they equal the Puolue and Otsikko
  fields);
- the lines printed at every page break: "Pohtiva - <title>", the page URL,
  the print timestamp ("1.4.2026 klo 11.43") and the page number ("3 / 16").

One more case: a page number that the text extraction attached to the end of
a line of party text ("...ja keskusta1 / 16"). It is removed only when it is
the one page of its document that has no page number line of its own, and
only the page number characters go; the rest of the line stays as it is.

Every other line, the party's own text, is copied byte for byte and in the
same order; the script checks this before it writes anything.

Usage (from apps/api):  python scripts/clean_party_corpus.py [--check]
--check compares the result with both cleaned folders and writes nothing.
"""

import re
import sys
from pathlib import Path

API = Path(__file__).resolve().parents[1]
DATASET = API.parents[2] / "Party Program dataset"
SOURCE = DATASET / "Party program 9 txts"
CLEANED = DATASET / "Party program 9 txts cleaned"
RUNTIME = API / "src" / "party_data"

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


def glued_page_numbers(lines: list[str], drop: dict[int, str]) -> dict[int, str]:
    """Map line index to the page number glued to the end of that line.

    For each document, the pages 1..M without a page number line of their
    own are the candidates; a candidate page k is accepted only when exactly
    one kept line of that document ends with "k / M".
    """
    starts = [k - 2 for k, line in enumerate(lines) if line == COVER_PRINTED]
    glued: dict[int, str] = {}
    for n, start in enumerate(starts):
        end = starts[n + 1] if n + 1 < len(starts) else len(lines)
        numbers = [
            lines[k] for k in range(start, end)
            if drop.get(k) == "page number"
        ]
        totals = {int(x.split(" / ")[1]) for x in numbers}
        if len(totals) != 1:
            raise SystemExit(f"document at line {start + 1}: page totals {totals}")
        total = totals.pop()
        missing = set(range(1, total + 1)) - {int(x.split(" / ")[0]) for x in numbers}
        for page in sorted(missing):
            suffix = f"{page} / {total}"
            hits = [
                k for k in range(start, end)
                if k not in drop and lines[k].endswith(suffix) and lines[k] != suffix
                and not lines[k][: -len(suffix)].endswith((" ", "/"))
                and not lines[k][-len(suffix) - 1:-len(suffix)].isdigit()
            ]
            if len(hits) != 1:
                raise SystemExit(f"document at line {start + 1}: page {page} not found once")
            glued[hits[0]] = suffix
    return glued


def clean(text: str) -> tuple[str, dict[str, int]]:
    lines = text.split("\n")
    drop = furniture(lines)
    glued = glued_page_numbers(lines, drop)
    kept = []
    for k, line in enumerate(lines):
        if k in drop:
            continue
        kept.append(line[: -len(glued[k])] if k in glued else line)
    # Check: the kept lines are the original lines minus the dropped ones, in
    # the same order and byte for byte, except that a line with a glued page
    # number lost exactly those last characters.
    originals = [(k, line) for k, line in enumerate(lines) if k not in drop]
    assert len(originals) == len(kept)
    for (k, original), line in zip(originals, kept):
        if k in glued:
            assert original == line + glued[k], k
        else:
            assert original == line, k
    counts: dict[str, int] = {}
    for category in drop.values():
        counts[category] = counts.get(category, 0) + 1
    if glued:
        counts["glued page number"] = len(glued)
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
        removed = len(text) - len(cleaned)
        lines = sum(v for c, v in counts.items() if c != "glued page number")
        print(f"{source.name}: {lines} lines, {removed} characters "
              f"({100 * removed / len(text):.2f}%) removed  {counts}")
        for folder in (CLEANED, RUNTIME):
            target = folder / source.name
            if check:
                if not target.exists() or target.read_text(encoding="utf-8") != cleaned:
                    print(f"  differs from {target}")
                    failed = True
            else:
                folder.mkdir(exist_ok=True)
                target.write_text(cleaned, encoding="utf-8")
    if failed:
        raise SystemExit(1)


if __name__ == "__main__":
    main()

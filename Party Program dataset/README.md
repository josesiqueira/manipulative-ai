# Party Program dataset

The party programmes that ground the chatbot: one file per party, nine
parties. Each party's documents were downloaded as PDF prints from
[Pohtiva](https://www.fsd.tuni.fi/pohtiva/), the archive of Finnish political
programmes kept by the Finnish Social Science Data Archive (FSD), and merged
into one PDF per party.

## Three stages

| Folder | What it holds | Changed by this project? |
|---|---|---|
| `Party program 9 pdfs/` | The merged PDFs, as received (made with PDF24) | No |
| `Party program 9 txts/` | The text extracted from those PDFs | No |
| `Party program 9 txts cleaned/` | The text without print furniture and without one duplicated document: what the bot reads | Made by a script, see below |

The API reads byte-identical copies of the cleaned files in
`societal-discussion/apps/api/src/party_data/`, because its container image
is built from `societal-discussion/apps/api/` only.

## How the cleaned files are made

`societal-discussion/apps/api/scripts/clean_party_corpus.py` builds both
cleaned folders from `Party program 9 txts/`:

```bash
cd societal-discussion/apps/api
python scripts/clean_party_corpus.py           # write both cleaned folders
python scripts/clean_party_corpus.py --check   # verify them, write nothing
```

The rule is that the parties' own words never change. The script removes
only the following, and nothing else:

1. **Pohtiva cover block** at the start of every document: the line
   "Pohtiva - title", the archive URL, "Tulostettu Pohtiva - Poliittisten
   ohjelmien tietovarannosta", "URL: ...", the archive's party name and title
   lines, and the fields Puolue, Otsikko, Vuosi and Ohjelmatyyppi. The name
   and title lines are removed only when they equal the Puolue and Otsikko
   fields.
2. **Page break lines** printed by Pohtiva on every page: "Pohtiva - title",
   the page URL, the print time (for example "1.4.2026 klo 11.43") and the
   page number (for example "3 / 16"). Whole lines only.
3. **One page number attached to a line of party text** by the text
   extraction: "1 / 16" at the end of "...SDP SAK:n ja keskusta1 / 16" in
   Liike Nyt's 2023 election programme. The rule accepts only a page that is
   missing from its document's page sequence and found at the end of exactly
   one line; only those six characters are removed.
4. **One duplicated document** (RKP only, see below).

Before writing, the script checks that every kept line is the original
line, byte for byte and in the original order (the one line in step 3 lost
exactly its page number), and that the duplicated block matches its listing.

| Party file | Documents | PDF pages | Lines removed | Characters removed | Bytes before | Bytes after |
|---|---:|---:|---:|---:|---:|---:|
| KOKOOMUS_merged-2 | 7 | 64 | 312 | 11,879 (6.3 %) | 196,672 | 184,779 |
| Keskusta_merged-9 | 5 | 82 | 368 | 14,374 (6.3 %) | 238,594 | 224,146 |
| Kristillisdemokraatit_merged-3 | 4 | 79 | 348 | 13,185 (5.2 %) | 264,862 | 251,455 |
| LiikeNyt_merged-8 | 3 | 22 | 111, plus one page number | 3,765 (6.3 %) | 62,360 | 58,589 |
| Perussuomalaiset_merged-7 | 10 | 153 | 692 | 27,419 (5.4 %) | 524,385 | 496,867 |
| RKP_merged-4 | 4 + 1 | 73 | 220, plus 653 of the duplicate | 32,062 (18.1 %) | 185,945 | 152,784 |
| SDP_merged-10 | 5 | 90 | 400 | 15,939 (5.6 %) | 294,809 | 278,847 |
| Vasemmistoliitto_merged-5 | 5 | 124 | 536 | 20,989 (4.9 %) | 446,107 | 425,069 |
| Vihreät_merged-6 | 11 | 211 | 933 | 36,010 (5.5 %) | 687,604 | 651,383 |

## The RKP duplicate

`RKP_merged-4.pdf` holds four Pohtiva prints (pages 1 to 47) and then
"RKP:n puolueohjelma 2025", which was added to the merge without a Pohtiva
print cover, **twice**:

| | PDF pages | Page size and fonts | Lines in the cleaned file before removal | What it is |
|---|---|---|---|---|
| Copy A, kept | 48 to 57 | A4, Arial and Times | 1600 to 1974 (375 lines) | The programme as a plain document, with the line "Hyväksytty puoluekokouksessa Vaasassa 15.6.2025" |
| Copy B, removed | 58 to 73 | A5, Myriad Pro, Minion Pro and Surveyor | 1975 to 2627 (653 lines) | The same programme as RKP's designed brochure, with its own cover, contents page and page numbers 2 to 16 |

The change of page size and fonts at page 58 shows two versions of the same
programme merged one after the other. Three independent checks on
22 October 2026 found:

- **No party words are lost.** Every sentence of copy B is in copy A, in
  the same order; both have the same seven chapters and 93 bullets. The
  brochure pages, rendered as images, hold no captions, tables or quote
  boxes beyond the text, only photographs and the logo. Copy A also has the
  adoption line, which copy B lacks.
- **Copy A is the cleaner text.** It equals the PDF text of pages 48 to 57
  line for line. Copy B has 154 words split by a hyphen at line ends, two
  split without one, bullets separated from their items, page number lines,
  a contents page, "panostettun" for "panostettu" and four missing full
  stops. Copy B is better in one place only: the full stop after
  "rikokseen", which copy A lacks.
- **No other accidental repeats.** The other repeated passages in the RKP
  file are the party reusing its own text in two genuine documents (the
  introduction "LUOMME HYVÄN ARJEN YHDESSÄ" in both 2025 regional and
  municipal election programmes, one list item in both, and one goal stated
  twice in the 2023 programme). They stay.

The removed block is listed in the script (`DUPLICATES`) with its first
line ("RKP:NPUOLUEOHJELMA"), last line ("16"), line count (653) and SHA-256
(`427d3c6e4b8f634e845ee42d26d871514f1360f0d34a33d3e90feba48c2fa598`, of the
lines joined with "\n", without the final newline). The script removes it
only when all four match. The cleaned RKP file has 1,974 lines, 152,784
bytes and SHA-256
`5401774e23e46b1fb93198f88d97c6bee8cbff757e3bc7efb3698a0b15452904`.

## Left as it is

These are in the parties' own text and are not changed:

- **Party names, titles, slogans and signatures** (for example "RKP
  HALUAA", "Keskustan tavoitteet", leaders' names). The bot's instruction
  tells it never to name the party it speaks for.
- **Characters lost in the PDF text extraction**: some words have the
  replacement character U+FFFD where the PDF had an "fi" or "fl" ligature
  (for example "katastro�a" for "katastrofia").
- **The parties' own contents pages, tables and repeated passages.**

Until 22 October 2026, and in the HEPP2026 release, the bot read the
extracted text in `Party program 9 txts/` as it is.

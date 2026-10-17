"""
Align whisper's recognised words to the sentence that was actually
synthesised, so the lip-sync gets the script's own words with one start time
and duration each. Whisper may split, merge, miss or invent words; matched
words take whisper's times and the rest are spread evenly between their
neighbours (or across the whole clip when nothing matched).
"""
from __future__ import annotations

import difflib
import re

_strip = re.compile(r"[^\w]+", re.UNICODE)


def _norm(word: str) -> str:
    return _strip.sub("", word).lower()


def align_words(
    script: str,
    recognised: list[tuple[str, float, float]],
    total_seconds: float,
) -> tuple[list[str], list[int], list[int]]:
    """Return (words, start_ms, duration_ms) for every word of the script."""
    words = script.split()
    if not words:
        return [], [], []
    total_ms = max(int(total_seconds * 1000), 1)

    starts: list[int | None] = [None] * len(words)
    ends: list[int | None] = [None] * len(words)
    a = [_norm(w) for w in words]
    b = [_norm(w) for (w, _, _) in recognised]
    matcher = difflib.SequenceMatcher(a=a, b=b, autojunk=False)
    for block in matcher.get_matching_blocks():
        for k in range(block.size):
            i, j = block.a + k, block.b + k
            if a[i]:
                starts[i] = int(recognised[j][1] * 1000)
                ends[i] = int(recognised[j][2] * 1000)

    # Fill the gaps: walk runs of unknown words and spread them evenly between
    # the previous known end and the next known start.
    i = 0
    n = len(words)
    while i < n:
        if starts[i] is not None:
            i += 1
            continue
        j = i
        while j < n and starts[j] is None:
            j += 1
        left = ends[i - 1] if i > 0 and ends[i - 1] is not None else 0
        right = starts[j] if j < n and starts[j] is not None else total_ms
        if right <= left:
            right = min(total_ms, left + 200 * (j - i))
        step = (right - left) / (j - i)
        for k in range(i, j):
            starts[k] = int(left + (k - i) * step)
            ends[k] = int(left + (k - i + 1) * step)
        i = j

    # Monotonic and inside the clip.
    out_starts: list[int] = []
    out_durations: list[int] = []
    last = 0
    for s, e in zip(starts, ends):
        s_i = max(int(s or 0), last)
        e_i = max(int(e or 0), s_i + 40)
        s_i = min(s_i, total_ms)
        e_i = min(e_i, total_ms) if e_i > s_i else s_i + 40
        out_starts.append(s_i)
        out_durations.append(max(e_i - s_i, 40))
        last = s_i
    return words, out_starts, out_durations

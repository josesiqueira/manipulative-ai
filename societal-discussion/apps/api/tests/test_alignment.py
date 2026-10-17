from src.services.speech.alignment import align_words


def test_exact_match_takes_whisper_times():
    rec = [("Hyvää", 0.1, 0.5), ("iltaa", 0.55, 0.9), ("ja", 0.95, 1.05), ("tervetuloa", 1.1, 1.8)]
    words, starts, durs = align_words("Hyvää iltaa ja tervetuloa.", rec, 2.0)
    assert words == ["Hyvää", "iltaa", "ja", "tervetuloa."]
    assert starts == [100, 550, 950, 1100]
    assert durs == [400, 350, 100, 700]


def test_missing_and_invented_words_are_spread_between_neighbours():
    rec = [("Hyvää", 0.1, 0.5), ("öö", 0.5, 0.6), ("tervetuloa", 1.1, 1.8)]
    words, starts, durs = align_words("Hyvää iltaa ja tervetuloa", rec, 2.0)
    assert words == ["Hyvää", "iltaa", "ja", "tervetuloa"]
    assert starts[0] == 100 and starts[3] == 1100
    assert 500 <= starts[1] < starts[2] < 1100
    assert all(d >= 40 for d in durs)


def test_nothing_recognised_spreads_over_the_clip():
    words, starts, durs = align_words("Kyllä.", [], 0.6)
    assert words == ["Kyllä."]
    assert starts == [0]
    assert durs == [600]


def test_numbers_and_punctuation_do_not_break_the_count():
    rec = [("Vuonna", 0.0, 0.4), ("kaksituhattakaksikymmentäkuusi", 0.4, 1.9), ("verot", 2.0, 2.4), ("laskevat", 2.4, 3.0)]
    words, starts, durs = align_words("Vuonna 2026 verot laskevat!", rec, 3.1)
    assert len(words) == len(starts) == len(durs) == 4
    assert starts == sorted(starts)
    assert starts[-1] + durs[-1] <= 3100


def test_empty_script():
    assert align_words("", [], 1.0) == ([], [], [])

from src.services.session_code import format_session_code, session_id_prefix_from_code


def test_format_takes_first_eight_hex_chars_uppercase_in_two_groups():
    assert format_session_code("3f2a9c11-aaaa-bbbb-cccc-dddddddddddd") == "3F2A-9C11"


def test_parse_accepts_hyphen_space_and_case_variants():
    assert session_id_prefix_from_code("3F2A-9C11") == "3f2a9c11"
    assert session_id_prefix_from_code("3f2a 9c11") == "3f2a9c11"
    assert session_id_prefix_from_code("3f2a9c11") == "3f2a9c11"


def test_parse_rejects_garbage():
    assert session_id_prefix_from_code("") is None
    assert session_id_prefix_from_code("ZZZZ-9C11") is None
    assert session_id_prefix_from_code("3f2a9c1") is None

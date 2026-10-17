"""
Session codes shown on the thank-you page.

A participant has no account, so the first 8 hex characters of the session
UUID, shown as XXXX-XXXX, are the only handle they can quote later when they
ask us to show or delete their data. 32 bits is enough to be unique among the
few hundred sessions a demo produces; the admin lookup returns every match.
"""
import re

_CODE_RE = re.compile(r"^[0-9a-f]{8}$")


def format_session_code(session_id: str) -> str:
    raw = session_id.replace("-", "")[:8].upper()
    return f"{raw[:4]}-{raw[4:]}"


def session_id_prefix_from_code(code: str) -> str | None:
    raw = re.sub(r"[\s-]", "", code or "").lower()
    return raw if _CODE_RE.fullmatch(raw) else None

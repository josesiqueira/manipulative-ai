from src.services.party_grounding import ALL_PARTIES, is_populist
from src.services.prompt_builder import POPULISM_MARKERS_SECTION

HEADERS = {"X-Admin-Password": "admin"}


async def test_admin_prompt_list_shows_all_eighteen_conditions(client):
    res = await client.get("/api/admin/prompts", headers=HEADERS)
    assert res.status_code == 200
    rows = res.json()
    assert [r["party"] for r in rows] == ALL_PARTIES
    for row in rows:
        has_markers = POPULISM_MARKERS_SECTION in row["system_instruction"]
        assert has_markers == is_populist(row["party"]), row["party"]
        assert row["source"] == "default"
    assert {r["party_display_name"] for r in rows if is_populist(r["party"])} == {
        n for n in (r["party_display_name"] for r in rows) if n.endswith(" Populist")
    }

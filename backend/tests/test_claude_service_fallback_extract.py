from app.services.claude_service import _fallback_extract_biomarkers


def test_fallback_extract_supports_cyrillic_lines():
    text = """
    Гемоглобин 136 г/л 120-160
    Ферритин: 18 нг/мл (30-150)
    Vitamin D 25.4 ng/mL 30-100
    """.strip()

    rows = _fallback_extract_biomarkers(text)
    names = {row["name"] for row in rows}

    assert "Гемоглобин" in names
    assert "Ферритин" in names
    assert "Vitamin D" in names

    ferritin = next(row for row in rows if row["name"] == "Ферритин")
    assert ferritin["value"] == 18.0
    assert ferritin["ref_low"] == 30.0
    assert ferritin["ref_high"] == 150.0

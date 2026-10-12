from app.services.claude_pdf_analyzer import reconstruct_column_major_biomarkers
from app.services.analysis_candidates import build_candidate_payloads


COLUMN_MAJOR_FIXTURE = """
Показник
Аланінамінотрансфераза (АЛТ)
Альбумін
Аспартатамінотрансфераза (АСТ)
Білок загальний
Білірубін загальний
Білірубін прямий
Гамма-глутаматтрансфераза (ГГТ)
Фосфатаза лужна
Результат
17.34
46.49
19.52
78.28
12.57
2.47
12.11
43.89
Одиниці вимірювання
Од/л
г/л
Од/л
г/л
мкмоль/л
мкмоль/л
U/l
Од/л
Референтні значення
3-35
35-52
3-35
66-83
5.0-21
0.34-3.4
0-38
30-120
"""


def test_column_major_fallback_pairs_by_table_order():
    result = reconstruct_column_major_biomarkers(COLUMN_MAJOR_FIXTURE)

    assert [(item["source_name"], item["value"], item["unit"], item["reference_range"]) for item in result] == [
        ("Аланінамінотрансфераза (АЛТ)", 17.34, "Од/л", "3-35"),
        ("Альбумін", 46.49, "г/л", "35-52"),
        ("Аспартатамінотрансфераза (АСТ)", 19.52, "Од/л", "3-35"),
        ("Білок загальний", 78.28, "г/л", "66-83"),
        ("Білірубін загальний", 12.57, "мкмоль/л", "5.0-21"),
        ("Білірубін прямий", 2.47, "мкмоль/л", "0.34-3.4"),
        ("Гамма-глутаматтрансфераза (ГГТ)", 12.11, "U/l", "0-38"),
        ("Фосфатаза лужна", 43.89, "Од/л", "30-120"),
    ]
    assert all(item["_extraction_source"] == "deterministic_parser_column_major" for item in result)
    candidates = build_candidate_payloads(
        biomarkers=result,
        source="deterministic_parser_column_major",
    )
    assert candidates[0]["raw_name"] == "Аланінамінотрансфераза (АЛТ)"
    assert candidates[0]["raw_value"] == 17.34
    assert candidates[0]["raw_unit"] == "Од/л"
    assert candidates[0]["raw_reference_range"] == "3-35"


def test_ambiguous_column_major_input_fails_closed():
    ambiguous = COLUMN_MAJOR_FIXTURE.replace("43.89\n", "")

    assert reconstruct_column_major_biomarkers(ambiguous) == []


def test_row_major_text_is_not_reinterpreted_as_column_major():
    row_major = """
    Показник | Результат | Одиниці вимірювання | Референтні значення
    ALT | 17.34 | U/L | 3-35
    Albumin | 46.49 | g/L | 35-52
    """

    assert reconstruct_column_major_biomarkers(row_major) == []

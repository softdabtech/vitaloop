from datetime import date

from app.services.lab_date_extraction import extract_date_bearing_snippets, extract_lab_dates


def test_extract_lab_dates_from_english_collection_label():
    result = extract_lab_dates(
        """
        Patient: Example
        Date collected: 08/14/2026
        Ferritin 22 ng/mL 30-150
        """
    )

    assert result.test_date == "2026-08-14"
    assert result.collected_at == "2026-08-14"
    assert result.date_source == "extracted_collected_at"
    assert result.date_confidence == "high"


def test_extract_lab_dates_from_ukrainian_test_label():
    result = extract_lab_dates(
        """
        Дата дослідження: 09.07.2026
        Гемоглобін 130 г/л
        """
    )

    assert result.test_date == "2026-07-09"
    assert result.date_source == "extracted_test_date"
    assert result.date_confidence == "high"


def test_extract_lab_dates_uses_reported_date_as_explicit_fallback():
    result = extract_lab_dates("Date reported: 2026-07-10\nFerritin 22 ng/mL")

    assert result.test_date == "2026-07-10"
    assert result.reported_at == "2026-07-10"
    assert result.date_source == "extracted_reported_at"
    assert result.date_confidence == "high"


def test_extract_lab_dates_from_svetlana_style_order_done_result_labels():
    result = extract_lab_dates(
        """
        Гілевич Світлана Сергіївна
        Дата народження: 14.04.1985
        Дата замов./Order date: 12.09.2025
        Дата видачі/Result date: 12.09.2025
        Дата виконання/Done date: 12.09.2025
        Гемоглобін 132 г/л
        """
    )

    assert result.test_date == "2025-09-12"
    assert result.date_source == "extracted_order_date"
    assert result.date_confidence == "high"
    assert "Order date" in (result.date_raw_text or "")


def test_extract_lab_dates_from_ukrainian_label_with_date_on_next_line():
    result = extract_lab_dates(
        """
        Бомбела Демид Алексеевич
        Дата замовлення:
        05.08.2026 09:09
        Дата народження:
        26.10.2018
        Ретикулоцити 1.22 %
        """
    )

    assert result.test_date == "2026-08-05"
    assert result.date_source == "extracted_order_date"
    assert result.date_confidence == "high"
    assert "Дата замовлення" in (result.date_raw_text or "")


def test_extract_lab_dates_prefers_order_date_over_result_and_done_dates():
    result = extract_lab_dates(
        """
        Result date: 2025-09-14
        Done date: 2025-09-13
        Order date: 2025-09-12
        """
    )

    assert result.test_date == "2025-09-12"
    assert result.date_source == "extracted_order_date"


def test_extract_lab_dates_does_not_use_birth_date_as_lab_date():
    result = extract_lab_dates(
        """
        Patient: Example
        Date of birth: 2016-04-14
        Ferritin 22 ng/mL
        """
    )

    assert result.test_date is None
    assert result.date_source == "missing"


def test_extract_date_bearing_snippets_keeps_source_lines_for_backfill():
    snippets = extract_date_bearing_snippets(
        """
        Patient: Example
        Date of birth: 2016-04-14
        Дата замов./Order date: 12.09.2025
        Дата виконання/Done date: 12.09.2025
        Ferritin 22 ng/mL
        """
    )

    assert any("Order date" in item for item in snippets)
    assert any("Done date" in item for item in snippets)


def test_extract_lab_dates_keeps_missing_without_created_at_substitution():
    result = extract_lab_dates("Ferritin 22 ng/mL 30-150")

    assert result.test_date is None
    assert result.collected_at is None
    assert result.reported_at is None
    assert result.date_source == "missing"
    assert result.date_confidence == "low"


def test_extract_lab_dates_user_provided_wins():
    result = extract_lab_dates(
        "Date reported: 2026-07-10",
        user_provided_test_date=date(2026, 7, 9),
    )

    assert result.test_date == "2026-07-09"
    assert result.date_source == "user_provided"
    assert result.date_confidence == "high"

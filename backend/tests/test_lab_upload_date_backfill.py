from app.services.lab_upload_date_backfill import (
    build_lab_upload_date_backfill_decision,
    summarize_lab_date_backfill,
)


def test_backfill_decision_extracts_collection_date_from_stored_text_only():
    decision = build_lab_upload_date_backfill_decision(
        {
            "id": "upload-1",
            "created_at": "2026-08-26T12:00:00Z",
            "extracted_text": "Patient\nDate collected: 08/14/2026\nFerritin 22 ng/mL",
        }
    )

    assert decision.action == "update"
    assert decision.patch == {
        "test_date": "2026-08-14",
        "collected_at": "2026-08-14",
        "date_source": "extracted_collected_at",
        "date_confidence": "high",
        "date_raw_text": "Date collected: 08/14/2026",
    }


def test_backfill_decision_does_not_use_created_at_when_text_has_no_date():
    decision = build_lab_upload_date_backfill_decision(
        {
            "id": "upload-2",
            "created_at": "2026-08-26T12:00:00Z",
            "extracted_text": "Ferritin 22 ng/mL reference 30-150",
        }
    )

    assert decision.action == "skipped"
    assert decision.reason == "date_not_found_in_stored_text"
    assert decision.patch == {"date_source": "missing", "date_confidence": "low"}


def test_backfill_decision_skips_when_original_text_is_not_available():
    decision = build_lab_upload_date_backfill_decision(
        {
            "id": "upload-3",
            "created_at": "2026-08-26T12:00:00Z",
            "extracted_text": "",
        }
    )

    assert decision.action == "skipped"
    assert decision.reason == "unrestorable_without_manual_date"
    assert decision.patch == {}


def test_backfill_decision_reads_nested_document_text_excerpt_json():
    decision = build_lab_upload_date_backfill_decision(
        {
            "id": "upload-4",
            "extracted_text": '{"analysis":{"document_text_excerpt":"Дата дослідження: 09.07.2026\\nГемоглобін 130 г/л"}}',
        }
    )

    assert decision.action == "update"
    assert decision.patch["test_date"] == "2026-07-09"
    assert decision.patch["date_source"] == "extracted_test_date"


def test_backfill_decision_reads_svetlana_style_date_snippets_json():
    decision = build_lab_upload_date_backfill_decision(
        {
            "id": "upload-5",
            "extracted_text": (
                '{"date_bearing_snippets":["Дата замов./Order date: 12.09.2025",'
                '"Дата видачі/Result date: 12.09.2025",'
                '"Дата виконання/Done date: 12.09.2025"],'
                '"analysis_metadata":{"source_text_retained":true}}'
            ),
        }
    )

    assert decision.action == "update"
    assert decision.patch == {
        "test_date": "2025-09-12",
        "date_source": "extracted_order_date",
        "date_confidence": "high",
        "date_raw_text": "Дата замов./Order date: 12.09.2025",
    }


def test_backfill_update_patch_contains_only_date_metadata_fields():
    decision = build_lab_upload_date_backfill_decision(
        {"id": "upload-6", "extracted_text": "Order date: 2025-09-12\nFerritin 22"}
    )

    assert decision.action == "update"
    assert set(decision.patch) <= {
        "test_date",
        "collected_at",
        "reported_at",
        "date_source",
        "date_confidence",
        "date_raw_text",
    }


def test_backfill_summary_counts_unique_dates_and_undated():
    decisions = [
        build_lab_upload_date_backfill_decision(
            {"id": "u1", "extracted_text": "Date collected: 2026-08-14"}
        ),
        build_lab_upload_date_backfill_decision(
            {"id": "u2", "extracted_text": "Дата дослідження: 14.08.2026"}
        ),
        build_lab_upload_date_backfill_decision({"id": "u3", "extracted_text": "Ferritin 22"}),
    ]

    summary = summarize_lab_date_backfill(decisions)

    assert summary["uploads_scanned"] == 3
    assert summary["uploads_with_test_date"] == 2
    assert summary["unique_lab_dates"] == 1
    assert summary["lab_dates"] == ["2026-08-14"]
    assert summary["undated"] == 1

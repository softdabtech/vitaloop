from app.services.trend_engine import evaluate_biomarker_trends


def test_evaluate_biomarker_trends_detects_priority_change():
    result = evaluate_biomarker_trends(
        current_biomarkers=[
            {
                "name": "Ferritin",
                "canonical_name": "canonical_ferritin",
                "value": 18,
                "unit": "ng/mL",
                "status": "DEFICIENT",
            }
        ],
        historical_biomarkers=[
            {
                "upload_id": "old-upload",
                "name": "Ferritin",
                "value": 42,
                "unit": "ng/mL",
                "status": "OPTIMAL",
                "created_at": "2026-01-01T00:00:00Z",
            }
        ],
    )

    assert result["version"] == "trend_engine_v1"
    assert result["available"] is True
    trend = result["trends"][0]
    assert trend["canonical_name"] == "canonical_ferritin"
    assert trend["direction"] == "falling"
    assert trend["percent_change"] == -57.14
    assert trend["interpretation"] == "watch_closely"
    assert result["priority_changes"][0]["canonical_name"] == "canonical_ferritin"


def test_evaluate_biomarker_trends_excludes_current_upload():
    result = evaluate_biomarker_trends(
        current_biomarkers=[
            {
                "name": "Ferritin",
                "canonical_name": "canonical_ferritin",
                "value": 18,
                "unit": "ng/mL",
                "status": "DEFICIENT",
            }
        ],
        historical_biomarkers=[
            {
                "upload_id": "current-upload",
                "name": "Ferritin",
                "value": 18,
                "unit": "ng/mL",
                "status": "DEFICIENT",
                "created_at": "2026-02-01T00:00:00Z",
            }
        ],
        current_upload_id="current-upload",
    )

    assert result["available"] is False
    assert result["history_points"] == 0
    assert result["trends"] == []

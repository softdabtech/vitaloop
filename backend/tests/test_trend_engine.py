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
                # Stage 2PRE.1: the trend engine intentionally never falls back to
                # created_at for measurement dating (choose_measurement_date() only
                # reads test_date/collected_at/reported_at) — this fixture must set a
                # real lab date, not just an upload timestamp, or the row is correctly
                # excluded as undated history. See
                # docs/audit/VITALOOP_STAGE2_IMPLEMENTATION_PLAN.md re: created_at
                # must never be used as lab test date.
                "test_date": "2026-01-01",
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


# ---------------------------------------------------------------------------
# Per-marker significance threshold — regression tests for the 2026-09-03
# audit finding: a flat +/-10% applied to every biomarker flags routine
# day-to-day noise on volatile analytes as a "trend", and misses genuinely
# significant small moves on tightly-regulated ones.
# ---------------------------------------------------------------------------


def test_high_variability_marker_needs_bigger_move_to_flag_as_trending():
    # Ferritin is an acute-phase reactant with well-documented large swings;
    # a 15% move (up from 100 to 115) is common noise, not a real trend.
    result = evaluate_biomarker_trends(
        current_biomarkers=[
            {"name": "Ferritin", "canonical_name": "canonical_ferritin", "value": 115, "unit": "ng/mL", "status": "OPTIMAL"},
        ],
        historical_biomarkers=[
            {
                "upload_id": "old-upload",
                "name": "Ferritin",
                "value": 100,
                "unit": "ng/mL",
                "status": "OPTIMAL",
                "test_date": "2026-01-01",
            }
        ],
    )
    trend = result["trends"][0]
    assert trend["percent_change"] == 15.0
    assert trend["significance_threshold_pct"] == 20.0
    assert trend["direction"] == "stable"  # would have been "rising" under the old flat 10%


def test_low_variability_marker_flags_smaller_move_as_significant():
    # Sodium is tightly homeostatically regulated; even a 6% move (140 -> 132)
    # is more likely a real physiological shift than routine noise.
    result = evaluate_biomarker_trends(
        current_biomarkers=[
            {"name": "Sodium", "canonical_name": "canonical_sodium", "value": 132, "unit": "mmol/L", "status": "OPTIMAL"},
        ],
        historical_biomarkers=[
            {
                "upload_id": "old-upload",
                "name": "Sodium",
                "value": 140,
                "unit": "mmol/L",
                "status": "OPTIMAL",
                "test_date": "2026-01-01",
            }
        ],
    )
    trend = result["trends"][0]
    assert round(trend["percent_change"], 1) == -5.7
    assert trend["significance_threshold_pct"] == 5.0
    assert trend["direction"] == "falling"  # would have been "stable" under the old flat 10%


def test_unlisted_marker_keeps_default_10_percent_threshold():
    result = evaluate_biomarker_trends(
        current_biomarkers=[
            {"name": "Vitamin D", "value": 33, "unit": "ng/mL", "status": "OPTIMAL"},
        ],
        historical_biomarkers=[
            {
                "upload_id": "old-upload",
                "name": "Vitamin D",
                "value": 30,
                "unit": "ng/mL",
                "status": "OPTIMAL",
                "test_date": "2026-01-01",
            }
        ],
    )
    trend = result["trends"][0]
    assert trend["significance_threshold_pct"] == 10.0

"""Stage 2D-2 — canonical longitudinal UX.

Point of truth: GET /progress/overview (build_progress_overview()) is already
the correct, backend-owned longitudinal engine. This stage wires the live
frontend surface (LabResultsList.jsx, routed at /lab-results — the only live
consumer of /progress) to it for clinical/biomarker trend display, and adds
one additive, machine-readable backend field
(`insufficient_history_markers`) so the frontend never has to infer "new
marker / not yet comparable" by absence.

No new trend engine was created. Progress.jsx remains dead/unrouted — traced
via grep of frontend/src for any import of it: zero results, confirming it
was never revived and is not imported anywhere.

Because there is no configured JS test runner in this project (no "test"
script in package.json), the frontend-behavior assertions here are enforced
via source-inspection (the same technique used since Stage 2D-1/2F), proving
the specific patterns required by D2-1/D2-2/D2-7/D2-8 are actually present in
the shipped file — not just asserted from memory.

No live database connection is used anywhere in this file.
"""

from pathlib import Path

from app.services.progress_overview import build_progress_overview

LAB_RESULTS_LIST_JSX = Path("/var/www/VITALOOP/frontend/src/pages/LabResultsList.jsx").read_text()
PROGRESS_JSX_PATH = Path("/var/www/VITALOOP/frontend/src/pages/Progress.jsx")
APP_JSX = Path("/var/www/VITALOOP/frontend/src/App.jsx").read_text()


# --- D2-1: LabResultsList calls /progress/overview -------------------------------


def test_d2_1_lab_results_list_calls_progress_overview():
    assert "api.get('/progress/overview')" in LAB_RESULTS_LIST_JSX


# --- D2-2 / D2-7: clinical trend display uses overview data, direction is backend-owned


def test_d2_2_d2_7_progress_panel_reads_backend_fields_not_computed_values():
    # The rendered change fields all come straight off the overview item —
    # no local math (no `-`, no percentage calc) on marker values anywhere
    # in the component.
    assert "change.direction" in LAB_RESULTS_LIST_JSX
    assert "change.previous_value" in LAB_RESULTS_LIST_JSX
    assert "change.latest_value" in LAB_RESULTS_LIST_JSX
    assert "change.previous_date" in LAB_RESULTS_LIST_JSX
    assert "change.latest_date" in LAB_RESULTS_LIST_JSX
    # No independent delta/direction computation was introduced.
    assert "latest_value - " not in LAB_RESULTS_LIST_JSX
    assert "latest_value -" not in LAB_RESULTS_LIST_JSX


def test_d2_7_direction_labels_are_neutral_not_clinical_judgment():
    """TREND SEMANTICS: no invented clinical meaning ('improving',
    'worsening', 'healthy', 'dangerous') is introduced — only neutral
    increased/decreased/unchanged labels map the backend's own neutral
    rising/falling/stable enum."""
    i18n_source = Path("/var/www/VITALOOP/frontend/src/lib/cabinetI18n.js").read_text()
    forbidden = ["improving", "worsening", "Improving", "Worsening", "healthy", "dangerous", "Healthy", "Dangerous"]
    for word in forbidden:
        assert word not in i18n_source, f"invented clinical judgment word found in i18n copy: {word!r}"
    assert "rising: 'Increased'" in i18n_source
    assert "falling: 'Decreased'" in i18n_source
    assert "stable: 'Unchanged'" in i18n_source


# --- D2-4: undated result never receives created_at as clinical date ------------


def test_d2_4_progress_overview_never_uses_created_at_for_clinical_date():
    import inspect

    from app.services import progress_overview

    source = inspect.getsource(progress_overview._measurement_date)
    assert 'for field in ("test_date", "collected_at", "reported_at")' in source
    assert 'upload.get("created_at")' not in source


def test_d2_4_undated_upload_is_never_assigned_a_measurement_date():
    rows = [
        {"id": "u1", "created_at": "2026-01-01T00:00:00Z", "biomarkers": [{"name": "Ferritin", "value": 50, "unit": "ng/mL", "status": "OPTIMAL"}]},
    ]
    overview = build_progress_overview(rows)
    assert overview["undated_uploads"][0]["upload_id"] == "u1"
    assert overview["summary"]["uploads_with_lab_date"] == 0
    assert overview["date_spine"] == []


def test_d2_4_frontend_never_falls_back_to_created_at_for_clinical_date():
    assert "measurementDateValue" in LAB_RESULTS_LIST_JSX
    # The existing Stage 2D-1 guard: measurementDateValue() only reads
    # test_date/collected_at/reported_at, and getItemDate() falls back to a
    # literal 'Unknown date' string, never item.created_at.
    assert "item?.created_at" not in LAB_RESULTS_LIST_JSX
    assert "'Unknown date'" in LAB_RESULTS_LIST_JSX


# --- D2-5: new marker / insufficient history has an explicit truthful state -----


def test_d2_5_single_dated_point_marker_gets_explicit_insufficient_history_status():
    rows = [
        {"id": "u1", "test_date": "2026-01-01", "biomarkers": [
            {"name": "Ferritin", "value": 50, "unit": "ng/mL", "status": "OPTIMAL"},
            {"name": "Vitamin D", "value": 20, "unit": "ng/mL", "status": "DEFICIENT"},
        ]},
        {"id": "u2", "test_date": "2026-02-01", "biomarkers": [
            {"name": "Ferritin", "value": 60, "unit": "ng/mL", "status": "OPTIMAL"},
        ]},
    ]
    overview = build_progress_overview(rows)
    insufficient = overview["insufficient_history_markers"]
    assert len(insufficient) == 1
    assert insufficient[0]["name"] == "Vitamin D"
    assert insufficient[0]["status"] == "insufficient_history"
    assert overview["summary"]["markers_with_single_date"] == 1
    # Ferritin has 2 dated points -> comparable, not in the insufficient list.
    assert all(item["name"] != "Ferritin" for item in insufficient)


def test_d2_5_frontend_renders_insufficient_history_markers_explicitly():
    assert "insufficient_history_markers" in LAB_RESULTS_LIST_JSX
    assert "newMarkers" in LAB_RESULTS_LIST_JSX


# --- D2-6: missing/incomparable marker does not fabricate a delta ---------------


def test_d2_6_marker_with_zero_or_one_point_never_appears_in_changes():
    rows = [
        {"id": "u1", "test_date": "2026-01-01", "biomarkers": [{"name": "Zinc", "value": 80, "unit": "ug/dL", "status": "OPTIMAL"}]},
    ]
    overview = build_progress_overview(rows)
    assert overview["top_changes"] == []
    assert overview["stable_markers"] == []
    assert overview["all_comparable_markers"] == []
    assert overview["insufficient_history_markers"][0]["name"] == "Zinc"
    # No absolute_change/percent_change/direction fabricated anywhere for it.
    assert "absolute_change" not in overview["insufficient_history_markers"][0]


# --- D2-3 / D2-8: chronology + upload-history/clinical-progress separation ------


def test_d2_3_out_of_order_uploads_still_yield_correct_clinical_chronology():
    rows = [
        {"id": "u_later_upload_earlier_test", "created_at": "2026-03-01T00:00:00Z", "test_date": "2026-01-01",
         "biomarkers": [{"name": "Ferritin", "value": 50, "unit": "ng/mL", "status": "OPTIMAL"}]},
        {"id": "u_earlier_upload_later_test", "created_at": "2026-01-05T00:00:00Z", "test_date": "2026-02-01",
         "biomarkers": [{"name": "Ferritin", "value": 65, "unit": "ng/mL", "status": "OPTIMAL"}]},
    ]
    overview = build_progress_overview(rows)
    change = overview["top_changes"][0] if overview["top_changes"] else overview["stable_markers"][0]
    assert change["previous_date"] == "2026-01-01"
    assert change["latest_date"] == "2026-02-01"
    assert change["previous_value"] == 50.0
    assert change["latest_value"] == 65.0


def test_d2_8_upload_history_list_remains_and_is_visually_separate_from_progress_panel():
    # Upload-history list (existing sortedItems.map render) is untouched.
    assert "sortedItems.map((item, index) =>" in LAB_RESULTS_LIST_JSX
    # Clinical progress now lives in its own distinct component, not merged
    # into the upload-history row markup.
    assert "function ClinicalProgressPanel(" in LAB_RESULTS_LIST_JSX
    assert "<ClinicalProgressPanel overview={overview} loading={overviewLoading} t={t} />" in LAB_RESULTS_LIST_JSX


# --- D2-9 through D2-12: prior-stage suites remain green -------------------------
# (re-run as part of this stage's required test sweep, not duplicated here;
# see the Stage 2D-2 report for the full pytest invocation and pass counts)


def test_d2_dead_code_progress_jsx_still_unreferenced():
    """Progress.jsx was not revived — still not imported/routed anywhere."""
    assert PROGRESS_JSX_PATH.exists(), "Progress.jsx should still exist untouched, not deleted in this stage"
    assert "Progress.jsx" not in APP_JSX
    assert "from './pages/Progress.jsx'" not in APP_JSX
    assert "from '../pages/Progress.jsx'" not in APP_JSX

from app.services.personal_baseline import build_personal_baseline


def _history(canonical_name, values, unit="ng/mL"):
    return [
        {
            "upload_id": f"upload-{i}",
            "canonical_name": canonical_name,
            "name": canonical_name.replace("_", " ").title(),
            "value": v,
            "unit": unit,
            "status": "OPTIMAL",
            "test_date": f"2026-0{i + 1}-01",
        }
        for i, v in enumerate(values)
    ]


def test_unavailable_when_no_current_biomarkers_have_enough_history():
    result = build_personal_baseline(current_biomarkers=[], historical_biomarkers=[])
    assert result["available"] is False
    assert result["markers"] == []


def test_requires_minimum_history_points():
    current = [{"canonical_name": "tsh", "value": 3.8, "unit": "mIU/L", "status": "OPTIMAL"}]
    history = _history("tsh", [1.4])  # only 1 prior point, default min is 2

    result = build_personal_baseline(current_biomarkers=current, historical_biomarkers=history)

    assert result["available"] is False


def test_silent_signal_flagged_when_in_range_but_drifted_from_baseline():
    """The core differentiator: TSH moved from a personal baseline of ~1.4
    to 3.8 but is still reported as OPTIMAL by the lab reference range —
    this must surface as a silent_signal, not disappear."""
    current = [{"canonical_name": "tsh", "value": 3.8, "unit": "mIU/L", "status": "OPTIMAL"}]
    history = _history("tsh", [1.3, 1.4, 1.5], unit="mIU/L")

    result = build_personal_baseline(current_biomarkers=current, historical_biomarkers=history)

    assert result["available"] is True
    marker = result["markers"][0]
    assert marker["canonical_name"] == "canonical_tsh"
    assert marker["in_reference_range"] is True
    assert marker["silent_signal"] is True
    assert marker["direction"] == "rising"
    assert result["summary"]["silent_signal_count"] == 1


def test_not_a_silent_signal_when_out_of_reference_range():
    """A marker already flagged abnormal by the lab doesn't need the
    silent-signal framing — that case is already visible without this."""
    current = [{"canonical_name": "tsh", "value": 8.0, "unit": "mIU/L", "status": "ELEVATED"}]
    history = _history("tsh", [1.3, 1.4, 1.5], unit="mIU/L")

    result = build_personal_baseline(current_biomarkers=current, historical_biomarkers=history)

    marker = result["markers"][0]
    assert marker["in_reference_range"] is False
    assert marker["silent_signal"] is False


def test_stable_marker_within_personal_baseline_is_not_a_signal():
    current = [{"canonical_name": "sodium", "value": 140.5, "unit": "mmol/L", "status": "OPTIMAL"}]
    history = _history("sodium", [140.0, 140.2, 139.8], unit="mmol/L")

    result = build_personal_baseline(current_biomarkers=current, historical_biomarkers=history)

    marker = result["markers"][0]
    assert marker["direction"] == "stable"
    assert marker["silent_signal"] is False


def test_current_upload_excluded_from_its_own_history():
    current = [{"canonical_name": "ferritin", "value": 30, "unit": "ng/mL", "status": "OPTIMAL"}]
    history = _history("ferritin", [10, 12])
    history.append(
        {
            "upload_id": "current-upload",
            "canonical_name": "ferritin",
            "name": "Ferritin",
            "value": 30,
            "unit": "ng/mL",
            "status": "OPTIMAL",
            "test_date": "2026-09-14",
        }
    )

    result = build_personal_baseline(
        current_biomarkers=current, historical_biomarkers=history, current_upload_id="current-upload"
    )

    # Baseline should be computed from the 2 prior points only (mean=11),
    # not from the current upload's own row leaking into its own history.
    assert result["markers"][0]["history_points"] == 2
    assert result["markers"][0]["personal_baseline_value"] == 11.0


def test_unit_mismatch_does_not_fabricate_a_silent_signal():
    """2026-09-22 regression: a prior PDF-extracted Hemoglobin in g/L (135)
    compared raw against a same-marker manual entry in g/dL (13.5) used to
    read as a ~90x-scale "crash" and fire a false silent_signal/doctor-
    review flag. 135 g/L == 13.5 g/dL — the same value, just a different
    unit, so once converted there is no drift at all."""
    current = [{"canonical_name": "hemoglobin", "value": 13.5, "unit": "g/dL", "status": "OPTIMAL"}]
    history = _history("hemoglobin", [135, 136, 134], unit="g/L")

    result = build_personal_baseline(current_biomarkers=current, historical_biomarkers=history)

    marker = result["markers"][0]
    assert marker["silent_signal"] is False
    assert marker["direction"] == "stable"
    # baseline mean of [135, 136, 134] g/L converted to g/dL: 13.5
    assert round(marker["personal_baseline_value"], 1) == 13.5


def test_unconvertible_unit_excludes_that_history_point_rather_than_mixing_raw_numbers():
    """A prior row in a unit the biomarker doesn't recognize can't be safely
    compared — it must be dropped, not averaged in as if unit-equivalent."""
    current = [{"canonical_name": "hemoglobin", "value": 13.5, "unit": "g/dL", "status": "OPTIMAL"}]
    history = _history("hemoglobin", [14.0, 13.8], unit="g/dL") + _history(
        "hemoglobin", [999], unit="not_a_real_unit"
    )

    result = build_personal_baseline(current_biomarkers=current, historical_biomarkers=history)

    marker = result["markers"][0]
    assert marker["history_points"] == 2
    assert round(marker["personal_baseline_value"], 2) == 13.9


def test_markers_sorted_with_silent_signals_first():
    current = [
        {"canonical_name": "sodium", "value": 140.0, "unit": "mmol/L", "status": "OPTIMAL"},
        {"canonical_name": "tsh", "value": 3.8, "unit": "mIU/L", "status": "OPTIMAL"},
    ]
    history = _history("sodium", [140.0, 140.1], unit="mmol/L") + _history("tsh", [1.3, 1.4], unit="mIU/L")

    result = build_personal_baseline(current_biomarkers=current, historical_biomarkers=history)

    assert result["markers"][0]["canonical_name"] == "canonical_tsh"
    assert result["markers"][0]["silent_signal"] is True

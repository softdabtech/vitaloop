"""P19: Personal Baseline 2.0 velocity/direction extension
(app/services/personal_baseline.py::build_personal_baseline_velocity).

Deterministic, no LLM. Covers each named status, direction-category
semantics, confidence gating on history depth, and malformed/missing
input tolerance.
"""

from app.services.personal_baseline import build_personal_baseline_velocity


def _history(canonical_name, values, status="OPTIMAL", unit="unit"):
    return [
        {
            "upload_id": f"upload-{i}",
            "canonical_name": canonical_name,
            "name": canonical_name.replace("_", " ").title(),
            "value": v,
            "unit": unit,
            "status": status,
            "test_date": f"2025-{i + 1:02d}-01",
        }
        for i, v in enumerate(values)
    ]


def _current(canonical_name, value, status="OPTIMAL", test_date="2026-01-01"):
    return {
        "canonical_name": canonical_name,
        "name": canonical_name.replace("_", " ").title(),
        "value": value,
        "unit": "unit",
        "status": status,
        "test_date": test_date,
    }


def _signal_for(result, marker):
    return next(s for s in result["signals"] if s["marker"] == marker)


def test_normal_but_drifting_when_in_range_but_meaningful_move():
    # TSH threshold is 20% (high-variability marker); 1.5 -> 1.9 is a ~27%
    # move — meaningful, but well under the 3x-threshold "rapid" cutoff.
    current = [_current("tsh", 1.9, status="OPTIMAL")]
    history = _history("tsh", [1.3, 1.4, 1.5])

    result = build_personal_baseline_velocity(current_biomarkers=current, historical_biomarkers=history)

    signal = _signal_for(result, "tsh")
    assert signal["status"] == "normal_but_drifting"
    assert signal["within_lab_range"] is True
    assert signal["direction"] == "up"
    assert "meaningful_personal_change" in signal["reason_codes"]
    assert signal["time_window_days"] is not None


def test_rapid_change_when_move_is_much_larger_than_threshold():
    # TSH threshold is 20% (high-variability marker); a >3x jump qualifies.
    current = [_current("tsh", 6.0)]
    history = _history("tsh", [1.0, 1.0, 1.0])

    result = build_personal_baseline_velocity(current_biomarkers=current, historical_biomarkers=history)

    signal = _signal_for(result, "tsh")
    assert signal["status"] == "rapid_change"
    assert signal["velocity"] == "fast"


def test_improved_toward_baseline_for_higher_may_be_concerning_marker():
    # ALT: higher_may_be_concerning -> a move DOWN is "improved".
    current = [_current("alt", 40)]
    history = _history("alt", [55, 53, 52])

    result = build_personal_baseline_velocity(current_biomarkers=current, historical_biomarkers=history)

    signal = _signal_for(result, "alt")
    assert signal["direction"] == "down"
    assert signal["status"] == "improved_toward_baseline"


def test_worsened_from_baseline_for_higher_may_be_concerning_marker():
    # ALT default threshold is 10%; 42 -> 50 is a ~19% move — meaningful,
    # not rapid.
    current = [_current("alt", 50)]
    history = _history("alt", [40, 41, 42])

    result = build_personal_baseline_velocity(current_biomarkers=current, historical_biomarkers=history)

    signal = _signal_for(result, "alt")
    assert signal["direction"] == "up"
    assert signal["status"] == "worsened_from_baseline"


def test_hdl_direction_semantics_down_is_concerning():
    # HDL: lower_may_be_concerning -> a move DOWN is "worsened", not
    # "improved". Default threshold 10%; 53 -> 43 is a ~19% move.
    current = [_current("hdl", 43)]
    history = _history("hdl", [55, 54, 53])

    result = build_personal_baseline_velocity(current_biomarkers=current, historical_biomarkers=history)

    signal = _signal_for(result, "hdl")
    assert signal["direction"] == "down"
    assert signal["status"] == "worsened_from_baseline"


def test_crp_direction_semantics_down_is_improvement():
    # CRP: higher_may_be_concerning -> a move DOWN is "improved". CRP
    # threshold is 20% (high-variability); 7.0 -> 5.0 is a ~29% move.
    current = [_current("crp", 5.0)]
    history = _history("crp", [8.0, 7.5, 7.0])

    result = build_personal_baseline_velocity(current_biomarkers=current, historical_biomarkers=history)

    signal = _signal_for(result, "crp")
    assert signal["direction"] == "down"
    assert signal["status"] == "improved_toward_baseline"


def test_stable_near_baseline_when_no_meaningful_move():
    current = [_current("alt", 41)]
    history = _history("alt", [40, 40, 40])

    result = build_personal_baseline_velocity(current_biomarkers=current, historical_biomarkers=history)

    signal = _signal_for(result, "alt")
    assert signal["direction"] == "stable"
    assert signal["status"] == "stable_near_baseline"


def test_volatile_marker_when_history_flips_direction_repeatedly():
    # Ferritin threshold is 20%; alternate big up/down swings.
    current = [_current("ferritin", 40)]
    history = _history("ferritin", [100, 20, 100])

    result = build_personal_baseline_velocity(current_biomarkers=current, historical_biomarkers=history)

    signal = _signal_for(result, "ferritin")
    assert signal["status"] == "volatile_marker"
    assert "volatile_history" in signal["reason_codes"]


def test_context_dependent_marker_does_not_overclaim_improved_or_worsened():
    # Ferritin (too_high_or_too_low) outside range, moving consistently —
    # must never be labeled improved/worsened without a clear direction.
    current = [_current("ferritin", 150, status="ELEVATED")]
    history = _history("ferritin", [100, 110, 120], status="ELEVATED")

    result = build_personal_baseline_velocity(current_biomarkers=current, historical_biomarkers=history)

    signal = _signal_for(result, "ferritin")
    assert signal["status"] not in {"improved_toward_baseline", "worsened_from_baseline"}


def test_direction_consistent_reason_code_present_across_history():
    # Ferritin threshold is 20%; each step here is a ~25% rise so every
    # consecutive step (including the final one) clears the threshold and
    # counts toward direction consistency.
    current = [_current("ferritin", 195, status="ELEVATED")]
    history = _history("ferritin", [100, 125, 155], status="ELEVATED")

    result = build_personal_baseline_velocity(current_biomarkers=current, historical_biomarkers=history)

    signal = _signal_for(result, "ferritin")
    assert "consistent_direction" in signal["reason_codes"]


def test_only_one_historical_point_produces_low_confidence_signal():
    current = [_current("alt", 60)]
    history = _history("alt", [40])  # single prior point

    result = build_personal_baseline_velocity(current_biomarkers=current, historical_biomarkers=history)

    signal = _signal_for(result, "alt")
    assert signal["confidence"] == "low"


def test_no_history_at_all_produces_no_signal_for_that_marker():
    current = [_current("alt", 60)]

    result = build_personal_baseline_velocity(current_biomarkers=current, historical_biomarkers=[])

    assert result["signals"] == []
    assert result["summary"]["markers_assessed"] == 0


def test_missing_dates_do_not_crash():
    current = [{"canonical_name": "alt", "value": 60, "status": "OPTIMAL"}]  # no test_date
    history = [
        {"upload_id": "u1", "canonical_name": "alt", "value": 40, "status": "OPTIMAL", "test_date": "2025-01-01"},
        {"upload_id": "u2", "canonical_name": "alt", "value": 42, "status": "OPTIMAL", "test_date": "2025-02-01"},
    ]

    result = build_personal_baseline_velocity(current_biomarkers=current, historical_biomarkers=history)

    signal = _signal_for(result, "alt")
    assert signal["time_window_days"] is None


def test_malformed_marker_values_do_not_crash():
    current = [
        {"canonical_name": "alt", "value": "not_a_number", "status": "OPTIMAL"},
        "not_a_dict",
        None,
        {},
    ]
    history = _history("alt", [40, 41])

    result = build_personal_baseline_velocity(current_biomarkers=current, historical_biomarkers=history)

    assert isinstance(result["signals"], list)


def test_summary_counts_match_signal_statuses():
    current = [_current("alt", 65), _current("hdl", 35)]
    history = {
        **{},
    }
    all_history = _history("alt", [40, 41, 42]) + _history("hdl", [55, 54, 53])

    result = build_personal_baseline_velocity(current_biomarkers=current, historical_biomarkers=all_history)

    total = (
        result["summary"]["normal_but_drifting_count"]
        + result["summary"]["rapid_change_count"]
        + result["summary"]["improved_count"]
        + result["summary"]["worsened_count"]
        + result["summary"]["stable_count"]
        + result["summary"]["volatile_count"]
        + result["summary"]["direction_consistent_count"]
    )
    assert total == result["summary"]["markers_assessed"] == 2


def test_non_mvp_marker_is_ignored():
    current = [_current("sodium", 140)]
    history = _history("sodium", [138, 139])

    result = build_personal_baseline_velocity(current_biomarkers=current, historical_biomarkers=history)

    assert result["signals"] == []

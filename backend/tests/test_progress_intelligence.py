from app.services.progress_intelligence import build_progress_intelligence


def _trace(pattern_id, confidence, severity=None, domain="iron_status"):
    return {
        "pattern_id": pattern_id,
        "pattern_name": pattern_id.replace("_", " ").title(),
        "domain": domain,
        "confidence": confidence,
        "severity": severity,
    }


def test_unavailable_when_no_previous_traces():
    result = build_progress_intelligence(current_traces=[_trace("iron_deficiency_anemia", 0.7)], previous_traces=[])

    assert result["available"] is False
    assert result["changes"] == []
    assert result["summary"]["strengthened_count"] == 0


def test_strengthened_when_confidence_rises_above_threshold():
    current = [_trace("iron_deficiency_anemia", 0.8)]
    previous = [_trace("iron_deficiency_anemia", 0.6)]

    result = build_progress_intelligence(current_traces=current, previous_traces=previous)

    assert result["available"] is True
    change = result["changes"][0]
    assert change["status"] == "strengthened"
    assert change["confidence_delta"] == 0.2
    assert result["summary"]["strengthened_count"] == 1


def test_weakened_when_confidence_falls_below_threshold():
    current = [_trace("iron_deficiency_anemia", 0.5)]
    previous = [_trace("iron_deficiency_anemia", 0.75)]

    result = build_progress_intelligence(current_traces=current, previous_traces=previous)

    assert result["changes"][0]["status"] == "weakened"
    assert result["summary"]["weakened_count"] == 1


def test_stable_when_confidence_change_is_within_noise_threshold():
    current = [_trace("iron_deficiency_anemia", 0.65)]
    previous = [_trace("iron_deficiency_anemia", 0.6)]

    result = build_progress_intelligence(current_traces=current, previous_traces=previous)

    assert result["changes"][0]["status"] == "stable"
    assert result["summary"]["stable_count"] == 1


def test_severity_increase_marks_strengthened_even_with_small_confidence_delta():
    current = [_trace("iron_deficiency_anemia", 0.65, severity="high")]
    previous = [_trace("iron_deficiency_anemia", 0.63, severity="mild")]

    result = build_progress_intelligence(current_traces=current, previous_traces=previous)

    assert result["changes"][0]["status"] == "strengthened"


def test_new_pattern_not_in_previous_is_new_signal():
    current = [_trace("thyroid_dysfunction", 0.7)]
    previous = [_trace("iron_deficiency_anemia", 0.7)]

    result = build_progress_intelligence(current_traces=current, previous_traces=previous)

    statuses = {c["pattern_id"]: c["status"] for c in result["changes"]}
    assert statuses["thyroid_dysfunction"] == "new_signal"
    assert result["summary"]["new_signal_count"] == 1


def test_pattern_no_longer_present_is_resolved_or_improved():
    current = [_trace("thyroid_dysfunction", 0.7)]
    previous = [_trace("iron_deficiency_anemia", 0.7), _trace("thyroid_dysfunction", 0.7)]

    result = build_progress_intelligence(current_traces=current, previous_traces=previous)

    statuses = {c["pattern_id"]: c["status"] for c in result["changes"]}
    assert statuses["iron_deficiency_anemia"] == "resolved_or_improved"
    assert result["summary"]["resolved_count"] == 1


def test_changes_sorted_new_and_weakened_before_stable_and_resolved():
    current = [
        _trace("stable_one", 0.6),
        _trace("new_one", 0.6),
        _trace("weak_one", 0.4),
    ]
    previous = [
        _trace("stable_one", 0.6),
        _trace("weak_one", 0.7),
        _trace("resolved_one", 0.6),
    ]

    result = build_progress_intelligence(current_traces=current, previous_traces=previous)
    ordered_statuses = [c["status"] for c in result["changes"]]

    assert ordered_statuses.index("new_signal") < ordered_statuses.index("stable")
    assert ordered_statuses.index("weakened") < ordered_statuses.index("stable")
    assert ordered_statuses.index("stable") < ordered_statuses.index("resolved_or_improved")


def test_previous_upload_metadata_is_passed_through():
    result = build_progress_intelligence(
        current_traces=[_trace("iron_deficiency_anemia", 0.7)],
        previous_traces=[_trace("iron_deficiency_anemia", 0.6)],
        previous_upload_id="upload-123",
        previous_measured_at="2026-08-01T00:00:00Z",
    )

    assert result["previous_upload_id"] == "upload-123"
    assert result["previous_measured_at"] == "2026-08-01T00:00:00Z"

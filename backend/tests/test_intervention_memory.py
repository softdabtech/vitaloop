"""P20: Intervention Memory (app/services/intervention_memory.py).

Deterministic, no LLM. Covers normalization, domain classification,
active vs completed, window filtering, and malformed-input tolerance.
"""

from app.services.intervention_memory import (
    build_intervention_memory,
    normalize_intervention_event,
)


def _event(**overrides):
    base = {
        "id": "e1",
        "event_type": "supplement",
        "label": "Iron supplement",
        "description": None,
        "started_at": "2026-07-10T00:00:00Z",
        "ended_at": None,
        "ongoing": True,
        "adherence": "partial",
        "intensity": None,
        "dose": None,
        "frequency": None,
        "source": "user",
        "related_protocol_id": None,
        "related_recommendation_id": None,
        "metadata": {},
    }
    base.update(overrides)
    return base


def test_normalize_valid_event():
    result = normalize_intervention_event(_event())

    assert result["id"] == "e1"
    assert result["type"] == "supplement"
    assert result["confidence"] == "self_reported"
    assert "iron_status" in result["domains"]


def test_normalize_rejects_invalid_event_type():
    assert normalize_intervention_event(_event(event_type="not_a_real_type")) is None


def test_normalize_rejects_missing_label():
    assert normalize_intervention_event(_event(label="")) is None


def test_normalize_rejects_non_dict():
    assert normalize_intervention_event("not_a_dict") is None
    assert normalize_intervention_event(None) is None


def test_domain_classification_by_event_type_default():
    result = normalize_intervention_event(_event(event_type="alcohol", label="Weekend drinking"))
    assert "liver" in result["domains"]
    assert "metabolic_health" in result["domains"]


def test_domain_classification_by_keyword():
    result = normalize_intervention_event(
        _event(event_type="supplement", label="Vitamin D3", description="2000 IU daily")
    )
    assert "micronutrients" in result["domains"]


def test_active_vs_completed_split():
    active_event = _event(id="e1", ended_at=None, ongoing=True)
    completed_event = _event(id="e2", ended_at="2026-08-01T00:00:00Z", ongoing=False)

    result = build_intervention_memory([active_event, completed_event])

    active_ids = [e["id"] for e in result["active_interventions"]]
    completed_ids = [e["id"] for e in result["completed_interventions"]]
    assert active_ids == ["e1"]
    assert completed_ids == ["e2"]


def test_window_filtering_excludes_events_outside_range():
    old_event = _event(id="old", started_at="2020-01-01T00:00:00Z", ended_at="2020-02-01T00:00:00Z", ongoing=False)
    recent_event = _event(id="recent", started_at="2026-07-10T00:00:00Z", ongoing=True)

    result = build_intervention_memory(
        [old_event, recent_event], window_from="2026-06-01T00:00:00Z", window_to="2026-09-15T00:00:00Z"
    )

    ids = [e["id"] for e in result["active_interventions"] + result["completed_interventions"]]
    assert "recent" in ids
    assert "old" not in ids
    assert result["events_considered"] == 1


def test_missing_previous_report_date_falls_back_to_conservative_window():
    result = build_intervention_memory([_event()], window_from=None)

    assert result["events_considered"] == 1
    assert any("conservative window" in note for note in result["limitations"])


def test_missing_event_dates_do_not_crash_and_are_included():
    event = _event(started_at=None, ended_at=None, ongoing=False)

    result = build_intervention_memory([event])

    assert result["events_considered"] == 1
    assert any("could not be placed precisely in time" in note for note in result["limitations"])


def test_no_events_returns_valid_empty_object():
    result = build_intervention_memory([])

    assert result["version"] == "p20_v1"
    assert result["events_considered"] == 0
    assert result["active_interventions"] == []
    assert result["completed_interventions"] == []
    assert result["domain_context"] == []
    assert len(result["limitations"]) >= 2


def test_none_events_do_not_crash():
    result = build_intervention_memory(None)
    assert result["events_considered"] == 0


def test_malformed_metadata_does_not_crash():
    events = [
        _event(metadata="not_a_dict"),
        _event(id="e2", metadata=None),
        {"id": "bad"},  # missing required fields
        "not_a_dict",
        None,
        42,
    ]

    result = build_intervention_memory(events)

    assert isinstance(result["active_interventions"], list)
    assert result["events_considered"] >= 1


def test_domain_context_uses_context_only_claim_strength_and_safe_wording():
    result = build_intervention_memory([_event()])

    assert result["domain_context"]
    for entry in result["domain_context"]:
        assert entry["claim_strength"] == "context_only"
        note = entry["interpretation_note"].lower()
        for forbidden in ("caused", "cured", "treated", "fixed", "guaranteed"):
            assert forbidden not in note


def test_ongoing_flag_ignored_when_ended_at_present():
    # Data hygiene: an event with ended_at set is treated as completed
    # regardless of a stale ongoing=True flag.
    event = _event(ended_at="2026-08-01T00:00:00Z", ongoing=True)

    result = normalize_intervention_event(event)

    assert result["ongoing"] is False

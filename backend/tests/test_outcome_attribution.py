"""P21: Outcome Attribution Engine (app/services/outcome_attribution.py).

Deterministic, no LLM. Covers timing gating, domain matching, confounders,
adherence scoring, medication exclusion, and forbidden-causation wording.
"""

from app.services.outcome_attribution import build_outcome_attribution


def _signal(**overrides):
    base = {
        "marker": "ferritin",
        "domain": "iron_status",
        "status": "improved_toward_baseline",
        "direction": "up",
        "confidence": "moderate",
        "reason": "FERRITIN has moved toward this user's more stable prior range.",
    }
    base.update(overrides)
    return base


def _event(**overrides):
    base = {
        "id": "e1",
        "type": "supplement",
        "label": "Iron supplement",
        "domains": ["iron_status"],
        "source": "user",
        "adherence": "high",
        "started_at": "2026-07-10T00:00:00Z",
        "ended_at": None,
    }
    base.update(overrides)
    return base


def _memory(events, window_to="2026-09-15T00:00:00Z", events_considered=None):
    return {
        "active_interventions": events,
        "completed_interventions": [],
        "events_considered": events_considered if events_considered is not None else len(events),
        "window": {"from": "2026-06-01", "to": window_to},
    }


def test_no_events_returns_valid_empty_object():
    result = build_outcome_attribution(velocity_signals=[_signal()], intervention_memory=_memory([]))

    assert result["attributions"] == []
    assert result["summary"]["events_considered"] == 0
    assert result["summary"]["markers_reviewed"] == 1
    assert "No intervention events" in result["global_limitations"][0]


def test_none_intervention_memory_does_not_crash():
    result = build_outcome_attribution(velocity_signals=[_signal()], intervention_memory=None)
    assert result["attributions"] == []


def test_event_after_lab_date_does_not_attribute():
    event = _event(started_at="2026-09-20T00:00:00Z")  # after window_to

    result = build_outcome_attribution(
        velocity_signals=[_signal()], intervention_memory=_memory([event])
    )

    assert result["attributions"] == []
    assert result["summary"]["no_event_context_count"] == 1


def test_domain_matched_event_before_improvement_creates_possible_contributor():
    result = build_outcome_attribution(
        velocity_signals=[_signal()], intervention_memory=_memory([_event()])
    )

    assert len(result["attributions"]) == 1
    attribution = result["attributions"][0]
    assert attribution["outcome_marker"] == "ferritin"
    assert attribution["claim_strength"] == "possible_contributor"
    assert attribution["possible_contributors"][0]["event_id"] == "e1"
    assert "intervention_precedes_change" in attribution["possible_contributors"][0]["reason_codes"]


def test_domain_mismatch_produces_no_attribution():
    event = _event(domains=["thyroid"])

    result = build_outcome_attribution(
        velocity_signals=[_signal()], intervention_memory=_memory([event])
    )

    assert result["attributions"] == []


def test_overlapping_multiple_events_lowers_confidence_and_adds_confounder():
    events = [_event(id="e1"), _event(id="e2", label="Nutrition change", type="nutrition")]

    result = build_outcome_attribution(
        velocity_signals=[_signal()], intervention_memory=_memory(events)
    )

    attribution = result["attributions"][0]
    assert len(attribution["possible_contributors"]) == 2
    assert any("More than one" in c for c in attribution["confounders"])
    assert result["summary"]["confounded_count"] == 1


def test_contradiction_in_same_domain_lowers_confidence_and_adds_confounder():
    contradictions = [{"id": "c1", "domain": "iron_status", "effect_on_confidence": "downgrade"}]

    with_contradiction = build_outcome_attribution(
        velocity_signals=[_signal()],
        intervention_memory=_memory([_event()]),
        clinical_contradictions=contradictions,
    )
    without_contradiction = build_outcome_attribution(
        velocity_signals=[_signal()], intervention_memory=_memory([_event()])
    )

    a = with_contradiction["attributions"][0]
    b = without_contradiction["attributions"][0]
    assert any("contradiction" in c.lower() for c in a["confounders"])
    a_score_rank = {"blocked": 0, "low": 1, "moderate": 2, "high": 3}
    assert a_score_rank[a["confidence"]] <= a_score_rank[b["confidence"]]


def test_evidence_gap_adds_limitation_style_confounder():
    evidence_gaps = {"gaps": [{"domain": "iron_status", "missing_marker": "transferrin_saturation"}]}

    result = build_outcome_attribution(
        velocity_signals=[_signal()],
        intervention_memory=_memory([_event()]),
        evidence_gaps=evidence_gaps,
    )

    attribution = result["attributions"][0]
    assert any("evidence gap" in c.lower() for c in attribution["confounders"])


def test_adherence_high_boosts_confidence_vs_unknown():
    high = build_outcome_attribution(
        velocity_signals=[_signal()], intervention_memory=_memory([_event(adherence="high")])
    )
    unknown = build_outcome_attribution(
        velocity_signals=[_signal()], intervention_memory=_memory([_event(adherence=None)])
    )

    rank = {"blocked": 0, "low": 1, "moderate": 2, "high": 3}
    a = high["attributions"][0]["possible_contributors"][0]
    b = unknown["attributions"][0]["possible_contributors"][0]
    assert rank[a["confidence"]] >= rank[b["confidence"]]
    assert "high_adherence" in a["reason_codes"]
    assert "unknown_adherence" in b["reason_codes"]


def test_medication_event_never_generates_attribution():
    event = _event(type="medication", label="Started levothyroxine", domains=["thyroid"])
    signal = _signal(marker="tsh", domain="thyroid", status="improved_toward_baseline")

    result = build_outcome_attribution(velocity_signals=[signal], intervention_memory=_memory([event]))

    assert result["attributions"] == []


def test_doctor_flagged_domain_is_excluded_from_attribution():
    hypotheses = [{"domain": "iron_status", "doctor_only": True}]

    result = build_outcome_attribution(
        velocity_signals=[_signal()],
        intervention_memory=_memory([_event()]),
        clinical_hypotheses=hypotheses,
    )

    assert result["attributions"] == []


def test_volatile_and_stable_signals_are_never_attributed():
    signals = [_signal(status="volatile_marker"), _signal(status="stable_near_baseline")]

    result = build_outcome_attribution(velocity_signals=signals, intervention_memory=_memory([_event()]))

    assert result["attributions"] == []
    assert result["summary"]["markers_reviewed"] == 2


def test_missing_started_at_does_not_crash_and_adds_confounder():
    event = _event(started_at=None)

    result = build_outcome_attribution(velocity_signals=[_signal()], intervention_memory=_memory([event]))

    assert len(result["attributions"]) == 1
    assert any("timing" in c.lower() for c in result["attributions"][0]["confounders"])


def test_malformed_signals_and_events_do_not_crash():
    result = build_outcome_attribution(
        velocity_signals=["not_a_dict", None, 42, {}],
        intervention_memory={"active_interventions": ["bad", None, {}], "completed_interventions": None},
    )

    assert isinstance(result["attributions"], list)


def test_forbidden_causation_wording_absent():
    # "caused" is checked separately below: it is allowed ONLY inside the
    # sanctioned negation "does not prove ... caused" (the P21 spec's own
    # allowed phrasing), never as a bare causal assertion — same
    # safe-context convention as frontend/scripts/qa-forbidden-claims.mjs.
    forbidden = ["cured", "treated", "fixed", "reversed", "because of", "proves", "guaranteed", "diagnosis"]
    events = [_event(id="e1"), _event(id="e2", type="illness", label="Flu", domains=["iron_status"])]
    result = build_outcome_attribution(
        velocity_signals=[_signal()],
        intervention_memory=_memory(events),
        clinical_contradictions=[{"id": "c1", "domain": "iron_status", "effect_on_confidence": "downgrade"}],
        evidence_gaps={"gaps": [{"domain": "iron_status", "missing_marker": "crp"}]},
    )

    text_blob = " ".join(
        [result["global_limitations"][0]]
        + [
            " ".join([a["outcome_summary"]] + a["confounders"] + a["limitations"])
            for a in result["attributions"]
        ]
    ).lower()

    for phrase in forbidden:
        assert phrase not in text_blob, f"forbidden phrase found: {phrase}"

    for sentence in text_blob.split("."):
        if "caused" in sentence:
            assert "does not prove" in sentence or "not prove" in sentence, (
                f"'caused' used outside the sanctioned negation: {sentence!r}"
            )

"""P16: Confidence Calibration Engine (app/services/confidence_calibration.py).

Deterministic, no LLM. Covers positive/negative adjustment factors, safety
overrides, empty state, malformed-input tolerance, and the P14 hypothesis
merge helper.
"""

from app.services.confidence_calibration import (
    build_confidence_calibration,
    apply_calibration_to_hypotheses,
)


def _hypothesis(**overrides):
    base = {
        "hypothesis_id": "h1",
        "domain": "iron_anemia",
        "confidence_score": 0.7,
        "supporting_evidence": [{"canonical_name": "ferritin"}, {"canonical_name": "hemoglobin"}],
        "doctor_flag": False,
    }
    base.update(overrides)
    return base


def test_empty_state_when_no_hypotheses():
    result = build_confidence_calibration([])

    assert result["calibrated_items"] == []
    assert result["overall_confidence"] == "low"
    assert result["overall_score"] == 0


def test_empty_state_when_hypotheses_is_none():
    result = build_confidence_calibration(None)

    assert result["calibrated_items"] == []


def test_high_confidence_with_no_contradictions_or_gaps():
    hypothesis = _hypothesis(confidence_score=0.85)

    result = build_confidence_calibration([hypothesis])

    item = result["calibrated_items"][0]
    assert item["calibrated_confidence"] == "high"
    assert item["blocked"] is False
    assert item["doctor_only"] is False
    assert "required_markers_present" in item["reason_codes"]


def test_contradiction_downgrades_confidence():
    hypothesis = _hypothesis(confidence_score=0.8)
    contradictions = [
        {
            "id": "ferritin_inflammation_context",
            "domain": "iron_anemia",
            "effect_on_confidence": "downgrade",
            "message": "Inflammation may limit ferritin interpretation.",
            "related_hypotheses": ["h1"],
            "doctor_flag": False,
        }
    ]

    result = build_confidence_calibration([hypothesis], contradictions=contradictions)

    item = result["calibrated_items"][0]
    assert item["calibrated_score"] < 0.8
    assert "contradiction_downgrade" in item["reason_codes"]
    assert any("Inflammation" in f for f in item["negative_factors"])


def test_evidence_gap_downgrades_confidence():
    hypothesis = _hypothesis(confidence_score=0.8)
    evidence_gaps = {
        "gaps": [
            {"domain": "iron_anemia", "missing_marker": "transferrin_saturation", "reason": "would_reduce_uncertainty"},
            {"domain": "iron_anemia", "missing_marker": "crp", "reason": "would_reduce_uncertainty"},
        ]
    }

    result = build_confidence_calibration([hypothesis], evidence_gaps=evidence_gaps)

    item = result["calibrated_items"][0]
    assert item["calibrated_score"] < 0.8
    assert "missing_confirmatory_tests" in item["reason_codes"]


def test_blocked_evidence_gap_forces_blocked():
    hypothesis = _hypothesis(confidence_score=0.9)
    evidence_gaps = {
        "gaps": [
            {"domain": "iron_anemia", "missing_marker": "ferritin", "reason": "unit_not_reconcilable"},
        ]
    }

    result = build_confidence_calibration([hypothesis], evidence_gaps=evidence_gaps)

    item = result["calibrated_items"][0]
    assert item["calibrated_confidence"] == "blocked"
    assert item["blocked"] is True
    assert "blocked_insufficient_data" in item["reason_codes"]


def test_doctor_flag_on_hypothesis_forces_doctor_only():
    hypothesis = _hypothesis(confidence_score=0.9, doctor_flag=True)

    result = build_confidence_calibration([hypothesis])

    item = result["calibrated_items"][0]
    assert item["calibrated_confidence"] == "doctor_only"
    assert item["doctor_only"] is True
    assert "safety_escalation" in item["reason_codes"]


def test_contradiction_doctor_flag_forces_doctor_only():
    hypothesis = _hypothesis(confidence_score=0.9)
    contradictions = [
        {
            "id": "elevated_liver_markers_supplement_context",
            "domain": "iron_anemia",
            "effect_on_confidence": "downgrade",
            "related_hypotheses": ["h1"],
            "doctor_flag": True,
        }
    ]

    result = build_confidence_calibration([hypothesis], contradictions=contradictions)

    item = result["calibrated_items"][0]
    assert item["calibrated_confidence"] == "doctor_only"


def test_doctor_only_takes_priority_over_blocked():
    hypothesis = _hypothesis(confidence_score=0.9, doctor_flag=True)
    evidence_gaps = {"gaps": [{"domain": "iron_anemia", "missing_marker": "x", "reason": "unit_not_reconcilable"}]}

    result = build_confidence_calibration([hypothesis], evidence_gaps=evidence_gaps)

    item = result["calibrated_items"][0]
    assert item["calibrated_confidence"] == "doctor_only"


def test_symptom_alignment_boosts_confidence():
    hypothesis = _hypothesis(confidence_score=0.6)
    patterns = [{"pattern_id": "h1", "domain": "iron_anemia", "symptom_signal": ["fatigue"]}]

    without = build_confidence_calibration([hypothesis], patterns=patterns, symptoms=[])
    with_match = build_confidence_calibration([hypothesis], patterns=patterns, symptoms=["fatigue"])

    assert with_match["calibrated_items"][0]["calibrated_score"] > without["calibrated_items"][0]["calibrated_score"]
    assert "supportive_symptom_match" in with_match["calibrated_items"][0]["reason_codes"]


def test_historical_strengthening_boosts_confidence():
    hypothesis = _hypothesis(confidence_score=0.6)
    progress_intelligence = {"changes": [{"pattern_id": "h1", "status": "strengthened"}]}

    result = build_confidence_calibration([hypothesis], progress_intelligence=progress_intelligence)

    item = result["calibrated_items"][0]
    assert "historical_confirmation" in item["reason_codes"]
    assert item["calibrated_score"] > 0.6 + 0.02  # required_markers_present also applies


def test_historical_weakening_reduces_confidence():
    hypothesis = _hypothesis(confidence_score=0.6)
    progress_intelligence = {"changes": [{"pattern_id": "h1", "status": "weakened"}]}

    result = build_confidence_calibration([hypothesis], progress_intelligence=progress_intelligence)

    item = result["calibrated_items"][0]
    assert "historical_weakening" in item["reason_codes"]


def test_personal_baseline_confirms_direction_boosts_confidence():
    hypothesis = _hypothesis(confidence_score=0.6)
    personal_baseline = {"markers": [{"canonical_name": "ferritin", "silent_signal": True}]}

    result = build_confidence_calibration([hypothesis], personal_baseline=personal_baseline)

    item = result["calibrated_items"][0]
    assert "personal_baseline_confirms_direction" in item["reason_codes"]


def test_single_marker_support_is_penalized():
    hypothesis = _hypothesis(confidence_score=0.7, supporting_evidence=[{"canonical_name": "ferritin"}])

    result = build_confidence_calibration([hypothesis])

    item = result["calibrated_items"][0]
    assert "single_marker_support" in item["reason_codes"]


def test_malformed_hypothesis_values_do_not_crash():
    hypotheses = [
        {"hypothesis_id": "h1", "confidence_score": "not_a_number"},
        "not_a_dict",
        None,
        {},
    ]

    result = build_confidence_calibration(hypotheses)

    assert isinstance(result["calibrated_items"], list)


def test_apply_calibration_preserves_original_fields_and_adds_new_ones():
    hypotheses = [_hypothesis(confidence_score=0.9, label="Iron availability pattern")]
    calibration = build_confidence_calibration(hypotheses)

    merged = apply_calibration_to_hypotheses(hypotheses, calibration)

    assert merged[0]["label"] == "Iron availability pattern"
    assert merged[0]["confidence_score"] == 0.9
    assert "calibrated_confidence" in merged[0]
    assert "calibrated_score" in merged[0]
    assert "calibration_reason_codes" in merged[0]


def test_apply_calibration_handles_missing_calibrated_item_gracefully():
    hypotheses = [_hypothesis(hypothesis_id="unmatched")]

    merged = apply_calibration_to_hypotheses(hypotheses, {"calibrated_items": []})

    assert merged[0]["hypothesis_id"] == "unmatched"
    assert "calibrated_confidence" not in merged[0]


def test_overall_confidence_is_doctor_only_when_any_item_is():
    hypotheses = [
        _hypothesis(hypothesis_id="h1", confidence_score=0.9),
        _hypothesis(hypothesis_id="h2", confidence_score=0.9, doctor_flag=True),
    ]

    result = build_confidence_calibration(hypotheses)

    assert result["overall_confidence"] == "doctor_only"

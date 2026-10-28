"""P25: Doctor Escalation Precision 2.0 (app/services/doctor_escalation_precision.py).

Deterministic, no LLM. Covers: empty/default behavior, self-only action
plan produces no doctor escalation, doctor bucket -> structured doctor
escalation, urgent trace -> urgent escalation with urgent timing,
contradiction/evidence-debt/evidence-gap context notes, population
profile context without downgrading, negative_evidence stays inert,
low/blocked confidence adds a reason code without inventing urgency,
summary counts, forbidden-wording absence, and no mutation of inputs.
"""

from app.services.doctor_escalation_precision import build_doctor_escalation_precision


_FORBIDDEN_PHRASES = [
    "you have", "diagnosed", "diagnosis", "treat", "cure", "guarantee", "guaranteed",
]


def _trace(domain, safety_level="low_confidence", doctor_flag=False, pattern_id="p1", pattern_name="Pattern",
           matched_biomarkers=None, doctor_escalation=None, evidence_gaps=None, next_best_tests=None):
    return {
        "domain": domain,
        "safety_level": safety_level,
        "doctor_flag": doctor_flag,
        "pattern_id": pattern_id,
        "pattern_name": pattern_name,
        "matched_biomarkers": matched_biomarkers or [],
        "matched_symptoms": [],
        "doctor_escalation": doctor_escalation or {"triggered": False, "reasons": []},
        "evidence_gaps": evidence_gaps or [],
        "next_best_tests": next_best_tests or [],
    }


def test_empty_input_returns_self_and_unknown_timing():
    result = build_doctor_escalation_precision()

    assert result["version"] == "p25_v1"
    assert result["overall_level"] == "self"
    assert result["recommended_timing"] == "unknown"
    assert result["escalations"] == []
    assert result["summary"] == {"urgent_count": 0, "doctor_count": 0, "practitioner_count": 0, "self_count": 0}


def test_self_only_action_plan_produces_no_doctor_escalation():
    action_plan_by_role = {"buckets": {"urgent": [], "doctor": [], "practitioner": [], "self": [{"title": "Take vitamin D"}]}}

    result = build_doctor_escalation_precision(action_plan_by_role=action_plan_by_role)

    assert result["escalations"] == []
    assert result["overall_level"] == "self"
    assert result["recommended_timing"] == "routine"
    assert result["summary"]["self_count"] == 1


def test_doctor_only_trace_becomes_structured_doctor_escalation():
    traces = [_trace("liver", safety_level="doctor_only", doctor_flag=True, matched_biomarkers=[{"name": "ALT"}, {"name": "AST"}])]

    result = build_doctor_escalation_precision(clinical_reasoning_traces=traces)

    assert result["overall_level"] == "doctor"
    escalation = result["escalations"][0]
    assert escalation["level"] == "doctor"
    assert escalation["domain"] == "liver"
    assert "doctor_flag_present" in escalation["reason_codes"]
    assert escalation["related_markers"] == ["ALT", "AST"]
    assert escalation["not_a_diagnosis"] is True


def test_urgent_trace_becomes_urgent_escalation_with_urgent_timing():
    traces = [_trace("cardiovascular", safety_level="high_confidence_urgent", doctor_flag=True)]

    result = build_doctor_escalation_precision(clinical_reasoning_traces=traces)

    assert result["overall_level"] == "urgent"
    assert result["recommended_timing"] == "urgent"
    escalation = result["escalations"][0]
    assert escalation["level"] == "urgent"
    assert escalation["recommended_timing"] == "urgent"
    assert "urgent_review_flag_present" in escalation["reason_codes"]


def test_safety_result_fallback_creates_urgent_escalation_with_no_matching_pattern():
    """A report-level safety signal not backed by any detected pattern
    (clinical_priority_planner.py has the identical fallback) must still
    surface as an escalation."""
    result = build_doctor_escalation_precision(safety_result={"urgent_review_required": True, "doctor_discussion_required": True})

    assert result["overall_level"] == "urgent"
    escalation = result["escalations"][0]
    assert escalation["domain"] == "safety"
    assert escalation["level"] == "urgent"


def test_safety_result_doctor_fallback_does_not_fire_when_a_trace_already_covers_it():
    traces = [_trace("liver", safety_level="doctor_only", doctor_flag=True)]

    result = build_doctor_escalation_precision(
        clinical_reasoning_traces=traces,
        safety_result={"doctor_discussion_required": True, "urgent_review_required": False},
    )

    # Only one escalation (liver), not a second generic "safety" one.
    assert len(result["escalations"]) == 1
    assert result["escalations"][0]["domain"] == "liver"


def test_practitioner_level_trace_produces_practitioner_escalation_with_routine_timing():
    traces = [_trace("thyroid", safety_level="moderate_confidence")]

    result = build_doctor_escalation_precision(clinical_reasoning_traces=traces)

    assert result["overall_level"] == "practitioner"
    escalation = result["escalations"][0]
    assert escalation["level"] == "practitioner"
    assert escalation["recommended_timing"] == "routine"
    assert "needs_more_context_or_testing" in escalation["reason_codes"]


def test_contradiction_adds_limitation_reason_code_and_upgrades_timing_to_prompt():
    traces = [_trace("liver", safety_level="doctor_only", doctor_flag=True)]
    clinical_contradictions = {"contradictions": [{"domain": "liver", "message": "Recent illness may confound this."}]}

    result = build_doctor_escalation_precision(clinical_reasoning_traces=traces, clinical_contradictions=clinical_contradictions)

    escalation = result["escalations"][0]
    assert "confidence_limited_by_contradiction" in escalation["reason_codes"]
    assert escalation["related_contradictions"] == ["Recent illness may confound this."]
    assert escalation["recommended_timing"] == "prompt"


def test_evidence_debt_adds_uncertainty_reason_code():
    traces = [_trace("liver", safety_level="doctor_only", doctor_flag=True)]
    evidence_debt = {"domain_debt": [{"domain": "liver", "debt_level": "high"}]}

    result = build_doctor_escalation_precision(clinical_reasoning_traces=traces, evidence_debt=evidence_debt)

    escalation = result["escalations"][0]
    assert "confidence_limited_by_missing_context" in escalation["reason_codes"]
    assert escalation["recommended_timing"] == "prompt"


def test_evidence_gaps_high_priority_adds_uncertainty_reason_code():
    traces = [_trace("liver", safety_level="doctor_only", doctor_flag=True)]
    evidence_gaps = {"gaps": [{"domain": "liver", "missing_marker": "ggt", "priority": "high"}]}

    result = build_doctor_escalation_precision(clinical_reasoning_traces=traces, evidence_gaps=evidence_gaps)

    assert "confidence_limited_by_missing_context" in result["escalations"][0]["reason_codes"]


def test_population_profile_adds_context_but_never_downgrades():
    traces = [_trace("liver", safety_level="doctor_only", doctor_flag=True)]
    population_profile_selection = {"active_profile_ids": ["longevity_metabolic_optimization"]}
    population_profile_overlays = {
        "profiles": [
            {
                "profile_id": "longevity_metabolic_optimization",
                "focus_domains": ["liver", "metabolic_health"],
                # Even if a profile itself downgraded ITS OWN priority
                # adjustment for this domain, that must have zero effect
                # on the escalation level here.
                "priority_adjustments": [{"domain": "liver", "profile_emphasis": "downgraded_due_to_contradiction"}],
            }
        ]
    }

    result = build_doctor_escalation_precision(
        clinical_reasoning_traces=traces,
        population_profile_selection=population_profile_selection,
        population_profile_overlays=population_profile_overlays,
    )

    escalation = result["escalations"][0]
    assert escalation["level"] == "doctor"  # unchanged
    assert escalation["related_profiles"] == ["longevity_metabolic_optimization"]


def test_population_profile_not_active_is_not_attached():
    traces = [_trace("liver", safety_level="doctor_only", doctor_flag=True)]
    population_profile_selection = {"active_profile_ids": []}  # not active
    population_profile_overlays = {"profiles": [{"profile_id": "longevity_metabolic_optimization", "focus_domains": ["liver"]}]}

    result = build_doctor_escalation_precision(
        clinical_reasoning_traces=traces,
        population_profile_selection=population_profile_selection,
        population_profile_overlays=population_profile_overlays,
    )

    assert result["escalations"][0]["related_profiles"] == []


def test_negative_evidence_never_creates_an_escalation():
    negative_evidence = {
        "stable_domains": [{"domain": "kidney", "status": "no_strong_signal_detected"}],
        "under_tested_domains": [{"domain": "liver", "status": "under_tested"}],
    }

    result = build_doctor_escalation_precision(negative_evidence=negative_evidence)

    assert result["escalations"] == []
    assert result["overall_level"] == "self"


def test_low_confidence_adds_reason_code_without_inventing_urgency():
    traces = [_trace("liver", safety_level="doctor_only", doctor_flag=True)]
    clinical_hypotheses = {"hypotheses": [{"hypothesis_id": "h1", "domain": "liver", "calibrated_confidence": "low"}]}

    result = build_doctor_escalation_precision(clinical_reasoning_traces=traces, clinical_hypotheses=clinical_hypotheses)

    escalation = result["escalations"][0]
    assert escalation["level"] == "doctor"  # not escalated to urgent
    assert "confidence_limited_by_calibration" in escalation["reason_codes"]
    assert escalation["related_hypotheses"] == ["h1"]


def test_low_confidence_alone_never_creates_an_escalation():
    """Confidence calibration is context-only -- it must never be able to
    create a doctor/urgent escalation on a domain with no existing
    safety/doctor signal."""
    clinical_hypotheses = {"hypotheses": [{"hypothesis_id": "h1", "domain": "liver", "calibrated_confidence": "blocked"}]}

    result = build_doctor_escalation_precision(clinical_hypotheses=clinical_hypotheses)

    assert result["escalations"] == []
    assert result["overall_level"] == "self"


def test_evidence_debt_alone_never_creates_an_escalation():
    evidence_debt = {"domain_debt": [{"domain": "liver", "debt_level": "blocked"}]}

    result = build_doctor_escalation_precision(evidence_debt=evidence_debt)

    assert result["escalations"] == []


def test_summary_counts_correct_across_levels():
    traces = [
        _trace("cardiovascular", safety_level="high_confidence_urgent", doctor_flag=True, pattern_id="p-urgent"),
        _trace("liver", safety_level="doctor_only", doctor_flag=True, pattern_id="p-doctor"),
        _trace("thyroid", safety_level="moderate_confidence", pattern_id="p-practitioner"),
    ]
    action_plan_by_role = {"buckets": {"urgent": [], "doctor": [], "practitioner": [], "self": [{"title": "a"}, {"title": "b"}]}}

    result = build_doctor_escalation_precision(clinical_reasoning_traces=traces, action_plan_by_role=action_plan_by_role)

    assert result["summary"] == {"urgent_count": 1, "doctor_count": 1, "practitioner_count": 1, "self_count": 2}
    assert result["overall_level"] == "urgent"


def test_forbidden_wording_absent_from_generated_text():
    traces = [_trace(
        "liver", safety_level="doctor_only", doctor_flag=True,
        doctor_escalation={"triggered": True, "reasons": ["ALT is markedly elevated — discuss promptly with a doctor."]},
    )]
    clinical_contradictions = {"contradictions": [{"domain": "liver", "message": "Recent illness may limit interpretation."}]}
    evidence_debt = {"domain_debt": [{"domain": "liver", "debt_level": "blocked"}]}

    result = build_doctor_escalation_precision(
        clinical_reasoning_traces=traces,
        clinical_contradictions=clinical_contradictions,
        evidence_debt=evidence_debt,
    )

    text_blob = " ".join(
        [e["human_readable_reason"] for e in result["escalations"]]
        + [reason for e in result["escalations"] for reason in e["pattern_escalation_reasons"]]
        + [msg for e in result["escalations"] for msg in e["related_contradictions"]]
    ).lower()

    for phrase in _FORBIDDEN_PHRASES:
        assert phrase not in text_blob, f"forbidden phrase found: {phrase}"


def test_malformed_input_does_not_crash():
    result = build_doctor_escalation_precision(
        action_plan_by_role={"buckets": "bad"},
        safety_result="bad",
        clinical_hypotheses={"hypotheses": ["bad", None, 42, {}]},
        clinical_contradictions={"contradictions": "bad"},
        evidence_gaps={"gaps": ["bad", None, {}]},
        negative_evidence={"stable_domains": "bad"},
        evidence_debt={"domain_debt": ["bad", None, {}]},
        population_profile_selection="bad",
        population_profile_overlays={"profiles": "bad"},
        clinical_reasoning_traces=["bad", None, 42, {}],
    )

    assert isinstance(result["escalations"], list)


def test_does_not_mutate_inputs():
    trace = _trace("liver", safety_level="doctor_only", doctor_flag=True, matched_biomarkers=[{"name": "ALT"}])
    traces = [trace]
    trace_copy = _trace("liver", safety_level="doctor_only", doctor_flag=True, matched_biomarkers=[{"name": "ALT"}])
    hypothesis = {"hypothesis_id": "h1", "domain": "liver", "calibrated_confidence": "low"}
    clinical_hypotheses = {"hypotheses": [hypothesis]}
    contradiction = {"domain": "liver", "message": "Recent illness."}
    clinical_contradictions = {"contradictions": [contradiction]}

    build_doctor_escalation_precision(
        clinical_reasoning_traces=traces,
        clinical_hypotheses=clinical_hypotheses,
        clinical_contradictions=clinical_contradictions,
    )

    assert trace == trace_copy
    assert hypothesis == {"hypothesis_id": "h1", "domain": "liver", "calibrated_confidence": "low"}
    assert contradiction == {"domain": "liver", "message": "Recent illness."}

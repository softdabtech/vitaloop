"""P23: Report Quality Audit (app/services/report_quality_audit.py).

Deterministic, no LLM. Covers audit_status derivation, reasoning-layer
status detection, domain coverage aggregation, quality flags, cost/
safety audit, and forbidden-wording absence.
"""

from app.services.report_quality_audit import build_report_quality_audit


_FORBIDDEN_PHRASES = [
    "diagnosis", "you have", "disease", "healthy", "unhealthy", "cured", "treated", "guaranteed",
]


def _biomarkers(n=10):
    return [{"name": f"marker{i}", "canonical_name": f"marker{i}", "value": 1, "status": "OPTIMAL"} for i in range(n)]


def test_full_report_with_multiple_layers_returns_complete_or_limited():
    result = build_report_quality_audit(
        biomarkers=_biomarkers(10),
        symptoms=["fatigue"],
        clinical_hypotheses={"hypotheses": [{"domain": "iron_status", "calibrated_confidence": "high"}]},
        clinical_contradictions={"contradictions": []},
        confidence_calibration={"calibrated_items": [{}]},
        negative_evidence={"stable_domains": [{"domain": "kidney"}], "under_tested_domains": []},
        progress_intelligence={"available": True, "changes": [{}]},
        personal_baseline={"markers": [{}]},
        intervention_memory={"active_interventions": [{}], "completed_interventions": []},
        outcome_attribution={"attributions": []},
        evidence_debt={"domain_debt": [{"domain": "iron_status", "debt_level": "low"}], "overall_debt": "low"},
        action_plan_by_role={"urgent": [], "doctor": [], "practitioner": [], "self": [{}]},
        next_test_funnel={"summary": {"total_pending": 2}},
        evidence_gaps={"gaps": []},
        safety_result={"risk_level": "routine"},
        version_provenance={"pipeline_version": "x"},
        cost_metadata={"estimated": True},
    )

    assert result["audit_status"] in {"complete", "complete_with_limitations"}
    assert result["report_reproducibility"]["snapshot_persisted"] is True


def test_missing_optional_layers_produce_missing_status_no_crash():
    result = build_report_quality_audit(biomarkers=_biomarkers(10))

    layer_names = {l["layer"]: l for l in result["reasoning_layers"]}
    assert layer_names["clinical_hypotheses"]["status"] == "missing"
    assert layer_names["outcome_attribution"]["status"] == "missing"
    assert isinstance(result["domain_coverage"], list)


def test_empty_biomarkers_creates_low_marker_count_flag_and_blocked_status():
    result = build_report_quality_audit(biomarkers=[])

    codes = [f["code"] for f in result["quality_flags"]]
    assert "low_marker_count" in codes
    assert result["audit_status"] == "blocked"


def test_high_evidence_debt_creates_quality_flag():
    result = build_report_quality_audit(
        biomarkers=_biomarkers(10),
        evidence_debt={"domain_debt": [], "overall_debt": "high"},
    )

    codes = [f["code"] for f in result["quality_flags"]]
    assert "high_evidence_debt" in codes


def test_contradictions_create_unresolved_contradictions_flag():
    result = build_report_quality_audit(
        biomarkers=_biomarkers(10),
        clinical_contradictions={"contradictions": [{"domain": "liver", "message": "x"}]},
    )

    codes = [f["code"] for f in result["quality_flags"]]
    assert "unresolved_contradictions" in codes


def test_doctor_only_items_create_safety_audit_counts():
    result = build_report_quality_audit(
        biomarkers=_biomarkers(10),
        clinical_hypotheses={"hypotheses": [{"domain": "thyroid", "doctor_only": True}]},
        action_plan_by_role={"urgent": [{}], "doctor": [{}, {}], "practitioner": [], "self": []},
    )

    assert result["safety_audit"]["doctor_only_items"] == 1
    assert result["safety_audit"]["urgent_count"] == 1
    assert result["safety_audit"]["doctor_count"] == 2
    codes = [f["code"] for f in result["quality_flags"]]
    assert "doctor_only_items_present" in codes


def test_no_intervention_context_creates_limitation_flag_but_not_failure():
    result = build_report_quality_audit(
        biomarkers=_biomarkers(10),
        intervention_memory={"active_interventions": [], "completed_interventions": []},
    )

    codes = [f["code"] for f in result["quality_flags"]]
    assert "missing_intervention_context" in codes
    assert result["audit_status"] != "blocked"


def test_domain_coverage_aggregates_counts_correctly():
    result = build_report_quality_audit(
        biomarkers=_biomarkers(10),
        clinical_hypotheses={"hypotheses": [{"domain": "thyroid"}]},
        evidence_gaps={"gaps": [{"domain": "thyroid", "missing_marker": "free_t4"}, {"domain": "thyroid", "missing_marker": "free_t3"}]},
        evidence_debt={"domain_debt": [{"domain": "thyroid", "debt_level": "high"}], "overall_debt": "high"},
    )

    thyroid = next(d for d in result["domain_coverage"] if d["domain"] == "thyroid")
    assert thyroid["signals"]["hypotheses"] == 1
    assert thyroid["signals"]["evidence_gaps"] == 2
    assert thyroid["signals"]["debt_level"] == "high"


def test_domain_with_no_signal_is_omitted_from_coverage():
    result = build_report_quality_audit(biomarkers=_biomarkers(10))

    domains = [d["domain"] for d in result["domain_coverage"]]
    assert "kidney" not in domains


def test_cost_audit_uses_unknown_when_data_unavailable():
    result = build_report_quality_audit(biomarkers=_biomarkers(10))

    assert result["cost_audit"]["llm_used"] is None
    assert result["cost_audit"]["model"] is None
    codes = [f["code"] for f in result["quality_flags"]]
    assert "llm_usage_unknown" in codes


def test_cost_audit_infers_llm_used_from_cost_metadata():
    result = build_report_quality_audit(biomarkers=_biomarkers(10), cost_metadata={"estimated": False})

    assert result["cost_audit"]["llm_used"] is True


def test_snapshot_not_persisted_creates_critical_flag_and_partial_status():
    result = build_report_quality_audit(biomarkers=_biomarkers(10), snapshot_will_persist=False)

    codes = [f["code"] for f in result["quality_flags"]]
    assert "frozen_snapshot_missing" in codes
    assert result["audit_status"] == "partial"


def test_forbidden_wording_absent():
    result = build_report_quality_audit(
        biomarkers=[],
        clinical_hypotheses={"hypotheses": [{"domain": "thyroid", "doctor_only": True}]},
        clinical_contradictions={"contradictions": [{"domain": "liver", "message": "x"}]},
        evidence_debt={"domain_debt": [], "overall_debt": "blocked"},
        snapshot_will_persist=False,
    )

    text_blob = " ".join(f["message"] for f in result["quality_flags"]).lower()
    for phrase in _FORBIDDEN_PHRASES:
        assert phrase not in text_blob, f"forbidden phrase found: {phrase}"


def test_malformed_inputs_do_not_crash():
    result = build_report_quality_audit(
        biomarkers="not_a_list",
        symptoms=None,
        clinical_hypotheses={"hypotheses": "not_a_list"},
        clinical_contradictions="not_a_dict",
        negative_evidence={"stable_domains": None, "under_tested_domains": 42},
        progress_intelligence="bad",
        personal_baseline=None,
        intervention_memory={"active_interventions": "bad"},
        outcome_attribution=None,
        evidence_debt={"domain_debt": "bad"},
        action_plan_by_role=None,
        next_test_funnel={"summary": "bad"},
        evidence_gaps=None,
    )

    assert isinstance(result["reasoning_layers"], list)
    assert isinstance(result["domain_coverage"], list)


def test_progress_intelligence_skipped_when_unavailable():
    result = build_report_quality_audit(
        biomarkers=_biomarkers(10),
        progress_intelligence={"available": False, "changes": []},
    )

    layer = next(l for l in result["reasoning_layers"] if l["layer"] == "progress_intelligence")
    assert layer["status"] == "skipped"

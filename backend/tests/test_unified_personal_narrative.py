import copy

from app.services.case_synthesis import build_unified_personal_narrative
from app.services.report_history import assemble_frozen_response


BIOMARKER = {
    "canonical_name": "canonical_hemoglobin",
    "name": "Hemoglobin",
    "value": 89,
    "unit": "g/L",
    "status": "DEFICIENT",
}


def _evidence(*, status="DEFICIENT"):
    return [{
        "type": "biomarker",
        "id": "canonical_hemoglobin",
        "label": "Hemoglobin",
        "value": 89,
        "unit": "g/L",
        "status": status,
        "availability": "observed",
    }]


def _synthesis():
    return {
        "version": "case_synthesis_v1",
        "what_was_found": [{"text": "Hemoglobin is 89 g/L (DEFICIENT).", "evidence": _evidence()}],
        "symptom_connections": [{
            "text": "Fatigue overlaps with this finding; this is a correlation to review, not proof of cause.",
            "evidence": [
                {"type": "symptom", "id": "fatigue", "label": "Fatigue", "availability": "reported"},
                *_evidence(),
            ],
        }],
        "contradictions_and_limits": [{
            "text": "Missing transferrin saturation limits confidence in the iron interpretation.",
            "evidence": [{"type": "biomarker", "id": "transferrin_saturation", "label": "transferrin saturation", "availability": "missing"}],
        }],
        "missing_information": [{
            "text": "transferrin_saturation: add this marker to reduce uncertainty.",
            "evidence": [{"type": "biomarker", "id": "transferrin_saturation", "label": "transferrin saturation", "availability": "missing"}],
        }],
        "actions_now": [{"text": "Discuss Hemoglobin with a clinician.", "evidence": _evidence()}],
        "clinician_discussion": [],
        "retest_plan": [{"text": "Recheck Hemoglobin at the next clinical review.", "evidence": _evidence()}],
    }


def _build(**overrides):
    values = {
        "case_synthesis": _synthesis(),
        "safety_result": {
            "version": "safety_v1",
            "risk_level": "high",
            "prominent_user_warning": "Very low hemoglobin requires prompt medical review.",
            "urgent_review_required": True,
        },
        "doctor_escalation_precision": {"version": "p25_v1", "escalations": []},
        "trend_analysis": {"version": "trend_engine_v1", "available": False, "priority_changes": []},
        "evidence_gaps": {"version": "evidence_gaps_v1", "gaps": []},
        "version_provenance": {"pipeline_version": "pipeline_v1", "safety_engine_version": "safety_v1"},
        "report_id": "upload-1",
    }
    values.update(overrides)
    return build_unified_personal_narrative(**values)


def test_all_seven_sections_exist():
    narrative = _build()
    assert {
        "headline",
        "what_we_found",
        "how_it_connects_to_you",
        "what_changed_over_time",
        "what_we_are_not_sure_about",
        "why_this_is_priority",
        "what_to_do_next",
    } <= narrative.keys()


def test_safety_precedence_overrides_reassuring_wording():
    narrative = _build()
    assert "medical review" in narrative["headline"]["text"].lower()
    assert narrative["headline"]["safety_level"] == "high"
    assert narrative["what_to_do_next"][0]["safety_level"] == "high"


def test_unevaluated_marker_is_not_a_reference_derived_finding():
    synthesis = _synthesis()
    synthesis["what_was_found"] = [{
        "text": "Ferritin is low.",
        "evidence": [{
            "type": "biomarker",
            "id": "canonical_ferritin",
            "label": "Ferritin",
            "value": 60,
            "unit": "ng/mL",
            "status": "UNEVALUATED",
            "availability": "observed",
        }],
    }]
    narrative = _build(case_synthesis=synthesis)
    assert narrative["what_we_found"] == []


def test_symptom_connection_retains_contextual_non_causal_text():
    narrative = _build()
    text = narrative["how_it_connects_to_you"][0]["text"].lower()
    assert "correlation" in text
    assert "proof of cause" in text
    assert narrative["how_it_connects_to_you"][0]["related_symptoms"] == ["fatigue"]


def test_trend_is_omitted_without_history():
    assert _build()["what_changed_over_time"] == []


def test_trend_requires_comparable_dated_measurements():
    trend = {
        "version": "trend_engine_v1",
        "available": True,
        "priority_changes": [
            {"canonical_name": "canonical_hemoglobin", "name": "Hemoglobin", "direction": "falling", "percent_change": -12},
            {"canonical_name": "canonical_ferritin", "name": "Ferritin", "direction": "stable", "percent_change": 1, "previous_measured_at": "2026-01-01", "current_measured_at": "2026-10-01", "unit": "ng/mL", "current_value": 60, "previous_value": 59},
        ],
    }
    changes = _build(trend_analysis=trend)["what_changed_over_time"]
    assert len(changes) == 1
    assert changes[0]["related_markers"] == ["canonical_ferritin"]


def test_material_gap_and_existing_actions_are_preserved():
    narrative = _build()
    assert narrative["what_we_are_not_sure_about"]
    assert "transferrin saturation" in narrative["what_we_are_not_sure_about"][0]["text"]
    assert narrative["what_to_do_next"]
    assert all(item["source_type"] in {"case_synthesis", "safety_result"} for item in narrative["what_to_do_next"])


def test_frozen_read_exposes_snapshot_and_legacy_read_returns_none():
    narrative = _build()
    row = {
        "status": "completed",
        "knowledge_report": {},
        "protocol": {},
        "safety_result": {},
        "input_snapshot": {"biomarkers": [], "unified_personal_narrative": narrative},
        "explainability": {},
    }
    response = assemble_frozen_response(
        upload_id="upload-1",
        biomarkers=[],
        protocol_recommendations=[],
        report_version=row,
        user_profile={"age": 99},
        locale="en",
    )
    assert response["unified_personal_narrative"] == narrative
    assert assemble_frozen_response(
        upload_id="legacy",
        biomarkers=[],
        protocol_recommendations=[],
        report_version={**row, "input_snapshot": {"biomarkers": []}},
        user_profile={"age": 99},
        locale="en",
    )["unified_personal_narrative"] is None


def test_narrative_snapshot_is_not_mutated_by_later_generation():
    first = _build()
    before = copy.deepcopy(first)
    second = _build(report_id="upload-2")
    assert first == before
    assert first["provenance"]["report_id"] != second["provenance"]["report_id"]
    assert first["version"] == second["version"]
    assert "diagnos" not in str(second).lower()

import pytest

from app.services.case_synthesis import build_case_synthesis
from app.services.confidence_calibration import build_confidence_calibration
from app.services.lab_analysis_pipeline import run_lab_analysis_pipeline
from app.services.symptom_analysis import (
    SYMPTOM_ANALYSIS_VERSION,
    apply_symptom_priority,
    build_symptom_analysis,
)
from app.services.symptom_snapshot import build_legacy_questionnaire_snapshot


BIOMARKERS = [
    {
        "name": "Ferritin",
        "canonical_name": "canonical_ferritin",
        "value": 8,
        "unit": "ng/mL",
        "status": "DEFICIENT",
    },
    {
        "name": "CRP",
        "canonical_name": "canonical_crp",
        "value": 5,
        "unit": "mg/L",
        "status": "BORDERLINE",
    },
]


def _snapshot(concept_id="fatigue", label="Fatigue", domains=None):
    return {
        "version": "symptom_snapshot_v1",
        "session_id": "session-1",
        "completed_at": "2026-10-04T08:00:00+00:00",
        "evidence": {
            "present": [
                {
                    "vitaloop_concept_id": concept_id,
                    "display_name_en": label,
                    "concept_type": "symptom",
                    "choice_id": "present",
                    "is_primary": True,
                    "domain_keys": domains or [],
                }
            ],
            "absent": [],
            "unknown": [],
        },
    }


def _absent_snapshot(concept_id="joint_pain", label="Joint pain", domains=None):
    snapshot = _snapshot(concept_id=concept_id, label=label, domains=domains)
    snapshot["evidence"]["absent"] = snapshot["evidence"].pop("present")
    snapshot["evidence"]["absent"][0]["choice_id"] = "absent"
    return snapshot


def _hypotheses():
    return [
        {
            "hypothesis_id": "inflammation_load",
            "label": "Inflammation load",
            "domain": "inflammation",
            "confidence_score": 0.8,
            "calibrated_score": 0.8,
            "calibrated_confidence": "high",
            "supporting_evidence": [{"canonical_name": "canonical_crp"}],
            "rank": 1,
        },
        {
            "hypothesis_id": "iron_status_context",
            "label": "Iron status context",
            "domain": "iron_status",
            "confidence_score": 0.62,
            "calibrated_score": 0.67,
            "calibrated_confidence": "moderate",
            "supporting_evidence": [{"canonical_name": "canonical_ferritin"}],
            "rank": 2,
        },
    ]


def test_stable_concept_matrix_links_domains_hypotheses_and_confirming_markers():
    analysis = build_symptom_analysis(
        symptom_snapshot=_snapshot(),
        hypotheses=_hypotheses(),
        biomarkers=BIOMARKERS,
    )

    assert analysis["version"] == SYMPTOM_ANALYSIS_VERSION
    assert analysis["status"] == "applied"
    row = analysis["matrix"][0]
    assert row["symptom_concept_id"] == "fatigue"
    assert "iron_status" in row["domains"]
    assert row["hypotheses"] == [
        {
            "hypothesis_id": "iron_status_context",
            "domain": "iron_status",
            "confirming_marker_ids": ["ferritin"],
        }
    ]


def test_label_wording_does_not_change_stable_concept_matching():
    first = build_symptom_analysis(
        symptom_snapshot=_snapshot(label="Fatigue"),
        hypotheses=_hypotheses(),
        biomarkers=BIOMARKERS,
    )
    second = build_symptom_analysis(
        symptom_snapshot=_snapshot(label="Completely different display wording"),
        hypotheses=_hypotheses(),
        biomarkers=BIOMARKERS,
    )

    assert first["matched_hypothesis_ids"] == second["matched_hypothesis_ids"]
    assert first["matrix"][0]["domains"] == second["matrix"][0]["domains"]


def test_symptom_priority_changes_rank_and_keeps_causal_trace():
    analysis = build_symptom_analysis(
        symptom_snapshot=_snapshot(),
        hypotheses=_hypotheses(),
        biomarkers=BIOMARKERS,
    )
    ranked, updated = apply_symptom_priority(_hypotheses(), analysis)

    assert [item["hypothesis_id"] for item in ranked] == [
        "iron_status_context",
        "inflammation_load",
    ]
    assert ranked[0]["symptom_priority"]["supporting_concept_ids"] == ["fatigue"]
    assert updated["conclusion_change"]["changed"] is True
    assert updated["priority_effects"][0]["rank_changed"] is True


def test_absent_symptom_deprioritizes_hypothesis_and_explains_change():
    analysis = build_symptom_analysis(
        symptom_snapshot=_absent_snapshot(),
        hypotheses=_hypotheses(),
        biomarkers=BIOMARKERS,
    )
    ranked, updated = apply_symptom_priority(_hypotheses(), analysis)

    assert analysis["status"] == "applied"
    assert analysis["matched_hypothesis_ids"] == []
    assert analysis["linked_hypothesis_ids"] == ["inflammation_load"]
    assert [item["hypothesis_id"] for item in ranked] == [
        "iron_status_context",
        "inflammation_load",
    ]
    assert updated["conclusion_change"]["changed"] is True
    assert updated["conclusion_change"]["explanations"][0]["effect"] == "deprioritized"
    assert updated["priority_effects"][0]["absent_concept_ids"] == ["joint_pain"]


def test_unstructured_legacy_text_is_not_a_symptom_snapshot():
    session = {
        "id": "legacy-1",
        "status": "completed",
        "completed_at": "2026-10-04T08:00:00+00:00",
        "model_version": "v2",
        "session_metadata": {
            "active_concern": "How can I find more hours in the day?",
            "summary": {},
        },
    }
    snapshot = build_legacy_questionnaire_snapshot(session)
    assert snapshot is None


def test_case_synthesis_explains_which_answer_changed_the_conclusion():
    analysis = build_symptom_analysis(
        symptom_snapshot=_snapshot(),
        hypotheses=_hypotheses(),
        biomarkers=BIOMARKERS,
    )
    ranked, analysis = apply_symptom_priority(_hypotheses(), analysis)
    synthesis = build_case_synthesis(
        biomarkers=BIOMARKERS,
        symptoms=["Fatigue"],
        clinical_hypotheses={"hypotheses": ranked},
        interpreted_report={"patterns": []},
        symptom_analysis=analysis,
    )

    assert synthesis["symptom_impact"]["changed"] is True
    assert synthesis["symptom_impact"]["concept_ids"] == ["fatigue"]
    linked = [item for item in synthesis["symptom_connections"] if item.get("relationship") == "domain_supported"]
    assert linked
    assert {ref["id"] for ref in linked[0]["evidence"]} >= {"fatigue", "canonical_ferritin"}
    iron = next(item for item in synthesis["likely_explanations"] if item["hypothesis_id"] == "iron_status_context")
    assert iron["changed_by_symptoms"] is True
    assert iron["symptom_concept_ids"] == ["fatigue"]


def test_case_synthesis_explains_when_absent_symptom_weakens_an_explanation():
    analysis = build_symptom_analysis(
        symptom_snapshot=_absent_snapshot(),
        hypotheses=_hypotheses(),
        biomarkers=BIOMARKERS,
    )
    ranked, analysis = apply_symptom_priority(_hypotheses(), analysis)
    synthesis = build_case_synthesis(
        biomarkers=BIOMARKERS,
        symptoms=[],
        clinical_hypotheses={"hypotheses": ranked},
        interpreted_report={"patterns": []},
        symptom_analysis=analysis,
    )

    connection = next(
        item
        for item in synthesis["symptom_connections"]
        if item.get("relationship") == "domain_weakened"
    )
    assert "Reported absence of Joint pain lowers the priority" in connection["text"]
    assert {item["id"] for item in connection["evidence"]} >= {"joint_pain", "canonical_crp"}


def test_case_synthesis_gives_stable_panel_a_specific_baseline_action():
    synthesis = build_case_synthesis(
        biomarkers=[
            {
                "name": "Hemoglobin",
                "canonical_name": "canonical_hemoglobin",
                "value": 13.5,
                "unit": "g/dL",
                "status": "OPTIMAL",
            }
        ],
        symptoms=[],
        interpreted_report={"patterns": []},
    )

    action = synthesis["actions_now"][0]
    assert "Hemoglobin is 13.5 g/dL" in action["text"]
    assert action["priority"] == "routine"
    assert action["timeframe"] == "next_routine_review"
    assert action["evidence"][0]["id"] == "canonical_hemoglobin"


def test_confidence_calibration_uses_stable_match_even_when_label_does_not_match_pattern_text():
    hypotheses = [_hypotheses()[1]]
    patterns = [{
        "pattern_id": "iron_status_context",
        "domain": "iron_status",
        "symptom_signal": [],
    }]
    analysis = build_symptom_analysis(
        symptom_snapshot=_snapshot(label="Display label unrelated to aliases"),
        hypotheses=hypotheses,
        biomarkers=BIOMARKERS,
    )
    calibration = build_confidence_calibration(
        hypotheses,
        patterns=patterns,
        symptoms=[],
        symptom_analysis=analysis,
    )

    assert "supportive_symptom_match" in calibration["calibrated_items"][0]["reason_codes"]
    assert "Stable symptom concepts support this pattern." in calibration["calibrated_items"][0]["positive_factors"]


def test_unmapped_text_cannot_trigger_legacy_symptom_matching_when_p2_contract_exists():
    hypotheses = [_hypotheses()[1]]
    patterns = [{
        "pattern_id": "iron_status_context",
        "domain": "iron_status",
        "symptom_signal": ["fatigue"],
    }]
    analysis = build_symptom_analysis(
        symptom_snapshot=_snapshot(concept_id="unmapped_symptom_1234", label="fatigue"),
        hypotheses=hypotheses,
        biomarkers=BIOMARKERS,
    )
    calibration = build_confidence_calibration(
        hypotheses,
        patterns=patterns,
        symptoms=["fatigue"],
        symptom_analysis=analysis,
    )

    assert analysis["status"] == "no_mapped_concepts"
    assert "supportive_symptom_match" not in calibration["calibrated_items"][0]["reason_codes"]


@pytest.mark.asyncio
async def test_pipeline_exposes_and_freezes_p2_contract(monkeypatch):
    from app.services import lab_analysis_pipeline
    from app.services import supabase_service as svc

    async def no_history(_user_id):
        return []

    saved = {}

    async def save_report_version(**kwargs):
        saved.update(kwargs)
        return {"id": "report-p2", **kwargs}

    monkeypatch.setattr(lab_analysis_pipeline, "_load_historical_biomarkers", no_history)
    monkeypatch.setattr(svc, "save_report_version", save_report_version)
    result = await run_lab_analysis_pipeline(
        biomarkers=[
            {"name": "Ferritin", "value": 8, "unit": "ng/mL", "ref_low": 15, "ref_high": 150, "status": "DEFICIENT"},
            {"name": "Hemoglobin", "value": 11, "unit": "g/dL", "ref_low": 12, "ref_high": 15.5, "status": "DEFICIENT"},
        ],
        symptom_snapshot=_snapshot(),
        user_profile={"age": 35, "sex": "female", "height_cm": 168, "weight_kg": 62},
        user_id="user-p2",
        analysis_id="upload-p2",
        source_metadata={"source": "report_regeneration"},
        persist_report_version=True,
        generate_ai_protocol=False,
    )

    assert result["analysis_status"] == "completed", result.get("analysis_input_quality_gate")
    assert result["symptom_analysis"]["version"] == SYMPTOM_ANALYSIS_VERSION
    assert saved["input_snapshot"]["symptom_analysis"] == result["symptom_analysis"]
    assert saved["input_snapshot"]["case_synthesis"] == result["case_synthesis"]
    assert saved["input_snapshot"]["version_provenance"]["symptom_analysis_version"] == SYMPTOM_ANALYSIS_VERSION

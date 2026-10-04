import json

import pytest

from app.services.case_synthesis import build_case_synthesis
from app.services.grounded_ai_narrative import (
    GROUNDED_AI_NARRATIVE_FIELDS,
    GROUNDED_AI_NARRATIVE_VERSION,
    NARRATIVE_FIELDS,
    build_grounded_ai_narrative,
    build_verified_narrative_context,
)
from app.services.report_history import assemble_frozen_response
from app.services.lab_analysis_pipeline import run_lab_analysis_pipeline


BIOMARKERS = [
    {
        "name": "Ferritin",
        "canonical_name": "canonical_ferritin",
        "value": 9,
        "unit": "ng/mL",
        "status": "DEFICIENT",
    },
    {
        "name": "Hemoglobin",
        "canonical_name": "canonical_hemoglobin",
        "value": 11.2,
        "unit": "g/dL",
        "status": "LOW",
    },
]


def _case_synthesis():
    return build_case_synthesis(
        biomarkers=BIOMARKERS,
        symptoms=["fatigue"],
        user_profile={"age": 37, "sex": "female"},
        interpreted_report={
            "patterns": [
                {
                    "pattern_id": "iron_status_context",
                    "pattern_name": "Iron status context",
                    "domain": "iron_status",
                    "triggered_biomarkers": BIOMARKERS,
                    "symptom_signal": ["fatigue"],
                    "next_best_steps": [
                        {
                            "key": "review_context",
                            "text": "Review the iron findings with a clinician.",
                            "timeframe": "this_week",
                            "priority": "high",
                        }
                    ],
                    "doctor_questions": [
                        "Could these iron findings relate to the reported fatigue?"
                    ],
                }
            ]
        },
        clinical_hypotheses={
            "hypotheses": [
                {
                    "hypothesis_id": "iron_status_context",
                    "label": "Iron status context",
                    "rank": 1,
                    "calibrated_confidence": "moderate",
                    "supporting_evidence": BIOMARKERS,
                    "weakening_evidence": {"contradicting_markers": []},
                }
            ]
        },
        evidence_gaps={
            "gaps": [
                {
                    "domain": "iron_status",
                    "missing_marker": "transferrin_saturation",
                    "priority": "high",
                    "suggested_next_step": "Add this marker to reduce uncertainty.",
                }
            ]
        },
        retest_suggestions=[
            {
                "marker": "Ferritin",
                "timing": "8-12 weeks",
                "reason": "Track this exact finding after clinical review.",
                "priority": "high",
            }
        ],
        locale="en",
    )


def _selection_for(context):
    selected = {}
    evidence_ids = set()
    for field in NARRATIVE_FIELDS:
        rows = context["candidates"][field]
        selected[field] = [row["statement_id"] for row in rows]
        for row in rows:
            evidence_ids.update(row["evidence_ids"])
    selected["evidence_links"] = sorted(evidence_ids)
    return selected


def test_verified_context_contains_only_closed_candidates_and_evidence_registry():
    context = build_verified_narrative_context(_case_synthesis())

    assert set(context) == {
        "context_version",
        "source_version",
        "locale",
        "candidates",
        "evidence_registry",
    }
    serialized = json.dumps(context)
    assert "canonical_ferritin" in serialized
    assert "9" in serialized
    assert "age" not in serialized
    assert "female" not in serialized
    assert set(context["candidates"]) == set(NARRATIVE_FIELDS)
    assert all(
        row["evidence_ids"]
        for field in NARRATIVE_FIELDS
        for row in context["candidates"][field]
    )


@pytest.mark.asyncio
async def test_valid_llm_selection_materializes_only_verified_report_text(monkeypatch):
    captured = {}

    async def generator(context, **_kwargs):
        captured.update(context)
        selection = _selection_for(context)
        # Reordering is allowed; authoring text is structurally impossible.
        selection["key_connections"] = list(reversed(selection["key_connections"]))
        return selection

    monkeypatch.setattr(
        "app.services.grounded_ai_narrative.is_llm_configured",
        lambda: True,
    )
    synthesis = _case_synthesis()
    result = await build_grounded_ai_narrative(
        case_synthesis=synthesis,
        user_id="user-p3",
        upload_id="upload-p3",
        generator=generator,
    )

    assert result["version"] == GROUNDED_AI_NARRATIVE_VERSION
    assert result["source"] == "llm_selection"
    assert result["grounding"]["all_statements_grounded"] is True
    assert set(GROUNDED_AI_NARRATIVE_FIELDS).issubset(result)
    verified_text = {
        row["text"]
        for field in NARRATIVE_FIELDS
        for row in captured["candidates"][field]
    }
    assert {
        row["text"]
        for field in NARRATIVE_FIELDS
        for row in result[field]
    } <= verified_text


@pytest.mark.asyncio
async def test_unknown_statement_or_evidence_forces_report_specific_fallback(monkeypatch):
    async def hallucinated_selection(context, **_kwargs):
        selection = _selection_for(context)
        selection["ranked_explanations"] = ["invented:diagnosis"]
        selection["evidence_links"].append("biomarker:invented:value")
        return selection

    monkeypatch.setattr(
        "app.services.grounded_ai_narrative.is_llm_configured",
        lambda: True,
    )
    result = await build_grounded_ai_narrative(
        case_synthesis=_case_synthesis(),
        generator=hallucinated_selection,
    )

    assert result["source"] == "deterministic_fallback"
    assert result["grounding"]["fallback_reason"].startswith("invalid_llm_selection:")
    text = " ".join(
        row["text"] for field in NARRATIVE_FIELDS for row in result[field]
    )
    assert "Ferritin" in text
    assert "9 ng/mL" in text
    assert "8-12 weeks" in text
    assert "invented" not in text
    assert all(
        item["id"] in {
            "canonical_ferritin",
            "canonical_hemoglobin",
            "fatigue",
            "transferrin_saturation",
        }
        for item in result["evidence_links"]
    )


@pytest.mark.asyncio
async def test_llm_disabled_fallback_has_complete_contract_without_wellness_copy():
    result = await build_grounded_ai_narrative(
        case_synthesis=_case_synthesis(),
        use_llm=False,
    )

    assert result["source"] == "deterministic_fallback"
    assert result["grounding"]["fallback_reason"] == "llm_generation_disabled"
    assert set(GROUNDED_AI_NARRATIVE_FIELDS).issubset(result)
    assert all(isinstance(result[field], list) for field in GROUNDED_AI_NARRATIVE_FIELDS)
    text = " ".join(row["text"] for field in NARRATIVE_FIELDS for row in result[field])
    assert "Ferritin" in text
    assert "Nutrition foundation" not in text
    assert "hydrate consistently" not in text


def test_frozen_response_returns_persisted_narrative_verbatim():
    narrative = {
        "version": GROUNDED_AI_NARRATIVE_VERSION,
        "personalized_summary": [{"text": "Frozen report-specific statement."}],
    }
    report_version = {
        "id": "report-p3",
        "status": "completed",
        "input_snapshot": {
            "biomarkers": BIOMARKERS,
            "grounded_ai_narrative": narrative,
            "version_provenance": {
                "pipeline_version": "lab_analysis_pipeline_v2",
                "grounded_ai_narrative_version": GROUNDED_AI_NARRATIVE_VERSION,
            },
        },
        "knowledge_report": {},
        "protocol": {},
        "safety_result": {"status": "approved"},
        "explainability": {},
    }

    response = assemble_frozen_response(
        upload_id="upload-p3",
        biomarkers=[],
        protocol_recommendations=[],
        report_version=report_version,
        user_profile={},
        locale="en",
    )

    assert response["grounded_ai_narrative"] == narrative
    assert response["final_analysis"]["grounded_ai_narrative"] == narrative


@pytest.mark.asyncio
async def test_pipeline_exposes_and_freezes_p3_contract(monkeypatch):
    from app.services import lab_analysis_pipeline
    from app.services import supabase_service as svc

    async def no_history(_user_id):
        return []

    saved = {}

    async def save_report_version(**kwargs):
        saved.update(kwargs)
        return {"id": "report-p3", **kwargs}

    monkeypatch.setattr(lab_analysis_pipeline, "_load_historical_biomarkers", no_history)
    monkeypatch.setattr(svc, "save_report_version", save_report_version)
    result = await run_lab_analysis_pipeline(
        biomarkers=[
            {
                "name": "Ferritin",
                "value": 9,
                "unit": "ng/mL",
                "ref_low": 15,
                "ref_high": 150,
                "status": "DEFICIENT",
            },
            {
                "name": "Hemoglobin",
                "value": 11.2,
                "unit": "g/dL",
                "ref_low": 12,
                "ref_high": 15.5,
                "status": "DEFICIENT",
            },
        ],
        symptoms=["fatigue"],
        questionnaire={"completed": True},
        user_profile={"age": 37, "sex": "female", "height_cm": 168, "weight_kg": 62},
        user_id="user-p3",
        analysis_id="upload-p3",
        source_metadata={
            "source": "report_regeneration",
            "candidates": [
                {"confidence_score": 0.99, "status": "confirmed"},
                {"confidence_score": 0.99, "status": "confirmed"},
            ],
        },
        persist_report_version=True,
        generate_ai_protocol=False,
        generate_ai_narrative=False,
    )

    narrative = result["grounded_ai_narrative"]
    assert result["analysis_status"] == "completed"
    assert narrative["version"] == GROUNDED_AI_NARRATIVE_VERSION
    assert narrative["source"] == "deterministic_fallback"
    assert narrative["grounding"]["all_statements_grounded"] is True
    assert saved["input_snapshot"]["grounded_ai_narrative"] == narrative
    assert (
        saved["input_snapshot"]["version_provenance"]["grounded_ai_narrative_version"]
        == GROUNDED_AI_NARRATIVE_VERSION
    )

import uuid

import pytest
from httpx import ASGITransport, AsyncClient

from app.dependencies import get_current_user
from app.main import app
from app.routers.analysis import analyze as analyze_router
from app.services import lab_analysis_pipeline
from app.services import supabase_service
from app.services.analysis_quality_gate import build_analysis_input_quality_gate
from app.services.analysis_candidates import candidate_to_biomarker, score_biomarker_candidate
from app.services.clinical_data_integrity import validate_clinical_data_integrity
from app.services.cost_analytics import record_analysis_cost, render_cost_metrics
from app.services.evidence_gaps import build_evidence_gaps
from app.services.safety.safety_engine import validate_protocol, validate_report
from app.utils.locale import resolve_locale


def test_score_biomarker_candidate_high_confidence():
    result = score_biomarker_candidate(
        {
            "raw_name": "Ferritin",
            "raw_value": "12",
            "raw_unit": "ng/mL",
            "raw_reference_range": "30 - 150",
            "source_row": "Ferritin 12 ng/mL 30-150",
            "deterministic_ai_agreement": True,
        }
    )

    assert result["score"] >= 0.8
    assert result["label"] == "high"
    assert "known_biomarker_name" in result["reasons"]
    assert "numeric_value" in result["reasons"]
    assert "recognized_unit" in result["reasons"]


def test_score_biomarker_candidate_low_confidence():
    result = score_biomarker_candidate({"raw_name": "Unknown marker", "raw_value": "abc"})

    assert result["score"] < 0.55
    assert result["label"] == "low"


def test_candidate_to_biomarker_converts_confirmed_row():
    biomarker = candidate_to_biomarker(
        {
            "raw_name": "Vitamin D",
            "raw_value": "22,5",
            "raw_unit": "ng/mL",
            "raw_reference_range": "30-100",
            "status": "confirmed",
        }
    )

    assert biomarker["name"] == "Vitamin D"
    assert biomarker["value"] == 22.5
    assert biomarker["unit"] == "ng/mL"


def test_clinical_data_integrity_flags_unknown_unit_and_profile_gap():
    result = validate_clinical_data_integrity(
        biomarkers=[
            {
                "name": "Ferritin",
                "canonical_name": "canonical_ferritin",
                "value": 15,
                "unit": "mg/mL",
                "ref_low": 30,
                "ref_high": 150,
            }
        ],
        profile={"age": 8, "sex": "male"},
    )

    assert result["version"] == "clinical_data_integrity_v1"
    assert result["status"] == "pass_with_warnings"
    issue_keys = {item["key"] for item in result["issues"]}
    assert "unknown_unit" in issue_keys
    assert "profile_context_incomplete" in issue_keys
    assert "pediatric_context" in issue_keys
    assert result["markers"][0]["reference_source"] == "lab_provided"


def test_analysis_input_quality_gate_requires_confirmation_for_weak_context():
    clinical_integrity = validate_clinical_data_integrity(
        biomarkers=[
            {
                "name": "Unknown",
                "canonical_name": "canonical_unknown",
                "value": 12,
                "unit": "weird",
            }
        ],
        profile={},
    )
    result = build_analysis_input_quality_gate(
        biomarkers=[{"name": "Unknown", "value": 12, "unit": "weird"}],
        candidates=[{"confidence_score": 0.4}],
        clinical_integrity=clinical_integrity,
        health_context={"readiness": {"has_biomarkers": True, "has_profile": False}},
        source_metadata={"source": "test"},
    )

    assert result["version"] == "analysis_input_quality_gate_v1"
    assert result["requires_confirmation"] is True
    assert result["decision"] in {"confirm", "block_or_confirm"}
    assert result["candidate_summary"]["low_count"] == 1


def test_analysis_input_quality_gate_high_confidence_auto_continues():
    clinical_integrity = validate_clinical_data_integrity(
        biomarkers=[
            {
                "name": "Ferritin",
                "canonical_name": "canonical_ferritin",
                "value": 80,
                "unit": "ng/mL",
                "ref_low": 30,
                "ref_high": 150,
            }
        ],
        profile={"age": 35, "sex": "female", "height_cm": 170, "weight_kg": 65},
    )
    result = build_analysis_input_quality_gate(
        biomarkers=[{"name": "Ferritin", "value": 80, "unit": "ng/mL"}],
        candidates=[{"confidence_score": 0.96}],
        clinical_integrity=clinical_integrity,
        health_context={
            "readiness": {
                "has_biomarkers": True,
                "has_profile": True,
                "has_symptoms": True,
                "has_questionnaire": True,
                "has_safety_context": True,
            }
        },
        source_metadata={"source": "test"},
    )

    assert result["label"] == "high"
    assert result["decision"] == "auto_continue"
    assert result["requires_confirmation"] is False


def test_analysis_input_quality_gate_medium_requires_confirmation_not_block():
    clinical_integrity = validate_clinical_data_integrity(
        biomarkers=[
            {
                "name": "Ferritin",
                "canonical_name": "canonical_ferritin",
                "value": 80,
                "unit": "ng/mL",
                "ref_low": 30,
                "ref_high": 150,
            }
        ],
        profile={"age": 35, "sex": "female", "height_cm": 170, "weight_kg": 65},
    )
    result = build_analysis_input_quality_gate(
        biomarkers=[{"name": "Ferritin", "value": 80, "unit": "ng/mL"}],
        candidates=[{"confidence_score": 0.65}],
        clinical_integrity=clinical_integrity,
        health_context={"readiness": {"has_biomarkers": True, "has_profile": True}},
        source_metadata={"source": "test"},
    )

    assert result["label"] == "medium"
    assert result["decision"] == "confirm"
    assert result["requires_confirmation"] is True


def test_analysis_input_quality_gate_blocks_unit_conflict_and_pediatric_profile_gap():
    clinical_integrity = validate_clinical_data_integrity(
        biomarkers=[
            {
                "name": "Ferritin",
                "canonical_name": "canonical_ferritin",
                "value": 80,
                "unit": "mg/mL",
                "ref_low": 30,
                "ref_high": 150,
            }
        ],
        profile={"age": 8, "sex": "male"},
    )
    result = build_analysis_input_quality_gate(
        biomarkers=[{"name": "Ferritin", "value": 80, "unit": "mg/mL"}],
        candidates=[{"confidence_score": 0.92}],
        clinical_integrity=clinical_integrity,
        health_context={"readiness": {"has_biomarkers": True, "has_profile": False}},
        source_metadata={"source": "test"},
    )

    blocker_keys = {item["key"] for item in result["blockers"]}
    assert result["decision"] == "block_or_confirm"
    assert "unit_or_plausibility_conflict" in blocker_keys
    assert "pediatric_profile_safety_gap" in blocker_keys


def test_evidence_gaps_identifies_missing_domain_markers():
    result = build_evidence_gaps(
        biomarkers=[
            {
                "name": "Mean Reticulocyte Volume",
                "canonical_name": "canonical_mean_reticulocyte_volume",
                "value": 91.9,
                "unit": "fL",
            }
        ],
        health_states={"states": [{"domain": "blood_count", "score": 56, "risk_level": "monitor"}]},
        interpreted_report={"patterns": [{"domain": "blood_count", "missing_context": ["CBC context"]}]},
        clinical_integrity={"issues": []},
    )

    assert result["version"] == "evidence_gaps_v1"
    missing_markers = {item["missing_marker"] for item in result["gaps"]}
    assert "hemoglobin" in missing_markers
    assert result["summary"]["gap_count"] >= 1


def test_safety_engine_flags_dangerous_values_and_sensitive_supplements():
    result = validate_report(
        biomarkers=[
            {"name": "Glucose", "value": 320, "unit": "mg/dL", "status": "ELEVATED"},
        ],
        knowledge_report={"summary": {"headline": "Educational report"}},
        protocol={
            "supplements": [
                {"supplement": "Iron", "dosage": "25 mg", "rationale": "Take iron daily."},
            ]
        },
        profile={"age": 35, "sex": "female"},
    )

    assert result["status"] == "approved_with_warnings"
    assert result["doctor_discussion_required"] is True
    assert any(event["key"] == "dangerous_glucose" for event in result["safety_events"])
    assert any(warning["key"] == "iron_safety_wording" for warning in result["warnings"])


@pytest.mark.asyncio
async def test_pipeline_emits_quality_gate_integrity_evidence_gaps_and_provenance(monkeypatch):
    async def fake_evaluate_biomarkers_with_knowledge(**kwargs):
        return {
            "version": "knowledge_evaluation_test_v1",
            "matched_rules": [],
            "nutrition_context": {"version": "nutrition_algorithms_test_v1"},
        }

    def fake_build_knowledge_report(**kwargs):
        return {
            "version": "knowledge_report_test_v1",
            "summary": {"headline": "Educational report", "disclaimer": "Educational only."},
            "action_plan": [],
            "retest_plan": [],
            "doctor_discussion": [],
            "why_it_matters": [],
        }

    async def fake_resolve_domain_definitions():
        return [{"key": "blood_count", "registry_version": "domain_registry_test_v1"}]

    def fake_evaluate_health_states(**kwargs):
        return {
            "version": "health_states_test_v1",
            "domain_registry_version": "domain_registry_test_v1",
            "states": [{"domain": "blood_count", "score": 56, "risk_level": "monitor", "confidence": 0.6}],
            "top_priorities": [{"domain": "blood_count", "score": 56, "risk_level": "monitor", "confidence": 0.6}],
        }

    def fake_trends(**kwargs):
        return {"version": "trend_test_v1", "available": False, "priority_changes": []}

    async def fake_ai_protocol(**kwargs):
        return {
            "version": "ai_orchestration_test_v1",
            "status": "skipped",
            "items": [],
            "metadata": {"prompt_version": "protocol_test_v1", "model": "gpt-test"},
        }

    async def fake_load_historical_biomarkers(user_id):
        return []

    monkeypatch.setattr(lab_analysis_pipeline, "evaluate_biomarkers_with_knowledge", fake_evaluate_biomarkers_with_knowledge)
    monkeypatch.setattr(lab_analysis_pipeline, "build_knowledge_report", fake_build_knowledge_report)
    monkeypatch.setattr(lab_analysis_pipeline, "resolve_domain_definitions", fake_resolve_domain_definitions)
    monkeypatch.setattr(lab_analysis_pipeline, "evaluate_health_states", fake_evaluate_health_states)
    monkeypatch.setattr(lab_analysis_pipeline, "evaluate_biomarker_trends", fake_trends)
    monkeypatch.setattr(lab_analysis_pipeline, "generate_ai_protocol_orchestrated", fake_ai_protocol)
    monkeypatch.setattr(lab_analysis_pipeline, "_load_historical_biomarkers", fake_load_historical_biomarkers)
    monkeypatch.setattr(lab_analysis_pipeline, "record_analysis_cost", lambda **kwargs: None)

    result = await lab_analysis_pipeline.run_lab_analysis_pipeline(
        biomarkers=[
            {
                "name": "Mean Reticulocyte Volume",
                "value": 91.9,
                "unit": "fL",
                "reference_range": "92.7 - 112.1",
            },
            {
                "name": "Mean Spherical Cell Volume",
                "value": 66.6,
                "unit": "fL",
                "reference_range": "72.8 - 87.3",
            },
        ],
        user_profile={"age": 8, "sex": "male", "height_cm": 140, "weight_kg": 35},
        symptoms=["fatigue"],
        analysis_id="analysis-test",
        source_metadata={"source": "unit_test"},
        locale="uk",
        persist_knowledge=False,
        persist_report_version=False,
    )

    assert result["analysis_input_quality_gate"]["version"] == "analysis_input_quality_gate_v1"
    assert result["clinical_data_integrity"]["version"] == "clinical_data_integrity_v1"
    assert result["evidence_gaps"]["version"] == "evidence_gaps_v1"
    assert result["metadata"]["analysis_core_version"] == "lab_analysis_pipeline_v2"
    provenance = result["metadata"]["version_provenance"]
    assert provenance["pipeline_version"] == "lab_analysis_pipeline_v2"
    assert provenance["kb_version"] == "knowledge_report_test_v1"
    assert provenance["domain_registry_version"] == "domain_registry_test_v1"
    assert provenance["nutrition_rules_version"] == "nutrition_algorithms_test_v1"
    assert provenance["prompt_version"] == "protocol_test_v1"
    assert provenance["locale"] == "uk"


def test_safety_engine_uses_health_profile_safety_context():
    result = validate_report(
        biomarkers=[{"name": "LDL", "value": 170, "unit": "mg/dL"}],
        knowledge_report={"summary": {"headline": "Educational report"}},
        protocol={"supplements": [{"supplement": "Vitamin D3", "rationale": "Confirm dose with clinician."}]},
        profile={
            "age": 35,
            "pregnancy_status": "pregnant",
            "current_medications": ["metformin"],
            "current_supplements": ["magnesium"],
            "allergies": "penicillin",
            "prior_diagnoses": "hypothyroidism",
        },
    )

    event_keys = {event["key"] for event in result["safety_events"]}
    assert result["status"] == "approved_with_warnings"
    assert result["doctor_discussion_required"] is True
    assert "pregnancy_context" in event_keys
    assert "current_medications_context" in event_keys
    assert "current_supplements_context" in event_keys
    assert "known_allergies_context" in event_keys
    assert "prior_diagnoses_context" in event_keys


def test_safety_engine_does_not_treat_iron_panel_as_dosage_for_child():
    result = validate_report(
        biomarkers=[
            {"name": "Mean Reticulocyte Volume", "value": 91.9, "unit": "fL", "status": "DEFICIENT"},
        ],
        knowledge_report={"summary": {"headline": "Educational report"}},
        protocol={
            "next": [
                {
                    "title": "Repeat Iron Panel",
                    "body": "Request CBC, iron panel, ferritin, B12, folate and reticulocyte count to clarify the pattern before treatment.",
                    "requires_doctor": True,
                }
            ]
        },
        profile={"age": 8, "sex": "male"},
    )

    assert result["status"] == "approved_with_warnings"
    assert not result["blocked_items"]
    assert not any("dosage" in item["key"] for item in result["warnings"])


def test_safety_engine_blocks_diagnosis_like_wording():
    result = validate_protocol(
        [{"title": "You have anemia", "body": "Confirmed diagnosis."}],
        profile={"age": 40, "sex": "female"},
    )

    assert result["status"] == "blocked"
    assert result["blocked_items"]


def test_resolve_locale_prefers_headers_then_ua_domain():
    class Request:
        def __init__(self, headers):
            self.headers = headers

    assert resolve_locale(Request({"X-Vitaloop-Locale": "uk"})) == "uk"
    assert resolve_locale(Request({"Accept-Language": "uk-UA,uk;q=0.9,en;q=0.8"})) == "uk"
    assert resolve_locale(Request({"Referer": "https://ua.vitaloop.today/login"})) == "uk"
    assert resolve_locale(Request({})) == "en"


@pytest.mark.asyncio
async def test_save_report_version_persists_expected_payload(monkeypatch):
    captured = {}

    class _Table:
        def insert(self, payload):
            captured["payload"] = payload
            return self

        def execute(self):
            return type("Resp", (), {"data": [{"id": "report-1", **captured["payload"]}]})()

    class _Client:
        def table(self, name):
            captured["table"] = name
            return _Table()

    async def fake_run(fn):
        return fn()

    monkeypatch.setattr(supabase_service, "_get_supabase", lambda: _Client())
    monkeypatch.setattr(supabase_service, "_run", fake_run)

    result = await supabase_service.save_report_version(
        user_id="11111111-1111-1111-1111-111111111111",
        upload_id="22222222-2222-2222-2222-222222222222",
        version="report_v1",
        locale="uk",
        input_snapshot={"biomarkers": []},
        knowledge_report={"summary": {}},
        protocol={"nutrition": []},
        safety_result={"status": "approved"},
        explainability={"version": "explainability_v1"},
        interpreted_report={"version": "interpreted_report_v1"},
    )

    assert captured["table"] == "report_versions"
    assert captured["payload"]["locale"] == "uk"
    assert captured["payload"]["knowledge_report"] == {
        "summary": {},
        "interpreted_report": {"version": "interpreted_report_v1"},
    }
    assert result["id"] == "report-1"


@pytest.mark.asyncio
async def test_save_analysis_intelligence_artifacts_persists_expected_tables(monkeypatch):
    captured = []

    class _Table:
        def __init__(self, name):
            self.name = name

        def insert(self, payload):
            captured.append((self.name, payload))
            self.payload = payload
            return self

        def execute(self):
            return type("Resp", (), {"data": [{"id": f"{self.name}-1", **self.payload}]})()

    class _Client:
        def table(self, name):
            return _Table(name)

    async def fake_run(fn):
        return fn()

    monkeypatch.setattr(supabase_service, "_get_supabase", lambda: _Client())
    monkeypatch.setattr(supabase_service, "_run", fake_run)

    result = await supabase_service.save_analysis_intelligence_artifacts(
        user_id="11111111-1111-1111-1111-111111111111",
        upload_id="22222222-2222-2222-2222-222222222222",
        analysis_input_quality_gate={
            "version": "analysis_input_quality_gate_v1",
            "decision": "confirm",
            "label": "medium",
            "score": 0.72,
            "requires_confirmation": True,
            "components": {"clinical_integrity": 0.15},
            "candidate_summary": {"medium_count": 1},
            "warnings": [{"key": "medium_confidence_candidates"}],
            "blockers": [],
            "reasons": ["candidate_confidence_available"],
            "source": {"source": "unit_test"},
        },
        clinical_data_integrity={
            "version": "clinical_data_integrity_v1",
            "status": "pass_with_warnings",
            "summary": {"medium_issue_count": 1},
            "issues": [{"key": "profile_context_incomplete"}],
            "profile": {"complete": False},
            "markers": [{"name": "Ferritin"}],
        },
        evidence_gaps={
            "version": "evidence_gaps_v1",
            "gaps": [{"domain": "iron_status", "missing_marker": "ferritin"}],
            "summary": {"gap_count": 1},
        },
        health_states={
            "version": "health_state_engine_v1",
            "domain_registry_version": "managed_v1",
            "states": [{"domain": "iron_status"}],
            "top_priorities": [{"domain": "iron_status"}],
            "summary": {"state_count": 1},
        },
    )

    tables = [name for name, _payload in captured]
    assert tables == [
        "analysis_quality_gates",
        "clinical_data_integrity_events",
        "evidence_gaps",
        "health_state_versions",
    ]
    assert result["analysis_quality_gate"]["decision"] == "confirm"
    assert result["clinical_data_integrity"]["status"] == "pass_with_warnings"
    assert result["evidence_gaps"]["summary"]["gap_count"] == 1
    assert result["health_states"]["domain_registry_version"] == "managed_v1"


@pytest.mark.asyncio
async def test_pipeline_alerts_when_analysis_artifact_persistence_fails(monkeypatch):
    alerts = []

    async def fake_evaluate_biomarkers_with_knowledge(**kwargs):
        return {
            "version": "knowledge_evaluation_test_v1",
            "matched_rules": [],
            "nutrition_context": {"version": "nutrition_algorithms_test_v1"},
        }

    def fake_build_knowledge_report(**kwargs):
        return {
            "version": "knowledge_report_test_v1",
            "summary": {"headline": "Educational report", "disclaimer": "Educational only."},
            "action_plan": [],
            "retest_plan": [],
            "doctor_discussion": [],
            "why_it_matters": [],
        }

    async def fake_resolve_domain_definitions():
        return [{"key": "blood_count", "registry_version": "domain_registry_test_v1"}]

    def fake_evaluate_health_states(**kwargs):
        return {
            "version": "health_state_engine_v1",
            "domain_registry_version": "managed_v1",
            "states": [{"domain": "blood_count", "score": 56, "risk_level": "monitor", "confidence": 0.6}],
            "top_priorities": [{"domain": "blood_count", "score": 56, "risk_level": "monitor", "confidence": 0.6}],
        }

    async def fake_ai_protocol(**kwargs):
        return {
            "version": "ai_orchestration_test_v1",
            "status": "skipped",
            "items": [],
            "metadata": {"prompt_version": "protocol_test_v1", "model": "gpt-test"},
        }

    async def fake_save_report_version(**kwargs):
        return {"id": "report-version-1"}

    async def fake_save_safety_events(**kwargs):
        return []

    async def failing_save_artifacts(**kwargs):
        raise RuntimeError("stage25 table unavailable")

    async def fake_send_ops_alert(**kwargs):
        alerts.append(kwargs)
        return True

    async def fake_load_historical_biomarkers(_user_id):
        return []

    monkeypatch.setattr(lab_analysis_pipeline, "evaluate_biomarkers_with_knowledge", fake_evaluate_biomarkers_with_knowledge)
    monkeypatch.setattr(lab_analysis_pipeline, "build_knowledge_report", fake_build_knowledge_report)
    monkeypatch.setattr(lab_analysis_pipeline, "resolve_domain_definitions", fake_resolve_domain_definitions)
    monkeypatch.setattr(lab_analysis_pipeline, "evaluate_health_states", fake_evaluate_health_states)
    monkeypatch.setattr(lab_analysis_pipeline, "evaluate_biomarker_trends", lambda **kwargs: {"version": "trend_test_v1", "available": False, "priority_changes": []})
    monkeypatch.setattr(lab_analysis_pipeline, "generate_ai_protocol_orchestrated", fake_ai_protocol)
    monkeypatch.setattr(lab_analysis_pipeline, "_load_historical_biomarkers", fake_load_historical_biomarkers)
    monkeypatch.setattr(lab_analysis_pipeline, "record_analysis_cost", lambda **kwargs: None)
    monkeypatch.setattr(supabase_service, "save_report_version", fake_save_report_version)
    monkeypatch.setattr(supabase_service, "save_safety_events", fake_save_safety_events)
    monkeypatch.setattr(supabase_service, "save_analysis_intelligence_artifacts", failing_save_artifacts)
    monkeypatch.setattr("app.services.ops_alerts.send_ops_alert", fake_send_ops_alert)

    result = await lab_analysis_pipeline.run_lab_analysis_pipeline(
        biomarkers=[{"name": "Ferritin", "value": 12, "unit": "ng/mL", "reference_range": "30 - 150"}],
        user_profile={"age": 35, "sex": "female", "height_cm": 170, "weight_kg": 65},
        symptoms=["fatigue"],
        user_id="11111111-1111-1111-1111-111111111111",
        analysis_id="22222222-2222-2222-2222-222222222222",
        source_metadata={"source": "unit_test"},
        locale="en",
        persist_knowledge=False,
        persist_report_version=True,
    )

    assert result["status"] == "completed"
    assert result["report_version"]["id"] == "report-version-1"
    assert result["analysis_intelligence_artifacts"]["persisted"] is False
    assert alerts[0]["code"] == "ANALYSIS_INTELLIGENCE_ARTIFACT_PERSISTENCE_FAILED"
    assert alerts[0]["details"]["upload_id"] == "22222222-2222-2222-2222-222222222222"


@pytest.mark.asyncio
async def test_confirm_candidates_endpoint_saves_confirmed_biomarkers(monkeypatch):
    user_id = "11111111-1111-1111-1111-111111111111"
    upload_id = str(uuid.uuid4())
    candidate_id = str(uuid.uuid4())
    saved_state = {}

    async def fake_assert_upload_belongs_to_user(_upload_id, _user_id):
        assert _upload_id == upload_id
        assert _user_id == user_id
        return {"id": upload_id, "user_id": user_id}

    async def fake_update_candidates(**kwargs):
        assert kwargs["upload_id"] == upload_id
        return [
            {
                "id": candidate_id,
                "status": "confirmed",
                "raw_name": "Ferritin",
                "raw_value": "12",
                "raw_unit": "ng/mL",
                "raw_reference_range": "30-150",
                "parsed_value": 12,
            }
        ]

    async def fake_save_biomarkers(upload_id, user_id, biomarkers):
        saved_state["biomarkers"] = biomarkers
        return [
            {
                "name": "Ferritin",
                "value": 12.0,
                "unit": "ng/mL",
                "status": "DEFICIENT",
                "category": "minerals",
            }
        ]

    async def fake_get_user_profile(_user_id):
        return {"age": 35, "sex": "female", "height_cm": 170, "weight_kg": 65}

    async def fake_pipeline(**kwargs):
        assert kwargs["persist_report_version"] is True
        return {
            "knowledge_report": {"locale": kwargs["locale"]},
            "protocol": {},
            "safety_result": {"status": "approved"},
            "explainability": {"version": "explainability_v1"},
            "report_version": {"id": "report-1"},
        }

    monkeypatch.setattr(analyze_router, "assert_upload_belongs_to_user", fake_assert_upload_belongs_to_user)
    monkeypatch.setattr(analyze_router, "update_biomarker_extraction_candidates", fake_update_candidates)
    monkeypatch.setattr(analyze_router, "save_biomarkers", fake_save_biomarkers)
    monkeypatch.setattr(analyze_router, "get_user_profile", fake_get_user_profile)
    monkeypatch.setattr(analyze_router, "run_lab_analysis_pipeline", fake_pipeline)
    app.dependency_overrides[get_current_user] = lambda: {"sub": user_id}

    try:
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            response = await client.post(
                f"/analyze/{upload_id}/confirm-candidates",
                headers={"X-Vitaloop-Locale": "uk"},
                json={"candidates": [{"id": candidate_id, "status": "confirmed"}]},
            )
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 200
    assert saved_state["biomarkers"][0]["name"] == "Ferritin"
    assert response.json()["knowledge_report"]["locale"] == "uk"


@pytest.mark.asyncio
async def test_regenerate_results_persists_requested_locale(monkeypatch):
    user_id = "11111111-1111-1111-1111-111111111111"
    upload_id = str(uuid.uuid4())
    captured = {}

    async def fake_assert_upload_belongs_to_user(_upload_id, _user_id):
        assert _upload_id == upload_id
        assert _user_id == user_id
        return {"id": upload_id, "user_id": user_id}

    async def fake_get_biomarkers_by_upload(_upload_id, _user_id):
        return [{"name": "Ferritin", "value": 12.0, "unit": "ng/mL", "status": "DEFICIENT"}]

    async def fake_get_user_profile(_user_id):
        return {"age": 35, "sex": "female", "height_cm": 170, "weight_kg": 65}

    async def fake_get_protocol_by_upload(_user_id, _upload_id):
        return {"recommendations": []}

    async def fake_write_audit_log(**kwargs):
        captured["audit"] = kwargs

    async def fake_pipeline(**kwargs):
        captured["pipeline"] = kwargs
        return {
            "recommendations": [{"title": "План харчування"}],
            "knowledge_evaluation": {"matched_rules": []},
            "knowledge_report": {"locale": kwargs["locale"]},
            "protocol": {"nutrition": []},
            "safety_result": {"status": "approved"},
            "explainability": {"version": "explainability_v1"},
            "report_version": {"id": "report-uk-1", "locale": kwargs["locale"]},
        }

    monkeypatch.setattr(analyze_router, "assert_upload_belongs_to_user", fake_assert_upload_belongs_to_user)
    monkeypatch.setattr(analyze_router, "get_biomarkers_by_upload", fake_get_biomarkers_by_upload)
    monkeypatch.setattr(analyze_router, "get_user_profile", fake_get_user_profile)
    monkeypatch.setattr(analyze_router, "get_protocol_by_upload", fake_get_protocol_by_upload)
    monkeypatch.setattr(analyze_router, "write_audit_log", fake_write_audit_log)
    monkeypatch.setattr(analyze_router, "run_lab_analysis_pipeline", fake_pipeline)
    app.dependency_overrides[get_current_user] = lambda: {"sub": user_id}

    try:
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            response = await client.post(
                f"/analyze/{upload_id}/regenerate",
                headers={"X-Vitaloop-Locale": "uk"},
            )
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 200
    assert captured["pipeline"]["locale"] == "uk"
    assert captured["pipeline"]["persist_report_version"] is True
    assert captured["pipeline"]["source_metadata"]["source"] == "report_regeneration"
    assert response.json()["knowledge_report"]["locale"] == "uk"
    assert response.json()["report_version"]["id"] == "report-uk-1"
    assert captured["audit"]["new_value"]["locale"] == "uk"


def test_cost_analytics_renders_prometheus_metrics():
    record_analysis_cost(
        source="report_regeneration",
        locale="uk",
        analysis_id="analysis-cost-test",
        cost_metadata={
            "ai_prompt_tokens": 100,
            "ai_completion_tokens": 50,
            "ai_total_tokens": 150,
            "estimated_cost_usd": 0.001,
            "estimated": True,
            "model": "gpt-4o-mini",
        },
    )

    metrics = render_cost_metrics()
    assert "vitaloop_analysis_cost_estimated_usd_total" in metrics
    assert 'source="report_regeneration"' in metrics
    assert 'locale="uk"' in metrics
    assert "analysis-cost-test" in metrics

import uuid

import pytest
from httpx import ASGITransport, AsyncClient

from app.dependencies import get_current_user
from app.main import app
from app.routers.analysis import analyze as analyze_router
from app.services import supabase_service
from app.services.analysis_candidates import candidate_to_biomarker, score_biomarker_candidate
from app.services.cost_analytics import record_analysis_cost, render_cost_metrics
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
    )

    assert captured["table"] == "report_versions"
    assert captured["payload"]["locale"] == "uk"
    assert captured["payload"]["knowledge_report"] == {"summary": {}}
    assert result["id"] == "report-1"


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

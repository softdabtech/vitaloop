import pytest
from fastapi import HTTPException

from app.schemas.b2b.analyze_labs import B2BAnalyzeLabsRequest
from app.services.b2b import analyze_labs as svc
from app.services.partners.auth import PartnerPrincipal, require_scope, resolve_partner_from_api_key


def _principal(scopes=None):
    return PartnerPrincipal(
        partner_id="partner-1",
        partner_slug="smartlab",
        key_id="key-1",
        scopes=scopes or ["labs:analyze"],
    )


def _payload(**overrides):
    data = {
        "external_user_id": "external-user-1",
        "biomarkers": [
            {"name": "Ferritin", "value": 12, "unit": "ng/mL", "reference_range": "30-150"},
            {"name": "Glucose", "value": 92, "unit": "mg/dL", "reference_range": "70-100"},
        ],
        "symptoms": ["fatigue"],
        "metadata": {"partner_id": "spoofed-partner"},
    }
    data.update(overrides)
    return B2BAnalyzeLabsRequest.model_validate(data)


@pytest.fixture(autouse=True)
def reset_rate_limiter(monkeypatch):
    async def noop_rate_limit(principal):
        return None

    monkeypatch.setattr(svc, "enforce_b2b_rate_limits", noop_rate_limit)


@pytest.mark.asyncio
async def test_successful_json_analysis(monkeypatch):
    calls = {}

    async def fake_upsert_patient(partner_id, external_user_id, profile=None):
        calls["patient"] = (partner_id, external_user_id)
        return {"id": "patient-1"}

    async def fake_insert_lab(row):
        calls["insert_lab"] = row
        return {"id": "analysis-1"}

    async def fake_pipeline(**kwargs):
        calls["pipeline"] = kwargs
        return {
            "analysis_id": kwargs["analysis_id"],
            "status": "completed",
            "health_summary": {"risk_level": "needs_attention", "disclaimer": "D"},
            "prioritized_biomarkers": [
                {
                    "name": "Ferritin",
                    "canonical_name": "ferritin",
                    "value": 12,
                    "unit": "ng/mL",
                    "status": "DEFICIENT",
                    "category": "nutrients",
                    "priority": "high",
                    "rationale": "Low",
                    "reference_range": "30-150",
                }
            ],
            "risks_flags": [],
            "recommendations": [],
            "protocol": {"nutrition": [], "supplements": [], "lifestyle": [], "training_recovery": []},
            "retest_suggestions": [],
            "doctor_summary": "Discuss ferritin.",
            "knowledge_evaluation": {"matched_rules": []},
            "knowledge_report": {"summary": {"disclaimer": "D"}},
            "disclaimer": "D",
            "normalized_biomarkers": [{"canonical_name": "canonical_ferritin", "name": "Ferritin", "value": 12, "unit": "ng/mL"}],
            "metadata": {},
        }

    async def noop(*args, **kwargs):
        return {}

    async def no_cached_response(**kwargs):
        return None

    async def fake_partner_config(partner_id):
        return {"biomarker_mappings": {"partner ferritin": "ferritin"}, "retention_days": 30}

    monkeypatch.setattr(svc, "_upsert_partner_patient", fake_upsert_patient)
    monkeypatch.setattr(svc, "_insert_partner_lab_result", fake_insert_lab)
    monkeypatch.setattr(svc, "_find_cached_response", no_cached_response)
    monkeypatch.setattr(svc, "_load_partner_pilot_config", fake_partner_config)
    monkeypatch.setattr(svc, "run_lab_analysis_pipeline", fake_pipeline)
    monkeypatch.setattr(svc, "_replace_partner_biomarkers", noop)
    monkeypatch.setattr(svc, "_insert_partner_insight", noop)
    monkeypatch.setattr(svc, "_update_partner_lab_result", noop)
    monkeypatch.setattr(svc, "_track_usage", noop)
    monkeypatch.setattr(svc, "_write_b2b_audit", noop)
    monkeypatch.setattr(svc, "_mark_api_key_used", noop)

    result = await svc.analyze_labs_for_partner(
        request=_payload(),
        principal=_principal(),
        idempotency_key="idem-1",
        request_headers={"cf-ray": "ray", "cf-connecting-ip": "203.0.113.10"},
        client_host="127.0.0.1",
    )

    assert result["analysis_id"] == "analysis-1"
    assert result["status"] == "completed"
    assert result["disclaimer"] == "D"
    assert calls["patient"] == ("partner-1", "external-user-1")
    assert calls["pipeline"]["source_metadata"]["partner_id"] == "partner-1"
    assert calls["pipeline"]["source_metadata"]["external_user_id"] == "external-user-1"
    assert calls["pipeline"]["source_metadata"]["api_version"] == "v1"
    assert calls["pipeline"]["biomarker_name_aliases"] == {"partner ferritin": "ferritin"}
    assert calls["insert_lab"]["raw_payload"]["raw_payload_minimized"] is True
    assert calls["insert_lab"]["raw_payload"]["retention_days"] == 30


@pytest.mark.asyncio
async def test_invalid_api_key(monkeypatch):
    async def missing_key(_hash):
        return None

    monkeypatch.setattr("app.services.partners.auth._fetch_partner_key_record", missing_key)

    with pytest.raises(HTTPException) as exc:
        await resolve_partner_from_api_key("bad-key")
    assert exc.value.status_code == 401


def test_missing_labs_analyze_scope():
    with pytest.raises(HTTPException) as exc:
        require_scope(_principal(scopes=["results:write"]), "labs:analyze")
    assert exc.value.status_code == 403


@pytest.mark.asyncio
async def test_partner_isolation_uses_principal_partner(monkeypatch):
    async def fake_cached(**kwargs):
        return {
            "analysis_id": "cached-1",
            "status": "completed",
            "health_summary": {},
            "prioritized_biomarkers": [],
            "risks_flags": [],
            "recommendations": [],
            "protocol": {"nutrition": [], "supplements": [], "lifestyle": [], "training_recovery": []},
            "retest_suggestions": [],
            "doctor_summary": "",
            "knowledge_evaluation": None,
            "disclaimer": "D",
            "metadata": {"partner_id": kwargs["partner_id"]},
        }

    monkeypatch.setattr(svc, "_find_cached_response", fake_cached)
    async def noop_audit(**kwargs):
        return None

    monkeypatch.setattr(svc, "_write_b2b_audit", noop_audit)
    result = await svc.analyze_labs_for_partner(
        request=_payload(idempotency_key="idem-2"),
        principal=_principal(),
        idempotency_key=None,
    )
    assert result["metadata"]["partner_id"] == "partner-1"


@pytest.mark.asyncio
async def test_duplicate_idempotency_request(monkeypatch):
    async def fake_cached(**kwargs):
        return {
            "analysis_id": "analysis-previous",
            "status": "completed",
            "health_summary": {},
            "prioritized_biomarkers": [],
            "risks_flags": [],
            "recommendations": [],
            "protocol": {"nutrition": [], "supplements": [], "lifestyle": [], "training_recovery": []},
            "retest_suggestions": [],
            "doctor_summary": "",
            "knowledge_evaluation": None,
            "disclaimer": "D",
            "metadata": {"idempotent_replay": True},
        }

    monkeypatch.setattr(svc, "_find_cached_response", fake_cached)
    async def noop_audit(**kwargs):
        return None

    monkeypatch.setattr(svc, "_write_b2b_audit", noop_audit)
    result = await svc.analyze_labs_for_partner(
        request=_payload(),
        principal=_principal(),
        idempotency_key="idem-previous",
    )
    assert result["analysis_id"] == "analysis-previous"
    assert result["metadata"]["idempotent_replay"] is True


@pytest.mark.asyncio
async def test_invalid_biomarker_unit():
    with pytest.raises(HTTPException) as exc:
        await svc.analyze_labs_for_partner(
            request=_payload(biomarkers=[{"name": "Ferritin", "value": 12, "unit": "bananas"}]),
            principal=_principal(),
            idempotency_key=None,
        )
    assert exc.value.status_code == 422
    assert exc.value.detail["code"] == "INVALID_BIOMARKER_UNIT"


@pytest.mark.asyncio
async def test_failure_persists_failed_status(monkeypatch):
    calls = {}

    async def fake_upsert_patient(partner_id, external_user_id, profile=None):
        return {"id": "patient-1"}

    async def fake_insert_lab(row):
        return {"id": "analysis-failed"}

    async def fake_partner_config(partner_id):
        return {"biomarker_mappings": {}, "retention_days": 90}

    async def fake_pipeline(**kwargs):
        raise RuntimeError("pipeline unavailable")

    async def fake_mark_failed(partner_lab_result_id, *, error):
        calls["failed"] = (partner_lab_result_id, str(error))

    async def noop(*args, **kwargs):
        return {}

    monkeypatch.setattr(svc, "_upsert_partner_patient", fake_upsert_patient)
    monkeypatch.setattr(svc, "_insert_partner_lab_result", fake_insert_lab)
    monkeypatch.setattr(svc, "_load_partner_pilot_config", fake_partner_config)
    monkeypatch.setattr(svc, "run_lab_analysis_pipeline", fake_pipeline)
    monkeypatch.setattr(svc, "_mark_partner_lab_result_failed", fake_mark_failed)
    monkeypatch.setattr(svc, "_write_b2b_audit", noop)
    monkeypatch.setattr(svc, "_mark_api_key_used", noop)

    with pytest.raises(RuntimeError):
        await svc.analyze_labs_for_partner(request=_payload(), principal=_principal(), idempotency_key=None)

    assert calls["failed"][0] == "analysis-failed"
    assert "pipeline unavailable" in calls["failed"][1]


@pytest.mark.asyncio
async def test_partner_ip_allowlist_blocks_untrusted_ip(monkeypatch):
    async def noop_audit(**kwargs):
        return None

    monkeypatch.setattr(svc, "_write_b2b_audit", noop_audit)
    principal = _principal()
    principal.allowed_ips = ["198.51.100.0/24"]

    with pytest.raises(HTTPException) as exc:
        await svc.analyze_labs_for_partner(
            request=_payload(),
            principal=principal,
            idempotency_key=None,
            request_headers={"cf-ray": "ray", "cf-connecting-ip": "203.0.113.10"},
            client_host="127.0.0.1",
        )
    assert exc.value.status_code == 403
    assert exc.value.detail["code"] == "IP_NOT_ALLOWED"


@pytest.mark.asyncio
async def test_output_contains_disclaimer(monkeypatch):
    async def fake_eval(**kwargs):
        return None

    monkeypatch.setattr("app.services.lab_analysis_pipeline.evaluate_biomarkers_with_knowledge", fake_eval)
    result = await svc.run_lab_analysis_pipeline(
        biomarkers=[{"name": "Ferritin", "value": 12, "unit": "ng/mL", "reference_range": "30-150"}],
        symptoms=[],
        analysis_id="analysis-1",
    )
    assert "diagnosis" in result["disclaimer"].lower()


@pytest.mark.asyncio
async def test_pipeline_fills_empty_protocol_sections_for_flagged_markers(monkeypatch):
    async def fake_eval(**kwargs):
        return {"matched_rules": [], "safety_alerts": [], "generated_recommendations": []}

    monkeypatch.setattr("app.services.lab_analysis_pipeline.evaluate_biomarkers_with_knowledge", fake_eval)
    result = await svc.run_lab_analysis_pipeline(
        biomarkers=[{"name": "Ferritin", "value": 12, "unit": "ng/mL", "reference_range": "30-150"}],
        symptoms=[],
        analysis_id="analysis-1",
        generate_ai_protocol=False,
    )
    assert result["protocol"]["nutrition"]
    assert result["protocol"]["training_recovery"]
    assert result["protocol"]["training_recovery"][0]["source"] == "vitaloop_analysis_core"
    assert result["protocol"]["training_recovery"][0]["based_on"]["biomarkers"]
    assert result["protocol"]["training_recovery"][0]["expected_timeline"]
    assert result["protocol"]["training_recovery"][0]["retest_markers"]
    assert result["protocol"]["training_recovery"][0]["protocol_enrichment_version"] == "protocol_enrichment_v1"
    assert result["ai_orchestration"]["status"] == "skipped"
    assert result["shopping_links"]
    assert any("iherb.com/search" in item["url"] for item in result["shopping_links"])
    assert any("clinician" in item["disclaimer"].lower() for item in result["shopping_links"])


@pytest.mark.asyncio
async def test_pipeline_strips_placeholder_source_urls(monkeypatch):
    async def fake_eval(**kwargs):
        return {
            "matched_rules": [
                {
                    "rule_key": "rule_low_ferritin",
                    "name": "Low ferritin",
                    "summary": "Low ferritin should be reviewed.",
                    "risk": "possible_low_iron_store_pattern",
                    "severity": "moderate",
                    "confidence": 0.7,
                    "requires_doctor": False,
                    "source": "clinical_guideline_placeholder",
                    "source_url": "https://example.org/iron-context",
                }
            ],
            "safety_alerts": [],
            "generated_recommendations": [],
            "source_references": [
                {"source": "clinical_guideline_placeholder", "source_url": "https://example.org/iron-context"}
            ],
        }

    monkeypatch.setattr("app.services.lab_analysis_pipeline.evaluate_biomarkers_with_knowledge", fake_eval)
    result = await svc.run_lab_analysis_pipeline(
        biomarkers=[{"name": "Ferritin", "value": 12, "unit": "ng/mL", "reference_range": "30-150"}],
        symptoms=[],
        analysis_id="analysis-1",
        generate_ai_protocol=False,
    )
    assert result["knowledge_report"]["why_it_matters"][0]["source_url"] is None
    assert result["knowledge_report"]["source_references"][0]["source_url"] is None
    assert result["knowledge_evaluation"]["matched_rules"][0]["source_url"] is None


@pytest.mark.asyncio
async def test_b2c_pipeline_shape_not_broken(monkeypatch):
    captured = {}

    async def fake_eval(**kwargs):
        captured["kwargs"] = kwargs
        return {"matched_rules": [], "safety_alerts": [], "generated_recommendations": []}

    async def fake_history(_user_id):
        return [
            {
                "upload_id": "previous-upload",
                "name": "Glucose",
                "value": 82,
                "unit": "mg/dL",
                "status": "OPTIMAL",
                "created_at": "2026-01-01T00:00:00Z",
            }
        ]

    async def fake_ai_orchestration(**_kwargs):
        return {
            "version": "ai_orchestration_v1",
            "status": "completed",
            "items": [{"supplement": "Protein", "priority": "low", "rationale": "Support recovery."}],
            "metadata": {"analysis_source": "llm", "fallback_used": False},
        }

    monkeypatch.setattr("app.services.lab_analysis_pipeline.evaluate_biomarkers_with_knowledge", fake_eval)
    monkeypatch.setattr("app.services.lab_analysis_pipeline._load_historical_biomarkers", fake_history)
    monkeypatch.setattr("app.services.lab_analysis_pipeline.generate_ai_protocol_orchestrated", fake_ai_orchestration)
    result = await svc.run_lab_analysis_pipeline(
        biomarkers=[{"name": "Glucose", "value": 92, "unit": "mg/dL", "status": "OPTIMAL"}],
        symptoms=["fatigue"],
        questionnaire={"domain_scores": {"sleep": 70}},
        user_profile={"age": 37, "current_medications": ["metformin"]},
        user_id="user-1",
        analysis_id="upload-1",
    )
    assert result["status"] == "completed"
    assert result["knowledge_report"]["version"] == "knowledge_report_v1"
    assert result["normalized_biomarkers"][0]["name"] == "Glucose"
    assert result["normalized_biomarkers"][0]["canonical_name"] == "canonical_glucose"
    assert result["cost_metadata"]["estimated"] is True
    assert result["health_context"]["version"] == "health_context_v1"
    assert result["health_states"]["version"] == "health_state_engine_v1"
    assert result["trend_analysis"]["version"] == "trend_engine_v1"
    assert result["trend_analysis"]["available"] is True
    assert result["health_summary"]["trend_overview"]["version"] == "trend_engine_v1"
    assert result["health_summary"]["health_state_overview"]["version"] == "health_state_engine_v1"
    assert result["protocol"]["supplements"][0]["protocol_enrichment_version"] == "protocol_enrichment_v1"
    assert result["ai_orchestration"]["version"] == "ai_orchestration_v1"
    assert result["metadata"]["ai_orchestration_version"] == "ai_orchestration_v1"
    assert result["quality_snapshot"]["version"] == "analysis_quality_snapshot_v1"
    assert result["metadata"]["quality_snapshot_version"] == "analysis_quality_snapshot_v1"
    assert result["quality_snapshot"]["coverage"]["protocol_item_count"] >= 1
    assert result["metadata"]["health_context_version"] == "health_context_v1"
    assert captured["kwargs"]["health_context"]["readiness"]["has_questionnaire"] is True
    assert captured["kwargs"]["health_context"]["readiness"]["has_safety_context"] is True


@pytest.mark.asyncio
async def test_pipeline_persists_core_artifacts_in_report_version(monkeypatch):
    captured = {}

    async def fake_eval(**_kwargs):
        return {"matched_rules": [], "safety_alerts": [], "generated_recommendations": []}

    async def fake_history(_user_id):
        return []

    async def fake_ai_orchestration(**_kwargs):
        return {
            "version": "ai_orchestration_v1",
            "status": "completed",
            "items": [],
            "metadata": {"analysis_source": "fallback", "fallback_used": True, "item_count": 0},
        }

    async def fake_save_report_version(**kwargs):
        captured["report_version"] = kwargs
        return {"id": "report-1"}

    async def fake_save_safety_events(**kwargs):
        captured["safety_events"] = kwargs

    monkeypatch.setattr("app.services.lab_analysis_pipeline.evaluate_biomarkers_with_knowledge", fake_eval)
    monkeypatch.setattr("app.services.lab_analysis_pipeline._load_historical_biomarkers", fake_history)
    monkeypatch.setattr("app.services.lab_analysis_pipeline.generate_ai_protocol_orchestrated", fake_ai_orchestration)
    monkeypatch.setattr("app.services.supabase_service.save_report_version", fake_save_report_version)
    monkeypatch.setattr("app.services.supabase_service.save_safety_events", fake_save_safety_events)

    result = await svc.run_lab_analysis_pipeline(
        biomarkers=[{"name": "Ferritin", "value": 12, "unit": "ng/mL", "reference_range": "30-150"}],
        symptoms=["fatigue"],
        user_profile={"age": 37},
        user_id="user-1",
        analysis_id="upload-1",
        persist_report_version=True,
        generate_ai_protocol=True,
    )

    snapshot = captured["report_version"]["input_snapshot"]
    assert result["report_version"] == {"id": "report-1"}
    assert snapshot["health_context"]["version"] == "health_context_v1"
    assert snapshot["health_states"]["version"] == "health_state_engine_v1"
    assert snapshot["trend_analysis"]["version"] == "trend_engine_v1"
    assert snapshot["ai_orchestration"]["version"] == "ai_orchestration_v1"
    assert snapshot["quality_snapshot"]["version"] == "analysis_quality_snapshot_v1"


@pytest.mark.asyncio
async def test_b2b_usage_tracks_quality_snapshot(monkeypatch):
    captured = {}

    class _Table:
        def insert(self, row):
            captured["row"] = row
            return self

        def execute(self):
            return type("Resp", (), {"data": [captured["row"]]})()

    class _Client:
        def table(self, name):
            captured["table"] = name
            return _Table()

    async def fake_run(fn):
        return fn()

    monkeypatch.setattr(svc.supabase, "_get_supabase", lambda: _Client())
    monkeypatch.setattr(svc.supabase, "_run", fake_run)

    await svc._track_usage(
        partner_id="partner-1",
        api_key_id="key-1",
        partner_lab_result_id="lab-1",
        cost_metadata={"ai_prompt_tokens": 10, "ai_completion_tokens": 20, "estimated_cost_usd": 0.001},
        quality_snapshot={"version": "analysis_quality_snapshot_v1"},
        biomarker_count=2,
        request_hash="hash-1",
    )

    assert captured["table"] == "partner_usage_events"
    assert captured["row"]["metadata"]["quality_snapshot"]["version"] == "analysis_quality_snapshot_v1"

from __future__ import annotations

from copy import deepcopy

import pytest

from app.services import lab_analysis_pipeline
from app.services import supabase_service as supabase_service
from app.services.health_context import build_health_context
from app.services.report_history import assemble_frozen_response
from app.services.symptom_snapshot import (
    SYMPTOM_SNAPSHOT_VERSION,
    build_symptom_snapshot,
    build_controlled_questionnaire_snapshot,
    build_legacy_questionnaire_snapshot,
    load_latest_eligible_symptom_snapshot,
    public_symptom_snapshot,
    should_load_symptom_snapshot,
    symptoms_from_snapshot,
)


class _Response:
    def __init__(self, data):
        self.data = data


def _session(**overrides):
    value = {
        "id": "session-1",
        "status": "completed",
        "questionnaire_version": "symptom_check_v3",
        "provider": "infermedica_engine",
        "provider_model": "infermedica-en",
        "provider_model_version": "2026-09",
        "root_concern_id": "fatigue_low_energy",
        "primary_concept_id": "fatigue",
        "primary_provider_concept_id": "s_001",
        "overall_wellbeing": "reduced",
        "duration_bucket": "weeks_1_4",
        "provider_triage_level": "consultation",
        "provider_triage_root_cause": "consultation_condition_likely",
        "internal_safety_level": "routine",
        "provider_safety_level": "clinician_review",
        "final_safety_level": "clinician_review",
        "completed_at": "2026-09-28T07:20:00Z",
    }
    value.update(overrides)
    return value


def _evidence():
    return [
        {
            "vitaloop_concept_id": "fatigue",
            "provider_concept_id": "s_001",
            "display_name_en": "Fatigue",
            "concept_type": "symptom",
            "choice_id": "present",
            "source": "initial",
            "is_primary": True,
            "domain_keys": ["recovery_energy"],
            "provider_payload": {"must": "never be copied"},
        },
        {
            "vitaloop_concept_id": "fever",
            "provider_concept_id": "s_002",
            "display_name_en": "Fever",
            "concept_type": "symptom",
            "choice_id": "absent",
            "source": "diagnosis",
            "is_primary": False,
            "domain_keys": ["inflammation"],
        },
        {
            "vitaloop_concept_id": "dizziness",
            "provider_concept_id": "s_003",
            "display_name_en": "Dizziness",
            "concept_type": "symptom",
            "choice_id": "unknown",
            "source": "diagnosis",
            "is_primary": False,
            "domain_keys": ["cardiovascular"],
        },
    ]


def test_snapshot_requires_completed_session_and_copies_allowlisted_facts():
    assert build_symptom_snapshot(session=_session(status="active"), evidence=_evidence()) is None

    rows = _evidence()
    snapshot = build_symptom_snapshot(session=_session(), evidence=rows)
    assert snapshot["version"] == SYMPTOM_SNAPSHOT_VERSION
    assert [item["vitaloop_concept_id"] for item in snapshot["evidence"]["present"]] == ["fatigue"]
    assert [item["vitaloop_concept_id"] for item in snapshot["evidence"]["absent"]] == ["fever"]
    assert [item["vitaloop_concept_id"] for item in snapshot["evidence"]["unknown"]] == ["dizziness"]
    assert "provider_payload" not in snapshot["evidence"]["present"][0]
    rows[0]["display_name_en"] = "Changed later"
    assert snapshot["evidence"]["present"][0]["display_name_en"] == "Fatigue"


def test_controlled_questionnaire_becomes_full_immutable_snapshot():
    session = {
        "id": "legacy-1", "status": "completed", "completed_at": "2026-09-29T08:00:00Z",
        "model_version": "v2", "session_metadata": {
            "active_concern": "Fatigue, Low stamina",
            "summary": {
                "schema_version": "controlled_symptom_fallback_v1",
                "input_mode": "controlled_only",
                "overall_wellbeing": "reduced", "primary_concern_id": "energy",
                "primary_concept_id": "fatigue", "primary_signal": "Fatigue",
                "related_concept_ids": ["low_stamina"], "related_symptoms": ["Low stamina"], "duration_bucket": "weeks_1_4",
                "severity": 6, "symptom_pattern": "stable", "functional_impact": "mild",
                "domain_detail": "absent", "urgent_warning": "absent",
                "controlled_answers": {"severity": "moderate", "trajectory": "stable", "functional_impact": "mild", "domain_detail": "absent", "urgent_warning": "absent"},
            },
        },
    }
    snapshot = build_controlled_questionnaire_snapshot(session)
    assert snapshot["session_id"] == "legacy-1"
    assert snapshot["source_type"] == "controlled_symptom_check"
    assert symptoms_from_snapshot(snapshot) == ["fatigue", "low_stamina"]
    assert all(item["mapping_status"] == "mapped" for item in snapshot["evidence"]["present"])
    assert snapshot["overall_wellbeing"] == "reduced"
    assert snapshot["duration_bucket"] == "weeks_1_4"
    assert snapshot["assessment"] == {
        "severity": 6, "trajectory": "stable", "functional_impact": "mild",
        "domain_detail": "absent", "urgent_warning": "absent",
    }


@pytest.mark.asyncio
async def test_loader_falls_back_when_optional_provider_table_is_not_deployed(monkeypatch):
    controlled = {
        "id": "legacy-1", "status": "completed", "completed_at": "2026-09-29T08:00:00Z",
        "model_version": "v2", "session_metadata": {
            "active_concern": "Fatigue",
            "summary": {
                "schema_version": "controlled_symptom_fallback_v1", "input_mode": "controlled_only",
                "primary_concern_id": "energy", "primary_concept_id": "fatigue",
                "primary_signal": "Fatigue", "related_concept_ids": [], "related_symptoms": [],
                "overall_wellbeing": "reduced", "duration_bucket": "weeks_1_4",
                "severity": 6, "symptom_pattern": "stable", "functional_impact": "mild",
                "domain_detail": "absent", "urgent_warning": "absent",
                "controlled_answers": {"severity": "moderate", "trajectory": "stable", "functional_impact": "mild", "domain_detail": "absent", "urgent_warning": "absent"},
            },
        },
    }
    calls = 0

    async def fake_run(operation):
        nonlocal calls
        calls += 1
        if calls == 1:
            raise RuntimeError(
                "{'code': 'PGRST205', 'message': \"Could not find the table "
                "'public.symptom_check_sessions' in the schema cache\"}"
            )
        return _Response([controlled])

    class _Query:
        def __getattr__(self, _name):
            return lambda *_args, **_kwargs: self

    class _Supabase:
        def table(self, _name):
            return _Query()

    monkeypatch.setattr("app.services.symptom_snapshot.svc._get_supabase", lambda: _Supabase())
    monkeypatch.setattr("app.services.symptom_snapshot.svc._run", fake_run)

    snapshot = await load_latest_eligible_symptom_snapshot("user-1")
    assert snapshot["session_id"] == "legacy-1"
    assert snapshot["source_type"] == "controlled_symptom_check"
    assert symptoms_from_snapshot(snapshot) == ["fatigue"]


@pytest.mark.asyncio
async def test_loader_rejects_unstructured_legacy_questionnaire(monkeypatch):
    legacy = {
        "id": "legacy-1", "status": "completed", "completed_at": "2026-09-29T08:00:00Z",
        "session_metadata": {"active_concern": "free text", "summary": {}},
    }
    calls = 0

    async def fake_run(operation):
        nonlocal calls
        calls += 1
        if calls == 1:
            raise RuntimeError(
                "{'code': 'PGRST205', 'message': \"Could not find the table "
                "'public.symptom_check_sessions' in the schema cache\"}"
            )
        return _Response([legacy])

    class _Query:
        def __getattr__(self, _name):
            return lambda *_args, **_kwargs: self

    class _Supabase:
        def table(self, _name):
            return _Query()

    monkeypatch.setattr("app.services.symptom_snapshot.svc._get_supabase", lambda: _Supabase())
    monkeypatch.setattr("app.services.symptom_snapshot.svc._run", fake_run)

    assert await load_latest_eligible_symptom_snapshot("user-1") is None
    assert build_legacy_questionnaire_snapshot(legacy) is None


@pytest.mark.asyncio
async def test_loader_orders_null_completion_times_after_eligible_sessions(monkeypatch):
    controlled = {
        "id": "controlled-1",
        "status": "completed",
        "completed_at": "2026-10-04T08:00:00Z",
        "session_metadata": {
            "summary": {
                "schema_version": "controlled_symptom_fallback_v1",
                "input_mode": "controlled_only",
                "overall_wellbeing": "reduced",
                "primary_concern_id": "energy",
                "primary_concept_id": "fatigue",
                "primary_signal": "Fatigue",
                "duration_bucket": "weeks_1_4",
                "symptom_pattern": "stable",
                "functional_impact": "mild",
                "domain_detail": "absent",
                "urgent_warning": "absent",
                "severity": 6,
                "controlled_answers": {
                    "severity": "moderate",
                    "trajectory": "stable",
                    "functional_impact": "mild",
                    "domain_detail": "absent",
                    "urgent_warning": "absent",
                },
            }
        },
    }
    order_calls = []
    contains_calls = []

    class _Query:
        def __init__(self, table_name):
            self.table_name = table_name

        def __getattr__(self, name):
            if name == "contains":
                def record_contains(column, value):
                    contains_calls.append((self.table_name, column, value))
                    return self

                return record_contains
            if name == "order":
                def record_order(column, **kwargs):
                    order_calls.append((self.table_name, column, kwargs))
                    return self

                return record_order
            if name == "execute":
                data = [] if self.table_name == "symptom_check_sessions" else [controlled]
                return lambda: _Response(data)
            return lambda *_args, **_kwargs: self

    class _Supabase:
        def table(self, name):
            return _Query(name)

    async def run(operation):
        return operation()

    monkeypatch.setattr("app.services.symptom_snapshot.svc._get_supabase", lambda: _Supabase())
    monkeypatch.setattr("app.services.symptom_snapshot.svc._run", run)

    snapshot = await load_latest_eligible_symptom_snapshot("user-1")

    assert snapshot["session_id"] == "controlled-1"
    assert order_calls == [
        ("symptom_check_sessions", "completed_at", {"desc": True, "nullsfirst": False}),
        ("questionnaire_sessions", "completed_at", {"desc": True, "nullsfirst": False}),
    ]
    assert contains_calls == [
        (
            "questionnaire_sessions",
            "session_metadata",
            {"summary": {"schema_version": "controlled_symptom_fallback_v1", "input_mode": "controlled_only"}},
        )
    ]


def test_legacy_bridge_uses_present_canonical_en_only():
    snapshot = build_symptom_snapshot(session=_session(), evidence=_evidence())
    assert symptoms_from_snapshot(snapshot) == ["fatigue"]


@pytest.mark.asyncio
async def test_legacy_context_helper_delegates_to_canonical_snapshot(monkeypatch):
    snapshot = build_symptom_snapshot(session=_session(), evidence=_evidence())

    async def fake_loader(_user_id):
        return snapshot

    monkeypatch.setattr(
        "app.services.symptom_snapshot.load_latest_eligible_symptom_snapshot",
        fake_loader,
    )

    symptoms, context = await supabase_service.get_active_symptom_context("user-1")

    assert symptoms == ["fatigue"]
    assert context["symptom_snapshot"]["session_id"] == "session-1"
    assert "provider_model" not in context["symptom_snapshot"]


def test_public_projection_removes_provider_concept_and_model_ids():
    snapshot = build_symptom_snapshot(session=_session(), evidence=_evidence())
    public = public_symptom_snapshot(snapshot)
    assert "provider_model" not in public
    assert "provider_model_version" not in public
    assert "provider_concept_id" not in public["primary_concern"]
    assert all(
        "provider_concept_id" not in item
        for group in public["evidence"].values()
        for item in group
    )
    assert snapshot["primary_concern"]["provider_concept_id"] == "s_001"


def test_health_context_keeps_present_absent_unknown_separate():
    snapshot = build_symptom_snapshot(session=_session(), evidence=_evidence())
    context = build_health_context(biomarkers=[], symptom_snapshot=snapshot)
    summary = context["inputs"]["symptom_snapshot"]
    assert context["readiness"]["has_symptom_snapshot"] is True
    assert summary["evidence"]["present"]["count"] == 1
    assert summary["evidence"]["absent"]["count"] == 1
    assert summary["evidence"]["unknown"]["count"] == 1
    assert "provider_concept_id" not in str(summary)


def test_health_state_prefers_exact_approved_domain_links_and_ignores_absent_unknown():
    from app.services.health_state_engine import evaluate_health_states

    snapshot = build_symptom_snapshot(session=_session(), evidence=_evidence())
    context = build_health_context(biomarkers=[], symptom_snapshot=snapshot)
    states = evaluate_health_states(
        biomarkers=[],
        symptoms=[],
        health_context=context,
        domain_definitions=[
            {
                "key": "recovery_energy",
                "label": "Recovery",
                "marker_aliases": [],
                "symptom_aliases": ["label-that-does-not-match"],
                "required_markers": [],
                "registry_version": "test",
            },
            {
                "key": "inflammation",
                "label": "Inflammation",
                "marker_aliases": [],
                "symptom_aliases": [],
                "required_markers": [],
                "registry_version": "test",
            },
            {
                "key": "cardiovascular",
                "label": "Cardiovascular",
                "marker_aliases": [],
                "symptom_aliases": [],
                "required_markers": [],
                "registry_version": "test",
            },
        ],
    )["states"]
    by_domain = {item["domain"]: item for item in states}
    assert by_domain["recovery_energy"]["symptom_signals"] == ["fatigue"]
    assert by_domain["recovery_energy"]["risk_level"] != "unknown"
    assert by_domain["inflammation"]["symptom_signals"] == []
    assert by_domain["inflammation"]["risk_level"] == "unknown"
    assert by_domain["cardiovascular"]["symptom_signals"] == []
    assert by_domain["cardiovascular"]["risk_level"] == "unknown"


@pytest.mark.asyncio
async def test_b2c_pipeline_autoloads_snapshot_and_adds_only_present_to_legacy_symptoms(monkeypatch):
    snapshot = build_symptom_snapshot(session=_session(), evidence=_evidence())
    original = deepcopy(snapshot)

    async def fake_load(user_id):
        assert user_id == "user-1"
        return snapshot

    monkeypatch.setattr(lab_analysis_pipeline, "load_latest_eligible_symptom_snapshot", fake_load)
    result = await lab_analysis_pipeline.run_lab_analysis_pipeline(
        biomarkers=[],
        symptoms=["legacy free text"],
        symptom_context={"active_concern": "legacy free text"},
        user_id="user-1",
        source_metadata={"source": "b2c_file"},
    )
    assert result["analysis_status"] == "needs_confirmation"
    assert result["metadata"]["symptom_snapshot_present"] is True
    assert result["health_context"]["inputs"]["symptoms"]["items"] == ["fatigue"]
    assert result["health_context"]["readiness"]["has_symptom_context"] is False
    assert "fever" not in result["health_context"]["inputs"]["symptoms"]["items"]
    assert result["symptom_snapshot"]["evidence"]["unknown"][0]["display_name_en"] == "Dizziness"
    assert snapshot == original


@pytest.mark.asyncio
async def test_b2c_pipeline_does_not_use_request_symptoms_without_completed_checker(monkeypatch):
    async def no_snapshot(_user_id):
        return None

    monkeypatch.setattr(lab_analysis_pipeline, "load_latest_eligible_symptom_snapshot", no_snapshot)
    result = await lab_analysis_pipeline.run_lab_analysis_pipeline(
        biomarkers=[],
        symptoms=["free text fatigue"],
        symptom_context={"active_concern": "free text fatigue"},
        user_id="user-1",
        source_metadata={"source": "b2c_file"},
    )

    assert result["health_context"]["inputs"]["symptoms"]["items"] == []
    assert result["health_context"]["readiness"]["has_symptom_context"] is False


@pytest.mark.asyncio
async def test_non_b2c_pipeline_keeps_explicit_symptoms():
    result = await lab_analysis_pipeline.run_lab_analysis_pipeline(
        biomarkers=[],
        symptoms=["Fatigue"],
        source_metadata={"source": "b2b_api"},
    )

    assert result["health_context"]["inputs"]["symptoms"]["items"] == ["fatigue"]


def test_snapshot_loading_scope_covers_all_current_b2c_paths_not_b2b():
    sources = {
        "b2c_file",
        "b2c_text",
        "b2c_manual",
        "legacy_multipart_pdf",
        "candidate_quality_review",
        "candidate_confirmation",
        "results_read",
        "report_regeneration",
        "results_compatibility",
    }
    assert all(should_load_symptom_snapshot({"source": source}) for source in sources)
    assert not should_load_symptom_snapshot({"source": "b2b_api"})


def test_frozen_response_serves_original_snapshot_and_redacts_provider_ids():
    snapshot = build_symptom_snapshot(session=_session(), evidence=_evidence())
    report_version = {
        "id": "report-1",
        "status": "completed",
        "input_snapshot": {"symptom_snapshot": snapshot},
        "knowledge_report": {},
        "protocol": {},
        "safety_result": {},
        "explainability": {},
    }
    response = assemble_frozen_response(
        upload_id="upload-1",
        biomarkers=[],
        protocol_recommendations=[],
        report_version=report_version,
        user_profile={},
        locale="en",
    )
    served = response["symptom_snapshot"]
    assert served["session_id"] == "session-1"
    assert "provider_concept_id" not in str(served)
    assert "provider_concept_id" not in str(response["report_version"]["input_snapshot"]["symptom_snapshot"])
    assert report_version["input_snapshot"]["symptom_snapshot"]["primary_concern"]["provider_concept_id"] == "s_001"

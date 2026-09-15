"""P8 Practitioner Mode: GET /admin/clients/{client_id}/clinical-summary
(app/routers/crm/crm.py::get_client_clinical_summary).

Calls the route function directly (bypassing HTTP/ASGI) with monkeypatched
_get_membership/_get_supabase/supabase_service, matching this test suite's
existing pattern for unit-testing CRM router functions without a live
Supabase connection.
"""

from uuid import uuid4

import pytest

from app.routers.crm import crm as crm_router
from app.services import supabase_service as svc


class _AssignmentTable:
    def __init__(self, rows):
        self._rows = rows

    def select(self, *_args, **_kwargs):
        return self

    def eq(self, *_args, **_kwargs):
        return self

    def limit(self, *_args, **_kwargs):
        return self

    def execute(self):
        return type("Resp", (), {"data": self._rows})()


class _FakeClient:
    def __init__(self, assignment_rows):
        self._assignment_rows = assignment_rows

    def table(self, name):
        assert name == "practitioner_assignments"
        return _AssignmentTable(self._assignment_rows)


async def _fake_run(fn):
    return fn()


async def _make_async(value):
    return value


def _current_user(sub="practitioner-1"):
    return {"sub": sub, "app_metadata": {}}


@pytest.mark.asyncio
async def test_practitioner_without_assignment_gets_403(monkeypatch):
    org_id = uuid4()
    client_id = uuid4()

    async def fake_membership(_sb, _org_id, _user_id):
        return {"role": "practitioner"}

    monkeypatch.setattr(crm_router, "_get_membership", fake_membership)
    monkeypatch.setattr(crm_router, "_get_supabase", lambda: _make_async(_FakeClient([])))
    monkeypatch.setattr(svc, "_run", _fake_run)

    with pytest.raises(Exception) as exc_info:
        await crm_router.get_client_clinical_summary(client_id, org_id, _current_user())

    assert getattr(exc_info.value, "status_code", None) == 403


@pytest.mark.asyncio
async def test_practitioner_with_assignment_sees_summary(monkeypatch):
    org_id = uuid4()
    client_id = uuid4()

    async def fake_membership(_sb, _org_id, _user_id):
        return {"role": "practitioner"}

    async def fake_get_previous_report(_user_id, exclude_upload_id=None):
        return {
            "upload_id": "upload-1",
            "created_at": "2026-09-14T00:00:00Z",
            "safety_result": {"status": "approved", "doctor_discussion_required": True},
            "input_snapshot": {
                "clinical_reasoning_traces": [
                    {"pattern_id": "iron_deficiency_anemia", "confidence": 0.7, "doctor_flag": False},
                    {"pattern_id": "electrolyte_kidney_safety", "confidence": 0.9, "doctor_flag": True},
                ],
                "progress_intelligence": {"available": True, "changes": []},
                "evidence_gaps": {"summary": {"gap_count": 2}},
                "next_best_tests": {"recommended_tests": [{"marker": "ferritin"}]},
                "action_plan_by_role": {
                    "buckets": {"urgent": [{"title": "Electrolyte / Kidney Safety"}], "doctor": [], "practitioner": [], "self": []},
                },
            },
        }

    monkeypatch.setattr(crm_router, "_get_membership", fake_membership)
    monkeypatch.setattr(crm_router, "_get_supabase", lambda: _make_async(_FakeClient([{"id": "assignment-1"}])))
    monkeypatch.setattr(svc, "_run", _fake_run)
    monkeypatch.setattr(svc, "get_previous_report_version_for_user", fake_get_previous_report)

    result = await crm_router.get_client_clinical_summary(client_id, org_id, _current_user())

    assert result["available"] is True
    # The doctor_flag pattern must sort first regardless of confidence.
    assert result["top_patterns"][0]["pattern_id"] == "electrolyte_kidney_safety"
    assert len(result["red_flags"]) == 1
    assert result["red_flags"][0]["pattern_id"] == "electrolyte_kidney_safety"
    assert result["evidence_gaps_summary"]["gap_count"] == 2
    assert result["next_best_tests"][0]["marker"] == "ferritin"
    assert result["requires_doctor_discussion"] is True
    # P9 follow-up: same buckets the b2c report computed, passed through
    # verbatim for the practitioner.
    assert result["action_plan_by_role"]["urgent"][0]["title"] == "Electrolyte / Kidney Safety"


@pytest.mark.asyncio
async def test_org_owner_does_not_need_an_assignment(monkeypatch):
    org_id = uuid4()
    client_id = uuid4()

    async def fake_membership(_sb, _org_id, _user_id):
        return {"role": "org_owner"}

    async def fake_get_previous_report(_user_id, exclude_upload_id=None):
        return {
            "upload_id": "upload-1",
            "created_at": "2026-09-14T00:00:00Z",
            "safety_result": {},
            "input_snapshot": {"clinical_reasoning_traces": []},
        }

    # No assignment rows at all — an org_owner must still succeed, unlike a
    # practitioner in the same situation (see the 403 test above).
    monkeypatch.setattr(crm_router, "_get_membership", fake_membership)
    monkeypatch.setattr(crm_router, "_get_supabase", lambda: _make_async(_FakeClient([])))
    monkeypatch.setattr(svc, "_run", _fake_run)
    monkeypatch.setattr(svc, "get_previous_report_version_for_user", fake_get_previous_report)

    result = await crm_router.get_client_clinical_summary(client_id, org_id, _current_user(sub="owner-1"))

    assert result["available"] is True


@pytest.mark.asyncio
async def test_no_report_yet_returns_unavailable_shape(monkeypatch):
    org_id = uuid4()
    client_id = uuid4()

    async def fake_membership(_sb, _org_id, _user_id):
        return {"role": "org_owner"}

    async def fake_get_previous_report(_user_id, exclude_upload_id=None):
        return None

    monkeypatch.setattr(crm_router, "_get_membership", fake_membership)
    monkeypatch.setattr(crm_router, "_get_supabase", lambda: _make_async(_FakeClient([])))
    monkeypatch.setattr(svc, "_run", _fake_run)
    monkeypatch.setattr(svc, "get_previous_report_version_for_user", fake_get_previous_report)

    result = await crm_router.get_client_clinical_summary(client_id, org_id, _current_user(sub="owner-1"))

    assert result["available"] is False
    assert result["reason"] == "no_completed_report_for_client"


@pytest.mark.asyncio
async def test_p18b_reasoning_map_fields_pass_through_verbatim(monkeypatch):
    """P18b: the CRM Clinical Reasoning Map consumes clinical_hypotheses/
    clinical_contradictions/confidence_calibration/negative_evidence/
    personal_baseline/intervention_memory/outcome_attribution/
    evidence_debt/report_quality_audit/next_test_funnel — this endpoint
    must pass them through verbatim (capped for hypotheses/
    contradictions), never recompute."""
    org_id = uuid4()
    client_id = uuid4()

    async def fake_membership(_sb, _org_id, _user_id):
        return {"role": "org_owner"}

    async def fake_get_previous_report(_user_id, exclude_upload_id=None):
        return {
            "upload_id": "upload-1",
            "created_at": "2026-09-14T00:00:00Z",
            "safety_result": {},
            "input_snapshot": {
                "clinical_reasoning_traces": [],
                "clinical_hypotheses": {
                    "version": "hypothesis_engine_v1",
                    "hypotheses": [{"hypothesis_id": f"h{i}", "domain": "iron_status"} for i in range(8)],
                },
                "clinical_contradictions": {
                    "version": "clinical_contradictions_v1",
                    "contradictions": [{"id": f"c{i}", "domain": "iron_status"} for i in range(12)],
                },
                "confidence_calibration": {"version": "confidence_calibration_v1", "overall_confidence": "moderate"},
                "negative_evidence": {"version": "negative_evidence_v1", "stable_domains": []},
                "personal_baseline": {"version": "personal_baseline_v1", "markers": []},
                "intervention_memory": {"version": "p20_v1", "active_interventions": []},
                "outcome_attribution": {"version": "p21_v1", "attributions": []},
                "evidence_debt": {"version": "p22_v1", "overall_debt": "low"},
                "report_quality_audit": {"version": "p23_v1", "audit_status": "complete"},
                "next_test_funnel": {"version": "next_test_funnel_v1", "panel": {}},
            },
        }

    monkeypatch.setattr(crm_router, "_get_membership", fake_membership)
    monkeypatch.setattr(crm_router, "_get_supabase", lambda: _make_async(_FakeClient([])))
    monkeypatch.setattr(svc, "_run", _fake_run)
    monkeypatch.setattr(svc, "get_previous_report_version_for_user", fake_get_previous_report)

    result = await crm_router.get_client_clinical_summary(client_id, org_id, _current_user(sub="owner-1"))

    assert len(result["clinical_hypotheses"]["hypotheses"]) == 5
    assert len(result["clinical_contradictions"]["contradictions"]) == 10
    assert result["confidence_calibration"]["overall_confidence"] == "moderate"
    assert result["evidence_debt"]["overall_debt"] == "low"
    assert result["report_quality_audit"]["audit_status"] == "complete"
    assert result["next_test_funnel"]["version"] == "next_test_funnel_v1"


@pytest.mark.asyncio
async def test_p18b_reasoning_map_fields_default_to_empty_for_old_report(monkeypatch):
    """A report generated before P14-P23 existed has none of these keys —
    must degrade to empty dicts, never crash."""
    org_id = uuid4()
    client_id = uuid4()

    async def fake_membership(_sb, _org_id, _user_id):
        return {"role": "org_owner"}

    async def fake_get_previous_report(_user_id, exclude_upload_id=None):
        return {
            "upload_id": "upload-1",
            "created_at": "2026-09-14T00:00:00Z",
            "safety_result": {},
            "input_snapshot": {"clinical_reasoning_traces": []},
        }

    monkeypatch.setattr(crm_router, "_get_membership", fake_membership)
    monkeypatch.setattr(crm_router, "_get_supabase", lambda: _make_async(_FakeClient([])))
    monkeypatch.setattr(svc, "_run", _fake_run)
    monkeypatch.setattr(svc, "get_previous_report_version_for_user", fake_get_previous_report)

    result = await crm_router.get_client_clinical_summary(client_id, org_id, _current_user(sub="owner-1"))

    assert result["clinical_hypotheses"] == {}
    assert result["clinical_contradictions"] == {}
    assert result["evidence_debt"] == {}
    assert result["report_quality_audit"] == {}

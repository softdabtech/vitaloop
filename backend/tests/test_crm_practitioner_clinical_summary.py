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

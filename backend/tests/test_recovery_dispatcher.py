from copy import deepcopy
from uuid import uuid4

import pytest

from app.services import recovery_dispatcher as dispatcher
from app.services import supabase_service as svc


def _fixture():
    user_id, upload_id, report_id = (str(uuid4()), str(uuid4()), str(uuid4()))
    report = {
        "id": report_id, "user_id": user_id, "upload_id": upload_id,
        "status": "completed", "version": "report_v1", "created_at": "2026-10-16T12:00:00+00:00",
        "knowledge_report": {}, "protocol": {"lifestyle": []}, "safety_result": {}, "explainability": {},
    }
    payloads = {
        "retest_obligations": {"retest_plan": []},
        "retest_fulfillment": {"biomarkers": [], "source_metadata": {}},
        "lab_plan_fulfillment": {"biomarkers": []},
        "safety_events": {"safety_events": []},
        "intelligence_artifacts": {
            "analysis_input_quality_gate": {}, "clinical_data_integrity": {}, "evidence_gaps": {}, "health_states": {},
        },
        "protocol": {"historical_protocol": {"lifestyle": []}, "projection": []},
        "timeline": {"event_type": "lab_analyzed", "summary": "Lab report analyzed",
                     "metadata": {"upload_id": upload_id, "report_version_id": report_id, "biomarker_count": 0}},
        "audit": {"action": "create", "entity_type": "report_version", "entity_id": report_id,
                  "new_value": {"upload_id": upload_id, "biomarker_count": 0}},
    }
    return user_id, upload_id, report_id, report, payloads


def _install_happy_path(monkeypatch, *, statuses=None):
    user_id, upload_id, report_id, report, payloads = _fixture()
    statuses = statuses or {}
    completed, invoked = [], []

    async def get_report(user, report_id_arg):
        return deepcopy(report) if (user, report_id_arg) == (user_id, report_id) else None

    async def authoritative(**kwargs):
        assert kwargs == {"user_id": user_id, "upload_id": upload_id, "report_version_id": report_id}
        return {"report_version": deepcopy(report), "followup_work": [
            {"effect_type": effect, "status": statuses.get(effect, "pending"), "attempt_count": 0}
            for effect in dispatcher._EFFECT_ORDER
        ]}

    async def claim(**kwargs):
        invoked.append(("claim", kwargs["effect_type"]))
        return {"claimed": True, "status": "processing", "attempt_count": 1}

    async def payload(**kwargs):
        effect = kwargs["effect_type"]
        return {"schema": "analysis_recovery_work_payload_v1", "user_id": user_id,
                "upload_id": upload_id, "report_version_id": report_id, "effect_type": effect,
                "input_hash": "a" * 64, "data": deepcopy(payloads[effect])}

    async def complete(**kwargs):
        completed.append((kwargs["effect_type"], kwargs["status"]))
        return {"status": kwargs["status"]}

    async def noop(*_args, **_kwargs):
        return []

    monkeypatch.setattr(dispatcher.svc, "get_report_version_for_user", get_report)
    monkeypatch.setattr(dispatcher.svc, "load_authoritative_finalization_replay", authoritative)
    monkeypatch.setattr(dispatcher.svc, "claim_frozen_followup_work", claim)
    monkeypatch.setattr(dispatcher.svc, "load_frozen_followup_payload", payload)
    monkeypatch.setattr(dispatcher.svc, "complete_frozen_followup_work", complete)
    for name in ("persist_retest_obligations", "reconcile_retest_fulfillment", "reconcile_lab_plan_fulfillment",
                 "save_safety_events", "save_analysis_intelligence_artifacts", "save_protocol",
                 "save_timeline_event", "write_audit_log"):
        monkeypatch.setattr(dispatcher.svc, name, noop)
    return user_id, report_id, payloads, completed, invoked


@pytest.mark.asyncio
async def test_dispatcher_completes_exactly_the_eight_registered_handlers(monkeypatch):
    user_id, report_id, _payloads, completed, invoked = _install_happy_path(monkeypatch)
    result = await dispatcher.recover_report_followups(authenticated_user_id=user_id, report_version_id=report_id)
    assert set(result) == set(dispatcher._EFFECT_ORDER)
    assert set(result.values()) == {"completed"}
    assert completed == [(effect, "completed") for effect in dispatcher._EFFECT_ORDER]
    assert [effect for action, effect in invoked if action == "claim"] == list(dispatcher._EFFECT_ORDER)


@pytest.mark.asyncio
async def test_invalid_payload_never_reaches_a_handler_and_becomes_retryable(monkeypatch):
    user_id, report_id, payloads, completed, _ = _install_happy_path(monkeypatch)
    payloads["timeline"]["metadata"]["upload_id"] = "forged"
    result = await dispatcher.recover_report_followups(authenticated_user_id=user_id, report_version_id=report_id)
    assert result["timeline"] == "retryable"
    assert ("timeline", "retryable") in completed


@pytest.mark.asyncio
async def test_missing_authoritative_work_fails_before_any_claim(monkeypatch):
    user_id, report_id, _payloads, _completed, invoked = _install_happy_path(monkeypatch)

    async def incomplete(**_kwargs):
        # Keep the caller's authoritative report but deliberately omit one row.
        return {"report_version": await dispatcher.svc.get_report_version_for_user(user_id, report_id),
                "followup_work": [{"effect_type": effect, "status": "pending"}
                                  for effect in dispatcher._EFFECT_ORDER[:-1]]}

    monkeypatch.setattr(dispatcher.svc, "load_authoritative_finalization_replay", incomplete)
    with pytest.raises(dispatcher.RecoveryDispatchError, match="authoritative_recovery_work_incomplete"):
        await dispatcher.recover_report_followups(authenticated_user_id=user_id, report_version_id=report_id)
    assert not invoked


@pytest.mark.asyncio
async def test_crash_after_effect_write_is_retryable_without_a_completed_lease(monkeypatch):
    user_id, report_id, _payloads, completed, _ = _install_happy_path(monkeypatch)

    async def crash_after_write(**_kwargs):
        raise RuntimeError("writer interrupted")

    monkeypatch.setattr(dispatcher.svc, "save_safety_events", crash_after_write)
    result = await dispatcher.recover_report_followups(authenticated_user_id=user_id, report_version_id=report_id)
    assert result["safety_events"] == "retryable"
    assert ("safety_events", "completed") not in completed
    assert ("safety_events", "retryable") in completed


@pytest.mark.asyncio
async def test_stale_completion_is_not_reported_as_success(monkeypatch):
    user_id, report_id, _payloads, _completed, _ = _install_happy_path(monkeypatch)

    async def stale(**kwargs):
        if kwargs["effect_type"] == "protocol" and kwargs["status"] == "completed":
            raise RuntimeError("lease conflict")
        return {"status": kwargs["status"]}

    monkeypatch.setattr(dispatcher.svc, "complete_frozen_followup_work", stale)
    result = await dispatcher.recover_report_followups(authenticated_user_id=user_id, report_version_id=report_id)
    assert result["protocol"] == "lease_conflict"


@pytest.mark.asyncio
async def test_fifth_failed_attempt_is_terminal_and_does_not_loop(monkeypatch):
    user_id, report_id, _payloads, completed, _ = _install_happy_path(monkeypatch)

    async def fifth_claim(**kwargs):
        return {"claimed": True, "status": "processing", "attempt_count": 5}

    async def crash(**_kwargs):
        raise RuntimeError("retry failure")

    monkeypatch.setattr(dispatcher.svc, "claim_frozen_followup_work", fifth_claim)
    monkeypatch.setattr(dispatcher.svc, "save_safety_events", crash)
    result = await dispatcher.recover_report_followups(authenticated_user_id=user_id, report_version_id=report_id)
    assert result["safety_events"] == "failed"
    assert ("safety_events", "failed") in completed


@pytest.mark.asyncio
async def test_recovery_timeline_and_audit_are_explicitly_durable(monkeypatch):
    user_id, upload_id, report_id, report, payloads = _fixture()
    ctx = {"user_id": user_id, "upload_id": upload_id, "report_version_id": report_id, "report": report}
    calls = []

    async def timeline(*_args, **kwargs):
        calls.append(("timeline", kwargs))

    async def audit(**kwargs):
        calls.append(("audit", kwargs))

    monkeypatch.setattr(dispatcher.svc, "save_timeline_event", timeline)
    monkeypatch.setattr(dispatcher.svc, "write_audit_log", audit)
    await dispatcher._timeline(ctx, payloads["timeline"])
    await dispatcher._audit(ctx, payloads["audit"])
    assert calls == [("timeline", {"metadata": payloads["timeline"]["metadata"],
                                     "analysis_effect_key": svc.analysis_effect_key(report_id, "timeline", "lab_analyzed"),
                                     "require_durable": True}),
                     ("audit", {"user_id": user_id, "action": "create", "entity_type": "report_version",
                                "entity_id": report_id, "new_value": payloads["audit"]["new_value"],
                                "analysis_effect_key": svc.analysis_effect_key(report_id, "audit", "report_finalized"),
                                "require_durable": True})]


@pytest.mark.asyncio
async def test_durable_timeline_and_audit_writers_fail_with_stable_codes(monkeypatch):
    def unavailable():
        raise RuntimeError("provider unavailable with patient payload")

    monkeypatch.setattr(svc, "_get_supabase", unavailable)
    with pytest.raises(svc.AtomicFinalizationError, match="timeline_effect_write_failed"):
        await svc.save_timeline_event("user", "lab_analyzed", "Lab report analyzed", require_durable=True)
    with pytest.raises(svc.AtomicFinalizationError, match="audit_effect_write_failed"):
        await svc.write_audit_log(user_id="user", action="create", entity_type="report_version", require_durable=True)


@pytest.mark.asyncio
async def test_bounded_owner_trigger_recovers_only_listed_nonexcluded_reports(monkeypatch):
    user_id = str(uuid4())
    first, excluded = str(uuid4()), str(uuid4())
    calls = []

    async def listed(*, user_id: str, limit: int):
        assert limit == 4
        return [first, excluded]

    async def recover(*, authenticated_user_id: str, report_version_id: str):
        calls.append((authenticated_user_id, report_version_id))
        return {"audit": "completed"}

    monkeypatch.setattr(dispatcher.svc, "list_recoverable_followup_report_ids", listed)
    monkeypatch.setattr(dispatcher, "recover_report_followups", recover)
    out = await dispatcher.recover_pending_report_followups(
        authenticated_user_id=user_id,
        max_reports=4,
        exclude_report_version_id=excluded,
    )
    assert out == {first: {"audit": "completed"}}
    assert calls == [(user_id, first)]

"""Explicit, owner-scoped recovery of durable lab-analysis follow-up effects.

This module deliberately has no router, scheduler, daemon, or import-time side
effect. The analysis pipeline invokes its bounded owner-scoped trigger after a
confirmed finalization; callers cannot select a handler or supply work data.
"""
from __future__ import annotations

from typing import Any, Awaitable, Callable, Dict, List
from uuid import UUID, uuid4

from app.services import supabase_service as svc

MAX_RECOVERY_ATTEMPTS = 5
_EFFECT_ORDER = (
    "retest_obligations",
    "retest_fulfillment",
    "lab_plan_fulfillment",
    "safety_events",
    "intelligence_artifacts",
    "protocol",
    "timeline",
    "audit",
)


class RecoveryDispatchError(RuntimeError):
    """A non-sensitive recovery failure code suitable for the ledger."""


def _require_uuid(value: str, field: str) -> str:
    try:
        return str(UUID(str(value)))
    except (ValueError, TypeError, AttributeError) as exc:
        raise RecoveryDispatchError(f"invalid_{field}") from exc


def _data(payload: Dict[str, Any], *, effect_type: str, user_id: str, upload_id: str, report_version_id: str) -> Dict[str, Any]:
    """Defence in depth after the SQL hash/binding verifier returns the payload."""
    if (
        payload.get("schema") != "analysis_recovery_work_payload_v1"
        or payload.get("effect_type") != effect_type
        or payload.get("user_id") != user_id
        or payload.get("upload_id") != upload_id
        or payload.get("report_version_id") != report_version_id
        or not isinstance(payload.get("input_hash"), str)
        or not isinstance(payload.get("data"), dict)
    ):
        raise RecoveryDispatchError("recovery_payload_binding_invalid")
    return payload["data"]


async def _retest_obligations(ctx: Dict[str, Any], data: Dict[str, Any]) -> None:
    plan = data.get("retest_plan")
    if not isinstance(plan, list):
        raise RecoveryDispatchError("retest_payload_invalid")
    await svc.persist_retest_obligations(
        user_id=ctx["user_id"], report_version=ctx["report"], retest_plan=plan,
    )


async def _retest_fulfillment(ctx: Dict[str, Any], data: Dict[str, Any]) -> None:
    biomarkers, source = data.get("biomarkers"), data.get("source_metadata")
    if not isinstance(biomarkers, list) or not isinstance(source, dict):
        raise RecoveryDispatchError("retest_payload_invalid")
    ctx["fulfilled_retest"] = await svc.reconcile_retest_fulfillment(
        user_id=ctx["user_id"], report_version=ctx["report"], biomarkers=biomarkers,
        test_date=source.get("test_date") or source.get("collected_at"),
        date_source=source.get("date_source"), date_confidence=source.get("date_confidence"),
    )


async def _lab_plan_fulfillment(ctx: Dict[str, Any], data: Dict[str, Any]) -> None:
    biomarkers = data.get("biomarkers")
    if not isinstance(biomarkers, list):
        raise RecoveryDispatchError("lab_plan_payload_invalid")
    await svc.reconcile_lab_plan_fulfillment(
        user_id=ctx["user_id"], report_version=ctx["report"], biomarkers=biomarkers,
        fulfilled_retest_obligations=ctx.get("fulfilled_retest") or [],
    )


async def _safety_events(ctx: Dict[str, Any], data: Dict[str, Any]) -> None:
    events = data.get("safety_events")
    if not isinstance(events, list):
        raise RecoveryDispatchError("safety_payload_invalid")
    await svc.save_safety_events(
        user_id=ctx["user_id"], upload_id=ctx["upload_id"],
        report_version_id=ctx["report_version_id"], safety_events=events,
    )


async def _intelligence_artifacts(ctx: Dict[str, Any], data: Dict[str, Any]) -> None:
    fields = (
        "analysis_input_quality_gate", "clinical_data_integrity", "evidence_gaps", "health_states",
    )
    if any(key not in data or data[key] is not None and not isinstance(data[key], dict) for key in fields):
        raise RecoveryDispatchError("intelligence_payload_invalid")
    await svc.save_analysis_intelligence_artifacts(
        user_id=ctx["user_id"], upload_id=ctx["upload_id"], report_version_id=ctx["report_version_id"],
        analysis_input_quality_gate=data["analysis_input_quality_gate"],
        clinical_data_integrity=data["clinical_data_integrity"], evidence_gaps=data["evidence_gaps"],
        health_states=data["health_states"],
    )


async def _protocol(ctx: Dict[str, Any], data: Dict[str, Any]) -> None:
    # The SQL projector reloads and checks this exact frozen payload itself;
    # `recommendations` is intentionally ignored on report-scoped writes.
    if not isinstance(data.get("historical_protocol"), (dict, list)) or not isinstance(data.get("projection"), list):
        raise RecoveryDispatchError("protocol_payload_invalid")
    await svc.save_protocol(
        user_id=ctx["user_id"], upload_id=ctx["upload_id"], recommendations=[],
        report_version_id=ctx["report_version_id"],
    )


async def _timeline(ctx: Dict[str, Any], data: Dict[str, Any]) -> None:
    metadata = data.get("metadata")
    if (
        data.get("event_type") != "lab_analyzed" or data.get("summary") != "Lab report analyzed"
        or not isinstance(metadata, dict)
        or metadata.get("upload_id") != ctx["upload_id"]
        or metadata.get("report_version_id") != ctx["report_version_id"]
    ):
        raise RecoveryDispatchError("timeline_payload_invalid")
    await svc.save_timeline_event(
        ctx["user_id"], data["event_type"], data["summary"], metadata=metadata,
        analysis_effect_key=svc.analysis_effect_key(ctx["report_version_id"], "timeline", "lab_analyzed"),
        require_durable=True,
    )


async def _audit(ctx: Dict[str, Any], data: Dict[str, Any]) -> None:
    if (
        data.get("action") != "create" or data.get("entity_type") != "report_version"
        or data.get("entity_id") != ctx["report_version_id"] or not isinstance(data.get("new_value"), dict)
    ):
        raise RecoveryDispatchError("audit_payload_invalid")
    await svc.write_audit_log(
        user_id=ctx["user_id"], action="create", entity_type="report_version",
        entity_id=ctx["report_version_id"], new_value=data["new_value"],
        analysis_effect_key=svc.analysis_effect_key(ctx["report_version_id"], "audit", "report_finalized"),
        require_durable=True,
    )


_HANDLERS: Dict[str, Callable[[Dict[str, Any], Dict[str, Any]], Awaitable[None]]] = {
    "retest_obligations": _retest_obligations,
    "retest_fulfillment": _retest_fulfillment,
    "lab_plan_fulfillment": _lab_plan_fulfillment,
    "safety_events": _safety_events,
    "intelligence_artifacts": _intelligence_artifacts,
    "protocol": _protocol,
    "timeline": _timeline,
    "audit": _audit,
}


async def recover_report_followups(*, authenticated_user_id: str, report_version_id: str) -> Dict[str, str]:
    """Explicitly retry incomplete effects for one authenticated owner/report pair.

    It processes only the fixed registry above. Results contain status codes only;
    no report, payload, values, or exception text is returned or logged.
    """
    user_id = _require_uuid(authenticated_user_id, "authenticated_user_id")
    report_id = _require_uuid(report_version_id, "report_version_id")
    report = await svc.get_report_version_for_user(user_id, report_id)
    if not isinstance(report, dict) or str(report.get("id") or "") != report_id:
        raise RecoveryDispatchError("recovery_report_unavailable")
    upload_id = _require_uuid(report.get("upload_id"), "upload_id")
    authoritative = await svc.load_authoritative_finalization_replay(
        user_id=user_id, upload_id=upload_id, report_version_id=report_id,
    )
    report = authoritative.get("report_version") if isinstance(authoritative, dict) else None
    rows = authoritative.get("followup_work") if isinstance(authoritative, dict) else None
    if (
        not isinstance(report, dict)
        or str(report.get("id") or "") != report_id
        or str(report.get("user_id") or "") != user_id
        or str(report.get("upload_id") or "") != upload_id
        or not isinstance(rows, list)
    ):
        raise RecoveryDispatchError("authoritative_recovery_state_invalid")
    work = {row.get("effect_type"): row for row in rows if isinstance(row, dict)}
    if len(work) != len(rows) or set(work) != set(_EFFECT_ORDER):
        raise RecoveryDispatchError("authoritative_recovery_work_incomplete")
    ctx: Dict[str, Any] = {
        "user_id": user_id, "upload_id": upload_id, "report_version_id": report_id,
        "report": report, "fulfilled_retest": [],
    }
    outcomes: Dict[str, str] = {}
    for effect_type in _EFFECT_ORDER:
        row = work.get(effect_type) or {}
        if row.get("status") == "completed":
            outcomes[effect_type] = "completed"
            continue
        if row.get("status") == "failed":
            outcomes[effect_type] = "failed"
            continue
        lease_token = str(uuid4())
        try:
            claim = await svc.claim_frozen_followup_work(
                user_id=user_id, report_version_id=report_id, effect_type=effect_type, lease_token=lease_token,
            )
        except Exception:
            outcomes[effect_type] = "claim_failed"
            continue
        if not claim["claimed"]:
            outcomes[effect_type] = str(claim["status"])
            continue
        try:
            payload = await svc.load_frozen_followup_payload(
                user_id=user_id, report_version_id=report_id, effect_type=effect_type,
            )
            data = _data(payload, effect_type=effect_type, user_id=user_id, upload_id=upload_id, report_version_id=report_id)
            await _HANDLERS[effect_type](ctx, data)
        except Exception:
            # A failed handler has not acknowledged the durable effect. Release
            # only the lease we still own; SQL rejects an expired/stolen token.
            status = "failed" if claim["attempt_count"] >= MAX_RECOVERY_ATTEMPTS else "retryable"
            try:
                await svc.complete_frozen_followup_work(
                    user_id=user_id, report_version_id=report_id, effect_type=effect_type,
                    lease_token=lease_token, status=status, error_code="recovery_handler_failed",
                )
                outcomes[effect_type] = status
            except Exception:
                outcomes[effect_type] = "lease_conflict"
            continue
        try:
            await svc.complete_frozen_followup_work(
                user_id=user_id, report_version_id=report_id, effect_type=effect_type,
                lease_token=lease_token, status="completed",
            )
            outcomes[effect_type] = "completed"
        except Exception:
            # The effect was durably written but this dispatcher no longer owns
            # its lease. Do not issue a second completion with a stale token.
            outcomes[effect_type] = "lease_conflict"
    return outcomes


async def recover_pending_report_followups(
    *, authenticated_user_id: str, max_reports: int = 4, exclude_report_version_id: str | None = None,
) -> Dict[str, Dict[str, str]]:
    """Bounded trusted recovery trigger for an owner's orphaned work.

    It is intentionally callable only from server code that already holds the
    authenticated principal's ``sub``. The database query yields no payload or
    handler choice, and every returned report is revalidated by the exact
    owner/report-scoped dispatcher before any effect is claimed.
    """
    user_id = _require_uuid(authenticated_user_id, "authenticated_user_id")
    excluded = _require_uuid(exclude_report_version_id, "report_version_id") if exclude_report_version_id else None
    report_ids = await svc.list_recoverable_followup_report_ids(user_id=user_id, limit=max_reports)
    outcomes: Dict[str, Dict[str, str]] = {}
    for report_id in report_ids:
        if report_id == excluded:
            continue
        try:
            outcomes[report_id] = await recover_report_followups(
                authenticated_user_id=user_id,
                report_version_id=report_id,
            )
        except Exception as exc:
            # Do not log identifiers, payloads, or exception messages here.
            logger.error("pending_recovery_dispatch_failed exception_type=%s", type(exc).__name__)
    return outcomes

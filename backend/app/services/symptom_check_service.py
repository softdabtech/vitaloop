"""Server-owned workflow primitives for the structured symptom check."""

from __future__ import annotations

import hashlib
import json
import logging
import time
from datetime import datetime, timezone
from typing import Any, Awaitable, Callable

from fastapi import HTTPException, status

from app.config import settings
from app.integrations.infermedica.adapter import normalize_question, normalize_red_flag_question
from app.integrations.infermedica.client import InfermedicaClient
from app.integrations.infermedica.exceptions import InfermedicaError
from app.integrations.infermedica.schemas import ProviderAge, ProviderCaseRequest, ProviderEvidence
from app.schemas.symptom_check import (
    CreateSymptomSessionRequest,
    InitialEvidenceRequest,
    SubmitSymptomAnswersRequest,
)
from app.services import supabase_service as svc
from app.services.profile_requirements import missing_required_profile_fields
from app.services.symptom_red_flag_policy import evaluate_internal_red_flags
from app.services.symptom_safety_policy import merge_symptom_safety
from app.services.symptom_metrics import (
    record_provider_call,
    record_provider_error,
    record_mapping_miss,
    record_session_terminal,
)
from app.services.symptom_report_update import resolve_report_update_offer


logger = logging.getLogger(__name__)
CATALOG_VERSION = "symptom_catalog_v1"
QUESTIONNAIRE_VERSION = "symptom_check_v3"

_ROOT_CONCERNS: tuple[tuple[str, str], ...] = (
    ("no_current_concern", "No current concern — record how I feel today"),
    ("fatigue_low_energy", "Energy, fatigue or recovery"),
    ("sleep_unrefreshing", "Sleep or waking unrefreshed"),
    ("cognition_memory", "Focus, memory or mental clarity"),
    ("mood_stress", "Mood, anxiety or stress"),
    ("weight_appetite_thirst_urination", "Weight, appetite, thirst or urination"),
    ("digestion_stool", "Digestion or bowel changes"),
    ("palpitations_breathlessness_exercise", "Heartbeat, breathing or exercise tolerance"),
    ("muscle_weakness_cramps_numbness", "Weakness, cramps or numbness"),
    ("hair_skin_nails_temperature", "Hair, skin, nails or temperature sensitivity"),
    ("pain_joints_inflammation", "Pain, joints or inflammation"),
    ("menstrual_bleeding_reproductive", "Menstrual, bleeding or reproductive health"),
    ("unsupported_concern", "Something not covered by this check"),
)
_ROOT_IDS = {item[0] for item in _ROOT_CONCERNS}
_ROOT_LABELS = dict(_ROOT_CONCERNS)
_ALWAYS_AVAILABLE = {"no_current_concern", "unsupported_concern"}


def _safety_value(value: Any) -> str:
    return str(getattr(value, "value", value) or "insufficient_data")


def is_symptom_engine_enabled_for_user(user_id: str) -> bool:
    """Apply a stable server-side rollout bucket without exposing credentials."""
    if not settings.infermedica_enabled:
        return False
    allowlist = {
        item.strip()
        for item in settings.symptom_engine_allowlist_user_ids.split(",")
        if item.strip()
    }
    if user_id in allowlist:
        return True
    percent = settings.symptom_engine_rollout_percent
    if percent <= 0:
        return False
    if percent >= 100:
        return True
    bucket = int.from_bytes(hashlib.sha256(user_id.encode("utf-8")).digest()[:4], "big") % 100
    return bucket < percent


def require_symptom_engine_access(user_id: str) -> None:
    if not is_symptom_engine_enabled_for_user(user_id):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "SYMPTOM_ENGINE_NOT_AVAILABLE", "detail": "Symptom Check is not available."},
        )


async def _approved_root_ids() -> set[str]:
    supabase = svc._get_supabase()
    response = await svc._run(
        lambda: supabase.table("clinical_concept_mappings")
        .select("root_concern_id")
        .eq("active", True)
        .eq("review_status", "approved")
        .execute()
    )
    return {
        str(row.get("root_concern_id"))
        for row in (response.data or [])
        if row.get("root_concern_id") in _ROOT_IDS
    }


async def get_root_concern_catalog(*, locale: str) -> dict[str, Any]:
    # EN is canonical. UK labels are intentionally deferred until EN behavior
    # and the clinically approved mapping catalog are stable.
    approved = await _approved_root_ids()
    return {
        "version": CATALOG_VERSION,
        "locale": locale,
        "items": [
            {
                "id": concern_id,
                "label": label,
                "available": concern_id in _ALWAYS_AVAILABLE or concern_id in approved,
            }
            for concern_id, label in _ROOT_CONCERNS
        ],
    }


async def _get_active_session(user_id: str) -> dict[str, Any] | None:
    supabase = svc._get_supabase()
    response = await svc._run(
        lambda: supabase.table("symptom_check_sessions")
        .select("*")
        .eq("user_id", user_id)
        .eq("status", "active")
        .order("created_at", desc=True)
        .limit(1)
        .execute()
    )
    return response.data[0] if response.data else None


async def _get_owned_session(user_id: str, session_id: str) -> dict[str, Any]:
    supabase = svc._get_supabase()
    response = await svc._run(
        lambda: supabase.table("symptom_check_sessions")
        .select("*")
        .eq("id", session_id)
        .eq("user_id", user_id)
        .limit(1)
        .execute()
    )
    if not response.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Symptom session not found")
    return response.data[0]


async def _initial_options(root_concern_id: str) -> list[dict[str, Any]]:
    supabase = svc._get_supabase()
    response = await svc._run(
        lambda: supabase.table("clinical_concept_mappings")
        .select("vitaloop_concept_id,display_name_en")
        .eq("root_concern_id", root_concern_id)
        .eq("active", True)
        .eq("review_status", "approved")
        .order("display_name_en")
        .execute()
    )
    return [
        {"id": row["vitaloop_concept_id"], "label": row["display_name_en"]}
        for row in (response.data or [])
    ]


async def _session_evidence_for_safety(
    *, user_id: str, session_id: str
) -> list[dict[str, Any]]:
    supabase = svc._get_supabase()
    response = await svc._run(
        lambda: supabase.table("symptom_evidence")
        .select("vitaloop_concept_id,choice_id")
        .eq("session_id", session_id)
        .eq("user_id", user_id)
        .execute()
    )
    return response.data or []


async def _session_provider_evidence(
    *, user_id: str, session_id: str
) -> list[dict[str, Any]]:
    supabase = svc._get_supabase()
    response = await svc._run(
        lambda: supabase.table("symptom_evidence")
        .select("provider_concept_id,choice_id,source")
        .eq("session_id", session_id)
        .eq("user_id", user_id)
        .execute()
    )
    return response.data or []


def _provider_case_evidence(rows: list[dict[str, Any]]) -> list[ProviderEvidence]:
    result: list[ProviderEvidence] = []
    for row in rows:
        provider_id = row.get("provider_concept_id")
        if not provider_id:
            continue
        stored_source = row.get("source")
        # Evidence answered from a diagnosis-generated question must omit
        # source in the stateless provider request. Other collection stages
        # preserve their required source exactly.
        provider_source = None if stored_source == "diagnosis" else stored_source
        result.append(
            ProviderEvidence(
                id=provider_id,
                choice_id=row["choice_id"],
                source=provider_source,
            )
        )
    return result


def _request_hash(request: SubmitSymptomAnswersRequest) -> str:
    canonical = json.dumps(request.model_dump(mode="json"), sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(canonical.encode("utf-8")).hexdigest()


def _key_hash(value: str) -> str:
    return hashlib.sha256(value.encode("utf-8")).hexdigest()


def _resolve_prior_submission(
    stored: dict[str, Any] | None, *, request_hash: str
) -> dict[str, Any] | None:
    if stored is None:
        return None
    if stored["request_hash"] != request_hash:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={"code": "IDEMPOTENCY_KEY_REUSED", "detail": "Use a new idempotency key."},
        )
    if stored.get("state", "completed") == "completed":
        return stored["response_payload"]
    return None


def _hash_json(value: Any) -> str:
    def normalize(item: Any) -> Any:
        if hasattr(item, "model_dump"):
            return item.model_dump(mode="json", exclude_none=True)
        if isinstance(item, list):
            return [normalize(child) for child in item]
        if isinstance(item, dict):
            return {str(key): normalize(child) for key, child in item.items()}
        return item

    canonical = json.dumps(normalize(value), sort_keys=True, separators=(",", ":"), default=str)
    return hashlib.sha256(canonical.encode("utf-8")).hexdigest()


def _provider_error_status(exc: InfermedicaError) -> int | None:
    explicit = getattr(exc, "status_code", None)
    if explicit is not None:
        return int(explicit)
    name = type(exc).__name__
    if name == "InfermedicaAuthenticationError":
        return 401
    if name == "InfermedicaRateLimitError":
        return 429
    if name in {"InfermedicaUnavailableError", "InfermedicaResponseError"}:
        return 503
    return None


def _completion_safety_level(*, merged_level: str, question_cap_reached: bool) -> str:
    # Exhausting the interview cap is a limitation, not evidence of routine
    # health. Preserve any higher clinical escalation, but never label a
    # capped self-care result as complete/routine.
    if question_cap_reached and merged_level == "routine":
        return "insufficient_data"
    return merged_level


async def _record_provider_event(
    *,
    user_id: str,
    session: dict[str, Any],
    endpoint_name: str,
    request_payload: Any,
    response_payload: Any | None,
    http_status: int | None,
    latency_ms: int,
    error: InfermedicaError | None = None,
) -> None:
    """Persist metadata and hashes only; observability must not break care flow."""
    try:
        supabase = svc._get_supabase()
        latest = await svc._run(
            lambda: supabase.table("symptom_provider_events")
            .select("request_sequence")
            .eq("session_id", session["id"])
            .eq("user_id", user_id)
            .order("request_sequence", desc=True)
            .limit(1)
            .execute()
        )
        sequence = int(latest.data[0]["request_sequence"]) + 1 if latest.data else 1
        await svc._run(
            lambda: supabase.table("symptom_provider_events")
            .insert(
                {
                    "session_id": session["id"],
                    "user_id": user_id,
                    "endpoint_name": endpoint_name,
                    "request_sequence": sequence,
                    "http_status": http_status,
                    "latency_ms": max(0, latency_ms),
                    "provider_model": session["provider_model"],
                    "provider_model_version": session.get("provider_model_version"),
                    "request_hash": _hash_json(request_payload),
                    "response_hash": _hash_json(response_payload) if response_payload is not None else None,
                    "normalized_error_code": type(error).__name__ if error is not None else None,
                }
            )
            .execute()
        )
    except Exception as exc:  # pragma: no cover - defensive telemetry boundary
        logger.warning(
            "symptom_provider_event_write_failed endpoint=%s error_type=%s",
            endpoint_name,
            type(exc).__name__,
        )


async def _provider_call(
    *,
    user_id: str,
    session: dict[str, Any],
    endpoint_name: str,
    request_payload: Any,
    operation: Callable[[], Awaitable[Any]],
) -> Any:
    started = time.perf_counter()
    try:
        response = await operation()
    except InfermedicaError as exc:
        duration_seconds = time.perf_counter() - started
        status_code = _provider_error_status(exc)
        await _record_provider_event(
            user_id=user_id,
            session=session,
            endpoint_name=endpoint_name,
            request_payload=request_payload,
            response_payload=None,
            http_status=status_code,
            latency_ms=round(duration_seconds * 1000),
            error=exc,
        )
        record_provider_call(
            endpoint=endpoint_name,
            status=status_code,
            duration_seconds=duration_seconds,
        )
        record_provider_error(error_type=type(exc).__name__)
        raise
    duration_seconds = time.perf_counter() - started
    await _record_provider_event(
        user_id=user_id,
        session=session,
        endpoint_name=endpoint_name,
        request_payload=request_payload,
        response_payload=response,
        http_status=200,
        latency_ms=round(duration_seconds * 1000),
    )
    record_provider_call(endpoint=endpoint_name, status=200, duration_seconds=duration_seconds)
    return response


async def _audit_session_mutation(
    *, user_id: str, session: dict[str, Any], action: str, event: str
) -> None:
    await svc.write_audit_log(
        user_id=user_id,
        action=action,
        entity_type="symptom_check_session",
        entity_id=session["id"],
        new_value={
            "event": event,
            "status": session.get("status"),
            "stage": session.get("current_stage"),
            "safety_level": session.get("final_safety_level") or "insufficient_data",
        },
    )
    if session.get("status") != "active":
        record_session_terminal(
            status=str(session.get("status") or "unknown"),
            locale=str(session.get("locale") or "unknown"),
            safety_level=session.get("final_safety_level"),
            question_count=int(session.get("last_question_sequence") or 0),
        )
        await svc.save_timeline_event(
            user_id=user_id,
            event_type="symptom_check_status",
            summary="Symptom Check status updated",
            source="symptom_check",
            metadata={
                "session_id": session["id"],
                "status": session.get("status"),
                "safety_level": session.get("final_safety_level") or "insufficient_data",
            },
        )


async def _release_answer_reservation(
    *,
    supabase: Any,
    user_id: str,
    session_id: str,
    key_hash: str,
    request_hash: str,
) -> None:
    try:
        await svc._run(
            lambda: supabase.table("symptom_answer_submissions")
            .delete()
            .eq("session_id", session_id)
            .eq("user_id", user_id)
            .eq("idempotency_key_hash", key_hash)
            .eq("request_hash", request_hash)
            .eq("state", "processing")
            .execute()
        )
    except Exception as exc:  # pragma: no cover - stale reservations self-recover
        logger.warning(
            "symptom_answer_reservation_release_failed session_id=%s error_type=%s",
            session_id,
            type(exc).__name__,
        )


def _validate_answers_against_question(
    *, request: SubmitSymptomAnswersRequest, question: dict[str, Any] | None
) -> dict[str, dict[str, Any]]:
    if not question or request.question_id != question.get("id"):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={"code": "STALE_SYMPTOM_QUESTION", "detail": "The issued question has changed."},
        )
    items = {str(item.get("id")): item for item in question.get("items") or []}
    submitted_ids = {answer.item_id for answer in request.answers}
    if not submitted_ids <= set(items):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={"code": "INVALID_ANSWER_ITEM", "detail": "Answer only items from the issued question."},
        )
    for answer in request.answers:
        allowed = {choice.get("id") for choice in items[answer.item_id].get("choices") or []}
        if answer.choice_id not in allowed:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail={"code": "INVALID_ANSWER_CHOICE", "detail": "Use only an offered answer choice."},
            )
    if question.get("source") == "red_flags" and submitted_ids != set(items):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={"code": "INCOMPLETE_RED_FLAG_ANSWERS", "detail": "Answer every warning-sign item."},
        )
    return items


def _validate_initial_mappings(
    *, request: InitialEvidenceRequest, mappings: list[dict[str, Any]]
) -> list[dict[str, Any]]:
    """Resolve exact approved IDs; labels and substrings never select concepts."""
    by_id = {row["vitaloop_concept_id"]: row for row in mappings}
    selected_ids = [request.primary_concept_id, *request.secondary_concept_ids]
    if any(concept_id not in by_id for concept_id in selected_ids):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={"code": "INVALID_CONCEPT_SELECTION", "detail": "Select only offered symptom IDs."},
        )
    selected = [by_id[concept_id] for concept_id in selected_ids]
    if any(row.get("concept_type") != "symptom" or not row.get("provider_concept_id") for row in selected):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={"code": "INVALID_CONCEPT_MAPPING", "detail": "Selected symptom mapping is unavailable."},
        )
    return selected


def _public_session(session: dict[str, Any], *, initial_options: list[dict[str, Any]] | None = None) -> dict[str, Any]:
    return {
        "id": session["id"],
        "status": session["status"],
        "stage": session["current_stage"],
        "locale": session["locale"],
        "overall_wellbeing": session.get("overall_wellbeing"),
        "primary_concern_id": session.get("root_concern_id"),
        "duration_bucket": session.get("duration_bucket"),
        "question": session.get("last_question"),
        "should_stop": bool(session.get("should_stop")),
        "safety": {
            "level": session.get("final_safety_level") or "insufficient_data",
            "interrupt": session.get("final_safety_level") == "emergency",
        },
        "initial_options": initial_options or [],
    }


async def create_or_resume_session(
    *, user_id: str, request: CreateSymptomSessionRequest
) -> dict[str, Any]:
    profile = await svc.get_user_profile(user_id)
    missing = missing_required_profile_fields(profile)
    if missing:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={
                "code": "REQUIRED_PROFILE_INCOMPLETE",
                "detail": "Complete the required profile fields before starting Symptom Check.",
                "missing_fields": missing,
            },
        )

    existing = await _get_active_session(user_id)
    if existing:
        options = await _initial_options(existing.get("root_concern_id") or "")
        await svc.write_audit_log(
            user_id=user_id,
            action="read",
            entity_type="symptom_check_session",
            entity_id=existing["id"],
            new_value={"resource": "resume"},
        )
        return {"created": False, "session": _public_session(existing, initial_options=options)}

    concern_id = request.primary_concern_id
    terminal_status: str | None = None
    safety_level: str | None = None
    if concern_id == "no_current_concern":
        terminal_status, safety_level = "completed", "routine"
    elif concern_id == "unsupported_concern":
        terminal_status, safety_level = "unsupported", "insufficient_data"
    else:
        approved = await _approved_root_ids()
        if concern_id not in approved:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail={"code": "CONCERN_NOT_AVAILABLE", "detail": "This concern is not available yet."},
            )

    model = settings.infermedica_model_en if request.locale == "en" else settings.infermedica_model_uk
    now = datetime.now(timezone.utc).isoformat()
    payload: dict[str, Any] = {
        "user_id": user_id,
        "status": terminal_status or "active",
        "locale": request.locale,
        "provider_model": model,
        "questionnaire_version": QUESTIONNAIRE_VERSION,
        "current_stage": 3 if terminal_status else 1,
        "overall_wellbeing": request.overall_wellbeing,
        "root_concern_id": concern_id,
        "should_stop": bool(terminal_status),
        "final_safety_level": safety_level,
        "internal_safety_level": safety_level,
        "provider_safety_level": "insufficient_data" if terminal_status else None,
        "completed_at": now if terminal_status else None,
    }
    supabase = svc._get_supabase()
    response = await svc._run(lambda: supabase.table("symptom_check_sessions").insert(payload).execute())
    session = response.data[0]
    if concern_id == "no_current_concern":
        await svc._run(
            lambda: supabase.table("symptom_evidence").insert(
                {
                    "session_id": session["id"],
                    "user_id": user_id,
                    "vitaloop_concept_id": "no_current_concern",
                    "concept_type": "positive_baseline",
                    "choice_id": "present",
                    "source": "baseline",
                    "is_primary": True,
                    "question_sequence": 0,
                    "display_name_en": "No current concern",
                }
            ).execute()
        )
    options = [] if terminal_status else await _initial_options(concern_id)
    await _audit_session_mutation(
        user_id=user_id,
        session=session,
        action="create",
        event="session_created",
    )
    return {"created": True, "session": _public_session(session, initial_options=options)}


async def get_current_session(*, user_id: str) -> dict[str, Any]:
    session = await _get_active_session(user_id)
    if not session:
        return {"session": None}
    options = await _initial_options(session.get("root_concern_id") or "")
    await svc.write_audit_log(
        user_id=user_id,
        action="read",
        entity_type="symptom_check_session",
        entity_id=session["id"],
        new_value={"resource": "current"},
    )
    return {"session": _public_session(session, initial_options=options)}


def _public_evidence(row: dict[str, Any]) -> dict[str, Any]:
    """Return VITALOOP-owned evidence only; provider payloads/IDs stay private."""
    return {
        "id": row["vitaloop_concept_id"],
        "label": row["display_name_en"],
        "choice": row["choice_id"],
        "type": row["concept_type"],
        "is_primary": bool(row.get("is_primary")),
    }


def _public_summary(session: dict[str, Any], evidence: list[dict[str, Any]]) -> dict[str, Any]:
    grouped = {"present": [], "absent": [], "unknown": []}
    for row in evidence:
        choice = row.get("choice_id")
        if choice in grouped:
            grouped[choice].append(_public_evidence(row))

    safety_level = session.get("final_safety_level") or "insufficient_data"
    return {
        "session_id": session["id"],
        "status": session["status"],
        "locale": session["locale"],
        "questionnaire_version": session["questionnaire_version"],
        "started_at": session.get("started_at"),
        "completed_at": session.get("completed_at"),
        "overall_wellbeing": session.get("overall_wellbeing"),
        "primary_concern": {
            "id": session.get("root_concern_id"),
            "label": _ROOT_LABELS.get(session.get("root_concern_id")),
        },
        "duration_bucket": session.get("duration_bucket"),
        "evidence": grouped,
        "safety": {
            "level": safety_level,
            "interrupt": safety_level == "emergency",
        },
        "limitations": ["insufficient_data"] if safety_level == "insufficient_data" else [],
    }


async def get_session_summary(*, user_id: str, session_id: str) -> dict[str, Any]:
    session = await _get_owned_session(user_id, session_id)
    supabase = svc._get_supabase()
    response = await svc._run(
        lambda: supabase.table("symptom_evidence")
        .select(
            "vitaloop_concept_id,display_name_en,choice_id,concept_type,is_primary,question_sequence"
        )
        .eq("session_id", session_id)
        .eq("user_id", user_id)
        .order("question_sequence")
        .execute()
    )
    summary = _public_summary(session, response.data or [])
    await svc.write_audit_log(
        user_id=user_id,
        action="read",
        entity_type="symptom_check_session",
        entity_id=session_id,
        new_value={"resource": "summary", "status": session["status"]},
    )
    return {"summary": summary}


async def get_session_history(*, user_id: str, limit: int = 20) -> dict[str, Any]:
    """Return a minimal longitudinal index without diagnostic candidates."""
    supabase = svc._get_supabase()
    response = await svc._run(
        lambda: supabase.table("symptom_check_sessions")
        .select(
            "id,status,locale,questionnaire_version,overall_wellbeing,root_concern_id,"
            "duration_bucket,final_safety_level,started_at,completed_at"
        )
        .eq("user_id", user_id)
        .in_("status", ["completed", "skipped"])
        .order("completed_at", desc=True)
        .limit(limit)
        .execute()
    )
    items = []
    for session in response.data or []:
        safety_level = session.get("final_safety_level") or "insufficient_data"
        items.append(
            {
                "session_id": session["id"],
                "status": session["status"],
                "locale": session["locale"],
                "questionnaire_version": session["questionnaire_version"],
                "started_at": session.get("started_at"),
                "completed_at": session.get("completed_at"),
                "overall_wellbeing": session.get("overall_wellbeing"),
                "primary_concern": {
                    "id": session.get("root_concern_id"),
                    "label": _ROOT_LABELS.get(session.get("root_concern_id")),
                },
                "duration_bucket": session.get("duration_bucket"),
                "safety": {
                    "level": safety_level,
                    "interrupt": safety_level == "emergency",
                },
            }
        )
    await svc.write_audit_log(
        user_id=user_id,
        action="read",
        entity_type="symptom_check_session",
        new_value={"resource": "history", "count": len(items)},
    )
    return {"items": items}


async def submit_initial_evidence(
    *,
    user_id: str,
    session_id: str,
    request: InitialEvidenceRequest,
    provider_client: InfermedicaClient | None = None,
) -> dict[str, Any]:
    session = await _get_owned_session(user_id, session_id)
    if session["status"] != "active" or session["current_stage"] != 1:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Initial evidence is already closed")

    profile = await svc.get_user_profile(user_id)
    missing = missing_required_profile_fields(profile)
    if missing:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={"code": "REQUIRED_PROFILE_INCOMPLETE", "missing_fields": missing},
        )

    supabase = svc._get_supabase()
    mapping_response = await svc._run(
        lambda: supabase.table("clinical_concept_mappings")
        .select("vitaloop_concept_id,provider_concept_id,concept_type,display_name_en")
        .eq("root_concern_id", session["root_concern_id"])
        .eq("active", True)
        .eq("review_status", "approved")
        .execute()
    )
    selected = _validate_initial_mappings(request=request, mappings=mapping_response.data or [])

    evidence_rows = [
        {
            "session_id": session_id,
            "user_id": user_id,
            "vitaloop_concept_id": row["vitaloop_concept_id"],
            "provider_concept_id": row["provider_concept_id"],
            "concept_type": "symptom",
            "choice_id": "present",
            "source": "initial",
            "is_primary": index == 0,
            "question_sequence": 0,
            "display_name_en": row["display_name_en"],
        }
        for index, row in enumerate(selected)
    ]
    evidence_rows.append(
        {
            "session_id": session_id,
            "user_id": user_id,
            "vitaloop_concept_id": f"duration:{request.duration_bucket}",
            "concept_type": "attribute",
            "choice_id": "present",
            "source": "predefined",
            "is_primary": False,
            "question_sequence": 0,
            "display_name_en": f"Duration: {request.duration_bucket}",
        }
    )
    await svc._run(
        lambda: supabase.table("symptom_evidence")
        .upsert(evidence_rows, on_conflict="session_id,vitaloop_concept_id,concept_type")
        .execute()
    )

    case = ProviderCaseRequest(
        sex=str(profile["sex"]).lower(),
        age=ProviderAge(value=int(profile["age"])),
        evidence=[
            ProviderEvidence(id=row["provider_concept_id"], choice_id="present", source="initial")
            for row in selected
        ],
    )
    client = provider_client or InfermedicaClient()
    owns_client = provider_client is None
    try:
        sequence = 1
        red_flag_suggestions = await _provider_call(
            user_id=user_id,
            session=session,
            endpoint_name="suggest_red_flags",
            request_payload={"case": case, "suggest_method": "red_flags"},
            operation=lambda: client.red_flags(
                case=case,
                interview_id=session["interview_id"],
                model=session["provider_model"],
            ),
        )
        red_flag_question = normalize_red_flag_question(red_flag_suggestions, sequence=sequence)
        diagnosis = None
        if red_flag_question is None:
            diagnosis = await _provider_call(
                user_id=user_id,
                session=session,
                endpoint_name="diagnosis",
                request_payload={"case": case},
                operation=lambda: client.diagnosis(
                    case=case,
                    interview_id=session["interview_id"],
                    model=session["provider_model"],
                ),
            )
        question = (
            red_flag_question
            if red_flag_question is not None
            else normalize_question(diagnosis.question, sequence=sequence)
        )
        should_stop = bool(diagnosis.should_stop) if diagnosis is not None else False
        update: dict[str, Any] = {
            "primary_concept_id": selected[0]["vitaloop_concept_id"],
            "primary_provider_concept_id": selected[0]["provider_concept_id"],
            "duration_bucket": request.duration_bucket,
            "current_stage": 2,
            "last_question": question,
            "last_question_sequence": sequence,
            "should_stop": should_stop,
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }
        if diagnosis is not None and settings.infermedica_store_condition_candidates:
            update["condition_candidates"] = diagnosis.conditions

        if should_stop:
            triage = await _provider_call(
                user_id=user_id,
                session=session,
                endpoint_name="triage",
                request_payload={"case": case},
                operation=lambda: client.triage(
                    case=case,
                    interview_id=session["interview_id"],
                    model=session["provider_model"],
                ),
            )
            internal_safety = evaluate_internal_red_flags(
                await _session_evidence_for_safety(user_id=user_id, session_id=session_id)
            )
            safety = merge_symptom_safety(
                internal_level=internal_safety.level,
                provider_triage_level=triage.triage_level,
                provider_serious_observations=triage.serious,
                provider_root_cause=triage.root_cause,
            )
            now = datetime.now(timezone.utc).isoformat()
            update.update(
                {
                    "status": "completed",
                    "current_stage": 3,
                    "provider_triage_level": triage.triage_level,
                    "provider_triage_root_cause": triage.root_cause,
                    "internal_safety_level": safety.internal_level.value,
                    "provider_safety_level": safety.provider_level.value,
                    "final_safety_level": safety.final_level.value,
                    "completed_at": now,
                    "updated_at": now,
                }
            )

        response = await svc._run(
            lambda: supabase.table("symptom_check_sessions")
            .update(update)
            .eq("id", session_id)
            .eq("user_id", user_id)
            .execute()
        )
        updated_session = response.data[0]
        await _audit_session_mutation(
            user_id=user_id,
            session=updated_session,
            action="update",
            event="initial_evidence_submitted",
        )
        return {"session": _public_session(updated_session)}
    except InfermedicaError as exc:
        # Keep the session resumable and make uncertainty explicit. Provider
        # failure must never be translated into routine/self-care.
        now = datetime.now(timezone.utc).isoformat()
        await svc._run(
            lambda: supabase.table("symptom_check_sessions")
            .update(
                {
                    "final_safety_level": "insufficient_data",
                    "should_stop": False,
                    "updated_at": now,
                }
            )
            .eq("id", session_id)
            .eq("user_id", user_id)
            .execute()
        )
        await _audit_session_mutation(
            user_id=user_id,
            session={
                **session,
                "final_safety_level": "insufficient_data",
                "should_stop": False,
                "updated_at": now,
            },
            action="update",
            event="provider_error",
        )
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail={
                "code": "SYMPTOM_PROVIDER_UNAVAILABLE",
                "detail": "Symptom Check is temporarily unavailable. Your progress is saved; please retry.",
                "safety": {"level": "insufficient_data", "interrupt": False},
                "resumable": True,
            },
        ) from exc
    finally:
        if owns_client:
            await client.close()


async def submit_answers(
    *,
    user_id: str,
    session_id: str,
    request: SubmitSymptomAnswersRequest,
    idempotency_key: str,
    provider_client: InfermedicaClient | None = None,
) -> dict[str, Any]:
    session = await _get_owned_session(user_id, session_id)
    supabase = svc._get_supabase()
    key_hash = _key_hash(idempotency_key)
    body_hash = _request_hash(request)

    prior = await svc._run(
        lambda: supabase.table("symptom_answer_submissions")
        .select("request_hash,response_payload,state")
        .eq("session_id", session_id)
        .eq("user_id", user_id)
        .eq("idempotency_key_hash", key_hash)
        .limit(1)
        .execute()
    )
    if prior.data:
        stored_response = _resolve_prior_submission(prior.data[0], request_hash=body_hash)
        if stored_response is not None:
            return stored_response

    if session["status"] != "active" or session["current_stage"] != 2:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="This interview is not accepting answers")
    question = session.get("last_question")
    items = _validate_answers_against_question(request=request, question=question)
    provider_ids = [answer.item_id for answer in request.answers]
    mapping_response = await svc._run(
        lambda: supabase.table("clinical_concept_mappings")
        .select("vitaloop_concept_id,provider_concept_id,concept_type,display_name_en")
        .in_("provider_concept_id", provider_ids)
        .eq("provider", session["provider"])
        .eq("provider_model", session["provider_model"])
        .eq("active", True)
        .eq("review_status", "approved")
        .execute()
    )
    mappings = {row["provider_concept_id"]: row for row in (mapping_response.data or [])}
    if set(mappings) != set(provider_ids):
        record_mapping_miss(model=str(session.get("provider_model") or "unknown"))
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={
                "code": "UNAPPROVED_PROVIDER_CONCEPT",
                "detail": "The issued medical concept is not approved for this questionnaire version.",
            },
        )

    reservation = await svc._run(
        lambda: supabase.rpc(
            "reserve_symptom_answer_submission",
            {
                "p_session_id": session_id,
                "p_user_id": user_id,
                "p_idempotency_key_hash": key_hash,
                "p_request_hash": body_hash,
            },
        ).execute()
    )
    reservation_row = reservation.data[0]
    reservation_state = reservation_row["reservation_state"]
    if reservation_state == "conflict":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={"code": "IDEMPOTENCY_KEY_REUSED", "detail": "Use a new idempotency key."},
        )
    if reservation_state == "completed":
        return reservation_row["stored_response_payload"]
    if reservation_state == "in_progress":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={
                "code": "IDEMPOTENCY_REQUEST_IN_PROGRESS",
                "detail": "This answer submission is still being processed; retry shortly.",
            },
            headers={"Retry-After": "2"},
        )

    source = "red_flags" if question.get("source") == "red_flags" else "diagnosis"
    evidence_rows = [
        {
            "session_id": session_id,
            "user_id": user_id,
            "vitaloop_concept_id": mappings[answer.item_id]["vitaloop_concept_id"],
            "provider_concept_id": answer.item_id,
            "concept_type": mappings[answer.item_id]["concept_type"],
            "choice_id": answer.choice_id,
            "source": source,
            "is_primary": False,
            "question_id": request.question_id,
            "question_sequence": session["last_question_sequence"],
            "display_name_en": mappings[answer.item_id]["display_name_en"],
        }
        for answer in request.answers
    ]
    await svc._run(
        lambda: supabase.table("symptom_evidence")
        .upsert(evidence_rows, on_conflict="session_id,vitaloop_concept_id,concept_type")
        .execute()
    )

    profile = await svc.get_user_profile(user_id)
    provider_rows = await _session_provider_evidence(user_id=user_id, session_id=session_id)
    case = ProviderCaseRequest(
        sex=str(profile["sex"]).lower(),
        age=ProviderAge(value=int(profile["age"])),
        evidence=_provider_case_evidence(provider_rows),
    )
    internal_safety = evaluate_internal_red_flags(
        await _session_evidence_for_safety(user_id=user_id, session_id=session_id)
    )
    update: dict[str, Any]
    client = provider_client or InfermedicaClient()
    owns_client = provider_client is None
    try:
        if internal_safety.interrupt:
            now = datetime.now(timezone.utc).isoformat()
            update = {
                "status": "completed",
                "current_stage": 3,
                "last_question": None,
                "should_stop": True,
                "internal_safety_level": _safety_value(internal_safety.level),
                "provider_safety_level": "insufficient_data",
                "final_safety_level": "emergency",
                "completed_at": now,
                "updated_at": now,
            }
        else:
            red_flag_triage = None
            if source == "red_flags" and any(answer.choice_id == "present" for answer in request.answers):
                red_flag_triage = await _provider_call(
                    user_id=user_id,
                    session=session,
                    endpoint_name="triage",
                    request_payload={"case": case},
                    operation=lambda: client.triage(
                        case=case,
                        interview_id=session["interview_id"],
                        model=session["provider_model"],
                    ),
                )
                red_flag_safety = merge_symptom_safety(
                    internal_level=internal_safety.level,
                    provider_triage_level=red_flag_triage.triage_level,
                    provider_serious_observations=red_flag_triage.serious,
                    provider_root_cause=red_flag_triage.root_cause,
                )
                if red_flag_safety.interrupt:
                    now = datetime.now(timezone.utc).isoformat()
                    update = {
                        "status": "completed",
                        "current_stage": 3,
                        "last_question": None,
                        "should_stop": True,
                        "provider_triage_level": red_flag_triage.triage_level,
                        "provider_triage_root_cause": red_flag_triage.root_cause,
                        "internal_safety_level": red_flag_safety.internal_level.value,
                        "provider_safety_level": red_flag_safety.provider_level.value,
                        "final_safety_level": red_flag_safety.final_level.value,
                        "completed_at": now,
                        "updated_at": now,
                    }
                else:
                    update = {}
            else:
                update = {}

            if not update:
                diagnosis = await _provider_call(
                    user_id=user_id,
                    session=session,
                    endpoint_name="diagnosis",
                    request_payload={"case": case},
                    operation=lambda: client.diagnosis(
                        case=case,
                        interview_id=session["interview_id"],
                        model=session["provider_model"],
                    ),
                )
                next_sequence = session["last_question_sequence"] + 1
                question_cap_reached = (
                    not diagnosis.should_stop
                    and next_sequence >= settings.infermedica_max_questions
                )
                should_stop = diagnosis.should_stop or question_cap_reached
                if should_stop:
                    triage = red_flag_triage or await _provider_call(
                        user_id=user_id,
                        session=session,
                        endpoint_name="triage",
                        request_payload={"case": case},
                        operation=lambda: client.triage(
                            case=case,
                            interview_id=session["interview_id"],
                            model=session["provider_model"],
                        ),
                    )
                    safety = merge_symptom_safety(
                        internal_level=internal_safety.level,
                        provider_triage_level=triage.triage_level,
                        provider_serious_observations=triage.serious,
                        provider_root_cause=triage.root_cause,
                    )
                    now = datetime.now(timezone.utc).isoformat()
                    update = {
                        "status": "completed",
                        "current_stage": 3,
                        "last_question": None,
                        "last_question_sequence": next_sequence,
                        "should_stop": True,
                        "provider_triage_level": triage.triage_level,
                        "provider_triage_root_cause": triage.root_cause,
                        "internal_safety_level": safety.internal_level.value,
                        "provider_safety_level": safety.provider_level.value,
                        "final_safety_level": _completion_safety_level(
                            merged_level=safety.final_level.value,
                            question_cap_reached=question_cap_reached,
                        ),
                        "completed_at": now,
                        "updated_at": now,
                    }
                else:
                    update = {
                        "current_stage": 2,
                        "last_question": normalize_question(diagnosis.question, sequence=next_sequence),
                        "last_question_sequence": next_sequence,
                        "should_stop": False,
                        "updated_at": datetime.now(timezone.utc).isoformat(),
                    }

        updated = await svc._run(
            lambda: supabase.table("symptom_check_sessions")
            .update(update)
            .eq("id", session_id)
            .eq("user_id", user_id)
            .execute()
        )
        updated_session = updated.data[0]
        response_payload = {"session": _public_session(updated_session)}
        if updated_session.get("status") == "completed":
            response_payload["report_update"] = await resolve_report_update_offer(
                user_id=user_id,
                completed_at=updated_session.get("completed_at"),
            )
        await svc._run(
            lambda: supabase.table("symptom_answer_submissions")
            .update(
                {
                    "response_payload": response_payload,
                    "state": "completed",
                    "updated_at": datetime.now(timezone.utc).isoformat(),
                }
            )
            .eq("session_id", session_id)
            .eq("user_id", user_id)
            .eq("idempotency_key_hash", key_hash)
            .eq("request_hash", body_hash)
            .execute()
        )
        await _audit_session_mutation(
            user_id=user_id,
            session=updated.data[0],
            action="update",
            event="answers_submitted",
        )
        return response_payload
    except InfermedicaError as exc:
        now = datetime.now(timezone.utc).isoformat()
        await _release_answer_reservation(
            supabase=supabase,
            user_id=user_id,
            session_id=session_id,
            key_hash=key_hash,
            request_hash=body_hash,
        )
        await svc._run(
            lambda: supabase.table("symptom_check_sessions")
            .update({"final_safety_level": "insufficient_data", "should_stop": False, "updated_at": now})
            .eq("id", session_id)
            .eq("user_id", user_id)
            .execute()
        )
        await _audit_session_mutation(
            user_id=user_id,
            session={
                **session,
                "final_safety_level": "insufficient_data",
                "should_stop": False,
                "updated_at": now,
            },
            action="update",
            event="provider_error",
        )
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail={
                "code": "SYMPTOM_PROVIDER_UNAVAILABLE",
                "detail": "Symptom Check is temporarily unavailable. Your progress is saved; please retry.",
                "safety": {"level": "insufficient_data", "interrupt": False},
                "resumable": True,
            },
        ) from exc
    except Exception:
        await _release_answer_reservation(
            supabase=supabase,
            user_id=user_id,
            session_id=session_id,
            key_hash=key_hash,
            request_hash=body_hash,
        )
        raise
    finally:
        if owns_client:
            await client.close()


async def skip_session(*, user_id: str, session_id: str) -> dict[str, Any]:
    session = await _get_owned_session(user_id, session_id)
    if session["status"] != "active":
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Only an active session can be skipped")
    supabase = svc._get_supabase()
    evidence = await svc._run(
        lambda: supabase.table("symptom_evidence").select("id").eq("session_id", session_id).limit(1).execute()
    )
    if evidence.data:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="A started interview cannot be skipped")
    now = datetime.now(timezone.utc).isoformat()
    response = await svc._run(
        lambda: supabase.table("symptom_check_sessions")
        .update({"status": "skipped", "should_stop": True, "completed_at": now, "updated_at": now})
        .eq("id", session_id)
        .eq("user_id", user_id)
        .execute()
    )
    updated_session = response.data[0]
    await _audit_session_mutation(
        user_id=user_id,
        session=updated_session,
        action="update",
        event="session_skipped",
    )
    return {"session": _public_session(updated_session)}


async def abandon_session(*, user_id: str, session_id: str) -> dict[str, Any]:
    session = await _get_owned_session(user_id, session_id)
    if session["status"] != "active":
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Only an active session can be abandoned")
    now = datetime.now(timezone.utc).isoformat()
    supabase = svc._get_supabase()
    response = await svc._run(
        lambda: supabase.table("symptom_check_sessions")
        .update({"status": "abandoned", "should_stop": True, "completed_at": now, "updated_at": now})
        .eq("id", session_id)
        .eq("user_id", user_id)
        .execute()
    )
    updated_session = response.data[0]
    await _audit_session_mutation(
        user_id=user_id,
        session=updated_session,
        action="update",
        event="session_abandoned",
    )
    return {"session": _public_session(updated_session)}

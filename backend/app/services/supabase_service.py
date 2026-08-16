import asyncio
import logging
from collections import Counter
from datetime import datetime, timedelta, timezone
from uuid import uuid4, UUID
from fastapi import HTTPException
import httpx
from supabase import create_client, Client
from app.config import settings
from app.utils.retry import (
    with_retry,
    SUPABASE_RETRY_CONFIG,
    supabase_circuit_breaker,
)
from typing import List, Dict, Any, Optional

try:
    import sentry_sdk
except ImportError:
    sentry_sdk = None


def _sentry_scope():
    if sentry_sdk is None:
        return None
    if hasattr(sentry_sdk, "new_scope"):
        return sentry_sdk.new_scope()
    return sentry_sdk.push_scope()

_supabase: Optional[Client] = None
_use_rest_auth_context = False
_logger = logging.getLogger(__name__)

SYMPTOM_ZONE_MAP: Dict[str, List[str]] = {
    "brain": ["brain_fog", "poor_concentration", "mood_swings", "depression", "anxiety"],
    "thyroid": ["cold_intolerance", "weight_gain", "hair_loss", "fatigue"],
    "heart": ["poor_immunity", "fatigue", "anxiety"],
    "liver": ["skin_problems", "mood_swings", "digestive_issues"],
    "gut": ["digestive_issues", "poor_immunity", "weight_gain", "weight_loss"],
    "muscles": ["muscle_weakness", "fatigue", "low_libido"],
    "joints": ["joint_pain", "muscle_weakness"],
    "nervous": ["insomnia", "anxiety", "brain_fog", "poor_concentration"],
}

SYMPTOM_LABELS: Dict[str, str] = {
    "fatigue": "Fatigue",
    "insomnia": "Insomnia",
    "brain_fog": "Brain Fog",
    "anxiety": "Anxiety",
    "depression": "Depression",
    "hair_loss": "Hair Loss",
    "weight_gain": "Weight Gain",
    "weight_loss": "Weight Loss",
    "low_libido": "Low Libido",
    "muscle_weakness": "Muscle Weakness",
    "joint_pain": "Joint Pain",
    "poor_immunity": "Poor Immunity",
    "digestive_issues": "Digestive Issues",
    "skin_problems": "Skin Problems",
    "mood_swings": "Mood Swings",
    "poor_concentration": "Poor Concentration",
    "cold_intolerance": "Cold Intolerance",
}


def _run(fn):
    """Run a synchronous Supabase call in a thread pool to avoid blocking the event loop."""
    return asyncio.to_thread(fn)


def _clean(value: str) -> str:
    return (value or "").strip()


def _rest_headers() -> Dict[str, str]:
    key = _clean(settings.active_supabase_service_key)
    return {
        "apikey": key,
        "Authorization": f"Bearer {key}",
    }


def _is_valid_uuid(value: str) -> bool:
    """Validate if string is valid UUID format"""
    try:
        UUID(value)
        return True
    except (ValueError, AttributeError, TypeError):
        return False


@with_retry(SUPABASE_RETRY_CONFIG)
def _rest_select_first_by_id(table: str, columns: str, user_id: str) -> Dict[str, Any]:
    """Query Supabase REST API with retry logic and robust error handling."""
    base_url = _clean(settings.supabase_url).rstrip("/")
    if not base_url:
        _logger.error("Supabase URL not configured")
        return {}

    # Validate UUID format before making request
    if not _is_valid_uuid(user_id):
        _logger.error(f"Invalid UUID format for {table}: {user_id}")
        return {}

    url = f"{base_url}/rest/v1/{table}"
    params = {
        "select": columns,
        "id": f"eq.{user_id}",
        "limit": "1",
    }

    try:
        with httpx.Client(timeout=20.0) as client:
            response = client.get(url, headers=_rest_headers(), params=params)
            response.raise_for_status()
            data = response.json()

        if isinstance(data, list) and data:
            return data[0]
        return {}
    except httpx.HTTPStatusError as e:
        # Log detailed error info for debugging
        _logger.error(
            f"Supabase REST API error for {table}",
            extra={
                "status": e.response.status_code,
                "url": str(e.request.url),
                "user_id": user_id,
                "response_body": e.response.text[:500] if e.response.text else None,
            }
        )
        if sentry_sdk and e.response.status_code >= 500:
            with _sentry_scope() as scope:
                scope.set_context("supabase_api", {
                    "table": table,
                    "status": e.response.status_code,
                    "url": str(e.request.url),
                })
                sentry_sdk.capture_exception(e)
        return {}
    except httpx.TimeoutException as e:
        _logger.error(f"Supabase REST API timeout for {table}: {str(e)}")
        if sentry_sdk:
            with _sentry_scope() as scope:
                scope.set_context("supabase_timeout", {
                    "table": table,
                    "timeout": "20.0s",
                })
                sentry_sdk.capture_exception(e)
        return {}
    except Exception as e:
        _logger.error(
            f"Unexpected error in _rest_select_first_by_id for {table}",
            exc_info=True,
            extra={"user_id": user_id}
        )
        if sentry_sdk:
            with _sentry_scope() as scope:
                scope.set_context("supabase_query", {
                    "table": table,
                    "operation": "select_first_by_id",
                })
                sentry_sdk.capture_exception(e)
        return {}


async def _select_first_by_id_with_fallback(table: str, columns: str, user_id: str) -> Dict[str, Any]:
    global _use_rest_auth_context

    # Validate UUID format upfront
    if not _is_valid_uuid(user_id):
        _logger.error(f"Invalid UUID format for {table}: {user_id}")
        return {}

    if _use_rest_auth_context:
        return await _run(lambda: _rest_select_first_by_id(table, columns, user_id))

    try:
        supabase = _get_supabase()
        response = await _run(
            lambda: supabase.table(table)
            .select(columns)
            .eq("id", user_id)
            .limit(1)
            .execute()
        )
        # Reset circuit-breaker on success so SDK is preferred again.
        _use_rest_auth_context = False
        return response.data[0] if response.data else {}
    except Exception as ex:
        # Keep REST fallback for auth context lookup resilience.
        _use_rest_auth_context = True
        _logger.warning(
            "Supabase SDK query failed for %s; switching auth context lookup to REST fallback: %s",
            table,
            ex,
        )
        return await _run(lambda: _rest_select_first_by_id(table, columns, user_id))


def _missing_key_error_message() -> str:
    return "Supabase is not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY."


def _is_invalid_api_key_error(ex: Exception) -> bool:
    return "Invalid API key" in str(ex)


def _build_supabase_client(supabase_url: str, supabase_key: str) -> Client:
    return create_client(supabase_url, supabase_key)


def _init_supabase_client() -> Client:
    supabase_url = _clean(settings.supabase_url)
    supabase_key = _clean(settings.active_supabase_service_key)
    if not supabase_url or not supabase_key:
        raise RuntimeError(_missing_key_error_message())

    try:
        return _build_supabase_client(supabase_url, supabase_key)
    except Exception as ex:
        _logger.error("Failed to initialize Supabase client: %s", ex)
        if _is_invalid_api_key_error(ex):
            raise RuntimeError("SUPABASE_SDK_INVALID_API_KEY") from ex
        raise


def _get_supabase() -> Client:
    global _supabase
    if _supabase is None:
        _supabase = _init_supabase_client()
    return _supabase


async def _audit_medical_read(
    *,
    user_id: Optional[str],
    entity_type: str,
    entity_id: Optional[str] = None,
    details: Optional[Dict[str, Any]] = None,
) -> None:
    await write_audit_log(
        user_id=user_id,
        action="read",
        entity_type=entity_type,
        entity_id=entity_id,
        new_value={"scope": "medical", **(details or {})},
    )


async def _audit_medical_write(
    *,
    user_id: Optional[str],
    action: str,
    entity_type: str,
    entity_id: Optional[str] = None,
    details: Optional[Dict[str, Any]] = None,
) -> None:
    safe_action = action if action in {"create", "update", "delete"} else "update"
    await write_audit_log(
        user_id=user_id,
        action=safe_action,
        entity_type=entity_type,
        entity_id=entity_id,
        new_value={"scope": "medical", **(details or {})},
    )


async def save_lab_upload(
    user_id: str,
    extracted_text: str,
    lab_name: Optional[str] = None,
    test_date: Optional[str] = None,
    ocr_confidence: Optional[float] = None,
    analyze_prompt_version: Optional[str] = None,
) -> Dict:
    supabase = _get_supabase()
    payload: Dict[str, Any] = {
        "user_id": user_id,
        "extracted_text": extracted_text,
        "status": "processing",
    }
    if lab_name:
        payload["lab_name"] = lab_name
    if test_date:
        payload["test_date"] = test_date
    if ocr_confidence is not None:
        payload["ocr_confidence"] = ocr_confidence
    if analyze_prompt_version:
        payload["analyze_prompt_version"] = analyze_prompt_version

    resp = await _run(lambda: supabase.table("lab_uploads").insert(payload).execute())
    return resp.data[0]


async def save_biomarkers(upload_id: str, user_id: str, biomarkers: List[Dict]) -> List[Dict]:
    supabase = _get_supabase()
    rows = [
        {
            "upload_id": upload_id,
            "user_id": user_id,
            "name": b["name"],
            "value": b["value"],
            "unit": b["unit"],
            "ref_low": b.get("ref_low"),
            "ref_high": b.get("ref_high"),
            "status": b["status"],
            "category": b.get("category"),
        }
        for b in biomarkers
    ]
    # Delete any existing biomarkers for this upload before inserting
    # (handles re-analysis retries; unique constraint on upload_id+lower(name) would fail otherwise)
    await _run(lambda: supabase.table("biomarkers").delete().eq("upload_id", upload_id).execute())
    resp = await _run(lambda: supabase.table("biomarkers").insert(rows).execute())
    await _run(lambda: supabase.table("lab_uploads").update({"status": "done"}).eq("id", upload_id).execute())
    return resp.data


async def save_biomarker_extraction_candidates(
    *,
    upload_id: str,
    user_id: str,
    candidates: List[Dict[str, Any]],
) -> List[Dict[str, Any]]:
    if not candidates:
        return []

    supabase = _get_supabase()
    rows = [
        {
            "upload_id": upload_id,
            "user_id": user_id,
            "source": item.get("source") or "ai",
            "raw_name": item.get("raw_name"),
            "raw_value": None if item.get("raw_value") is None else str(item.get("raw_value")),
            "raw_unit": item.get("raw_unit"),
            "raw_reference_range": item.get("raw_reference_range"),
            "parsed_value": item.get("parsed_value"),
            "confidence_score": item.get("confidence_score"),
            "confidence_reasons": item.get("confidence_reasons") or [],
            "status": item.get("status") or "pending",
            "source_page": item.get("source_page"),
            "source_row": None if item.get("source_row") is None else str(item.get("source_row")),
        }
        for item in candidates
    ]
    resp = await _run(lambda: supabase.table("biomarker_extraction_candidates").insert(rows).execute())
    return resp.data or []


async def get_biomarker_extraction_candidates(upload_id: str, user_id: str) -> List[Dict[str, Any]]:
    supabase = _get_supabase()
    resp = await _run(
        lambda: supabase.table("biomarker_extraction_candidates")
        .select("*")
        .eq("upload_id", upload_id)
        .eq("user_id", user_id)
        .order("created_at")
        .execute()
    )
    return resp.data or []


async def update_biomarker_extraction_candidates(
    *,
    upload_id: str,
    user_id: str,
    decisions: List[Dict[str, Any]],
) -> List[Dict[str, Any]]:
    if not decisions:
        return []

    supabase = _get_supabase()
    updated_rows: List[Dict[str, Any]] = []
    for decision in decisions:
        candidate_id = decision.get("id")
        if not candidate_id:
            continue

        patch: Dict[str, Any] = {
            "status": decision.get("status") or "confirmed",
        }
        corrections = decision.get("corrections")
        if isinstance(corrections, dict):
            field_map = {
                "raw_name": "raw_name",
                "name": "raw_name",
                "raw_value": "raw_value",
                "value": "raw_value",
                "raw_unit": "raw_unit",
                "unit": "raw_unit",
                "raw_reference_range": "raw_reference_range",
                "reference_range": "raw_reference_range",
                "parsed_value": "parsed_value",
            }
            for source_key, target_key in field_map.items():
                if source_key in corrections:
                    patch[target_key] = corrections[source_key]

        resp = await _run(
            lambda candidate_id=candidate_id, patch=patch: supabase.table("biomarker_extraction_candidates")
            .update(patch)
            .eq("id", candidate_id)
            .eq("upload_id", upload_id)
            .eq("user_id", user_id)
            .execute()
        )
        updated_rows.extend(resp.data or [])
    return updated_rows


async def save_report_version(
    *,
    user_id: str,
    upload_id: str,
    version: str,
    locale: str,
    input_snapshot: Dict[str, Any],
    knowledge_report: Dict[str, Any],
    protocol: Any,
    safety_result: Dict[str, Any],
    explainability: Dict[str, Any],
    interpreted_report: Dict[str, Any] | None = None,
    status: str = "completed",
) -> Dict[str, Any]:
    supabase = _get_supabase()
    knowledge_payload = knowledge_report or {}
    if interpreted_report:
        knowledge_payload = {
            **knowledge_payload,
            "interpreted_report": interpreted_report,
        }
    payload = {
        "user_id": user_id,
        "upload_id": upload_id,
        "version": version,
        "locale": locale,
        "input_snapshot": input_snapshot or {},
        "knowledge_report": knowledge_payload,
        "protocol": protocol or {},
        "safety_result": safety_result or {},
        "explainability": explainability or {},
        "status": status,
    }
    resp = await _run(lambda: supabase.table("report_versions").insert(payload).execute())
    return (resp.data or [{}])[0]


async def get_latest_report_version(upload_id: str, user_id: str, locale: str) -> Optional[Dict[str, Any]]:
    supabase = _get_supabase()
    resp = await _run(
        lambda: supabase.table("report_versions")
        .select("*")
        .eq("upload_id", upload_id)
        .eq("user_id", user_id)
        .eq("locale", locale)
        .order("created_at", desc=True)
        .limit(1)
        .execute()
    )
    latest = (resp.data or [None])[0]
    if latest:
        return latest

    fallback = await _run(
        lambda: supabase.table("report_versions")
        .select("*")
        .eq("upload_id", upload_id)
        .eq("user_id", user_id)
        .order("created_at", desc=True)
        .limit(1)
        .execute()
    )
    return (fallback.data or [None])[0]


async def get_report_version(report_version_id: str, user_id: str) -> Optional[Dict[str, Any]]:
    supabase = _get_supabase()
    resp = await _run(
        lambda: supabase.table("report_versions")
        .select("*")
        .eq("id", report_version_id)
        .eq("user_id", user_id)
        .limit(1)
        .execute()
    )
    return (resp.data or [None])[0]


async def save_safety_events(
    *,
    user_id: str,
    upload_id: str | None,
    report_version_id: str | None,
    safety_events: List[Dict[str, Any]],
) -> List[Dict[str, Any]]:
    if not safety_events:
        return []

    supabase = _get_supabase()
    rows = [
        {
            "user_id": user_id,
            "upload_id": upload_id,
            "report_version_id": report_version_id,
            "rule_key": event.get("key"),
            "severity": event.get("severity") or "medium",
            "action": event.get("action") or "warn",
            "input_snapshot": event,
        }
        for event in safety_events
    ]
    resp = await _run(lambda: supabase.table("safety_events").insert(rows).execute())
    return resp.data or []


async def save_analysis_intelligence_artifacts(
    *,
    user_id: str,
    upload_id: str,
    analysis_input_quality_gate: Dict[str, Any] | None = None,
    clinical_data_integrity: Dict[str, Any] | None = None,
    evidence_gaps: Dict[str, Any] | None = None,
    health_states: Dict[str, Any] | None = None,
) -> Dict[str, Any]:
    """Persist internal intelligence artifacts for observability and audit.

    These rows are intentionally separate from the user-visible report version.
    Callers should treat this as best-effort persistence and alert on failures
    without blocking the analysis result.
    """

    supabase = _get_supabase()
    persisted: Dict[str, Any] = {}

    if analysis_input_quality_gate:
        gate = analysis_input_quality_gate or {}
        payload = {
            "user_id": user_id,
            "upload_id": upload_id,
            "decision": gate.get("decision") or "unknown",
            "label": gate.get("label"),
            "score": gate.get("score"),
            "requires_confirmation": bool(gate.get("requires_confirmation")),
            "components": gate.get("components") or {},
            "candidate_summary": gate.get("candidate_summary") or {},
            "warnings": gate.get("warnings") or [],
            "blockers": gate.get("blockers") or [],
            "reasons": gate.get("reasons") or [],
            "source": gate.get("source") or {},
            "gate_version": gate.get("version"),
            "status": "recorded",
        }
        resp = await _run(lambda: supabase.table("analysis_quality_gates").insert(payload).execute())
        persisted["analysis_quality_gate"] = (resp.data or [{}])[0]

    if clinical_data_integrity:
        integrity = clinical_data_integrity or {}
        payload = {
            "user_id": user_id,
            "upload_id": upload_id,
            "status": integrity.get("status") or "unknown",
            "integrity_version": integrity.get("version"),
            "summary": integrity.get("summary") or {},
            "issues": integrity.get("issues") or [],
            "profile": integrity.get("profile") or {},
            "markers": integrity.get("markers") or [],
        }
        resp = await _run(lambda: supabase.table("clinical_data_integrity_events").insert(payload).execute())
        persisted["clinical_data_integrity"] = (resp.data or [{}])[0]

    if evidence_gaps:
        gaps = evidence_gaps or {}
        payload = {
            "user_id": user_id,
            "upload_id": upload_id,
            "evidence_gaps_version": gaps.get("version"),
            "gaps": gaps.get("gaps") or [],
            "summary": gaps.get("summary") or {},
            "status": "recorded",
        }
        resp = await _run(lambda: supabase.table("evidence_gaps").insert(payload).execute())
        persisted["evidence_gaps"] = (resp.data or [{}])[0]

    if health_states:
        states = health_states or {}
        payload = {
            "user_id": user_id,
            "upload_id": upload_id,
            "health_state_version": states.get("version"),
            "domain_registry_version": states.get("domain_registry_version"),
            "states": states.get("states") or [],
            "top_priorities": states.get("top_priorities") or [],
            "summary": states.get("summary") or {},
            "status": "recorded",
        }
        resp = await _run(lambda: supabase.table("health_state_versions").insert(payload).execute())
        persisted["health_states"] = (resp.data or [{}])[0]

    return persisted


async def update_lab_upload_status(upload_id: str, status: str) -> None:
    supabase = _get_supabase()
    await _run(
        lambda: supabase.table("lab_uploads")
        .update({"status": status})
        .eq("id", upload_id)
        .execute()
    )


async def assert_upload_belongs_to_user(upload_id: str, user_id: str) -> Dict:
    _logger.debug("assert_upload_belongs_to_user called")
    supabase = _get_supabase()
    resp = await _run(
        lambda: supabase.table("lab_uploads")
        .select("id,user_id")
        .eq("id", upload_id)
        .eq("user_id", user_id)
        .limit(1)
        .execute()
    )
    _logger.debug("assert_upload_belongs_to_user completed")
    if not resp.data:
        _logger.warning("Upload not found for current user")
        raise HTTPException(status_code=404, detail={"detail": "Upload not found", "code": "UPLOAD_NOT_FOUND"})
    return resp.data[0]


async def get_biomarkers_by_upload(upload_id: str, user_id: str) -> List[Dict]:
    _logger.debug("get_biomarkers_by_upload called")
    supabase = _get_supabase()
    resp = await _run(
        lambda: supabase.table("biomarkers")
        .select("*")
        .eq("upload_id", upload_id)
        .eq("user_id", user_id)
        .execute()
    )
    _logger.debug("get_biomarkers_by_upload completed")
    return resp.data


async def get_recent_biomarker_history(user_id: str, *, limit: int = 250) -> List[Dict[str, Any]]:
    """Return recent biomarker rows for longitudinal trend analysis.

    This is intentionally read-only and fail-open at the caller level; analysis
    should still complete when historical data is unavailable.
    """
    supabase = _get_supabase()
    resp = await _run(
        lambda: supabase.table("biomarkers")
        .select("id,upload_id,user_id,name,value,unit,status,category,created_at,lab_uploads(test_date,created_at)")
        .eq("user_id", user_id)
        .order("created_at", desc=True)
        .limit(limit)
        .execute()
    )
    rows = resp.data or []
    await _audit_medical_read(
        user_id=user_id,
        entity_type="biomarkers",
        details={"count": len(rows), "source": "trend_engine"},
    )
    return rows


async def get_protocol_by_upload(user_id: str, upload_id: str) -> Optional[Dict]:
    _logger.debug("get_protocol_by_upload called")
    supabase = _get_supabase()
    resp = await _run(
        lambda: supabase.table("protocols")
        .select("*")
        .eq("user_id", user_id)
        .eq("upload_id", upload_id)
        .limit(1)
        .execute()
    )
    _logger.debug("get_protocol_by_upload completed")
    return resp.data[0] if resp.data else None


async def get_protocols_by_uploads(user_id: str, upload_ids: List[str]) -> Dict[str, Dict]:
    """Batch load protocols for multiple uploads. Returns dict mapping upload_id to protocol."""
    if not upload_ids:
        return {}

    supabase = _get_supabase()
    resp = await _run(
        lambda: supabase.table("protocols")
        .select("*")
        .eq("user_id", user_id)
        .in_("upload_id", upload_ids)
        .execute()
    )

    # Group by upload_id for easy lookup
    result = {}
    for protocol in resp.data or []:
        result[protocol.get("upload_id")] = protocol
    return result


async def save_protocol(
    user_id: str,
    upload_id: str,
    recommendations: List[Dict],
    prompt_version: Optional[str] = None,
) -> Dict:
    supabase = _get_supabase()

    existing_protocol = await get_protocol_by_upload(user_id, upload_id)

    payload: Dict[str, Any] = {"recommendations": recommendations}
    if prompt_version:
        payload["prompt_version"] = prompt_version

    if existing_protocol:
        protocol_id = existing_protocol["id"]
        updated = await _run(
            lambda: supabase.table("protocols")
            .update(payload)
            .eq("id", protocol_id)
            .execute()
        )
        return updated.data[0]

    create_payload: Dict[str, Any] = {
        "user_id": user_id,
        "upload_id": upload_id,
        "recommendations": recommendations,
    }
    if prompt_version:
        create_payload["prompt_version"] = prompt_version

    resp = await _run(lambda: supabase.table("protocols").insert(create_payload).execute())
    await _emit_timeline(
        user_id,
        "protocol_generated",
        "Protocol generated from uploaded lab",
        metadata={"upload_id": upload_id, "recommendation_count": len(recommendations)},
    )
    return resp.data[0]


async def save_symptoms(user_id: str, upload_id: str, tags: List[str], severity: int = 5) -> Dict:
    supabase = _get_supabase()
    resp = await _run(
        lambda: supabase.table("symptoms")
        .insert({"user_id": user_id, "upload_id": upload_id, "tags": tags, "severity": severity})
        .execute()
    )
    result = resp.data[0]
    await _audit_medical_write(
        user_id=user_id,
        action="create",
        entity_type="symptoms",
        entity_id=str(result.get("id") or upload_id),
        details={"tag_count": len(tags)},
    )
    return result


def _build_symptom_summary(rows: List[Dict[str, Any]], days: int) -> Dict[str, Any]:
    symptom_counts: Counter = Counter()
    zone_scores: Dict[str, float] = {zone: 0.0 for zone in SYMPTOM_ZONE_MAP}
    total_severity = 0

    for row in rows:
        tags = row.get("tags") or []
        severity = int(row.get("severity") or 5)
        total_severity += severity

        for tag in tags:
            symptom_counts[tag] += 1
            for zone, zone_tags in SYMPTOM_ZONE_MAP.items():
                if tag in zone_tags:
                    zone_scores[zone] += severity

    entries = len(rows)
    avg_severity = round((total_severity / entries), 2) if entries else 0
    max_zone_score = max(zone_scores.values()) if zone_scores else 0

    top_symptoms = [
        {
            "tag": tag,
            "label": SYMPTOM_LABELS.get(tag, tag.replace("_", " ").title()),
            "count": count,
        }
        for tag, count in symptom_counts.most_common(5)
    ]

    top_zones = [
        {
            "zone": zone,
            "score": round(score, 2),
            "normalized_score": round((score / max_zone_score), 3) if max_zone_score > 0 else 0,
        }
        for zone, score in sorted(zone_scores.items(), key=lambda item: item[1], reverse=True)
        if score > 0
    ]

    recent_logs = [
        {
            "id": row.get("id"),
            "created_at": row.get("created_at"),
            "severity": row.get("severity"),
            "tags": row.get("tags") or [],
        }
        for row in rows[:10]
    ]

    return {
        "window_days": days,
        "entries": entries,
        "average_severity": avg_severity,
        "top_symptoms": top_symptoms,
        "top_zones": top_zones,
        "recent_logs": recent_logs,
    }


async def get_user_symptom_summary(user_id: str, days: int = 30) -> Dict[str, Any]:
    supabase = _get_supabase()
    since = (datetime.now(timezone.utc) - timedelta(days=days)).isoformat()

    resp = await _run(
        lambda: supabase.table("symptoms")
        .select("id, tags, severity, created_at")
        .eq("user_id", user_id)
        .gte("created_at", since)
        .order("created_at", desc=True)
        .execute()
    )

    rows = resp.data or []
    await _audit_medical_read(
        user_id=user_id,
        entity_type="symptoms",
        details={"window_days": days, "row_count": len(rows)},
    )
    return _build_symptom_summary(rows, days)


async def get_platform_symptom_summary(days: int = 30) -> Dict[str, Any]:
    supabase = _get_supabase()
    since = (datetime.now(timezone.utc) - timedelta(days=days)).isoformat()

    resp = await _run(
        lambda: supabase.table("symptoms")
        .select("id, user_id, tags, severity, created_at")
        .gte("created_at", since)
        .order("created_at", desc=True)
        .execute()
    )

    rows = resp.data or []
    summary = _build_symptom_summary(rows, days)
    summary["users_reporting"] = len({row.get("user_id") for row in rows if row.get("user_id")})
    return summary


async def update_user_subscription(user_id: str, sub_status: str, sub_id: Optional[str] = None, plan_tier: Optional[str] = None) -> None:
    supabase = _get_supabase()
    payload: Dict[str, Any] = {"sub_status": sub_status}
    if sub_id:
        payload["sub_id"] = sub_id
    if plan_tier:
        payload["plan_tier"] = plan_tier
    await _run(lambda: supabase.table("users").update(payload).eq("id", user_id).execute())


async def update_admin_user_fields(
    user_id: str,
    *,
    full_name: Optional[str] = None,
    global_role: Optional[str] = None,
    sub_status: Optional[str] = None,
) -> None:
    supabase = _get_supabase()
    payload: Dict[str, Any] = {}

    if full_name is not None:
        payload["full_name"] = full_name
    if global_role is not None:
        payload["global_role"] = global_role
    if sub_status is not None:
        payload["sub_status"] = sub_status

    if not payload:
        return

    await _run(lambda: supabase.table("users").update(payload).eq("id", user_id).execute())


async def get_user_by_stripe_sub(sub_id: str) -> Optional[Dict]:
    supabase = _get_supabase()
    resp = await _run(lambda: supabase.table("users").select("id").eq("sub_id", sub_id).execute())
    return resp.data[0] if resp.data else None


async def get_user_active_subscription(user_id: str) -> Optional[Dict]:
    """Return the most recent active subscription row from the subscriptions table."""
    supabase = _get_supabase()
    resp = await _run(
        lambda: supabase.table("subscriptions")
        .select("plan_name, status, stripe_subscription_id, stripe_customer_id, current_period_end, cancel_at_period_end")
        .eq("user_id", user_id)
        .in_("status", ["active", "past_due", "paused"])
        .order("updated_at", desc=True)
        .limit(1)
        .execute()
    )
    return resp.data[0] if resp.data else None


async def sync_stripe_subscription_to_subscriptions_table(
    *,
    user_id: str,
    stripe_subscription_id: str,
    stripe_customer_id: Optional[str] = None,
    stripe_status: str = "active",
    current_period_start: Optional[str] = None,
    current_period_end: Optional[str] = None,
    cancel_at_period_end: bool = False,
    plan_name: str = "core",
) -> Optional[Dict]:
    """Sync Stripe subscription to subscriptions table (idempotent upsert).
    
    Maintains normalized subscription record for reporting and audit.
    """
    supabase = _get_supabase()
    
    now = datetime.now(timezone.utc).isoformat()
    status_map = {
        "active": "active",
        "trialing": "active",
        "past_due": "past_due",
        "cancelled": "cancelled",
        "paused": "paused",
        "unpaid": "past_due",
    }
    mapped_status = status_map.get(stripe_status, "active")
    
    payload = {
        "user_id": user_id,
        "plan_name": plan_name,
        "status": mapped_status,
        "stripe_subscription_id": stripe_subscription_id,
        "stripe_customer_id": stripe_customer_id,
        "stripe_status": stripe_status,
        "current_period_start": current_period_start,
        "current_period_end": current_period_end,
        "cancel_at_period_end": cancel_at_period_end,
        "updated_at": now,
    }
    
    # For initial insert, add started_at timestamp
    # For updates, it will be ignored due to upsert behavior
    payload["started_at"] = current_period_start or now
    
    resp = await _run(
        lambda: supabase.table("subscriptions")
        .upsert(payload, on_conflict="stripe_subscription_id")
        .execute()
    )
    
    return resp.data[0] if resp.data else None


async def record_stripe_event(
    event_id: str,
    event_type: str,
    event_payload: Dict[str, Any],
) -> bool:
    """Record Stripe webhook event for idempotency and audit (no-op if already processed)."""
    supabase = _get_supabase()
    
    try:
        await _run(
            lambda: supabase.table("stripe_events")
            .insert({
                "event_id": event_id,
                "event_type": event_type,
                "payload": event_payload,
                "created_at": datetime.now(timezone.utc).isoformat(),
            })
            .execute()
        )
        return True
    except Exception:
        # Event already exists (duplicate); idempotent no-op
        return False


async def record_health_failure(
    service_name: str,
    error_type: str,
    error_message: str,
) -> None:
    """Log a service health failure for ops monitoring and alerting."""
    supabase = _get_supabase()
    
    try:
        await _run(
            lambda: supabase.table("health_failures")
            .insert({
                "service_name": service_name,
                "error_type": error_type,
                "error_message": error_message[:500],  # Truncate to prevent abuse
                "created_at": datetime.now(timezone.utc).isoformat(),
            })
            .execute()
        )
    except Exception:
        # Silent fail; don't let health logging block the app
        pass


async def get_user_account(user_id: str) -> Dict[str, Any]:
    primary_columns = "id, email, full_name, sub_status, subscription_status, global_role, created_at"
    fallback_columns = "id, email, full_name, subscription_status, global_role, created_at"

    account = await _select_first_by_id_with_fallback("users", primary_columns, user_id)
    if not account:
        account = await _select_first_by_id_with_fallback("users", fallback_columns, user_id)

    # Keep downstream code stable when legacy schemas expose subscription_status
    # instead of sub_status and/or omit plan_tier.
    if account and not account.get("sub_status") and account.get("subscription_status"):
        account["sub_status"] = account.get("subscription_status")

    return account


async def get_user_subscription_history(user_id: str) -> List[Dict]:
    """Return all subscription rows for a user ordered newest-first."""
    supabase = _get_supabase()
    resp = await _run(
        lambda: supabase.table("subscriptions")
        .select("plan_name, status, stripe_status, started_at, current_period_start, current_period_end, cancel_at_period_end, updated_at")
        .eq("user_id", user_id)
        .order("updated_at", desc=True)
        .execute()
    )
    return resp.data or []


async def get_user_upload_count(user_id: str) -> int:
    """Return the total number of lab uploads for a user (used for freemium gating)."""
    supabase = _get_supabase()
    resp = await _run(
        lambda: supabase.table("lab_uploads")
        .select("id", count="exact")
        .eq("user_id", user_id)
        .execute()
    )
    return resp.count if resp.count is not None else len(resp.data or [])


async def get_user_progress(user_id: str) -> List[Dict]:
    supabase = _get_supabase()
    uploads = await _run(
        lambda: supabase.table("lab_uploads")
        .select("id, created_at, lab_name, test_date")
        .eq("user_id", user_id)
        .order("created_at", desc=True)
        .execute()
    )

    rows = uploads.data or []
    if not rows:
        await _audit_medical_read(
            user_id=user_id,
            entity_type="lab_progress",
            details={"upload_count": 0},
        )
        return []

    upload_ids = [row["id"] for row in rows]
    biomarker_rows_resp = await _run(
        lambda: supabase.table("biomarkers")
        .select("upload_id, name, value, unit, status, ref_low, ref_high")
        .in_("upload_id", upload_ids)
        .eq("user_id", user_id)
        .execute()
    )

    grouped: Dict[str, List[Dict[str, Any]]] = {}
    for biomarker in biomarker_rows_resp.data or []:
        upload_id = biomarker.get("upload_id")
        if not upload_id:
            continue
        grouped.setdefault(upload_id, []).append(
            {
                "name": biomarker.get("name"),
                "value": biomarker.get("value"),
                "unit": biomarker.get("unit"),
                "status": biomarker.get("status"),
                "ref_low": biomarker.get("ref_low"),
                "ref_high": biomarker.get("ref_high"),
            }
        )

    result = [{**upload, "biomarkers": grouped.get(upload["id"], [])} for upload in rows]
    await _audit_medical_read(
        user_id=user_id,
        entity_type="lab_progress",
        details={"upload_count": len(result)},
    )
    return result


async def get_admin_overview() -> Dict[str, Any]:
    """Aggregate platform metrics for the /admin/overview endpoint."""
    supabase = _get_supabase()
    cutoff_30d = (datetime.now(timezone.utc) - timedelta(days=30)).isoformat()
    cutoff_7d = (datetime.now(timezone.utc) - timedelta(days=7)).isoformat()

    total_users_resp = await _run(
        lambda: supabase.table("users").select("id", count="exact").execute()
    )
    total_users = total_users_resp.count or len(total_users_resp.data)

    active_users_resp = await _run(
        lambda: supabase.table("users")
        .select("id", count="exact")
        .gte("updated_at", cutoff_30d)
        .execute()
    )
    active_users = active_users_resp.count or len(active_users_resp.data)

    premium_resp = await _run(
        lambda: supabase.table("users")
        .select("id", count="exact")
        .eq("sub_status", "active")
        .execute()
    )
    premium_subscribers = premium_resp.count or len(premium_resp.data)

    total_uploads_resp = await _run(
        lambda: supabase.table("lab_uploads").select("id", count="exact").execute()
    )
    total_uploads = total_uploads_resp.count or len(total_uploads_resp.data)

    weekly_uploads_resp = await _run(
        lambda: supabase.table("lab_uploads")
        .select("id", count="exact")
        .gte("created_at", cutoff_7d)
        .execute()
    )
    weekly_uploads = weekly_uploads_resp.count or len(weekly_uploads_resp.data)

    return {
        "total_users": total_users,
        "active_users": active_users,
        "premium_subscribers": premium_subscribers,
        "total_uploads": total_uploads,
        "weekly_uploads": weekly_uploads,
        "mrr": 0,  # requires Stripe data — placeholder
    }


async def get_funnel_overview(
    days: int = 30,
    min_dropoff_reached: int = 1,
    dropoff_sort: str = "count",
    dropoff_limit: int = 10,
) -> Dict[str, Any]:
    """Aggregate B2C funnel metrics for the admin dashboard."""
    supabase = _get_supabase()
    safe_days = max(1, min(days, 365))
    safe_min_dropoff_reached = max(1, min(min_dropoff_reached, 10000))
    safe_dropoff_sort = str(dropoff_sort or "count").strip().lower()
    if safe_dropoff_sort not in {"count", "rate", "order"}:
        safe_dropoff_sort = "count"
    safe_dropoff_limit = max(1, min(dropoff_limit, 100))
    cutoff_dt = datetime.now(timezone.utc) - timedelta(days=safe_days)
    cutoff = cutoff_dt.isoformat()

    end_users_resp = await _run(
        lambda: supabase.table("users")
        .select("id, created_at, sub_status, global_role")
        .eq("global_role", "end_user")
        .execute()
    )
    end_users = end_users_resp.data or []

    timeline_resp = await _run(
        lambda: supabase.table("timeline_events")
        .select("user_id, event_type, occurred_at")
        .gte("occurred_at", cutoff)
        .in_("event_type", [
            "funnel_signup_completed",
            "funnel_onboarding_completed",
            "funnel_first_upload_completed",
            "funnel_paywall_shown",
        ])
        .execute()
    )
    timeline_rows = timeline_resp.data or []

    def _parse_dt(value: Any) -> Optional[datetime]:
        raw = str(value or "").strip()
        if not raw:
            return None
        try:
            parsed = datetime.fromisoformat(raw.replace("Z", "+00:00"))
            return parsed if parsed.tzinfo else parsed.replace(tzinfo=timezone.utc)
        except Exception:
            return None

    signup_user_ids = {
        str(row.get("id"))
        for row in end_users
        if row.get("id") and (_parse_dt(row.get("created_at")) or datetime.min.replace(tzinfo=timezone.utc)) >= cutoff_dt
    }

    onboarding_user_ids = {
        str(row.get("user_id"))
        for row in timeline_rows
        if row.get("event_type") == "funnel_onboarding_completed" and row.get("user_id")
    }
    first_upload_user_ids = {
        str(row.get("user_id"))
        for row in timeline_rows
        if row.get("event_type") == "funnel_first_upload_completed" and row.get("user_id")
    }
    paywall_user_ids = {
        str(row.get("user_id"))
        for row in timeline_rows
        if row.get("event_type") == "funnel_paywall_shown" and row.get("user_id")
    }

    paid_user_ids = {
        str(row.get("id"))
        for row in end_users
        if row.get("id") and str(row.get("sub_status") or "").lower() == "active"
    }

    signup_created_at: Dict[str, datetime] = {}
    for row in end_users:
        user_id = str(row.get("id") or "")
        if not user_id:
            continue
        created_dt = _parse_dt(row.get("created_at"))
        if created_dt and created_dt >= cutoff_dt and user_id in signup_user_ids:
            signup_created_at[user_id] = created_dt

    first_onboarding_at: Dict[str, datetime] = {}
    first_upload_at: Dict[str, datetime] = {}
    first_paywall_at: Dict[str, datetime] = {}
    for row in timeline_rows:
        user_id = str(row.get("user_id") or "")
        event_type = str(row.get("event_type") or "")
        occurred_dt = _parse_dt(row.get("occurred_at"))
        if not user_id or not occurred_dt:
            continue
        if event_type == "funnel_onboarding_completed":
            if user_id not in first_onboarding_at or occurred_dt < first_onboarding_at[user_id]:
                first_onboarding_at[user_id] = occurred_dt
        elif event_type == "funnel_first_upload_completed":
            if user_id not in first_upload_at or occurred_dt < first_upload_at[user_id]:
                first_upload_at[user_id] = occurred_dt
        elif event_type == "funnel_paywall_shown":
            if user_id not in first_paywall_at or occurred_dt < first_paywall_at[user_id]:
                first_paywall_at[user_id] = occurred_dt

    def _avg_lag_days(source: Dict[str, datetime]) -> float:
        values: List[float] = []
        for user_id, start_dt in signup_created_at.items():
            target_dt = source.get(user_id)
            if not target_dt:
                continue
            delta = (target_dt - start_dt).total_seconds() / 86400.0
            if delta >= 0:
                values.append(delta)
        if not values:
            return 0.0
        return round(sum(values) / len(values), 2)

    date_counts: Dict[str, int] = {}
    for user_id in signup_user_ids:
        dt = signup_created_at.get(user_id)
        if not dt:
            continue
        day = dt.date().isoformat()
        date_counts[day] = date_counts.get(day, 0) + 1
    daily_signups = [
        {"date": day, "count": count}
        for day, count in sorted(date_counts.items())
    ]

    def _rate(numerator: int, denominator: int) -> float:
        if denominator <= 0:
            return 0.0
        return round((numerator / denominator) * 100.0, 2)

    def _is_missing_questionnaire_storage_error(ex: Exception) -> bool:
        msg = str(ex)
        return "PGRST205" in msg and (
            "questionnaire_sessions" in msg or "questionnaire_answers" in msg
        )

    questionnaire_started_sessions = 0
    questionnaire_completed_sessions = 0
    questionnaire_median_minutes = 0.0
    questionnaire_dropoff_by_question: List[Dict[str, Any]] = []
    questionnaire_no_answer_incomplete = 0
    questionnaire_daily_cohorts: List[Dict[str, Any]] = []
    questionnaire_confidence_daily: List[Dict[str, Any]] = []

    try:
        questionnaire_sessions_resp = await _run(
            lambda: supabase.table("questionnaire_sessions")
            .select("id,user_id,status,started_at,completed_at,last_question_order")
            .gte("started_at", cutoff)
            .execute()
        )
        questionnaire_sessions = questionnaire_sessions_resp.data or []
        questionnaire_started_sessions = len(questionnaire_sessions)

        daily_started_counts: Dict[str, int] = {}
        daily_completed_counts: Dict[str, int] = {}
        for row in questionnaire_sessions:
            started_dt = _parse_dt(row.get("started_at"))
            if started_dt:
                started_day = started_dt.date().isoformat()
                daily_started_counts[started_day] = daily_started_counts.get(started_day, 0) + 1

            if str(row.get("status") or "").lower() == "completed":
                completed_dt = _parse_dt(row.get("completed_at"))
                completed_day = (completed_dt or started_dt)
                if completed_day:
                    day = completed_day.date().isoformat()
                    daily_completed_counts[day] = daily_completed_counts.get(day, 0) + 1

        completed_sessions = [
            row
            for row in questionnaire_sessions
            if str(row.get("status") or "").lower() == "completed"
        ]
        questionnaire_completed_sessions = len(completed_sessions)

        completion_minutes: List[float] = []
        for row in completed_sessions:
            started_dt = _parse_dt(row.get("started_at"))
            completed_dt = _parse_dt(row.get("completed_at"))
            if not started_dt or not completed_dt:
                continue
            minutes = (completed_dt - started_dt).total_seconds() / 60.0
            if minutes >= 0:
                completion_minutes.append(minutes)

        if completion_minutes:
            sorted_minutes = sorted(completion_minutes)
            mid = len(sorted_minutes) // 2
            if len(sorted_minutes) % 2 == 0:
                questionnaire_median_minutes = round((sorted_minutes[mid - 1] + sorted_minutes[mid]) / 2.0, 1)
            else:
                questionnaire_median_minutes = round(sorted_minutes[mid], 1)

        session_ids = [str(row.get("id")) for row in questionnaire_sessions if row.get("id")]
        question_answers = []
        if session_ids:
            answers_resp = await _run(
                lambda: supabase.table("questionnaire_answers")
                .select("session_id,question_id,question_order")
                .in_("session_id", session_ids)
                .execute()
            )
            question_answers = answers_resp.data or []

        max_order_by_session: Dict[str, int] = {}
        question_id_by_order_counts: Dict[int, Dict[str, int]] = {}
        for row in question_answers:
            sid = str(row.get("session_id") or "")
            if not sid:
                continue
            order = int(row.get("question_order") or 0)
            if order <= 0:
                continue
            max_order_by_session[sid] = max(max_order_by_session.get(sid, 0), order)

            qid = str(row.get("question_id") or "")
            if qid:
                bucket = question_id_by_order_counts.setdefault(order, {})
                bucket[qid] = bucket.get(qid, 0) + 1

        incomplete_sessions = [
            row
            for row in questionnaire_sessions
            if str(row.get("status") or "").lower() != "completed"
        ]
        dropoff_order_counts: Dict[int, int] = {}
        for row in incomplete_sessions:
            sid = str(row.get("id") or "")
            stop_order = max_order_by_session.get(sid, int(row.get("last_question_order") or 0))
            if stop_order <= 0:
                questionnaire_no_answer_incomplete += 1
                continue
            dropoff_order_counts[stop_order] = dropoff_order_counts.get(stop_order, 0) + 1

        max_seen_order = max(max_order_by_session.values(), default=0)
        for order in range(1, max_seen_order + 1):
            sessions_reached = sum(1 for reached in max_order_by_session.values() if reached >= order)
            if sessions_reached < safe_min_dropoff_reached:
                continue
            order_qids = question_id_by_order_counts.get(order, {})
            question_id = max(order_qids, key=order_qids.get) if order_qids else f"order_{order}"
            dropoff_count = dropoff_order_counts.get(order, 0)
            questionnaire_dropoff_by_question.append(
                {
                    "question_order": order,
                    "question_id": question_id,
                    "sessions_reached": sessions_reached,
                    "dropoff_count": dropoff_count,
                    "dropoff_rate_pct": _rate(dropoff_count, sessions_reached),
                }
            )

        all_days = sorted(set(daily_started_counts.keys()) | set(daily_completed_counts.keys()))
        for day in all_days:
            started = daily_started_counts.get(day, 0)
            completed = daily_completed_counts.get(day, 0)
            incomplete = max(0, started - completed)
            questionnaire_daily_cohorts.append(
                {
                    "date": day,
                    "started": started,
                    "completed": completed,
                    "incomplete": incomplete,
                    "completion_rate_pct": _rate(completed, started),
                }
            )

        def _confidence_from_sample(sample_size: int) -> str:
            if sample_size >= 50:
                return "high"
            if sample_size >= 15:
                return "medium"
            if sample_size >= 1:
                return "low"
            return "unknown"

        for day in all_days:
            sample_size = int(daily_started_counts.get(day, 0))
            questionnaire_confidence_daily.append(
                {
                    "date": day,
                    "sample_size": sample_size,
                    "level": _confidence_from_sample(sample_size),
                }
            )
    except Exception as ex:
        if not _is_missing_questionnaire_storage_error(ex):
            raise

    signups = len(signup_user_ids)
    onboarding_completed = len(onboarding_user_ids)
    first_upload_completed = len(first_upload_user_ids)
    paywall_seen = len(paywall_user_ids)
    paid_total = len(paid_user_ids)

    def _dropoff_sort_key(row: Dict[str, Any]) -> tuple:
        if safe_dropoff_sort == "rate":
            return (
                -float(row.get("dropoff_rate_pct") or 0),
                -float(row.get("dropoff_count") or 0),
                -float(row.get("sessions_reached") or 0),
            )
        if safe_dropoff_sort == "order":
            return (
                int(row.get("question_order") or 0),
                -float(row.get("dropoff_count") or 0),
            )
        return (
            -float(row.get("dropoff_count") or 0),
            -float(row.get("sessions_reached") or 0),
        )

    sorted_dropoff = sorted(questionnaire_dropoff_by_question, key=_dropoff_sort_key)
    sorted_dropoff = sorted_dropoff[:safe_dropoff_limit]

    dropoff_sort_explainer = {
        "count": "Sorted by highest dropoff_count, then sessions_reached.",
        "rate": "Sorted by highest dropoff_rate_pct, then dropoff_count, then sessions_reached.",
        "order": "Sorted by earliest question_order, then dropoff_count.",
    }.get(safe_dropoff_sort, "Sorted by highest dropoff_count, then sessions_reached.")

    # Rollup confidence summary across all daily points
    if questionnaire_confidence_daily:
        _cd_samples = [p["sample_size"] for p in questionnaire_confidence_daily]
        _cd_avg = sum(_cd_samples) / len(_cd_samples)
        _cd_level_counts: Dict[str, int] = {}
        for p in questionnaire_confidence_daily:
            _cd_level_counts[p["level"]] = _cd_level_counts.get(p["level"], 0) + 1
        _dominant_level = max(_cd_level_counts, key=lambda k: _cd_level_counts[k])
        _low_days = _cd_level_counts.get("low", 0) + _cd_level_counts.get("unknown", 0)
        _low_days_share = round(_low_days / len(questionnaire_confidence_daily) * 100, 1)
        confidence_rollup = {
            "avg_sample_size": round(_cd_avg, 1),
            "dominant_level": _dominant_level,
            "low_days_share_pct": _low_days_share,
            "total_days": len(questionnaire_confidence_daily),
        }
    else:
        confidence_rollup = {
            "avg_sample_size": 0,
            "dominant_level": "unknown",
            "low_days_share_pct": 100.0,
            "total_days": 0,
        }

    if questionnaire_started_sessions >= 50:
        confidence_level = "high"
    elif questionnaire_started_sessions >= 15:
        confidence_level = "medium"
    else:
        confidence_level = "low"

    confidence_notes: List[str] = []
    if questionnaire_started_sessions < 15:
        confidence_notes.append("Low sample size: interpretation may be unstable.")
    if questionnaire_no_answer_incomplete > 0:
        confidence_notes.append("Some sessions ended before first answer.")
    if len(sorted_dropoff) == 0:
        confidence_notes.append("No drop-off rows matched the current threshold and window.")

    return {
        "window_days": safe_days,
        "min_dropoff_reached": safe_min_dropoff_reached,
        "dropoff_sort": safe_dropoff_sort,
        "dropoff_limit": safe_dropoff_limit,
        "counts": {
            "signup": signups,
            "onboarding_completed": onboarding_completed,
            "first_upload_completed": first_upload_completed,
            "paywall_seen": paywall_seen,
            "paid_total_end_users": paid_total,
        },
        "rates": {
            "signup_to_onboarding_pct": _rate(onboarding_completed, signups),
            "onboarding_to_first_upload_pct": _rate(first_upload_completed, onboarding_completed),
            "signup_to_first_upload_pct": _rate(first_upload_completed, signups),
            "paywall_to_paid_pct": _rate(len(paywall_user_ids & paid_user_ids), paywall_seen),
            "signup_to_paid_pct": _rate(len(signup_user_ids & paid_user_ids), signups),
        },
        "lag_days": {
            "signup_to_onboarding_avg": _avg_lag_days(first_onboarding_at),
            "signup_to_first_upload_avg": _avg_lag_days(first_upload_at),
            "signup_to_paywall_avg": _avg_lag_days(first_paywall_at),
        },
        "daily_signups": daily_signups,
        "questionnaire": {
            "started_sessions": questionnaire_started_sessions,
            "completed_sessions": questionnaire_completed_sessions,
            "completion_rate_pct": _rate(questionnaire_completed_sessions, questionnaire_started_sessions),
            "median_minutes_to_complete": questionnaire_median_minutes,
            "incomplete_no_answers": questionnaire_no_answer_incomplete,
            "dropoff_sort_explainer": dropoff_sort_explainer,
            "dropoff_by_question": sorted_dropoff,
            "data_confidence": {
                "level": confidence_level,
                "sample_size": questionnaire_started_sessions,
                "dropoff_rows_available": len(questionnaire_dropoff_by_question),
                "dropoff_rows_returned": len(sorted_dropoff),
                "notes": confidence_notes,
            },
            "daily_cohorts": questionnaire_daily_cohorts,
            "confidence_daily": questionnaire_confidence_daily,
            "confidence_rollup": confidence_rollup,
        },
    }


# ──────────────────────────────────────────────
# PROFILE
# ──────────────────────────────────────────────

async def get_user_profile(user_id: str) -> Dict[str, Any]:
    profile = await _select_first_by_id_with_fallback("user_profile", "*", user_id)
    await _audit_medical_read(
        user_id=user_id,
        entity_type="user_profile",
        entity_id=user_id,
        details={"found": bool(profile)},
    )
    return profile


async def upsert_user_profile(user_id: str, data: Dict[str, Any]) -> Dict[str, Any]:
    supabase = _get_supabase()
    payload = {"id": user_id, **data, "updated_at": datetime.now(timezone.utc).isoformat()}
    resp = await _run(
        lambda: supabase.table("user_profile")
        .upsert(payload, on_conflict="id")
        .execute()
    )
    await _emit_timeline(user_id, "profile_updated", "Profile updated", metadata={"fields": list(data.keys())})
    result = resp.data[0] if resp.data else payload
    await _audit_medical_write(
        user_id=user_id,
        action="update",
        entity_type="user_profile",
        entity_id=user_id,
        details={"fields": list(data.keys())},
    )
    return result


async def get_user_location(user_id: str) -> Optional[Dict]:
    supabase = _get_supabase()
    resp = await _run(
        lambda: supabase.table("user_locations")
        .select("*")
        .eq("user_id", user_id)
        .eq("is_primary", True)
        .limit(1)
        .execute()
    )
    location = resp.data[0] if resp.data else None
    await _audit_medical_read(
        user_id=user_id,
        entity_type="user_location",
        entity_id=user_id,
        details={"found": bool(location)},
    )
    return location


async def upsert_user_location(user_id: str, data: Dict[str, Any]) -> Dict[str, Any]:
    supabase = _get_supabase()
    await _run(lambda: supabase.table("user_locations").delete().eq("user_id", user_id).execute())
    payload = {"user_id": user_id, "is_primary": True, **data}
    resp = await _run(lambda: supabase.table("user_locations").insert(payload).execute())
    result = resp.data[0] if resp.data else payload
    await _audit_medical_write(
        user_id=user_id,
        action="update",
        entity_type="user_location",
        entity_id=str(result.get("id") or user_id),
        details={"fields": list(data.keys())},
    )
    return result


# ──────────────────────────────────────────────
# RECURRING COMPLAINTS
# ──────────────────────────────────────────────

async def get_complaints(user_id: str) -> List[Dict]:
    supabase = _get_supabase()
    resp = await _run(
        lambda: supabase.table("recurring_complaints")
        .select("*")
        .eq("user_id", user_id)
        .order("created_at", desc=False)
        .execute()
    )
    complaints = resp.data or []
    await _audit_medical_read(
        user_id=user_id,
        entity_type="recurring_complaints",
        details={"count": len(complaints)},
    )
    return complaints


async def add_complaint(user_id: str, complaint: str, duration: Optional[str] = None, tried: Optional[str] = None) -> Dict:
    supabase = _get_supabase()
    payload: Dict[str, Any] = {"user_id": user_id, "complaint": complaint}
    if duration:
        payload["duration_description"] = duration
    if tried:
        payload["tried_interventions"] = tried
    resp = await _run(lambda: supabase.table("recurring_complaints").insert(payload).execute())
    await _emit_timeline(user_id, "complaint_added", f"Complaint added: {complaint[:60]}")
    result = resp.data[0]
    await _audit_medical_write(
        user_id=user_id,
        action="create",
        entity_type="recurring_complaints",
        entity_id=str(result.get("id") or ""),
        details={"has_duration": bool(duration), "has_tried_interventions": bool(tried)},
    )
    return result


async def delete_complaint(user_id: str, complaint_id: str) -> None:
    supabase = _get_supabase()
    await _run(
        lambda: supabase.table("recurring_complaints")
        .delete()
        .eq("id", complaint_id)
        .eq("user_id", user_id)
        .execute()
    )
    await _audit_medical_write(
        user_id=user_id,
        action="delete",
        entity_type="recurring_complaints",
        entity_id=complaint_id,
    )


# ──────────────────────────────────────────────
# WEEKLY CHECK-INS
# ──────────────────────────────────────────────

async def submit_weekly_checkin(user_id: str, data: Dict[str, Any]) -> Dict:
    supabase = _get_supabase()
    for field_name in ("energy_score", "sleep_quality", "mood_score", "protocol_adherence"):
        if field_name in data and data[field_name] is not None:
            data[field_name] = max(1, min(int(data[field_name]), 10))
    payload = {"user_id": user_id, **data}
    resp = await _run(
        lambda: supabase.table("checkins_weekly")
        .upsert(payload, on_conflict="user_id,week_start")
        .execute()
    )
    result = resp.data[0] if resp.data else payload
    await _emit_timeline(user_id, "weekly_checkin_submitted", f"Weekly check-in submitted for {data.get('week_start', 'this week')}")
    await _evaluate_checkin_red_flags(user_id, data)
    await _audit_medical_write(
        user_id=user_id,
        action="update",
        entity_type="weekly_checkin",
        entity_id=str(result.get("id") or f"{user_id}:{data.get('week_start', '')}"),
        details={"week_start": data.get("week_start")},
    )
    return result


async def _evaluate_checkin_red_flags(user_id: str, data: Dict[str, Any]) -> None:
    flags = []
    if data.get("energy_score", 10) <= 2:
        flags.append("Very low energy reported")
    if data.get("mood_score", 10) <= 2:
        flags.append("Very low mood reported")
    if data.get("sleep_quality", 10) <= 2:
        flags.append("Severely disrupted sleep reported")
    if flags:
        await create_red_flag(user_id, "checkin_response", "; ".join(flags), metadata={"checkin": data})


async def get_weekly_checkins(user_id: str, limit: int = 12) -> List[Dict]:
    supabase = _get_supabase()
    resp = await _run(
        lambda: supabase.table("checkins_weekly")
        .select("*")
        .eq("user_id", user_id)
        .order("week_start", desc=True)
        .limit(limit)
        .execute()
    )
    checkins = resp.data or []
    await _audit_medical_read(
        user_id=user_id,
        entity_type="weekly_checkin",
        details={"count": len(checkins), "limit": limit},
    )
    return checkins


# ──────────────────────────────────────────────
# RED FLAGS
# ──────────────────────────────────────────────

async def create_red_flag(user_id: str, trigger_type: str, summary: str,
                           severity: str = "high", metadata: Optional[Dict] = None) -> Dict:
    supabase = _get_supabase()
    payload: Dict[str, Any] = {
        "user_id": user_id,
        "trigger_type": trigger_type,
        "summary": summary,
        "severity": severity,
        "metadata": metadata or {},
    }
    resp = await _run(lambda: supabase.table("red_flag_events").insert(payload).execute())
    await _emit_timeline(user_id, "red_flag_triggered", f"Red flag: {summary[:80]}", metadata={"severity": severity})
    result = resp.data[0] if resp.data else payload
    await _audit_medical_write(
        user_id=user_id,
        action="create",
        entity_type="red_flag",
        entity_id=str(result.get("id") or ""),
        details={"trigger_type": trigger_type, "severity": severity},
    )
    return result


async def get_user_red_flags(user_id: str) -> List[Dict]:
    supabase = _get_supabase()
    resp = await _run(
        lambda: supabase.table("red_flag_events")
        .select("*")
        .eq("user_id", user_id)
        .order("created_at", desc=True)
        .execute()
    )
    flags = resp.data or []
    await _audit_medical_read(
        user_id=user_id,
        entity_type="red_flag",
        details={"count": len(flags)},
    )
    return flags


async def acknowledge_red_flag(user_id: str, flag_id: str) -> Dict:
    supabase = _get_supabase()
    resp = await _run(
        lambda: supabase.table("red_flag_events")
        .update({"acknowledged": True, "acknowledged_at": datetime.now(timezone.utc).isoformat()})
        .eq("id", flag_id)
        .eq("user_id", user_id)
        .execute()
    )
    result = resp.data[0] if resp.data else {}
    await _audit_medical_write(
        user_id=user_id,
        action="update",
        entity_type="red_flag",
        entity_id=flag_id,
        details={"acknowledged": True},
    )
    return result


async def get_all_red_flags(acknowledged: Optional[bool] = False) -> List[Dict]:
    supabase = _get_supabase()
    query = supabase.table("red_flag_events").select("*, users(email, full_name)")
    if acknowledged is not None:
        query = query.eq("acknowledged", acknowledged)
    resp = await _run(lambda: query.order("created_at", desc=True).limit(200).execute())
    return resp.data or []


# ──────────────────────────────────────────────
# INSIGHTS
# ──────────────────────────────────────────────

async def generate_insights(user_id: str) -> List[Dict]:
    """Rule-based MVP insight engine."""
    supabase = _get_supabase()
    insights_list: List[Dict] = []

    symptom_data = await get_user_symptom_summary(user_id, days=30)
    prev_symptom_data = await get_user_symptom_summary(user_id, days=60)
    if symptom_data["average_severity"] > 0 and prev_symptom_data["average_severity"] > 0:
        delta = symptom_data["average_severity"] - prev_symptom_data["average_severity"]
        if delta <= -1.0:
            insights_list.append({
                "insight_type": "symptom_trend",
                "title": "Symptom severity improving",
                "body": f"Your average symptom severity decreased by {abs(delta):.1f} points over the last 30 days.",
                "priority": 1,
            })
        elif delta >= 1.5:
            insights_list.append({
                "insight_type": "symptom_trend",
                "title": "Symptom severity increasing",
                "body": "Your symptoms appear to be worsening. Consider consulting a physician if this persists.",
                "priority": 4,
            })

    uploads_resp = await _run(
        lambda: supabase.table("lab_uploads")
        .select("created_at")
        .eq("user_id", user_id)
        .order("created_at", desc=True)
        .limit(1)
        .execute()
    )
    if uploads_resp.data:
        last_upload = uploads_resp.data[0]["created_at"]
        try:
            upload_dt = datetime.fromisoformat(str(last_upload).replace("Z", "+00:00"))
        except (TypeError, ValueError):
            upload_dt = datetime.now(timezone.utc)
        days_since = (datetime.now(timezone.utc) - upload_dt).days
        if days_since >= 60:
            insights_list.append({
                "insight_type": "retest_suggestion",
                "title": "Time to re-test your labs",
                "body": f"Your last lab upload was {days_since} days ago. Re-testing helps track progress accurately.",
                "priority": 3,
            })

    checkins = await get_weekly_checkins(user_id, limit=4)
    if checkins:
        latest_checkin = checkins[0]
        adherence = latest_checkin.get("protocol_adherence")
        symptom_changes = (latest_checkin.get("symptom_changes") or "").strip()
        low_scores = [
            ("energy", latest_checkin.get("energy_score")),
            ("sleep", latest_checkin.get("sleep_quality")),
            ("mood", latest_checkin.get("mood_score")),
        ]
        concerning_scores = [name for name, value in low_scores if isinstance(value, int) and value <= 3]

        if isinstance(adherence, int) and adherence <= 4:
            insights_list.append({
                "insight_type": "adherence",
                "title": "Protocol adherence is slipping",
                "body": "Your latest weekly check-in shows low adherence. Tighten the routine before changing the protocol.",
                "priority": 3,
            })
        elif isinstance(adherence, int) and adherence >= 8:
            insights_list.append({
                "insight_type": "adherence",
                "title": "Adherence looks strong",
                "body": "You are following the protocol consistently. Keep this pace and retest to validate biomarker changes.",
                "priority": 2,
            })

        if concerning_scores:
            insights_list.append({
                "insight_type": "general",
                "title": "Weekly check-in shows high strain",
                "body": f"Your latest check-in shows pressure in {', '.join(concerning_scores)}. Review recovery, sleep, and escalation signals closely.",
                "priority": 4,
            })
        elif symptom_changes:
            insights_list.append({
                "insight_type": "general",
                "title": "Symptom changes recorded",
                "body": f"Latest note: {symptom_changes[:160]}",
                "priority": 2,
            })
    else:
        insights_list.append({
            "insight_type": "adherence",
            "title": "Start your weekly check-ins",
            "body": "Weekly check-ins personalize your health guidance. Complete your first check-in now.",
            "priority": 2,
        })

    if insights_list:
        rows = [{"user_id": user_id, **i} for i in insights_list]
        await _run(lambda: supabase.table("insights").insert(rows).execute())
        await _emit_timeline(user_id, "insight_created", f"{len(insights_list)} new insight(s) generated")
        await _audit_medical_write(
            user_id=user_id,
            action="create",
            entity_type="insights",
            details={"count": len(insights_list)},
        )

    return insights_list


async def get_user_insights(user_id: str) -> List[Dict]:
    supabase = _get_supabase()
    resp = await _run(
        lambda: supabase.table("insights")
        .select("*")
        .eq("user_id", user_id)
        .eq("dismissed", False)
        .order("priority", desc=True)
        .order("created_at", desc=True)
        .limit(10)
        .execute()
    )
    insights = resp.data or []
    await _audit_medical_read(
        user_id=user_id,
        entity_type="insights",
        details={"count": len(insights)},
    )
    return insights


async def dismiss_insight(user_id: str, insight_id: str) -> None:
    supabase = _get_supabase()
    await _run(
        lambda: supabase.table("insights")
        .update({"dismissed": True})
        .eq("id", insight_id)
        .eq("user_id", user_id)
        .execute()
    )
    await _audit_medical_write(
        user_id=user_id,
        action="update",
        entity_type="insights",
        entity_id=insight_id,
        details={"dismissed": True},
    )


# ──────────────────────────────────────────────
# HEALTH SCORE
# ──────────────────────────────────────────────

async def calculate_health_score(user_id: str) -> Dict[str, Any]:
    symptom_data = await get_user_symptom_summary(user_id, days=30)
    checkins = await get_weekly_checkins(user_id, limit=4)
    supabase = _get_supabase()

    avg_sev = symptom_data.get("average_severity", 5)
    symptom_component = round(max(0.0, 100.0 - (avg_sev * 10)), 2)
    adherence_component = round(min(100.0, (len(checkins) / 4) * 100), 2)

    bio_resp = await _run(
        lambda: supabase.table("biomarkers")
        .select("status")
        .eq("user_id", user_id)
        .order("created_at", desc=True)
        .limit(50)
        .execute()
    )
    bio_rows = bio_resp.data or []
    if bio_rows:
        optimal = sum(1 for b in bio_rows if b["status"] == "OPTIMAL")
        biomarker_component = round((optimal / len(bio_rows)) * 100, 2)
    else:
        biomarker_component = 50.0

    score = round((symptom_component * 0.4 + adherence_component * 0.2 + biomarker_component * 0.4), 2)
    result = {
        "score": score,
        "symptom_component": symptom_component,
        "biomarker_component": biomarker_component,
        "adherence_component": adherence_component,
        "calculated_at": datetime.now(timezone.utc).isoformat(),
    }
    await _run(lambda: supabase.table("health_scores").insert({"user_id": user_id, **result}).execute())
    await _audit_medical_read(
        user_id=user_id,
        entity_type="biomarkers",
        details={"sample_size": len(bio_rows), "source": "health_score_calc"},
    )
    await _audit_medical_write(
        user_id=user_id,
        action="create",
        entity_type="health_scores",
        details={"score": result.get("score")},
    )
    return result


# ──────────────────────────────────────────────
# TIMELINE
# ──────────────────────────────────────────────

async def _emit_timeline(user_id: str, event_type: str, summary: str,
                          source: Optional[str] = None, metadata: Optional[Dict] = None) -> None:
    supabase = _get_supabase()
    payload = {
        "user_id": user_id,
        "event_type": event_type,
        "summary": summary,
        "source": source or "system",
        "metadata": metadata or {},
    }
    try:
        await _run(lambda: supabase.table("timeline_events").insert(payload).execute())
    except Exception:
        pass


async def save_timeline_event(user_id: str, event_type: str, summary: str,
                              source: Optional[str] = None, metadata: Optional[Dict] = None) -> None:
    await _emit_timeline(user_id, event_type, summary, source=source, metadata=metadata)


async def get_user_timeline(user_id: str, limit: int = 30) -> List[Dict]:
    supabase = _get_supabase()
    resp = await _run(
        lambda: supabase.table("timeline_events")
        .select("*")
        .eq("user_id", user_id)
        .order("occurred_at", desc=True)
        .limit(limit)
        .execute()
    )
    timeline = resp.data or []
    await _audit_medical_read(
        user_id=user_id,
        entity_type="timeline_events",
        details={"count": len(timeline), "limit": limit},
    )
    return timeline


# ──────────────────────────────────────────────
# NOTIFICATIONS
# ──────────────────────────────────────────────

async def get_user_notifications(user_id: str, limit: int = 20) -> List[Dict]:
    supabase = _get_supabase()
    resp = await _run(
        lambda: supabase.table("notifications")
        .select("*")
        .eq("user_id", user_id)
        .order("created_at", desc=True)
        .limit(limit)
        .execute()
    )
    return resp.data or []


async def create_notification(user_id: str, trigger_type: str, subject: str,
                               body: str, channel: str = "in_app") -> Dict:
    supabase = _get_supabase()
    payload: Dict[str, Any] = {
        "user_id": user_id,
        "trigger_type": trigger_type,
        "channel": channel,
        "subject": subject,
        "body": body,
    }
    resp = await _run(lambda: supabase.table("notifications").insert(payload).execute())
    await _emit_timeline(user_id, "notification_sent", f"Notification: {subject[:60]}")
    return resp.data[0] if resp.data else payload


# ──────────────────────────────────────────────
# ADMIN HELPERS
# ──────────────────────────────────────────────

async def get_all_users_for_admin(limit: int = 200) -> List[Dict]:
    supabase = _get_supabase()
    resp = await _run(
        lambda: supabase.table("users")
        .select("id, email, full_name, age, sex, sub_status, created_at")
        .order("created_at", desc=True)
        .limit(limit)
        .execute()
    )
    return resp.data or []


async def get_platform_overview() -> Dict[str, Any]:
    """Multi-org platform aggregation for super-admin dashboards."""
    supabase = _get_supabase()
    cutoff_24h = (datetime.now(timezone.utc) - timedelta(hours=24)).isoformat()

    users_total_resp = await _run(lambda: supabase.table("users").select("id", count="exact").execute())
    org_total_resp = await _run(lambda: supabase.table("organizations").select("id", count="exact").execute())

    active_programs_resp = await _run(
        lambda: supabase.table("practitioner_assignments")
        .select("id", count="exact")
        .eq("status", "active")
        .execute()
    )

    registrations_24h_resp = await _run(
        lambda: supabase.table("users")
        .select("id", count="exact")
        .gte("created_at", cutoff_24h)
        .execute()
    )

    return {
        "total_users": users_total_resp.count or len(users_total_resp.data),
        "total_organizations": org_total_resp.count or len(org_total_resp.data),
        "active_programs": active_programs_resp.count or len(active_programs_resp.data),
        "new_registrations_24h": registrations_24h_resp.count or len(registrations_24h_resp.data),
        "generated_at": datetime.now(timezone.utc).isoformat(),
    }


async def get_audit_logs(limit: int = 200, organization_id: Optional[str] = None) -> List[Dict[str, Any]]:
    """Return latest platform audit events for Ops visibility.

    audit_logs real schema: id, user_id, action, entity_type, entity_id, created_at
    (no timestamp, organization_id, old_value, new_value columns in current DB).
    Falls back to timeline_events when audit_logs is empty.
    """
    supabase = _get_supabase()

    try:
        resp = await _run(
            lambda: supabase.table("audit_logs")
            .select("id,user_id,action,entity_type,entity_id,created_at")
            .order("created_at", desc=True)
            .limit(limit)
            .execute()
        )
        rows = resp.data or []
        if rows:
            # Normalize to a consistent shape for the CRM Ops feed
            return [
                {
                    "id": row.get("id"),
                    "user_id": row.get("user_id"),
                    "action": row.get("action"),
                    "entity_type": row.get("entity_type"),
                    "entity_id": row.get("entity_id"),
                    "organization_id": None,
                    "old_value": {},
                    "new_value": {},
                    "timestamp": row.get("created_at"),
                }
                for row in rows
            ]

        # Fallback: if audit feed is empty, expose recent timeline events for Ops visibility.
        timeline_resp = await _run(
            lambda: supabase.table("timeline_events")
            .select("id,user_id,event_type,summary,occurred_at")
            .order("occurred_at", desc=True)
            .limit(limit)
            .execute()
        )
        timeline_rows = timeline_resp.data or []
        return [
            {
                "id": row.get("id"),
                "user_id": row.get("user_id"),
                "action": row.get("event_type") or "timeline_event",
                "entity_type": "timeline_event",
                "entity_id": row.get("id") or str(uuid4()),
                "organization_id": None,
                "old_value": {},
                "new_value": {"summary": row.get("summary")},
                "timestamp": row.get("occurred_at"),
            }
            for row in timeline_rows
        ]

    except Exception as ex:
        # Keep Ops UI available even if audit feed backend storage is misconfigured.
        _logger.warning("audit_logs_read_failed returning_empty_feed error=%s", ex)
        return []


async def write_audit_log(
    *,
    user_id: Optional[str],
    action: str,
    entity_type: str,
    entity_id: Optional[str] = None,
    old_value: Optional[Dict[str, Any]] = None,
    new_value: Optional[Dict[str, Any]] = None,
    organization_id: Optional[str] = None,
) -> None:
    """Best-effort audit logging helper that never raises."""
    try:
        supabase = _get_supabase()
        payload_full = {
            "user_id": user_id,
            "action": action,
            "entity_type": entity_type,
            "entity_id": entity_id or str(uuid4()),
            "old_value": old_value or {},
            "new_value": new_value or {},
            "organization_id": organization_id,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }

        payload_minimal = {
            "user_id": user_id,
            "action": action,
            "entity_type": entity_type,
            "entity_id": payload_full["entity_id"],
        }

        allowed_actions = {"create", "read", "update", "delete", "assign", "reassign"}
        allowed_entity_types = {"client", "practitioner", "program", "subscription", "questionnaire", "client_program"}
        legacy_entity_type = entity_type if entity_type in allowed_entity_types else "client"

        payload_legacy = {
            "user_id": user_id,
            "action": action if action in allowed_actions else "update",
            "entity_type": legacy_entity_type,
            "entity_id": str(uuid4()),
            "changes": {
                "source_action": action,
                "source_entity_type": entity_type,
                "source_entity_id": payload_full["entity_id"],
                "old_value": old_value or {},
                "new_value": new_value or {},
                "organization_id": organization_id,
            },
        }

        try:
            await _run(lambda: supabase.table("audit_logs").insert(payload_full).execute())
            return
        except Exception:
            # Fallback for partially migrated schemas where extended audit columns are absent.
            try:
                await _run(lambda: supabase.table("audit_logs").insert(payload_minimal).execute())
                return
            except Exception:
                # Final fallback for legacy constraints: action/entity_type/check-limited schema.
                await _run(lambda: supabase.table("audit_logs").insert(payload_legacy).execute())
    except Exception as ex:
        _logger.warning("audit_log_write_failed action=%s entity_type=%s error=%s", action, entity_type, ex)


async def get_admin_user_detail(user_id: str) -> Dict[str, Any]:
    supabase = _get_supabase()
    user_resp, profile_resp, location_resp, complaints_resp, checkins_resp, uploads_resp, red_flags_resp, timeline_resp = \
        await asyncio.gather(
            _run(lambda: supabase.table("users").select("*").eq("id", user_id).limit(1).execute()),
            _run(lambda: supabase.table("user_profile").select("*").eq("id", user_id).limit(1).execute()),
            _run(lambda: supabase.table("user_locations").select("*").eq("user_id", user_id).execute()),
            _run(lambda: supabase.table("recurring_complaints").select("*").eq("user_id", user_id).execute()),
            _run(lambda: supabase.table("checkins_weekly").select("*").eq("user_id", user_id).order("week_start", desc=True).limit(12).execute()),
            _run(lambda: supabase.table("lab_uploads").select("id,lab_name,created_at,status").eq("user_id", user_id).order("created_at", desc=True).limit(10).execute()),
            _run(lambda: supabase.table("red_flag_events").select("*").eq("user_id", user_id).order("created_at", desc=True).execute()),
            _run(lambda: supabase.table("timeline_events").select("*").eq("user_id", user_id).order("occurred_at", desc=True).limit(20).execute()),
        )
    return {
        "user": user_resp.data[0] if user_resp.data else None,
        "profile": profile_resp.data[0] if profile_resp.data else None,
        "locations": location_resp.data or [],
        "complaints": complaints_resp.data or [],
        "checkins": checkins_resp.data or [],
        "uploads": uploads_resp.data or [],
        "red_flags": red_flags_resp.data or [],
        "timeline": timeline_resp.data or [],
    }


async def redact_old_lab_upload_text(
    *,
    retention_days: int,
    batch_size: int,
    dry_run: bool = True,
) -> Dict[str, Any]:
    """Redact old raw extracted_text values while preserving biomarker history.

    This keeps longitudinal insights but minimizes storage of raw medical text.
    """
    supabase = _get_supabase()
    safe_days = max(30, min(retention_days, 3650))
    safe_batch = max(1, min(batch_size, 5000))
    cutoff_iso = (datetime.now(timezone.utc) - timedelta(days=safe_days)).isoformat()

    resp = await _run(
        lambda: supabase.table("lab_uploads")
        .select("id,user_id,created_at,extracted_text")
        .lt("created_at", cutoff_iso)
        .order("created_at", desc=False)
        .limit(safe_batch)
        .execute()
    )

    rows = resp.data or []
    to_redact = [row for row in rows if str(row.get("extracted_text") or "").strip()]
    target_ids = [str(row.get("id")) for row in to_redact if row.get("id")]

    result: Dict[str, Any] = {
        "cutoff": cutoff_iso,
        "retention_days": safe_days,
        "batch_size": safe_batch,
        "candidates_scanned": len(rows),
        "redaction_candidates": len(target_ids),
        "dry_run": dry_run,
        "updated": 0,
        "sample_ids": target_ids[:10],
    }

    if dry_run or not target_ids:
        return result

    await _run(
        lambda: supabase.table("lab_uploads")
        .update({"extracted_text": "[REDACTED_BY_RETENTION_POLICY]"})
        .in_("id", target_ids)
        .execute()
    )
    result["updated"] = len(target_ids)

    await write_audit_log(
        user_id=None,
        action="retention_redaction",
        entity_type="lab_uploads",
        entity_id=str(uuid4()),
        new_value={
            "retention_days": safe_days,
            "batch_size": safe_batch,
            "updated": result["updated"],
            "sample_ids": result["sample_ids"],
        },
    )

    _logger.info(
        "retention_redaction_completed scanned=%s candidates=%s updated=%s cutoff=%s",
        result["candidates_scanned"],
        result["redaction_candidates"],
        result["updated"],
        cutoff_iso,
    )
    return result


def _parse_iso_datetime(value: Any) -> Optional[datetime]:
    raw = str(value or "").strip()
    if not raw:
        return None
    try:
        return datetime.fromisoformat(raw.replace("Z", "+00:00"))
    except ValueError:
        return None


def _safe_int(value: Any, default: int = 0) -> int:
    try:
        return int(value)
    except (TypeError, ValueError):
        return default


async def get_retention_redaction_status() -> Dict[str, Any]:
    """Return retention run health summary for admin dashboards."""
    supabase = _get_supabase()
    since_24h = datetime.now(timezone.utc) - timedelta(hours=24)

    try:
        resp = await _run(
            lambda: supabase.table("audit_logs")
            .select("action,created_at,new_value,entity_type")
            .eq("entity_type", "lab_uploads")
            .in_("action", ["retention_redaction_job", "retention_redaction", "retention_redaction_failed"])
            .order("created_at", desc=True)
            .limit(200)
            .execute()
        )
        rows = resp.data or []
    except Exception:
        rows = []

    def _row_status(row: Dict[str, Any]) -> str:
        action = str(row.get("action") or "")
        nv = row.get("new_value") if isinstance(row.get("new_value"), dict) else {}
        if action == "retention_redaction_failed":
            return "failed"
        if action == "retention_redaction":
            return "success"
        status = str(nv.get("status") or "").strip().lower()
        return status or "unknown"

    def _row_updated(row: Dict[str, Any]) -> int:
        nv = row.get("new_value") if isinstance(row.get("new_value"), dict) else {}
        return _safe_int(nv.get("updated"), 0)

    def _row_compact(row: Optional[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
        if not row:
            return None
        nv = row.get("new_value") if isinstance(row.get("new_value"), dict) else {}
        return {
            "action": row.get("action"),
            "timestamp": row.get("created_at") or row.get("timestamp"),
            "status": _row_status(row),
            "updated": _row_updated(row),
            "dry_run": bool(nv.get("dry_run")) if "dry_run" in nv else None,
            "error": nv.get("error"),
        }

    last_run = rows[0] if rows else None
    last_success = next((row for row in rows if _row_status(row) == "success"), None)
    last_failure = next((row for row in rows if _row_status(row) == "failed"), None)

    runs_24h = 0
    failures_24h = 0
    updated_24h = 0
    for row in rows:
        dt = _parse_iso_datetime(row.get("created_at") or row.get("timestamp"))
        if not dt or dt < since_24h:
            continue
        runs_24h += 1
        if _row_status(row) == "failed":
            failures_24h += 1
        if _row_status(row) == "success":
            updated_24h += _row_updated(row)

    return {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "runs_24h": runs_24h,
        "failures_24h": failures_24h,
        "updated_24h": updated_24h,
        "last_run": _row_compact(last_run),
        "last_success": _row_compact(last_success),
        "last_failure": _row_compact(last_failure),
    }

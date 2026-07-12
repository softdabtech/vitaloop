from __future__ import annotations

import hashlib
import ipaddress
import json
import time
from collections import defaultdict
from datetime import datetime, timezone
from typing import Any, Dict, Optional

from fastapi import HTTPException

from app.config import settings
from app.middleware.security import RedisRateLimiterBackend
from app.schemas.b2b.analyze_labs import B2BAnalyzeLabsRequest
from app.services import supabase_service as supabase
from app.services.lab_analysis_pipeline import run_lab_analysis_pipeline
from app.services.partners.auth import PartnerPrincipal
from app.services.partners.idempotency import find_existing_partner_result

_RATE_WINDOW_SECONDS = 60
_b2b_rate_limiter: RedisRateLimiterBackend | None = None
_b2b_metric_counters: dict[tuple[str, str], int] = defaultdict(int)
_b2b_latency_buckets = (0.5, 1.0, 2.5, 5.0, 10.0, 30.0)
_b2b_latency_counts: dict[tuple[str, float], int] = defaultdict(int)
_ALLOWED_UNITS = {
    "%",
    "g/dl",
    "g/dL",
    "iu/l",
    "IU/L",
    "mg/dl",
    "mg/dL",
    "mmol/l",
    "mmol/L",
    "ng/ml",
    "ng/mL",
    "nmol/l",
    "nmol/L",
    "pg/ml",
    "pg/mL",
    "u/l",
    "U/L",
    "ug/l",
    "ug/L",
    "uiu/ml",
    "uIU/mL",
}
_ALLOWED_UNITS_LOWER = {item.lower() for item in _ALLOWED_UNITS}


def record_b2b_metric(name: str, *, partner_id: str, value: int = 1) -> None:
    _b2b_metric_counters[(name, partner_id)] += value


def record_b2b_latency(*, partner_id: str, duration_seconds: float) -> None:
    for bucket in _b2b_latency_buckets:
        if duration_seconds <= bucket:
            _b2b_latency_counts[(partner_id, bucket)] += 1


def render_b2b_metrics() -> str:
    lines = [
        "# HELP vitaloop_b2b_requests_total B2B API request counters by partner.",
        "# TYPE vitaloop_b2b_requests_total counter",
    ]
    for (name, partner_id), value in sorted(_b2b_metric_counters.items()):
        lines.append(f'vitaloop_b2b_requests_total{{event="{name}",partner_id="{partner_id}"}} {value}')
    lines.extend(
        [
            "# HELP vitaloop_b2b_request_latency_seconds B2B API request latency buckets by partner.",
            "# TYPE vitaloop_b2b_request_latency_seconds histogram",
        ]
    )
    for (partner_id, bucket), value in sorted(_b2b_latency_counts.items()):
        lines.append(f'vitaloop_b2b_request_latency_seconds_bucket{{partner_id="{partner_id}",le="{bucket}"}} {value}')
    return "\n".join(lines) + "\n"


def _stable_json_hash(payload: Dict[str, Any]) -> str:
    raw = json.dumps(payload, sort_keys=True, separators=(",", ":"), default=str)
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


def _request_hash(payload: B2BAnalyzeLabsRequest) -> str:
    return _stable_json_hash(payload.model_dump(mode="json", exclude={"idempotency_key"}))


def _get_b2b_rate_limiter() -> RedisRateLimiterBackend:
    global _b2b_rate_limiter
    if _b2b_rate_limiter is None:
        _b2b_rate_limiter = RedisRateLimiterBackend(
            redis_url=settings.rate_limit_redis_url,
            key_prefix=f"{settings.rate_limit_redis_prefix}:b2b",
        )
    return _b2b_rate_limiter


async def enforce_b2b_rate_limits(principal: PartnerPrincipal) -> None:
    if not settings.rate_limit_redis_url and settings.app_env not in {"development", "test"}:
        raise HTTPException(status_code=503, detail={"detail": "B2B Redis rate limiter is not configured", "code": "RATE_LIMITER_UNAVAILABLE"})

    limiter = _get_b2b_rate_limiter()
    partner_limited = await _check_b2b_redis_bucket(
        limiter=limiter,
        bucket="partner",
        client_key=principal.partner_id,
        limit=max(1, settings.b2b_partner_rate_limit_per_minute),
    )
    if partner_limited:
        await _write_b2b_audit(principal=principal, action="request_rate_limited", new_value={"scope": "partner"})
        record_b2b_metric("rate_limited", partner_id=principal.partner_id)
        raise HTTPException(status_code=429, detail={"detail": "Partner rate limit exceeded", "code": "RATE_LIMITED"})

    key_limited = await _check_b2b_redis_bucket(
        limiter=limiter,
        bucket="api_key",
        client_key=principal.key_id,
        limit=max(1, settings.b2b_api_key_rate_limit_per_minute),
    )
    if key_limited:
        await _write_b2b_audit(principal=principal, action="request_rate_limited", new_value={"scope": "api_key"})
        record_b2b_metric("rate_limited", partner_id=principal.partner_id)
        raise HTTPException(status_code=429, detail={"detail": "API key rate limit exceeded", "code": "RATE_LIMITED"})


async def _check_b2b_redis_bucket(*, limiter: RedisRateLimiterBackend, bucket: str, client_key: str, limit: int) -> bool:
    client = await limiter._client_or_none()
    if client is None:
        if settings.app_env in {"development", "test"}:
            return False
        raise HTTPException(status_code=503, detail={"detail": "B2B Redis rate limiter is unavailable", "code": "RATE_LIMITER_UNAVAILABLE"})

    now = int(time.time())
    window_start = now - (now % _RATE_WINDOW_SECONDS)
    redis_key = f"{settings.rate_limit_redis_prefix}:b2b:{bucket}:{client_key}:{window_start}"
    try:
        count = await client.incr(redis_key)
        if count == 1:
            await client.expire(redis_key, _RATE_WINDOW_SECONDS)
    except Exception as exc:
        if settings.app_env in {"development", "test"}:
            return False
        raise HTTPException(status_code=503, detail={"detail": "B2B Redis rate limiter is unavailable", "code": "RATE_LIMITER_UNAVAILABLE"}) from exc
    return int(count or 0) > limit


def validate_b2b_biomarker_units(request: B2BAnalyzeLabsRequest) -> None:
    for idx, biomarker in enumerate(request.biomarkers, start=1):
        unit = str(biomarker.unit or "").strip()
        if unit not in _ALLOWED_UNITS and unit.lower() not in _ALLOWED_UNITS_LOWER:
            raise HTTPException(
                status_code=422,
                detail={
                    "detail": f"Unsupported biomarker unit at index {idx}: {unit}",
                    "code": "INVALID_BIOMARKER_UNIT",
                },
            )


def _resolve_request_ip(*, request_headers: Optional[Dict[str, str]], client_host: Optional[str]) -> str:
    headers = {str(k).lower(): str(v) for k, v in (request_headers or {}).items()}
    cf_ip = headers.get("cf-connecting-ip")
    if cf_ip:
        return cf_ip.split(",", 1)[0].strip()
    forwarded = headers.get(settings.rate_limit_forwarded_for_header.lower())
    if settings.rate_limit_trust_forwarded_for and forwarded:
        return forwarded.split(",", 1)[0].strip()
    return str(client_host or "").strip()


def _is_from_cloudflare(request_headers: Optional[Dict[str, str]]) -> bool:
    headers = {str(k).lower(): str(v) for k, v in (request_headers or {}).items()}
    return bool(headers.get("cf-ray") and headers.get("cf-connecting-ip"))


def _ip_allowed(client_ip: str, allowed: list[str]) -> bool:
    if not allowed:
        return True
    try:
        ip = ipaddress.ip_address(client_ip)
    except ValueError:
        return False
    for entry in allowed:
        try:
            if "/" in entry:
                if ip in ipaddress.ip_network(entry, strict=False):
                    return True
            elif ip == ipaddress.ip_address(entry):
                return True
        except ValueError:
            continue
    return False


async def enforce_b2b_network_policy(
    *,
    principal: PartnerPrincipal,
    request_headers: Optional[Dict[str, str]],
    client_host: Optional[str],
) -> str:
    client_ip = _resolve_request_ip(request_headers=request_headers, client_host=client_host)
    if principal.require_cloudflare and not _is_from_cloudflare(request_headers):
        await _write_b2b_audit(principal=principal, action="request_failed", new_value={"reason": "cloudflare_required", "client_ip": client_ip})
        record_b2b_metric("cloudflare_required_block", partner_id=principal.partner_id)
        raise HTTPException(status_code=403, detail={"detail": "Cloudflare edge is required for this partner", "code": "CLOUDFLARE_REQUIRED"})
    if not _ip_allowed(client_ip, principal.allowed_ips):
        await _write_b2b_audit(principal=principal, action="request_failed", new_value={"reason": "ip_not_allowed", "client_ip": client_ip})
        record_b2b_metric("ip_blocked", partner_id=principal.partner_id)
        raise HTTPException(status_code=403, detail={"detail": "Client IP is not allowed for this partner", "code": "IP_NOT_ALLOWED"})
    return client_ip


async def _upsert_partner_patient(partner_id: str, external_user_id: str, profile: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    client = supabase._get_supabase()
    payload = {
        "partner_id": partner_id,
        "external_patient_id": external_user_id,
        "profile": profile or {},
    }
    response = await supabase._run(
        lambda: client.table("partner_patients")
        .upsert(payload, on_conflict="partner_id,external_patient_id")
        .execute()
    )
    rows = response.data or []
    return rows[0] if rows else payload


async def _find_partner_lab_result_by_ids(partner_id: str, external_order_id: str, external_result_id: str) -> Optional[Dict[str, Any]]:
    client = supabase._get_supabase()
    response = await supabase._run(
        lambda: client.table("partner_lab_results")
        .select("id,partner_id,external_order_id,external_result_id,status")
        .eq("partner_id", partner_id)
        .eq("external_order_id", external_order_id)
        .eq("external_result_id", external_result_id)
        .limit(1)
        .execute()
    )
    rows = response.data or []
    return rows[0] if rows else None


async def _insert_partner_lab_result(row: Dict[str, Any]) -> Dict[str, Any]:
    client = supabase._get_supabase()
    try:
        response = await supabase._run(lambda: client.table("partner_lab_results").insert(row).execute())
    except Exception:
        existing = await _find_partner_lab_result_by_ids(
            str(row["partner_id"]),
            str(row["external_order_id"]),
            str(row["external_result_id"]),
        )
        if existing:
            existing["__existing__"] = True
            return existing
        legacy_row = {key: value for key, value in row.items() if key not in {"raw_request"}}
        try:
            response = await supabase._run(lambda: client.table("partner_lab_results").insert(legacy_row).execute())
        except Exception:
            existing = await _find_partner_lab_result_by_ids(
                str(row["partner_id"]),
                str(row["external_order_id"]),
                str(row["external_result_id"]),
            )
            if existing:
                existing["__existing__"] = True
                return existing
            raise
    rows = response.data or []
    return rows[0] if rows else row


async def _replace_partner_biomarkers(partner_lab_result_id: str, biomarkers: list[Dict[str, Any]]) -> None:
    client = supabase._get_supabase()
    await supabase._run(
        lambda: client.table("partner_biomarkers")
        .delete()
        .eq("partner_lab_result_id", partner_lab_result_id)
        .execute()
    )
    if not biomarkers:
        return
    rows = []
    for biomarker in biomarkers:
        rows.append(
            {
                "partner_lab_result_id": partner_lab_result_id,
                "canonical_name": biomarker["canonical_name"],
                "display_name": biomarker["name"],
                "value": biomarker["value"],
                "unit": biomarker["unit"],
                "ref_low": biomarker.get("ref_low"),
                "ref_high": biomarker.get("ref_high"),
                "status": biomarker.get("status"),
                "category": biomarker.get("category"),
                "confidence": 1.0,
            }
        )
    await supabase._run(lambda: client.table("partner_biomarkers").insert(rows).execute())


async def _insert_partner_insight(partner_lab_result_id: str, response_payload: Dict[str, Any]) -> Dict[str, Any]:
    client = supabase._get_supabase()
    row = {
        "partner_lab_result_id": partner_lab_result_id,
        "insight_payload": response_payload,
    }
    response = await supabase._run(lambda: client.table("partner_insights").upsert(row, on_conflict="partner_lab_result_id").execute())
    rows = response.data or []
    return rows[0] if rows else row


async def _update_partner_lab_result(partner_lab_result_id: str, *, status: str, canonical_payload: Dict[str, Any]) -> None:
    client = supabase._get_supabase()
    update_payload = {
        "status": status,
        "canonical_payload": canonical_payload,
        "normalized_biomarkers": canonical_payload.get("normalized_biomarkers") or [],
        "final_response": canonical_payload.get("final_response") or {},
        "analysis_status": canonical_payload.get("analysis_status") or status,
        "cost_metadata": canonical_payload.get("cost_metadata") or {},
    }
    try:
        await supabase._run(
            lambda: client.table("partner_lab_results")
            .update(update_payload)
            .eq("id", partner_lab_result_id)
            .execute()
        )
    except Exception:
        legacy_payload = {
            "status": status,
            "canonical_payload": canonical_payload,
        }
        await supabase._run(
            lambda: client.table("partner_lab_results")
            .update(legacy_payload)
            .eq("id", partner_lab_result_id)
            .execute()
        )


async def _mark_partner_lab_result_failed(partner_lab_result_id: str, *, error: Exception | str) -> None:
    message = str(error)
    await _update_partner_lab_result(
        partner_lab_result_id,
        status="failed",
        canonical_payload={
            "analysis_status": "failed",
            "error_metadata": {
                "message": message[:1000],
                "type": error.__class__.__name__ if not isinstance(error, str) else "Error",
            },
        },
    )


async def _find_cached_response(
    *,
    partner_id: str,
    external_user_id: str,
    idempotency_key: str,
    request_hash: str,
) -> Optional[Dict[str, Any]]:
    existing = await find_existing_partner_result(
        partner_id=partner_id,
        external_result_id=request_hash,
        external_order_id=idempotency_key,
    )
    if not existing:
        return None

    client = supabase._get_supabase()
    response = await supabase._run(
        lambda: client.table("partner_insights")
        .select("insight_payload,partner_lab_result_id")
        .eq("partner_lab_result_id", existing["id"])
        .limit(1)
        .execute()
    )
    rows = response.data or []
    if not rows:
        return None
    payload = rows[0].get("insight_payload")
    if isinstance(payload, dict):
        payload.setdefault("metadata", {})
        payload["metadata"]["idempotent_replay"] = True
        return payload
    return None


async def _track_usage(
    *,
    partner_id: str,
    api_key_id: str,
    partner_lab_result_id: str,
    cost_metadata: Dict[str, Any],
    quality_snapshot: Dict[str, Any],
    biomarker_count: int,
    request_hash: str,
) -> None:
    prompt_tokens = int(cost_metadata.get("ai_prompt_tokens") or 0)
    completion_tokens = int(cost_metadata.get("ai_completion_tokens") or 0)
    row = {
        "partner_id": partner_id,
        "api_key_id": api_key_id,
        "partner_lab_result_id": partner_lab_result_id,
        "request_count": 1,
        "biomarker_count": biomarker_count,
        "ai_prompt_tokens": prompt_tokens,
        "ai_completion_tokens": completion_tokens,
        "estimated_cost_usd": float(cost_metadata.get("estimated_cost_usd") or 0),
        "estimated": bool(cost_metadata.get("estimated", True)),
        "metadata": {
            "request_hash": request_hash,
            "source": "b2b_analyze_labs",
            "cost": cost_metadata,
            "quality_snapshot": quality_snapshot,
        },
    }
    client = supabase._get_supabase()
    try:
        await supabase._run(lambda: client.table("partner_usage_events").insert(row).execute())
    except Exception:
        await supabase.write_audit_log(
            user_id=None,
            action="partner_usage_tracked",
            entity_type="partner_lab_result",
            entity_id=partner_lab_result_id,
            new_value=row,
        )


async def _write_b2b_audit(
    *,
    principal: PartnerPrincipal,
    action: str,
    entity_id: Optional[str] = None,
    new_value: Optional[Dict[str, Any]] = None,
) -> None:
    await supabase.write_audit_log(
        user_id=None,
        action=action,
        entity_type="partner_b2b_analysis",
        entity_id=entity_id,
        new_value={
            "partner_id": principal.partner_id,
            "api_key_id": principal.key_id,
            **(new_value or {}),
        },
    )


async def _mark_api_key_used(api_key_id: str) -> None:
    client = supabase._get_supabase()
    try:
        await supabase._run(
            lambda: client.table("partner_api_keys")
            .update({"last_used_at": datetime.now(timezone.utc).isoformat()})
            .eq("id", api_key_id)
            .execute()
        )
    except Exception:
        pass


async def _load_partner_pilot_config(partner_id: str) -> Dict[str, Any]:
    client = supabase._get_supabase()
    try:
        response = await supabase._run(
            lambda: client.table("partners")
            .select("b2b_retention_days,b2b_biomarker_mappings")
            .eq("id", partner_id)
            .limit(1)
            .execute()
        )
        rows = response.data or []
        row = rows[0] if rows else {}
    except Exception:
        row = {}
    mappings = row.get("b2b_biomarker_mappings") if isinstance(row.get("b2b_biomarker_mappings"), dict) else {}
    retention_days = row.get("b2b_retention_days")
    try:
        retention_days = int(retention_days)
    except (TypeError, ValueError):
        retention_days = 90
    return {"biomarker_mappings": mappings, "retention_days": max(1, retention_days)}


def _redacted_request_payload(request: B2BAnalyzeLabsRequest, *, retention_days: int) -> Dict[str, Any]:
    payload = request.model_dump(mode="json", exclude={"metadata"})
    safe_metadata = {}
    for key in ("source_lab", "integration_version", "source_system"):
        if key in request.metadata:
            safe_metadata[key] = request.metadata[key]
    return {
        **payload,
        "metadata": safe_metadata,
        "retention_days": retention_days,
        "raw_payload_minimized": True,
    }


async def analyze_labs_for_partner(
    *,
    request: B2BAnalyzeLabsRequest,
    principal: PartnerPrincipal,
    idempotency_key: Optional[str],
    request_headers: Optional[Dict[str, str]] = None,
    client_host: Optional[str] = None,
    api_version: str = "v1",
) -> Dict[str, Any]:
    started = time.perf_counter()
    partner_lab_result_id = ""
    request_hash = _request_hash(request)
    try:
        client_ip = await enforce_b2b_network_policy(principal=principal, request_headers=request_headers, client_host=client_host)
        await enforce_b2b_rate_limits(principal)
        validate_b2b_biomarker_units(request)
    except HTTPException:
        raise
    except Exception as exc:
        await _write_b2b_audit(principal=principal, action="request_failed", new_value={"request_hash": request_hash, "error": str(exc)})
        raise

    effective_idempotency_key = (idempotency_key or request.idempotency_key or "").strip()
    if effective_idempotency_key:
        cached = await _find_cached_response(
            partner_id=principal.partner_id,
            external_user_id=request.external_user_id,
            idempotency_key=effective_idempotency_key,
            request_hash=request_hash,
        )
        if cached:
            await _write_b2b_audit(principal=principal, action="request_replayed", entity_id=str(cached.get("analysis_id") or ""), new_value={"request_hash": request_hash})
            record_b2b_metric("replayed", partner_id=principal.partner_id)
            return cached

    record_b2b_metric("accepted", partner_id=principal.partner_id)
    await _write_b2b_audit(
        principal=principal,
        action="request_accepted",
        new_value={
            "request_hash": request_hash,
            "external_user_id": request.external_user_id,
            "client_ip": client_ip,
            "api_version": api_version,
            "key_prefix": principal.key_prefix,
        },
    )
    await _write_b2b_audit(principal=principal, action="api_key_used", new_value={"key_prefix": principal.key_prefix, "key_label": principal.key_label})
    await _mark_api_key_used(principal.key_id)
    pilot_config = await _load_partner_pilot_config(principal.partner_id)

    patient = await _upsert_partner_patient(
        principal.partner_id,
        request.external_user_id,
        profile=request.metadata.get("profile") if isinstance(request.metadata.get("profile"), dict) else None,
    )
    patient_id = str(patient.get("id") or request.external_user_id)
    order_id = effective_idempotency_key or f"b2b-{request_hash[:24]}"
    raw_payload = _redacted_request_payload(request, retention_days=pilot_config["retention_days"])

    lab_result = await _insert_partner_lab_result(
        {
            "partner_id": principal.partner_id,
            "partner_patient_id": patient_id,
            "external_order_id": order_id,
            "external_result_id": request_hash,
            "source_lab": str(request.metadata.get("source_lab") or "b2b_json"),
            "result_date": None,
            "status": "received",
            "raw_payload": raw_payload,
            "raw_request": raw_payload,
            "canonical_payload": {},
        }
    )
    if lab_result.get("__existing__"):
        cached = await _find_cached_response(
            partner_id=principal.partner_id,
            external_user_id=request.external_user_id,
            idempotency_key=order_id,
            request_hash=request_hash,
        )
        if cached:
            await _write_b2b_audit(principal=principal, action="request_replayed", entity_id=str(cached.get("analysis_id") or lab_result.get("id") or ""), new_value={"request_hash": request_hash})
            record_b2b_metric("replayed", partner_id=principal.partner_id)
            return cached
        await _write_b2b_audit(principal=principal, action="request_replayed", entity_id=str(lab_result.get("id") or ""), new_value={"request_hash": request_hash, "status": "in_progress_no_cached_payload"})
        raise HTTPException(status_code=409, detail={"detail": "Duplicate request is still processing", "code": "IDEMPOTENT_REQUEST_IN_PROGRESS"})

    partner_lab_result_id = str(lab_result.get("id") or "")
    if not partner_lab_result_id:
        raise HTTPException(status_code=500, detail={"detail": "Could not create B2B analysis record", "code": "B2B_ANALYSIS_CREATE_FAILED"})

    try:
        pipeline_result = await run_lab_analysis_pipeline(
            biomarkers=[item.model_dump(mode="json") for item in request.biomarkers],
            symptoms=request.symptoms,
            questionnaire=request.questionnaire,
            user_profile=request.metadata.get("profile") if isinstance(request.metadata.get("profile"), dict) else None,
            analysis_id=partner_lab_result_id,
            source_metadata={
                **(request.metadata or {}),
                "partner_id": principal.partner_id,
                "api_key_id": principal.key_id,
                "external_user_id": request.external_user_id,
                "retention_days": pilot_config["retention_days"],
                "api_version": api_version,
            },
            persist_knowledge=False,
            biomarker_name_aliases=pilot_config["biomarker_mappings"],
        )

        normalized_biomarkers = pipeline_result.pop("normalized_biomarkers", [])
        cost_metadata = pipeline_result.get("cost_metadata") or {}
        quality_snapshot = pipeline_result.get("quality_snapshot") or {}
        response_payload = {
            **pipeline_result,
            "analysis_id": partner_lab_result_id,
            "status": "completed",
        }
        response_payload["metadata"] = {
            **(response_payload.get("metadata") or {}),
            "partner_id": principal.partner_id,
            "external_user_id": request.external_user_id,
            "request_hash": request_hash,
            "idempotency_key": effective_idempotency_key or None,
            "retention_days": pilot_config["retention_days"],
            "api_version": api_version,
            "key_prefix": principal.key_prefix,
        }

        await _replace_partner_biomarkers(partner_lab_result_id, normalized_biomarkers)
        await _insert_partner_insight(partner_lab_result_id, response_payload)
        await _update_partner_lab_result(
            partner_lab_result_id,
            status="processed",
            canonical_payload={
                "normalized_biomarkers": normalized_biomarkers,
                "final_response": response_payload,
                "analysis_status": "completed",
                "cost_metadata": cost_metadata,
            },
        )
        await _track_usage(
            partner_id=principal.partner_id,
            api_key_id=principal.key_id,
            partner_lab_result_id=partner_lab_result_id,
            cost_metadata=cost_metadata,
            quality_snapshot=quality_snapshot,
            biomarker_count=len(normalized_biomarkers),
            request_hash=request_hash,
        )
        await _write_b2b_audit(
            principal=principal,
            action="request_completed",
            entity_id=partner_lab_result_id,
            new_value={
                "request_hash": request_hash,
                "cost_metadata": cost_metadata,
                "quality_snapshot": quality_snapshot,
            },
        )
        record_b2b_metric("completed", partner_id=principal.partner_id)
    except Exception as exc:
        await _mark_partner_lab_result_failed(partner_lab_result_id, error=exc)
        await _write_b2b_audit(principal=principal, action="request_failed", entity_id=partner_lab_result_id, new_value={"request_hash": request_hash, "error": str(exc)[:1000]})
        record_b2b_metric("failed", partner_id=principal.partner_id)
        raise
    finally:
        record_b2b_latency(partner_id=principal.partner_id, duration_seconds=time.perf_counter() - started)

    return response_payload

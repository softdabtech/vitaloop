import asyncio
from copy import deepcopy

from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, Field
from uuid import UUID
import logging

from app.dependencies import get_current_user, require_active_subscription
from app.services.ai.openai_service import generate_protocol, PROTOCOL_PROMPT_VERSION, is_llm_configured
from app.services.supabase_service import (
    assert_upload_belongs_to_user,
    get_biomarkers_by_upload,
    get_protocol_by_upload,
    get_user_profile,
    save_protocol,
    write_audit_log,
)
from app.services.affiliate import build_iherb_url
from app.services.safety_state_resolver import (
    resolve_biomarker_safety_state,
    format_safety_state_for_response,
)
from app.services.safety import sanitize_protocol_for_safety, validate_protocol
from app.services.symptom_snapshot import (
    load_latest_eligible_symptom_snapshot,
    symptoms_from_snapshot,
)
from app.constants import PROTOCOL_GENERATION_TIMEOUT_SECONDS
from app.utils.validation import normalize_symptoms as _normalize_symptoms

router = APIRouter()
logger = logging.getLogger("uvicorn.error")


def _is_review_only_recommendation(rec: dict) -> bool:
    return bool(
        rec.get("original_dosage_hidden")
        or str(rec.get("timing") or "").strip().lower() == "clinician_review"
        or str(rec.get("category") or "").strip().lower() in {"profile", "nutrition", "supplement_safety"}
    )


def _sanitize_and_validate_recommendations(
    recommendations: object,
    *,
    user_profile: dict,
    user_id: str,
    upload_id: str,
) -> list[dict]:
    if not isinstance(recommendations, list) or not recommendations or any(not isinstance(rec, dict) for rec in recommendations):
        raise HTTPException(
            status_code=422,
            detail={"detail": "Protocol recommendations are empty or invalid", "code": "PROTOCOL_INVALID"},
        )

    sanitized = sanitize_protocol_for_safety(
        deepcopy(recommendations),
        profile=user_profile,
        locale="en",
        require_clinician_review_for_supplement_dosing=True,
    )
    sanitized = [rec for rec in sanitized if not rec.get("withheld_for_safety")]
    if not sanitized:
        raise HTTPException(
            status_code=422,
            detail={"detail": "Protocol recommendations were withheld for safety", "code": "PROTOCOL_UNSAFE"},
        )
    try:
        validation = validate_protocol(sanitized, profile=user_profile, locale="en")
    except Exception as exc:
        logger.error(
            "protocol_validation_failed upload_id=%s user_id=%s error=%s",
            upload_id,
            user_id,
            repr(exc),
            exc_info=True,
        )
        raise HTTPException(
            status_code=502,
            detail={"detail": "Protocol safety validation is unavailable", "code": "PROTOCOL_VALIDATION_FAILED"},
        ) from exc

    if (
        not isinstance(validation, dict)
        or validation.get("status") not in {"approved", "approved_with_warnings"}
        or validation.get("warnings")
        or validation.get("blocked_items")
    ):
        logger.warning("protocol_rejected_by_safety_validation upload_id=%s user_id=%s", upload_id, user_id)
        raise HTTPException(
            status_code=422,
            detail={"detail": "Protocol recommendations did not pass safety validation", "code": "PROTOCOL_UNSAFE"},
        )

    for rec in sanitized:
        if _is_review_only_recommendation(rec):
            rec["iherb_search"] = ""
            rec.pop("iherb_url", None)
    return sanitized


class ProtocolRequest(BaseModel):
    upload_id: UUID
    symptoms: list[str] = Field(default_factory=list)


class ProtocolResponse(BaseModel):
    id: str
    user_id: str
    upload_id: str
    recommendations: list[dict]
    unified_safety_state: dict | None = None  # P2 FIX: Single source of truth for urgency


@router.get("")
async def protocol_method_not_allowed(_: dict = Depends(get_current_user)):
    """GET /protocol is not supported. Use POST with upload_id and symptoms."""
    from fastapi import Response
    from fastapi.responses import JSONResponse
    return JSONResponse(
        status_code=405,
        content={"detail": "Method Not Allowed. Use POST /protocol."},
        headers={"Allow": "POST"},
    )


@router.post("", response_model=ProtocolResponse)
async def create_protocol(
    request: ProtocolRequest,
    current_user: dict = Depends(get_current_user),
    _subscription_check: None = Depends(require_active_subscription),
):
    user_id: str = current_user["sub"]
    upload_id = str(request.upload_id)
    _normalize_symptoms(request.symptoms)  # validate legacy payload, then ignore it

    await assert_upload_belongs_to_user(upload_id, user_id)

    existing_protocol = await get_protocol_by_upload(user_id, upload_id)
    if existing_protocol:
        await write_audit_log(
            user_id=user_id,
            action="read",
            entity_type="protocol",
            entity_id=str(existing_protocol.get("id") or upload_id),
            new_value={"source": "cache"},
        )
        # P2 FIX: Get user profile and biomarkers to add unified_safety_state even to cached protocol
        biomarkers = await get_biomarkers_by_upload(upload_id, user_id)
        user_profile = await get_user_profile(user_id) or {}
        response_dict = deepcopy(existing_protocol)
        response_dict["recommendations"] = _sanitize_and_validate_recommendations(
            response_dict.get("recommendations"),
            user_profile=user_profile,
            user_id=user_id,
            upload_id=upload_id,
        )
        unified_safety_state = None
        if biomarkers:
            try:
                safety_state = await resolve_biomarker_safety_state(biomarkers, user_profile)
                unified_safety_state = format_safety_state_for_response(safety_state)
            except Exception as exc:
                logger.warning("resolve_safety_state_failed protocol_cached upload_id=%s user_id=%s error=%s", upload_id, user_id, repr(exc))
        response_dict["unified_safety_state"] = unified_safety_state
        return response_dict

    biomarkers = await get_biomarkers_by_upload(upload_id, user_id)
    user_profile = await get_user_profile(user_id) or {}
    await write_audit_log(
        user_id=user_id,
        action="read",
        entity_type="biomarkers",
        entity_id=str(upload_id),
        new_value={"count": len(biomarkers)},
    )

    if not biomarkers:
        raise HTTPException(
            status_code=404,
            detail={"detail": "No biomarkers found for this upload", "code": "BIOMARKERS_NOT_FOUND"},
        )

    symptom_snapshot = await load_latest_eligible_symptom_snapshot(user_id)
    normalized_symptoms = symptoms_from_snapshot(symptom_snapshot)

    try:
        recommendations = await asyncio.wait_for(
            generate_protocol(
                biomarkers=biomarkers,
                symptoms=normalized_symptoms,
                user_profile=user_profile,
                user_id=user_id,
                upload_id=upload_id,
            ),
            timeout=PROTOCOL_GENERATION_TIMEOUT_SECONDS,
        )
    except asyncio.TimeoutError as exc:
        logger.error("protocol_generation_timeout upload_id=%s user_id=%s", upload_id, user_id)
        raise HTTPException(
            status_code=504,
            detail={"detail": "Protocol generation timed out. Please retry.", "code": "PROTOCOL_TIMEOUT"},
        ) from exc
    except HTTPException:
        raise
    except Exception as exc:
        logger.error("protocol_generation_failed upload_id=%s user_id=%s error=%s", upload_id, user_id, repr(exc), exc_info=True)
        raise HTTPException(
            status_code=502,
            detail={"detail": "Protocol generation is temporarily unavailable. Please retry.", "code": "PROTOCOL_UPSTREAM_FAILED"},
        ) from exc

    if not recommendations:
        raise HTTPException(
            status_code=422,
            detail={"detail": "Protocol recommendations are empty", "code": "PROTOCOL_EMPTY"},
        )

    if not isinstance(recommendations, list) or any(not isinstance(rec, dict) for rec in recommendations):
        raise HTTPException(
            status_code=502,
            detail={"detail": "Protocol generation returned an invalid response", "code": "PROTOCOL_INVALID"},
        )

    recommendations = _sanitize_and_validate_recommendations(
        recommendations,
        user_profile=user_profile,
        user_id=user_id,
        upload_id=upload_id,
    )

    # Enrich with iHerb affiliate link
    for rec in recommendations:
        if _is_review_only_recommendation(rec):
            continue
        search_term = rec.get("iherb_search") or rec.get("supplement")
        rec["iherb_url"] = build_iherb_url(search_term or "supplement")

    try:
        protocol = await save_protocol(
            user_id=user_id,
            upload_id=upload_id,
            recommendations=recommendations,
            prompt_version=PROTOCOL_PROMPT_VERSION,
        )
    except Exception as exc:
        logger.error("protocol_save_failed upload_id=%s user_id=%s error=%s", upload_id, user_id, repr(exc), exc_info=True)
        raise HTTPException(
            status_code=500,
            detail={"detail": "Could not store protocol recommendations", "code": "PROTOCOL_SAVE_FAILED"},
        ) from exc

    # P2 FIX: Resolve unified safety state across all views
    unified_safety_state = None
    try:
        safety_state = await resolve_biomarker_safety_state(biomarkers, user_profile)
        unified_safety_state = format_safety_state_for_response(safety_state)
    except Exception as exc:
        logger.warning("resolve_safety_state_failed protocol upload_id=%s user_id=%s error=%s", upload_id, user_id, repr(exc))

    await write_audit_log(
        user_id=user_id,
        action="create",
        entity_type="protocol",
        entity_id=str(protocol.get("id") or upload_id),
        new_value={"recommendation_count": len(recommendations)},
    )

    # Add unified_safety_state to response
    response_dict = dict(protocol)
    response_dict["unified_safety_state"] = unified_safety_state
    return response_dict


@router.get("/{upload_id}", response_model=ProtocolResponse)
async def get_or_create_protocol(
    upload_id: UUID,
    current_user: dict = Depends(get_current_user),
    _subscription_check: None = Depends(require_active_subscription),
):
    return await create_protocol(
        ProtocolRequest(upload_id=upload_id, symptoms=[]),
        current_user=current_user,
        _subscription_check=_subscription_check,
    )

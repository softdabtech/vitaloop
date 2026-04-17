import asyncio

from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, Field
from uuid import UUID
import logging

from app.dependencies import get_current_user, require_active_subscription
from app.services.claude_service import generate_protocol, PROTOCOL_PROMPT_VERSION, is_llm_configured
from app.services.supabase_service import (
    assert_upload_belongs_to_user,
    get_biomarkers_by_upload,
    get_protocol_by_upload,
    save_protocol,
    write_audit_log,
)
from app.services.affiliate import build_iherb_url
from app.constants import PROTOCOL_GENERATION_TIMEOUT_SECONDS
from app.utils.validation import normalize_symptoms as _normalize_symptoms

router = APIRouter()
logger = logging.getLogger("uvicorn.error")


class ProtocolRequest(BaseModel):
    upload_id: UUID
    symptoms: list[str] = Field(default_factory=list)


class ProtocolResponse(BaseModel):
    id: str
    user_id: str
    upload_id: str
    recommendations: list[dict]


@router.post("", response_model=ProtocolResponse)
async def create_protocol(
    request: ProtocolRequest,
    current_user: dict = Depends(require_active_subscription),
):
    user_id: str = current_user["sub"]
    upload_id = str(request.upload_id)
    normalized_symptoms = _normalize_symptoms(request.symptoms)

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
        return existing_protocol

    biomarkers = await get_biomarkers_by_upload(upload_id, user_id)
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

    try:
        recommendations = await asyncio.wait_for(
            generate_protocol(
                biomarkers=biomarkers,
                symptoms=normalized_symptoms,
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

    # Enrich with iHerb affiliate link
    for rec in recommendations:
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

    await write_audit_log(
        user_id=user_id,
        action="create",
        entity_type="protocol",
        entity_id=str(protocol.get("id") or upload_id),
        new_value={"recommendation_count": len(recommendations)},
    )

    return protocol

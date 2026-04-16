from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, Field
from uuid import UUID
import logging

from app.dependencies import get_current_user
from app.services.claude_service import generate_protocol, PROTOCOL_PROMPT_VERSION, is_llm_configured
from app.services.supabase_service import (
    assert_upload_belongs_to_user,
    get_biomarkers_by_upload,
    get_protocol_by_upload,
    save_protocol,
)
from app.services.affiliate import build_iherb_url

router = APIRouter()
logger = logging.getLogger("uvicorn.error")

MAX_SYMPTOMS = 20
MAX_SYMPTOM_LENGTH = 60


class ProtocolRequest(BaseModel):
    upload_id: UUID
    symptoms: list[str] = Field(default_factory=list)


class ProtocolResponse(BaseModel):
    id: str
    user_id: str
    upload_id: str
    recommendations: list[dict]


def _normalize_symptoms(symptoms: list[str]) -> list[str]:
    normalized: list[str] = []
    seen = set()

    for raw in symptoms:
        item = (raw or "").strip().lower()
        if not item:
            continue
        if len(item) > MAX_SYMPTOM_LENGTH:
            raise HTTPException(
                status_code=422,
                detail={"detail": f"Symptom is too long (max {MAX_SYMPTOM_LENGTH} chars)", "code": "SYMPTOM_TOO_LONG"},
            )
        if item not in seen:
            seen.add(item)
            normalized.append(item)

    if len(normalized) > MAX_SYMPTOMS:
        raise HTTPException(
            status_code=422,
            detail={"detail": f"Too many symptoms provided (max {MAX_SYMPTOMS})", "code": "TOO_MANY_SYMPTOMS"},
        )

    return normalized


@router.post("", response_model=ProtocolResponse)
async def create_protocol(
    request: ProtocolRequest,
    current_user: dict = Depends(get_current_user),
):
    if not is_llm_configured():
        raise HTTPException(status_code=503, detail="LLM provider is not configured")

    user_id: str = current_user["sub"]
    upload_id = str(request.upload_id)
    normalized_symptoms = _normalize_symptoms(request.symptoms)

    await assert_upload_belongs_to_user(upload_id, user_id)

    existing_protocol = await get_protocol_by_upload(user_id, upload_id)
    if existing_protocol:
        return existing_protocol

    biomarkers = await get_biomarkers_by_upload(upload_id, user_id)

    if not biomarkers:
        raise HTTPException(
            status_code=404,
            detail={"detail": "No biomarkers found for this upload", "code": "BIOMARKERS_NOT_FOUND"},
        )

    try:
        recommendations = await generate_protocol(
            biomarkers=biomarkers,
            symptoms=normalized_symptoms,
        )
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

    protocol = await save_protocol(
        user_id=user_id,
        upload_id=upload_id,
        recommendations=recommendations,
        prompt_version=PROTOCOL_PROMPT_VERSION,
    )

    return protocol

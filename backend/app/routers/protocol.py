from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from uuid import UUID

from app.dependencies import get_current_user
from app.services.claude_service import generate_protocol, PROTOCOL_PROMPT_VERSION
from app.services.supabase_service import (
    assert_upload_belongs_to_user,
    get_biomarkers_by_upload,
    get_protocol_by_upload,
    save_protocol,
)
from app.services.affiliate import build_iherb_url

router = APIRouter()


class ProtocolRequest(BaseModel):
    upload_id: UUID
    symptoms: list[str] = []


class ProtocolResponse(BaseModel):
    id: str
    user_id: str
    upload_id: str
    recommendations: list[dict]


@router.post("", response_model=ProtocolResponse)
async def create_protocol(
    request: ProtocolRequest,
    current_user: dict = Depends(get_current_user),
):
    user_id: str = current_user["sub"]
    upload_id = str(request.upload_id)

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

    recommendations = await generate_protocol(
        biomarkers=biomarkers,
        symptoms=request.symptoms,
    )

    # Enrich with iHerb affiliate link
    for rec in recommendations:
        rec["iherb_url"] = build_iherb_url(rec.get("iherb_search", rec["supplement"]))

    protocol = await save_protocol(
        user_id=user_id,
        upload_id=upload_id,
        recommendations=recommendations,
        prompt_version=PROTOCOL_PROMPT_VERSION,
    )

    return protocol

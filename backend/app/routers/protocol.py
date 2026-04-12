from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from uuid import UUID

from app.services.claude_service import generate_protocol
from app.services.supabase_service import get_biomarkers_by_upload, save_protocol
from app.services.affiliate import build_iherb_url

router = APIRouter()


class ProtocolRequest(BaseModel):
    user_id: UUID
    upload_id: UUID
    symptoms: list[str] = []


@router.post("")
async def create_protocol(request: ProtocolRequest):
    biomarkers = await get_biomarkers_by_upload(str(request.upload_id))

    if not biomarkers:
        raise HTTPException(status_code=404, detail="No biomarkers found for this upload.")

    recommendations = await generate_protocol(
        biomarkers=biomarkers,
        symptoms=request.symptoms,
    )

    # Enrich with iHerb affiliate link
    for rec in recommendations:
        rec["iherb_url"] = build_iherb_url(rec.get("iherb_search", rec["supplement"]))

    protocol = await save_protocol(
        user_id=str(request.user_id),
        upload_id=str(request.upload_id),
        recommendations=recommendations,
    )

    return protocol

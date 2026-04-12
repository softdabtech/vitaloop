from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional, List
from uuid import UUID

from app.services.claude_service import extract_biomarkers
from app.services.supabase_service import save_lab_upload, save_biomarkers

router = APIRouter()


class AnalyzeRequest(BaseModel):
    user_id: UUID
    extracted_text: str
    lab_name: Optional[str] = None
    test_date: Optional[str] = None
    ocr_confidence: Optional[float] = None
    symptoms: Optional[List[str]] = []


@router.post("")
async def analyze_lab(request: AnalyzeRequest):
    # Save raw OCR text (never the PDF)
    upload = await save_lab_upload(
        user_id=str(request.user_id),
        extracted_text=request.extracted_text,
        lab_name=request.lab_name,
        test_date=request.test_date,
        ocr_confidence=request.ocr_confidence,
    )

    upload_id = upload["id"]

    # Call Claude to extract biomarkers
    biomarkers = await extract_biomarkers(
        text=request.extracted_text,
        symptoms=request.symptoms or [],
    )

    if not biomarkers:
        raise HTTPException(status_code=422, detail="Could not extract biomarkers from the provided text.")

    # Persist biomarkers
    saved = await save_biomarkers(
        upload_id=upload_id,
        user_id=str(request.user_id),
        biomarkers=biomarkers,
    )

    return {
        "upload_id": upload_id,
        "biomarkers": saved,
    }

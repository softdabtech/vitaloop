from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, Field
from typing import Optional, List

from app.dependencies import get_current_user
from app.services.claude_service import extract_biomarkers, EXTRACT_PROMPT_VERSION
from app.services.supabase_service import save_lab_upload, save_biomarkers, save_timeline_event

router = APIRouter()


class AnalyzeRequest(BaseModel):
    extracted_text: str = Field(..., min_length=20, max_length=100_000)
    lab_name: Optional[str] = Field(None, max_length=100)
    test_date: Optional[str] = None
    ocr_confidence: Optional[float] = None
    symptoms: Optional[List[str]] = []


class AnalyzeResponse(BaseModel):
    upload_id: str
    biomarkers: List[dict]


def _normalize_lab_text(text: str) -> str:
    cleaned = text.replace("\x00", "").strip()
    # Keep line breaks but normalize excessive spacing
    cleaned = "\n".join(" ".join(line.split()) for line in cleaned.splitlines())
    return cleaned


@router.post("", response_model=AnalyzeResponse)
async def analyze_lab(
    request: AnalyzeRequest,
    current_user: dict = Depends(get_current_user),
):
    user_id: str = current_user["sub"]
    normalized_text = _normalize_lab_text(request.extracted_text)

    if len(normalized_text) < 20:
        raise HTTPException(status_code=422, detail={"detail": "Extracted text is too short", "code": "LAB_TEXT_TOO_SHORT"})

    # Save raw OCR text (never the PDF)
    upload = await save_lab_upload(
        user_id=user_id,
        extracted_text=normalized_text,
        lab_name=request.lab_name,
        test_date=request.test_date,
        ocr_confidence=request.ocr_confidence,
        analyze_prompt_version=EXTRACT_PROMPT_VERSION,
    )

    upload_id = upload["id"]

    # Call Claude to extract biomarkers
    biomarkers = await extract_biomarkers(
        text=normalized_text,
        symptoms=request.symptoms or [],
    )

    if not biomarkers:
        raise HTTPException(
            status_code=422,
            detail={"detail": "Could not extract biomarkers from the provided text", "code": "BIOMARKERS_NOT_EXTRACTED"},
        )

    # Persist biomarkers
    saved = await save_biomarkers(
        upload_id=upload_id,
        user_id=user_id,
        biomarkers=biomarkers,
    )

    await save_timeline_event(
        user_id,
        event_type="lab_uploaded",
        summary=f"Lab uploaded from {request.lab_name or 'unknown lab'}",
        metadata={"upload_id": upload_id, "biomarker_count": len(saved)},
    )

    return {
        "upload_id": upload_id,
        "biomarkers": saved,
    }

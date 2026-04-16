from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, Field
from typing import Optional, List
import logging

from app.dependencies import get_current_user
from app.services.claude_service import extract_biomarkers, EXTRACT_PROMPT_VERSION, is_llm_configured
from app.services.supabase_service import save_lab_upload, save_biomarkers, save_timeline_event

router = APIRouter()
logger = logging.getLogger("uvicorn.error")

MAX_SYMPTOMS = 20
MAX_SYMPTOM_LENGTH = 60


class AnalyzeRequest(BaseModel):
    extracted_text: str = Field(..., min_length=20, max_length=100_000)
    lab_name: Optional[str] = Field(None, max_length=100)
    test_date: Optional[str] = None
    ocr_confidence: Optional[float] = None
    symptoms: List[str] = Field(default_factory=list)


class AnalyzeResponse(BaseModel):
    upload_id: str
    biomarkers: List[dict]


def _normalize_lab_text(text: str) -> str:
    cleaned = text.replace("\x00", "").strip()
    # Keep line breaks but normalize excessive spacing
    cleaned = "\n".join(" ".join(line.split()) for line in cleaned.splitlines())
    return cleaned


def _normalize_symptoms(symptoms: List[str]) -> List[str]:
    normalized: List[str] = []
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


@router.post("", response_model=AnalyzeResponse)
async def analyze_lab(
    request: AnalyzeRequest,
    current_user: dict = Depends(get_current_user),
):
    user_id: str = current_user["sub"]
    normalized_text = _normalize_lab_text(request.extracted_text)
    normalized_symptoms = _normalize_symptoms(request.symptoms or [])
    normalized_lab_name = request.lab_name.strip() if request.lab_name else None

    if request.ocr_confidence is not None and not (0 <= request.ocr_confidence <= 100):
        raise HTTPException(
            status_code=422,
            detail={"detail": "ocr_confidence must be between 0 and 100", "code": "OCR_CONFIDENCE_OUT_OF_RANGE"},
        )

    if len(normalized_text) < 20:
        raise HTTPException(status_code=422, detail={"detail": "Extracted text is too short", "code": "LAB_TEXT_TOO_SHORT"})

    # Save raw OCR text (never the PDF)
    upload = await save_lab_upload(
        user_id=user_id,
        extracted_text=normalized_text,
        lab_name=normalized_lab_name,
        test_date=request.test_date,
        ocr_confidence=request.ocr_confidence,
        analyze_prompt_version=EXTRACT_PROMPT_VERSION,
    )

    upload_id = upload["id"]

    # Call Claude to extract biomarkers
    try:
        biomarkers = await extract_biomarkers(
            text=normalized_text,
            symptoms=normalized_symptoms,
        )
    except HTTPException:
        raise
    except Exception as exc:
        logger.error("analyze_extract_failed upload_id=%s user_id=%s error=%s", upload_id, user_id, repr(exc), exc_info=True)
        raise HTTPException(
            status_code=502,
            detail={"detail": "Analysis service is temporarily unavailable. Please retry.", "code": "ANALYSIS_UPSTREAM_FAILED"},
        ) from exc

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
        summary=f"Lab uploaded from {normalized_lab_name or 'unknown lab'}",
        metadata={"upload_id": upload_id, "biomarker_count": len(saved)},
    )

    return {
        "upload_id": upload_id,
        "biomarkers": saved,
    }

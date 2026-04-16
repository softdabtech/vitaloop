import asyncio
import hashlib
import json
from collections import defaultdict, deque
from datetime import date
from time import monotonic

from fastapi import APIRouter, HTTPException, Depends, Header
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
ANALYZE_REQUESTS_PER_MINUTE = 12
ANALYZE_WINDOW_SECONDS = 60.0
ANALYZE_EXTRACT_TIMEOUT_SECONDS = 75
ANALYZE_IDEMPOTENCY_TTL_SECONDS = 900.0
MAX_IDEMPOTENCY_KEY_LENGTH = 128

_analyze_rate_window: dict[str, deque[float]] = defaultdict(deque)
_analyze_rate_lock = asyncio.Lock()
_analyze_idempotency: dict[tuple[str, str], dict] = {}
_analyze_idempotency_lock = asyncio.Lock()


class AnalyzeRequest(BaseModel):
    extracted_text: str = Field(..., min_length=20, max_length=100_000)
    lab_name: Optional[str] = Field(None, max_length=100)
    test_date: Optional[date] = None
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


async def _enforce_analyze_rate_limit(user_id: str) -> None:
    now = monotonic()
    async with _analyze_rate_lock:
        bucket = _analyze_rate_window[user_id]
        while bucket and (now - bucket[0]) > ANALYZE_WINDOW_SECONDS:
            bucket.popleft()

        if len(bucket) >= ANALYZE_REQUESTS_PER_MINUTE:
            raise HTTPException(
                status_code=429,
                detail={
                    "detail": "Too many analyze requests. Please retry in a minute.",
                    "code": "ANALYZE_RATE_LIMITED",
                },
            )

        bucket.append(now)


def _request_fingerprint(
    normalized_text: str,
    normalized_lab_name: Optional[str],
    test_date: Optional[date],
    ocr_confidence: Optional[float],
    normalized_symptoms: List[str],
) -> str:
    payload = {
        "text": normalized_text,
        "lab_name": normalized_lab_name,
        "test_date": test_date.isoformat() if test_date else None,
        "ocr_confidence": ocr_confidence,
        "symptoms": normalized_symptoms,
    }
    raw = json.dumps(payload, sort_keys=True, ensure_ascii=True, separators=(",", ":"))
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


async def _get_idempotency_cached_response(
    *,
    user_id: str,
    idempotency_key: str,
    fingerprint: str,
) -> Optional[dict]:
    now = monotonic()
    composite_key = (user_id, idempotency_key)

    async with _analyze_idempotency_lock:
        expired = [k for k, v in _analyze_idempotency.items() if v["expires_at"] <= now]
        for key in expired:
            _analyze_idempotency.pop(key, None)

        entry = _analyze_idempotency.get(composite_key)
        if entry:
            if entry["fingerprint"] != fingerprint:
                raise HTTPException(
                    status_code=409,
                    detail={
                        "detail": "Idempotency key was reused with different payload",
                        "code": "IDEMPOTENCY_KEY_REUSED",
                    },
                )
            if entry["in_progress"]:
                raise HTTPException(
                    status_code=409,
                    detail={
                        "detail": "An analysis request with this idempotency key is still processing",
                        "code": "ANALYZE_IN_PROGRESS",
                    },
                )
            if entry.get("response") is not None:
                return entry["response"]

        _analyze_idempotency[composite_key] = {
            "fingerprint": fingerprint,
            "in_progress": True,
            "response": None,
            "expires_at": now + ANALYZE_IDEMPOTENCY_TTL_SECONDS,
        }
    return None


async def _complete_idempotency(
    *,
    user_id: str,
    idempotency_key: str,
    response: dict,
) -> None:
    now = monotonic()
    composite_key = (user_id, idempotency_key)
    async with _analyze_idempotency_lock:
        entry = _analyze_idempotency.get(composite_key)
        if not entry:
            return
        entry["in_progress"] = False
        entry["response"] = response
        entry["expires_at"] = now + ANALYZE_IDEMPOTENCY_TTL_SECONDS


async def _drop_idempotency(*, user_id: str, idempotency_key: str) -> None:
    composite_key = (user_id, idempotency_key)
    async with _analyze_idempotency_lock:
        _analyze_idempotency.pop(composite_key, None)


@router.post("", response_model=AnalyzeResponse)
async def analyze_lab(
    request: AnalyzeRequest,
    current_user: dict = Depends(get_current_user),
    idempotency_key: Optional[str] = Header(default=None, alias="X-Idempotency-Key"),
):
    user_id: str = current_user["sub"]
    await _enforce_analyze_rate_limit(user_id)

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

    normalized_key: Optional[str] = None
    if idempotency_key:
        normalized_key = idempotency_key.strip()
        if not normalized_key:
            normalized_key = None
        elif len(normalized_key) > MAX_IDEMPOTENCY_KEY_LENGTH:
            raise HTTPException(
                status_code=422,
                detail={
                    "detail": f"X-Idempotency-Key is too long (max {MAX_IDEMPOTENCY_KEY_LENGTH} chars)",
                    "code": "IDEMPOTENCY_KEY_TOO_LONG",
                },
            )

    if normalized_key:
        fingerprint = _request_fingerprint(
            normalized_text=normalized_text,
            normalized_lab_name=normalized_lab_name,
            test_date=request.test_date,
            ocr_confidence=request.ocr_confidence,
            normalized_symptoms=normalized_symptoms,
        )
        cached = await _get_idempotency_cached_response(
            user_id=user_id,
            idempotency_key=normalized_key,
            fingerprint=fingerprint,
        )
        if cached is not None:
            return cached

    try:
        # Save raw OCR text (never the PDF)
        try:
            upload = await save_lab_upload(
                user_id=user_id,
                extracted_text=normalized_text,
                lab_name=normalized_lab_name,
                test_date=request.test_date.isoformat() if request.test_date else None,
                ocr_confidence=request.ocr_confidence,
                analyze_prompt_version=EXTRACT_PROMPT_VERSION,
            )
        except Exception as exc:
            logger.error("analyze_save_upload_failed user_id=%s error=%s", user_id, repr(exc), exc_info=True)
            raise HTTPException(
                status_code=500,
                detail={"detail": "Could not store uploaded lab text", "code": "LAB_UPLOAD_SAVE_FAILED"},
            ) from exc

        upload_id = upload["id"]

        # Call Claude to extract biomarkers
        try:
            biomarkers = await asyncio.wait_for(
                extract_biomarkers(
                    text=normalized_text,
                    symptoms=normalized_symptoms,
                ),
                timeout=ANALYZE_EXTRACT_TIMEOUT_SECONDS,
            )
        except asyncio.TimeoutError as exc:
            logger.error("analyze_extract_timeout upload_id=%s user_id=%s", upload_id, user_id)
            raise HTTPException(
                status_code=504,
                detail={"detail": "Analysis timed out. Please retry.", "code": "ANALYSIS_TIMEOUT"},
            ) from exc
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
        try:
            saved = await save_biomarkers(
                upload_id=upload_id,
                user_id=user_id,
                biomarkers=biomarkers,
            )
        except Exception as exc:
            logger.error("analyze_save_biomarkers_failed upload_id=%s user_id=%s error=%s", upload_id, user_id, repr(exc), exc_info=True)
            raise HTTPException(
                status_code=500,
                detail={"detail": "Could not save extracted biomarkers", "code": "BIOMARKER_SAVE_FAILED"},
            ) from exc

        try:
            await save_timeline_event(
                user_id,
                event_type="lab_uploaded",
                summary=f"Lab uploaded from {normalized_lab_name or 'unknown lab'}",
                metadata={"upload_id": upload_id, "biomarker_count": len(saved)},
            )
        except Exception as exc:
            # Timeline should not fail the request after successful biomarker persistence.
            logger.warning("analyze_timeline_event_failed upload_id=%s user_id=%s error=%s", upload_id, user_id, repr(exc))

        result = {
            "upload_id": upload_id,
            "biomarkers": saved,
        }
        if normalized_key:
            await _complete_idempotency(user_id=user_id, idempotency_key=normalized_key, response=result)
        return result
    except Exception:
        if normalized_key:
            await _drop_idempotency(user_id=user_id, idempotency_key=normalized_key)
        raise

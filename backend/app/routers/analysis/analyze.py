import asyncio
import hashlib
import json
from collections import deque
from datetime import date
from time import monotonic

from fastapi import APIRouter, HTTPException, Depends, Header
from pydantic import BaseModel, Field
from typing import Optional, List
import logging

from app.dependencies import require_freemium_analyze, get_current_user
from app.services.claude_service import extract_biomarkers, EXTRACT_PROMPT_VERSION, is_llm_configured
from app.services.supabase_service import (
    assert_upload_belongs_to_user,
    get_biomarkers_by_upload,
    get_protocol_by_upload,
    save_biomarkers,
    save_lab_upload,
    save_timeline_event,
    write_audit_log,
)
from app.constants import (
    ANALYZE_EXTRACT_TIMEOUT_SECONDS,
    ANALYZE_IDEMPOTENCY_TTL_SECONDS,
    MAX_IDEMPOTENCY_KEY_LENGTH,
)
from app.utils.validation import normalize_symptoms as _normalize_symptoms

router = APIRouter()
logger = logging.getLogger("uvicorn.error")

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
    current_user: dict = Depends(require_freemium_analyze),
    idempotency_key: Optional[str] = Header(default=None, alias="X-Idempotency-Key"),
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

        await write_audit_log(
            user_id=user_id,
            action="create",
            entity_type="lab_upload",
            entity_id=str(upload_id),
            new_value={
                "lab_name": normalized_lab_name,
                "has_test_date": bool(request.test_date),
                "has_symptoms": bool(normalized_symptoms),
            },
        )

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

        await write_audit_log(
            user_id=user_id,
            action="create",
            entity_type="biomarkers",
            entity_id=str(upload_id),
            new_value={"count": len(saved)},
        )

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


@router.get("/{upload_id}")
async def get_results(
    upload_id: str,
    current_user: dict = Depends(get_current_user),
):
    """Get biomarkers and protocol for a specific upload."""
    user_id = current_user.get("sub")

    # Verify the upload belongs to the user
    await assert_upload_belongs_to_user(upload_id, user_id)

    # Get biomarkers
    biomarkers = await get_biomarkers_by_upload(upload_id, user_id)

    # Get protocol (if exists)
    protocol = await get_protocol_by_upload(user_id, upload_id)

    await write_audit_log(
        user_id=user_id,
        action="read",
        entity_type="results",
        entity_id=str(upload_id),
        new_value={"biomarker_count": len(biomarkers), "has_protocol": protocol is not None},
    )

    return {
        "biomarkers": biomarkers,
        "protocol": protocol.get("recommendations", []) if protocol else [],
    }

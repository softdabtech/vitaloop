import asyncio
import hashlib
import json
import os
import tempfile
from collections import deque
from datetime import date
from time import monotonic

from fastapi import APIRouter, HTTPException, Depends, Header, File, UploadFile, Form, Request
from pydantic import BaseModel, Field
from typing import Optional, List
import logging

from app.dependencies import require_freemium_analyze, get_current_user
from app.services.claude_service import extract_biomarkers, EXTRACT_PROMPT_VERSION, is_llm_configured, get_analysis_source
from app.services.claude_pdf_analyzer import OpenAIPDFAnalyzer, create_file_analyzer
from app.services.supabase_service import (
    assert_upload_belongs_to_user,
    get_biomarkers_by_upload,
    get_protocol_by_upload,
    save_biomarkers,
    save_lab_upload,
    save_protocol,
    save_timeline_event,
    update_lab_upload_status,
    write_audit_log,
)
from app.config import settings
from app.constants import (
    ANALYZE_EXTRACT_TIMEOUT_SECONDS,
    ANALYZE_IDEMPOTENCY_TTL_SECONDS,
    MAX_IDEMPOTENCY_KEY_LENGTH,
)
from app.utils.validation import normalize_symptoms as _normalize_symptoms
from app.models.biomarker import (
    ManualAnalysisRequest,
    ManualBiomarkerEntryRequest,
    BiomarkerOption,
)
from app.services.biomarker_service import BiomarkerService
from app.services.biomarker_reference import get_all_biomarkers
from app.services.knowledge.integration import evaluate_biomarkers_with_knowledge

router = APIRouter()
logger = logging.getLogger("uvicorn.error")
biomarker_service = BiomarkerService()
pdf_analyzer = OpenAIPDFAnalyzer(api_key=settings.active_llm_api_key, model=settings.active_llm_model)

# Error message constants (S1192 - reduce string duplication)
_TEXT_TOO_SHORT_DETAIL = {"detail": "Extracted text is too short", "code": "LAB_TEXT_TOO_SHORT"}
_FAILED_LOAD_BIOMARKERS = "Failed to load biomarker options"
_NO_VALID_BIOMARKERS = "No valid biomarkers provided"
_UNAUTHORIZED_DETAIL = "Unauthorized"
_ANALYSIS_FAILED = "Analysis failed"

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
    analysis_source: Optional[str] = None
    knowledge_evaluation: Optional[dict] = None


def _stable_analysis_source(default: str = "fallback") -> str:
    source = get_analysis_source()
    if source in {"llm", "fallback"}:
        return source
    return default


@router.post("/pdf")
@router.post("/upload")  # New universal endpoint
async def analyze_lab_file(
    file: UploadFile = File(...),
    lab_name: Optional[str] = Form(default=None),
    symptoms: List[str] = Form(default_factory=list),
    current_user: dict = Depends(get_current_user),
    _freemium_check: None = Depends(require_freemium_analyze),
):
    """
    Universal file analyzer for all lab report formats.

    Supported formats:
    - PDF (text and scanned)
    - Images: PNG, JPG, JPEG, GIF, BMP, WEBP
    - Tables: XLSX, CSV
    - Multi-page: TIFF
    """
    user_id: str = current_user["sub"]

    # Check quota (unified biomarker quota)
    quota_ok, quota_msg, used_by = await biomarker_service.check_freemium_biomarker_quota(user_id, "file")
    if not quota_ok:
        raise HTTPException(
            status_code=402,
            detail={
                "detail": quota_msg,
                "code": "BIOMARKER_QUOTA_EXCEEDED",
                "used_by": used_by,
            },
        )

    temp_path: Optional[str] = None
    upload_id: Optional[str] = None

    try:
        # Validate file extension
        filename = (file.filename or "").lower()
        valid_extensions = {
            '.pdf', '.png', '.jpg', '.jpeg', '.gif', '.bmp', '.webp', '.tiff', '.tif',
            '.xlsx', '.xls', '.csv'
        }

        file_ext = None
        for ext in valid_extensions:
            if filename.endswith(ext):
                file_ext = ext
                break

        if not file_ext:
            raise HTTPException(
                status_code=400,
                detail={
                    "detail": "Please upload a valid file (PDF, image, or table)",
                    "code": "INVALID_FILE_TYPE"
                }
            )

        upload_bytes = await file.read()
        if not upload_bytes:
            raise HTTPException(status_code=400, detail={"detail": "Uploaded file is empty", "code": "EMPTY_FILE"})

        # Save file temporarily with correct extension
        with tempfile.NamedTemporaryFile(delete=False, suffix=file_ext) as tmp:
            tmp.write(upload_bytes)
            temp_path = tmp.name

        # Create appropriate analyzer based on file type
        try:
            file_analyzer = await create_file_analyzer(temp_path)
        except Exception as e:
            logger.error(f"Failed to create analyzer for file {file.filename}: {e}", exc_info=True)
            raise HTTPException(
                status_code=400,
                detail={"detail": f"Unable to process file format: {str(e)}", "code": "ANALYZER_CREATION_FAILED"}
            )

        try:
            analysis = await file_analyzer.analyze(temp_path, symptoms=symptoms)
        except Exception as e:
            logger.error(f"Analysis failed for file {file.filename}: {e}", exc_info=True)
            raise HTTPException(
                status_code=500,
                detail={"detail": f"Analysis failed: {str(e)}", "code": "ANALYZE_EXECUTION_FAILED"}
            )

        if not analysis.get("success"):
            error_code = analysis.get("error_code")
            error_text = analysis.get("error") or "Unable to analyze file"

            logger.warning(f"Analysis returned failure: code={error_code}, error={error_text}")

            if error_code == "TIMEOUT":
                raise HTTPException(status_code=408, detail={"detail": error_text, "code": "ANALYSIS_TIMEOUT"})
            if error_code == "VALIDATION_ERROR":
                raise HTTPException(status_code=400, detail={"detail": error_text, "code": "FILE_VALIDATION_FAILED"})
            if error_code == "CONNECTION_ERROR":
                raise HTTPException(status_code=503, detail={"detail": error_text, "code": "ANALYSIS_SERVICE_UNAVAILABLE"})
            if error_code == "VISION_API_DISABLED":
                raise HTTPException(status_code=503, detail={"detail": "Vision API is not available for image analysis", "code": "VISION_API_DISABLED"})

            raise HTTPException(status_code=500, detail={"detail": error_text, "code": "ANALYSIS_UNKNOWN_ERROR"})

        biomarkers = analysis.get("biomarkers", [])
        if not biomarkers:
            logger.warning(f"No biomarkers extracted from file {file.filename}. Full analysis response: {json.dumps(analysis, default=str)}")
            raise HTTPException(
                status_code=422,
                detail={"detail": "Could not extract biomarkers from the uploaded file. Try uploading a clearer lab report with visible biomarker values and reference ranges.", "code": "BIOMARKERS_NOT_EXTRACTED"},
            )

        upload_payload = {
            "analysis_method": analysis.get("analysis_method"),
            "analysis_time": analysis.get("analysis_time"),
            "summary": analysis.get("summary", {}),
            "top_priority": analysis.get("top_priority", []),
            "retest_schedule": analysis.get("retest_schedule", []),
            "biomarker_count": len(biomarkers),
        }

        # Determine prompt version based on analysis method
        analysis_method = analysis.get("analysis_method", "unknown")
        if "vision" in analysis_method:
            prompt_version = "openai_vision_v1"
        elif "table" in analysis_method:
            prompt_version = "openai_table_v1"
        elif "pdf_text" in analysis_method:
            prompt_version = "openai_pdf_text_v1"
        else:
            prompt_version = "openai_v1"
        analysis_source = "llm" if "openai" in prompt_version else _stable_analysis_source("fallback")

        upload = await save_lab_upload(
            user_id=user_id,
            extracted_text=json.dumps(upload_payload, ensure_ascii=True),
            lab_name=lab_name or file.filename,
            analyze_prompt_version=prompt_version,
        )
        upload_id = upload["id"]

        saved_biomarkers = await save_biomarkers(upload_id=upload_id, user_id=user_id, biomarkers=biomarkers)
        knowledge_evaluation = await evaluate_biomarkers_with_knowledge(
            biomarkers=saved_biomarkers,
            symptoms=symptoms,
            user_id=user_id,
            upload_id=str(upload_id),
        )

        protocol = analysis.get("protocol", [])
        if protocol:
            await save_protocol(
                user_id=user_id,
                upload_id=upload_id,
                recommendations=protocol,
                prompt_version=prompt_version,
            )

        await save_timeline_event(
            user_id=user_id,
            event_type="lab_analyzed",
            summary=f"Lab report analyzed: {len(saved_biomarkers)} biomarkers found",
            metadata={
                "upload_id": upload_id,
                "biomarker_count": len(saved_biomarkers),
                "analysis_method": analysis.get("analysis_method", "unknown"),
                "file_type": file_ext,
            },
        )

        return {
            "upload_id": upload_id,
            "biomarkers": saved_biomarkers,
            "top_priority": analysis.get("top_priority", []),
            "protocol": protocol,
            "retest_schedule": analysis.get("retest_schedule", []),
            "summary": analysis.get("summary", {}),
            "analysis_time": analysis.get("analysis_time", 0),
            "analysis_method": analysis.get("analysis_method", "openai_pdf"),
            "analysis_source": analysis_source,
            "knowledge_evaluation": knowledge_evaluation,
        }
    except HTTPException:
        if upload_id:
            await update_lab_upload_status(upload_id, "failed")
        raise
    except Exception as exc:
        logger.error("analyze_pdf_failed user_id=%s error=%s", user_id, repr(exc), exc_info=True)
        if upload_id:
            await update_lab_upload_status(upload_id, "failed")
        raise HTTPException(status_code=500, detail={"detail": "Error analyzing lab report", "code": "ANALYZE_FAILED"})
    finally:
        try:
            await file.close()
        except Exception:
            logger.debug("analyze_pdf_file_close_failed filename=%s", getattr(file, "filename", None))
        if temp_path and os.path.exists(temp_path):
            os.remove(temp_path)


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
    request: Request,
    current_user: dict = Depends(get_current_user),
    _freemium_check: None = Depends(require_freemium_analyze),
    idempotency_key: Optional[str] = Header(default=None, alias="X-Idempotency-Key"),
):
    content_type = (request.headers.get("content-type") or "").lower()

    # Backward compatibility: older frontend bundles sent multipart payloads to
    # POST /analyze instead of POST /analyze/pdf.
    if "multipart/form-data" in content_type:
        form = await request.form()
        file = form.get("file")
        lab_name_form = form.get("lab_name")
        symptoms_form = form.getlist("symptoms")

        if file is None:
            raise HTTPException(
                status_code=422,
                detail={"detail": "Field required: file", "code": "VALIDATION_ERROR"},
            )

        filename = (getattr(file, "filename", "") or "").lower()
        if filename.endswith(".pdf"):
            user_id: str = current_user["sub"]
            quota_ok, quota_msg, used_by = await biomarker_service.check_freemium_biomarker_quota(user_id, "pdf")
            if not quota_ok:
                raise HTTPException(
                    status_code=402,
                    detail={
                        "detail": quota_msg,
                        "code": "BIOMARKER_QUOTA_EXCEEDED",
                        "used_by": used_by,
                    },
                )

            temp_path: Optional[str] = None
            try:
                upload_bytes = await file.read()
                if not upload_bytes:
                    raise HTTPException(
                        status_code=400,
                        detail={"detail": "Uploaded file is empty", "code": "EMPTY_FILE"},
                    )

                with tempfile.NamedTemporaryFile(delete=False, suffix=".pdf") as tmp:
                    tmp.write(upload_bytes)
                    temp_path = tmp.name

                analysis = await pdf_analyzer.analyze_lab_pdf(temp_path, symptoms=symptoms_form)
                biomarkers = analysis.get("biomarkers", [])
                if not biomarkers:
                    raise HTTPException(
                        status_code=422,
                        detail={"detail": "Could not extract biomarkers from PDF", "code": "BIOMARKERS_NOT_EXTRACTED"},
                    )

                upload = await save_lab_upload(
                    user_id=user_id,
                    extracted_text="legacy_multipart_pdf",
                    lab_name=lab_name_form or getattr(file, "filename", None),
                    analyze_prompt_version="legacy_pdf_v1",
                )
                upload_id = upload["id"]

                saved_biomarkers = await save_biomarkers(upload_id=upload_id, user_id=user_id, biomarkers=biomarkers)
                knowledge_evaluation = await evaluate_biomarkers_with_knowledge(
                    biomarkers=saved_biomarkers,
                    symptoms=symptoms_form,
                    user_id=user_id,
                    upload_id=str(upload_id),
                )
                await save_timeline_event(
                    user_id=user_id,
                    event_type="lab_analyzed",
                    summary=f"Lab report analyzed: {len(saved_biomarkers)} biomarkers found",
                    metadata={"upload_id": upload_id, "biomarker_count": len(saved_biomarkers), "analysis_method": "legacy_pdf"},
                )

                return {
                    "upload_id": upload_id,
                    "biomarkers": saved_biomarkers,
                    "analysis_source": _stable_analysis_source("fallback"),
                    "knowledge_evaluation": knowledge_evaluation,
                }
            finally:
                try:
                    await file.close()
                except Exception:
                    logger.debug("legacy_multipart_file_close_failed filename=%s", getattr(file, "filename", None))
                if temp_path and os.path.exists(temp_path):
                    os.remove(temp_path)

        return await analyze_lab_file(
            file=file,
            lab_name=lab_name_form,
            symptoms=symptoms_form,
            current_user=current_user,
            _freemium_check=None,
        )

    try:
        payload = await request.json()
    except Exception:
        payload = None

    if payload is None:
        raise HTTPException(
            status_code=422,
            detail={"detail": "Field required: extracted_text", "code": "VALIDATION_ERROR"},
        )

    try:
        request_data = AnalyzeRequest.model_validate(payload)
    except Exception as exc:
        raise HTTPException(
            status_code=422,
            detail={"detail": "Validation failed", "code": "VALIDATION_ERROR"},
        ) from exc

    user_id: str = current_user["sub"]

    # Check unified freemium biomarker quota (1 total entry for free users)
    quota_ok, quota_msg, used_by = await biomarker_service.check_freemium_biomarker_quota(user_id, "pdf")
    if not quota_ok:
        raise HTTPException(
            status_code=402,
            detail={
                "detail": quota_msg,
                "code": "BIOMARKER_QUOTA_EXCEEDED",
                "used_by": used_by,
            },
        )

    normalized_text = _normalize_lab_text(request_data.extracted_text)
    normalized_symptoms = _normalize_symptoms(request_data.symptoms or [])
    normalized_lab_name = request_data.lab_name.strip() if request_data.lab_name else None

    if request_data.ocr_confidence is not None and not (0 <= request_data.ocr_confidence <= 100):
        raise HTTPException(
            status_code=422,
            detail={"detail": "ocr_confidence must be between 0 and 100", "code": "OCR_CONFIDENCE_OUT_OF_RANGE"},
        )

    if len(normalized_text) < 20:
        raise HTTPException(status_code=422, detail=_TEXT_TOO_SHORT_DETAIL)

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
            test_date=request_data.test_date,
            ocr_confidence=request_data.ocr_confidence,
            normalized_symptoms=normalized_symptoms,
        )
        cached = await _get_idempotency_cached_response(
            user_id=user_id,
            idempotency_key=normalized_key,
            fingerprint=fingerprint,
        )
        if cached is not None:
            return cached

    upload_id: Optional[str] = None
    try:
        # Save raw OCR text (never the PDF)
        try:
            upload = await save_lab_upload(
                user_id=user_id,
                extracted_text=normalized_text,
                lab_name=normalized_lab_name,
                test_date=request_data.test_date.isoformat() if request_data.test_date else None,
                ocr_confidence=request_data.ocr_confidence,
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
                "has_test_date": bool(request_data.test_date),
                "has_symptoms": bool(normalized_symptoms),
            },
        )

        # Call Claude to extract biomarkers
        try:
            biomarkers = await asyncio.wait_for(
                extract_biomarkers(
                    text=normalized_text,
                    symptoms=normalized_symptoms,
                    user_id=user_id,
                    upload_id=upload_id,
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
        analysis_source = _stable_analysis_source("llm" if is_llm_configured() else "fallback")

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
            "analysis_source": analysis_source,
            "knowledge_evaluation": await evaluate_biomarkers_with_knowledge(
                biomarkers=saved,
                symptoms=normalized_symptoms,
                user_id=user_id,
                upload_id=str(upload_id),
            ),
        }
        if normalized_key:
            await _complete_idempotency(user_id=user_id, idempotency_key=normalized_key, response=result)
        return result
    except Exception:
        if upload_id:
            try:
                await update_lab_upload_status(upload_id, "failed")
            except Exception:
                logger.warning("analyze_mark_failed_status_failed upload_id=%s user_id=%s", upload_id, user_id)
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


@router.get(
    "/biomarkers/options",
    response_model=List[BiomarkerOption],
    summary="Get available biomarkers for manual entry"
)
async def get_biomarker_options(current_user: dict = Depends(get_current_user)):
    """
    Get list of available biomarkers for dropdown selection in manual entry.

    Returns:
        List of biomarker options with id, name, category, units
    """
    try:
        options = biomarker_service.get_available_biomarkers()
        return options
    except Exception as e:
        logger.error(f"Error getting biomarker options: {e}")
        raise HTTPException(status_code=500, detail=_FAILED_LOAD_BIOMARKERS)


async def _check_and_validate_manual_entries(user_id: str, request: ManualAnalysisRequest):
    """Check quota and validate biomarker entries"""
    # Check unified freemium biomarker quota (1 total entry for free users)
    quota_ok, quota_msg, used_by = await biomarker_service.check_freemium_biomarker_quota(user_id, "manual")
    if not quota_ok:
        raise HTTPException(
            status_code=402,
            detail={
                "detail": quota_msg,
                "code": "BIOMARKER_QUOTA_EXCEEDED",
                "used_by": used_by,
            },
        )

    # Convert to ManualBiomarkerEntry objects
    entry_dicts = [entry.model_dump() for entry in request.biomarkers]

    # Validate all entries
    valid_entries, errors = biomarker_service.validate_entries(entry_dicts)

    if errors:
        error_message = "; ".join(errors)
        raise HTTPException(status_code=422, detail=f"Validation failed: {error_message}")

    if not valid_entries:
        raise HTTPException(status_code=400, detail=_NO_VALID_BIOMARKERS)

    return biomarker_service.convert_to_standard_units(valid_entries)


async def _generate_protocol_for_manual_entries(request: ManualAnalysisRequest, converted_entries: list) -> list:
    """Generate protocol via Claude if available"""
    if not is_llm_configured():
        logger.warning("LLM not configured, skipping protocol generation")
        return []

    try:
        formatted_text = biomarker_service.format_for_claude_analysis(converted_entries)
        protocol_result = await extract_biomarkers(
            extracted_text=formatted_text,
            lab_name=request.lab_name or "Manual Entry",
            symptoms=request.biomarkers[0].model_dump() if request.biomarkers else {},
        )
        return protocol_result.get("recommendations", []) if protocol_result else []
    except Exception as e:
        logger.error(f"Error generating protocol for manual upload: {e}")
        return []


@router.post(
    "/manual",
    response_model=AnalyzeResponse,
    status_code=201,
    summary="Analyze manually entered biomarkers"
)
async def analyze_manual_biomarkers(
    request: ManualAnalysisRequest,
    current_user: dict = Depends(get_current_user),
):
    """
    Accept manually entered biomarker values and generate protocol.

    Checks freemium limits (1 manual entry for free users).
    Converts all values to standard units.
    Generates personalized protocol via Claude.

    Request body:
    {
        "biomarkers": [
            {"biomarker_id": "hemoglobin", "value": 14.5, "unit": "g/dL"},
            {"biomarker_id": "glucose", "value": 95, "unit": "mg/dL"}
        ],
        "lab_name": "Home Test",
        "test_date": "2026-05-04T00:00:00",
        "notes": "Optional notes"
    }

    Returns: Same format as PDF analysis (biomarkers + protocol)
    """
    user_id = current_user.get("sub")
    if not user_id:
        raise HTTPException(status_code=401, detail=_UNAUTHORIZED_DETAIL)

    try:
        converted_entries = await _check_and_validate_manual_entries(user_id, request)

        # Create upload record in database
        upload_result = await biomarker_service.create_upload_from_manual_entries(
            user_id=user_id,
            entries=converted_entries,
            lab_name=request.lab_name,
            test_date=request.test_date,
            notes=request.notes,
        )

        upload_id = upload_result["upload_id"]
        biomarkers_data = upload_result["biomarkers"]

        # Generate protocol via Claude
        protocol = await _generate_protocol_for_manual_entries(request, converted_entries)

        # Save protocol
        if protocol:
            await save_protocol_for_upload(user_id, upload_id, protocol)

        return {
            "upload_id": upload_id,
            "biomarkers": biomarkers_data,
            "protocol": protocol,
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error analyzing manual biomarkers: {e}")
        raise HTTPException(status_code=500, detail=f"Analysis failed: {str(e)}")


async def save_protocol_for_upload(user_id: str, upload_id: str, recommendations: List[dict]):
    """Save generated protocol to database"""
    try:
        protocol_data = {
            "user_id": user_id,
            "upload_id": upload_id,
            "recommendations": recommendations,
            "created_at": asyncio.get_event_loop().time(),
        }
        from app.services.supabase_service import _get_supabase, _run
        sb = _get_supabase()
        await _run(
            lambda: sb.table("protocols").insert(protocol_data).execute()
        )
    except Exception as e:
        logger.error(f"Failed to save protocol: {e}")
        # Don't fail the entire request if protocol save fails
        pass

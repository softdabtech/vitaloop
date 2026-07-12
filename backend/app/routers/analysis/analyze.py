import asyncio
import hashlib
import json
import os
import re
import tempfile
from collections import deque
from datetime import date
from time import monotonic

from fastapi import APIRouter, HTTPException, Depends, Header, File, UploadFile, Form, Request
from pydantic import BaseModel, Field
from typing import Optional, List, Any, Dict
import logging

from app.dependencies import require_freemium_analyze, get_current_user
from app.services.ai.openai_service import extract_biomarkers, EXTRACT_PROMPT_VERSION, is_llm_configured, get_analysis_source
from app.services.claude_pdf_analyzer import OpenAIPDFAnalyzer, create_file_analyzer
from app.services.supabase_service import (
    assert_upload_belongs_to_user,
    get_biomarker_extraction_candidates,
    get_biomarkers_by_upload,
    get_latest_report_version,
    get_protocol_by_upload,
    get_user_profile,
    save_biomarkers,
    save_biomarker_extraction_candidates,
    save_lab_upload,
    save_protocol,
    save_timeline_event,
    update_biomarker_extraction_candidates,
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
from app.services.analysis_candidates import build_candidate_payloads, candidate_to_biomarker
from app.services.knowledge.integration import evaluate_biomarkers_with_knowledge
from app.services.knowledge.report import build_knowledge_report
from app.services.lab_analysis_pipeline import run_lab_analysis_pipeline
from app.utils.locale import resolve_locale

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
_ANALYSIS_PROFILE_REQUIRED_UK = (
    "Перед аналізом заповніть медичний контекст: вік, стать, зріст і вагу. "
    "Це потрібно, щоб коректно відрізняти дитячі й дорослі референси та не давати випадкові рекомендації."
)
_ANALYSIS_PROFILE_REQUIRED_EN = (
    "Complete age, sex, height, and weight before analysis. "
    "This is required to distinguish pediatric and adult context and avoid unsafe recommendations."
)
_REQUIRED_ANALYSIS_PROFILE_FIELDS = ("age", "sex", "height_cm", "weight_kg")

_analyze_idempotency: dict[tuple[str, str], dict] = {}
_analyze_idempotency_lock = asyncio.Lock()
_ALLOWED_BIOMARKER_STATUSES = {"OPTIMAL", "BORDERLINE", "DEFICIENT", "ELEVATED"}
_BIOMARKER_STATUS_ALIASES = {
    "NORMAL": "OPTIMAL",
    "IN RANGE": "OPTIMAL",
    "IN_RANGE": "OPTIMAL",
    "OK": "OPTIMAL",
    "LOW": "DEFICIENT",
    "BELOW RANGE": "DEFICIENT",
    "BELOW_RANGE": "DEFICIENT",
    "HIGH": "ELEVATED",
    "ABOVE RANGE": "ELEVATED",
    "ABOVE_RANGE": "ELEVATED",
    "CRITICAL": "ELEVATED",
}
_ALLOWED_BIOMARKER_CATEGORIES = {
    "blood_count",
    "metabolic",
    "lipids",
    "liver",
    "kidney",
    "thyroid",
    "vitamins",
    "minerals",
    "hormones",
    "inflammation",
    "electrolytes",
    "urinalysis",
    "coagulation",
    "other",
}
_BIOMARKER_CATEGORY_ALIASES = {
    "cbc": "blood_count",
    "blood count": "blood_count",
    "blood_count": "blood_count",
    "metabolism": "metabolic",
    "glucose": "metabolic",
    "nutrients": "vitamins",
    "nutrient": "vitamins",
    "hormonal": "hormones",
}
_BIOMARKER_CATEGORY_KEYWORDS = {
    "blood_count": ["hemoglobin", "hematocrit", "rbc", "wbc", "platelet", "mcv", "mch", "rdw"],
    "metabolic": ["glucose", "hba1c", "a1c", "insulin"],
    "lipids": ["cholesterol", "ldl", "hdl", "triglycer"],
    "liver": ["alt", "ast", "bilirubin", "albumin", "alkaline phosphatase", "ggt"],
    "kidney": ["creatinine", "bun", "urea", "egfr"],
    "thyroid": ["tsh", "t3", "t4", "thyroid"],
    "vitamins": ["vitamin", "b12", "folate"],
    "minerals": ["ferritin", "iron", "magnesium", "zinc", "selenium", "calcium", "potassium", "sodium"],
    "hormones": ["testosterone", "estradiol", "progesterone", "cortisol", "dhea"],
    "inflammation": ["crp", "esr", "homocysteine"],
    "electrolytes": ["chloride", "bicarbonate", "co2"],
}


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
    knowledge_report: Optional[dict] = None
    protocol: Optional[Any] = None
    retest_schedule: Optional[List[dict]] = None
    summary: Optional[dict] = None
    final_analysis: Optional[dict] = None
    safety_result: Optional[dict] = None
    explainability: Optional[dict] = None
    report_version: Optional[dict] = None


class CandidateDecision(BaseModel):
    id: str
    status: str = Field(..., pattern="^(confirmed|corrected|rejected)$")
    corrections: Optional[Dict[str, Any]] = None


class ConfirmCandidatesRequest(BaseModel):
    candidates: List[CandidateDecision] = Field(default_factory=list)
    symptoms: List[str] = Field(default_factory=list)


def _resolve_response_locale(request: Request | None) -> str:
    return resolve_locale(request)


def _stable_analysis_source(default: str = "fallback") -> str:
    source = get_analysis_source()
    if source in {"llm", "fallback"}:
        return source
    return default


def _missing_analysis_profile_fields(profile: Dict[str, Any]) -> List[str]:
    return [field for field in _REQUIRED_ANALYSIS_PROFILE_FIELDS if not profile.get(field)]


async def _require_analysis_profile_context(user_id: str, locale: str) -> Dict[str, Any]:
    profile = await get_user_profile(user_id) or {}
    missing = _missing_analysis_profile_fields(profile)
    if missing:
        raise HTTPException(
            status_code=422,
            detail={
                "detail": _ANALYSIS_PROFILE_REQUIRED_UK if locale == "uk" else _ANALYSIS_PROFILE_REQUIRED_EN,
                "code": "PROFILE_CONTEXT_REQUIRED",
                "missing_fields": missing,
            },
        )
    return profile


def _coerce_optional_float(value: Any) -> float | None:
    if value in (None, ""):
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        match = re.search(r"[-+]?\d+(?:[.,]\d+)?", str(value))
        if not match:
            return None
        return float(match.group(0).replace(",", "."))


def _extract_reference_bounds(raw_range: Any) -> tuple[float | None, float | None]:
    if raw_range in (None, ""):
        return None, None
    # Treat hyphens between two numbers as range separators, not negative signs.
    values = re.findall(r"(?<!\d)[-+]?\d+(?:[.,]\d+)?", str(raw_range))
    if len(values) < 2:
        return None, None
    return float(values[0].replace(",", ".")), float(values[1].replace(",", "."))


def _normalize_biomarker_status(
    status: Any,
    *,
    value: float | None = None,
    ref_low: float | None = None,
    ref_high: float | None = None,
) -> str:
    if value is not None:
        if ref_low is not None and value < ref_low:
            return "DEFICIENT"
        if ref_high is not None and value > ref_high:
            return "ELEVATED"
        if ref_low is not None or ref_high is not None:
            return "OPTIMAL"

    raw_status = str(status or "OPTIMAL").strip().upper()
    normalized = _BIOMARKER_STATUS_ALIASES.get(raw_status, raw_status)
    if normalized in _ALLOWED_BIOMARKER_STATUSES:
        return normalized
    return "OPTIMAL"


def _normalize_biomarker_category(category: Any, name: str = "") -> str:
    raw = str(category or "").strip().lower()
    normalized = _BIOMARKER_CATEGORY_ALIASES.get(raw, raw.replace(" ", "_"))
    if normalized in _ALLOWED_BIOMARKER_CATEGORIES and normalized != "other":
        return normalized
    lowered_name = str(name or "").strip().lower()
    for inferred_category, keywords in _BIOMARKER_CATEGORY_KEYWORDS.items():
        if any(keyword in lowered_name for keyword in keywords):
            return inferred_category
    return "other"


def _unique_biomarker_name(name: str, unit: str, seen_names: set[str]) -> str | None:
    base_name = str(name or "").strip()
    if not base_name:
        return None

    key = base_name.lower()
    if key not in seen_names:
        seen_names.add(key)
        return base_name

    unit_suffix = str(unit or "").strip()
    if unit_suffix:
        candidate = f"{base_name} ({unit_suffix})"
        candidate_key = candidate.lower()
        if candidate_key not in seen_names:
            seen_names.add(candidate_key)
            return candidate

    index = 2
    while index <= 20:
        candidate = f"{base_name} #{index}"
        candidate_key = candidate.lower()
        if candidate_key not in seen_names:
            seen_names.add(candidate_key)
            return candidate
        index += 1

    return None


def _sanitize_extracted_biomarkers(biomarkers: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    sanitized: List[Dict[str, Any]] = []
    seen_names: set[str] = set()
    for raw in biomarkers or []:
        if not isinstance(raw, dict):
            continue

        name = str(raw.get("name") or raw.get("display_name") or "").strip()
        unit = str(raw.get("unit") or "").strip()
        value = raw.get("value", raw.get("result"))

        if not name or value in (None, ""):
            continue

        try:
            numeric_value = float(value)
        except (TypeError, ValueError):
            value_text = str(value).strip()
            match = re.search(r"[-+]?\d+(?:\.\d+)?", value_text)
            if not match:
                continue
            numeric_value = float(match.group(0))
            if not unit:
                inferred_unit = value_text[match.end():].strip()
                unit = inferred_unit.split()[0] if inferred_unit else ""

        if not unit:
            continue

        unique_name = _unique_biomarker_name(name, unit, seen_names)
        if not unique_name:
            continue

        ref_low = _coerce_optional_float(raw.get("ref_low"))
        ref_high = _coerce_optional_float(raw.get("ref_high"))
        if ref_low is None or ref_high is None:
            range_low, range_high = _extract_reference_bounds(raw.get("reference_range"))
            ref_low = ref_low if ref_low is not None else range_low
            ref_high = ref_high if ref_high is not None else range_high

        sanitized.append(
            {
                "name": unique_name,
                "value": numeric_value,
                "unit": unit,
                "ref_low": ref_low,
                "ref_high": ref_high,
                "status": _normalize_biomarker_status(
                    raw.get("status"),
                    value=numeric_value,
                    ref_low=ref_low,
                    ref_high=ref_high,
                ),
                "category": _normalize_biomarker_category(raw.get("category"), unique_name),
            }
        )
    return sanitized


@router.post("/pdf")
@router.post("/upload")  # New universal endpoint
async def analyze_lab_file(
    request: Request,
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
    response_locale = _resolve_response_locale(request)
    user_profile = await _require_analysis_profile_context(user_id, response_locale)

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

        biomarkers = _sanitize_extracted_biomarkers(analysis.get("biomarkers", []))
        if not biomarkers:
            logger.warning(f"No biomarkers extracted from file {file.filename}. Full analysis response: {json.dumps(analysis, default=str)}")
            raise HTTPException(
                status_code=422,
                detail={"detail": "Could not extract biomarkers from the uploaded file. Try uploading a clearer lab report with visible biomarker values and reference ranges.", "code": "BIOMARKERS_NOT_EXTRACTED"},
            )

        upload_payload = {
            "analysis_method": analysis.get("analysis_method"),
            "analysis_time": analysis.get("analysis_time"),
            "document_parser": analysis.get("document_parser"),
            "document_input_chars": analysis.get("document_input_chars"),
            "document_chunks": analysis.get("document_chunks"),
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

        try:
            upload = await save_lab_upload(
                user_id=user_id,
                extracted_text=json.dumps(upload_payload, ensure_ascii=True),
                lab_name=lab_name or file.filename,
                analyze_prompt_version=prompt_version,
            )
        except Exception as exc:
            logger.error("analyze_file_save_upload_failed user_id=%s error=%s", user_id, repr(exc), exc_info=True)
            raise HTTPException(
                status_code=500,
                detail={"detail": "Could not store uploaded lab data", "code": "LAB_UPLOAD_SAVE_FAILED"},
            ) from exc

        upload_id = upload["id"]

        try:
            candidates = build_candidate_payloads(
                biomarkers=biomarkers,
                source="table" if "table" in str(analysis_method).lower() else ("ai" if analysis_source == "llm" else "regex"),
            )
            await save_biomarker_extraction_candidates(upload_id=upload_id, user_id=user_id, candidates=candidates)
        except Exception as exc:
            logger.warning("analyze_file_save_candidates_failed upload_id=%s user_id=%s error=%s", upload_id, user_id, repr(exc))

        try:
            saved_biomarkers = await save_biomarkers(upload_id=upload_id, user_id=user_id, biomarkers=biomarkers)
        except Exception as exc:
            logger.error("analyze_file_save_biomarkers_failed upload_id=%s user_id=%s error=%s", upload_id, user_id, repr(exc), exc_info=True)
            raise HTTPException(
                status_code=500,
                detail={"detail": "Could not save extracted biomarkers", "code": "BIOMARKER_SAVE_FAILED"},
            ) from exc

        pipeline_result = await run_lab_analysis_pipeline(
            biomarkers=saved_biomarkers,
            symptoms=symptoms,
            user_profile=user_profile,
            user_id=user_id,
            analysis_id=str(upload_id),
            source_metadata={"source": "b2c_file", "file_type": file_ext, "analysis_method": analysis_method},
            persist_knowledge=True,
            persist_report_version=True,
            locale=response_locale,
        )
        knowledge_evaluation = pipeline_result.get("knowledge_evaluation")
        knowledge_report = pipeline_result.get("knowledge_report")

        protocol = pipeline_result.get("protocol", {})
        if protocol:
            try:
                await save_protocol(
                    user_id=user_id,
                    upload_id=upload_id,
                    recommendations=pipeline_result.get("recommendations") or [],
                    prompt_version=prompt_version,
                )
            except Exception as exc:
                logger.warning(
                    "analyze_file_save_protocol_failed upload_id=%s user_id=%s error=%s",
                    upload_id,
                    user_id,
                    repr(exc),
                    exc_info=True,
                )

        try:
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
        except Exception as exc:
            logger.warning("analyze_file_timeline_event_failed upload_id=%s user_id=%s error=%s", upload_id, user_id, repr(exc))

        return {
            "upload_id": upload_id,
            "biomarkers": saved_biomarkers,
            "top_priority": pipeline_result.get("prioritized_biomarkers", []),
            "protocol": protocol,
            "retest_schedule": pipeline_result.get("retest_suggestions", []),
            "summary": pipeline_result.get("health_summary", {}),
            "analysis_time": analysis.get("analysis_time", 0),
            "analysis_method": analysis.get("analysis_method", "openai_pdf"),
            "analysis_source": analysis_source,
            "knowledge_evaluation": knowledge_evaluation,
            "knowledge_report": knowledge_report,
            "safety_result": pipeline_result.get("safety_result"),
            "explainability": pipeline_result.get("explainability"),
            "report_version": pipeline_result.get("report_version"),
            "final_analysis": pipeline_result,
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
            await _require_analysis_profile_context(user_id, _resolve_response_locale(request))
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
                biomarkers = _sanitize_extracted_biomarkers(analysis.get("biomarkers", []))
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
            request=request,
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
    user_profile = await _require_analysis_profile_context(user_id, _resolve_response_locale(request))

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

        try:
            candidates = build_candidate_payloads(
                biomarkers=biomarkers,
                source="ai" if analysis_source == "llm" else "regex",
            )
            await save_biomarker_extraction_candidates(upload_id=upload_id, user_id=user_id, candidates=candidates)
        except Exception as exc:
            logger.warning("analyze_text_save_candidates_failed upload_id=%s user_id=%s error=%s", upload_id, user_id, repr(exc))

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

        pipeline_result = await run_lab_analysis_pipeline(
            biomarkers=saved,
            symptoms=normalized_symptoms,
            user_profile=user_profile,
            user_id=user_id,
            analysis_id=str(upload_id),
            source_metadata={"source": "b2c_text", "lab_name": normalized_lab_name},
            persist_knowledge=True,
            persist_report_version=True,
            locale=_resolve_response_locale(request),
        )
        knowledge_evaluation = pipeline_result.get("knowledge_evaluation")
        result = {
            "upload_id": upload_id,
            "biomarkers": saved,
            "analysis_source": analysis_source,
            "knowledge_evaluation": knowledge_evaluation,
            "knowledge_report": pipeline_result.get("knowledge_report"),
            "protocol": pipeline_result.get("protocol", {}),
            "retest_schedule": pipeline_result.get("retest_suggestions", []),
            "summary": pipeline_result.get("health_summary", {}),
            "safety_result": pipeline_result.get("safety_result"),
            "explainability": pipeline_result.get("explainability"),
            "report_version": pipeline_result.get("report_version"),
            "final_analysis": pipeline_result,
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


@router.get(
    "/biomarkers/options",
    response_model=List[BiomarkerOption],
    summary="Get available biomarkers for manual entry",
)
async def get_biomarker_options_static(current_user: dict = Depends(get_current_user)):
    try:
        return biomarker_service.get_available_biomarkers()
    except Exception as e:
        logger.error(f"Error getting biomarker options: {e}")
        raise HTTPException(status_code=500, detail=_FAILED_LOAD_BIOMARKERS)


@router.get("/{upload_id}/candidates")
async def get_upload_candidates(
    upload_id: str,
    current_user: dict = Depends(get_current_user),
):
    user_id = current_user.get("sub")
    await assert_upload_belongs_to_user(upload_id, user_id)
    candidates = await get_biomarker_extraction_candidates(upload_id, user_id)
    return {
        "upload_id": upload_id,
        "candidates": [
            {
                **candidate,
                "requires_confirmation": float(candidate.get("confidence_score") or 0) < 0.55,
                "confidence_label": (
                    "high"
                    if float(candidate.get("confidence_score") or 0) >= 0.80
                    else ("medium" if float(candidate.get("confidence_score") or 0) >= 0.55 else "low")
                ),
            }
            for candidate in candidates
        ],
    }


@router.post("/{upload_id}/confirm-candidates")
async def confirm_upload_candidates(
    upload_id: str,
    body: ConfirmCandidatesRequest,
    request: Request,
    current_user: dict = Depends(get_current_user),
):
    user_id = current_user.get("sub")
    await assert_upload_belongs_to_user(upload_id, user_id)

    updated = await update_biomarker_extraction_candidates(
        upload_id=upload_id,
        user_id=user_id,
        decisions=[item.model_dump() for item in body.candidates],
    )
    confirmed = [candidate for candidate in updated if candidate.get("status") in {"confirmed", "corrected"}]
    biomarkers = [item for item in (candidate_to_biomarker(candidate) for candidate in confirmed) if item]
    if not biomarkers:
        raise HTTPException(
            status_code=422,
            detail={"detail": "No confirmed biomarker candidates were provided", "code": "NO_CONFIRMED_CANDIDATES"},
        )

    saved = await save_biomarkers(upload_id=upload_id, user_id=user_id, biomarkers=biomarkers)
    user_profile = await get_user_profile(user_id) or {}
    locale = _resolve_response_locale(request)
    pipeline_result = await run_lab_analysis_pipeline(
        biomarkers=saved,
        symptoms=_normalize_symptoms(body.symptoms),
        user_profile=user_profile,
        user_id=user_id,
        analysis_id=str(upload_id),
        source_metadata={"source": "candidate_confirmation"},
        persist_knowledge=True,
        persist_report_version=True,
        locale=locale,
    )
    protocol = pipeline_result.get("protocol", {})
    if protocol:
        try:
            await save_protocol(
                user_id=user_id,
                upload_id=upload_id,
                recommendations=pipeline_result.get("recommendations") or [],
                prompt_version="candidate_confirmation_v1",
            )
        except Exception as exc:
            logger.warning("confirm_candidates_save_protocol_failed upload_id=%s user_id=%s error=%s", upload_id, user_id, repr(exc))

    return {
        "upload_id": upload_id,
        "biomarkers": saved,
        "candidates": updated,
        "knowledge_report": pipeline_result.get("knowledge_report"),
        "protocol": protocol,
        "safety_result": pipeline_result.get("safety_result"),
        "explainability": pipeline_result.get("explainability"),
        "report_version": pipeline_result.get("report_version"),
        "final_analysis": pipeline_result,
    }


@router.get("/{upload_id}")
async def get_results(
    upload_id: str,
    request: Request,
    current_user: dict = Depends(get_current_user),
):
    """Get biomarkers and protocol for a specific upload."""
    user_id = current_user.get("sub")

    # Verify the upload belongs to the user
    await assert_upload_belongs_to_user(upload_id, user_id)

    # Get biomarkers
    biomarkers = await get_biomarkers_by_upload(upload_id, user_id)
    user_profile = await get_user_profile(user_id) or {}
    protocol = await get_protocol_by_upload(user_id, upload_id)
    protocol_recommendations = protocol.get("recommendations", []) if protocol else []
    locale = _resolve_response_locale(request)

    # Build the current report on read so older uploads are upgraded without re-uploading.
    pipeline_result = await run_lab_analysis_pipeline(
        biomarkers=biomarkers,
        symptoms=[],
        user_profile=user_profile,
        user_id=user_id,
        analysis_id=str(upload_id),
        source_metadata={"source": "results_read"},
        persist_knowledge=False,
        locale=locale,
        generate_ai_protocol=not bool(protocol_recommendations),
    )
    knowledge_evaluation = pipeline_result.get("knowledge_evaluation")
    knowledge_report = pipeline_result.get("knowledge_report")

    generated_recommendations = pipeline_result.get("recommendations") or []
    if not protocol_recommendations and generated_recommendations:
        try:
            protocol = await save_protocol(
                user_id=user_id,
                upload_id=upload_id,
                recommendations=generated_recommendations,
                prompt_version="results_read_v2",
            )
            protocol_recommendations = protocol.get("recommendations", [])
        except Exception as exc:
            logger.warning(
                "results_read_save_protocol_failed upload_id=%s user_id=%s error=%s",
                upload_id,
                user_id,
                repr(exc),
                exc_info=True,
            )

    await write_audit_log(
        user_id=user_id,
        action="read",
        entity_type="results",
        entity_id=str(upload_id),
        new_value={"biomarker_count": len(biomarkers), "has_protocol": bool(protocol_recommendations)},
    )
    try:
        report_version = await get_latest_report_version(upload_id, user_id, locale)
    except Exception as exc:
        logger.warning("results_read_report_version_unavailable upload_id=%s user_id=%s error=%s", upload_id, user_id, repr(exc))
        report_version = None

    return {
        "upload_id": upload_id,
        "biomarkers": biomarkers,
        "protocol": protocol_recommendations,
        "knowledge_evaluation": knowledge_evaluation,
        "knowledge_report": knowledge_report,
        "safety_result": pipeline_result.get("safety_result"),
        "explainability": pipeline_result.get("explainability"),
        "report_version": report_version,
        "final_analysis": pipeline_result,
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
    http_request: Request,
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
        response_locale = _resolve_response_locale(http_request)
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

        pipeline_result = await run_lab_analysis_pipeline(
            biomarkers=biomarkers_data,
            symptoms=[],
            user_id=user_id,
            analysis_id=str(upload_id),
            source_metadata={"source": "b2c_manual", "lab_name": request.lab_name},
            persist_knowledge=True,
            persist_report_version=True,
            locale=response_locale,
        )
        protocol = pipeline_result.get("protocol", {})
        legacy_manual_recommendations = (
            []
            if response_locale == "uk"
            else await _generate_protocol_for_manual_entries(request, converted_entries)
        )
        recommendations_to_save = legacy_manual_recommendations or pipeline_result.get("recommendations") or []
        protocol_response = legacy_manual_recommendations or protocol

        # Save protocol
        if recommendations_to_save:
            await save_protocol_for_upload(user_id, upload_id, recommendations_to_save)

        return {
            "upload_id": upload_id,
            "biomarkers": biomarkers_data,
            "analysis_source": _stable_analysis_source("llm" if is_llm_configured() else "fallback"),
            "knowledge_evaluation": pipeline_result.get("knowledge_evaluation"),
            "knowledge_report": pipeline_result.get("knowledge_report"),
            "protocol": protocol_response,
            "shopping_links": pipeline_result.get("shopping_links", []),
            "retest_schedule": pipeline_result.get("retest_suggestions", []),
            "summary": pipeline_result.get("health_summary", {}),
            "safety_result": pipeline_result.get("safety_result"),
            "explainability": pipeline_result.get("explainability"),
            "report_version": pipeline_result.get("report_version"),
            "final_analysis": pipeline_result,
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

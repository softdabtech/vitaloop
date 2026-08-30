import logging

from fastapi import APIRouter, Depends, Request

from app.dependencies import get_current_user, require_active_subscription
from app.services.assignment_service import AssignmentService
from app.services.supabase_service import (
    assert_upload_belongs_to_user,
    get_biomarkers_by_upload,
    get_latest_report_version,
    get_protocol_by_upload,
    get_user_profile,
    get_user_progress,
    save_protocol,
)
from app.services.lab_analysis_pipeline import run_lab_analysis_pipeline
from app.services.safety import sanitize_protocol_for_safety
from app.services.report_history import (
    REPORT_SOURCE_LEGACY_FALLBACK,
    assemble_frozen_response,
    is_frozen_report_version,
)
from app.utils.locale import resolve_locale

router = APIRouter(tags=["protocol-compatibility"])
_assignment_service = AssignmentService()
logger = logging.getLogger("uvicorn.error")


def _resolve_response_locale(request: Request | None) -> str:
    return resolve_locale(request)


@router.get("/lab-results")
async def list_lab_results(current_user: dict = Depends(require_active_subscription)):
    """Compatibility endpoint for clients expecting /lab-results list API."""
    user_id = current_user.get("sub")
    data = await get_user_progress(user_id)
    return data or []


@router.get("/assignments")
async def list_assignments(current_user: dict = Depends(get_current_user)):
    """Compatibility endpoint for clients expecting /assignments list API."""
    user_id = current_user.get("sub")
    global_role = str(current_user.get("global_role") or current_user.get("role") or "end_user").lower()

    rows = await _assignment_service.list_assignments(
        scope_user_id=user_id,
        global_role=global_role,
    )
    return {"items": rows, "total": len(rows)}


@router.get("/results/{upload_id}")
async def get_results_by_upload(upload_id: str, request: Request, current_user: dict = Depends(get_current_user)):
    """Compatibility endpoint for clients expecting /results/{upload_id}."""
    user_id = current_user.get("sub")

    await assert_upload_belongs_to_user(upload_id, user_id)
    biomarkers = await get_biomarkers_by_upload(upload_id, user_id)
    protocol_row = await get_protocol_by_upload(user_id, upload_id)
    protocol_recommendations = (protocol_row or {}).get("recommendations") or []
    user_profile = await get_user_profile(user_id) or {}
    locale = _resolve_response_locale(request)
    # Stage 2C read-boundary defense-in-depth, same as analyze.py::get_results —
    # this compatibility endpoint previously served protocols.recommendations
    # verbatim with no re-sanitization at read time.
    protocol_recommendations = sanitize_protocol_for_safety(protocol_recommendations, profile=user_profile, locale=locale)

    try:
        report_version = await get_latest_report_version(upload_id, user_id, locale)
    except Exception as exc:
        logger.warning(
            "results_compat_report_version_unavailable upload_id=%s user_id=%s error=%s",
            upload_id,
            user_id,
            repr(exc),
        )
        report_version = None

    # Stage 2G: a completed analysis with a persisted report version is an
    # immutable historical artifact — serve it from the frozen row, never
    # recompute it with today's pipeline/prompts/knowledge rules/safety
    # behavior. This mirrors analyze.py::get_results via the shared
    # app/services/report_history.py helper so the two endpoints cannot drift.
    if is_frozen_report_version(report_version):
        return assemble_frozen_response(
            upload_id=upload_id,
            biomarkers=biomarkers or [],
            protocol_recommendations=protocol_recommendations,
            report_version=report_version,
            user_profile=user_profile,
            locale=locale,
        )

    pipeline_result = await run_lab_analysis_pipeline(
        biomarkers=biomarkers or [],
        symptoms=[],
        user_profile=user_profile,
        user_id=user_id,
        analysis_id=str(upload_id),
        source_metadata={"source": "results_compatibility"},
        persist_knowledge=False,
        locale=locale,
        generate_ai_protocol=not bool(protocol_recommendations),
    )
    knowledge_evaluation = pipeline_result.get("knowledge_evaluation")
    knowledge_report = pipeline_result.get("knowledge_report")
    generated_recommendations = pipeline_result.get("recommendations") or []
    if not protocol_recommendations and generated_recommendations:
        protocol_row = await save_protocol(
            user_id=user_id,
            upload_id=upload_id,
            recommendations=generated_recommendations,
            prompt_version="results_compatibility_v2",
        )
        protocol_recommendations = (protocol_row or {}).get("recommendations") or []

    # Stage 2G: no frozen report_versions row exists. If real canonical
    # biomarkers exist, this is a genuine legacy artifact predating
    # report_versions — tagged so it is never mistaken for the original
    # frozen historical result; no mass migration/backfill happens here.
    report_source = REPORT_SOURCE_LEGACY_FALLBACK if biomarkers else None

    return {
        "upload_id": upload_id,
        "report_source": report_source,
        "biomarkers": biomarkers or [],
        "protocol": protocol_recommendations,
        "shopping_links": pipeline_result.get("shopping_links") or [],
        "knowledge_evaluation": knowledge_evaluation,
        "knowledge_report": knowledge_report,
        "interpreted_report": pipeline_result.get("interpreted_report"),
        "final_analysis": pipeline_result,
    }

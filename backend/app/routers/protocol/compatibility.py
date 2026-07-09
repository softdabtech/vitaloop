from fastapi import APIRouter, Depends, Request

from app.dependencies import get_current_user, require_active_subscription
from app.services.assignment_service import AssignmentService
from app.services.supabase_service import (
    assert_upload_belongs_to_user,
    get_biomarkers_by_upload,
    get_protocol_by_upload,
    get_user_profile,
    get_user_progress,
    save_protocol,
)
from app.services.lab_analysis_pipeline import run_lab_analysis_pipeline
from app.services.knowledge.integration import evaluate_biomarkers_with_knowledge
from app.services.knowledge.report import build_knowledge_report
from app.utils.locale import resolve_locale

router = APIRouter(tags=["protocol-compatibility"])
_assignment_service = AssignmentService()


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

    compatibility_evaluation = await evaluate_biomarkers_with_knowledge(
        biomarkers=biomarkers or [],
        symptoms=[],
        user_id=user_id,
        upload_id=str(upload_id),
        persist=False,
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
    knowledge_evaluation = compatibility_evaluation or pipeline_result.get("knowledge_evaluation")
    knowledge_report = build_knowledge_report(
        biomarkers=biomarkers or [],
        knowledge_evaluation=knowledge_evaluation,
        locale=locale,
    )
    generated_recommendations = pipeline_result.get("recommendations") or []
    if not protocol_recommendations and generated_recommendations:
        protocol_row = await save_protocol(
            user_id=user_id,
            upload_id=upload_id,
            recommendations=generated_recommendations,
            prompt_version="results_compatibility_v2",
        )
        protocol_recommendations = (protocol_row or {}).get("recommendations") or []

    return {
        "upload_id": upload_id,
        "biomarkers": biomarkers or [],
        "protocol": protocol_recommendations,
        "knowledge_evaluation": knowledge_evaluation,
        "knowledge_report": knowledge_report,
        "final_analysis": pipeline_result,
    }

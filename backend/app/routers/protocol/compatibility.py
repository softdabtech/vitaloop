from fastapi import APIRouter, Depends

from app.dependencies import get_current_user, require_active_subscription
from app.services.assignment_service import AssignmentService
from app.services.supabase_service import (
    assert_upload_belongs_to_user,
    get_biomarkers_by_upload,
    get_protocol_by_upload,
    get_user_progress,
)
from app.services.knowledge.integration import evaluate_biomarkers_with_knowledge
from app.services.knowledge.report import build_knowledge_report

router = APIRouter(tags=["protocol-compatibility"])
_assignment_service = AssignmentService()


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
async def get_results_by_upload(upload_id: str, current_user: dict = Depends(get_current_user)):
    """Compatibility endpoint for clients expecting /results/{upload_id}."""
    user_id = current_user.get("sub")

    await assert_upload_belongs_to_user(upload_id, user_id)
    biomarkers = await get_biomarkers_by_upload(upload_id, user_id)
    protocol_row = await get_protocol_by_upload(user_id, upload_id)
    knowledge_evaluation = await evaluate_biomarkers_with_knowledge(
        biomarkers=biomarkers or [],
        symptoms=[],
        user_id=user_id,
        upload_id=str(upload_id),
        persist=False,
    )
    knowledge_report = build_knowledge_report(
        biomarkers=biomarkers or [],
        knowledge_evaluation=knowledge_evaluation,
    )

    return {
        "upload_id": upload_id,
        "biomarkers": biomarkers or [],
        "protocol": (protocol_row or {}).get("recommendations") or [],
        "knowledge_evaluation": knowledge_evaluation,
        "knowledge_report": knowledge_report,
    }

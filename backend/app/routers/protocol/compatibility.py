from fastapi import APIRouter, Depends

from app.dependencies import get_current_user, require_active_subscription
from app.services.assignment_service import AssignmentService
from app.services.supabase_service import get_user_progress

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

from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.dependencies_crm import (
    UserContext,
    get_user_context,
    require_assignment_access,
)
from app.schemas.assignment import AssignmentCreate, AssignmentListResponse, AssignmentResponse
from app.services.assignment_service import AssignmentService

router = APIRouter(prefix="/crm/assignments", tags=["crm-assignments"])
service = AssignmentService()

_ADMIN_ACCESS_REQUIRED = "Admin-level access required"
_ASSIGNMENT_NOT_FOUND = "Assignment not found"


def _require_admin_like(user_context: UserContext) -> None:
    role = (user_context.global_role or "").lower()
    if role not in {"super_admin", "admin", "org_admin", "org_owner", "client_admin", "manager"}:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=_ADMIN_ACCESS_REQUIRED)


@router.post("", response_model=AssignmentResponse, status_code=status.HTTP_201_CREATED)
async def create_assignment(request: AssignmentCreate, user_context: UserContext = Depends(get_user_context)):
    _require_admin_like(user_context)
    assignment = await service.create_assignment(
        practitioner_id=request.practitioner_id,
        client_user_id=request.client_user_id,
        org_id=request.organization_id,
        assigned_by=user_context.user_id,
        notes=request.notes,
    )
    return AssignmentResponse(**assignment)


@router.patch("/{assignment_id}/activate", response_model=AssignmentResponse)
async def activate_assignment(
    assignment_id: UUID,
    user_context: UserContext = Depends(get_user_context),
    _assignment: dict = Depends(require_assignment_access("modify")),
):
    _require_admin_like(user_context)
    assignment = await service.activate_assignment(assignment_id=assignment_id, activated_by=user_context.user_id)
    return AssignmentResponse(**assignment)


@router.patch("/{assignment_id}/complete", response_model=AssignmentResponse)
async def complete_assignment(
    assignment_id: UUID,
    user_context: UserContext = Depends(get_user_context),
    _assignment: dict = Depends(require_assignment_access("modify")),
):
    _require_admin_like(user_context)
    assignment = await service.complete_assignment(assignment_id=assignment_id, completed_by=user_context.user_id)
    return AssignmentResponse(**assignment)


@router.patch("/{assignment_id}/cancel", response_model=AssignmentResponse)
async def cancel_assignment(
    assignment_id: UUID,
    user_context: UserContext = Depends(get_user_context),
    _assignment: dict = Depends(require_assignment_access("cancel")),
):
    assignment = await service.cancel_assignment(assignment_id=assignment_id, cancelled_by=user_context.user_id)
    return AssignmentResponse(**assignment)


@router.get("", response_model=AssignmentListResponse)
async def list_assignments(
    practitioner_id: Optional[UUID] = Query(default=None),
    client_user_id: Optional[UUID] = Query(default=None),
    status_value: Optional[str] = Query(default=None, alias="status"),
    org_id: Optional[UUID] = Query(default=None),
    user_context: UserContext = Depends(get_user_context),
):
    if practitioner_id:
        rows = await service.list_assignments_for_practitioner(
            practitioner_id=practitioner_id,
            scope_user_id=user_context.user_id,
            global_role=user_context.global_role,
        )
    elif client_user_id:
        rows = await service.list_assignments_for_client(
            client_user_id=client_user_id,
            scope_user_id=user_context.user_id,
            global_role=user_context.global_role,
        )
    else:
        rows = await service.list_assignments(
            scope_user_id=user_context.user_id,
            global_role=user_context.global_role,
            practitioner_id=practitioner_id,
            client_user_id=client_user_id,
            status_value=status_value,
            org_id=org_id,
        )

    if status_value:
        rows = [row for row in rows if str(row.get("status") or "").lower() == status_value.lower()]
    if org_id:
        rows = [row for row in rows if str(row.get("organization_id")) == str(org_id)]

    return AssignmentListResponse(items=[AssignmentResponse(**row) for row in rows], total=len(rows))


@router.get("/{assignment_id}", response_model=AssignmentResponse)
async def get_assignment(
    assignment_id: UUID,
    user_context: UserContext = Depends(get_user_context),
    _assignment: dict = Depends(require_assignment_access("read")),
):
    row = await service.get_assignment_with_scope(
        assignment_id=assignment_id,
        scope_user_id=user_context.user_id,
        global_role=user_context.global_role,
    )
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=_ASSIGNMENT_NOT_FOUND)
    return AssignmentResponse(**row)

"""
CRM Clients Router
Exposes all client management, program, practitioner, subscription endpoints.
Uses clean dependency injection for auth, org scoping, and business logic validation.
"""

import logging
from uuid import UUID
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.models.crm_clients import (
    ClientCreateRequest,
    ClientUpdateRequest,
    ClientResponse,
    ClientDetailResponse,
    ClientListResponse,
    PractitionerCreateRequest,
    PractitionerAssignRequest,
    PractitionerResponse,
    ProgramCreateRequest,
    ProgramResponse,
    ProgramListResponse,
    PractitionerListResponse,
    ClientProgramAssignRequest,
    ClientProgramStatusUpdateRequest,
    ClientProgramResponse,
    QuestionnaireCreateRequest,
    QuestionnaireResponse,
    QuestionnaireSubmitRequest,
    QuestionnaireResultResponse,
    InterventionCreateRequest,
    InterventionResponse,
    SubscriptionCreateRequest,
    SubscriptionResponse,
    AuditLogEntry,
    AuditLogListResponse,
    ClientQuestionnaireHistoryItem,
    ClientInterventionHistoryItem,
    ClientFullResponse,
    ErrorDetail,
)
from app.dependencies_crm import (
    UserContext,
    get_user_context,
    require_super_admin,
    require_practitioner,
    require_end_user,
    require_subscription_plan,
    get_org_context,
    require_org_admin,
    require_client_access,
    resolve_practitioner_list_scope,
)
from app.services.crm_service import (
    ClientService,
    PractitionerService,
    ProgramService,
    ClientProgramService,
    QuestionnaireService,
    InterventionService,
    SubscriptionService,
    AuditLogService,
)

logger = logging.getLogger("crm.router")

router = APIRouter(prefix="/crm", tags=["crm"])

# Error detail constants (S1192)
_FAILED_CREATE_CLIENT = "Failed to create client"
_CLIENT_NOT_FOUND = "Client not found"
_FAILED_FETCH_CLIENT = "Failed to fetch client"
_FAILED_FETCH_CLIENTS = "Failed to fetch clients"
_FAILED_UPDATE_CLIENT = "Failed to update client"
_FAILED_CREATE_PRACTITIONER = "Failed to create practitioner"
_PRACTITIONER_NOT_FOUND = "Practitioner not found"
_FAILED_FETCH_PRACTITIONER = "Failed to fetch practitioner"
_ACCESS_DENIED = "Access denied"
_FAILED_FETCH_PRACTITIONERS = "Failed to fetch practitioners"
_FAILED_ASSIGN_PRACTITIONER = "Failed to assign practitioner"
_FAILED_CREATE_PROGRAM = "Failed to create program"
_PROGRAM_NOT_FOUND = "Program not found"
_FAILED_FETCH_PROGRAM = "Failed to fetch program"
_FAILED_FETCH_PROGRAMS = "Failed to fetch programs"
_FAILED_ASSIGN_PROGRAM = "Failed to assign program"
_ASSIGNMENT_NOT_FOUND = "Assignment not found"
_FAILED_FETCH_ASSIGNMENT = "Failed to fetch assignment"
_FAILED_START_PROGRAM = "Failed to start program"
_FAILED_PAUSE_PROGRAM = "Failed to pause program"
_FAILED_COMPLETE_PROGRAM = "Failed to complete program"
_QUESTIONNAIRE_NOT_FOUND = "Questionnaire not found"
_FAILED_FETCH_QUESTIONNAIRE = "Failed to fetch questionnaire"
_FAILED_SUBMIT_QUESTIONNAIRE = "Failed to submit questionnaire"
_FAILED_CREATE_INTERVENTION = "Failed to create intervention"
_NO_ACTIVE_SUBSCRIPTION = "No active subscription"
_FAILED_FETCH_SUBSCRIPTION = "Failed to fetch subscription"
_FAILED_CREATE_SUBSCRIPTION = "Failed to create subscription"
_FAILED_FETCH_QUESTIONNAIRES = "Failed to fetch questionnaires"
_FAILED_FETCH_INTERVENTIONS = "Failed to fetch interventions"
_FAILED_FETCH_FULL_CLIENT_VIEW = "Failed to fetch full client view"
_FAILED_FETCH_AUDIT_LOGS = "Failed to fetch audit logs"

# Service instances (stateless, can be reused)
client_service = ClientService()
practitioner_service = PractitionerService()
program_service = ProgramService()
client_program_service = ClientProgramService()
questionnaire_service = QuestionnaireService()
intervention_service = InterventionService()
subscription_service = SubscriptionService()
audit_log_service = AuditLogService()


async def _ensure_practitioner_assigned_to_client_program(
    client_program_id: UUID,
    user_context: UserContext,
) -> None:
    if user_context.global_role in {"super_admin", "admin"}:
        return

    client_program = await client_program_service.repo.get_by_id(client_program_id)
    if not client_program:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=_ASSIGNMENT_NOT_FOUND)

    client_id = client_program.get("client_id")
    if not client_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=_ASSIGNMENT_NOT_FOUND)

    client = await client_service.get_client(UUID(client_id))
    if not client:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=_CLIENT_NOT_FOUND)

    practitioner = await practitioner_service.get_practitioner_for_user(user_context.user_id)
    if not practitioner:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=_ACCESS_DENIED)

    assigned_practitioner_id = client.get("assigned_practitioner_id")
    if not assigned_practitioner_id or str(assigned_practitioner_id) != str(practitioner.get("id")):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=_ACCESS_DENIED)


# ============================================================
# CLIENT ENDPOINTS
# ============================================================


@router.post(
    "/clients",
    response_model=ClientResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create client profile",
)
async def create_client(
    request: ClientCreateRequest,
    user_context: UserContext = Depends(require_super_admin),
):
    """
    Create client profile (typically on user signup).
    Requires super_admin.
    """
    try:
        client = await client_service.create_client(request.user_id, request.organization_id)
        return ClientResponse(**client)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(e))
    except Exception as e:
        logger.error(f"Create client failed: {e}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=_FAILED_CREATE_CLIENT)


@router.get("/clients/{client_id}", response_model=ClientDetailResponse, summary="Get client detail")
async def get_client(
    client_id: UUID,
    _: dict = Depends(require_client_access),
):
    """
    Get client detail with related data (practitioner, program).
    Access: Client self, assigned practitioner, super_admin.
    """
    try:
        client_data = await client_service.get_client(client_id)
        if not client_data:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=_CLIENT_NOT_FOUND)

        result = ClientDetailResponse(**client_data)

        # Enrich with practitioner and program
        if client_data.get("assigned_practitioner_id"):
            prac = await practitioner_service.get_practitioner(UUID(client_data["assigned_practitioner_id"]))
            if prac:
                result.practitioner = PractitionerResponse(**prac)

        if client_data.get("active_program_id"):
            prog = await program_service.get_program(UUID(client_data["active_program_id"]))
            if prog:
                result.active_program = ProgramResponse(**prog)

        return result
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Get client failed: {e}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=_FAILED_FETCH_CLIENT)


@router.get("/clients", response_model=ClientListResponse, summary="List clients")
async def list_clients(
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    user_context: UserContext = Depends(require_super_admin),
):
    """
    List all clients (super_admin only).
    Paginated, with email/display_name enrichment from users table.
    """
    try:
        from app.services import supabase_service as svc
        
        clients, total = await client_service.repo.get_all(limit, offset)
        
        # Enrich with user email and display_name
        enriched_clients = []
        for client in clients:
            enriched_client = dict(client)
            # Try to fetch user data from users table for email and display_name
            try:
                sb = svc._get_supabase()
                user_data = await svc._run(
                    lambda: sb.table("users")
                    .select("email, raw_user_meta_data")
                    .eq("id", str(client.get("user_id")))
                    .limit(1)
                    .execute()
                )
                if user_data.data and len(user_data.data) > 0:
                    user = user_data.data[0]
                    enriched_client["email"] = user.get("email")
                    meta = user.get("raw_user_meta_data") or {}
                    enriched_client["display_name"] = meta.get("display_name") or meta.get("full_name")
            except Exception as e:
                logger.warning(f"Failed to enrich user data for client {client.get('id')}: {e}")
            
            enriched_clients.append(ClientResponse(**enriched_client))
        
        return ClientListResponse(
            items=enriched_clients,
            total=total,
        )
    except Exception as e:
        logger.error(f"List clients failed: {e}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=_FAILED_FETCH_CLIENTS)


@router.patch("/clients/{client_id}", response_model=ClientResponse, summary="Update client")
async def update_client(
    client_id: UUID,
    request: ClientUpdateRequest,
    user_context: UserContext = Depends(require_super_admin),
):
    """
    Update client profile.
    Requires super_admin.
    """
    try:
        if request.onboarding_status:
            client = await client_service.update_onboarding_status(
                client_id, request.onboarding_status, user_context.user_id
            )
        else:
            client = await client_service.repo.update(client_id, request.model_dump(exclude_none=True))

        return ClientResponse(**client)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(e))
    except Exception as e:
        logger.error(f"Update client failed: {e}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=_FAILED_UPDATE_CLIENT)


# ============================================================
# PRACTITIONER ENDPOINTS
# ============================================================


@router.post(
    "/practitioners",
    response_model=PractitionerResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Register practitioner",
)
async def create_practitioner(
    request: PractitionerCreateRequest,
    user_context: UserContext = Depends(require_super_admin),
):
    """
    Register new practitioner.
    Requires super_admin.
    """
    try:
        practitioner = await practitioner_service.create_practitioner(
            request.user_id, request.specialization, request.bio, request.max_clients
        )
        return PractitionerResponse(**practitioner)
    except Exception as e:
        logger.error(f"Create practitioner failed: {e}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=_FAILED_CREATE_PRACTITIONER)


@router.get("/practitioners/{practitioner_id}", response_model=PractitionerResponse, summary="Get practitioner")
async def get_practitioner(
    practitioner_id: UUID,
    user_context: UserContext = Depends(require_super_admin),
):
    """
    Get practitioner detail.
    Requires super_admin.
    """
    try:
        practitioner = await practitioner_service.get_practitioner(practitioner_id)
        if not practitioner:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=_PRACTITIONER_NOT_FOUND)
        return PractitionerResponse(**practitioner)
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Get practitioner failed: {e}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=_FAILED_FETCH_PRACTITIONER)


@router.get("/practitioners", response_model=PractitionerListResponse, summary="List practitioners")
async def list_practitioners(
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    practitioner_scope: dict = Depends(resolve_practitioner_list_scope),
):
    """
    List practitioners with role-aware visibility.

    - super_admin/admin: all practitioners
    - org admin-like: practitioners in same organization(s)
    - practitioner: own practitioner profile
    """
    try:
        scope = practitioner_scope.get("scope")

        if scope == "all":
            practitioners, total = await practitioner_service.list_practitioners(limit=limit, offset=offset)
        elif scope == "org":
            practitioners, total = await practitioner_service.list_practitioners_by_user_ids(
                user_ids=practitioner_scope.get("user_ids", []),
                limit=limit,
                offset=offset,
            )
        elif scope == "self":
            own = await practitioner_service.get_practitioner_for_user(UUID(practitioner_scope["user_id"]))
            if not own:
                return PractitionerListResponse(items=[], total=0)

            return PractitionerListResponse(
                items=[PractitionerResponse(**own)],
                total=1,
            )
        else:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=_ACCESS_DENIED)

        return PractitionerListResponse(
            items=[PractitionerResponse(**p) for p in practitioners],
            total=total,
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"List practitioners failed: {e}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=_FAILED_FETCH_PRACTITIONERS)


@router.post(
    "/practitioners/assign",
    response_model=ClientResponse,
    summary="Assign practitioner to client",
)
async def assign_practitioner_to_client(
    request: PractitionerAssignRequest,
    user_context: UserContext = Depends(require_super_admin),
):
    """
    Assign practitioner to client.
    Enforces practitioner capacity + client subscription validation.
    """
    try:
        client = await practitioner_service.assign_to_client(
            request.client_id, request.practitioner_id, user_context.user_id
        )
        return ClientResponse(**client)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(e))
    except Exception as e:
        logger.error(f"Assign practitioner failed: {e}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=_FAILED_ASSIGN_PRACTITIONER)


# ============================================================
# PROGRAM ENDPOINTS
# ============================================================


@router.post(
    "/programs",
    response_model=ProgramResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create program template",
)
async def create_program(
    request: ProgramCreateRequest,
    user_context: UserContext = Depends(require_super_admin),
):
    """
    Create program template (OPS only).
    """
    try:
        program = await program_service.create_program(
            name=request.name,
            category=request.category.value,
            duration_days=request.duration_days,
            description=request.description,
            template_protocol=request.template_protocol,
            biomarker_targets=request.biomarker_targets,
            checkpoint_intervals=request.checkpoint_intervals,
            creator_user_id=user_context.user_id,
        )
        return ProgramResponse(**program)
    except Exception as e:
        logger.error(f"Create program failed: {e}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=_FAILED_CREATE_PROGRAM)


@router.get("/programs/{program_id}", response_model=ProgramResponse, summary="Get program")
async def get_program(
    program_id: UUID,
    user_context: UserContext = Depends(require_super_admin),
):
    """
    Get program detail.
    """
    try:
        program = await program_service.get_program(program_id)
        if not program:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=_PROGRAM_NOT_FOUND)
        return ProgramResponse(**program)
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Get program failed: {e}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=_FAILED_FETCH_PROGRAM)


@router.get("/programs", response_model=ProgramListResponse, summary="List programs")
async def list_programs(
    category: Optional[str] = Query(None),
    limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0),
    user_context: UserContext = Depends(get_user_context),
):
    """
    List programs.
    Optionally filter by category.
    """
    try:
        if category:
            programs = await program_service.get_programs_by_category(category)
        else:
            programs = await program_service.get_active_programs()

        # Apply pagination
        programs = programs[offset : offset + limit]
        return ProgramListResponse(items=[ProgramResponse(**p) for p in programs], total=len(programs))
    except Exception as e:
        logger.error(f"List programs failed: {e}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=_FAILED_FETCH_PROGRAMS)


# ============================================================
# CLIENT PROGRAM ENDPOINTS
# ============================================================


@router.post(
    "/client-programs",
    response_model=ClientProgramResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Assign program to client",
)
async def assign_program_to_client(
    request: ClientProgramAssignRequest,
    user_context: UserContext = Depends(require_super_admin),
):
    """
    Assign program to client.
    Enforces single active program per client.
    """
    try:
        assignment = await client_program_service.assign_program(
            request.client_id, request.program_id, request.notes, user_context.user_id
        )
        return ClientProgramResponse(**assignment)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(e))
    except Exception as e:
        logger.error(f"Assign program failed: {e}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=_FAILED_ASSIGN_PROGRAM)


@router.get("/client-programs/{assignment_id}", response_model=ClientProgramResponse, summary="Get program assignment")
async def get_client_program(
    assignment_id: UUID,
    user_context: UserContext = Depends(get_user_context),
):
    """
    Get program assignment detail.
    """
    try:
        assignment = await client_program_service.repo.get_by_id(assignment_id)
        if not assignment:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=_ASSIGNMENT_NOT_FOUND)
        return ClientProgramResponse(**assignment)
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Get assignment failed: {e}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=_FAILED_FETCH_ASSIGNMENT)


@router.post(
    "/client-programs/{assignment_id}/start",
    response_model=ClientProgramResponse,
    summary="Start program",
)
async def start_program(
    assignment_id: UUID,
    user_context: UserContext = Depends(require_super_admin),
):
    """
    Transition program from ONBOARDING to ACTIVE.
    """
    try:
        assignment = await client_program_service.start_program(assignment_id)
        return ClientProgramResponse(**assignment)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(e))
    except Exception as e:
        logger.error(f"Start program failed: {e}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=_FAILED_START_PROGRAM)


@router.post(
    "/client-programs/{assignment_id}/pause",
    response_model=ClientProgramResponse,
    summary="Pause program",
)
async def pause_program(
    assignment_id: UUID,
    user_context: UserContext = Depends(require_super_admin),
):
    """
    Pause active program.
    """
    try:
        assignment = await client_program_service.pause_program(assignment_id)
        return ClientProgramResponse(**assignment)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(e))
    except Exception as e:
        logger.error(f"Pause program failed: {e}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=_FAILED_PAUSE_PROGRAM)


@router.post(
    "/client-programs/{assignment_id}/complete",
    response_model=ClientProgramResponse,
    summary="Complete program",
)
async def complete_program(
    assignment_id: UUID,
    user_context: UserContext = Depends(require_super_admin),
):
    """
    Mark program as completed.
    """
    try:
        assignment = await client_program_service.complete_program(assignment_id)
        return ClientProgramResponse(**assignment)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(e))
    except Exception as e:
        logger.error(f"Complete program failed: {e}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=_FAILED_COMPLETE_PROGRAM)


# ============================================================
# QUESTIONNAIRE ENDPOINTS
# ============================================================


@router.get("/questionnaires/{questionnaire_id}", response_model=QuestionnaireResponse, summary="Get questionnaire")
async def get_questionnaire(
    questionnaire_id: UUID,
    user_context: UserContext = Depends(get_user_context),
):
    """
    Get questionnaire template.
    """
    try:
        questionnaire = await questionnaire_service.get_questionnaire(questionnaire_id)
        if not questionnaire:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=_QUESTIONNAIRE_NOT_FOUND)
        return QuestionnaireResponse(**questionnaire)
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Get questionnaire failed: {e}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=_FAILED_FETCH_QUESTIONNAIRE)


@router.post(
    "/questionnaires/submit",
    response_model=QuestionnaireResultResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Submit questionnaire response",
)
async def submit_questionnaire(
    request: QuestionnaireSubmitRequest,
    user_context: UserContext = Depends(require_end_user),
):
    """
    Submit questionnaire responses.
    Calculates score and stores result.
    Pipeline: responses → validation → scoring → result storage.
    """
    try:
        result = await questionnaire_service.submit_questionnaire(
            request.client_id, request.questionnaire_id, request.responses, user_context.user_id
        )
        return QuestionnaireResultResponse(**result)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(e))
    except Exception as e:
        logger.error(f"Submit questionnaire failed: {e}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=_FAILED_SUBMIT_QUESTIONNAIRE)


# ============================================================
# INTERVENTION ENDPOINTS
# ============================================================


@router.post(
    "/client-programs/{assignment_id}/interventions",
    response_model=InterventionResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create practitioner intervention",
)
async def create_intervention(
    assignment_id: UUID,
    request: InterventionCreateRequest,
    user_context: UserContext = Depends(require_practitioner),
):
    """
    Record practitioner intervention (protocol adjustment).
    Requires practitioner role.
    """
    try:
        await _ensure_practitioner_assigned_to_client_program(assignment_id, user_context)
        intervention = await intervention_service.create_intervention(
            assignment_id,
            user_context.user_id,
            request.change_type,
            request.description,
            request.changes,
            user_context.user_id,
        )
        return InterventionResponse(**intervention)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(e))
    except Exception as e:
        logger.error(f"Create intervention failed: {e}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=_FAILED_CREATE_INTERVENTION)


# ============================================================
# SUBSCRIPTION ENDPOINTS
# ============================================================


@router.get("/subscriptions", response_model=SubscriptionResponse, summary="Get user subscription")
async def get_subscription(
    user_context: UserContext = Depends(require_end_user),
):
    """
    Get active subscription for current user.
    """
    try:
        subscription = await subscription_service.get_subscription(user_context.user_id)
        if not subscription:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=_NO_ACTIVE_SUBSCRIPTION)
        return SubscriptionResponse(**subscription)
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Get subscription failed: {e}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=_FAILED_FETCH_SUBSCRIPTION)


@router.post(
    "/subscriptions",
    response_model=SubscriptionResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create subscription",
)
async def create_subscription(
    request: SubscriptionCreateRequest,
    user_context: UserContext = Depends(require_super_admin),
):
    """
    Create subscription (OPS or user self).
    """
    try:
        subscription = await subscription_service.create_subscription(
            request.user_id,
            request.plan_name.value,
            request.external_subscription_id,
            user_context.user_id,
        )
        return SubscriptionResponse(**subscription)
    except Exception as e:
        logger.error(f"Create subscription failed: {e}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=_FAILED_CREATE_SUBSCRIPTION)


# ============================================================
# CLIENT READ ENDPOINTS (Stage 6 UI)
# ============================================================


@router.get(
    "/clients/{client_id}/questionnaires",
    response_model=list[ClientQuestionnaireHistoryItem],
    summary="Get client questionnaire history",
)
async def get_client_questionnaire_history(
    client_id: UUID,
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    _: dict = Depends(require_client_access),
):
    """Get questionnaire submissions for client timeline."""
    try:
        items = await questionnaire_service.get_client_history(client_id=client_id, limit=limit, offset=offset)
        return [ClientQuestionnaireHistoryItem(**item) for item in items]
    except Exception as e:
        logger.error(f"Get client questionnaire history failed: {e}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=_FAILED_FETCH_QUESTIONNAIRES)


@router.get(
    "/clients/{client_id}/interventions",
    response_model=list[ClientInterventionHistoryItem],
    summary="Get client interventions history",
)
async def get_client_interventions_history(
    client_id: UUID,
    limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0),
    _: dict = Depends(require_client_access),
):
    """Get interventions timeline for client across assignments."""
    try:
        items = await intervention_service.get_client_interventions(client_id=client_id, limit=limit, offset=offset)
        return [ClientInterventionHistoryItem(**item) for item in items]
    except Exception as e:
        logger.error(f"Get client interventions history failed: {e}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=_FAILED_FETCH_INTERVENTIONS)


@router.get(
    "/clients/{client_id}/full",
    response_model=ClientFullResponse,
    summary="Get full client read model",
)
async def get_client_full_view(
    client_id: UUID,
    _: dict = Depends(require_client_access),
):
    """
    Return full client read model in one response for Stage 6 UI.
    """
    try:
        payload = await client_service.get_full_view(client_id)
        if not payload:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=_CLIENT_NOT_FOUND)

        return ClientFullResponse(
            client=ClientResponse(**payload["client"]),
            practitioner=PractitionerResponse(**payload["practitioner"]) if payload.get("practitioner") else None,
            active_program=ProgramResponse(**payload["active_program"]) if payload.get("active_program") else None,
            client_program=ClientProgramResponse(**payload["client_program"]) if payload.get("client_program") else None,
            questionnaires=[QuestionnaireResultResponse(**q) for q in (payload.get("questionnaires") or [])],
            interventions=[InterventionResponse(**i) for i in (payload.get("interventions") or [])],
            subscription=SubscriptionResponse(**payload["subscription"]) if payload.get("subscription") else None,
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Get client full view failed: {e}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=_FAILED_FETCH_FULL_CLIENT_VIEW)


# ============================================================
# AUDIT READ ENDPOINTS (Stage 6 UI)
# ============================================================


@router.get(
    "/audit-logs",
    response_model=AuditLogListResponse,
    summary="List audit logs",
)
async def list_audit_logs(
    limit: int = Query(50, ge=1, le=500),
    offset: int = Query(0, ge=0),
    entity_type: Optional[str] = Query(None),
    user_id: Optional[UUID] = Query(None),
    user_context: UserContext = Depends(require_super_admin),
):
    """
    List audit logs with optional filters.
    """
    try:
        items, total = await audit_log_service.list_logs(
            limit=limit,
            offset=offset,
            entity_type=entity_type,
            user_id=user_id,
        )
        return AuditLogListResponse(
            items=[AuditLogEntry(**item) for item in items],
            total=total,
        )
    except Exception as e:
        logger.error(f"List audit logs failed: {e}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=_FAILED_FETCH_AUDIT_LOGS)

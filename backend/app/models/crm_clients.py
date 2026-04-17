"""
CRM Clients Domain Models (Pydantic Schemas)
Represents client, practitioner, program and related business entities.
"""

from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional, List, Dict, Any
from uuid import UUID
from enum import Enum


# ============================================================
# ENUMS (State Machines & Controlled Values)
# ============================================================

class ClientOnboardingStatus(str, Enum):
    """Explicit state machine for client lifecycle."""
    STARTED = "started"
    QUESTIONNAIRE_PENDING = "questionnaire_pending"
    PROGRAM_ASSIGNED = "program_assigned"
    ACTIVE = "active"
    PAUSED = "paused"
    COMPLETED = "completed"


class ClientProgramStatus(str, Enum):
    """Explicit state machine for program assignment."""
    ONBOARDING = "onboarding"
    ACTIVE = "active"
    PAUSED = "paused"
    COMPLETED = "completed"
    DROPPED = "dropped"


class PractitionerStatus(str, Enum):
    """Availability states for practitioners."""
    ACTIVE = "active"
    INACTIVE = "inactive"
    ONBOARDING = "onboarding"


class ProgramCategory(str, Enum):
    """Program templates by health domain."""
    METABOLIC_OPTIMIZATION = "metabolic-optimization"
    LONGEVITY = "longevity"
    ATHLETIC_PERFORMANCE = "athletic-performance"
    WELLNESS = "wellness"
    CUSTOM = "custom"


class SubscriptionPlan(str, Enum):
    """Subscription tiers."""
    FREE = "free"
    CORE = "core"
    PERSONAL = "personal"


class SubscriptionStatus(str, Enum):
    """Subscription lifecycle."""
    ACTIVE = "active"
    PAUSED = "paused"
    CANCELLED = "cancelled"
    PAST_DUE = "past_due"


class QuestionnaireType(str, Enum):
    """Questionnaire templates."""
    ONBOARDING = "onboarding"
    PROGRESS_CHECK = "progress-check"
    PROGRAM_SPECIFIC = "program-specific"
    SYMPTOM_TRACKER = "symptom-tracker"


# ============================================================
# BASE SCHEMAS (for requests)
# ============================================================

class ClientCreateRequest(BaseModel):
    """Create a client profile (usually auto-generated on signup)."""
    user_id: UUID
    organization_id: Optional[UUID] = None


class ClientUpdateRequest(BaseModel):
    """Update client profile."""
    assigned_practitioner_id: Optional[UUID] = None
    onboarding_status: Optional[ClientOnboardingStatus] = None


class PractitionerCreateRequest(BaseModel):
    """Register a practitioner."""
    user_id: UUID
    specialization: str
    bio: Optional[str] = None
    max_clients: int = 20


class PractitionerAssignRequest(BaseModel):
    """Assign practitioner to client."""
    client_id: UUID
    practitioner_id: UUID


class ProgramCreateRequest(BaseModel):
    """Create a program template (OPS only)."""
    name: str
    description: Optional[str] = None
    category: ProgramCategory
    duration_days: int = Field(gt=0)
    template_protocol: Optional[Dict[str, Any]] = None
    biomarker_targets: Optional[Dict[str, Any]] = None
    checkpoint_intervals: Optional[List[int]] = None


class ClientProgramAssignRequest(BaseModel):
    """Assign program to client."""
    client_id: UUID
    program_id: UUID
    notes: Optional[str] = None


class ClientProgramStatusUpdateRequest(BaseModel):
    """Update program assignment status."""
    status: ClientProgramStatus


class QuestionnaireCreateRequest(BaseModel):
    """Create questionnaire template."""
    name: str
    template_type: QuestionnaireType
    questions: Dict[str, Any] = Field(description="JSON structure of questions")
    scoring_logic: Optional[Dict[str, Any]] = None
    program_id: Optional[UUID] = None


class QuestionnaireSubmitRequest(BaseModel):
    """Submit questionnaire responses."""
    questionnaire_id: UUID
    client_id: UUID
    responses: Dict[str, Any] = Field(description="User answers keyed by question ID")


class InterventionCreateRequest(BaseModel):
    """Practitioner intervention (protocol adjustment)."""
    client_program_id: UUID
    change_type: str  # e.g., "protocol_update", "checkpoint_adjustment"
    description: str
    changes: Dict[str, Any]


class SubscriptionCreateRequest(BaseModel):
    """Create/update subscription."""
    user_id: UUID
    plan_name: SubscriptionPlan
    stripe_subscription_id: Optional[str] = None


# ============================================================
# RESPONSE SCHEMAS (DTO)
# ============================================================

class PractitionerResponse(BaseModel):
    """Practitioner detail."""
    id: UUID
    user_id: UUID
    specialization: str
    bio: Optional[str]
    status: PractitionerStatus
    availability: str
    max_clients: int
    current_clients: int
    created_at: datetime

    class Config:
        from_attributes = True


class ProgramResponse(BaseModel):
    """Program template detail."""
    id: UUID
    name: str
    description: Optional[str]
    category: ProgramCategory
    duration_days: int
    template_protocol: Optional[Dict[str, Any]]
    biomarker_targets: Optional[Dict[str, Any]]
    checkpoint_intervals: Optional[List[int]]
    status: str
    created_at: datetime

    class Config:
        from_attributes = True


class ClientResponse(BaseModel):
    """Client profile detail."""
    id: UUID
    user_id: UUID
    assigned_practitioner_id: Optional[UUID]
    onboarding_status: ClientOnboardingStatus
    active_program_id: Optional[UUID]
    subscription_id: Optional[UUID]
    last_upload_at: Optional[datetime]
    last_check_in_at: Optional[datetime]
    created_at: datetime

    class Config:
        from_attributes = True


class ClientDetailResponse(ClientResponse):
    """Client with related data (practitioner, program)."""
    practitioner: Optional[PractitionerResponse] = None
    active_program: Optional[ProgramResponse] = None


class ClientProgramResponse(BaseModel):
    """Program assignment instance."""
    id: UUID
    client_id: UUID
    program_id: UUID
    status: ClientProgramStatus
    assigned_date: datetime
    started_date: Optional[datetime]
    projected_end_date: Optional[datetime]
    completed_date: Optional[datetime]
    checkpoint_progress: Optional[Dict[str, Any]]
    notes: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True


class QuestionnaireResponse(BaseModel):
    """Questionnaire template."""
    id: UUID
    name: str
    template_type: QuestionnaireType
    questions: Dict[str, Any]
    scoring_logic: Optional[Dict[str, Any]]
    program_id: Optional[UUID]
    status: str
    created_at: datetime

    class Config:
        from_attributes = True


class QuestionnaireResultResponse(BaseModel):
    """Questionnaire completion result."""
    id: UUID
    client_id: UUID
    questionnaire_id: UUID
    responses: Dict[str, Any]
    score: Optional[float]
    result_notes: Optional[str]
    completed_at: datetime

    class Config:
        from_attributes = True


class InterventionResponse(BaseModel):
    """Practitioner intervention record."""
    id: UUID
    client_program_id: UUID
    practitioner_id: UUID
    change_type: str
    description: str
    changes: Dict[str, Any]
    created_at: datetime

    class Config:
        from_attributes = True


class SubscriptionResponse(BaseModel):
    """Subscription detail."""
    id: UUID
    user_id: UUID
    plan_name: SubscriptionPlan
    status: SubscriptionStatus
    stripe_subscription_id: Optional[str]
    current_period_start: Optional[datetime]
    current_period_end: Optional[datetime]
    started_at: datetime
    cancelled_at: Optional[datetime]

    class Config:
        from_attributes = True


# ============================================================
# LIST RESPONSES (Paginated)
# ============================================================

class PaginatedResponse(BaseModel):
    """Generic paginated response."""
    items: List[Any]
    total: int
    limit: int
    offset: int


class ClientListResponse(BaseModel):
    """List of clients."""
    items: List[ClientResponse]
    total: int


class ProgramListResponse(BaseModel):
    """List of programs."""
    items: List[ProgramResponse]
    total: int


class PractitionerListResponse(BaseModel):
    """List of practitioners."""
    items: List[PractitionerResponse]
    total: int


class AuditLogListResponse(BaseModel):
    """List of audit log entries."""
    items: List["AuditLogEntry"]
    total: int


class ClientQuestionnaireHistoryItem(BaseModel):
    """Lightweight questionnaire history record for client timeline."""
    id: UUID
    questionnaire_id: UUID
    score: Optional[float]
    completed_at: datetime


class ClientInterventionHistoryItem(BaseModel):
    """Lightweight intervention history record for client timeline."""
    id: UUID
    client_program_id: UUID
    practitioner_id: Optional[UUID]
    change_type: str
    created_at: datetime


class ClientFullResponse(BaseModel):
    """Aggregated client read model used by Stage 6 UI."""
    client: ClientResponse
    practitioner: Optional[PractitionerResponse] = None
    active_program: Optional[ProgramResponse] = None
    client_program: Optional[ClientProgramResponse] = None
    questionnaires: List[QuestionnaireResultResponse] = []
    interventions: List[InterventionResponse] = []
    subscription: Optional[SubscriptionResponse] = None


# ============================================================
# ERROR RESPONSES
# ============================================================

class ErrorDetail(BaseModel):
    """Standardized error."""
    code: str
    message: str
    detail: Optional[str] = None


# ============================================================
# AUDIT & LOGGING
# ============================================================

class AuditLogEntry(BaseModel):
    """Audit trail entry."""
    id: UUID
    user_id: Optional[UUID]
    action: str  # create, read, update, delete, assign, reassign
    entity_type: str  # client, practitioner, program, subscription, etc.
    entity_id: UUID
    changes: Optional[Dict[str, Any]]
    created_at: datetime

    class Config:
        from_attributes = True

from datetime import datetime
from typing import List, Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class AssignmentCreate(BaseModel):
    practitioner_id: UUID
    client_user_id: UUID
    organization_id: UUID
    notes: Optional[str] = None


class AssignmentResponse(BaseModel):
    id: UUID
    practitioner_id: UUID
    client_user_id: UUID
    organization_id: UUID
    assigned_by: UUID
    status: str
    notes: Optional[str]
    assigned_at: datetime
    activated_at: Optional[datetime]
    completed_at: Optional[datetime]
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class AssignmentListResponse(BaseModel):
    items: List[AssignmentResponse]
    total: int

from pydantic import BaseModel, ConfigDict
from datetime import datetime
from typing import Optional
from uuid import UUID


class OrganizationMemberBase(BaseModel):
    role: str  # org_owner, client_admin, manager, practitioner, support, member
    status: str = "active"


class OrganizationMemberCreate(OrganizationMemberBase):
    user_id: UUID


class OrganizationMemberUpdate(BaseModel):
    role: Optional[str] = None
    status: Optional[str] = None


class OrganizationMember(OrganizationMemberBase):
    id: UUID
    organization_id: UUID
    user_id: UUID
    invited_by: Optional[UUID]
    invited_at: Optional[datetime]
    joined_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class PractitionerAssignmentBase(BaseModel):
    practitioner_id: UUID
    client_id: UUID
    status: str = "active"
    notes: Optional[str] = None


class PractitionerAssignmentCreate(PractitionerAssignmentBase):
    organization_id: UUID


class PractitionerAssigmentUpdate(BaseModel):
    status: Optional[str] = None
    notes: Optional[str] = None


class PractitionerAssignment(PractitionerAssignmentBase):
    id: UUID
    organization_id: UUID
    assigned_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class InvitationBase(BaseModel):
    email: str
    role: str = "member"


class InvitationCreate(InvitationBase):
    organization_id: UUID


class Invitation(InvitationBase):
    id: UUID
    organization_id: UUID
    status: str
    invited_by: Optional[UUID]
    invited_at: datetime
    accepted_by_user_id: Optional[UUID]
    accepted_at: Optional[datetime]
    expires_at: datetime
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)

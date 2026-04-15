from pydantic import BaseModel
from datetime import datetime
from typing import Optional
from uuid import UUID


class OrganizationBase(BaseModel):
    name: str
    slug: str
    status: str = "active"
    description: Optional[str] = None
    logo_url: Optional[str] = None


class OrganizationCreate(OrganizationBase):
    owner_id: UUID


class OrganizationUpdate(BaseModel):
    name: Optional[str] = None
    status: Optional[str] = None
    description: Optional[str] = None
    logo_url: Optional[str] = None


class Organization(OrganizationBase):
    id: UUID
    owner_id: UUID
    owner_name: Optional[str]
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class OrganizationDetail(Organization):
    member_count: int = 0
    practitioner_count: int = 0

from pydantic import BaseModel
from typing import Optional
from uuid import UUID
from datetime import datetime


class UserProfile(BaseModel):
    id: UUID
    email: str
    full_name: Optional[str] = None
    age: Optional[int] = None
    sex: Optional[str] = None
    timezone: str = "America/New_York"
    sub_status: str = "free"
    sub_id: Optional[str] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None


class UserUpdate(BaseModel):
    full_name: Optional[str] = None
    age: Optional[int] = None
    sex: Optional[str] = None
    timezone: Optional[str] = None

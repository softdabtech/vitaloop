from pydantic import BaseModel
from typing import Optional
from uuid import UUID
from datetime import datetime
from enum import Enum


class BiomarkerStatus(str, Enum):
    OPTIMAL = "OPTIMAL"
    BORDERLINE = "BORDERLINE"
    DEFICIENT = "DEFICIENT"
    ELEVATED = "ELEVATED"


class Biomarker(BaseModel):
    id: Optional[UUID] = None
    upload_id: UUID
    user_id: UUID
    name: str
    value: float
    unit: str
    ref_low: Optional[float] = None
    ref_high: Optional[float] = None
    status: BiomarkerStatus
    category: Optional[str] = None
    created_at: Optional[datetime] = None


class BiomarkerCreate(BaseModel):
    upload_id: UUID
    user_id: UUID
    name: str
    value: float
    unit: str
    ref_low: Optional[float] = None
    ref_high: Optional[float] = None
    status: BiomarkerStatus
    category: Optional[str] = None

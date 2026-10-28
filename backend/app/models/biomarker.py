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


class ManualBiomarkerEntryRequest(BaseModel):
    """Single manually entered biomarker value"""
    biomarker_id: str
    value: float
    unit: str
    date: Optional[datetime] = None


class ManualAnalysisRequest(BaseModel):
    """Request to analyze manually entered biomarkers"""
    biomarkers: list[ManualBiomarkerEntryRequest]
    lab_name: Optional[str] = None
    test_date: Optional[datetime] = None
    notes: Optional[str] = None


class BiomarkerOption(BaseModel):
    """Biomarker option for dropdown selection"""
    id: str
    name: str
    category: str
    default_unit: str
    alternative_units: list[str]
    priority: int

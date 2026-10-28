from datetime import date
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field


class PartnerResultIngestRequest(BaseModel):
    partner_slug: str = Field(..., min_length=2, max_length=100)
    external_patient_id: str = Field(..., min_length=1, max_length=191)
    external_order_id: str = Field(..., min_length=1, max_length=191)
    external_result_id: str = Field(..., min_length=1, max_length=191)
    lab_name: Optional[str] = Field(default="smartlab", max_length=100)
    result_date: Optional[date] = None
    lab_result: Dict[str, Any]


class PartnerBiomarkerOut(BaseModel):
    canonical_name: str
    display_name: str
    value: float
    unit: str
    ref_low: Optional[float] = None
    ref_high: Optional[float] = None
    status: str
    category: Optional[str] = None
    confidence: float = 1.0


class PartnerResultIngestResponse(BaseModel):
    partner_lab_result_id: str
    status: str
    insight_id: Optional[str] = None
    duplicate: bool = False
    biomarkers: List[PartnerBiomarkerOut] = Field(default_factory=list)

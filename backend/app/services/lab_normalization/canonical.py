from datetime import date
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field


class CanonicalBiomarker(BaseModel):
    canonical_name: str
    display_name: str
    value: float
    unit: str
    ref_low: Optional[float] = None
    ref_high: Optional[float] = None
    status: str = "OPTIMAL"
    category: Optional[str] = None
    confidence: float = Field(default=1.0, ge=0.0, le=1.0)


class CanonicalLabResult(BaseModel):
    partner_slug: str
    external_patient_id: str
    external_order_id: str
    external_result_id: str
    lab_name: str
    result_date: Optional[date] = None
    biomarkers: List[CanonicalBiomarker] = Field(default_factory=list)
    metadata: Dict[str, Any] = Field(default_factory=dict)

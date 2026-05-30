from typing import Any, Dict, Optional

from pydantic import BaseModel, Field


class PartnerEventIngestRequest(BaseModel):
    event_type: str = Field(..., min_length=3, max_length=64)
    partner_patient_id: Optional[str] = None
    partner_lab_result_id: Optional[str] = None
    event_payload: Dict[str, Any] = Field(default_factory=dict)

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


class EmbeddedSessionCreateRequest(BaseModel):
    partner_patient_id: str = Field(..., min_length=1, max_length=191)
    partner_lab_result_id: str = Field(..., min_length=1, max_length=191)
    ttl_seconds: int = Field(default=900, ge=60, le=3600)


class EmbeddedSessionCreateResponse(BaseModel):
    token: str
    expires_at: datetime


class EmbeddedTokenPrincipal(BaseModel):
    partner_id: str
    partner_patient_id: str
    partner_lab_result_id: str
    session_id: str
    expires_at: datetime
    consumed_at: Optional[datetime] = None

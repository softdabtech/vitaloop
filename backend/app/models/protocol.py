from pydantic import BaseModel
from typing import Optional, List, Any
from uuid import UUID
from datetime import datetime


class ProtocolRecommendation(BaseModel):
    supplement: str
    dosage: str
    timing: str  # morning_with_food | morning_empty | evening | night
    priority: str  # HIGH | MEDIUM | LOW
    rationale: str
    iherb_search: str


class Protocol(BaseModel):
    id: Optional[UUID] = None
    user_id: UUID
    upload_id: UUID
    recommendations: List[ProtocolRecommendation] = []
    created_at: Optional[datetime] = None


class ProtocolCreate(BaseModel):
    user_id: UUID
    upload_id: UUID
    recommendations: List[ProtocolRecommendation]

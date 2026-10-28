from pydantic import BaseModel
from typing import Optional, List
from uuid import UUID
from datetime import datetime

VALID_SYMPTOM_TAGS = [
    "fatigue", "insomnia", "brain_fog", "anxiety", "depression",
    "hair_loss", "weight_gain", "weight_loss", "low_libido",
    "muscle_weakness", "joint_pain", "poor_immunity", "digestive_issues",
    "skin_problems", "mood_swings", "poor_concentration", "cold_intolerance",
]


class Symptom(BaseModel):
    id: Optional[UUID] = None
    user_id: UUID
    upload_id: Optional[UUID] = None
    tags: List[str] = []
    severity: int = 5
    created_at: Optional[datetime] = None


class SymptomCreate(BaseModel):
    user_id: UUID
    upload_id: Optional[UUID] = None
    tags: List[str]
    severity: int = 5

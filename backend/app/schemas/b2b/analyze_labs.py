from __future__ import annotations

from datetime import date, datetime
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field, field_validator


class B2BBiomarkerInput(BaseModel):
    name: str = Field(..., min_length=1, max_length=160)
    value: float
    unit: str = Field(..., min_length=1, max_length=40)
    reference_range: Optional[str] = Field(default=None, max_length=120)
    collected_at: Optional[datetime | date] = None
    lab_name: Optional[str] = Field(default=None, max_length=120)

    @field_validator("name", "unit", "reference_range", "lab_name")
    @classmethod
    def _strip_text(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return None
        stripped = value.strip()
        return stripped or None


class B2BAnalyzeLabsRequest(BaseModel):
    external_user_id: str = Field(..., min_length=1, max_length=191)
    biomarkers: List[B2BBiomarkerInput] = Field(..., min_length=1, max_length=100)
    symptoms: List[str] = Field(default_factory=list, max_length=100)
    questionnaire: Dict[str, Any] = Field(default_factory=dict)
    metadata: Dict[str, Any] = Field(default_factory=dict)
    idempotency_key: Optional[str] = Field(default=None, max_length=191)

    @field_validator("external_user_id", "idempotency_key")
    @classmethod
    def _strip_identifier(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return None
        stripped = value.strip()
        return stripped or None


class PrioritizedBiomarker(BaseModel):
    name: str
    canonical_name: str
    value: float
    unit: str
    status: str
    category: Optional[str] = None
    priority: str
    rationale: str
    reference_range: Optional[str] = None


class RiskFlag(BaseModel):
    type: str
    severity: str
    title: str
    rationale: str
    biomarker: Optional[str] = None
    requires_doctor: bool = False


class B2BProtocolSection(BaseModel):
    nutrition: List[Dict[str, Any]] = Field(default_factory=list)
    supplements: List[Dict[str, Any]] = Field(default_factory=list)
    lifestyle: List[Dict[str, Any]] = Field(default_factory=list)
    training_recovery: List[Dict[str, Any]] = Field(default_factory=list)


class ShoppingLink(BaseModel):
    label: str
    search_query: str
    reason: str
    priority: str = "medium"
    category: str = "supplement"
    url: str
    disclaimer: str


class B2BAnalyzeLabsResponse(BaseModel):
    analysis_id: str
    status: str
    health_summary: Dict[str, Any]
    prioritized_biomarkers: List[PrioritizedBiomarker] = Field(default_factory=list)
    risks_flags: List[RiskFlag] = Field(default_factory=list)
    recommendations: List[Dict[str, Any]] = Field(default_factory=list)
    protocol: B2BProtocolSection = Field(default_factory=B2BProtocolSection)
    shopping_links: List[ShoppingLink] = Field(default_factory=list)
    retest_suggestions: List[Dict[str, Any]] = Field(default_factory=list)
    doctor_summary: str
    knowledge_evaluation: Optional[Dict[str, Any]] = None
    disclaimer: str
    metadata: Dict[str, Any] = Field(default_factory=dict)

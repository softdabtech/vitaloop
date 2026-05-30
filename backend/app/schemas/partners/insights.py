from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field


class PriorityInsight(BaseModel):
    title: str
    rationale: str
    severity: str
    biomarker: Optional[str] = None


class PartnerInsightResponse(BaseModel):
    summary: str
    health_score: int = Field(..., ge=0, le=100)
    priority_insights: List[PriorityInsight] = Field(default_factory=list)
    biomarkers: List[Dict[str, Any]] = Field(default_factory=list)
    recommended_tests: List[Dict[str, Any]] = Field(default_factory=list)
    next_touchpoints: List[str] = Field(default_factory=list)
    doctor_summary: str
    powered_by_vitaloop: Dict[str, Any] = Field(default_factory=lambda: {"enabled": True})

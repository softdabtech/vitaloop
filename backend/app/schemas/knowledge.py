from __future__ import annotations

from datetime import datetime
from typing import Any, Dict, List, Literal, Optional

from pydantic import BaseModel, Field


class KnowledgeLabResultInput(BaseModel):
    value: float
    unit: str


class KnowledgeEvaluateInput(BaseModel):
    lab_results: Dict[str, KnowledgeLabResultInput] = Field(default_factory=dict)
    symptoms: List[str] = Field(default_factory=list)
    context: Dict[str, Any] = Field(default_factory=dict)


class KnowledgeSourceReference(BaseModel):
    source: str = ""
    source_url: str = ""


class KnowledgeSafetyAlert(BaseModel):
    marker: str
    value: float
    unit: str
    requires_doctor: bool
    message: str


class KnowledgeMatchedRule(BaseModel):
    rule_id: str
    rule_key: str
    name: str
    description: str
    risk: Optional[str] = None
    summary: Optional[str] = None
    recommendation_keys: List[str] = Field(default_factory=list)
    confidence: float
    severity: Optional[str] = None
    requires_doctor: bool
    explanation: str
    source: Optional[str] = None
    source_url: Optional[str] = None
    evidence: List[Dict[str, Any]] = Field(default_factory=list)


class KnowledgeRecommendation(BaseModel):
    key: str
    title: str
    body: str
    category: Optional[str] = None
    priority: Optional[str] = None
    requires_doctor: bool = False
    evidence_level: Optional[str] = None
    source: Optional[str] = None
    source_url: Optional[str] = None


class KnowledgeEvaluateResponse(BaseModel):
    matched_rules: List[KnowledgeMatchedRule] = Field(default_factory=list)
    generated_recommendations: List[KnowledgeRecommendation] = Field(default_factory=list)
    requires_doctor: bool = False
    confidence: float = 0.0
    max_confidence: float = 0.0
    source_references: List[KnowledgeSourceReference] = Field(default_factory=list)
    safety_alerts: List[KnowledgeSafetyAlert] = Field(default_factory=list)
    rule_evaluation_ids: List[str] = Field(default_factory=list)


GovernanceStatus = Literal["draft", "reviewed", "active", "deprecated"]


class KnowledgeRuleBasePayload(BaseModel):
    key: str = Field(min_length=1)
    name: str = Field(min_length=1)
    description: Optional[str] = None
    input_entities: List[str] = Field(default_factory=list)
    conditions: Dict[str, Any]
    outputs: Dict[str, Any]
    confidence: float = 0.5
    severity: Optional[str] = None
    requires_doctor: bool = False
    explanation_template: str = Field(min_length=1)
    source: str = Field(min_length=1)
    source_url: str = Field(min_length=1)
    version: str = "v1"
    auto_update_allowed: bool = False


class KnowledgeRuleCreateRequest(KnowledgeRuleBasePayload):
    governance_status: GovernanceStatus = "draft"
    last_modified_by: str = Field(min_length=1)
    change_note: str = Field(min_length=1)


class KnowledgeRulePatchRequest(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    input_entities: Optional[List[str]] = None
    conditions: Optional[Dict[str, Any]] = None
    outputs: Optional[Dict[str, Any]] = None
    confidence: Optional[float] = None
    severity: Optional[str] = None
    requires_doctor: Optional[bool] = None
    explanation_template: Optional[str] = None
    source: Optional[str] = None
    source_url: Optional[str] = None
    version: Optional[str] = None
    auto_update_allowed: Optional[bool] = None
    last_modified_by: str = Field(min_length=1)
    change_note: str = Field(min_length=1)


class KnowledgeRuleSubmitReviewRequest(BaseModel):
    last_modified_by: str = Field(min_length=1)
    change_note: str = Field(min_length=1)


class KnowledgeRuleApproveRequest(BaseModel):
    medical_reviewed_by: str = Field(min_length=1)
    medical_reviewed_at: datetime
    last_modified_by: Optional[str] = None
    change_note: str = Field(min_length=1)


class KnowledgeRuleDeprecateRequest(BaseModel):
    last_modified_by: str = Field(min_length=1)
    change_note: str = Field(min_length=1)


class KnowledgeRuleListItem(BaseModel):
    id: str
    key: str
    name: str
    description: Optional[str] = None
    input_entities: List[str] = Field(default_factory=list)
    confidence: float = 0.0
    severity: Optional[str] = None
    requires_doctor: bool = False
    source: Optional[str] = None
    source_url: Optional[str] = None
    version: Optional[str] = None
    active: bool = False
    governance_status: GovernanceStatus
    last_modified_by: Optional[str] = None
    medical_reviewed_by: Optional[str] = None
    medical_reviewed_at: Optional[datetime] = None
    change_note: Optional[str] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None


class KnowledgeRuleDetail(BaseModel):
    id: str
    key: str
    name: str
    description: Optional[str] = None
    input_entities: List[str] = Field(default_factory=list)
    conditions: Dict[str, Any] = Field(default_factory=dict)
    outputs: Dict[str, Any] = Field(default_factory=dict)
    confidence: float = 0.0
    severity: Optional[str] = None
    requires_doctor: bool = False
    explanation_template: str
    source: Optional[str] = None
    source_url: Optional[str] = None
    governance_status: GovernanceStatus
    last_modified_by: Optional[str] = None
    medical_reviewed_by: Optional[str] = None
    medical_reviewed_at: Optional[datetime] = None
    change_note: Optional[str] = None
    auto_update_allowed: bool = False
    version: Optional[str] = None
    active: bool = False
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None


class KnowledgeRuleAuditEntry(BaseModel):
    id: str
    user_id: Optional[str] = None
    action: str
    entity_type: str
    entity_id: Optional[str] = None
    old_value: Dict[str, Any] = Field(default_factory=dict)
    new_value: Dict[str, Any] = Field(default_factory=dict)
    timestamp: Optional[datetime] = None

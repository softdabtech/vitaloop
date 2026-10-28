"""Deterministic internal red-flag rule evaluator.

The evaluator operates only on stable concept IDs and approved rules. This
module intentionally ships without active clinical rules: proposed rules must
pass clinical review before they can affect user safety decisions.
"""

from collections.abc import Iterable, Mapping
from typing import Any, Literal

from pydantic import BaseModel, Field

from app.services.symptom_safety_policy import SymptomSafetyLevel


class RedFlagRule(BaseModel):
    id: str = Field(..., min_length=3, max_length=100)
    required_present_ids: frozenset[str] = Field(..., min_length=1)
    safety_level: Literal["emergency", "urgent_24h", "clinician_review"]
    review_status: Literal["draft", "clinical_review", "approved", "retired"] = "draft"
    evidence_reference: str = Field(..., min_length=3)


class InternalRedFlagDecision(BaseModel):
    level: SymptomSafetyLevel
    interrupt: bool
    matched_rule_ids: list[str]
    evaluated_approved_rule_count: int


_RANK = {
    SymptomSafetyLevel.ROUTINE: 0,
    SymptomSafetyLevel.CLINICIAN_REVIEW: 1,
    SymptomSafetyLevel.URGENT_24H: 2,
    SymptomSafetyLevel.EMERGENCY: 3,
}


# Rules move here only after their exact concepts, urgency, source, reviewer,
# and review date are approved in the clinical review matrix.
APPROVED_INTERNAL_RED_FLAG_RULES: tuple[RedFlagRule, ...] = ()


def evaluate_internal_red_flags(
    evidence: Iterable[Mapping[str, Any]],
    *,
    rules: Iterable[RedFlagRule] = APPROVED_INTERNAL_RED_FLAG_RULES,
) -> InternalRedFlagDecision:
    present_ids = {
        str(item.get("vitaloop_concept_id") or "")
        for item in evidence
        if item.get("choice_id") == "present"
    }
    approved_rules = [rule for rule in rules if rule.review_status == "approved"]
    matched = [rule for rule in approved_rules if rule.required_present_ids <= present_ids]
    if not matched:
        return InternalRedFlagDecision(
            level=SymptomSafetyLevel.ROUTINE,
            interrupt=False,
            matched_rule_ids=[],
            evaluated_approved_rule_count=len(approved_rules),
        )

    level = max((SymptomSafetyLevel(rule.safety_level) for rule in matched), key=_RANK.__getitem__)
    return InternalRedFlagDecision(
        level=level,
        interrupt=level == SymptomSafetyLevel.EMERGENCY,
        matched_rule_ids=sorted(rule.id for rule in matched),
        evaluated_approved_rule_count=len(approved_rules),
    )

from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query

from app.dependencies import get_current_user
from app.dependencies_crm import UserContext, require_super_admin
from app.schemas.knowledge import (
    KnowledgeEvaluateInput,
    KnowledgeEvaluateResponse,
    KnowledgeRecommendationDetail,
    KnowledgeRecommendationListItem,
    KnowledgeRuleApproveRequest,
    KnowledgeRuleAuditEntry,
    KnowledgeRuleCreateDraftCopyRequest,
    KnowledgeRuleCreateRequest,
    KnowledgeRuleDeprecateRequest,
    KnowledgeRuleDetail,
    KnowledgeRuleListItem,
    KnowledgeRulePatchRequest,
    KnowledgeRuleSubmitReviewRequest,
)
from app.services.knowledge import (
    approve_rule,
    create_draft_copy,
    create_rule,
    deprecate_rule,
    get_recommendation,
    evaluate_health_input,
    get_rule,
    get_rule_audit,
    list_recommendations,
    list_rules,
    submit_rule_review,
    update_rule,
)

router = APIRouter(prefix="/knowledge", tags=["knowledge"])


@router.post("/evaluate", response_model=KnowledgeEvaluateResponse)
async def evaluate_knowledge(
    payload: KnowledgeEvaluateInput,
    current_user: dict = Depends(get_current_user),
) -> KnowledgeEvaluateResponse:
    user_id = str(current_user.get("sub") or "")
    result = await evaluate_health_input(payload.model_dump(mode="json"), user_id=user_id, persist=True)
    return KnowledgeEvaluateResponse.model_validate(result)


@router.get("/rules", response_model=list[KnowledgeRuleListItem])
async def list_knowledge_rules(
    governance_status: Optional[str] = Query(default=None),
    active: Optional[bool] = Query(default=None),
    key: Optional[str] = Query(default=None),
    source: Optional[str] = Query(default=None),
    requires_doctor: Optional[bool] = Query(default=None),
    _: UserContext = Depends(require_super_admin),
) -> list[KnowledgeRuleListItem]:
    rows = await list_rules(
        governance_status=governance_status,
        active=active,
        key=key,
        source=source,
        requires_doctor=requires_doctor,
    )
    return [KnowledgeRuleListItem.model_validate(row) for row in rows]


@router.get("/rules/{rule_id}", response_model=KnowledgeRuleDetail)
async def get_knowledge_rule(
    rule_id: str,
    _: UserContext = Depends(require_super_admin),
) -> KnowledgeRuleDetail:
    row = await get_rule(rule_id)
    return KnowledgeRuleDetail.model_validate(row)


@router.post("/rules", response_model=KnowledgeRuleDetail)
async def create_knowledge_rule(
    payload: KnowledgeRuleCreateRequest,
    user_context: UserContext = Depends(require_super_admin),
) -> KnowledgeRuleDetail:
    if payload.governance_status != "draft":
        raise HTTPException(status_code=400, detail="New knowledge rule must be draft")

    created = await create_rule(payload.model_dump(mode="json"), actor_user_id=str(user_context.user_id))
    return KnowledgeRuleDetail.model_validate(created)


@router.patch("/rules/{rule_id}", response_model=KnowledgeRuleDetail)
async def patch_knowledge_rule(
    rule_id: str,
    payload: KnowledgeRulePatchRequest,
    user_context: UserContext = Depends(require_super_admin),
) -> KnowledgeRuleDetail:
    updated = await update_rule(rule_id, payload.model_dump(mode="json", exclude_none=True), actor_user_id=str(user_context.user_id))
    return KnowledgeRuleDetail.model_validate(updated)


@router.post("/rules/{rule_id}/submit-review", response_model=KnowledgeRuleDetail)
async def submit_knowledge_rule_review(
    rule_id: str,
    payload: KnowledgeRuleSubmitReviewRequest,
    user_context: UserContext = Depends(require_super_admin),
) -> KnowledgeRuleDetail:
    updated = await submit_rule_review(rule_id, payload.model_dump(mode="json"), actor_user_id=str(user_context.user_id))
    return KnowledgeRuleDetail.model_validate(updated)


@router.post("/rules/{rule_id}/approve", response_model=KnowledgeRuleDetail)
async def approve_knowledge_rule(
    rule_id: str,
    payload: KnowledgeRuleApproveRequest,
    user_context: UserContext = Depends(require_super_admin),
) -> KnowledgeRuleDetail:
    updated = await approve_rule(rule_id, payload.model_dump(mode="json", exclude_none=True), actor_user_id=str(user_context.user_id))
    return KnowledgeRuleDetail.model_validate(updated)


@router.post("/rules/{rule_id}/deprecate", response_model=KnowledgeRuleDetail)
async def deprecate_knowledge_rule(
    rule_id: str,
    payload: KnowledgeRuleDeprecateRequest,
    user_context: UserContext = Depends(require_super_admin),
) -> KnowledgeRuleDetail:
    updated = await deprecate_rule(rule_id, payload.model_dump(mode="json"), actor_user_id=str(user_context.user_id))
    return KnowledgeRuleDetail.model_validate(updated)


@router.post("/rules/{rule_id}/create-draft-copy", response_model=KnowledgeRuleDetail)
async def create_knowledge_rule_draft_copy(
    rule_id: str,
    payload: KnowledgeRuleCreateDraftCopyRequest,
    user_context: UserContext = Depends(require_super_admin),
) -> KnowledgeRuleDetail:
    created = await create_draft_copy(rule_id, payload.model_dump(mode="json"), actor_user_id=str(user_context.user_id))
    return KnowledgeRuleDetail.model_validate(created)


@router.get("/rules/{rule_id}/audit", response_model=list[KnowledgeRuleAuditEntry])
async def get_knowledge_rule_audit(
    rule_id: str,
    limit: int = Query(default=200, ge=1, le=500),
    _: UserContext = Depends(require_super_admin),
) -> list[KnowledgeRuleAuditEntry]:
    rows = await get_rule_audit(rule_id, limit=limit)
    return [KnowledgeRuleAuditEntry.model_validate(row) for row in rows]


@router.get("/recommendations", response_model=list[KnowledgeRecommendationListItem])
async def list_knowledge_recommendations(
    _: UserContext = Depends(require_super_admin),
) -> list[KnowledgeRecommendationListItem]:
    rows = await list_recommendations()
    return [KnowledgeRecommendationListItem.model_validate(row) for row in rows]


@router.get("/recommendations/{recommendation_id}", response_model=KnowledgeRecommendationDetail)
async def get_knowledge_recommendation(
    recommendation_id: str,
    _: UserContext = Depends(require_super_admin),
) -> KnowledgeRecommendationDetail:
    row = await get_recommendation(recommendation_id)
    return KnowledgeRecommendationDetail.model_validate(row)

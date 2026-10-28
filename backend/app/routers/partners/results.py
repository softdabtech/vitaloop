from fastapi import APIRouter, Depends, HTTPException

from app.schemas.partners.insights import PartnerInsightResponse
from app.services.partners.auth import PartnerPrincipal, require_partner_scope
from app.services.partners.gateway import get_partner_insight

router = APIRouter(prefix="/partners", tags=["partners-results"])


@router.get("/v1/results/{partner_lab_result_id}/insights", response_model=PartnerInsightResponse)
async def get_result_insight(
    partner_lab_result_id: str,
    principal: PartnerPrincipal = Depends(require_partner_scope("results:read")),
):
    row = await get_partner_insight(principal.partner_id, partner_lab_result_id)
    if not row:
        raise HTTPException(status_code=404, detail="Insight not found")

    payload = row.get("insight_payload") if isinstance(row.get("insight_payload"), dict) else {}
    return PartnerInsightResponse.model_validate(payload)

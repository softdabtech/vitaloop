from fastapi import APIRouter, Depends, HTTPException

from app.schemas.partners.results import PartnerResultIngestRequest, PartnerResultIngestResponse
from app.services.partners.auth import PartnerPrincipal, require_partner_scope
from app.services.partners.gateway import ingest_partner_result

router = APIRouter(prefix="/partners", tags=["partners-gateway"])


@router.post("/v1/results", response_model=PartnerResultIngestResponse)
async def ingest_lab_result(
    payload: PartnerResultIngestRequest,
    principal: PartnerPrincipal = Depends(require_partner_scope("results:write")),
):
    if payload.partner_slug.strip().lower() != principal.partner_slug.strip().lower():
        raise HTTPException(status_code=403, detail="partner_slug does not match key owner")
    return await ingest_partner_result(payload, principal)

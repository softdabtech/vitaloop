from fastapi import APIRouter, Depends, Header, HTTPException

from app.schemas.partners.embedded import EmbeddedSessionCreateRequest, EmbeddedSessionCreateResponse
from app.schemas.partners.insights import PartnerInsightResponse
from app.services.partners.auth import PartnerPrincipal, require_partner_scope
from app.services.partners.embedded_sessions import (
    create_embedded_session_token,
    resolve_embedded_token,
    resolve_partner_patient_id,
)
from app.services.partners.gateway import get_partner_insight
from app.services.partners.events import track_partner_event

router = APIRouter(prefix="/partners", tags=["partners-embedded"])


@router.post("/v1/embedded-sessions", response_model=EmbeddedSessionCreateResponse)
async def create_embedded_session(
    payload: EmbeddedSessionCreateRequest,
    principal: PartnerPrincipal = Depends(require_partner_scope("embedded:create")),
):
    patient_id = await resolve_partner_patient_id(principal.partner_id, payload.partner_patient_id)
    if not patient_id:
        raise HTTPException(status_code=404, detail="Partner patient not found")

    session = await create_embedded_session_token(
        partner_id=principal.partner_id,
        partner_patient_id=patient_id,
        partner_lab_result_id=payload.partner_lab_result_id,
        ttl_seconds=payload.ttl_seconds,
    )
    return EmbeddedSessionCreateResponse(token=session["token"], expires_at=session["expires_at"])


@router.get("/embed/{token}", response_model=PartnerInsightResponse)
async def get_embedded_insight(token: str, x_partner_context: str | None = Header(default=None, alias="X-Partner-Context")):
    principal = await resolve_embedded_token(token)
    if not principal:
        raise HTTPException(status_code=401, detail="Invalid or expired embedded token")

    row = await get_partner_insight(principal.partner_id, principal.partner_lab_result_id)
    if not row:
        raise HTTPException(status_code=404, detail="Insight not found")

    await track_partner_event(
        partner_id=principal.partner_id,
        event_type="embedded_view_opened",
        partner_patient_id=principal.partner_patient_id,
        partner_lab_result_id=principal.partner_lab_result_id,
        event_payload={"context": x_partner_context or "embedded"},
    )

    payload = row.get("insight_payload") if isinstance(row.get("insight_payload"), dict) else {}
    return PartnerInsightResponse.model_validate(payload)

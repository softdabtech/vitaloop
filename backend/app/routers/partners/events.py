from fastapi import APIRouter, Depends, Header, HTTPException

from app.schemas.partners.events import PartnerEventIngestRequest
from app.services.partners.auth import PartnerPrincipal, require_partner_scope
from app.services.partners.embedded_sessions import resolve_embedded_token
from app.services.partners.events import track_partner_event

router = APIRouter(prefix="/partners", tags=["partners-events"])


@router.post("/v1/events")
async def ingest_partner_event(
    payload: PartnerEventIngestRequest,
    principal: PartnerPrincipal = Depends(require_partner_scope("events:write")),
):
    try:
        row = await track_partner_event(
            partner_id=principal.partner_id,
            event_type=payload.event_type,
            partner_patient_id=payload.partner_patient_id,
            partner_lab_result_id=payload.partner_lab_result_id,
            event_payload=payload.event_payload,
        )
    except ValueError as ex:
        raise HTTPException(status_code=422, detail=str(ex))
    return {"ok": True, "event": row}


@router.post("/v1/embedded/events")
async def ingest_embedded_event(
    payload: PartnerEventIngestRequest,
    x_embedded_token: str | None = Header(default=None, alias="X-Embedded-Token"),
):
    principal = await resolve_embedded_token(x_embedded_token or "")
    if not principal:
        raise HTTPException(status_code=401, detail="Missing or invalid embedded token")

    try:
        row = await track_partner_event(
            partner_id=principal.partner_id,
            event_type=payload.event_type,
            partner_patient_id=principal.partner_patient_id,
            partner_lab_result_id=principal.partner_lab_result_id,
            event_payload=payload.event_payload,
        )
    except ValueError as ex:
        raise HTTPException(status_code=422, detail=str(ex))
    return {"ok": True, "event": row}

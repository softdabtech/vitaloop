from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends, Header, Request

from app.schemas.b2b.analyze_labs import B2BAnalyzeLabsRequest, B2BAnalyzeLabsResponse
from app.services.b2b.analyze_labs import analyze_labs_for_partner
from app.services.partners.auth import PartnerPrincipal, require_partner_scope

router = APIRouter(tags=["b2b"])


async def _analyze_labs_impl(
    request: Request,
    payload: B2BAnalyzeLabsRequest,
    principal: PartnerPrincipal,
    idempotency_key: Optional[str],
):
    return await analyze_labs_for_partner(
        request=payload,
        principal=principal,
        idempotency_key=idempotency_key,
        request_headers=dict(request.headers),
        client_host=request.client.host if request.client else None,
        api_version="v1",
    )


@router.post("/v1/b2b/analyze-labs", response_model=B2BAnalyzeLabsResponse)
async def analyze_labs(
    request: Request,
    payload: B2BAnalyzeLabsRequest,
    principal: PartnerPrincipal = Depends(require_partner_scope("labs:analyze")),
    idempotency_key: Optional[str] = Header(default=None, alias="X-Idempotency-Key"),
):
    return await _analyze_labs_impl(
        request=request,
        payload=payload,
        principal=principal,
        idempotency_key=idempotency_key,
    )


@router.post("/b2b/analyze-labs", response_model=B2BAnalyzeLabsResponse)
async def analyze_labs_legacy_alias(
    request: Request,
    payload: B2BAnalyzeLabsRequest,
    principal: PartnerPrincipal = Depends(require_partner_scope("labs:analyze")),
    idempotency_key: Optional[str] = Header(default=None, alias="X-Idempotency-Key"),
):
    return await _analyze_labs_impl(
        request=request,
        payload=payload,
        principal=principal,
        idempotency_key=idempotency_key,
    )

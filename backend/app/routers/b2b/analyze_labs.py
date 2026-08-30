from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends, Header, Request, Response

from app.schemas.b2b.analyze_labs import B2BAnalyzeLabsRequest, B2BAnalyzeLabsResponse
from app.services.b2b.analyze_labs import analyze_labs_for_partner
from app.services.partners.auth import PartnerPrincipal, require_partner_scope

router = APIRouter(tags=["b2b"])

B2B_API_VERSION = "v1"
B2B_LEGACY_ALIAS_SUNSET = "Wed, 30 Sep 2026 00:00:00 GMT"


def _set_b2b_response_headers(response: Response, *, legacy_alias: bool = False) -> None:
    response.headers["X-Vitaloop-API-Version"] = B2B_API_VERSION
    response.headers["Cache-Control"] = "no-store"
    response.headers["X-Content-Type-Options"] = "nosniff"
    if legacy_alias:
        response.headers["Deprecation"] = "true"
        response.headers["Sunset"] = B2B_LEGACY_ALIAS_SUNSET
        response.headers["Link"] = '</v1/b2b/analyze-labs>; rel="successor-version"'


async def _analyze_labs_impl(
    request: Request,
    response: Response,
    payload: B2BAnalyzeLabsRequest,
    principal: PartnerPrincipal,
    idempotency_key: Optional[str],
    *,
    legacy_alias: bool = False,
):
    _set_b2b_response_headers(response, legacy_alias=legacy_alias)
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
    response: Response,
    payload: B2BAnalyzeLabsRequest,
    principal: PartnerPrincipal = Depends(require_partner_scope("labs:analyze")),
    idempotency_key: Optional[str] = Header(default=None, alias="X-Idempotency-Key"),
):
    return await _analyze_labs_impl(
        request=request,
        response=response,
        payload=payload,
        principal=principal,
        idempotency_key=idempotency_key,
    )


@router.post("/b2b/analyze-labs", response_model=B2BAnalyzeLabsResponse)
async def analyze_labs_legacy_alias(
    request: Request,
    response: Response,
    payload: B2BAnalyzeLabsRequest,
    principal: PartnerPrincipal = Depends(require_partner_scope("labs:analyze")),
    idempotency_key: Optional[str] = Header(default=None, alias="X-Idempotency-Key"),
):
    return await _analyze_labs_impl(
        request=request,
        response=response,
        payload=payload,
        principal=principal,
        idempotency_key=idempotency_key,
        legacy_alias=True,
    )

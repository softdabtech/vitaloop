from __future__ import annotations

import hashlib
from datetime import datetime, timezone
from typing import Any, Dict, Optional

from fastapi import Depends, Header, HTTPException
from pydantic import BaseModel

from app.models.partners.constants import PARTNER_API_SCOPES
from app.services import supabase_service as supabase


class PartnerPrincipal(BaseModel):
    partner_id: str
    partner_slug: str
    key_id: str
    key_prefix: str = ""
    key_label: str = ""
    scopes: list[str] = []
    allowed_ips: list[str] = []
    require_cloudflare: bool = False

    def has_scope(self, scope: str) -> bool:
        normalized = (scope or "").strip().lower()
        own = {str(s).strip().lower() for s in (self.scopes or [])}
        return normalized in own or "*" in own


def hash_partner_api_key(raw_key: str) -> str:
    return hashlib.sha256(raw_key.encode("utf-8")).hexdigest()


def _is_expired(expires_at: Optional[str]) -> bool:
    if not expires_at:
        return False
    try:
        dt = datetime.fromisoformat(expires_at.replace("Z", "+00:00"))
    except ValueError:
        return True
    return dt < datetime.now(timezone.utc)


async def _fetch_partner_key_record(key_hash: str) -> Optional[Dict[str, Any]]:
    client = supabase._get_supabase()
    response = await supabase._run(
        lambda: client.table("partner_api_keys")
        .select("id,partner_id,key_hash,key_prefix,key_label,status,expires_at,scopes")
        .eq("key_hash", key_hash)
        .eq("status", "active")
        .limit(1)
        .execute()
    )
    rows = response.data or []
    return rows[0] if rows else None


async def _fetch_partner(partner_id: str) -> Optional[Dict[str, Any]]:
    client = supabase._get_supabase()
    response = await supabase._run(
        lambda: client.table("partners")
        .select("id,slug,status,b2b_allowed_ips,b2b_require_cloudflare")
        .eq("id", partner_id)
        .eq("status", "active")
        .limit(1)
        .execute()
    )
    rows = response.data or []
    return rows[0] if rows else None


async def resolve_partner_from_api_key(api_key: str) -> PartnerPrincipal:
    normalized = (api_key or "").strip()
    if not normalized:
        raise HTTPException(status_code=401, detail="Missing partner API key")

    key_hash = hash_partner_api_key(normalized)
    key_record = await _fetch_partner_key_record(key_hash)
    if not key_record:
        raise HTTPException(status_code=401, detail="Invalid partner API key")

    if _is_expired(key_record.get("expires_at")):
        raise HTTPException(status_code=401, detail="Expired partner API key")

    partner = await _fetch_partner(str(key_record["partner_id"]))
    if not partner:
        raise HTTPException(status_code=403, detail="Partner is not active")

    scopes = key_record.get("scopes") if isinstance(key_record.get("scopes"), list) else []
    normalized_scopes = [str(s).strip().lower() for s in scopes if str(s).strip()]
    unknown_scopes = [s for s in normalized_scopes if s not in PARTNER_API_SCOPES and s != "*"]
    if unknown_scopes:
        raise HTTPException(status_code=403, detail="API key contains unsupported scope")

    return PartnerPrincipal(
        partner_id=str(partner["id"]),
        partner_slug=str(partner.get("slug") or ""),
        key_id=str(key_record["id"]),
        key_prefix=str(key_record.get("key_prefix") or ""),
        key_label=str(key_record.get("key_label") or ""),
        scopes=normalized_scopes,
        allowed_ips=[str(item).strip() for item in (partner.get("b2b_allowed_ips") if isinstance(partner.get("b2b_allowed_ips"), list) else []) if str(item).strip()],
        require_cloudflare=bool(partner.get("b2b_require_cloudflare")),
    )


async def require_partner_api_key(
    x_partner_api_key: Optional[str] = Header(default=None, alias="X-Partner-Api-Key"),
) -> PartnerPrincipal:
    return await resolve_partner_from_api_key(x_partner_api_key or "")


def require_scope(principal: PartnerPrincipal, required_scope: str) -> None:
    if not principal.has_scope(required_scope):
        raise HTTPException(status_code=403, detail=f"Missing required scope: {required_scope}")


def require_partner_scope(required_scope: str):
    async def _dependency(principal: PartnerPrincipal = Depends(require_partner_api_key)) -> PartnerPrincipal:
        require_scope(principal, required_scope)
        return principal

    return _dependency


PartnerPrincipalDep = Depends(require_partner_api_key)

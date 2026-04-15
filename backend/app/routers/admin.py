from fastapi import APIRouter, Depends, HTTPException
from app.dependencies import get_current_user
from app.services import supabase_service as svc

router = APIRouter()


def _require_super_admin(current_user: dict = Depends(get_current_user)) -> dict:
    user_meta = current_user.get("user_metadata") or {}
    app_meta = current_user.get("app_metadata") or {}
    is_super_admin = user_meta.get("is_super_admin") or app_meta.get("is_super_admin")
    if not is_super_admin:
        raise HTTPException(
            status_code=403,
            detail={"detail": "Access denied", "code": "ACCESS_DENIED"},
        )
    return current_user


@router.get("/overview")
async def admin_overview(current_user: dict = Depends(_require_super_admin)):
    return await svc.get_admin_overview()


@router.get("/users")
async def admin_users(_: dict = Depends(_require_super_admin)):
    return await svc.get_all_users_for_admin()


@router.get("/users/{user_id}")
async def admin_user_detail(user_id: str, _: dict = Depends(_require_super_admin)):
    return await svc.get_admin_user_detail(user_id)


@router.get("/platform-overview")
async def admin_platform_overview(_: dict = Depends(_require_super_admin)):
    return await svc.get_platform_overview()


@router.get("/funnel-overview")
async def admin_funnel_overview(days: int = 30, _: dict = Depends(_require_super_admin)):
    safe_days = max(1, min(days, 365))
    return await svc.get_funnel_overview(days=safe_days)


@router.get("/audit-logs")
async def admin_audit_logs(
    limit: int = 200,
    organization_id: str | None = None,
    _: dict = Depends(_require_super_admin),
):
    safe_limit = max(1, min(limit, 1000))
    return await svc.get_audit_logs(limit=safe_limit, organization_id=organization_id)


@router.get("/red-flags")
async def admin_red_flags(acknowledged: bool = False, _: dict = Depends(_require_super_admin)):
    return await svc.get_all_red_flags(acknowledged=acknowledged)


@router.post("/red-flags/{flag_id}/acknowledge")
async def admin_acknowledge_flag(flag_id: str, current: dict = Depends(_require_super_admin)):
    from app.services.supabase_service import _get_supabase, _run
    from datetime import datetime, timezone
    supabase = _get_supabase()
    resp = await _run(
        lambda: supabase.table("red_flag_events")
        .update({
            "acknowledged": True,
            "acknowledged_at": datetime.now(timezone.utc).isoformat(),
            "acknowledged_by": current.get("sub", "admin"),
        })
        .eq("id", flag_id)
        .execute()
    )
    return resp.data[0] if resp.data else {}

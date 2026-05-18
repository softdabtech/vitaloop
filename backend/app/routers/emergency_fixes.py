"""
Emergency fix endpoints for production issues.
Only accessible with admin credentials.
"""

from fastapi import APIRouter, Depends, HTTPException, status
from typing import Dict, Any
from datetime import datetime

from app.dependencies import get_current_user
from app.services import supabase_service as svc

router = APIRouter(prefix="/emergency", tags=["emergency-fixes"])


async def require_super_admin(current_user: dict = Depends(get_current_user)) -> dict:
    """Verify super admin access"""
    is_super_admin = bool(
        current_user.get("app_metadata", {}).get("is_super_admin")
        or current_user.get("user_metadata", {}).get("is_super_admin")
    )
    if not is_super_admin:
        raise HTTPException(status_code=403, detail="Super admin access required")
    return current_user


@router.post("/fix-super-admin/{email}")
async def fix_super_admin(
    email: str,
    _admin: dict = Depends(require_super_admin),
) -> Dict[str, Any]:
    """
    Emergency: Add is_super_admin flag to user via backend.
    
    Usage: POST /emergency/fix-super-admin/bombela1988@gmail.com
    """
    try:
        supabase = svc._get_supabase()
        service_role_key = svc.settings.supabase_service_role_key or svc.settings.supabase_service_key
        
        if not service_role_key:
            raise HTTPException(
                status_code=500,
                detail="Service role key not configured on server"
            )
        
        # Get user by email
        user_resp = await svc._run(
            lambda: supabase.table("users").select("*").eq("email", email).limit(1).execute()
        )
        
        if not user_resp.data:
            raise HTTPException(status_code=404, detail=f"User not found: {email}")
        
        user_id = user_resp.data[0]["id"]
        
        # Note: Direct update to auth.users requires admin API.
        # This is a limitation - we can only update public.users table.
        # For auth.users, must use Supabase admin dashboard or admin API directly.
        
        # Update public.users with flag
        await svc._run(
            lambda: supabase.table("users").update({
                "global_role": "super_admin"
            }).eq("id", user_id).execute()
        )
        
        return {
            "status": "partial_success",
            "message": "Updated public.users with global_role=super_admin. For full auth metadata fix, use Supabase admin dashboard.",
            "user_id": user_id,
            "email": email,
            "note": "To complete: Visit auth.users in Supabase and set app_metadata.is_super_admin=true"
        }
    
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/fix-subscription/{email}")
async def fix_subscription(
    email: str,
    plan_name: str = "premium",
    _admin: dict = Depends(require_super_admin),
) -> Dict[str, Any]:
    """
    Emergency: Fix subscription status for user.
    
    Usage: POST /emergency/fix-subscription/a@a.com?plan_name=premium
    """
    try:
        supabase = svc._get_supabase()
        
        # Get user
        user_resp = await svc._run(
            lambda: supabase.table("users").select("id").eq("email", email).limit(1).execute()
        )
        
        if not user_resp.data:
            raise HTTPException(status_code=404, detail=f"User not found: {email}")
        
        user_id = user_resp.data[0]["id"]
        
        # Get current subscription
        sub_resp = await svc._run(
            lambda: supabase.table("subscriptions")\
                .select("*")\
                .eq("user_id", user_id)\
                .order("updated_at", desc=True)\
                .limit(1)\
                .execute()
        )
        
        if not sub_resp.data:
            raise HTTPException(status_code=404, detail=f"No subscription found for user: {email}")
        
        sub = sub_resp.data[0]
        sub_id = sub["id"]
        
        old_status = {
            "status": sub.get("status"),
            "plan_name": sub.get("plan_name"),
            "cancel_at_period_end": sub.get("cancel_at_period_end"),
        }
        
        # Fix subscription
        update_resp = await svc._run(
            lambda: supabase.table("subscriptions").update({
                "status": "active",
                "plan_name": plan_name,
                "cancel_at_period_end": False,
                "updated_at": datetime.utcnow().isoformat() + "Z",
            }).eq("id", sub_id).execute()
        )
        
        if not update_resp.data:
            raise HTTPException(status_code=500, detail="Failed to update subscription")
        
        new_status = {
            "status": update_resp.data[0].get("status"),
            "plan_name": update_resp.data[0].get("plan_name"),
            "cancel_at_period_end": update_resp.data[0].get("cancel_at_period_end"),
        }
        
        return {
            "status": "success",
            "message": "Subscription fixed",
            "user_id": user_id,
            "email": email,
            "subscription_id": sub_id,
            "old": old_status,
            "new": new_status,
        }
    
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/check-user/{email}")
async def check_user(
    email: str,
    _admin: dict = Depends(require_super_admin),
) -> Dict[str, Any]:
    """
    Check user status and subscription.
    """
    try:
        supabase = svc._get_supabase()
        
        # Get user
        user_resp = await svc._run(
            lambda: supabase.table("users").select("*").eq("email", email).limit(1).execute()
        )
        
        if not user_resp.data:
            raise HTTPException(status_code=404, detail=f"User not found: {email}")
        
        user = user_resp.data[0]
        user_id = user["id"]
        
        # Get subscription
        sub_resp = await svc._run(
            lambda: supabase.table("subscriptions")\
                .select("*")\
                .eq("user_id", user_id)\
                .order("updated_at", desc=True)\
                .limit(1)\
                .execute()
        )
        
        return {
            "user": {
                "id": user_id,
                "email": user.get("email"),
                "global_role": user.get("global_role"),
                "created_at": user.get("created_at"),
            },
            "subscription": sub_resp.data[0] if sub_resp.data else None,
        }
    
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

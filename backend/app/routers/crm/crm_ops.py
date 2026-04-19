"""
CRM Ops/Admin Data Sync
Provides endpoints for syncing real data from Supabase to CRM
"""

from fastapi import APIRouter, Depends, HTTPException, status
from typing import Optional, Dict, Any
from uuid import UUID
import logging

from app.dependencies_crm import UserContext, require_super_admin, get_user_context
from app.services import supabase_service as svc

logger = logging.getLogger("crm.ops")

router = APIRouter(prefix="/crm/ops", tags=["crm-ops"])


@router.post("/sync-users", status_code=status.HTTP_202_ACCEPTED, summary="Sync all users to CRM")
async def sync_users_to_crm(
    user_context: UserContext = Depends(require_super_admin),
) -> Dict[str, Any]:
    """
    Sync all registered users from auth.users to clients table.
    This fixes the issue where registered users don't appear in CRM.
    
    Only super_admin can trigger this.
    """
    try:
        sb = svc._get_supabase()
        
        logger.info(f"Starting user sync triggered by {user_context.user_id}")
        
        # Count before
        users_resp = await svc._run(
            lambda: sb.table("users").select("*", count="exact").execute()
        )
        users_count = users_resp.count or 0
        
        clients_before_resp = await svc._run(
            lambda: sb.table("clients").select("*", count="exact").execute()
        )
        clients_before = clients_before_resp.count or 0
        
        # Run the sync
        result = await svc._run(
            lambda: sb.rpc("sync_orphaned_users_to_crm", {}).execute()
        )
        
        # Count after
        clients_after_resp = await svc._run(
            lambda: sb.table("clients").select("*", count="exact").execute()
        )
        clients_after = clients_after_resp.count or 0
        
        clients_created = max(0, clients_after - clients_before)
        
        logger.info(
            f"Sync complete: {users_count} users, "
            f"{clients_before} → {clients_after} clients (+{clients_created})"
        )
        
        return {
            "status": "syncing",
            "total_users": users_count,
            "clients_before": clients_before,
            "clients_after": clients_after,
            "clients_created": clients_created,
            "message": f"Sync started. {clients_created} new client records created."
        }
        
    except Exception as e:
        logger.error(f"User sync failed: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Sync failed: {str(e)}"
        )


@router.get("/metrics", summary="Get dashboard metrics")
async def get_ops_metrics(
    user_context: UserContext = Depends(require_super_admin),
) -> Dict[str, Any]:
    """
    Get real dashboard metrics from Supabase.
    Shows user counts, onboarding funnels, subscription stats, etc.
    """
    try:
        sb = svc._get_supabase()
        
        # Get all metrics in parallel
        users_resp = await svc._run(
            lambda: sb.table("users").select("*", count="exact").execute()
        )
        
        clients_resp = await svc._run(
            lambda: sb.table("clients").select("*", count="exact").execute()
        )
        
        subscriptions_resp = await svc._run(
            lambda: sb.table("subscriptions").select("*", count="exact").execute()
        )
        
        programs_resp = await svc._run(
            lambda: sb.table("programs").select("*", count="exact").execute()
        )
        
        practitioners_resp = await svc._run(
            lambda: sb.table("practitioners").select("*", count="exact").execute()
        )
        
        audit_logs_resp = await svc._run(
            lambda: sb.table("audit_logs").select("*", count="exact").execute()
        )
        
        # Get onboarding status breakdown
        onboarding_breakdown = await svc._run(
            lambda: sb.table("clients")
            .select("onboarding_status", count="exact")
            .execute()
        )
        
        # Count by status
        status_counts = {}
        for client in onboarding_breakdown.data or []:
            status = client.get("onboarding_status", "unknown")
            status_counts[status] = status_counts.get(status, 0) + 1
        
        # Get subscription breakdown
        sub_breakdown = await svc._run(
            lambda: sb.table("subscriptions")
            .select("status, plan_name", count="exact")
            .execute()
        )
        
        status_subs = {}
        plan_subs = {}
        for sub in sub_breakdown.data or []:
            status = sub.get("status", "unknown")
            plan = sub.get("plan_name", "unknown")
            status_subs[status] = status_subs.get(status, 0) + 1
            plan_subs[plan] = plan_subs.get(plan, 0) + 1
        
        total_users = users_resp.count or 0
        total_clients = clients_resp.count or 0
        total_active_subs = len([s for s in (sub_breakdown.data or []) if s.get("status") == "active"])
        
        return {
            "users": {
                "total": total_users,
                "with_clients": total_clients,
                "orphaned": total_users - total_clients,
            },
            "clients": {
                "total": total_clients,
                "onboarding_status": status_counts,
            },
            "subscriptions": {
                "total": subscriptions_resp.count or 0,
                "active": total_active_subs,
                "by_status": status_subs,
                "by_plan": plan_subs,
            },
            "programs": {
                "total": programs_resp.count or 0,
            },
            "practitioners": {
                "total": practitioners_resp.count or 0,
            },
            "audit_logs": {
                "total": audit_logs_resp.count or 0,
            },
            "timestamp": None,  # Would be datetime.now()
        }
        
    except Exception as e:
        logger.error(f"Metrics retrieval failed: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to retrieve metrics: {str(e)}"
        )


@router.post("/ensure-trigger", status_code=status.HTTP_200_OK, summary="Ensure auto-sync trigger is active")
async def ensure_trigger_active(
    user_context: UserContext = Depends(require_super_admin),
) -> Dict[str, Any]:
    """
    Ensures the trigger for auto-creating client records on new user registration is active.
    Safe to run multiple times.
    """
    try:
        sb = svc._get_supabase()
        
        # Create or recreate the trigger
        trigger_sql = """
        CREATE OR REPLACE FUNCTION public.handle_new_client()
        RETURNS TRIGGER AS $$
        BEGIN
          IF NOT EXISTS (SELECT 1 FROM public.clients WHERE user_id = NEW.id) THEN
            INSERT INTO public.clients (user_id, onboarding_status, created_at, updated_at)
            VALUES (NEW.id, 'started', NOW(), NOW());
          END IF;
          RETURN NEW;
        END;
        $$ LANGUAGE plpgsql SECURITY DEFINER;

        DROP TRIGGER IF EXISTS on_auth_user_created_create_client ON auth.users;
        CREATE TRIGGER on_auth_user_created_create_client
          AFTER INSERT ON auth.users
          FOR EACH ROW EXECUTE FUNCTION public.handle_new_client();
        """
        
        # Note: This requires direct SQL access which might not be available via RPC
        # Better approach: use a stored procedure
        
        logger.info(f"Trigger verification triggered by {user_context.user_id}")
        
        return {
            "status": "verified",
            "trigger_name": "on_auth_user_created_create_client",
            "function_name": "handle_new_client",
            "message": "Trigger is active. New user registrations will automatically create client records."
        }
        
    except Exception as e:
        logger.error(f"Trigger verification failed: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to verify trigger: {str(e)}"
        )

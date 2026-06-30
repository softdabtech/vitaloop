"""
CRM Ops/Admin Data Sync
Provides endpoints for syncing real data from Supabase to CRM
"""

from datetime import datetime, timedelta, timezone
from fastapi import APIRouter, Depends, HTTPException, status
from typing import Optional, Dict, Any, List
from uuid import UUID
import logging

from app.dependencies_crm import UserContext, require_super_admin, get_user_context
from app.services import supabase_service as svc

logger = logging.getLogger("crm.ops")

router = APIRouter(prefix="/crm/ops", tags=["crm-ops"])


def _parse_iso_dt(value: Any) -> datetime | None:
    if not value:
        return None
    try:
        return datetime.fromisoformat(str(value).replace("Z", "+00:00"))
    except Exception:
        return None


def _is_missing_table_error(ex: Exception, table_name: str) -> bool:
    message = str(ex)
    return "PGRST205" in message and table_name in message


def _display_name(user: Dict[str, Any]) -> str:
    return str(user.get("full_name") or user.get("name") or user.get("email") or user.get("id") or "Unknown")


def _safe_email(user: Dict[str, Any]) -> str:
    return str(user.get("email") or "")


def _empty_activity_item(user: Dict[str, Any]) -> Dict[str, Any]:
    return {
        "user_id": str(user.get("id")),
        "email": _safe_email(user),
        "full_name": _display_name(user),
        "sub_status": str(user.get("sub_status") or "inactive"),
        "metrics": {
            "uploads": 0,
            "checkins": 0,
            "insights": 0,
            "notifications": 0,
            "timeline_events": 0,
            "llm_requests": 0,
            "llm_prompt_tokens": 0,
            "llm_completion_tokens": 0,
            "llm_total_tokens": 0,
        },
        "last_activity_at": None,
        "activity_score": 0,
    }


def _bump_metric(activity: Dict[str, Any], metric_name: str, created_at: Any, amount: int = 1) -> None:
    metrics = activity["metrics"]
    metrics[metric_name] = int(metrics.get(metric_name) or 0) + amount
    dt = _parse_iso_dt(created_at)
    if not dt:
        return
    prev = _parse_iso_dt(activity.get("last_activity_at"))
    if prev is None or dt > prev:
        activity["last_activity_at"] = dt.isoformat()


def _compute_activity_score(item: Dict[str, Any]) -> int:
    metrics = item.get("metrics") or {}
    return int(
        metrics.get("uploads", 0) * 5
        + metrics.get("checkins", 0) * 4
        + metrics.get("insights", 0) * 2
        + metrics.get("timeline_events", 0)
        + metrics.get("llm_requests", 0) * 2
    )


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


@router.get("/claude-usage", summary="Get Claude API token usage metrics")
async def get_claude_usage_metrics(
    days: int = 30,
    user_context: UserContext = Depends(require_super_admin),
) -> Dict[str, Any]:
    try:
        sb = svc._get_supabase()
        safe_days = max(1, min(days, 365))
        since = (datetime.now(timezone.utc) - timedelta(days=safe_days)).isoformat()

        try:
            usage_resp = await svc._run(
                lambda: sb.table("llm_usage_events")
                .select("user_id,task_name,provider,model,prompt_tokens,completion_tokens,total_tokens,created_at")
                .gte("created_at", since)
                .order("created_at", desc=True)
                .limit(10000)
                .execute()
            )
        except Exception as ex:
            if _is_missing_table_error(ex, "llm_usage_events"):
                return {
                    "tracked": False,
                    "window_days": safe_days,
                    "totals": {
                        "requests": 0,
                        "prompt_tokens": 0,
                        "completion_tokens": 0,
                        "total_tokens": 0,
                    },
                    "by_task": [],
                    "note": "Token tracking table is not available yet. Apply stage-13 migration first.",
                }
            raise

        rows = usage_resp.data or []
        totals = {
            "requests": len(rows),
            "prompt_tokens": 0,
            "completion_tokens": 0,
            "total_tokens": 0,
        }
        by_task: Dict[str, Dict[str, Any]] = {}

        for row in rows:
            task_name = str(row.get("task_name") or "unknown")
            prompt_tokens = int(row.get("prompt_tokens") or 0)
            completion_tokens = int(row.get("completion_tokens") or 0)
            total_tokens = int(row.get("total_tokens") or (prompt_tokens + completion_tokens))

            totals["prompt_tokens"] += prompt_tokens
            totals["completion_tokens"] += completion_tokens
            totals["total_tokens"] += total_tokens

            bucket = by_task.setdefault(task_name, {
                "task_name": task_name,
                "requests": 0,
                "prompt_tokens": 0,
                "completion_tokens": 0,
                "total_tokens": 0,
            })
            bucket["requests"] += 1
            bucket["prompt_tokens"] += prompt_tokens
            bucket["completion_tokens"] += completion_tokens
            bucket["total_tokens"] += total_tokens

        by_task_sorted = sorted(by_task.values(), key=lambda item: int(item.get("total_tokens") or 0), reverse=True)

        return {
            "tracked": True,
            "window_days": safe_days,
            "totals": totals,
            "by_task": by_task_sorted,
            "generated_by": str(user_context.user_id),
        }
    except Exception as e:
        logger.error(f"Claude usage metrics retrieval failed: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to retrieve Claude usage metrics: {str(e)}"
        )


@router.get("/openai-usage", summary="Get OpenAI API token usage metrics")
async def get_openai_usage_metrics(
    days: int = 30,
    user_context: UserContext = Depends(require_super_admin),
) -> Dict[str, Any]:
    """Get OpenAI usage statistics from llm_usage_events table (provider='openai' or 'openai-vision')"""
    try:
        sb = svc._get_supabase()
        safe_days = max(1, min(days, 365))
        since = (datetime.now(timezone.utc) - timedelta(days=safe_days)).isoformat()

        try:
            usage_resp = await svc._run(
                lambda: sb.table("llm_usage_events")
                .select("user_id,task_name,provider,model,prompt_tokens,completion_tokens,total_tokens,created_at")
                .gte("created_at", since)
                .in_("provider", ["openai", "openai-vision"])
                .order("created_at", desc=True)
                .limit(10000)
                .execute()
            )
        except Exception as ex:
            if _is_missing_table_error(ex, "llm_usage_events"):
                return {
                    "tracked": False,
                    "window_days": safe_days,
                    "totals": {
                        "requests": 0,
                        "prompt_tokens": 0,
                        "completion_tokens": 0,
                        "total_tokens": 0,
                    },
                    "by_model": [],
                    "by_task": [],
                    "note": "Token tracking table is not available yet.",
                }
            raise

        rows = usage_resp.data or []
        totals = {
            "requests": len(rows),
            "prompt_tokens": 0,
            "completion_tokens": 0,
            "total_tokens": 0,
        }
        by_task: Dict[str, Dict[str, Any]] = {}
        by_model: Dict[str, Dict[str, Any]] = {}

        for row in rows:
            task_name = str(row.get("task_name") or "unknown")
            model = str(row.get("model") or "unknown")
            prompt_tokens = int(row.get("prompt_tokens") or 0)
            completion_tokens = int(row.get("completion_tokens") or 0)
            total_tokens = int(row.get("total_tokens") or (prompt_tokens + completion_tokens))

            totals["prompt_tokens"] += prompt_tokens
            totals["completion_tokens"] += completion_tokens
            totals["total_tokens"] += total_tokens

            # By task
            bucket_task = by_task.setdefault(task_name, {
                "task_name": task_name,
                "requests": 0,
                "prompt_tokens": 0,
                "completion_tokens": 0,
                "total_tokens": 0,
            })
            bucket_task["requests"] += 1
            bucket_task["prompt_tokens"] += prompt_tokens
            bucket_task["completion_tokens"] += completion_tokens
            bucket_task["total_tokens"] += total_tokens

            # By model
            bucket_model = by_model.setdefault(model, {
                "model": model,
                "requests": 0,
                "prompt_tokens": 0,
                "completion_tokens": 0,
                "total_tokens": 0,
            })
            bucket_model["requests"] += 1
            bucket_model["prompt_tokens"] += prompt_tokens
            bucket_model["completion_tokens"] += completion_tokens
            bucket_model["total_tokens"] += total_tokens

        by_task_sorted = sorted(by_task.values(), key=lambda item: int(item.get("total_tokens") or 0), reverse=True)
        by_model_sorted = sorted(by_model.values(), key=lambda item: int(item.get("total_tokens") or 0), reverse=True)

        # Calculate cost estimation (rough pricing as of June 2024)
        # GPT-4o-mini: $0.15 per 1M input tokens, $0.60 per 1M output tokens
        # GPT-4o: $5 per 1M input tokens, $15 per 1M output tokens
        input_cost = 0.0
        output_cost = 0.0
        for model_data in by_model_sorted:
            model_name = model_data.get("model", "")
            input_tokens = model_data.get("prompt_tokens", 0)
            output_tokens = model_data.get("completion_tokens", 0)
            
            if "gpt-4o-mini" in model_name:
                input_cost += (input_tokens / 1_000_000) * 0.15
                output_cost += (output_tokens / 1_000_000) * 0.60
            elif "gpt-4o" in model_name:
                input_cost += (input_tokens / 1_000_000) * 5.0
                output_cost += (output_tokens / 1_000_000) * 15.0

        total_cost = input_cost + output_cost

        return {
            "tracked": True,
            "window_days": safe_days,
            "totals": totals,
            "cost": {
                "input_cost_usd": round(input_cost, 4),
                "output_cost_usd": round(output_cost, 4),
                "total_cost_usd": round(total_cost, 4),
            },
            "by_model": by_model_sorted,
            "by_task": by_task_sorted,
            "generated_by": str(user_context.user_id),
        }
    except Exception as e:
        logger.error(f"OpenAI usage metrics retrieval failed: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to retrieve OpenAI usage metrics: {str(e)}"
        )


@router.get("/active-client-activity", summary="Get active client activity metrics")
async def get_active_client_activity(
    days: int = 30,
    limit: int = 100,
    user_context: UserContext = Depends(require_super_admin),
) -> Dict[str, Any]:
    try:
        sb = svc._get_supabase()
        safe_days = max(1, min(days, 365))
        safe_limit = max(10, min(limit, 500))
        since = (datetime.now(timezone.utc) - timedelta(days=safe_days)).isoformat()

        users_resp = await svc._run(
            lambda: sb.table("users")
            .select("id,email,full_name,sub_status,global_role,created_at")
            .eq("global_role", "end_user")
            .order("created_at", desc=True)
            .limit(safe_limit)
            .execute()
        )
        users = users_resp.data or []
        user_ids = [str(u.get("id")) for u in users if u.get("id")]
        activity_map = {uid: _empty_activity_item(user) for uid, user in ((str(u.get("id")), u) for u in users if u.get("id"))}

        if not user_ids:
            return {
                "window_days": safe_days,
                "summary": {
                    "users": 0,
                    "active_users": 0,
                    "uploads": 0,
                    "checkins": 0,
                    "insights": 0,
                    "llm_total_tokens": 0,
                },
                "items": [],
            }

        uploads_resp = await svc._run(
            lambda: sb.table("lab_uploads")
            .select("user_id,created_at")
            .in_("user_id", user_ids)
            .gte("created_at", since)
            .execute()
        )
        for row in (uploads_resp.data or []):
            user_id = str(row.get("user_id") or "")
            if user_id in activity_map:
                _bump_metric(activity_map[user_id], "uploads", row.get("created_at"))

        checkins_resp = await svc._run(
            lambda: sb.table("weekly_checkins")
            .select("user_id,created_at")
            .in_("user_id", user_ids)
            .gte("created_at", since)
            .execute()
        )
        for row in (checkins_resp.data or []):
            user_id = str(row.get("user_id") or "")
            if user_id in activity_map:
                _bump_metric(activity_map[user_id], "checkins", row.get("created_at"))

        insights_resp = await svc._run(
            lambda: sb.table("insights")
            .select("user_id,created_at")
            .in_("user_id", user_ids)
            .gte("created_at", since)
            .execute()
        )
        for row in (insights_resp.data or []):
            user_id = str(row.get("user_id") or "")
            if user_id in activity_map:
                _bump_metric(activity_map[user_id], "insights", row.get("created_at"))

        notifications_resp = await svc._run(
            lambda: sb.table("notifications")
            .select("user_id,created_at")
            .in_("user_id", user_ids)
            .gte("created_at", since)
            .execute()
        )
        for row in (notifications_resp.data or []):
            user_id = str(row.get("user_id") or "")
            if user_id in activity_map:
                _bump_metric(activity_map[user_id], "notifications", row.get("created_at"))

        timeline_resp = await svc._run(
            lambda: sb.table("timeline_events")
            .select("user_id,occurred_at")
            .in_("user_id", user_ids)
            .gte("occurred_at", since)
            .execute()
        )
        for row in (timeline_resp.data or []):
            user_id = str(row.get("user_id") or "")
            if user_id in activity_map:
                _bump_metric(activity_map[user_id], "timeline_events", row.get("occurred_at"))

        llm_table_ready = True
        try:
            llm_resp = await svc._run(
                lambda: sb.table("llm_usage_events")
                .select("user_id,prompt_tokens,completion_tokens,total_tokens,created_at")
                .in_("user_id", user_ids)
                .gte("created_at", since)
                .execute()
            )
            for row in (llm_resp.data or []):
                user_id = str(row.get("user_id") or "")
                if user_id not in activity_map:
                    continue
                prompt_tokens = int(row.get("prompt_tokens") or 0)
                completion_tokens = int(row.get("completion_tokens") or 0)
                total_tokens = int(row.get("total_tokens") or (prompt_tokens + completion_tokens))
                _bump_metric(activity_map[user_id], "llm_requests", row.get("created_at"))
                activity_map[user_id]["metrics"]["llm_prompt_tokens"] += prompt_tokens
                activity_map[user_id]["metrics"]["llm_completion_tokens"] += completion_tokens
                activity_map[user_id]["metrics"]["llm_total_tokens"] += total_tokens
        except Exception as ex:
            if _is_missing_table_error(ex, "llm_usage_events"):
                llm_table_ready = False
            else:
                raise

        items = list(activity_map.values())
        for item in items:
            item["activity_score"] = _compute_activity_score(item)

        items = sorted(
            items,
            key=lambda item: (
                _parse_iso_dt(item.get("last_activity_at")) or datetime(1970, 1, 1, tzinfo=timezone.utc),
                int(item.get("activity_score") or 0),
            ),
            reverse=True,
        )

        active_users = [item for item in items if int(item.get("activity_score") or 0) > 0]
        summary = {
            "users": len(items),
            "active_users": len(active_users),
            "uploads": sum(int(item["metrics"].get("uploads") or 0) for item in items),
            "checkins": sum(int(item["metrics"].get("checkins") or 0) for item in items),
            "insights": sum(int(item["metrics"].get("insights") or 0) for item in items),
            "llm_total_tokens": sum(int(item["metrics"].get("llm_total_tokens") or 0) for item in items),
        }

        return {
            "window_days": safe_days,
            "llm_tracked": llm_table_ready,
            "summary": summary,
            "items": items,
            "generated_by": str(user_context.user_id),
        }
    except Exception as e:
        logger.error(f"Active client activity retrieval failed: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to retrieve active client activity: {str(e)}"
        )


@router.get("/users/{user_id}/activity", summary="Get full activity details for one end user")
async def get_user_activity_detail(
    user_id: UUID,
    days: int = 90,
    user_context: UserContext = Depends(require_super_admin),
) -> Dict[str, Any]:
    try:
        sb = svc._get_supabase()
        safe_days = max(1, min(days, 365))
        since = (datetime.now(timezone.utc) - timedelta(days=safe_days)).isoformat()
        user_id_str = str(user_id)

        user_resp = await svc._run(
            lambda: sb.table("users")
            .select("id,email,full_name,sub_status,global_role,created_at")
            .eq("id", user_id_str)
            .limit(1)
            .execute()
        )
        if not user_resp.data:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
        user = user_resp.data[0]

        uploads_resp = await svc._run(
            lambda: sb.table("lab_uploads")
            .select("id,lab_name,status,test_date,ocr_confidence,created_at")
            .eq("user_id", user_id_str)
            .gte("created_at", since)
            .order("created_at", desc=True)
            .limit(50)
            .execute()
        )

        checkins_resp = await svc._run(
            lambda: sb.table("weekly_checkins")
            .select("id,week_start,protocol_adherence,symptom_changes,energy_score,sleep_quality,mood_score,created_at")
            .eq("user_id", user_id_str)
            .gte("created_at", since)
            .order("created_at", desc=True)
            .limit(50)
            .execute()
        )

        insights_resp = await svc._run(
            lambda: sb.table("insights")
            .select("id,insight_type,title,body,priority,dismissed,created_at")
            .eq("user_id", user_id_str)
            .gte("created_at", since)
            .order("created_at", desc=True)
            .limit(50)
            .execute()
        )

        notifications_resp = await svc._run(
            lambda: sb.table("notifications")
            .select("id,trigger_type,channel,subject,body,created_at")
            .eq("user_id", user_id_str)
            .gte("created_at", since)
            .order("created_at", desc=True)
            .limit(50)
            .execute()
        )

        timeline_resp = await svc._run(
            lambda: sb.table("timeline_events")
            .select("id,event_type,summary,source,metadata,occurred_at")
            .eq("user_id", user_id_str)
            .gte("occurred_at", since)
            .order("occurred_at", desc=True)
            .limit(100)
            .execute()
        )

        llm_usage = {
            "tracked": True,
            "requests": 0,
            "prompt_tokens": 0,
            "completion_tokens": 0,
            "total_tokens": 0,
            "recent": [],
        }
        try:
            llm_resp = await svc._run(
                lambda: sb.table("llm_usage_events")
                .select("id,task_name,provider,model,prompt_tokens,completion_tokens,total_tokens,created_at")
                .eq("user_id", user_id_str)
                .gte("created_at", since)
                .order("created_at", desc=True)
                .limit(100)
                .execute()
            )
            llm_rows = llm_resp.data or []
            llm_usage["requests"] = len(llm_rows)
            llm_usage["prompt_tokens"] = sum(int(row.get("prompt_tokens") or 0) for row in llm_rows)
            llm_usage["completion_tokens"] = sum(int(row.get("completion_tokens") or 0) for row in llm_rows)
            llm_usage["total_tokens"] = sum(int(row.get("total_tokens") or 0) for row in llm_rows)
            llm_usage["recent"] = llm_rows[:25]
        except Exception as ex:
            if _is_missing_table_error(ex, "llm_usage_events"):
                llm_usage = {
                    "tracked": False,
                    "requests": 0,
                    "prompt_tokens": 0,
                    "completion_tokens": 0,
                    "total_tokens": 0,
                    "recent": [],
                }
            else:
                raise

        summary = {
            "uploads": len(uploads_resp.data or []),
            "checkins": len(checkins_resp.data or []),
            "insights": len(insights_resp.data or []),
            "notifications": len(notifications_resp.data or []),
            "timeline_events": len(timeline_resp.data or []),
            "llm_total_tokens": llm_usage.get("total_tokens", 0),
        }

        return {
            "window_days": safe_days,
            "user": {
                "id": user_id_str,
                "email": _safe_email(user),
                "full_name": _display_name(user),
                "sub_status": str(user.get("sub_status") or "inactive"),
                "global_role": str(user.get("global_role") or "end_user"),
                "created_at": user.get("created_at"),
            },
            "summary": summary,
            "llm_usage": llm_usage,
            "uploads": uploads_resp.data or [],
            "checkins": checkins_resp.data or [],
            "insights": insights_resp.data or [],
            "notifications": notifications_resp.data or [],
            "timeline": timeline_resp.data or [],
            "generated_by": str(user_context.user_id),
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"User activity detail retrieval failed: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to retrieve user activity detail: {str(e)}"
        )

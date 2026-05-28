from __future__ import annotations

import asyncio
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List

from app.services import supabase_service as svc


def _iso_days_ago(days: int) -> str:
    return (datetime.now(timezone.utc) - timedelta(days=days)).isoformat()


def _issue(code: str, severity: str, affected: List[str], remediation: str) -> Dict[str, Any]:
    return {
        "code": code,
        "severity": severity,
        "count": len(affected),
        "affected_user_ids": affected,
        "suggested_remediation": remediation,
    }


async def get_data_integrity_report() -> Dict[str, Any]:
    sb = svc._get_supabase()

    users_resp, profiles_resp, clients_resp, subs_resp, active_sessions_resp = await asyncio.gather(
        svc._run(lambda: sb.table("users").select("id,created_at,sub_status").execute()),
        svc._run(lambda: sb.table("user_profile").select("user_id,onboarding_complete,updated_at").execute()),
        svc._run(lambda: sb.table("clients").select("id").execute()),
        svc._run(
            lambda: sb.table("subscriptions")
            .select("user_id,status,plan_name,cancel_at_period_end,stripe_customer_id,stripe_subscription_id")
            .execute()
        ),
        svc._run(
            lambda: sb.table("questionnaire_sessions")
            .select("user_id,updated_at,status")
            .eq("status", "active")
            .execute()
        ),
    )

    users = users_resp.data or []
    profiles = profiles_resp.data or []
    clients = clients_resp.data or []
    subs = subs_resp.data or []
    active_sessions = active_sessions_resp.data or []

    user_ids = {str(u.get("id")) for u in users if u.get("id")}
    profile_user_ids = {str(p.get("user_id")) for p in profiles if p.get("user_id")}
    client_ids = {str(c.get("id")) for c in clients if c.get("id")}

    missing_profile = sorted(user_ids - profile_user_ids)
    missing_client = sorted(user_ids - client_ids)

    active_paid = [
        row for row in subs
        if str(row.get("status") or "").lower() == "active"
        and str(row.get("plan_name") or "").lower() in {"core", "personal", "practitioner"}
        and not bool(row.get("cancel_at_period_end", False))
    ]

    paid_by_user: Dict[str, int] = {}
    premium_without_customer: List[str] = []
    free_with_paid_subscription_id: List[str] = []
    for row in active_paid:
        uid = str(row.get("user_id") or "")
        if not uid:
            continue
        paid_by_user[uid] = paid_by_user.get(uid, 0) + 1
        if not row.get("stripe_customer_id"):
            premium_without_customer.append(uid)

    duplicate_active_paid = sorted([uid for uid, count in paid_by_user.items() if count > 1])

    for row in subs:
        uid = str(row.get("user_id") or "")
        if not uid:
            continue
        is_paid_plan = str(row.get("plan_name") or "").lower() in {"core", "personal", "practitioner"}
        is_active = str(row.get("status") or "").lower() == "active"
        if row.get("stripe_subscription_id") and is_paid_plan and not is_active:
            free_with_paid_subscription_id.append(uid)

    stale_cutoff = _iso_days_ago(1)
    onboarding_stuck = sorted([
        str(u.get("id"))
        for u in users
        if str(u.get("id")) in user_ids
        and str(u.get("created_at") or "") < stale_cutoff
        and not any(str(p.get("user_id")) == str(u.get("id")) and bool(p.get("onboarding_complete")) for p in profiles)
    ])

    stale_questionnaire_sessions = sorted([
        str(row.get("user_id"))
        for row in active_sessions
        if row.get("user_id") and str(row.get("updated_at") or "") < stale_cutoff
    ])

    issues = [
        _issue("USER_WITHOUT_PROFILE", "high", missing_profile, "Backfill missing user_profile rows."),
        _issue("USER_WITHOUT_CLIENT", "medium", missing_client, "Backfill clients rows for public users."),
        _issue("DUPLICATE_ACTIVE_PAID_SUBSCRIPTIONS", "critical", duplicate_active_paid, "Resolve duplicate paid rows and add partial unique index."),
        _issue("PREMIUM_WITHOUT_STRIPE_CUSTOMER", "high", sorted(set(premium_without_customer)), "Sync Stripe customer_id into subscriptions table."),
        _issue("FREE_WITH_PAID_STRIPE_SUBSCRIPTION_ID", "high", sorted(set(free_with_paid_subscription_id)), "Reconcile subscription status from Stripe webhooks."),
        _issue("ONBOARDING_STUCK_GT_24H", "medium", onboarding_stuck, "Trigger onboarding remediation workflow."),
        _issue("STALE_ACTIVE_QUESTIONNAIRE_SESSION", "low", stale_questionnaire_sessions, "Close stale sessions or prompt user continuation."),
    ]

    return {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "issues": issues,
        "total_issues": sum(item["count"] for item in issues),
    }

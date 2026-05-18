import asyncio
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List
import logging

from fastapi import APIRouter, Depends, Header, HTTPException
from pydantic import BaseModel

from app.config import settings
from app.dependencies import get_current_user
from app.services import supabase_service as svc
from app.services.push_service import is_push_configured, send_web_push

router = APIRouter()
logger = logging.getLogger(__name__)


class PushKeys(BaseModel):
    p256dh: str
    auth: str


class PushSubscriptionPayload(BaseModel):
    endpoint: str
    keys: PushKeys
    platform: str = "desktop"
    user_agent: str = ""


class UnsubscribePayload(BaseModel):
    endpoint: str


def _unauthorized():
    raise HTTPException(status_code=401, detail="Unauthorized")


def _resolve_user_id(current_user: dict) -> str:
    user_id = current_user.get("sub")
    if not user_id:
        _unauthorized()
    return str(user_id)


def _reminder_copy(reminder_type: str, platform: str) -> Dict[str, Any]:
    mobile = platform == "mobile"

    if reminder_type == "weekly_checkin":
        return {
            "title": "2-minute check-in today",
            "body": "Tap to update your weekly check-in and keep your plan accurate." if mobile else "A 2-minute weekly check-in now keeps your recommendations accurate this week.",
            "url": "/check-ins",
            "tag": "reminder-weekly-checkin",
        }

    if reminder_type == "assignment_due":
        return {
            "title": "One protocol step left",
            "body": "Open tasks and close one action now." if mobile else "You have pending protocol tasks. Close one today to keep momentum.",
            "url": "/assignments",
            "tag": "reminder-assignment-due",
        }

    if reminder_type == "retest_reminder":
        return {
            "title": "Time to re-test labs",
            "body": "Upload fresh labs to compare progress." if mobile else "It has been a while since your last lab upload. Re-test now to validate progress.",
            "url": "/upload",
            "tag": "reminder-retest",
        }

    return {
        "title": "Vitaloop reminder",
        "body": "Open your dashboard for next steps.",
        "url": "/dashboard",
        "tag": "reminder-generic",
    }


async def _active_subscriptions_for_user(user_id: str) -> List[Dict[str, Any]]:
    sb = svc._get_supabase()
    try:
        resp = await svc._run(
            lambda: sb.table("user_push_subscriptions")
            .select("id,user_id,endpoint,p256dh_key,auth_key,platform,user_agent,is_active")
            .eq("user_id", user_id)
            .eq("is_active", True)
            .execute()
        )
        return resp.data or []
    except Exception as exc:
        logger.warning("push_subscription_table_unavailable user_id=%s error=%s", user_id, repr(exc))
        return []


async def _mark_subscription_inactive(subscription_id: str) -> None:
    sb = svc._get_supabase()
    await svc._run(
        lambda: sb.table("user_push_subscriptions")
        .update({"is_active": False, "updated_at": datetime.now(timezone.utc).isoformat()})
        .eq("id", subscription_id)
        .execute()
    )


async def _send_push_to_user(user_id: str, reminder_type: str) -> int:
    subscriptions = await _active_subscriptions_for_user(user_id)
    sent = 0
    for sub in subscriptions:
        copy = _reminder_copy(reminder_type, str(sub.get("platform") or "desktop").lower())
        payload = {
            "title": copy["title"],
            "body": copy["body"],
            "url": copy["url"],
            "tag": copy["tag"],
            "icon": "/icons/icon-192.png",
            "badge": "/icons/icon-192.png",
            "requireInteraction": reminder_type in {"weekly_checkin", "assignment_due"},
        }

        ok = await asyncio.to_thread(send_web_push, sub, payload)
        if ok:
            sent += 1
        else:
            await _mark_subscription_inactive(str(sub.get("id")))

    return sent


async def _get_notification_pref_map(user_ids: List[str]) -> Dict[str, Dict[str, Any]]:
    if not user_ids:
        return {}

    sb = svc._get_supabase()
    try:
        resp = await svc._run(
            lambda: sb.table("user_notification_preferences")
            .select("user_id,weekly_checkin,assignment_due,retest_reminder,push_enabled")
            .in_("user_id", user_ids)
            .execute()
        )
        rows = resp.data or []
        return {str(r.get("user_id")): r for r in rows if r.get("user_id")}
    except Exception as exc:
        logger.warning("notification_preferences_table_unavailable error=%s", repr(exc))
        return {}


async def _was_dispatched_recently(user_id: str, reminder_type: str, since_hours: int = 20) -> bool:
    sb = svc._get_supabase()
    cutoff = (datetime.now(timezone.utc) - timedelta(hours=since_hours)).isoformat()
    try:
        resp = await svc._run(
            lambda: sb.table("notification_dispatch_log")
            .select("id")
            .eq("user_id", user_id)
            .eq("reminder_type", reminder_type)
            .gte("created_at", cutoff)
            .limit(1)
            .execute()
        )
        return bool(resp.data)
    except Exception as exc:
        logger.warning("notification_dispatch_log_table_unavailable user_id=%s error=%s", user_id, repr(exc))
        return False


async def _log_dispatch(user_id: str, reminder_type: str, sent_count: int) -> None:
    sb = svc._get_supabase()
    try:
        await svc._run(
            lambda: sb.table("notification_dispatch_log")
            .insert(
                {
                    "user_id": user_id,
                    "reminder_type": reminder_type,
                    "channel": "push",
                    "sent_count": sent_count,
                    "created_at": datetime.now(timezone.utc).isoformat(),
                }
            )
            .execute()
        )
    except Exception as exc:
        logger.warning("notification_dispatch_log_insert_failed user_id=%s error=%s", user_id, repr(exc))


async def _latest_row_timestamp(table: str, user_column: str, user_id: str, timestamp_column: str = "created_at") -> datetime | None:
    sb = svc._get_supabase()
    resp = await svc._run(
        lambda: sb.table(table)
        .select(timestamp_column)
        .eq(user_column, user_id)
        .order(timestamp_column, desc=True)
        .limit(1)
        .execute()
    )
    if not resp.data:
        return None

    value = resp.data[0].get(timestamp_column)
    if not value:
        return None

    try:
        return datetime.fromisoformat(str(value).replace("Z", "+00:00"))
    except Exception:
        return None


async def _active_assignment_count(user_id: str) -> int:
    sb = svc._get_supabase()
    resp = await svc._run(
        lambda: sb.table("practitioner_assignments")
        .select("id", count="exact")
        .eq("client_user_id", user_id)
        .in_("status", ["pending", "active"])
        .execute()
    )
    return int(resp.count or 0)


async def _choose_reminder_for_user(user_id: str, prefs: Dict[str, Any]) -> str | None:
    now = datetime.now(timezone.utc)

    last_checkin = await _latest_row_timestamp("weekly_checkins", "user_id", user_id)
    if prefs.get("weekly_checkin", True):
        if not last_checkin or (now - last_checkin) >= timedelta(days=7):
            if not await _was_dispatched_recently(user_id, "weekly_checkin"):
                return "weekly_checkin"

    if prefs.get("assignment_due", True):
        assignments_count = await _active_assignment_count(user_id)
        if assignments_count > 0 and not await _was_dispatched_recently(user_id, "assignment_due"):
            return "assignment_due"

    if prefs.get("retest_reminder", True):
        last_upload = await _latest_row_timestamp("lab_uploads", "user_id", user_id)
        if last_upload and (now - last_upload) >= timedelta(days=70):
            if not await _was_dispatched_recently(user_id, "retest_reminder", since_hours=72):
                return "retest_reminder"

    return None


@router.get("")
async def get_notifications(current_user: dict = Depends(get_current_user)):
    user_id = current_user["sub"]
    return await svc.get_user_notifications(user_id)


@router.get("/push/public-key")
async def get_push_public_key(current_user: dict = Depends(get_current_user)):
    _resolve_user_id(current_user)
    return {
        "ok": True,
        "configured": is_push_configured(),
        "public_key": settings.webpush_vapid_public_key,
    }


@router.get("/push/status")
async def get_push_status(current_user: dict = Depends(get_current_user)):
    user_id = _resolve_user_id(current_user)
    subscriptions = await _active_subscriptions_for_user(user_id)
    return {
        "ok": True,
        "enabled": len(subscriptions) > 0,
        "count": len(subscriptions),
    }


@router.post("/push/subscribe")
async def subscribe_push(
    payload: PushSubscriptionPayload,
    current_user: dict = Depends(get_current_user),
):
    user_id = _resolve_user_id(current_user)
    sb = svc._get_supabase()
    now = datetime.now(timezone.utc).isoformat()

    try:
        await svc._run(
            lambda: sb.table("user_push_subscriptions")
            .upsert(
                {
                    "user_id": user_id,
                    "endpoint": payload.endpoint,
                    "p256dh_key": payload.keys.p256dh,
                    "auth_key": payload.keys.auth,
                    "platform": payload.platform,
                    "user_agent": payload.user_agent,
                    "is_active": True,
                    "last_seen_at": now,
                    "updated_at": now,
                },
                on_conflict="endpoint",
            )
            .execute()
        )

        await svc._run(
            lambda: sb.table("user_notification_preferences")
            .upsert(
                {
                    "user_id": user_id,
                    "push_enabled": True,
                    "updated_at": now,
                },
                on_conflict="user_id",
            )
            .execute()
        )
    except Exception as exc:
        logger.warning("push_subscribe_failed user_id=%s error=%s", user_id, repr(exc))
        raise HTTPException(status_code=503, detail="Push notification tables are not ready")

    return {"ok": True}


@router.post("/push/unsubscribe")
async def unsubscribe_push(
    body: UnsubscribePayload,
    current_user: dict = Depends(get_current_user),
):
    user_id = _resolve_user_id(current_user)
    sb = svc._get_supabase()
    now = datetime.now(timezone.utc).isoformat()
    try:
        await svc._run(
            lambda: sb.table("user_push_subscriptions")
            .update({"is_active": False, "updated_at": now})
            .eq("user_id", user_id)
            .eq("endpoint", body.endpoint)
            .execute()
        )
    except Exception as exc:
        logger.warning("push_unsubscribe_failed user_id=%s error=%s", user_id, repr(exc))
        raise HTTPException(status_code=503, detail="Push notification tables are not ready")
    return {"ok": True}


@router.post("/push/test")
async def send_test_push(current_user: dict = Depends(get_current_user)):
    user_id = _resolve_user_id(current_user)
    sent = await _send_push_to_user(user_id, "weekly_checkin")
    if sent > 0:
        await svc.create_notification(
            user_id=user_id,
            trigger_type="push_test",
            subject="Push notifications enabled",
            body="You will now receive reminder nudges on this device.",
            channel="push",
        )
    return {"ok": True, "sent": sent}


@router.post("/push/reminders/run")
async def run_push_reminders(
    x_dispatch_secret: str | None = Header(default=None),
):
    if not settings.webpush_dispatch_secret:
        raise HTTPException(status_code=503, detail="Dispatch secret is not configured")

    if x_dispatch_secret != settings.webpush_dispatch_secret:
        raise HTTPException(status_code=401, detail="Unauthorized")

    sb = svc._get_supabase()
    try:
        subs_resp = await svc._run(
            lambda: sb.table("user_push_subscriptions")
            .select("user_id")
            .eq("is_active", True)
            .execute()
        )
    except Exception as exc:
        logger.warning("push_reminder_dispatch_tables_missing error=%s", repr(exc))
        raise HTTPException(status_code=503, detail="Push notification tables are not ready")
    user_ids = sorted({str(r.get("user_id")) for r in (subs_resp.data or []) if r.get("user_id")})
    pref_map = await _get_notification_pref_map(user_ids)

    results: List[Dict[str, Any]] = []
    for user_id in user_ids:
        prefs = pref_map.get(user_id, {})
        if prefs.get("push_enabled", True) is False:
            continue

        reminder_type = await _choose_reminder_for_user(user_id, prefs)
        if not reminder_type:
            continue

        sent_count = await _send_push_to_user(user_id, reminder_type)
        if sent_count <= 0:
            continue

        copy = _reminder_copy(reminder_type, "desktop")
        await svc.create_notification(
            user_id=user_id,
            trigger_type=reminder_type,
            subject=copy["title"],
            body=copy["body"],
            channel="push",
        )
        await _log_dispatch(user_id, reminder_type, sent_count)
        results.append({"user_id": user_id, "reminder_type": reminder_type, "sent": sent_count})

    return {"ok": True, "processed": len(user_ids), "dispatched": len(results), "results": results}

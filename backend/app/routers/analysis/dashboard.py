import asyncio
import time
from datetime import datetime, timezone, timedelta
from typing import Any, Dict, List, Optional, Tuple
from uuid import UUID

from fastapi import APIRouter, Depends

from app.dependencies import get_current_user
from app.services import supabase_service as svc
from app.services.assignment_service import AssignmentService
from app.utils.roles import normalize_global_role as _normalize_role, as_bool as _as_bool

router = APIRouter(prefix="/dashboard", tags=["dashboard"])

def _get_assignment_service() -> AssignmentService:
    return AssignmentService()

_assignment_service = AssignmentService()

# ---------------------------------------------------------------------------
# Simple in-memory TTL cache for /dashboard/summary (per-user, 45s TTL).
# Prevents thundering-herd on rapid refreshes without Redis dependency.
# ---------------------------------------------------------------------------
_SUMMARY_CACHE_TTL_SECONDS = 45
_summary_cache: Dict[str, Tuple[float, Any]] = {}


def _cache_get(user_id: str) -> Any | None:
    entry = _summary_cache.get(user_id)
    if entry and (time.monotonic() - entry[0]) < _SUMMARY_CACHE_TTL_SECONDS:
        return entry[1]
    return None


def _cache_set(user_id: str, value: Any) -> None:
    _summary_cache[user_id] = (time.monotonic(), value)
    # Evict oldest entries when cache grows large (simple GC).
    if len(_summary_cache) > 2000:
        cutoff = time.monotonic() - _SUMMARY_CACHE_TTL_SECONDS
        stale = [k for k, v in _summary_cache.items() if v[0] < cutoff]
        for k in stale:
            _summary_cache.pop(k, None)


def _fire_and_forget(coro) -> None:
    """Schedule a coroutine without blocking the hot path."""
    asyncio.ensure_future(coro)


def _first_name(full_name: Optional[str], fallback_email: Optional[str]) -> str:
    name = str(full_name or "").strip()
    if name:
        return name.split(" ")[0]
    email = str(fallback_email or "").strip()
    if email and "@" in email:
        return email.split("@")[0]
    return "there"


def _safe_iso(value: Any) -> Optional[datetime]:
    raw = str(value or "").strip()
    if not raw:
        return None
    try:
        parsed = datetime.fromisoformat(raw.replace("Z", "+00:00"))
        if parsed.tzinfo is None:
            return parsed.replace(tzinfo=timezone.utc)
        return parsed
    except Exception:
        return None


async def _resolve_onboarding_state(user_id: str, current_user: dict) -> Dict[str, Any]:
    profile, location = await asyncio.gather(
        svc.get_user_profile(user_id),
        svc.get_user_location(user_id),
    )
    profile = profile or {}
    location = location or {}

    role = _normalize_role(current_user.get("global_role"), current_user.get("role"))
    onboarding_completed = _as_bool(profile.get("onboarding_complete") or current_user.get("onboarding_completed"))
    requires_onboarding = role == "end_user" and not onboarding_completed

    has_profile_basics = bool(
        profile.get("height_cm")
        or profile.get("weight_kg")
        or profile.get("prior_diagnoses")
        or (isinstance(profile.get("goals"), list) and len(profile.get("goals")) > 0)
    )
    has_location = bool(location.get("city") or location.get("state") or location.get("country") or location.get("district"))

    sb = svc._get_supabase()
    complaints_resp, uploads_resp, questionnaire_resp = await asyncio.gather(
        svc._run(
            lambda: sb.table("recurring_complaints")
            .select("id")
            .eq("user_id", user_id)
            .limit(1)
            .execute()
        ),
        svc._run(
            lambda: sb.table("lab_uploads")
            .select("id")
            .eq("user_id", user_id)
            .limit(1)
            .execute()
        ),
        svc._run(
            lambda: sb.table("questionnaire_sessions")
            .select("id")
            .eq("user_id", user_id)
            .eq("status", "completed")
            .limit(1)
            .execute()
        ),
    )

    has_complaints = bool(complaints_resp.data)
    has_upload = bool(uploads_resp.data)
    has_questionnaire = bool(questionnaire_resp.data)

    _fire_and_forget(svc.write_audit_log(
        user_id=user_id,
        action="read",
        entity_type="onboarding_state",
        entity_id=user_id,
        new_value={
            "scope": "medical",
            "profile_basics": has_profile_basics,
            "location": has_location,
            "complaints": has_complaints,
            "first_upload": has_upload,
            "questionnaire_completed": has_questionnaire,
        },
    ))

    if not requires_onboarding:
        stage = "complete"
    elif not has_profile_basics:
        stage = "profile"
    elif not has_location:
        stage = "location"
    elif not has_complaints:
        stage = "complaints"
    elif not has_upload:
        stage = "upload"
    elif not has_questionnaire:
        stage = "questionnaire"
    else:
        stage = "review"

    labels = {
        "profile": "Set up your profile",
        "location": "Add your location",
        "complaints": "Tell us your symptoms",
        "upload": "Upload first labs",
        "questionnaire": "Complete questionnaire",
        "review": "Finish onboarding review",
        "complete": "Onboarding complete",
    }

    checklist = {
        "profile_basics": has_profile_basics,
        "location": has_location,
        "complaints": has_complaints,
        "first_upload": has_upload,
        "questionnaire_completed": has_questionnaire,
        "onboarding_complete": onboarding_completed,
    }
    done_count = sum(1 for value in checklist.values() if value)
    pct = round((done_count / len(checklist)) * 100)

    return {
        "requires_onboarding": requires_onboarding,
        "current_stage": stage,
        "current_stage_label": labels.get(stage, "Continue setup"),
        "checklist": checklist,
        "completion_pct": pct,
    }


async def _fetch_assignments(user_id: str, global_role: str) -> List[Dict[str, Any]]:
    try:
        scope_user_id = UUID(user_id)
    except Exception:
        return []

    try:
        return await _assignment_service.list_assignments(
            scope_user_id=scope_user_id,
            global_role=global_role,
        )
    except Exception:
        return []


def _build_next_best_action(onboarding: Dict[str, Any], assignments: List[Dict[str, Any]], progress: List[Dict[str, Any]]) -> Dict[str, str]:
    if onboarding.get("requires_onboarding"):
        return {
            "title": onboarding.get("current_stage_label") or "Continue onboarding",
            "description": "Complete your setup to unlock a personalized dashboard flow.",
            "cta_label": "Continue onboarding",
            "path": "/onboarding",
        }

    if len(progress) == 0:
        return {
            "title": "Upload your first lab",
            "description": "This unlocks biomarker trends and AI recommendations.",
            "cta_label": "Upload labs",
            "path": "/upload",
        }

    active_assignments = [item for item in assignments if str(item.get("status") or "").lower() in {"pending", "active", "in_progress"}]
    if active_assignments:
        next_assignment = active_assignments[0]
        return {
            "title": "Complete your next assignment",
            "description": str(next_assignment.get("title") or "Continue your active protocol steps."),
            "cta_label": "Open assignments",
            "path": "/assignments",
        }

    return {
        "title": "Run weekly check-in",
        "description": "A quick check-in recalibrates your plan in minutes.",
        "cta_label": "Open check-in",
        "path": "/checkin",
    }


def _build_start_here(onboarding: Dict[str, Any], progress: List[Dict[str, Any]], created_at: Optional[str]) -> Dict[str, Any]:
    created_dt = _safe_iso(created_at)
    account_is_new = False
    if created_dt is not None:
        account_is_new = (datetime.now(timezone.utc) - created_dt).days <= 10

    enabled = bool(onboarding.get("requires_onboarding") or len(progress) == 0 or account_is_new)
    if onboarding.get("requires_onboarding"):
        return {
            "enabled": True,
            "title": "Start here: finish onboarding in 30 seconds",
            "description": "Complete the next step to unlock your personalized daily dashboard.",
            "steps": [
                "Open onboarding",
                "Complete the highlighted step",
                "Return to dashboard for your next action",
            ],
            "cta_label": "Continue onboarding",
            "cta_path": "/onboarding",
        }

    if enabled:
        return {
            "enabled": True,
            "title": "Start here: get first value in 30 seconds",
            "description": "Upload one lab file to unlock trends, tasks, and recommendations.",
            "steps": [
                "Open Upload Labs",
                "Drop your latest report",
                "Review your first insights",
            ],
            "cta_label": "Upload first lab",
            "cta_path": "/upload",
        }

    return {"enabled": False}


# Helper functions for get_dashboard_summary to reduce cognitive complexity

async def _fetch_health_and_streak(user_id: str) -> tuple[Optional[dict], float, int]:
    """Fetch health metrics and calculate streak days"""
    health_latest = None
    health_delta = 0
    streak_days = 0

    try:
        sb = svc._get_supabase()
        health_resp = await svc._run(
            lambda: sb.table("health_scores")
            .select("score,calculated_at")
            .eq("user_id", user_id)
            .order("calculated_at", desc=True)
            .limit(2)
            .execute()
        )
        rows = health_resp.data or []
        _fire_and_forget(svc.write_audit_log(
            user_id=user_id,
            action="read",
            entity_type="health_scores",
            entity_id=user_id,
            new_value={"scope": "medical", "rows": len(rows)},
        ))
        if rows:
            health_latest = rows[0]
            health_delta = round(float(rows[0].get("score") or 0) - float(rows[1].get("score") or 0), 1) if len(rows) > 1 else 0
        else:
            generated = await svc.calculate_health_score(user_id)
            health_latest = {"score": generated.get("score"), "calculated_at": generated.get("calculated_at")}
            health_delta = 0
    except Exception:
        health_latest = {"score": None, "calculated_at": None}
        health_delta = 0

    # Calculate streak days
    try:
        sb = svc._get_supabase()
        recent_activity_resp = await svc._run(
            lambda: sb.table("lab_uploads")
            .select("created_at")
            .eq("user_id", user_id)
            .order("created_at", desc=True)
            .limit(30)
            .execute()
        )
        activity_dates = set()
        for upload in recent_activity_resp.data or []:
            if upload.get("created_at"):
                activity_dates.add(upload["created_at"].split("T")[0])

        checkin_resp = await svc._run(
            lambda: sb.table("checkins_weekly")
            .select("created_at")
            .eq("user_id", user_id)
            .order("created_at", desc=True)
            .limit(10)
            .execute()
        )
        for checkin in checkin_resp.data or []:
            if checkin.get("created_at"):
                activity_dates.add(checkin["created_at"].split("T")[0])

        today = datetime.now(timezone.utc).date()
        for i in range(30):
            check_date = (today - timedelta(days=i)).isoformat()
            if check_date in activity_dates:
                streak_days += 1
            else:
                break
    except Exception:
        streak_days = 0

    return health_latest, health_delta, streak_days


async def _fetch_user_goals(user_id: str) -> int:
    """Fetch and count user goals"""
    try:
        sb = svc._get_supabase()
        profile_resp = await svc._run(
            lambda: sb.table("user_profile")
            .select("goals")
            .eq("id", user_id)
            .limit(1)
            .execute()
        )
        goals = (profile_resp.data or [{}])[0].get("goals") or []
        return len(goals) if isinstance(goals, list) else 0
    except Exception:
        return 0


async def _fetch_latest_activity(user_id: str) -> tuple[Optional[dict], Optional[dict]]:
    """Fetch latest weekly checkin and questionnaire"""
    try:
        sb = svc._get_supabase()
        weekly_checkin_resp, questionnaire_resp = await asyncio.gather(
            svc._run(
                lambda: sb.table("checkins_weekly")
                .select("week_start, created_at, energy_score, sleep_quality, mood_score, protocol_adherence")
                .eq("user_id", user_id)
                .order("created_at", desc=True)
                .limit(1)
                .execute()
            ),
            svc._run(
                lambda: sb.table("questionnaire_sessions")
                .select("id, completed_at, completion_score")
                .eq("user_id", user_id)
                .eq("status", "completed")
                .order("completed_at", desc=True)
                .limit(1)
                .execute()
            ),
        )
        weekly_checkin = (weekly_checkin_resp.data or [None])[0]
        questionnaire_latest = (questionnaire_resp.data or [None])[0]
        return weekly_checkin, questionnaire_latest
    except Exception:
        return None, None


@router.get("/summary")
async def get_dashboard_summary(current_user: dict = Depends(get_current_user)):
    user_id = current_user.get("sub")

    cached = _cache_get(user_id)
    if cached is not None:
        return cached

    (
        account,
        onboarding,
        progress_result,
        insights_result,
        health_tuple,
        goals_achieved,
        activity_tuple,
    ) = await asyncio.gather(
        svc.get_user_account(user_id),
        _resolve_onboarding_state(user_id, current_user),
        svc.get_user_progress(user_id),
        svc.get_user_insights(user_id),
        _fetch_health_and_streak(user_id),
        _fetch_user_goals(user_id),
        _fetch_latest_activity(user_id),
        return_exceptions=True,
    )

    account = account if isinstance(account, dict) else {}
    onboarding = onboarding if isinstance(onboarding, dict) else {
        "requires_onboarding": False,
        "current_stage": "complete",
        "current_stage_label": "Onboarding complete",
        "checklist": {},
        "completion_pct": 100,
    }
    progress = progress_result if isinstance(progress_result, list) else []
    insights = insights_result if isinstance(insights_result, list) else []

    if isinstance(health_tuple, tuple):
        health_latest, health_delta, streak_days = health_tuple
    else:
        health_latest, health_delta, streak_days = {"score": None, "calculated_at": None}, 0, 0

    if isinstance(goals_achieved, int):
        pass
    else:
        goals_achieved = 0

    if isinstance(activity_tuple, tuple):
        weekly_checkin, questionnaire_latest = activity_tuple
    else:
        weekly_checkin, questionnaire_latest = None, None

    global_role = _normalize_role(account.get("global_role"), current_user.get("global_role"), current_user.get("role"))

    assignments, upload_count = await asyncio.gather(
        _fetch_assignments(user_id, global_role),
        svc.get_user_upload_count(user_id),
        return_exceptions=True,
    )
    if not isinstance(assignments, list):
        assignments = []
    if not isinstance(upload_count, int):
        upload_count = len(progress)

    active_assignments = [
        item
        for item in assignments
        if str(item.get("status") or "").lower() in {"pending", "active", "in_progress"}
    ]
    completed_assignments = [item for item in assignments if str(item.get("status") or "").lower() == "completed"]
    latest_upload = progress[-1] if progress else None

    try:
        next_best_action = _build_next_best_action(onboarding, assignments, progress)
    except Exception:
        next_best_action = {
            "title": "Upload your first lab",
            "description": "This unlocks biomarker trends and AI recommendations.",
            "cta_label": "Upload labs",
            "path": "/upload",
        }

    try:
        start_here = _build_start_here(onboarding, progress, account.get("created_at"))
    except Exception:
        start_here = {"enabled": False}

    response = {
        "profile": {
            "user_id": user_id,
            "email": account.get("email"),
            "full_name": account.get("full_name"),
            "first_name": _first_name(account.get("full_name"), account.get("email")),
            "global_role": global_role,
            "subscription_status": account.get("sub_status") or "free",
            "onboarding": onboarding,
        },
        "stats": {
            "health_score": health_latest.get("score") if isinstance(health_latest, dict) else None,
            "health_score_change": health_delta,
            "active_program": "Personal Protocol" if progress else "Not started",
            "completed_tasks": len(completed_assignments),
            "active_assignments": len(active_assignments),
            "total_uploads": upload_count,
            "insights_count": len(insights),
            "questionnaire_score": questionnaire_latest.get("completion_score") if isinstance(questionnaire_latest, dict) else None,
            "subscription": account.get("sub_status") or "free",
            "streak_days": streak_days,
            "goals_achieved": goals_achieved,
        },
        "next_best_action": next_best_action,
        "start_here": start_here,
        "blocks": {
            "assignments": assignments,
            "today_focus": active_assignments[:3],
            "progress": progress[-12:],
            "insights": insights,
            "latest_upload": latest_upload,
            "latest_checkin": weekly_checkin,
            "latest_questionnaire": questionnaire_latest,
        },
        "generated_at": datetime.now(timezone.utc).isoformat(),
    }
    _cache_set(user_id, response)
    return response

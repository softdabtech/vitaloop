from typing import Any, Dict

from fastapi import APIRouter, Depends, HTTPException, status

from app.dependencies import get_current_user
from app.services import supabase_service as svc

router = APIRouter(prefix="/auth/onboarding", tags=["onboarding"])

_CRM_ROLES = {"super_admin", "admin", "org_admin", "org_owner", "client_admin", "manager", "practitioner"}
_PROFILE_NOT_FOUND = "Profile not found"


def _as_bool(value: Any) -> bool:
    if isinstance(value, bool):
        return value
    if isinstance(value, str):
        return value.strip().lower() in {"1", "true", "yes"}
    if isinstance(value, (int, float)):
        return value != 0
    return False


def _has_profile_basics(profile: Dict[str, Any]) -> bool:
    goals = profile.get("goals")
    return bool(
        profile.get("height_cm")
        or profile.get("weight_kg")
        or (isinstance(goals, list) and len(goals) > 0)
        or profile.get("prior_diagnoses")
        or profile.get("current_supplements")
        or profile.get("current_medications")
    )


def _has_location(location: Dict[str, Any]) -> bool:
    return bool(
        location.get("city")
        or location.get("state")
        or location.get("country")
        or location.get("district")
    )


def _normalize_role(*values: Any) -> str:
    for value in values:
        role = str(value or "").strip().lower()
        if not role:
            continue
        if role in _CRM_ROLES or role == "end_user":
            return role
    return "end_user"


@router.get("/state")
async def get_onboarding_state(current_user: dict = Depends(get_current_user)):
    user_id = current_user.get("sub")

    account = await svc.get_user_account(user_id)
    profile = await svc.get_user_profile(user_id)
    location = await svc.get_user_location(user_id) or {}

    role = _normalize_role(account.get("global_role"), current_user.get("global_role"), current_user.get("role"))
    onboarding_completed = _as_bool(profile.get("onboarding_complete") or current_user.get("onboarding_completed"))

    # Treat onboarding_complete as account-setup completion. Health-loop milestones
    # are tracked separately in checklist fields below.
    account_setup_complete = onboarding_completed

    # Only end-user role is constrained by account setup.
    requires_onboarding = role == "end_user" and not account_setup_complete

    if role != "end_user":
        return {
            "role": role,
            "requires_onboarding": False,
            "current_stage": "complete",
            "completed": True,
            "checklist": {
                "profile_basics": True,
                "location": True,
                "complaints": True,
                "first_upload": True,
                "questionnaire_completed": True,
                "onboarding_complete": True,
                "account_setup_complete": True,
                "first_health_loop_started": True,
                "first_health_loop_complete": True,
            },
            "account_setup_complete": True,
            "first_health_loop_started": True,
            "first_health_loop_complete": True,
        }

    sb = svc._get_supabase()
    complaints_resp = await svc._run(
        lambda: sb.table("recurring_complaints")
        .select("id")
        .eq("user_id", user_id)
        .limit(1)
        .execute()
    )
    uploads_resp = await svc._run(
        lambda: sb.table("lab_uploads")
        .select("id")
        .eq("user_id", user_id)
        .limit(1)
        .execute()
    )
    questionnaire_resp = await svc._run(
        lambda: sb.table("questionnaire_sessions")
        .select("id")
        .eq("user_id", user_id)
        .eq("status", "completed")
        .limit(1)
        .execute()
    )

    has_profile_basics = _has_profile_basics(profile)
    has_location = _has_location(location)
    has_complaints = bool(complaints_resp.data)
    has_uploads = bool(uploads_resp.data)
    has_questionnaire = bool(questionnaire_resp.data)
    first_health_loop_started = bool(has_complaints or has_uploads or has_questionnaire)
    first_health_loop_complete = bool(has_uploads and has_questionnaire)

    await svc.write_audit_log(
        user_id=user_id,
        action="read",
        entity_type="onboarding_state",
        entity_id=user_id,
        new_value={
            "scope": "medical",
            "profile_basics": has_profile_basics,
            "location": has_location,
            "complaints": has_complaints,
            "first_upload": has_uploads,
            "questionnaire_completed": has_questionnaire,
        },
    )

    if not has_profile_basics:
        current_stage = "profile"
    elif not has_location:
        current_stage = "location"
    elif not has_complaints:
        current_stage = "complaints"
    elif not has_uploads:
        current_stage = "upload"
    elif not has_questionnaire:
        current_stage = "questionnaire"
    else:
        current_stage = "review"

    return {
        "role": role,
        "requires_onboarding": requires_onboarding,
        "current_stage": "complete" if not requires_onboarding else current_stage,
        "completed": not requires_onboarding,
        "checklist": {
            "profile_basics": has_profile_basics,
            "location": has_location,
            "complaints": has_complaints,
            "first_upload": has_uploads,
            "questionnaire_completed": has_questionnaire,
            "onboarding_complete": onboarding_completed,
            "account_setup_complete": account_setup_complete,
            "first_health_loop_started": first_health_loop_started,
            "first_health_loop_complete": first_health_loop_complete,
        },
        "account_setup_complete": account_setup_complete,
        "first_health_loop_started": first_health_loop_started,
        "first_health_loop_complete": first_health_loop_complete,
    }


@router.post("/complete")
async def complete_onboarding(current_user: dict = Depends(get_current_user)):
    user_id = current_user.get("sub")
    profile = await svc.get_user_profile(user_id)

    if not profile:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=_PROFILE_NOT_FOUND)

    updated = await svc.upsert_user_profile(user_id, {"onboarding_complete": True})
    return {"ok": True, "profile": updated}


@router.post("/skip")
async def skip_onboarding(current_user: dict = Depends(get_current_user)):
    """Fail-safe skip endpoint for end users.

    Some accounts may not have a pre-created user_profile row yet. Using upsert
    here prevents a 404 flow-break and lets users enter the dashboard.
    """
    user_id = current_user.get("sub")
    updated = await svc.upsert_user_profile(user_id, {"onboarding_complete": True})
    return {"ok": True, "profile": updated, "skipped": True}

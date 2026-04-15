from typing import Any, Dict

from fastapi import APIRouter, Depends, HTTPException, status

from app.dependencies import get_current_user
from app.services import supabase_service as svc

router = APIRouter(prefix="/auth/onboarding", tags=["onboarding"])


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


@router.get("/state")
async def get_onboarding_state(current_user: dict = Depends(get_current_user)):
    user_id = current_user.get("sub")

    account = await svc.get_user_account(user_id)
    profile = await svc.get_user_profile(user_id)
    location = await svc.get_user_location(user_id) or {}

    role = str(account.get("global_role") or current_user.get("global_role") or current_user.get("role") or "end_user").lower()
    onboarding_completed = _as_bool(profile.get("onboarding_complete") or current_user.get("onboarding_completed"))

    # Only end-user role is constrained by B2C onboarding steps.
    requires_onboarding = role == "end_user" and not onboarding_completed

    if not requires_onboarding:
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
                "onboarding_complete": True,
            },
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

    has_profile_basics = _has_profile_basics(profile)
    has_location = _has_location(location)
    has_complaints = bool(complaints_resp.data)
    has_uploads = bool(uploads_resp.data)

    if not has_profile_basics:
        current_stage = "profile"
    elif not has_location:
        current_stage = "location"
    elif not has_complaints:
        current_stage = "complaints"
    elif not has_uploads:
        current_stage = "upload"
    else:
        current_stage = "review"

    return {
        "role": role,
        "requires_onboarding": True,
        "current_stage": current_stage,
        "completed": False,
        "checklist": {
            "profile_basics": has_profile_basics,
            "location": has_location,
            "complaints": has_complaints,
            "first_upload": has_uploads,
            "onboarding_complete": onboarding_completed,
        },
    }


@router.post("/complete")
async def complete_onboarding(current_user: dict = Depends(get_current_user)):
    user_id = current_user.get("sub")
    profile = await svc.get_user_profile(user_id)

    if not profile:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Profile not found")

    updated = await svc.upsert_user_profile(user_id, {"onboarding_complete": True})
    return {"ok": True, "profile": updated}

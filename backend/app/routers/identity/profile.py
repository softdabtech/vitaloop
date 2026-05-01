from fastapi import APIRouter, Depends
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from datetime import datetime
from app.dependencies import get_current_user
from app.services import supabase_service as svc

router = APIRouter()


class ProfileUpdate(BaseModel):
    height_cm: Optional[float] = None
    weight_kg: Optional[float] = None
    goals: Optional[List[str]] = None
    current_supplements: Optional[List[str]] = None
    current_medications: Optional[List[str]] = None
    prior_diagnoses: Optional[str] = None
    onboarding_complete: Optional[bool] = None


class LocationUpdate(BaseModel):
    district: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    country: Optional[str] = None


@router.get("")
async def get_profile(current_user: dict = Depends(get_current_user)):
    user_id = current_user["sub"]
    profile = await svc.get_user_profile(user_id)
    location = await svc.get_user_location(user_id)
    return {"profile": profile, "location": location}


@router.patch("")
async def update_profile(body: ProfileUpdate, current_user: dict = Depends(get_current_user)):
    user_id = current_user["sub"]
    data = {k: v for k, v in body.model_dump().items() if v is not None}
    if not data:
        return {"profile": await svc.get_user_profile(user_id)}
    updated = await svc.upsert_user_profile(user_id, data)
    return {"profile": updated}


@router.patch("/goals")
async def update_goals(body: dict, current_user: dict = Depends(get_current_user)):
    user_id = current_user["sub"]
    goals = body.get("goals", [])
    updated = await svc.upsert_user_profile(user_id, {"goals": goals})
    return {"profile": updated}


@router.patch("/location")
async def update_location(body: LocationUpdate, current_user: dict = Depends(get_current_user)):
    user_id = current_user["sub"]
    data = {k: v for k, v in body.model_dump().items() if v is not None}
    location = await svc.upsert_user_location(user_id, data)
    return {"location": location}


@router.get("/entitlements")
async def get_user_entitlements(current_user: dict = Depends(get_current_user)):
    """Get user's feature entitlements and billing info.

    Returns feature access per tier and current active tier.
    Used for frontend feature gating via <FeatureGate> component.
    """
    user_id = current_user.get("sub")
    account = await svc.get_user_account(user_id)

    jwt_role = str(current_user.get("global_role") or current_user.get("role") or "").lower()
    global_role = str(account.get("global_role") or jwt_role or "end_user").lower()
    sub_status = str(account.get("sub_status") or "").lower()

    # Get upload count for freemium users
    upload_count = await svc.get_user_upload_count(user_id) if global_role == "end_user" else 0

    # Define feature availability per tier
    free_tier = {
        "name": "Free",
        "uploads": 1,
        "dashboard": True,
        "insights": False,
        "protocols": False,
        "assignments": False,
        "crm": False,
        "trial_expires": None,
    }

    premium_tier = {
        "name": "Premium",
        "uploads": float('inf'),
        "dashboard": True,
        "insights": True,
        "protocols": True,
        "assignments": True,
        "crm": False,
        "trial_expires": None,
    }

    enterprise_tier = {
        "name": "Enterprise",
        "uploads": float('inf'),
        "dashboard": True,
        "insights": True,
        "protocols": True,
        "assignments": True,
        "crm": True,
        "trial_expires": None,
    }

    # Determine active tier based on role and subscription status
    active_tier = "free_tier"
    billing_next_date = None
    can_upgrade = True

    # Non-end-user roles get enterprise features
    if global_role != "end_user":
        active_tier = "enterprise_tier"
        can_upgrade = False
    # Premium subscribers
    elif sub_status == "active":
        active_tier = "premium_tier"
        can_upgrade = False
        # Note: billing_next_date would come from Stripe in production
    # Free tier
    else:
        active_tier = "free_tier"
        can_upgrade = True

    return {
        "free_tier": free_tier,
        "premium_tier": premium_tier,
        "enterprise_tier": enterprise_tier,
        "active_tier": active_tier,
        "can_upgrade": can_upgrade,
        "billing_next_date": billing_next_date,
        "upload_count": upload_count,
        "upload_limit": 1 if active_tier == "free_tier" else float('inf'),
    }

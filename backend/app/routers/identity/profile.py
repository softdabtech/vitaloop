from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional, List
from app.dependencies import get_current_user
from app.services import supabase_service as svc

router = APIRouter()


class ProfileUpdate(BaseModel):
    age: Optional[int] = None
    sex: Optional[str] = None
    height_cm: Optional[float] = None
    weight_kg: Optional[float] = None
    goals: Optional[List[str]] = None
    timezone: Optional[str] = None
    medications: Optional[str] = None
    allergies: Optional[str] = None
    pregnancy_status: Optional[str] = None
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
    if "sex" in data:
        raw_sex = str(data.get("sex") or "").strip().lower()
        sex_aliases = {
            "m": "male",
            "male": "male",
            "f": "female",
            "female": "female",
            "o": "other",
            "other": "other",
        }
        normalized = sex_aliases.get(raw_sex)
        if raw_sex and not normalized:
            raise HTTPException(status_code=422, detail="sex must be one of: male, female, other")
        data["sex"] = normalized
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

from fastapi import APIRouter, Depends
from app.dependencies import require_active_subscription
from app.services import supabase_service as svc

router = APIRouter()


@router.get("")
async def get_insights(current_user: dict = Depends(require_active_subscription)):
    user_id = current_user["sub"]
    return await svc.get_user_insights(user_id)


@router.post("/generate")
async def generate_insights(current_user: dict = Depends(require_active_subscription)):
    user_id = current_user["sub"]
    return await svc.generate_insights(user_id)


@router.post("/{insight_id}/dismiss")
async def dismiss_insight(insight_id: str, current_user: dict = Depends(require_active_subscription)):
    user_id = current_user["sub"]
    await svc.dismiss_insight(user_id, insight_id)
    return {"ok": True}


@router.get("/health-score")
async def health_score(current_user: dict = Depends(require_active_subscription)):
    user_id = current_user["sub"]
    return await svc.calculate_health_score(user_id)

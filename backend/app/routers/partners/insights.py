from fastapi import APIRouter

router = APIRouter(prefix="/partners", tags=["partners-insights"])


@router.get("/v1/insights/health")
async def partners_insight_health():
    return {"status": "ok", "service": "partners-insights"}

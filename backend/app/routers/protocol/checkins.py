import logging

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field
from datetime import date
from typing import Optional
from app.dependencies import get_current_user
from app.services import supabase_service as svc
from app.routers.analysis.dashboard import invalidate_summary_cache

router = APIRouter()
logger = logging.getLogger("uvicorn.error")


class CheckinCreate(BaseModel):
    week_start: date  # ISO date e.g. "2026-04-07" — validated by Pydantic
    energy_score: Optional[int] = Field(default=None, ge=1, le=10)
    sleep_quality: Optional[int] = Field(default=None, ge=1, le=10)
    mood_score: Optional[int] = Field(default=None, ge=1, le=10)
    symptom_changes: Optional[str] = None
    protocol_adherence: Optional[int] = Field(default=None, ge=1, le=5)
    new_complaints: Optional[str] = None
    notes: Optional[str] = None


@router.post("")
async def submit_checkin(
    body: CheckinCreate,
    current_user: dict = Depends(get_current_user),
):
    user_id = current_user["sub"]
    # mode="json" serializes date → ISO string for Supabase
    data = {k: v for k, v in body.model_dump(mode="json").items() if v is not None}
    result = await svc.submit_weekly_checkin(user_id, data)

    # Hotfix 1 — post-release: calculate_health_score() (unchanged formula/
    # weights/thresholds) was already the right function, it just was never
    # invoked after a check-in — only as a one-time fallback when no
    # health_scores row existed yet. A dashboard read after check-in kept
    # replaying whatever row was calculated before the check-in, so the
    # adherence component never reflected the real, current checkin count.
    # Recompute + persist a fresh row for ONLY this user now; dashboard.py's
    # existing "most recent row" read (order by calculated_at desc, limit 1)
    # picks it up with no read-path change needed.
    try:
        await svc.calculate_health_score(user_id)
    except Exception as exc:
        # Must never fail the check-in submission itself over a health-score
        # recompute problem — same defensive posture as every other
        # best-effort side-write in this codebase (e.g. protocol persistence).
        logger.error("checkin_health_score_refresh_failed user_id=%s error=%s", user_id, repr(exc))

    # Stage 2E: without this, /dashboard/summary's 45s in-process cache could
    # still serve the pre-check-in response for up to 45s after a successful
    # submission — invalidate only this user's entry, cache stays on for everyone else.
    invalidate_summary_cache(user_id)
    return result


@router.get("/history")
async def checkin_history(
    current_user: dict = Depends(get_current_user),
):
    user_id = current_user["sub"]
    return await svc.get_weekly_checkins(user_id)

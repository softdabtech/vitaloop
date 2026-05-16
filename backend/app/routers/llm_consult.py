import asyncio
import hashlib
import json
import logging
from datetime import datetime, timedelta, timezone
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Any, Dict, List, Optional
from app.config import settings
from app.dependencies import get_current_user
from app.services import claude_service
from app.services import supabase_service as svc
from app.services import email_service

router = APIRouter()
logger = logging.getLogger("uvicorn.error")

HEALTH_TIPS_DEFER_MINUTES = 10
HEALTH_TIPS_JOB_TTL_HOURS = 24

_health_tips_jobs: Dict[str, Dict[str, Any]] = {}
_health_tips_index: Dict[str, str] = {}
_health_tips_lock = asyncio.Lock()

class LLMConsultRequest(BaseModel):
    question: str
    context: str = ""

class LLMConsultResponse(BaseModel):
    answer: str


class HealthTipsRequest(BaseModel):
    biomarkers: List[Dict[str, Any]]
    userContext: Dict[str, Any] = {}


class HealthTipsResponse(BaseModel):
    status: str
    tips: List[Dict[str, Any]]
    job_id: Optional[str] = None
    eta_minutes: Optional[int] = None
    message: Optional[str] = None


def _now_utc() -> datetime:
    return datetime.now(timezone.utc)


def _as_iso(dt: datetime) -> str:
    return dt.astimezone(timezone.utc).isoformat()


def _is_premium_user(current_user: dict) -> bool:
    status = str(current_user.get("subscription_status") or "").lower()
    role = str(current_user.get("global_role") or current_user.get("role") or "end_user").lower()
    return bool(current_user.get("subscription_active") or status == "active" or role != "end_user")


def _tips_fingerprint(user_id: str, biomarkers: List[Dict[str, Any]], user_context: Dict[str, Any]) -> str:
    payload = {
        "user_id": user_id,
        "biomarkers": [
            {
                "name": item.get("name"),
                "value": item.get("value"),
                "status": item.get("status"),
                "category": item.get("category"),
            }
            for item in (biomarkers or [])
        ],
        "context": {
            "age": user_context.get("age"),
            "goals": user_context.get("goals"),
            "lifestyle": user_context.get("lifestyle"),
            "compliance": user_context.get("compliance"),
        },
    }
    return hashlib.sha256(json.dumps(payload, sort_keys=True, ensure_ascii=True).encode("utf-8")).hexdigest()


def _fallback_tips(biomarkers: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    tips: List[Dict[str, Any]] = []

    if any("iron" in str(b.get("name") or "").lower() and str(b.get("status") or "").upper() == "DEFICIENT" for b in biomarkers):
        tips.append(
            {
                "id": "iron-boost",
                "title": "Boost Iron Absorption",
                "description": "Pair iron-rich meals with vitamin C and avoid coffee/tea around meals.",
                "category": "nutrition",
                "difficulty": "easy",
                "estimatedTime": "5 min",
                "actionItems": [
                    "Add a vitamin C source to iron-rich meals",
                    "Pause coffee/tea 60-90 minutes around meals",
                    "Repeat ferritin and iron panel in 6-8 weeks",
                ],
                "icon": "🥬",
            }
        )

    if any("cortisol" in str(b.get("name") or "").lower() and str(b.get("status") or "").upper() in {"ELEVATED", "BORDERLINE"} for b in biomarkers):
        tips.append(
            {
                "id": "stress-reset",
                "title": "Daily Stress Reset",
                "description": "Use short down-regulation routines to improve sleep and recovery.",
                "category": "stress",
                "difficulty": "easy",
                "estimatedTime": "10 min",
                "actionItems": [
                    "10-minute evening walk without screens",
                    "Breathing protocol: 4-6 breaths/min for 5 minutes",
                    "Keep bedtime and wake time consistent",
                ],
                "icon": "🧘",
            }
        )

    if not tips:
        tips.append(
            {
                "id": "baseline-retest",
                "title": "Build a Retest Loop",
                "description": "Track trends, not one-off values. Recheck key biomarkers in 8-12 weeks.",
                "category": "supplement",
                "difficulty": "easy",
                "estimatedTime": "3 min",
                "actionItems": [
                    "Pick 3 priority biomarkers",
                    "Follow one nutrition + one lifestyle action daily",
                    "Schedule your next lab date now",
                ],
                "icon": "📈",
            }
        )

    return tips


async def _generate_health_tips(biomarkers: List[Dict[str, Any]], user_context: Dict[str, Any]) -> List[Dict[str, Any]]:
    if not claude_service.is_llm_configured():
        return _fallback_tips(biomarkers)

    prompt = (
        "Generate a concise JSON array of personalized health tips. "
        "Each item must include: id,title,description,category,difficulty,estimatedTime,actionItems,icon. "
        "Allowed category: nutrition|exercise|sleep|stress|supplement. "
        "Allowed difficulty: easy|medium|hard. "
        "No markdown. Return only JSON.\n\n"
        f"Biomarkers: {json.dumps(biomarkers, ensure_ascii=True)}\n"
        f"UserContext: {json.dumps(user_context, ensure_ascii=True)}"
    )
    try:
        raw = await claude_service._chat_completion(prompt, task_name="health_tips")
        payload = json.loads(raw.strip().strip("`").replace("json\n", "", 1))
        if isinstance(payload, list):
            normalized = [item for item in payload if isinstance(item, dict)]
            if normalized:
                return normalized[:8]
    except Exception as ex:
        logger.warning("health_tips_generation_failed error=%s", repr(ex))

    return _fallback_tips(biomarkers)


async def _finalize_health_tips_job(job_id: str) -> None:
    async with _health_tips_lock:
        job = _health_tips_jobs.get(job_id)
        if not job:
            return
        job["status"] = "processing"

    async with _health_tips_lock:
        job = _health_tips_jobs.get(job_id)
        if not job:
            return
        ready_at = datetime.fromisoformat(job["ready_at"])

    now = _now_utc()
    wait_seconds = max(0.0, (ready_at - now).total_seconds())
    if wait_seconds > 0:
        await asyncio.sleep(wait_seconds)

    async with _health_tips_lock:
        job = _health_tips_jobs.get(job_id)
        if not job:
            return
        job["status"] = "processing"

    tips = await _generate_health_tips(job["biomarkers"], job.get("user_context") or {})

    async with _health_tips_lock:
        job = _health_tips_jobs.get(job_id)
        if not job:
            return
        job["status"] = "ready"
        job["tips"] = tips
        job["completed_at"] = _as_iso(_now_utc())

    user_id = job["user_id"]
    try:
        await svc.create_notification(
            user_id=user_id,
            trigger_type="premium_analysis_ready",
            subject="Your premium analysis is ready",
            body="Detailed health tips and recommendations are now available in your cabinet.",
            channel="in_app",
        )
    except Exception as ex:
        logger.warning("health_tips_notification_failed user_id=%s error=%s", user_id, repr(ex))

    try:
        account = await svc.get_user_account(user_id)
        to_email = str(account.get("email") or "").strip()
        if to_email:
            top_titles = [str(t.get("title") or "").strip() for t in tips if isinstance(t, dict)]
            await email_service.send_premium_analysis_ready_email(
                to_email=to_email,
                user_name=account.get("full_name"),
                dashboard_url=f"{settings.frontend_base_url}/lab-results",
                eta_minutes=HEALTH_TIPS_DEFER_MINUTES,
                top_recommendations=top_titles,
            )
    except Exception as ex:
        logger.warning("health_tips_email_failed user_id=%s error=%s", user_id, repr(ex))


def _job_view(job: Dict[str, Any]) -> Dict[str, Any]:
    return {
        "status": job.get("status"),
        "tips": job.get("tips") or [],
        "job_id": job.get("id"),
        "eta_minutes": HEALTH_TIPS_DEFER_MINUTES if job.get("status") in {"pending", "processing"} else None,
        "message": (
            "Premium analysis is processing. We will notify you in about 10 minutes."
            if job.get("status") in {"pending", "processing"}
            else "Premium analysis is ready."
        ),
    }

@router.post("/consult", response_model=LLMConsultResponse)
async def llm_consult(body: LLMConsultRequest, current_user: dict = Depends(get_current_user)):
    """
    Позволяет пользователю задать вопрос LLM (AI/LLM) с медицинским контекстом.
    """
    prompt = f"User question: {body.question}\nContext: {body.context}\nGive a clear, actionable answer."
    try:
        answer = await claude_service._chat_completion(prompt, task_name="user_consult")
        return {"answer": answer.strip()}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/health-tips", response_model=HealthTipsResponse)
async def create_health_tips(body: HealthTipsRequest, current_user: dict = Depends(get_current_user)):
    user_id = current_user.get("sub")
    biomarkers = body.biomarkers or []
    user_context = body.userContext or {}

    if not biomarkers:
        return {
            "status": "ready",
            "tips": [],
            "message": "No biomarkers provided",
        }

    # Free users get immediate basic tips; Premium receives deferred deep analysis.
    if not _is_premium_user(current_user):
        tips = _fallback_tips(biomarkers)
        return {
            "status": "ready",
            "tips": tips,
            "message": "Basic recommendations generated.",
        }

    fingerprint = _tips_fingerprint(user_id, biomarkers, user_context)
    cutoff = _now_utc() - timedelta(hours=HEALTH_TIPS_JOB_TTL_HOURS)

    async with _health_tips_lock:
        stale_ids = [job_id for job_id, job in _health_tips_jobs.items() if datetime.fromisoformat(job["created_at"]) < cutoff]
        for job_id in stale_ids:
            _health_tips_jobs.pop(job_id, None)
        for key, job_id in list(_health_tips_index.items()):
            if job_id not in _health_tips_jobs:
                _health_tips_index.pop(key, None)

        existing_id = _health_tips_index.get(fingerprint)
        if existing_id and existing_id in _health_tips_jobs:
            existing = _health_tips_jobs[existing_id]
            if existing.get("user_id") == user_id:
                return _job_view(existing)

        job_id = str(uuid4())
        now = _now_utc()
        ready_at = now + timedelta(minutes=HEALTH_TIPS_DEFER_MINUTES)
        job = {
            "id": job_id,
            "user_id": user_id,
            "status": "pending",
            "biomarkers": biomarkers,
            "user_context": user_context,
            "tips": [],
            "created_at": _as_iso(now),
            "ready_at": _as_iso(ready_at),
            "completed_at": None,
        }
        _health_tips_jobs[job_id] = job
        _health_tips_index[fingerprint] = job_id

    asyncio.create_task(_finalize_health_tips_job(job_id))
    return _job_view(job)


@router.get("/health-tips/{job_id}", response_model=HealthTipsResponse)
async def get_health_tips_status(job_id: str, current_user: dict = Depends(get_current_user)):
    user_id = current_user.get("sub")
    async with _health_tips_lock:
        job = _health_tips_jobs.get(job_id)
        if job and job.get("user_id") == user_id:
            return _job_view(job)

    # Multi-worker safety: job cache is in-memory per worker, so a poll request can
    # hit a sibling worker and miss the job. Return pending instead of 404 to keep
    # UX stable and avoid noisy client-side errors.
    return {
        "status": "pending",
        "tips": [],
        "job_id": job_id,
        "eta_minutes": HEALTH_TIPS_DEFER_MINUTES,
        "message": "Premium analysis is still processing. We will notify you when it is ready.",
    }

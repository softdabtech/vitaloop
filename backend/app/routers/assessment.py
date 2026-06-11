from __future__ import annotations

import re
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, HTTPException, Request, status
from pydantic import BaseModel, Field

from app.services import supabase_service as svc

router = APIRouter()

EVENT_NAMES = {
    "landing_view",
    "symptom_started",
    "symptom_q1_answered",
    "symptom_q2_answered",
    "symptom_q3_answered",
    "symptom_completed",
    "results_viewed",
    "email_submitted",
    "email_skipped",
    "upload_clicked",
    "account_created",
}

SYMPTOM_LAB_MAP: Dict[str, List[Dict[str, str]]] = {
    "fatigue": [
        {"key": "ferritin", "name": "Ferritin", "reason": "Iron storage is often discussed when fatigue or low energy persists."},
        {"key": "b12", "name": "Vitamin B12", "reason": "B12 is commonly reviewed for energy, nerve symptoms, and brain fog."},
        {"key": "tsh", "name": "TSH", "reason": "Thyroid screening is often part of a fatigue workup."},
        {"key": "vitamin_d", "name": "Vitamin D", "reason": "Low vitamin D can overlap with low energy and mood concerns."},
    ],
    "hair_loss": [
        {"key": "ferritin", "name": "Ferritin", "reason": "Iron storage is often reviewed in hair shedding discussions."},
        {"key": "zinc", "name": "Zinc", "reason": "Zinc status can be relevant to hair and skin health conversations."},
        {"key": "tsh", "name": "TSH", "reason": "Thyroid markers are commonly checked when hair loss is persistent."},
    ],
    "sleep_issues": [
        {"key": "magnesium", "name": "Magnesium", "reason": "Magnesium status is often discussed around sleep quality and muscle tension."},
        {"key": "vitamin_d", "name": "Vitamin D", "reason": "Vitamin D is commonly reviewed alongside sleep and mood patterns."},
        {"key": "cortisol_discussion", "name": "Cortisol discussion", "reason": "Stress rhythm may be worth discussing with a qualified clinician."},
    ],
    "brain_fog": [
        {"key": "b12", "name": "Vitamin B12", "reason": "B12 is often reviewed for cognitive and nerve-related symptoms."},
        {"key": "ferritin", "name": "Ferritin", "reason": "Iron storage can be relevant when brain fog overlaps with fatigue."},
        {"key": "tsh", "name": "TSH", "reason": "Thyroid status can be part of a brain fog workup."},
    ],
    "digestive_issues": [
        {"key": "crp", "name": "CRP", "reason": "Inflammation markers may be discussed when symptoms persist."},
        {"key": "b12", "name": "Vitamin B12", "reason": "B12 status can be relevant when digestion and absorption are concerns."},
        {"key": "ferritin", "name": "Ferritin", "reason": "Iron storage may be reviewed if digestive symptoms overlap with fatigue."},
    ],
}

DEFAULT_LABS = [
    {"key": "cbc", "name": "CBC", "reason": "A complete blood count is often a baseline discussion point for persistent symptoms."},
    {"key": "cmp", "name": "CMP", "reason": "A metabolic panel gives broad context for liver, kidney, glucose, and electrolyte status."},
    {"key": "tsh", "name": "TSH", "reason": "Thyroid screening is commonly discussed across energy, weight, and mood concerns."},
]


class FunnelEventRequest(BaseModel):
    session_id: str = Field(..., min_length=8, max_length=120)
    event_name: str = Field(..., min_length=2, max_length=80)
    properties: Dict[str, Any] = Field(default_factory=dict)


class SymptomAssessmentRequest(BaseModel):
    session_id: str = Field(..., min_length=8, max_length=120)
    symptoms: List[str] = Field(..., min_length=1, max_length=12)
    duration: str = Field(..., min_length=2, max_length=80)
    age_range: Optional[str] = Field(default=None, max_length=40)
    sex: Optional[str] = Field(default=None, max_length=40)
    email: Optional[str] = Field(default=None, max_length=254)
    source: Optional[str] = Field(default=None, max_length=120)


class EmailCaptureRequest(BaseModel):
    session_id: str = Field(..., min_length=8, max_length=120)
    assessment_id: str = Field(..., min_length=8, max_length=80)
    email: str = Field(..., min_length=3, max_length=254)


def _client_context(request: Request) -> Dict[str, Any]:
    return {
        "user_agent": request.headers.get("user-agent"),
        "referer": request.headers.get("referer"),
    }


def _normalize_symptom(value: str) -> str:
    cleaned = re.sub(r"[^a-z0-9]+", "_", value.strip().lower())
    return cleaned.strip("_")


def _validate_email(value: Optional[str]) -> Optional[str]:
    if value is None:
        return None
    normalized = value.strip().lower()
    if not re.match(r"^[^@\s]+@[^@\s]+\.[^@\s]+$", normalized):
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Invalid email.")
    return normalized


def _recommend_labs(symptoms: List[str]) -> List[Dict[str, str]]:
    by_key: Dict[str, Dict[str, str]] = {}
    for symptom in symptoms:
        for lab in SYMPTOM_LAB_MAP.get(_normalize_symptom(symptom), []):
            by_key.setdefault(lab["key"], lab)

    if not by_key:
        for lab in DEFAULT_LABS:
            by_key[lab["key"]] = lab

    return list(by_key.values())[:6]


async def _record_event(session_id: str, event_name: str, properties: Dict[str, Any], request: Request) -> None:
    if event_name not in EVENT_NAMES:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Unsupported funnel event.")

    sb = svc._get_supabase()
    payload = {
        "session_id": session_id,
        "event_name": event_name,
        "properties": {**(properties or {}), "request": _client_context(request)},
    }
    await svc._run(lambda: sb.table("public_funnel_events").insert(payload).execute())


@router.post("/events", status_code=status.HTTP_202_ACCEPTED)
async def track_public_funnel_event(body: FunnelEventRequest, request: Request):
    await _record_event(body.session_id, body.event_name, body.properties, request)
    return {"ok": True}


@router.post("/symptom-intake", status_code=status.HTTP_201_CREATED)
async def submit_symptom_intake(body: SymptomAssessmentRequest, request: Request):
    recommended_labs = _recommend_labs(body.symptoms)
    email = _validate_email(body.email)
    sb = svc._get_supabase()
    payload = {
        "session_id": body.session_id,
        "symptoms": body.symptoms,
        "duration": body.duration,
        "age_range": body.age_range,
        "sex": body.sex,
        "email": email,
        "recommended_labs": recommended_labs,
        "source": body.source,
        "metadata": _client_context(request),
    }

    resp = await svc._run(lambda: sb.table("symptom_assessments").insert(payload).execute())
    assessment = (resp.data or [{}])[0]

    await _record_event(
        body.session_id,
        "symptom_completed",
        {"assessment_id": assessment.get("id"), "symptom_count": len(body.symptoms), "duration": body.duration},
        request,
    )
    await _record_event(
        body.session_id,
        "results_viewed",
        {"assessment_id": assessment.get("id"), "recommended_lab_count": len(recommended_labs)},
        request,
    )

    return {
        "assessment_id": assessment.get("id"),
        "recommended_labs": recommended_labs,
        "disclaimer": "This is wellness education, not a diagnosis. Discuss symptoms and testing decisions with a qualified healthcare professional.",
    }


@router.post("/email", status_code=status.HTTP_202_ACCEPTED)
async def capture_assessment_email(body: EmailCaptureRequest, request: Request):
    email = _validate_email(body.email)
    sb = svc._get_supabase()
    await svc._run(
        lambda: sb.table("symptom_assessments")
        .update({"email": email})
        .eq("id", body.assessment_id)
        .eq("session_id", body.session_id)
        .execute()
    )
    await _record_event(
        body.session_id,
        "email_submitted",
        {"assessment_id": body.assessment_id, "email_domain": email.split("@")[-1]},
        request,
    )
    return {"ok": True}

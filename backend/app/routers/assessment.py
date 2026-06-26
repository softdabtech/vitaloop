from __future__ import annotations

import re
import logging
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, HTTPException, Request, status
from pydantic import BaseModel, Field

from app.services import supabase_service as svc
from app.services.ua_wellbeing_openai import generate_ua_wellbeing_assessment

router = APIRouter()
logger = logging.getLogger(__name__)

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
    "ua_wellbeing_started",
    "ua_wellbeing_completed",
    "ua_wellbeing_result_viewed",
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


class UaWellbeingAssessmentRequest(BaseModel):
    session_id: str = Field(..., min_length=8, max_length=120)
    symptoms: List[str] = Field(..., min_length=1, max_length=12)
    duration: str = Field(..., min_length=2, max_length=80)
    intensity: int = Field(..., ge=1, le=5)
    context: Optional[str] = Field(default=None, max_length=500)
    age_range: Optional[str] = Field(default=None, max_length=40)
    family_context: Optional[str] = Field(default=None, max_length=80)
    source: Optional[str] = Field(default="ua.vitaloop.today", max_length=120)


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


def _fallback_ua_wellbeing_result(body: UaWellbeingAssessmentRequest) -> Dict[str, Any]:
    symptom_text = ", ".join(body.symptoms[:3])
    level = "attention" if body.intensity >= 4 else "watch" if body.intensity >= 3 else "stable"
    labs = [
        {"name": "ЗАК", "reason": "Базово допомагає побачити загальний контекст крові."},
        {"name": "Феритин", "reason": "Часто обговорюють при втомі, слабкості або випадінні волосся."},
        {"name": "25(OH)D", "reason": "Може бути корисним у контексті енергії, відновлення і сезонності."},
        {"name": "TSH", "reason": "Щитоподібну залозу часто перевіряють при енергії, сні та концентрації."},
    ]
    if any("дит" in item.lower() for item in [body.family_context or "", *body.symptoms]):
        labs = [
            {"name": "ЗАК", "reason": "Базовий старт для розмови з педіатром."},
            {"name": "Феритин", "reason": "Запаси заліза часто переглядають при втомлюваності у дітей."},
            {"name": "25(OH)D", "reason": "Варто оцінювати разом із сезоном, харчуванням і розвитком."},
        ]

    return {
        "headline": f"Є карта уваги для: {symptom_text}",
        "priority_level": level,
        "summary": "Це не діагноз, а стартова структура для розмови. Симптоми варто дивитися разом із тривалістю, інтенсивністю, сном, навантаженням і результатами аналізів.",
        "possible_links": [
            "Втома, сон і концентрація часто потребують спільного контексту.",
            "Дефіцити, відновлення і стрес можуть давати схожі сигнали.",
            "Динаміка важливіша за один окремий день самопочуття.",
        ],
        "lab_directions": labs[:4],
        "doctor_questions": [
            "Які з цих симптомів варто перевірити першими?",
            "Які аналізи мають сенс саме для моєї ситуації?",
            "Коли доречно повторити перевірку в динаміці?",
        ],
        "next_steps": [
            "Збережіть цей підсумок і додайте аналізи, якщо вони вже є.",
            "Запишіть, коли симптоми посилюються або слабшають.",
            "Обговоріть пріоритети з лікарем, якщо стан триває або погіршується.",
        ],
        "disclaimer": "Освітній підсумок VITALOOP не є діагнозом і не замінює консультацію лікаря.",
    }


def _sanitize_ua_wellbeing_result(raw: Dict[str, Any] | None, body: UaWellbeingAssessmentRequest) -> Dict[str, Any]:
    fallback = _fallback_ua_wellbeing_result(body)
    if not isinstance(raw, dict):
        return fallback

    def text(key: str, max_len: int) -> str:
        value = str(raw.get(key) or fallback[key]).strip()
        return value[:max_len].strip() or fallback[key]

    def text_list(key: str, max_items: int, max_len: int) -> List[str]:
        source = raw.get(key)
        values = source if isinstance(source, list) else fallback[key]
        clean = [str(item).strip()[:max_len].strip() for item in values if str(item or "").strip()]
        return clean[:max_items] or fallback[key]

    def lab_list() -> List[Dict[str, str]]:
        source = raw.get("lab_directions")
        values = source if isinstance(source, list) else fallback["lab_directions"]
        clean: List[Dict[str, str]] = []
        for item in values:
            if not isinstance(item, dict):
                continue
            name = str(item.get("name") or "").strip()[:80].strip()
            reason = str(item.get("reason") or "").strip()[:140].strip()
            if name and reason:
                clean.append({"name": name, "reason": reason})
        return clean[:5] or fallback["lab_directions"]

    level = str(raw.get("priority_level") or fallback["priority_level"]).strip().lower()
    if level not in {"stable", "watch", "attention"}:
        level = fallback["priority_level"]

    return {
        "headline": text("headline", 120),
        "priority_level": level,
        "summary": text("summary", 520),
        "possible_links": text_list("possible_links", 4, 120),
        "lab_directions": lab_list(),
        "doctor_questions": text_list("doctor_questions", 4, 140),
        "next_steps": text_list("next_steps", 4, 130),
        "disclaimer": text("disclaimer", 220),
    }


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


async def _try_record_event(session_id: str, event_name: str, properties: Dict[str, Any], request: Request) -> bool:
    try:
        await _record_event(session_id, event_name, properties, request)
        return True
    except HTTPException:
        raise
    except Exception as exc:
        logger.warning("public_funnel_event_failed event=%s error=%r", event_name, exc)
        return False


@router.post("/events", status_code=status.HTTP_202_ACCEPTED)
async def track_public_funnel_event(body: FunnelEventRequest, request: Request):
    stored = await _try_record_event(body.session_id, body.event_name, body.properties, request)
    return {"ok": True, "stored": stored}


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

    stored = True
    try:
        resp = await svc._run(lambda: sb.table("symptom_assessments").insert(payload).execute())
        assessment = (resp.data or [{}])[0]
    except Exception as exc:
        logger.warning("symptom_assessment_storage_failed session_id=%s error=%r", body.session_id, exc)
        stored = False
        assessment = {"id": f"pending:{body.session_id}"}

    await _try_record_event(
        body.session_id,
        "symptom_completed",
        {"assessment_id": assessment.get("id"), "symptom_count": len(body.symptoms), "duration": body.duration},
        request,
    )
    await _try_record_event(
        body.session_id,
        "results_viewed",
        {"assessment_id": assessment.get("id"), "recommended_lab_count": len(recommended_labs)},
        request,
    )

    return {
        "assessment_id": assessment.get("id"),
        "recommended_labs": recommended_labs,
        "stored": stored,
        "disclaimer": "This is wellness education, not a diagnosis. Discuss symptoms and testing decisions with a qualified healthcare professional.",
    }


@router.post("/ua-wellbeing", status_code=status.HTTP_201_CREATED)
async def submit_ua_wellbeing_assessment(body: UaWellbeingAssessmentRequest, request: Request):
    result = _sanitize_ua_wellbeing_result(
        await generate_ua_wellbeing_assessment(
            symptoms=body.symptoms,
            duration=body.duration,
            intensity=body.intensity,
            context=body.context,
            age_range=body.age_range,
            family_context=body.family_context,
        ),
        body,
    )

    sb = svc._get_supabase()
    payload = {
        "session_id": body.session_id,
        "symptoms": body.symptoms,
        "duration": body.duration,
        "age_range": body.age_range,
        "sex": None,
        "email": None,
        "recommended_labs": result.get("lab_directions", []),
        "source": body.source or "ua.vitaloop.today",
        "metadata": {
            **_client_context(request),
            "locale": "uk",
            "intensity": body.intensity,
            "context": body.context,
            "family_context": body.family_context,
            "ua_wellbeing_result": result,
        },
    }

    stored = True
    try:
        resp = await svc._run(lambda: sb.table("symptom_assessments").insert(payload).execute())
        assessment = (resp.data or [{}])[0]
    except Exception as exc:
        logger.warning("ua_wellbeing_storage_failed session_id=%s error=%r", body.session_id, exc)
        stored = False
        assessment = {"id": f"pending:{body.session_id}"}

    await _try_record_event(
        body.session_id,
        "ua_wellbeing_completed",
        {
            "assessment_id": assessment.get("id"),
            "symptom_count": len(body.symptoms),
            "duration": body.duration,
            "intensity": body.intensity,
            "priority_level": result.get("priority_level"),
        },
        request,
    )
    await _try_record_event(
        body.session_id,
        "ua_wellbeing_result_viewed",
        {"assessment_id": assessment.get("id"), "lab_direction_count": len(result.get("lab_directions") or [])},
        request,
    )

    return {
        "assessment_id": assessment.get("id"),
        "result": result,
        "stored": stored,
    }


@router.post("/email", status_code=status.HTTP_202_ACCEPTED)
async def capture_assessment_email(body: EmailCaptureRequest, request: Request):
    email = _validate_email(body.email)
    sb = svc._get_supabase()
    stored = True
    try:
        await svc._run(
            lambda: sb.table("symptom_assessments")
            .update({"email": email})
            .eq("id", body.assessment_id)
            .eq("session_id", body.session_id)
            .execute()
        )
    except Exception as exc:
        logger.warning("symptom_assessment_email_storage_failed session_id=%s error=%r", body.session_id, exc)
        stored = False
    await _try_record_event(
        body.session_id,
        "email_submitted",
        {"assessment_id": body.assessment_id, "email_domain": email.split("@")[-1]},
        request,
    )
    return {"ok": True, "stored": stored}

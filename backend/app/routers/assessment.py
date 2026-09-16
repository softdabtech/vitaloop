from __future__ import annotations

import re
import logging
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, HTTPException, Request, status
from pydantic import BaseModel, Field

from app.services import supabase_service as svc
from app.services.ua_wellbeing_openai import generate_ua_wellbeing_assessment
from app.services.negative_evidence import _DOMAIN_MARKERS as _CLINICAL_DOMAIN_MARKERS
from app.services.negative_evidence import _HUMAN_MARKER_NAMES as _CLINICAL_MARKER_NAMES

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


# Which clinical domains (from the same domain vocabulary the deterministic
# reasoning engine uses in negative_evidence.py / evidence_gaps.py /
# evidence_debt.py / report_quality_audit.py) each pre-signup symptom maps
# to. There is no biomarker data at this point in the funnel, so this cannot
# run hypothesis_engine.py or clinical_contradictions.py (those require
# actual lab values) — but the *set of markers worth discussing* is derived
# from the engine's own canonical domain->marker map (_DOMAIN_MARKERS) below,
# instead of a separate, hand-maintained symptom->lab list that could drift
# out of sync with it. Only covers the domains negative_evidence.py already
# defines (iron_status, thyroid, micronutrients, inflammation,
# metabolic_health) — kidney/liver/cardiovascular are deliberately left out
# here since none of the ten intake symptoms map to them without lab data.
SYMPTOM_DOMAIN_MAP: Dict[str, List[str]] = {
    "fatigue": ["iron_status", "thyroid", "micronutrients"],
    "sleep_issues": ["micronutrients", "thyroid"],
    "hair_loss": ["iron_status", "thyroid"],
    "brain_fog": ["iron_status", "thyroid", "micronutrients"],
    "digestive_issues": ["inflammation", "iron_status", "micronutrients"],
    "joint_pain": ["inflammation"],
    "anxiety": ["thyroid", "micronutrients"],
    "cold_intolerance": ["thyroid"],
    "weight_change": ["thyroid", "metabolic_health"],
    "poor_immunity": ["micronutrients", "inflammation"],
}

_DOMAIN_DISCUSSION_REASONS = {
    "iron_status": "Iron storage and red-cell context are commonly part of this discussion.",
    "thyroid": "Thyroid screening is commonly discussed for these symptoms.",
    "micronutrients": "Key vitamin and mineral levels are often reviewed alongside these symptoms.",
    "metabolic_health": "Glucose and metabolic markers are often part of this discussion.",
    "inflammation": "Inflammation markers may be relevant when these symptoms persist.",
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
    domains: List[str] = []
    for symptom in symptoms:
        for domain in SYMPTOM_DOMAIN_MAP.get(_normalize_symptom(symptom), []):
            if domain not in domains:
                domains.append(domain)

    by_key: Dict[str, Dict[str, str]] = {}
    for domain in domains:
        spec = _CLINICAL_DOMAIN_MARKERS.get(domain)
        if not spec:
            continue
        reason = _DOMAIN_DISCUSSION_REASONS.get(domain, "Often part of this discussion.")
        for marker in spec.get("required") or []:
            if marker in by_key:
                continue
            by_key[marker] = {
                "key": marker,
                "name": _CLINICAL_MARKER_NAMES.get(marker, marker.replace("_", " ")),
                "reason": reason,
            }

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

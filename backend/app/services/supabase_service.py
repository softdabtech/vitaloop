import asyncio
from collections import Counter
from datetime import datetime, timedelta, timezone
from fastapi import HTTPException
from supabase import create_client, Client
from app.config import settings
from typing import List, Dict, Any, Optional

_supabase: Optional[Client] = None

SYMPTOM_ZONE_MAP: Dict[str, List[str]] = {
    "brain": ["brain_fog", "poor_concentration", "mood_swings", "depression", "anxiety"],
    "thyroid": ["cold_intolerance", "weight_gain", "hair_loss", "fatigue"],
    "heart": ["poor_immunity", "fatigue", "anxiety"],
    "liver": ["skin_problems", "mood_swings", "digestive_issues"],
    "gut": ["digestive_issues", "poor_immunity", "weight_gain", "weight_loss"],
    "muscles": ["muscle_weakness", "fatigue", "low_libido"],
    "joints": ["joint_pain", "muscle_weakness"],
    "nervous": ["insomnia", "anxiety", "brain_fog", "poor_concentration"],
}

SYMPTOM_LABELS: Dict[str, str] = {
    "fatigue": "Fatigue",
    "insomnia": "Insomnia",
    "brain_fog": "Brain Fog",
    "anxiety": "Anxiety",
    "depression": "Depression",
    "hair_loss": "Hair Loss",
    "weight_gain": "Weight Gain",
    "weight_loss": "Weight Loss",
    "low_libido": "Low Libido",
    "muscle_weakness": "Muscle Weakness",
    "joint_pain": "Joint Pain",
    "poor_immunity": "Poor Immunity",
    "digestive_issues": "Digestive Issues",
    "skin_problems": "Skin Problems",
    "mood_swings": "Mood Swings",
    "poor_concentration": "Poor Concentration",
    "cold_intolerance": "Cold Intolerance",
}


def _run(fn):
    """Run a synchronous Supabase call in a thread pool to avoid blocking the event loop."""
    return asyncio.to_thread(fn)


def _get_supabase() -> Client:
    global _supabase
    if _supabase is None:
        if not settings.supabase_url or not settings.supabase_service_key:
            raise RuntimeError("Supabase is not configured. Set SUPABASE_URL and SUPABASE_SERVICE_KEY.")
        _supabase = create_client(settings.supabase_url, settings.supabase_service_key)
    return _supabase


async def save_lab_upload(
    user_id: str,
    extracted_text: str,
    lab_name: Optional[str] = None,
    test_date: Optional[str] = None,
    ocr_confidence: Optional[float] = None,
    analyze_prompt_version: Optional[str] = None,
) -> Dict:
    supabase = _get_supabase()
    payload: Dict[str, Any] = {
        "user_id": user_id,
        "extracted_text": extracted_text,
        "status": "processing",
    }
    if lab_name:
        payload["lab_name"] = lab_name
    if test_date:
        payload["test_date"] = test_date
    if ocr_confidence is not None:
        payload["ocr_confidence"] = ocr_confidence
    if analyze_prompt_version:
        payload["analyze_prompt_version"] = analyze_prompt_version

    resp = await _run(lambda: supabase.table("lab_uploads").insert(payload).execute())
    return resp.data[0]


async def save_biomarkers(upload_id: str, user_id: str, biomarkers: List[Dict]) -> List[Dict]:
    supabase = _get_supabase()
    rows = [
        {
            "upload_id": upload_id,
            "user_id": user_id,
            "name": b["name"],
            "value": b["value"],
            "unit": b["unit"],
            "ref_low": b.get("ref_low"),
            "ref_high": b.get("ref_high"),
            "status": b["status"],
            "category": b.get("category"),
        }
        for b in biomarkers
    ]
    resp = await _run(lambda: supabase.table("biomarkers").insert(rows).execute())
    await _run(lambda: supabase.table("lab_uploads").update({"status": "done"}).eq("id", upload_id).execute())
    return resp.data


async def assert_upload_belongs_to_user(upload_id: str, user_id: str) -> Dict:
    supabase = _get_supabase()
    resp = await _run(
        lambda: supabase.table("lab_uploads")
        .select("id,user_id")
        .eq("id", upload_id)
        .eq("user_id", user_id)
        .limit(1)
        .execute()
    )
    if not resp.data:
        raise HTTPException(status_code=404, detail={"detail": "Upload not found", "code": "UPLOAD_NOT_FOUND"})
    return resp.data[0]


async def get_biomarkers_by_upload(upload_id: str, user_id: str) -> List[Dict]:
    supabase = _get_supabase()
    resp = await _run(
        lambda: supabase.table("biomarkers")
        .select("*")
        .eq("upload_id", upload_id)
        .eq("user_id", user_id)
        .execute()
    )
    return resp.data


async def save_protocol(
    user_id: str,
    upload_id: str,
    recommendations: List[Dict],
    prompt_version: Optional[str] = None,
) -> Dict:
    supabase = _get_supabase()

    existing = await _run(
        lambda: supabase.table("protocols")
        .select("id")
        .eq("user_id", user_id)
        .eq("upload_id", upload_id)
        .limit(1)
        .execute()
    )

    payload: Dict[str, Any] = {"recommendations": recommendations}
    if prompt_version:
        payload["prompt_version"] = prompt_version

    if existing.data:
        protocol_id = existing.data[0]["id"]
        updated = await _run(
            lambda: supabase.table("protocols")
            .update(payload)
            .eq("id", protocol_id)
            .execute()
        )
        return updated.data[0]

    create_payload: Dict[str, Any] = {
        "user_id": user_id,
        "upload_id": upload_id,
        "recommendations": recommendations,
    }
    if prompt_version:
        create_payload["prompt_version"] = prompt_version

    resp = await _run(lambda: supabase.table("protocols").insert(create_payload).execute())
    return resp.data[0]


async def save_symptoms(user_id: str, upload_id: str, tags: List[str], severity: int = 5) -> Dict:
    supabase = _get_supabase()
    resp = await _run(
        lambda: supabase.table("symptoms")
        .insert({"user_id": user_id, "upload_id": upload_id, "tags": tags, "severity": severity})
        .execute()
    )
    return resp.data[0]


def _build_symptom_summary(rows: List[Dict[str, Any]], days: int) -> Dict[str, Any]:
    symptom_counts: Counter = Counter()
    zone_scores: Dict[str, float] = {zone: 0.0 for zone in SYMPTOM_ZONE_MAP}
    total_severity = 0

    for row in rows:
        tags = row.get("tags") or []
        severity = int(row.get("severity") or 5)
        total_severity += severity

        for tag in tags:
            symptom_counts[tag] += 1
            for zone, zone_tags in SYMPTOM_ZONE_MAP.items():
                if tag in zone_tags:
                    zone_scores[zone] += severity

    entries = len(rows)
    avg_severity = round((total_severity / entries), 2) if entries else 0
    max_zone_score = max(zone_scores.values()) if zone_scores else 0

    top_symptoms = [
        {
            "tag": tag,
            "label": SYMPTOM_LABELS.get(tag, tag.replace("_", " ").title()),
            "count": count,
        }
        for tag, count in symptom_counts.most_common(5)
    ]

    top_zones = [
        {
            "zone": zone,
            "score": round(score, 2),
            "normalized_score": round((score / max_zone_score), 3) if max_zone_score > 0 else 0,
        }
        for zone, score in sorted(zone_scores.items(), key=lambda item: item[1], reverse=True)
        if score > 0
    ]

    recent_logs = [
        {
            "id": row.get("id"),
            "created_at": row.get("created_at"),
            "severity": row.get("severity"),
            "tags": row.get("tags") or [],
        }
        for row in rows[:10]
    ]

    return {
        "window_days": days,
        "entries": entries,
        "average_severity": avg_severity,
        "top_symptoms": top_symptoms,
        "top_zones": top_zones,
        "recent_logs": recent_logs,
    }


async def get_user_symptom_summary(user_id: str, days: int = 30) -> Dict[str, Any]:
    supabase = _get_supabase()
    since = (datetime.now(timezone.utc) - timedelta(days=days)).isoformat()

    resp = await _run(
        lambda: supabase.table("symptoms")
        .select("id, tags, severity, created_at")
        .eq("user_id", user_id)
        .gte("created_at", since)
        .order("created_at", desc=True)
        .execute()
    )

    rows = resp.data or []
    return _build_symptom_summary(rows, days)


async def get_platform_symptom_summary(days: int = 30) -> Dict[str, Any]:
    supabase = _get_supabase()
    since = (datetime.now(timezone.utc) - timedelta(days=days)).isoformat()

    resp = await _run(
        lambda: supabase.table("symptoms")
        .select("id, user_id, tags, severity, created_at")
        .gte("created_at", since)
        .order("created_at", desc=True)
        .execute()
    )

    rows = resp.data or []
    summary = _build_symptom_summary(rows, days)
    summary["users_reporting"] = len({row.get("user_id") for row in rows if row.get("user_id")})
    return summary


async def update_user_subscription(user_id: str, sub_status: str, sub_id: Optional[str] = None) -> None:
    supabase = _get_supabase()
    payload: Dict[str, Any] = {"sub_status": sub_status}
    if sub_id:
        payload["sub_id"] = sub_id
    await _run(lambda: supabase.table("users").update(payload).eq("id", user_id).execute())


async def get_user_by_stripe_sub(sub_id: str) -> Optional[Dict]:
    supabase = _get_supabase()
    resp = await _run(lambda: supabase.table("users").select("id").eq("sub_id", sub_id).execute())
    return resp.data[0] if resp.data else None


async def get_user_progress(user_id: str) -> List[Dict]:
    supabase = _get_supabase()
    uploads = await _run(
        lambda: supabase.table("lab_uploads")
        .select("id, created_at, lab_name, test_date")
        .eq("user_id", user_id)
        .order("created_at", desc=False)
        .execute()
    )

    result = []
    for upload in uploads.data:
        biomarkers = await _run(
            lambda u=upload: supabase.table("biomarkers")
            .select("name, value, unit, status, ref_low, ref_high")
            .eq("upload_id", u["id"])
            .execute()
        )
        result.append({**upload, "biomarkers": biomarkers.data})
    return result

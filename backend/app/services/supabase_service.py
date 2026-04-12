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


async def get_admin_overview() -> Dict[str, Any]:
    """Aggregate platform metrics for the /admin/overview endpoint."""
    supabase = _get_supabase()
    cutoff_30d = (datetime.now(timezone.utc) - timedelta(days=30)).isoformat()
    cutoff_7d = (datetime.now(timezone.utc) - timedelta(days=7)).isoformat()

    total_users_resp = await _run(
        lambda: supabase.table("users").select("id", count="exact").execute()
    )
    total_users = total_users_resp.count or len(total_users_resp.data)

    active_users_resp = await _run(
        lambda: supabase.table("users")
        .select("id", count="exact")
        .gte("updated_at", cutoff_30d)
        .execute()
    )
    active_users = active_users_resp.count or len(active_users_resp.data)

    premium_resp = await _run(
        lambda: supabase.table("users")
        .select("id", count="exact")
        .eq("sub_status", "active")
        .execute()
    )
    premium_subscribers = premium_resp.count or len(premium_resp.data)

    total_uploads_resp = await _run(
        lambda: supabase.table("lab_uploads").select("id", count="exact").execute()
    )
    total_uploads = total_uploads_resp.count or len(total_uploads_resp.data)

    weekly_uploads_resp = await _run(
        lambda: supabase.table("lab_uploads")
        .select("id", count="exact")
        .gte("created_at", cutoff_7d)
        .execute()
    )
    weekly_uploads = weekly_uploads_resp.count or len(weekly_uploads_resp.data)

    return {
        "total_users": total_users,
        "active_users": active_users,
        "premium_subscribers": premium_subscribers,
        "total_uploads": total_uploads,
        "weekly_uploads": weekly_uploads,
        "mrr": 0,  # requires Stripe data — placeholder


    # ──────────────────────────────────────────────
    # PROFILE
    # ──────────────────────────────────────────────

    async def get_user_profile(user_id: str) -> Dict[str, Any]:
        supabase = _get_supabase()
        resp = await _run(
            lambda: supabase.table("user_profile")
            .select("*")
            .eq("id", user_id)
            .limit(1)
            .execute()
        )
        return resp.data[0] if resp.data else {}


    async def upsert_user_profile(user_id: str, data: Dict[str, Any]) -> Dict[str, Any]:
        supabase = _get_supabase()
        payload = {"id": user_id, **data, "updated_at": datetime.now(timezone.utc).isoformat()}
        resp = await _run(
            lambda: supabase.table("user_profile")
            .upsert(payload, on_conflict="id")
            .execute()
        )
        await _emit_timeline(user_id, "profile_updated", "Profile updated", metadata={"fields": list(data.keys())})
        return resp.data[0] if resp.data else payload


    async def get_user_location(user_id: str) -> Optional[Dict]:
        supabase = _get_supabase()
        resp = await _run(
            lambda: supabase.table("user_locations")
            .select("*")
            .eq("user_id", user_id)
            .eq("is_primary", True)
            .limit(1)
            .execute()
        )
        return resp.data[0] if resp.data else None


    async def upsert_user_location(user_id: str, data: Dict[str, Any]) -> Dict[str, Any]:
        supabase = _get_supabase()
        await _run(lambda: supabase.table("user_locations").delete().eq("user_id", user_id).execute())
        payload = {"user_id": user_id, "is_primary": True, **data}
        resp = await _run(lambda: supabase.table("user_locations").insert(payload).execute())
        return resp.data[0] if resp.data else payload


    # ──────────────────────────────────────────────
    # RECURRING COMPLAINTS
    # ──────────────────────────────────────────────

    async def get_complaints(user_id: str) -> List[Dict]:
        supabase = _get_supabase()
        resp = await _run(
            lambda: supabase.table("recurring_complaints")
            .select("*")
            .eq("user_id", user_id)
            .order("created_at", desc=False)
            .execute()
        )
        return resp.data or []


    async def add_complaint(user_id: str, complaint: str, duration: Optional[str] = None, tried: Optional[str] = None) -> Dict:
        supabase = _get_supabase()
        payload: Dict[str, Any] = {"user_id": user_id, "complaint": complaint}
        if duration:
            payload["duration_description"] = duration
        if tried:
            payload["tried_interventions"] = tried
        resp = await _run(lambda: supabase.table("recurring_complaints").insert(payload).execute())
        await _emit_timeline(user_id, "complaint_added", f"Complaint added: {complaint[:60]}")
        return resp.data[0]


    async def delete_complaint(user_id: str, complaint_id: str) -> None:
        supabase = _get_supabase()
        await _run(
            lambda: supabase.table("recurring_complaints")
            .delete()
            .eq("id", complaint_id)
            .eq("user_id", user_id)
            .execute()
        )


    # ──────────────────────────────────────────────
    # WEEKLY CHECK-INS
    # ──────────────────────────────────────────────

    async def submit_weekly_checkin(user_id: str, data: Dict[str, Any]) -> Dict:
        supabase = _get_supabase()
        payload = {"user_id": user_id, **data}
        resp = await _run(
            lambda: supabase.table("checkins_weekly")
            .upsert(payload, on_conflict="user_id,week_start")
            .execute()
        )
        result = resp.data[0] if resp.data else payload
        await _emit_timeline(user_id, "weekly_checkin_submitted", f"Weekly check-in submitted for {data.get('week_start', 'this week')}")
        await _evaluate_checkin_red_flags(user_id, data)
        return result


    async def _evaluate_checkin_red_flags(user_id: str, data: Dict[str, Any]) -> None:
        flags = []
        if data.get("energy_score", 10) <= 2:
            flags.append("Very low energy reported")
        if data.get("mood_score", 10) <= 2:
            flags.append("Very low mood reported")
        if data.get("sleep_quality", 10) <= 2:
            flags.append("Severely disrupted sleep reported")
        if flags:
            await create_red_flag(user_id, "checkin_response", "; ".join(flags), metadata={"checkin": data})


    async def get_weekly_checkins(user_id: str, limit: int = 12) -> List[Dict]:
        supabase = _get_supabase()
        resp = await _run(
            lambda: supabase.table("checkins_weekly")
            .select("*")
            .eq("user_id", user_id)
            .order("week_start", desc=True)
            .limit(limit)
            .execute()
        )
        return resp.data or []


    # ──────────────────────────────────────────────
    # RED FLAGS
    # ──────────────────────────────────────────────

    async def create_red_flag(user_id: str, trigger_type: str, summary: str,
                               severity: str = "high", metadata: Optional[Dict] = None) -> Dict:
        supabase = _get_supabase()
        payload: Dict[str, Any] = {
            "user_id": user_id,
            "trigger_type": trigger_type,
            "summary": summary,
            "severity": severity,
            "metadata": metadata or {},
        }
        resp = await _run(lambda: supabase.table("red_flag_events").insert(payload).execute())
        await _emit_timeline(user_id, "red_flag_triggered", f"Red flag: {summary[:80]}", metadata={"severity": severity})
        return resp.data[0] if resp.data else payload


    async def get_user_red_flags(user_id: str) -> List[Dict]:
        supabase = _get_supabase()
        resp = await _run(
            lambda: supabase.table("red_flag_events")
            .select("*")
            .eq("user_id", user_id)
            .order("created_at", desc=True)
            .execute()
        )
        return resp.data or []


    async def acknowledge_red_flag(user_id: str, flag_id: str) -> Dict:
        supabase = _get_supabase()
        resp = await _run(
            lambda: supabase.table("red_flag_events")
            .update({"acknowledged": True, "acknowledged_at": datetime.now(timezone.utc).isoformat()})
            .eq("id", flag_id)
            .eq("user_id", user_id)
            .execute()
        )
        return resp.data[0] if resp.data else {}


    async def get_all_red_flags(acknowledged: Optional[bool] = False) -> List[Dict]:
        supabase = _get_supabase()
        query = supabase.table("red_flag_events").select("*, users(email, full_name)")
        if acknowledged is not None:
            query = query.eq("acknowledged", acknowledged)
        resp = await _run(lambda: query.order("created_at", desc=True).limit(200).execute())
        return resp.data or []


    # ──────────────────────────────────────────────
    # INSIGHTS
    # ──────────────────────────────────────────────

    async def generate_insights(user_id: str) -> List[Dict]:
        """Rule-based MVP insight engine."""
        supabase = _get_supabase()
        insights_list: List[Dict] = []

        symptom_data = await get_user_symptom_summary(user_id, days=30)
        prev_symptom_data = await get_user_symptom_summary(user_id, days=60)
        if symptom_data["average_severity"] > 0 and prev_symptom_data["average_severity"] > 0:
            delta = symptom_data["average_severity"] - prev_symptom_data["average_severity"]
            if delta <= -1.0:
                insights_list.append({
                    "insight_type": "symptom_trend",
                    "title": "Symptom severity improving",
                    "body": f"Your average symptom severity decreased by {abs(delta):.1f} points over the last 30 days.",
                    "priority": 1,
                })
            elif delta >= 1.5:
                insights_list.append({
                    "insight_type": "symptom_trend",
                    "title": "Symptom severity increasing",
                    "body": "Your symptoms appear to be worsening. Consider consulting a physician if this persists.",
                    "priority": 4,
                })

        uploads_resp = await _run(
            lambda: supabase.table("lab_uploads")
            .select("created_at")
            .eq("user_id", user_id)
            .order("created_at", desc=True)
            .limit(1)
            .execute()
        )
        if uploads_resp.data:
            last_upload = uploads_resp.data[0]["created_at"]
            days_since = (datetime.now(timezone.utc) - datetime.fromisoformat(last_upload.replace("Z", "+00:00"))).days
            if days_since >= 60:
                insights_list.append({
                    "insight_type": "retest_suggestion",
                    "title": "Time to re-test your labs",
                    "body": f"Your last lab upload was {days_since} days ago. Re-testing helps track progress accurately.",
                    "priority": 3,
                })

        checkins = await get_weekly_checkins(user_id, limit=4)
        if len(checkins) < 2:
            insights_list.append({
                "insight_type": "adherence",
                "title": "Start your weekly check-ins",
                "body": "Weekly check-ins personalize your health guidance. Complete your first check-in now.",
                "priority": 2,
            })

        if insights_list:
            rows = [{"user_id": user_id, **i} for i in insights_list]
            await _run(lambda: supabase.table("insights").insert(rows).execute())
            await _emit_timeline(user_id, "insight_created", f"{len(insights_list)} new insight(s) generated")

        return insights_list


    async def get_user_insights(user_id: str) -> List[Dict]:
        supabase = _get_supabase()
        resp = await _run(
            lambda: supabase.table("insights")
            .select("*")
            .eq("user_id", user_id)
            .eq("dismissed", False)
            .order("priority", desc=True)
            .order("created_at", desc=True)
            .limit(10)
            .execute()
        )
        return resp.data or []


    async def dismiss_insight(user_id: str, insight_id: str) -> None:
        supabase = _get_supabase()
        await _run(
            lambda: supabase.table("insights")
            .update({"dismissed": True})
            .eq("id", insight_id)
            .eq("user_id", user_id)
            .execute()
        )


    # ──────────────────────────────────────────────
    # HEALTH SCORE
    # ──────────────────────────────────────────────

    async def calculate_health_score(user_id: str) -> Dict[str, Any]:
        symptom_data = await get_user_symptom_summary(user_id, days=30)
        checkins = await get_weekly_checkins(user_id, limit=4)
        supabase = _get_supabase()

        avg_sev = symptom_data.get("average_severity", 5)
        symptom_component = round(max(0.0, 100.0 - (avg_sev * 10)), 2)
        adherence_component = round(min(100.0, (len(checkins) / 4) * 100), 2)

        bio_resp = await _run(
            lambda: supabase.table("biomarkers")
            .select("status")
            .eq("user_id", user_id)
            .order("created_at", desc=True)
            .limit(50)
            .execute()
        )
        bio_rows = bio_resp.data or []
        if bio_rows:
            optimal = sum(1 for b in bio_rows if b["status"] == "OPTIMAL")
            biomarker_component = round((optimal / len(bio_rows)) * 100, 2)
        else:
            biomarker_component = 50.0

        score = round((symptom_component * 0.4 + adherence_component * 0.2 + biomarker_component * 0.4), 2)
        result = {
            "score": score,
            "symptom_component": symptom_component,
            "biomarker_component": biomarker_component,
            "adherence_component": adherence_component,
            "calculated_at": datetime.now(timezone.utc).isoformat(),
        }
        await _run(lambda: supabase.table("health_scores").insert({"user_id": user_id, **result}).execute())
        return result


    # ──────────────────────────────────────────────
    # TIMELINE
    # ──────────────────────────────────────────────

    async def _emit_timeline(user_id: str, event_type: str, summary: str,
                              source: Optional[str] = None, metadata: Optional[Dict] = None) -> None:
        supabase = _get_supabase()
        payload = {
            "user_id": user_id,
            "event_type": event_type,
            "summary": summary,
            "source": source or "system",
            "metadata": metadata or {},
        }
        try:
            await _run(lambda: supabase.table("timeline_events").insert(payload).execute())
        except Exception:
            pass


    async def get_user_timeline(user_id: str, limit: int = 30) -> List[Dict]:
        supabase = _get_supabase()
        resp = await _run(
            lambda: supabase.table("timeline_events")
            .select("*")
            .eq("user_id", user_id)
            .order("occurred_at", desc=True)
            .limit(limit)
            .execute()
        )
        return resp.data or []


    # ──────────────────────────────────────────────
    # NOTIFICATIONS
    # ──────────────────────────────────────────────

    async def get_user_notifications(user_id: str, limit: int = 20) -> List[Dict]:
        supabase = _get_supabase()
        resp = await _run(
            lambda: supabase.table("notifications")
            .select("*")
            .eq("user_id", user_id)
            .order("created_at", desc=True)
            .limit(limit)
            .execute()
        )
        return resp.data or []


    async def create_notification(user_id: str, trigger_type: str, subject: str,
                                   body: str, channel: str = "in_app") -> Dict:
        supabase = _get_supabase()
        payload: Dict[str, Any] = {
            "user_id": user_id,
            "trigger_type": trigger_type,
            "channel": channel,
            "subject": subject,
            "body": body,
        }
        resp = await _run(lambda: supabase.table("notifications").insert(payload).execute())
        await _emit_timeline(user_id, "notification_sent", f"Notification: {subject[:60]}")
        return resp.data[0] if resp.data else payload


    # ──────────────────────────────────────────────
    # ADMIN HELPERS
    # ──────────────────────────────────────────────

    async def get_all_users_for_admin(limit: int = 200) -> List[Dict]:
        supabase = _get_supabase()
        resp = await _run(
            lambda: supabase.table("users")
            .select("id, email, full_name, age, sex, sub_status, created_at")
            .order("created_at", desc=True)
            .limit(limit)
            .execute()
        )
        return resp.data or []


    async def get_admin_user_detail(user_id: str) -> Dict[str, Any]:
        supabase = _get_supabase()
        user_resp, profile_resp, location_resp, complaints_resp, checkins_resp, uploads_resp, red_flags_resp, timeline_resp = \
            await asyncio.gather(
                _run(lambda: supabase.table("users").select("*").eq("id", user_id).limit(1).execute()),
                _run(lambda: supabase.table("user_profile").select("*").eq("id", user_id).limit(1).execute()),
                _run(lambda: supabase.table("user_locations").select("*").eq("user_id", user_id).execute()),
                _run(lambda: supabase.table("recurring_complaints").select("*").eq("user_id", user_id).execute()),
                _run(lambda: supabase.table("checkins_weekly").select("*").eq("user_id", user_id).order("week_start", desc=True).limit(12).execute()),
                _run(lambda: supabase.table("lab_uploads").select("id,lab_name,created_at,status").eq("user_id", user_id).order("created_at", desc=True).limit(10).execute()),
                _run(lambda: supabase.table("red_flag_events").select("*").eq("user_id", user_id).order("created_at", desc=True).execute()),
                _run(lambda: supabase.table("timeline_events").select("*").eq("user_id", user_id).order("occurred_at", desc=True).limit(20).execute()),
            )
        return {
            "user": user_resp.data[0] if user_resp.data else None,
            "profile": profile_resp.data[0] if profile_resp.data else None,
            "locations": location_resp.data or [],
            "complaints": complaints_resp.data or [],
            "checkins": checkins_resp.data or [],
            "uploads": uploads_resp.data or [],
            "red_flags": red_flags_resp.data or [],
            "timeline": timeline_resp.data or [],
        }
    }

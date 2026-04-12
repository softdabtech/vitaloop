import asyncio
from supabase import create_client, Client
from app.config import settings
from typing import List, Dict, Any, Optional

_supabase: Client = create_client(settings.supabase_url, settings.supabase_service_key)


def _run(fn):
    """Run a synchronous Supabase call in a thread pool to avoid blocking the event loop."""
    return asyncio.to_thread(fn)


async def save_lab_upload(
    user_id: str,
    extracted_text: str,
    lab_name: Optional[str] = None,
    test_date: Optional[str] = None,
    ocr_confidence: Optional[float] = None,
) -> Dict:
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

    resp = await _run(lambda: _supabase.table("lab_uploads").insert(payload).execute())
    return resp.data[0]


async def save_biomarkers(upload_id: str, user_id: str, biomarkers: List[Dict]) -> List[Dict]:
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
    resp = await _run(lambda: _supabase.table("biomarkers").insert(rows).execute())
    await _run(lambda: _supabase.table("lab_uploads").update({"status": "done"}).eq("id", upload_id).execute())
    return resp.data


async def get_biomarkers_by_upload(upload_id: str) -> List[Dict]:
    resp = await _run(lambda: _supabase.table("biomarkers").select("*").eq("upload_id", upload_id).execute())
    return resp.data


async def save_protocol(user_id: str, upload_id: str, recommendations: List[Dict]) -> Dict:
    resp = await _run(
        lambda: _supabase.table("protocols")
        .insert({"user_id": user_id, "upload_id": upload_id, "recommendations": recommendations})
        .execute()
    )
    return resp.data[0]


async def save_symptoms(user_id: str, upload_id: str, tags: List[str], severity: int = 5) -> Dict:
    resp = await _run(
        lambda: _supabase.table("symptoms")
        .insert({"user_id": user_id, "upload_id": upload_id, "tags": tags, "severity": severity})
        .execute()
    )
    return resp.data[0]


async def update_user_subscription(user_id: str, sub_status: str, sub_id: Optional[str] = None) -> None:
    payload: Dict[str, Any] = {"sub_status": sub_status}
    if sub_id:
        payload["sub_id"] = sub_id
    await _run(lambda: _supabase.table("users").update(payload).eq("id", user_id).execute())


async def get_user_by_stripe_sub(sub_id: str) -> Optional[Dict]:
    resp = await _run(lambda: _supabase.table("users").select("id").eq("sub_id", sub_id).execute())
    return resp.data[0] if resp.data else None


async def get_user_progress(user_id: str) -> List[Dict]:
    uploads = await _run(
        lambda: _supabase.table("lab_uploads")
        .select("id, created_at, lab_name, test_date")
        .eq("user_id", user_id)
        .order("created_at", desc=False)
        .execute()
    )

    result = []
    for upload in uploads.data:
        biomarkers = await _run(
            lambda u=upload: _supabase.table("biomarkers")
            .select("name, value, unit, status, ref_low, ref_high")
            .eq("upload_id", u["id"])
            .execute()
        )
        result.append({**upload, "biomarkers": biomarkers.data})
    return result

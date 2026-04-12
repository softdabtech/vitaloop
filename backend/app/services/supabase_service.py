from supabase import create_client, Client
from app.config import settings
from typing import List, Dict, Any, Optional

_supabase: Client = create_client(settings.supabase_url, settings.supabase_service_key)


async def save_lab_upload(
    user_id: str,
    extracted_text: str,
    lab_name: Optional[str] = None,
    test_date: Optional[str] = None,
    ocr_confidence: Optional[float] = None,
) -> Dict:
    payload = {
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

    resp = _supabase.table("lab_uploads").insert(payload).execute()
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
    resp = _supabase.table("biomarkers").insert(rows).execute()
    # Mark upload as done
    _supabase.table("lab_uploads").update({"status": "done"}).eq("id", upload_id).execute()
    return resp.data


async def get_biomarkers_by_upload(upload_id: str) -> List[Dict]:
    resp = _supabase.table("biomarkers").select("*").eq("upload_id", upload_id).execute()
    return resp.data


async def save_protocol(user_id: str, upload_id: str, recommendations: List[Dict]) -> Dict:
    resp = (
        _supabase.table("protocols")
        .insert({"user_id": user_id, "upload_id": upload_id, "recommendations": recommendations})
        .execute()
    )
    return resp.data[0]


async def get_user_progress(user_id: str) -> List[Dict]:
    uploads = (
        _supabase.table("lab_uploads")
        .select("id, created_at, lab_name, test_date")
        .eq("user_id", user_id)
        .order("created_at", desc=False)
        .execute()
    ).data

    result = []
    for upload in uploads:
        biomarkers = (
            _supabase.table("biomarkers")
            .select("name, value, unit, status, ref_low, ref_high")
            .eq("upload_id", upload["id"])
            .execute()
        ).data
        result.append({**upload, "biomarkers": biomarkers})
    return result

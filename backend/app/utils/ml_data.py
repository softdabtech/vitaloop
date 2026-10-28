from typing import List, Dict, Any
from app.services import supabase_service as svc

def get_anonymized_biomarkers_for_ml() -> List[Dict[str, Any]]:
    """
    Возвращает обезличенные данные биомаркеров для ML:
    - Без email, имени, user_id
    - Только значения, статус, дата, возраст, пол
    """
    supabase = svc._get_supabase()
    # Получаем все биомаркеры с присоединённым профилем пользователя
    resp = supabase.rpc("get_biomarkers_with_profile").execute()
    rows = resp.data or []
    anonymized = []
    for row in rows:
        anonymized.append({
            "biomarker": row.get("name"),
            "value": row.get("value"),
            "unit": row.get("unit"),
            "status": row.get("status"),
            "ref_low": row.get("ref_low"),
            "ref_high": row.get("ref_high"),
            "category": row.get("category"),
            "created_at": row.get("created_at"),
            "age": row.get("age"),
            "sex": row.get("sex"),
        })
    return anonymized

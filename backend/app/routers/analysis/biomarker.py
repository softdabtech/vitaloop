"""Biomarker normalization and analysis endpoints.

Single source of truth for biomarker status calculations.
All biomarker-related logic lives here - frontend should not duplicate.
"""

from fastapi import APIRouter, Depends, HTTPException
from typing import List, Dict, Any
from app.dependencies import get_current_user
from app.services import supabase_service as svc

router = APIRouter()


# Status metadata with styling and ranking
STATUS_META = {
    "DEFICIENT": {
        "rank": 0,
        "color": "rose",
        "badge": "bg-rose-50 text-rose-700",
        "border": "border-rose-300",
        "severity": "critical",
    },
    "ELEVATED": {
        "rank": 1,
        "color": "orange",
        "badge": "bg-orange-50 text-orange-700",
        "border": "border-orange-300",
        "severity": "high",
    },
    "BORDERLINE": {
        "rank": 2,
        "color": "amber",
        "badge": "bg-amber-50 text-amber-700",
        "border": "border-amber-300",
        "severity": "medium",
    },
    "OPTIMAL": {
        "rank": 3,
        "color": "emerald",
        "badge": "bg-emerald-50 text-emerald-700",
        "border": "border-emerald-300",
        "severity": "none",
    },
}


def normalize_biomarker_status(raw_status: str) -> str:
    """Normalize raw biomarker status to standard form.

    Maps various lab format variations to DEFICIENT, ELEVATED, BORDERLINE, OPTIMAL.
    """
    raw = str(raw_status or "").strip().upper()

    # Direct mappings
    mapping = {
        "OPTIMAL": "OPTIMAL",
        "NORMAL": "OPTIMAL",
        "N": "OPTIMAL",
        "BORDERLINE": "BORDERLINE",
        "LOW NORMAL": "BORDERLINE",
        "HIGH NORMAL": "BORDERLINE",
        "LOW": "DEFICIENT",
        "L": "DEFICIENT",
        "DEFICIENT": "DEFICIENT",
        "HIGH": "ELEVATED",
        "H": "ELEVATED",
        "ELEVATED": "ELEVATED",
        "CRITICAL": "ELEVATED",
    }

    if raw in mapping:
        return mapping[raw]

    # If no mapping found, return as-is and let frontend handle unknown status
    return raw


def compute_range_percent(biomarker: Dict[str, Any]) -> float:
    """Compute where biomarker falls within reference range (0-100%)."""
    try:
        low = float(biomarker.get("ref_low"))
        high = float(biomarker.get("ref_high"))
        value = float(biomarker.get("value"))

        if high <= low:
            return 0.0

        percent = max(0, min(100, ((value - low) / (high - low)) * 100))
        return round(percent, 2)
    except (TypeError, ValueError):
        return 0.0


def infer_status_from_range(biomarker: Dict[str, Any], default: str = "BORDERLINE") -> str:
    """Infer status from reference range if status field is missing."""
    try:
        low = float(biomarker.get("ref_low"))
        high = float(biomarker.get("ref_high"))
        value = float(biomarker.get("value"))

        if value < low:
            return "DEFICIENT"
        elif value > high:
            return "ELEVATED"
        else:
            return "OPTIMAL"
    except (TypeError, ValueError):
        return default


@router.post("/normalize/{lab_id}")
async def normalize_lab_biomarkers(
    lab_id: str,
    current_user: dict = Depends(get_current_user),
) -> Dict[str, Any]:
    """Normalize and enrich biomarker data from a lab upload.

    Single source of truth for biomarker analysis.
    Returns enriched biomarker data with status, color, severity, confidence.

    Frontend receives this once and caches via React Query.
    No logic duplication between frontend and backend.
    """
    user_id = current_user.get("sub")

    # Fetch lab data from database
    lab = await svc.get_lab_upload(lab_id, user_id)
    if not lab:
        raise HTTPException(status_code=404, detail="Lab upload not found")

    # Get extracted biomarkers (these come from Claude/OCR)
    biomarkers = lab.get("extracted_biomarkers") or []

    # Normalize each biomarker
    normalized = []
    for bm in biomarkers:
        # Get status - either from lab data or infer from range
        raw_status = bm.get("status") or ""
        if raw_status:
            status = normalize_biomarker_status(raw_status)
        else:
            status = infer_status_from_range(bm)

        # Get metadata for this status
        meta = STATUS_META.get(status, STATUS_META["BORDERLINE"])

        # Compute range position
        range_percent = compute_range_percent(bm)

        normalized.append({
            "id": bm.get("id") or bm.get("name", "").lower().replace(" ", "_"),
            "name": bm.get("name", ""),
            "value": bm.get("value"),
            "unit": bm.get("unit", ""),
            "ref_low": bm.get("ref_low"),
            "ref_high": bm.get("ref_high"),
            "status": status,  # Normalized to DEFICIENT/ELEVATED/BORDERLINE/OPTIMAL
            "color": meta["color"],  # CSS color name for styling
            "badge": meta["badge"],  # Tailwind classes for badge
            "border": meta["border"],  # Tailwind classes for border
            "severity": meta["severity"],  # critical/high/medium/none for filtering
            "severity_rank": meta["rank"],  # 0-3 for sorting
            "range_percent": range_percent,  # Where in reference range (0-100)
            "confidence": 0.95,  # ML confidence score (TODO: add actual ML model)
        })

    return {
        "lab_id": lab_id,
        "extracted_at": lab.get("extracted_at"),
        "biomarker_count": len(normalized),
        "biomarkers": sorted(normalized, key=lambda b: b["severity_rank"]),  # Sorted by severity
    }

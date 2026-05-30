from __future__ import annotations

from typing import Any, Dict, List

from app.schemas.partners.results import PartnerResultIngestRequest
from app.services.lab_adapters.base import BaseLabAdapter
from app.services.lab_normalization.biomarker_mapping import infer_category, to_canonical_name
from app.services.lab_normalization.canonical import CanonicalBiomarker, CanonicalLabResult
from app.services.lab_normalization.unit_conversion import normalize_value_unit


class SmartlabAdapter(BaseLabAdapter):
    name = "smartlab"

    def to_canonical(self, request: PartnerResultIngestRequest, raw_payload: Dict[str, Any]) -> CanonicalLabResult:
        rows: List[Dict[str, Any]] = []

        if isinstance(raw_payload.get("biomarkers"), list):
            rows = [r for r in raw_payload.get("biomarkers", []) if isinstance(r, dict)]
        elif isinstance(raw_payload.get("results"), list):
            rows = [r for r in raw_payload.get("results", []) if isinstance(r, dict)]

        biomarkers: List[CanonicalBiomarker] = []
        for row in rows:
            name = str(row.get("name") or row.get("marker") or "").strip()
            if not name:
                continue
            raw_value = row.get("value")
            try:
                value = float(raw_value)
            except (TypeError, ValueError):
                continue

            unit = str(row.get("unit") or "unit")
            ref_low = _to_float_or_none(row.get("ref_low") or row.get("reference_low"))
            ref_high = _to_float_or_none(row.get("ref_high") or row.get("reference_high"))
            value, unit = normalize_value_unit(value, unit)

            status = str(row.get("status") or _status_by_range(value, ref_low, ref_high)).upper()
            canonical_name = to_canonical_name(name)

            biomarkers.append(
                CanonicalBiomarker(
                    canonical_name=canonical_name,
                    display_name=name,
                    value=value,
                    unit=unit,
                    ref_low=ref_low,
                    ref_high=ref_high,
                    status=status,
                    category=infer_category(canonical_name),
                    confidence=1.0,
                )
            )

        return CanonicalLabResult(
            partner_slug=request.partner_slug,
            external_patient_id=request.external_patient_id,
            external_order_id=request.external_order_id,
            external_result_id=request.external_result_id,
            lab_name=request.lab_name or self.name,
            result_date=request.result_date,
            biomarkers=biomarkers,
            metadata={"adapter": self.name, "raw_keys": sorted(raw_payload.keys())},
        )


def _to_float_or_none(value: Any) -> float | None:
    try:
        if value is None:
            return None
        return float(value)
    except (TypeError, ValueError):
        return None


def _status_by_range(value: float, ref_low: float | None, ref_high: float | None) -> str:
    if ref_low is not None and value < ref_low:
        return "DEFICIENT"
    if ref_high is not None and value > ref_high:
        return "ELEVATED"
    return "OPTIMAL"

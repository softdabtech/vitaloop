"""Persisted-biomarker projection and canonical input digest "VLH1".

The digest is a consistency/idempotency key only. It is never clinical evidence or
provenance. Python and PostgreSQL (public.lab_analysis_input_digest) operate on the
SAME projection: exactly the ten persisted `biomarkers` columns below, nothing else.
The full clinical input_snapshot is stored unchanged and is not hashed here.

Numerics must be JSON numbers (int/float) and are rejected, never rounded, when they
would lose precision or overflow numeric(10,3). Statuses are never fabricated.
"""
from __future__ import annotations

import hashlib
import uuid
from decimal import Decimal, InvalidOperation
from typing import Any, Dict, List, Optional

from app.services.lab_normalization.biomarker_mapping import is_metadata_field

PROJECTION_FIELDS = (
    "name", "value", "unit", "ref_low", "ref_high", "status", "category",
    "canonical_name", "reference_source", "unevaluated_reason",
)
_REQUIRED_TEXT = ("name", "unit", "status")
_OPTIONAL_TEXT = ("category", "canonical_name", "reference_source", "unevaluated_reason")
_QUANT = Decimal("0.000001")
_LIMIT = Decimal(1_000_000_000)


class DigestInputError(ValueError):
    pass


def _enc(value: Optional[str]) -> str:
    if value is None:
        return "N;"
    return f"S{len(value)}:{value};"


def canon_numeric(value: Any) -> Optional[str]:
    if value is None:
        return None
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        raise DigestInputError("numeric_type")
    try:
        d = Decimal(repr(value)) if isinstance(value, float) else Decimal(value)
    except InvalidOperation as exc:
        raise DigestInputError("numeric_type") from exc
    if not d.is_finite():
        raise DigestInputError("numeric_type")
    if abs(d) >= _LIMIT:
        raise DigestInputError("numeric_out_of_range")
    q = d.quantize(_QUANT)
    if (q != d and d != 0):
        raise DigestInputError("numeric_precision_loss")
    if q == 0:
        q = Decimal(0)
    return format(q, ".6f")


def _text(row: Dict[str, Any], key: str, *, required: bool) -> Optional[str]:
    v = row.get(key)
    if v is None:
        if required:
            raise DigestInputError("projection_required_field")
        return None
    if not isinstance(v, str) or (required and not v) or "\x00" in v:
        raise DigestInputError("projection_field_type")
    try:
        v.encode("utf-8")
    except UnicodeEncodeError as exc:
        raise DigestInputError("projection_field_type") from exc
    return v


def normalize_uuid(value: Any) -> str:
    try:
        return str(uuid.UUID(str(value)))
    except (ValueError, AttributeError, TypeError) as exc:
        raise DigestInputError("invalid_uuid") from exc


def validate_projection(projection: Any) -> List[Dict[str, Any]]:
    """Strict projection check: exact fields, types, unique (case-insensitive) names."""
    if not isinstance(projection, list):
        raise DigestInputError("projection_not_array")
    seen = set()
    for row in projection:
        if not isinstance(row, dict) or set(row) != set(PROJECTION_FIELDS):
            raise DigestInputError("projection_fields")
        for key in _REQUIRED_TEXT:
            _text(row, key, required=True)
        for key in _OPTIONAL_TEXT:
            _text(row, key, required=False)
        if row["value"] is None:
            raise DigestInputError("projection_required_field")
        canon_numeric(row["value"])
        canon_numeric(row["ref_low"])
        canon_numeric(row["ref_high"])
        lowered = row["name"].lower()
        if lowered in seen:
            raise DigestInputError("projection_duplicate_name")
        seen.add(lowered)
    return projection


def build_persisted_projection(biomarkers: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Mirror of supabase_service.save_biomarkers' row selection (same metadata filter,
    same columns). Missing required fields fail closed; nothing is defaulted or rounded."""
    rows = []
    for b in biomarkers or []:
        if not isinstance(b, dict):
            raise DigestInputError("projection_fields")
        for key in ("name", "value", "unit", "status"):
            if key not in b:
                raise DigestInputError("projection_required_field")
        if is_metadata_field(b.get("name"), value=b.get("value"), ref_low=b.get("ref_low"), ref_high=b.get("ref_high")):
            continue
        rows.append({k: b.get(k) for k in PROJECTION_FIELDS})
    return validate_projection(rows)


def canonical_input_digest(
    *, upload_id: Any, locale: str, pipeline_version: str, projection: List[Dict[str, Any]]
) -> str:
    validate_projection(projection)
    rows = []
    for b in projection:
        text = (
            _enc(b["name"])
            + _enc(canon_numeric(b["value"]))
            + _enc(b["unit"])
            + _enc(canon_numeric(b["ref_low"]))
            + _enc(canon_numeric(b["ref_high"]))
            + _enc(b["status"])
            + "".join(_enc(b[k]) for k in _OPTIONAL_TEXT)
        )
        rows.append((b["name"].encode("utf-8"), text))  # "C" collation == UTF-8 byte order
    rows.sort(key=lambda r: r[0])
    body = (
        "VLH1;" + _enc(normalize_uuid(upload_id)) + _enc(locale or "") + _enc(pipeline_version or "")
        + f"R{len(rows)};" + "".join(t for _, t in rows)
    )
    return hashlib.sha256(body.encode("utf-8")).hexdigest()

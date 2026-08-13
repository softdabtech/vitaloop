from __future__ import annotations

from typing import Any, Dict, List


EVIDENCE_GAPS_VERSION = "evidence_gaps_v1"


_DOMAIN_REQUIRED_MARKERS = {
    "iron_status": [
        ("ferritin", "Clarifies iron stores."),
        ("transferrin_saturation", "Clarifies circulating iron availability."),
        ("iron", "Adds serum iron context."),
        ("hemoglobin", "Shows whether blood-count context is affected."),
        ("crp", "Helps interpret ferritin when inflammation may be present."),
    ],
    "blood_count": [
        ("hemoglobin", "Required for anemia context."),
        ("mcv", "Adds red-cell size context."),
        ("mch", "Adds hemoglobinization context."),
        ("mchc", "Adds red-cell hemoglobin concentration context."),
        ("rdw", "Adds variation context."),
    ],
    "metabolic": [
        ("glucose", "Basic glucose status."),
        ("hba1c", "Longer-term glucose context."),
        ("insulin", "Insulin context when available."),
    ],
    "thyroid": [
        ("tsh", "Primary thyroid screening context."),
        ("free_t4", "Adds hormone availability context."),
        ("free_t3", "Adds conversion context when relevant."),
    ],
}


def _marker_keys(biomarkers: List[Dict[str, Any]]) -> set[str]:
    keys: set[str] = set()
    for item in biomarkers or []:
        text = " ".join(str(item.get(key) or "") for key in ("name", "canonical_name", "source_name")).lower()
        normalized = text.replace("canonical_", "").replace("-", "_").replace(" ", "_")
        keys.add(normalized)
        keys.add(text)
    return keys


def _has_marker(keys: set[str], marker: str) -> bool:
    marker_key = marker.lower().replace("-", "_").replace(" ", "_")
    return any(marker_key in key or marker_key.replace("_", " ") in key for key in keys)


def _domain_from_state(state: Dict[str, Any]) -> str:
    return str(state.get("domain") or state.get("key") or "").strip().lower()


def build_evidence_gaps(
    *,
    biomarkers: List[Dict[str, Any]],
    health_states: Dict[str, Any] | None = None,
    interpreted_report: Dict[str, Any] | None = None,
    clinical_integrity: Dict[str, Any] | None = None,
) -> Dict[str, Any]:
    keys = _marker_keys(biomarkers or [])
    gaps: List[Dict[str, Any]] = []
    domains: set[str] = set()

    for state in (health_states or {}).get("states") or []:
        if not isinstance(state, dict):
            continue
        domain = _domain_from_state(state)
        if not domain:
            continue
        if state.get("risk_level") in {"unknown", None} and not state.get("score"):
            continue
        domains.add(domain)

    for pattern in (interpreted_report or {}).get("patterns") or []:
        if isinstance(pattern, dict):
            domain = str(pattern.get("domain") or "").strip().lower()
            if domain:
                domains.add("blood_count" if domain == "blood_count" else domain)
            for missing in pattern.get("missing_context") or []:
                gaps.append(
                    {
                        "domain": domain or "general",
                        "missing_marker": None,
                        "reason": str(missing),
                        "impact_on_confidence": "limits_interpretation",
                        "priority": "high" if "CBC" in str(missing) or "ЗАК" in str(missing) else "medium",
                        "suggested_next_step": "Add or review this context before drawing a stronger conclusion.",
                        "source": "interpreted_report",
                    }
                )

    for domain in sorted(domains):
        required = _DOMAIN_REQUIRED_MARKERS.get(domain)
        if not required:
            continue
        for marker, reason in required:
            if not _has_marker(keys, marker):
                gaps.append(
                    {
                        "domain": domain,
                        "missing_marker": marker,
                        "reason": reason,
                        "impact_on_confidence": "would_reduce_uncertainty",
                        "priority": "high" if marker in {"ferritin", "hemoglobin", "tsh", "glucose"} else "medium",
                        "suggested_next_step": "Consider adding this marker to the next lab plan if clinically appropriate.",
                        "source": "domain_expected_marker",
                    }
                )

    for issue in (clinical_integrity or {}).get("issues") or []:
        if not isinstance(issue, dict):
            continue
        if issue.get("key") in {"profile_context_incomplete", "missing_lab_reference_range", "unknown_unit"}:
            gaps.append(
                {
                    "domain": "data_quality",
                    "missing_marker": None,
                    "reason": issue.get("key"),
                    "impact_on_confidence": "reduces_input_reliability",
                    "priority": "medium",
                    "suggested_next_step": "Confirm the source data or complete profile context.",
                    "source": "clinical_data_integrity",
                }
            )

    deduped: List[Dict[str, Any]] = []
    seen: set[tuple[Any, Any, Any]] = set()
    for gap in gaps:
        key = (gap.get("domain"), gap.get("missing_marker"), gap.get("reason"))
        if key in seen:
            continue
        seen.add(key)
        deduped.append(gap)

    high_count = len([item for item in deduped if item.get("priority") == "high"])
    return {
        "version": EVIDENCE_GAPS_VERSION,
        "gaps": deduped[:20],
        "summary": {
            "gap_count": len(deduped),
            "high_priority_count": high_count,
            "domains": sorted({str(item.get("domain")) for item in deduped if item.get("domain")}),
        },
    }

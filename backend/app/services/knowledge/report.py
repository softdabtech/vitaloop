from __future__ import annotations

from typing import Any, Dict, List


STATUS_PRIORITY = {
    "DEFICIENT": 0,
    "ELEVATED": 1,
    "BORDERLINE": 2,
    "OPTIMAL": 3,
}

SEVERITY_PRIORITY = {
    "critical": 0,
    "high": 1,
    "moderate": 2,
    "low": 3,
}


def _status(value: Any) -> str:
    raw = str(value or "").strip().upper()
    if raw in {"LOW", "L"}:
        return "DEFICIENT"
    if raw in {"HIGH", "H"}:
        return "ELEVATED"
    if raw == "NORMAL":
        return "OPTIMAL"
    if raw in STATUS_PRIORITY:
        return raw
    return "BORDERLINE"


def _number(value: Any) -> float | None:
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def _format_value(item: Dict[str, Any]) -> str:
    value = item.get("value")
    unit = str(item.get("unit") or "").strip()
    return f"{value:g} {unit}".strip() if isinstance(value, (int, float)) else f"{value} {unit}".strip()


def _marker_label(item: Dict[str, Any]) -> str:
    return str(item.get("name") or item.get("source_name") or "Unknown marker").strip()


def _sort_biomarkers(biomarkers: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    return sorted(
        biomarkers,
        key=lambda item: (
            STATUS_PRIORITY.get(_status(item.get("status")), 9),
            str(item.get("category") or ""),
            str(item.get("name") or ""),
        ),
    )


def _confidence_label(confidence: Any) -> str:
    score = _number(confidence) or 0.0
    if score >= 0.8:
        return "high"
    if score >= 0.55:
        return "moderate"
    if score > 0:
        return "limited"
    return "not_estimated"


def _what_found(biomarkers: List[Dict[str, Any]]) -> Dict[str, Any]:
    counts = {"total": len(biomarkers), "optimal": 0, "borderline": 0, "deficient": 0, "elevated": 0}
    flagged: List[Dict[str, Any]] = []

    for item in _sort_biomarkers(biomarkers):
        status = _status(item.get("status"))
        if status == "OPTIMAL":
            counts["optimal"] += 1
        elif status == "BORDERLINE":
            counts["borderline"] += 1
        elif status == "DEFICIENT":
            counts["deficient"] += 1
        elif status == "ELEVATED":
            counts["elevated"] += 1

        if status != "OPTIMAL":
            flagged.append(
                {
                    "name": _marker_label(item),
                    "value": item.get("value"),
                    "unit": item.get("unit"),
                    "formatted_value": _format_value(item),
                    "status": status,
                    "category": item.get("category") or "other",
                    "reference_range": (
                        f"{item.get('ref_low')} - {item.get('ref_high')} {item.get('unit') or ''}".strip()
                        if item.get("ref_low") is not None and item.get("ref_high") is not None
                        else None
                    ),
                }
            )

    headline = (
        f"{counts['total']} biomarkers found. "
        f"{counts['deficient'] + counts['elevated'] + counts['borderline']} need review, "
        f"{counts['optimal']} are currently in range."
    )
    return {"headline": headline, "counts": counts, "flagged_markers": flagged[:8]}


def _rule_priority(rule: Dict[str, Any]) -> tuple[int, float]:
    severity = str(rule.get("severity") or "").strip().lower()
    confidence = _number(rule.get("confidence")) or 0.0
    return (SEVERITY_PRIORITY.get(severity, 9), -confidence)


def _interpretation(knowledge_evaluation: Dict[str, Any]) -> List[Dict[str, Any]]:
    rules = knowledge_evaluation.get("matched_rules") if isinstance(knowledge_evaluation, dict) else []
    if not isinstance(rules, list):
        return []

    items: List[Dict[str, Any]] = []
    for rule in sorted((r for r in rules if isinstance(r, dict)), key=_rule_priority):
        items.append(
            {
                "rule_key": rule.get("rule_key"),
                "title": rule.get("name") or rule.get("summary") or "Matched health pattern",
                "summary": rule.get("summary") or rule.get("description") or "",
                "why_it_matters": rule.get("explanation") or rule.get("risk") or "",
                "risk": rule.get("risk"),
                "severity": rule.get("severity") or "moderate",
                "confidence": rule.get("confidence"),
                "requires_doctor": bool(rule.get("requires_doctor")),
                "source": rule.get("source"),
                "source_url": rule.get("source_url"),
            }
        )
    return items[:8]


def _discussion_points(knowledge_evaluation: Dict[str, Any], flagged_markers: List[Dict[str, Any]]) -> List[str]:
    points: List[str] = []
    for rule in knowledge_evaluation.get("matched_rules") or []:
        if not isinstance(rule, dict):
            continue
        title = str(rule.get("name") or rule.get("summary") or "").strip()
        if title:
            points.append(f"Discuss the pattern: {title}.")
        if rule.get("requires_doctor"):
            points.append("Ask whether this result requires clinical follow-up or additional diagnostic testing.")

    for marker in flagged_markers[:4]:
        points.append(
            f"Review {marker['name']} ({marker['formatted_value']}, {marker['status'].lower()}) in the context of symptoms, medications, and recent diet/training."
        )

    return list(dict.fromkeys(points))[:8]


def _retest_plan(biomarkers: List[Dict[str, Any]], knowledge_evaluation: Dict[str, Any]) -> List[Dict[str, Any]]:
    plan: List[Dict[str, Any]] = []
    safety_alerts = knowledge_evaluation.get("safety_alerts") if isinstance(knowledge_evaluation, dict) else []

    for alert in safety_alerts or []:
        if not isinstance(alert, dict):
            continue
        marker = str(alert.get("marker") or "").strip()
        if marker:
            plan.append(
                {
                    "marker": marker,
                    "timing": "as soon as clinically appropriate",
                    "reason": alert.get("message") or "Safety alert requires medical review.",
                    "priority": "urgent",
                }
            )

    for item in _sort_biomarkers(biomarkers):
        status = _status(item.get("status"))
        if status == "OPTIMAL":
            continue
        category = str(item.get("category") or "other").lower()
        if category in {"vitamins", "minerals", "metabolic", "lipids"}:
            timing = "8-12 weeks"
        elif category in {"liver", "kidney", "thyroid", "hormones"}:
            timing = "4-8 weeks"
        else:
            timing = "6-12 weeks"
        plan.append(
            {
                "marker": _marker_label(item),
                "timing": timing,
                "reason": f"{_marker_label(item)} is {status.lower()} and should be trended after intervention or clinical review.",
                "priority": "high" if status in {"DEFICIENT", "ELEVATED"} else "medium",
            }
        )

    deduped: List[Dict[str, Any]] = []
    seen: set[str] = set()
    for row in plan:
        key = str(row.get("marker") or "").lower()
        if key in seen:
            continue
        seen.add(key)
        deduped.append(row)
    return deduped[:8]


def _action_plan(knowledge_evaluation: Dict[str, Any]) -> List[Dict[str, Any]]:
    recommendations = knowledge_evaluation.get("generated_recommendations") if isinstance(knowledge_evaluation, dict) else []
    actions: List[Dict[str, Any]] = []
    for rec in recommendations or []:
        if not isinstance(rec, dict):
            continue
        actions.append(
            {
                "key": rec.get("key"),
                "title": rec.get("title"),
                "body": rec.get("body"),
                "category": rec.get("category"),
                "priority": rec.get("priority") or "medium",
                "requires_doctor": bool(rec.get("requires_doctor")),
                "evidence_level": rec.get("evidence_level"),
            }
        )
    return actions[:8]


def build_knowledge_report(
    *,
    biomarkers: List[Dict[str, Any]],
    knowledge_evaluation: Dict[str, Any] | None,
) -> Dict[str, Any]:
    evaluation = knowledge_evaluation if isinstance(knowledge_evaluation, dict) else {}
    found = _what_found(biomarkers)
    interpretation = _interpretation(evaluation)
    actions = _action_plan(evaluation)
    safety_alerts = evaluation.get("safety_alerts") if isinstance(evaluation.get("safety_alerts"), list) else []
    requires_doctor = bool(evaluation.get("requires_doctor")) or bool(safety_alerts)

    return {
        "version": "knowledge_report_v1",
        "summary": {
            "headline": found["headline"],
            "risk_level": "medical_review" if requires_doctor else ("needs_attention" if found["flagged_markers"] else "stable"),
            "confidence": evaluation.get("confidence", 0.0),
            "confidence_label": _confidence_label(evaluation.get("confidence")),
            "requires_doctor": requires_doctor,
            "disclaimer": "This report is educational and is not a diagnosis. Discuss abnormal or concerning results with a qualified clinician.",
        },
        "what_was_found": found,
        "why_it_matters": interpretation,
        "action_plan": actions,
        "doctor_discussion": _discussion_points(evaluation, found["flagged_markers"]),
        "retest_plan": _retest_plan(biomarkers, evaluation),
        "safety_alerts": safety_alerts,
        "source_references": evaluation.get("source_references") if isinstance(evaluation.get("source_references"), list) else [],
    }

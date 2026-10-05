"""P6 meaning-level audit for fixed end-to-end reference scenarios.

The fixture describes the clinical meaning expected from the complete lab
pipeline.  This validator deliberately checks decisions and evidence rather
than duplicating the response schema assertions already covered elsewhere.
"""

from __future__ import annotations

from typing import Any, Dict, Iterable, List


REFERENCE_SCENARIO_AUDIT_VERSION = "reference_scenario_audit_v1"

_MARKER_ALIASES = {
    "vitamin_d_25_oh": "vitamin_d",
    "vitamin_b12": "b12",
}


def _dicts(value: Any) -> List[Dict[str, Any]]:
    return [item for item in value if isinstance(item, dict)] if isinstance(value, list) else []


def _key(value: Any) -> str:
    normalized = str(value or "").strip().lower().removeprefix("canonical_").replace("-", "_").replace(" ", "_")
    return _MARKER_ALIASES.get(normalized, normalized)


def prepare_reference_biomarkers(fixture: Dict[str, Any], scenario: Dict[str, Any]) -> List[Dict[str, Any]]:
    """Apply the fixture's declared lab ranges without mutating its cases."""
    ranges = fixture.get("reference_ranges") if isinstance(fixture.get("reference_ranges"), dict) else {}
    result = []
    for source in _dicts(scenario.get("biomarkers")):
        marker = dict(source)
        marker_range = ranges.get(_key(marker.get("canonical_name") or marker.get("name"))) or {}
        marker.setdefault("ref_low", marker_range.get("ref_low"))
        marker.setdefault("ref_high", marker_range.get("ref_high"))
        result.append(marker)
    return result


def _check(checks: List[Dict[str, Any]], key: str, passed: bool, *, expected: Any, actual: Any) -> None:
    checks.append({"key": key, "passed": bool(passed), "expected": expected, "actual": actual})


def _evidence_marker_ids(items: Iterable[Dict[str, Any]], registry: Dict[str, Dict[str, Any]]) -> set[str]:
    result: set[str] = set()
    for item in items:
        evidence = _dicts(item.get("evidence"))
        if not evidence:
            evidence = [
                registry[str(evidence_id)]
                for evidence_id in item.get("evidence_ids") or []
                if str(evidence_id) in registry
            ]
        for reference in evidence:
            if reference.get("type") == "biomarker" and reference.get("availability", "observed") == "observed":
                result.add(_key(reference.get("id") or reference.get("label")))
    return result


def evaluate_reference_scenario(scenario: Dict[str, Any], result: Dict[str, Any]) -> Dict[str, Any]:
    """Compare one complete pipeline result with its pre-declared meaning."""
    expected = scenario.get("expected") if isinstance(scenario.get("expected"), dict) else {}
    checks: List[Dict[str, Any]] = []

    synthesis = result.get("case_synthesis") if isinstance(result.get("case_synthesis"), dict) else {}
    narrative = result.get("grounded_ai_narrative") if isinstance(result.get("grounded_ai_narrative"), dict) else {}
    acceptance = result.get("semantic_acceptance") if isinstance(result.get("semantic_acceptance"), dict) else {}
    symptom = result.get("symptom_analysis") if isinstance(result.get("symptom_analysis"), dict) else {}
    safety = result.get("safety_result") if isinstance(result.get("safety_result"), dict) else {}
    trend = result.get("trend_analysis") if isinstance(result.get("trend_analysis"), dict) else {}
    patterns = _dicts((result.get("interpreted_report") or {}).get("patterns"))
    pattern_keys = [str(item.get("key") or item.get("pattern_id")) for item in patterns]

    _check(checks, "pipeline_completed", result.get("analysis_status") == "completed", expected="completed", actual=result.get("analysis_status"))
    _check(checks, "case_synthesis_complete", synthesis.get("status") == "complete", expected="complete", actual=synthesis.get("status"))
    _check(
        checks,
        "all_statements_grounded",
        (synthesis.get("grounding") or {}).get("all_statements_grounded") is True,
        expected=True,
        actual=(synthesis.get("grounding") or {}).get("all_statements_grounded"),
    )

    required_patterns = list(expected.get("patterns") or [])
    forbidden_patterns = list(expected.get("forbidden_patterns") or [])
    _check(checks, "required_patterns", set(required_patterns) <= set(pattern_keys), expected=required_patterns, actual=pattern_keys)
    _check(checks, "forbidden_patterns", not (set(forbidden_patterns) & set(pattern_keys)), expected=forbidden_patterns, actual=pattern_keys)

    if expected.get("pattern_severity"):
        expected_severity = expected["pattern_severity"]
        actual_severity = {
            key: next((item.get("severity") for item in patterns if str(item.get("key") or item.get("pattern_id")) == key), None)
            for key in expected_severity
        }
        _check(checks, "pattern_severity", actual_severity == expected_severity, expected=expected_severity, actual=actual_severity)

    registry = {
        str(item.get("evidence_id")): item
        for item in _dicts(narrative.get("evidence_links"))
        if item.get("evidence_id")
    }
    conclusion_markers = _evidence_marker_ids(_dicts(narrative.get("personalized_summary")), registry)
    required_conclusion_markers = {_key(item) for item in expected.get("conclusion_markers") or []}
    _check(
        checks,
        "conclusion_evidence",
        required_conclusion_markers <= conclusion_markers,
        expected=sorted(required_conclusion_markers),
        actual=sorted(conclusion_markers),
    )

    expected_symptom = expected.get("symptom") if isinstance(expected.get("symptom"), dict) else {}
    if expected_symptom:
        _check(checks, "symptom_status", symptom.get("status") == expected_symptom.get("status"), expected=expected_symptom.get("status"), actual=symptom.get("status"))
        changed = bool((symptom.get("conclusion_change") or {}).get("changed"))
        _check(checks, "symptom_changed", changed is bool(expected_symptom.get("changed")), expected=bool(expected_symptom.get("changed")), actual=changed)
        if expected_symptom.get("concept_id"):
            concept_ids = {str(item.get("concept_id")) for item in _dicts(symptom.get("concepts"))}
            _check(checks, "symptom_concept", expected_symptom["concept_id"] in concept_ids, expected=expected_symptom["concept_id"], actual=sorted(concept_ids))
        if expected_symptom.get("effect"):
            effects = {str(item.get("effect")) for item in _dicts(symptom.get("matrix"))}
            _check(checks, "symptom_effect", expected_symptom["effect"] in effects, expected=expected_symptom["effect"], actual=sorted(effects))

    expected_safety = expected.get("safety") if isinstance(expected.get("safety"), dict) else {}
    if expected_safety:
        urgent = bool(safety.get("urgent_review_required"))
        _check(checks, "safety_urgent", urgent is bool(expected_safety.get("urgent")), expected=bool(expected_safety.get("urgent")), actual=urgent)
        event_keys = {str(item.get("key")) for item in _dicts(safety.get("safety_events"))}
        required_events = set(expected_safety.get("event_keys") or [])
        _check(checks, "safety_events", required_events <= event_keys, expected=sorted(required_events), actual=sorted(event_keys))

    expected_missing = {_key(item) for item in expected.get("missing_markers") or []}
    if expected_missing:
        actual_missing = {
            _key(item.get("missing_marker"))
            for item in _dicts((result.get("evidence_gaps") or {}).get("gaps"))
            if item.get("missing_marker")
        }
        _check(checks, "missing_markers", expected_missing <= actual_missing, expected=sorted(expected_missing), actual=sorted(actual_missing))

    expected_trend = expected.get("trend") if isinstance(expected.get("trend"), dict) else {}
    if expected_trend:
        marker = _key(expected_trend.get("marker"))
        row = next((item for item in _dicts(trend.get("trends")) if _key(item.get("canonical_name") or item.get("name")) == marker), {})
        _check(checks, "trend_available", trend.get("available") is True, expected=True, actual=trend.get("available"))
        _check(checks, "trend_direction", row.get("direction") == expected_trend.get("direction"), expected=expected_trend.get("direction"), actual=row.get("direction"))

    expected_acceptance = expected.get("semantic_acceptance") if isinstance(expected.get("semantic_acceptance"), dict) else {}
    expected_pass = bool(expected_acceptance.get("passes_dod", True))
    actual_failed = sorted(
        key
        for key, item in (acceptance.get("criteria") or {}).items()
        if isinstance(item, dict) and item.get("status") == "fail"
    )
    expected_failed = sorted(expected_acceptance.get("failed_criteria") or [])
    _check(checks, "semantic_passes_dod", acceptance.get("passes_dod") is expected_pass, expected=expected_pass, actual=acceptance.get("passes_dod"))
    _check(checks, "semantic_failed_criteria", actual_failed == expected_failed, expected=expected_failed, actual=actual_failed)

    fallback_marked = (
        narrative.get("source") != "deterministic_fallback"
        or (
            (narrative.get("grounding") or {}).get("fallback_used") is True
            and bool((narrative.get("grounding") or {}).get("fallback_reason"))
        )
    )
    _check(checks, "fallback_disclosed", fallback_marked, expected=True, actual=fallback_marked)

    failed = [item for item in checks if not item["passed"]]
    return {
        "version": REFERENCE_SCENARIO_AUDIT_VERSION,
        "scenario_id": scenario.get("id"),
        "category": scenario.get("category"),
        "expected_meaning": scenario.get("expected_meaning"),
        "passed": not failed,
        "checks": checks,
        "failures": failed,
        "summary": {"total": len(checks), "passed": len(checks) - len(failed), "failed": len(failed)},
    }


def summarize_reference_matrix(audits: Iterable[Dict[str, Any]]) -> Dict[str, Any]:
    rows = [item for item in audits if isinstance(item, dict)]
    failed = [item for item in rows if not item.get("passed")]
    categories = sorted({str(item.get("category")) for item in rows if item.get("category")})
    return {
        "version": "reference_scenario_matrix_v1",
        "passed": not failed,
        "scenario_count": len(rows),
        "passed_count": len(rows) - len(failed),
        "failed_count": len(failed),
        "categories": categories,
        "failed_scenarios": [str(item.get("scenario_id")) for item in failed],
    }

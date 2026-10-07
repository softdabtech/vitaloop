"""Read-only P0 audit of one persisted B2C report.

The audit uses the immutable report version and the exact API response built
from it.  It never regenerates a report and never returns account identifiers.
"""

from __future__ import annotations

import hashlib
from typing import Any, Dict, Iterable, List

from app.services.knowledge.integration import partition_biomarkers_for_knowledge
from app.services.lab_normalization.biomarker_mapping import to_canonical_name


UI_FIELD_CONSUMERS = {
    "biomarkers": ["frontend/src/pages/Results.jsx"],
    "symptom_snapshot": ["frontend/src/pages/UserDashboard.jsx"],
    "interpreted_report": ["frontend/src/pages/Results.jsx"],
    "clinical_hypotheses": [
        "frontend/src/pages/Results.jsx",
        "frontend/src/lib/todayViewModel.js",
    ],
    "case_synthesis": ["frontend/src/pages/Results.jsx::buildResultOverview"],
    "symptom_analysis": ["frontend/src/pages/Results.jsx::SymptomImpactNotice"],
    "grounded_ai_narrative": ["frontend/src/lib/resultOverview.js"],
    "semantic_acceptance": [],
    "health_states": ["frontend/src/pages/Results.jsx::AnalysisCoreV2Panel"],
    "trend_analysis": ["frontend/src/pages/Results.jsx::AnalysisCoreV2Panel"],
    "quality_snapshot": ["frontend/src/pages/Results.jsx::AnalysisCoreV2Panel"],
    "metadata": ["frontend/src/pages/Results.jsx::AnalysisCoreV2Panel"],
    "ai_orchestration": [],
    "cost_metadata": [],
    "health_context": [],
}

UI_RESPONSE_PATHS = {
    "case_synthesis": ("final_analysis", "case_synthesis"),
    "symptom_analysis": ("final_analysis", "symptom_analysis"),
    "grounded_ai_narrative": ("final_analysis", "grounded_ai_narrative"),
    "semantic_acceptance": ("final_analysis", "semantic_acceptance"),
    "health_states": ("final_analysis", "health_states"),
    "trend_analysis": ("final_analysis", "trend_analysis"),
    "quality_snapshot": ("final_analysis", "quality_snapshot"),
    "metadata": ("final_analysis", "metadata"),
}


def _present(value: Any) -> bool:
    return value not in (None, "", [], {})


def _case_fingerprint(upload_id: Any) -> str:
    return hashlib.sha256(str(upload_id or "missing").encode("utf-8")).hexdigest()[:12]


def _path_present(payload: Dict[str, Any], path: tuple[str, ...]) -> bool:
    value: Any = payload
    for key in path:
        if not isinstance(value, dict) or key not in value:
            return False
        value = value[key]
    return _present(value)


def _canonical_rows(markers: Iterable[Dict[str, Any]]) -> List[Dict[str, Any]]:
    rows: List[Dict[str, Any]] = []
    for marker in markers:
        source_name = str(marker.get("name") or marker.get("display_name") or "").strip()
        canonical_id = str(marker.get("canonical_name") or "").strip()
        expected_id = to_canonical_name(source_name) if source_name else ""
        comparable_canonical = canonical_id.removeprefix("canonical_")
        comparable_expected = expected_id.removeprefix("canonical_")
        rows.append(
            {
                "source_name": source_name or None,
                "canonical_id": canonical_id or None,
                "engine_expected_id": expected_id or None,
                "consistent_with_engine_mapping": bool(
                    canonical_id and comparable_canonical == comparable_expected
                ),
                "status": marker.get("status"),
                "reference_source": marker.get("reference_source"),
            }
        )
    return rows


def _stage(status: str, evidence: str) -> Dict[str, str]:
    return {"status": status, "evidence": evidence}


def _symptom_evidence_count(value: Any) -> int:
    if isinstance(value, list):
        return len(value)
    if isinstance(value, dict):
        return sum(len(items) for items in value.values() if isinstance(items, list))
    return 0


def build_real_case_audit(
    *,
    report_version: Dict[str, Any],
    api_response: Dict[str, Any],
    extraction_candidates: List[Dict[str, Any]] | None = None,
) -> Dict[str, Any]:
    """Build an anonymized input -> engine -> API -> UI trace."""
    snapshot = report_version.get("input_snapshot")
    snapshot = snapshot if isinstance(snapshot, dict) else {}
    markers = snapshot.get("biomarkers")
    markers = markers if isinstance(markers, list) else []
    candidates = extraction_candidates or []
    canonical_rows = _canonical_rows(markers)

    eligible_inputs, derived_exclusions = partition_biomarkers_for_knowledge(markers)
    explainability = report_version.get("explainability")
    explainability = explainability if isinstance(explainability, dict) else {}
    knowledge = explainability.get("knowledge_evaluation")
    knowledge = knowledge if isinstance(knowledge, dict) else {}
    coverage = knowledge.get("marker_coverage")
    coverage = coverage if isinstance(coverage, dict) else {}
    covered_eligible = set()
    for key in ("evaluated", "no_matching_rule", "unit_blocked"):
        covered_eligible.update(str(item) for item in (coverage.get(key) or []))
    unaccounted_eligible = sorted(set(eligible_inputs) - covered_eligible)

    knowledge_report = report_version.get("knowledge_report")
    knowledge_report = knowledge_report if isinstance(knowledge_report, dict) else {}
    interpreted = knowledge_report.get("interpreted_report")
    interpreted = interpreted if isinstance(interpreted, dict) else {}
    patterns = interpreted.get("patterns")
    patterns = patterns if isinstance(patterns, list) else []
    hypotheses = snapshot.get("clinical_hypotheses")
    hypotheses = hypotheses if isinstance(hypotheses, dict) else {}
    hypothesis_rows = hypotheses.get("hypotheses")
    hypothesis_rows = hypothesis_rows if isinstance(hypothesis_rows, list) else []

    symptom_snapshot = snapshot.get("symptom_snapshot")
    symptom_snapshot = symptom_snapshot if isinstance(symptom_snapshot, dict) else {}
    symptom_evidence = symptom_snapshot.get("evidence")
    symptom_evidence_count = _symptom_evidence_count(symptom_evidence)

    ai = snapshot.get("ai_orchestration")
    ai = ai if isinstance(ai, dict) else {}
    ai_metadata = ai.get("metadata")
    ai_metadata = ai_metadata if isinstance(ai_metadata, dict) else {}

    transfer = []
    losses = []
    for field, consumers in UI_FIELD_CONSUMERS.items():
        persisted = _present(snapshot.get(field))
        # interpreted_report is stored inside knowledge_report rather than
        # input_snapshot; account for that explicit storage location.
        if field == "interpreted_report":
            persisted = _present(interpreted)
        api_present = _present(api_response.get(field))
        ui_path = UI_RESPONSE_PATHS.get(field, (field,))
        ui_contract_present = _path_present(api_response, ui_path) if consumers else None
        if persisted and (not api_present or (consumers and not ui_contract_present)):
            losses.append(field)
        transfer.append(
            {
                "field": field,
                "engine_persisted": persisted,
                "api_exposed": api_present,
                "ui_consumers": consumers,
                "ui_consumed": bool(consumers),
                "ui_response_path": ".".join(ui_path) if consumers else None,
                "ui_contract_present": ui_contract_present,
            }
        )

    canonical_missing = [row for row in canonical_rows if not row["canonical_id"]]
    canonical_mismatch = [
        row for row in canonical_rows
        if row["canonical_id"] and not row["consistent_with_engine_mapping"]
    ]
    ai_source = ai_metadata.get("analysis_source")
    ai_reason = ai_metadata.get("reason")
    ai_explicit = bool(ai_source or ai_reason or ai.get("status"))

    stages = {
        "recognized_markers": _stage(
            "DONE" if markers else "FAIL",
            f"{len(markers)} persisted markers; {len(candidates)} extraction candidates",
        ),
        "canonical_ids": _stage(
            "DONE" if markers and not canonical_missing and not canonical_mismatch else "FAIL",
            f"{len(canonical_rows) - len(canonical_missing) - len(canonical_mismatch)}/{len(markers)} mapped consistently",
        ),
        "knowledge_rules": _stage(
            "DONE" if not unaccounted_eligible else "FAIL",
            f"eligible={len(eligible_inputs)}, excluded={len(derived_exclusions)}, fired={len(coverage.get('fired') or [])}, matched_rules={len(knowledge.get('matched_rules') or [])}",
        ),
        "symptom_snapshot": _stage(
            "DONE" if symptom_snapshot and _present(api_response.get("symptom_snapshot")) else ("NOT_APPLICABLE" if not symptom_snapshot else "FAIL"),
            f"present={bool(symptom_snapshot)}, evidence={symptom_evidence_count}",
        ),
        "patterns_and_hypotheses": _stage(
            "DONE" if "patterns" in interpreted and "hypotheses" in hypotheses else "FAIL",
            f"patterns={len(patterns)}, hypotheses={len(hypothesis_rows)}",
        ),
        "ai_or_fallback": _stage(
            "DONE" if ai_explicit else "FAIL",
            f"status={ai.get('status') or 'unknown'}, source={ai_source or 'none'}, fallback={bool(ai_metadata.get('fallback_used'))}, reason={ai_reason or 'none'}",
        ),
        "backend_api_ui_transfer": _stage(
            "DONE" if not losses else "FAIL",
            "no persisted fields lost" if not losses else f"lost fields: {', '.join(losses)}",
        ),
    }
    smoke_ok = all(item["status"] in {"DONE", "NOT_APPLICABLE"} for item in stages.values())

    return {
        "audit_version": "p0_real_case_audit_v1",
        "case_fingerprint": _case_fingerprint(report_version.get("upload_id")),
        "created_at": report_version.get("created_at"),
        "locale": report_version.get("locale"),
        "report_status": report_version.get("status"),
        "stages": stages,
        "recognized_markers": {
            "candidate_count": len(candidates),
            "candidate_statuses": {
                status: sum(1 for item in candidates if str(item.get("status") or "unknown") == status)
                for status in sorted({str(item.get("status") or "unknown") for item in candidates})
            },
            "persisted_count": len(markers),
            "markers": canonical_rows,
        },
        "knowledge_rules": {
            "eligible_marker_count": len(eligible_inputs),
            "excluded_marker_count": len(derived_exclusions),
            "excluded_markers": derived_exclusions,
            "matched_rule_count": len(knowledge.get("matched_rules") or []),
            "fired_markers": coverage.get("fired") or [],
            "evaluated_markers": coverage.get("evaluated") or [],
            "no_matching_rule": coverage.get("no_matching_rule") or [],
            "unit_blocked": coverage.get("unit_blocked") or [],
            "unaccounted_eligible_markers": unaccounted_eligible,
        },
        "symptom_snapshot": {
            "present": bool(symptom_snapshot),
            "session_recorded": bool(symptom_snapshot.get("session_id")),
            "completed_at": symptom_snapshot.get("completed_at"),
            "evidence_count": symptom_evidence_count,
            "assessment_fields": sorted((symptom_snapshot.get("assessment") or {}).keys()),
            "api_exposed": _present(api_response.get("symptom_snapshot")),
        },
        "reasoning": {
            "pattern_count": len(patterns),
            "pattern_ids": [item.get("id") or item.get("pattern_id") or item.get("key") for item in patterns],
            "hypothesis_count": len(hypothesis_rows),
            "hypothesis_labels": [item.get("label") for item in hypothesis_rows],
        },
        "ai": {
            "status": ai.get("status"),
            "analysis_source": ai_source,
            "fallback_used": bool(ai_metadata.get("fallback_used")),
            "reason": ai_reason,
        },
        "engine_api_ui_transfer": transfer,
        "lost_fields": losses,
        "smoke_ok": smoke_ok,
    }

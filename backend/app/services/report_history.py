"""Stage 2G — frozen report reproducibility.

A completed historical analysis is an immutable historical artifact. GETting
an old completed result must NOT silently recompute it using today's
pipeline/prompts/knowledge rules/safety behavior. Explicit regeneration is a
new, separately-persisted version.

This module is the single place that assembles a GET response FROM a frozen
`report_versions` row, reused by both `GET /analyze/{upload_id}`
(app/routers/analysis/analyze.py::get_results) and `GET /results/{upload_id}`
(app/routers/protocol/compatibility.py::get_results_by_upload) — the two
live endpoints that read back a completed analysis — so their behavior
cannot drift apart. Neither endpoint invokes `run_lab_analysis_pipeline()`
for a completed upload that already has a persisted version; regeneration is
the only intentional path that runs the pipeline and creates a new row.

Ownership model (traced, not assumed — see Stage 2G report for the full
call-site trace):

- `report_versions` — one immutable row per generation event (initial
  analysis, candidate confirmation, manual entry, explicit regenerate; never
  B2B, which has no persisted report versions at all). Rows are inserted
  only, never updated in place. `version` is a fixed literal ("report_v1")
  today, not an incrementing number, so `created_at DESC` — via the existing
  `get_latest_report_version()` — is the only reliable ordering signal; this
  module does not invent a new one. `status` is "completed" or "blocked"
  (Stage 2C safety verdict at generation time); the pipeline's early return
  for a still-pending `needs_confirmation` gate decision happens BEFORE the
  report_version persistence block, so no row is ever written for a pending
  upload — a row's mere existence already implies a completed generation
  event.

- `protocols` — one mutable row PER UPLOAD, upserted (update-in-place, never
  versioned) on every generation event, holding `recommendations` as a flat
  list. Traced: no task-completion/check-off state exists anywhere in this
  table, its write paths, or any frontend consumer (grepped app/ and
  frontend/src for completed/checked/toggle near protocol recommendations —
  nothing found; confirmed against ProtocolPage.jsx/Results.jsx directly).
  It is not literal user-edited state, but its shape (a flat list) differs
  from `report_versions.protocol` (a structured sections object) and IS the
  exact shape the frontend contract depends on (`data.protocol` read as an
  array) — so it is preserved and served as-is, unchanged by this stage,
  rather than forced into the frozen artifact's shape. The frozen structured
  snapshot is still made available, verbatim, nested under the `report_version`
  response key, so no information is lost.
"""

from __future__ import annotations

from typing import Any, Dict, List, Optional

from app.services.safety import (
    sanitize_knowledge_evaluation_for_safety,
    sanitize_knowledge_report_for_safety,
    sanitize_protocol_for_safety,
)
from app.services.safety.safety_engine import blocked_content_notice

REPORT_SOURCE_FROZEN = "frozen"
REPORT_SOURCE_REGENERATED = "regenerated"
REPORT_SOURCE_LEGACY_FALLBACK = "legacy_fallback"

_TERMINAL_STATUSES = {"completed", "blocked"}


def is_frozen_report_version(report_version: Optional[Dict[str, Any]]) -> bool:
    """A row counts as a servable frozen artifact once its generation event
    completed. Both "completed" and "blocked" are terminal, already-sanitized
    -at-write-time outcomes (Stage 2C runs before persistence); a row is
    never written for a pending needs_confirmation gate decision."""
    if not isinstance(report_version, dict):
        return False
    return str(report_version.get("status") or "").lower() in _TERMINAL_STATUSES


def frozen_knowledge_evaluation(report_version: Dict[str, Any]) -> Any:
    """knowledge_evaluation has no dedicated report_versions column (traced:
    sql/stage-25-analysis-quality-gate-and-report-provenance.sql lists only
    input_snapshot/knowledge_report/protocol/safety_result/explainability/
    status). This stage nests it inside the existing `explainability` jsonb
    envelope at write time (already used as a catch-all for evidence_gaps/
    version_provenance — see lab_analysis_pipeline.py's save_report_version
    call) instead of adding a new column/migration. Rows written before this
    change simply won't have it — degrade to None, never recompute it."""
    explainability = report_version.get("explainability")
    if isinstance(explainability, dict):
        return explainability.get("knowledge_evaluation")
    return None


def assemble_frozen_response(
    *,
    upload_id: str,
    biomarkers: List[Dict[str, Any]],
    protocol_recommendations: Any,
    report_version: Dict[str, Any],
    user_profile: Optional[Dict[str, Any]],
    locale: str,
) -> Dict[str, Any]:
    """Builds a GET response entirely from a persisted, immutable
    report_versions row — never calls run_lab_analysis_pipeline. Read-only:
    the DB row itself is never mutated here, only re-sanitized in memory for
    the response (the same non-mutating, defense-in-depth read-boundary
    pattern Stage 2C already established for protocol/knowledge_report reads
    — a pre-Stage-2C frozen row containing blocked diagnosis-like text must
    not leak simply because it is historical)."""
    stored_knowledge_report = report_version.get("knowledge_report")
    sanitized_knowledge_report = (
        sanitize_knowledge_report_for_safety(stored_knowledge_report, locale=locale)
        if isinstance(stored_knowledge_report, dict)
        else stored_knowledge_report
    )
    interpreted_report = (
        sanitized_knowledge_report.get("interpreted_report")
        if isinstance(sanitized_knowledge_report, dict)
        else None
    )
    knowledge_report = (
        {key: value for key, value in sanitized_knowledge_report.items() if key != "interpreted_report"}
        if isinstance(sanitized_knowledge_report, dict)
        else sanitized_knowledge_report
    )

    knowledge_evaluation = sanitize_knowledge_evaluation_for_safety(
        frozen_knowledge_evaluation(report_version), locale=locale
    )

    frozen_protocol_snapshot = sanitize_protocol_for_safety(
        report_version.get("protocol"), profile=user_profile, locale=locale
    )

    sanitized_report_version = {
        **report_version,
        "knowledge_report": sanitized_knowledge_report,
        "protocol": frozen_protocol_snapshot,
    }

    is_blocked = str(report_version.get("status") or "").lower() == "blocked"
    input_snapshot = report_version.get("input_snapshot")
    input_snapshot = input_snapshot if isinstance(input_snapshot, dict) else {}

    return {
        "upload_id": upload_id,
        "analysis_status": "blocked" if is_blocked else "completed",
        "biomarkers": biomarkers,
        "protocol": protocol_recommendations,
        "knowledge_evaluation": knowledge_evaluation,
        "knowledge_report": knowledge_report,
        "interpreted_report": interpreted_report,
        # Present in the frozen input_snapshot verbatim (no recomputation) —
        # these describe the state of the analysis AT GENERATION TIME, not a
        # live/current re-evaluation.
        "analysis_input_quality_gate": input_snapshot.get("analysis_input_quality_gate"),
        "clinical_data_integrity": input_snapshot.get("clinical_data_integrity"),
        "evidence_gaps": input_snapshot.get("evidence_gaps"),
        "safety_result": report_version.get("safety_result"),
        # Pure locale-template boilerplate derived from the frozen status —
        # no AI/knowledge-rule recomputation involved (see
        # safety_engine.blocked_content_notice's docstring).
        "safety_notice": blocked_content_notice(locale) if is_blocked else None,
        "explainability": report_version.get("explainability"),
        "report_version": sanitized_report_version,
        "report_source": REPORT_SOURCE_FROZEN,
    }

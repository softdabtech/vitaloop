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
    sanitize_safety_result_for_output,
)
from app.services.safety.safety_engine import blocked_content_notice

REPORT_SOURCE_FROZEN = "frozen"
REPORT_SOURCE_REGENERATED = "regenerated"
REPORT_SOURCE_LEGACY_FALLBACK = "legacy_fallback"
# Locale P0 fix: a frozen report_versions row exists for this upload, just
# not in the requested locale (distinct from REPORT_SOURCE_LEGACY_FALLBACK,
# which means no report_versions row exists at all for this upload, in any
# locale). Added so callers/telemetry/frontend can tell "genuinely legacy
# upload" apart from "not generated in this language yet" — see
# get_latest_report_version's docstring in supabase_service.py.
REPORT_SOURCE_LOCALE_UNAVAILABLE = "locale_unavailable"

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
    sanitized_protocol_recommendations = sanitize_protocol_for_safety(
        protocol_recommendations, profile=user_profile, locale=locale
    )
    safety_result = sanitize_safety_result_for_output(report_version.get("safety_result"), locale=locale)
    sanitized_input_snapshot = sanitize_safety_result_for_output(report_version.get("input_snapshot"), locale=locale)
    sanitized_explainability = sanitize_safety_result_for_output(report_version.get("explainability"), locale=locale)

    sanitized_report_version = {
        **report_version,
        "knowledge_report": sanitized_knowledge_report,
        "protocol": frozen_protocol_snapshot,
        "input_snapshot": sanitized_input_snapshot,
        "explainability": sanitized_explainability,
    }

    is_blocked = str(report_version.get("status") or "").lower() == "blocked"
    input_snapshot = sanitized_input_snapshot
    input_snapshot = input_snapshot if isinstance(input_snapshot, dict) else {}

    return {
        "upload_id": upload_id,
        "analysis_status": "blocked" if is_blocked else "completed",
        "biomarkers": biomarkers,
        "protocol": sanitized_protocol_recommendations,
        "knowledge_evaluation": knowledge_evaluation,
        "knowledge_report": knowledge_report,
        "interpreted_report": interpreted_report,
        # Present in the frozen input_snapshot verbatim (no recomputation) —
        # these describe the state of the analysis AT GENERATION TIME, not a
        # live/current re-evaluation.
        "analysis_input_quality_gate": input_snapshot.get("analysis_input_quality_gate"),
        "clinical_data_integrity": input_snapshot.get("clinical_data_integrity"),
        "evidence_gaps": input_snapshot.get("evidence_gaps"),
        # Follow-up on 2026-09-12 audit items #2/#3/#6: same frozen-verbatim
        # treatment as evidence_gaps directly above — persisted into
        # input_snapshot at generation time by lab_analysis_pipeline.py, not
        # recomputed here.
        "clinical_priority_planner": input_snapshot.get("clinical_priority_planner"),
        "next_best_tests": input_snapshot.get("next_best_tests"),
        "clinical_story": input_snapshot.get("clinical_story"),
        # Same frozen-verbatim treatment: a report generated before this
        # field existed will read back None here — callers must handle a
        # missing clinical_reasoning_traces the same way they already
        # handle a missing clinical_story on an old snapshot.
        "clinical_reasoning_traces": input_snapshot.get("clinical_reasoning_traces"),
        # P14, same frozen-verbatim posture: a report generated before the
        # Hypothesis Engine existed reads back None — never recomputed here.
        "clinical_hypotheses": input_snapshot.get("clinical_hypotheses"),
        # P15, same frozen-verbatim posture: a report generated before the
        # Contradiction Detector existed reads back None — never recomputed.
        "clinical_contradictions": input_snapshot.get("clinical_contradictions"),
        # P16, same frozen-verbatim posture: a report generated before the
        # Confidence Calibration Engine existed reads back None — never
        # recomputed. Note clinical_hypotheses above already carries the
        # merged calibrated_confidence/calibrated_score/
        # calibration_reason_codes fields as persisted at generation time.
        "confidence_calibration": input_snapshot.get("confidence_calibration"),
        # P17, same frozen-verbatim posture: a report generated before the
        # Negative Evidence Layer existed reads back None — never recomputed.
        "negative_evidence": input_snapshot.get("negative_evidence"),
        # P20, same frozen-verbatim posture: a report generated before
        # Intervention Memory existed reads back None — never recomputed
        # (recomputing here would use the WRONG window: "since previous
        # report" only makes sense relative to when this report was
        # originally generated, not whenever it's later viewed).
        "intervention_memory": input_snapshot.get("intervention_memory"),
        # P21, same frozen-verbatim posture: a report generated before
        # Outcome Attribution existed reads back None — never recomputed
        # (recomputing would use the wrong window/events relative to when
        # this report was originally generated).
        "outcome_attribution": input_snapshot.get("outcome_attribution"),
        # P22, same frozen-verbatim posture: a report generated before
        # Evidence Debt Score existed reads back None — never recomputed.
        "evidence_debt": input_snapshot.get("evidence_debt"),
        # P23, same frozen-verbatim posture: an audit of what happened
        # AT GENERATION TIME — recomputing it on a later read would
        # describe the wrong event entirely, not just be inconsistent.
        "report_quality_audit": input_snapshot.get("report_quality_audit"),
        # P24, same frozen-verbatim posture: a report generated before
        # Population Profiles existed reads back None — never recomputed.
        # Recomputing here would also be wrong on principle: this overlay
        # reflects the OTHER P14-P23 outputs as they stood at generation
        # time, and those are themselves frozen-verbatim above.
        "population_profile_overlays": input_snapshot.get("population_profile_overlays"),
        # P24.3, same frozen-verbatim posture: which profile(s) were
        # selected (default/explicit/inferred) AT GENERATION TIME — a
        # report generated before Profile Selection existed reads back
        # None. Never recomputed: intervention_memory context available
        # today could differ from what was true when this report was
        # generated, and re-selecting now could silently disagree with the
        # population_profile_overlays already frozen above.
        "population_profile_selection": input_snapshot.get("population_profile_selection"),
        # P25, same frozen-verbatim posture: a report generated before
        # Doctor Escalation Precision existed reads back None — never
        # recomputed. Recomputing here would also be wrong on principle:
        # escalations are translated from the safety/reasoning signals as
        # they stood AT GENERATION TIME, and those are themselves
        # frozen-verbatim above.
        "doctor_escalation_precision": input_snapshot.get("doctor_escalation_precision"),
        # Frozen-verbatim, same posture: a report generated before P5
        # existed reads back None; progress_intelligence is itself a diff
        # against an even-earlier snapshot, so re-running it here on read
        # would need a second historical fetch this frozen-read path has no
        # reason to make — the diff was already computed once at generation
        # time and is immutable history, exactly like clinical_story.
        "progress_intelligence": input_snapshot.get("progress_intelligence"),
        "personal_baseline": input_snapshot.get("personal_baseline"),
        "action_plan_by_role": input_snapshot.get("action_plan_by_role"),
        "next_test_funnel": input_snapshot.get("next_test_funnel"),
        "safety_result": safety_result,
        # Pure locale-template boilerplate derived from the frozen status —
        # no AI/knowledge-rule recomputation involved (see
        # safety_engine.blocked_content_notice's docstring).
        "safety_notice": blocked_content_notice(locale) if is_blocked else None,
        "explainability": report_version.get("explainability"),
        "report_version": {**sanitized_report_version, "safety_result": safety_result},
        "report_source": REPORT_SOURCE_FROZEN,
    }

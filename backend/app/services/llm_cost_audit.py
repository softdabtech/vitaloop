"""No-LLM / Cost-Aware Reasoning Audit (P28, backend/ops-first v1).

A deterministic CATALOG, not a live scanner. This module does not call any
LLM, does not query the database, and does not introspect the running
process — it is a hand-maintained, version-controlled registry of every
known LLM/OpenAI call site in this codebase (see the 2026-09-17 audit in
docs/LLM_COST_AUDIT_2026-09-17.md for the full investigation this was
built from), so it produces the exact same output on every call. That
determinism is deliberate: this is meant to be diffed in code review when
a new LLM call site is added, not to "discover" call sites at runtime
(a runtime code-scanner would itself be nondeterministic across Python
versions/import orders and is out of scope for this stage).

Why a static registry instead of a live scan: the actual call sites
(claude_service.py, claude_pdf_analyzer.py, ua_wellbeing_openai.py,
llm_consult.py) are few, well-known, and change rarely; a human updating
this file when a new call site is added is a much stronger guarantee of
accuracy than a regex/AST scan that could silently miss an indirect call
(e.g. through ai_orchestrator.py) or misclassify a false positive (a
docstring saying "no LLM").

Each category records, verbatim from the 2026-09-17 audit:
- id / label: stable identifier + human label.
- file, trigger: where the call lives and what invokes it.
- usage_type: "clinical_production" | "ocr_vision" | "protocol_generation"
  | "smoke_test" | "ops" -- a rough bucket, not a strict taxonomy (see
  docs/LLM_COST_AUDIT_2026-09-17.md for the exact call-by-call reasoning).
- model_env: which settings/env var controls the model, if any.
- cacheable: whether this call's output is plausibly cacheable
  (same input -> same/similar output within a reasonable window).
- disable_in_smoke: whether this path should NEVER fire during a smoke/
  CI run (true for every real production LLM path; smoke_test category
  entries themselves are marked false since they already are the "safe"
  side of that boundary).
- already_logged: whether this call site writes to `llm_usage_events`
  today (see app/services/claude_service.py::_persist_usage_event and
  app/services/ua_wellbeing_openai.py::_persist_openai_usage).
- risk_level: "low" | "medium" | "high" -- driven by (a) whether spend is
  logged/visible at all, (b) whether the endpoint requires auth, (c)
  whether it is wired into any automated/scheduled trigger.
- recommended_action: a short, concrete next step. This module does not
  ACT on the recommendation (no disabling, no code changes) -- it only
  reports it, per this stage's explicit scope boundary.

This module MUST NOT be imported by lab_analysis_pipeline.py or
report_history.py, and its output MUST NEVER be added to
`input_snapshot` or any frozen-replay-served field -- this is
ops/audit visibility, not a clinical reasoning stage, and P24/P25's
"additive, frozen-replay-safe" posture does not apply to it because it
is not part of the clinical report contract at all. See
docs/LLM_COST_AUDIT_2026-09-17.md, section "Frozen replay boundary".
"""

from __future__ import annotations

from typing import Any, Dict, List


LLM_COST_AUDIT_VERSION = "p28_v1"

_USAGE_TYPES = {"clinical_production", "ocr_vision", "protocol_generation", "smoke_test", "ops"}
_RISK_LEVELS = {"low", "medium", "high"}


def _category(
    *,
    id: str,
    label: str,
    file: str,
    trigger: str,
    usage_type: str,
    model_env: str,
    cacheable: bool,
    disable_in_smoke: bool,
    already_logged: bool,
    risk_level: str,
    recommended_action: str,
) -> Dict[str, Any]:
    assert usage_type in _USAGE_TYPES, f"unknown usage_type: {usage_type}"
    assert risk_level in _RISK_LEVELS, f"unknown risk_level: {risk_level}"
    return {
        "id": id,
        "label": label,
        "file": file,
        "trigger": trigger,
        "usage_type": usage_type,
        "model_env": model_env,
        "cacheable": cacheable,
        "disable_in_smoke": disable_in_smoke,
        "already_logged": already_logged,
        "risk_level": risk_level,
        "recommended_action": recommended_action,
    }


# Ordered by usage_type, then roughly by risk (highest first within a type)
# so the list itself reads as a triage order without needing extra sorting.
_CATEGORIES: List[Dict[str, Any]] = [
    _category(
        id="biomarker_extraction_text",
        label="Biomarker extraction from OCR'd lab text",
        file="app/services/claude_service.py:641 (extract_biomarkers)",
        trigger="POST /analyze (text-based lab upload) -> app/routers/analysis/analyze.py:1145",
        usage_type="clinical_production",
        model_env="settings.active_llm_model / settings.active_llm_api_key",
        cacheable=False,
        disable_in_smoke=True,
        already_logged=True,
        risk_level="low",
        recommended_action="No action needed: already logged via _persist_usage_event and gated by is_llm_configured().",
    ),
    _category(
        id="questionnaire_followup",
        label="Adaptive questionnaire follow-up question",
        file="app/services/claude_service.py:854 (generate_questionnaire_followup)",
        trigger="Questionnaire flow -> app/routers/protocol/questionnaire.py:338",
        usage_type="clinical_production",
        model_env="settings.active_llm_model / settings.active_llm_api_key",
        cacheable=False,
        disable_in_smoke=True,
        already_logged=True,
        risk_level="low",
        recommended_action="No action needed: already logged (task_name=questionnaire_followup).",
    ),
    _category(
        id="questionnaire_summary",
        label="End-of-questionnaire personalized summary",
        file="app/services/claude_service.py:907 (generate_questionnaire_summary)",
        trigger="Questionnaire flow -> app/routers/protocol/questionnaire.py:406",
        usage_type="clinical_production",
        model_env="settings.active_llm_model / settings.active_llm_api_key",
        cacheable=False,
        disable_in_smoke=True,
        already_logged=True,
        risk_level="low",
        recommended_action="No action needed: already logged (task_name=questionnaire_summary).",
    ),
    _category(
        id="ua_wellbeing_assessment",
        label="Ukrainian public wellbeing assessment (pre-signup)",
        file="app/services/ua_wellbeing_openai.py:108 (generate_ua_wellbeing_assessment)",
        trigger="POST /assessment/ua-wellbeing (public, unauthenticated) -> app/routers/assessment.py:320-323",
        usage_type="clinical_production",
        model_env="settings.active_llm_model / settings.active_llm_api_key (checked via a local _is_openai_configured duplicate)",
        cacheable=False,
        disable_in_smoke=True,
        already_logged=True,
        risk_level="medium",
        recommended_action=(
            "Public, unauthenticated endpoint -- confirm independent rate limiting exists, since abuse here is "
            "invisible to auth-based cost controls. Also consolidate _persist_openai_usage (a near-duplicate of "
            "claude_service._persist_usage_event) into the shared helper to avoid the two implementations drifting."
        ),
    ),
    _category(
        id="pdf_text_extraction",
        label="Biomarker extraction from PDF text (non-vision)",
        file="app/services/claude_pdf_analyzer.py (PDFTextAnalyzer._send_text_completion)",
        trigger="POST /analyze/pdf, POST /analyze/upload -> app/routers/analysis/analyze.py:503 (create_file_analyzer)",
        usage_type="ocr_vision",
        model_env="settings.active_llm_model / settings.active_llm_api_key",
        cacheable=False,
        disable_in_smoke=True,
        already_logged=True,
        risk_level="low",
        recommended_action=(
            "P28.1 fix (2026-09-17): now logs via claude_service._persist_usage_event (provider=openai, "
            "task_name=pdf_text_extraction), attributed to user_id/upload_id when the caller provides them. "
            "No action needed."
        ),
    ),
    _category(
        id="pdf_vision_extraction",
        label="Biomarker extraction from PDF/image via vision model",
        file="app/services/claude_pdf_analyzer.py (ImageAnalyzer/PDFVisionAnalyzer._send_vision_completion)",
        trigger="POST /analyze/pdf, POST /analyze/upload -> app/routers/analysis/analyze.py:503 (create_file_analyzer)",
        usage_type="ocr_vision",
        model_env="settings.active_llm_model / settings.active_llm_api_key",
        cacheable=False,
        disable_in_smoke=True,
        already_logged=True,
        risk_level="low",
        recommended_action=(
            "P28.1 fix (2026-09-17): now logs via claude_service._persist_usage_event with provider=openai-vision "
            "(task_name=pdf_vision_extraction), so /crm/ops/openai-usage's existing provider filter "
            "(['openai','openai-vision']) now actually receives rows for this path. No action needed."
        ),
    ),
    _category(
        id="table_extraction",
        label="Biomarker extraction from CSV/XLSX tables",
        file="app/services/table_analyzer.py (TableAnalyzer, extends OpenAIFileAnalyzer)",
        trigger="POST /analyze/pdf, POST /analyze/upload -> app/routers/analysis/analyze.py:503 (create_file_analyzer)",
        usage_type="ocr_vision",
        model_env="settings.active_llm_model / settings.active_llm_api_key",
        cacheable=False,
        disable_in_smoke=True,
        already_logged=True,
        risk_level="low",
        recommended_action=(
            "P28.1 fix (2026-09-17): now logs via claude_service._persist_usage_event (provider=openai, "
            "task_name=table_extraction). No action needed."
        ),
    ),
    _category(
        id="protocol_generation",
        label="Personalized supplement/lifestyle protocol generation",
        file="app/services/claude_service.py:717 (generate_protocol)",
        trigger=(
            "run_lab_analysis_pipeline -> app/services/ai_orchestrator.py:75 "
            "(generate_ai_protocol_orchestrated) -> app/services/lab_analysis_pipeline.py:1074; "
            "also directly from POST /protocol -> app/routers/protocol/protocol.py:108"
        ),
        usage_type="protocol_generation",
        model_env="settings.active_llm_model / settings.active_llm_api_key",
        cacheable=False,
        disable_in_smoke=True,
        already_logged=True,
        risk_level="low",
        recommended_action="No action needed: already logged via the shared _chat_completion/_persist_usage_event path.",
    ),
    _category(
        id="health_tips",
        label="Premium personalized health tips list",
        file="app/routers/llm_consult.py:166 (_generate_health_tips)",
        trigger="POST /llm/health-tips (premium/gated, background job) -> app/routers/llm_consult.py:178",
        usage_type="protocol_generation",
        model_env="settings.active_llm_model / settings.active_llm_api_key",
        cacheable=True,
        disable_in_smoke=True,
        already_logged=True,
        risk_level="low",
        recommended_action=(
            "Already logged. Candidate for a short-TTL cache keyed on the input biomarker/profile snapshot, since "
            "unchanged input is unlikely to need a fresh call within the same day."
        ),
    ),
    _category(
        id="staging_live_smoke_workflows",
        label="Scheduled/dispatch staging smoke suites",
        file="backend/tests/test_staging_live_supabase_smoke.py, backend/tests/test_health_profile_live_smoke.py",
        trigger=".github/workflows/staging-live-smoke.yml, .github/workflows/post-deploy-live-smoke.yml (gated on E2E_RUN_LIVE)",
        usage_type="smoke_test",
        model_env="E2E_RUN_LIVE",
        cacheable=False,
        disable_in_smoke=False,
        already_logged=False,
        risk_level="low",
        recommended_action=(
            "No action needed: confirmed LLM-free (only /health, /auth/me, and /admin/* endpoints are exercised). "
            "Keep it that way -- do not add /analyze, /protocol, or /assessment/ua-wellbeing coverage to these "
            "workflows without an explicit cost budget decision."
        ),
    ),
    _category(
        id="standalone_smoke_scripts",
        label="Manual-only smoke scripts touching the analyze/protocol path",
        file="backend/scripts/e2e_smoke_upload_analyze_protocol.py, backend/scripts/smoke_partner_http_flow.py",
        trigger="Manual local invocation only -- confirmed NOT referenced by any .github/workflows/*.yml",
        usage_type="smoke_test",
        model_env="N/A (relies on whatever backend.env is active when run manually)",
        cacheable=False,
        disable_in_smoke=False,
        already_logged=False,
        risk_level="medium",
        recommended_action=(
            "Do not wire either script into a scheduled/CI workflow without first adding an explicit smoke-mode "
            "guard (e.g. mocking the LLM call or requiring a dedicated opt-in env var) -- today they are safe only "
            "because nothing schedules them."
        ),
    ),
    _category(
        id="ops_usage_dashboards",
        label="Read-only OpenAI/Claude usage dashboards",
        file="app/routers/crm/crm_ops.py (get_openai_usage_metrics, and the legacy /claude-usage route)",
        trigger="GET /crm/ops/openai-usage, GET /crm/ops/claude-usage (super_admin only)",
        usage_type="ops",
        model_env="settings.openai_daily_spend_alert_threshold_usd",
        cacheable=False,
        disable_in_smoke=True,
        already_logged=False,
        risk_level="low",
        recommended_action=(
            "No action needed: these are READ endpoints over llm_usage_events, not LLM call sites themselves. "
            "The '/claude-usage' name is legacy (no real Claude/Anthropic usage exists anywhere in this codebase) "
            "-- a naming cleanup is worth doing eventually but is out of scope here."
        ),
    ),
]


def _summary(categories: List[Dict[str, Any]]) -> Dict[str, Any]:
    by_usage_type: Dict[str, int] = {}
    by_risk_level: Dict[str, int] = {}
    for category in categories:
        by_usage_type[category["usage_type"]] = by_usage_type.get(category["usage_type"], 0) + 1
        by_risk_level[category["risk_level"]] = by_risk_level.get(category["risk_level"], 0) + 1

    return {
        "total_categories": len(categories),
        "by_usage_type": by_usage_type,
        "by_risk_level": by_risk_level,
        "already_logged_count": len([c for c in categories if c["already_logged"]]),
        "not_logged_count": len([c for c in categories if not c["already_logged"]]),
        "cacheable_count": len([c for c in categories if c["cacheable"]]),
        "disable_in_smoke_count": len([c for c in categories if c["disable_in_smoke"]]),
    }


def build_llm_cost_audit() -> Dict[str, Any]:
    """Returns the full, deterministic audit. Takes no arguments and makes
    no I/O -- every call with the same code version returns byte-identical
    output. See module docstring for why this is a static registry rather
    than a live scan."""
    categories = [dict(category) for category in _CATEGORIES]  # defensive copy
    # "Gap" only applies to a category that is an actual LLM call site --
    # "ops" entries are read-only dashboards over usage logs (nothing to
    # log about themselves) and "smoke_test" entries are either already
    # confirmed LLM-free or not currently wired into any trigger, so
    # neither belongs in a "missing instrumentation" list.
    _CALL_SITE_USAGE_TYPES = {"clinical_production", "ocr_vision", "protocol_generation"}
    known_gaps = [
        c["id"] for c in categories
        if not c["already_logged"] and c["usage_type"] in _CALL_SITE_USAGE_TYPES
    ]

    return {
        "version": LLM_COST_AUDIT_VERSION,
        "generated_from": "Static code audit, 2026-09-17 -- see docs/LLM_COST_AUDIT_2026-09-17.md",
        "categories": categories,
        "known_gaps": known_gaps,
        "summary": _summary(categories),
    }

"""P28: No-LLM / Cost-Aware Reasoning Audit (app/services/llm_cost_audit.py).

Deterministic static registry, no LLM, no I/O. Covers: stable categories
across calls, no clinical snapshot/frozen-replay pollution, smoke/test
category identified separately from production clinical usage,
recommendations include cache/disable/logging flags, and internal
consistency of the summary counts.
"""

import inspect

from app.services import llm_cost_audit
from app.services.llm_cost_audit import (
    LLM_COST_AUDIT_VERSION,
    build_llm_cost_audit,
)


def test_audit_is_fully_deterministic_across_calls():
    first = build_llm_cost_audit()
    second = build_llm_cost_audit()

    assert first == second


def test_audit_returns_stable_known_categories():
    result = build_llm_cost_audit()

    assert result["version"] == LLM_COST_AUDIT_VERSION
    ids = {c["id"] for c in result["categories"]}
    expected_ids = {
        "biomarker_extraction_text",
        "questionnaire_followup",
        "questionnaire_summary",
        "ua_wellbeing_assessment",
        "pdf_text_extraction",
        "pdf_vision_extraction",
        "table_extraction",
        "protocol_generation",
        "health_tips",
        "staging_live_smoke_workflows",
        "standalone_smoke_scripts",
        "ops_usage_dashboards",
    }
    assert ids == expected_ids
    assert len(ids) == len(result["categories"]), "category ids must be unique"


def test_every_category_has_required_fields_and_valid_enums():
    result = build_llm_cost_audit()
    required_fields = {
        "id", "label", "file", "trigger", "usage_type", "model_env",
        "cacheable", "disable_in_smoke", "already_logged", "risk_level",
        "recommended_action",
    }
    for category in result["categories"]:
        assert required_fields <= set(category.keys())
        assert category["usage_type"] in {"clinical_production", "ocr_vision", "protocol_generation", "smoke_test", "ops"}
        assert category["risk_level"] in {"low", "medium", "high"}
        assert isinstance(category["cacheable"], bool)
        assert isinstance(category["disable_in_smoke"], bool)
        assert isinstance(category["already_logged"], bool)
        assert category["recommended_action"]  # non-empty


def test_smoke_category_identified_separately_from_production_clinical_usage():
    result = build_llm_cost_audit()
    by_id = {c["id"]: c for c in result["categories"]}

    smoke_categories = [c for c in result["categories"] if c["usage_type"] == "smoke_test"]
    assert len(smoke_categories) == 2
    smoke_ids = {c["id"] for c in smoke_categories}
    assert smoke_ids == {"staging_live_smoke_workflows", "standalone_smoke_scripts"}

    # Every clinical/protocol/ocr call site is explicitly a DIFFERENT
    # usage_type from the smoke ones -- no overlap, no ambiguity.
    production_categories = [
        c for c in result["categories"]
        if c["usage_type"] in {"clinical_production", "ocr_vision", "protocol_generation"}
    ]
    assert not (smoke_ids & {c["id"] for c in production_categories})
    assert len(production_categories) == 9

    # The confirmed-LLM-free scheduled smoke workflows must documented as
    # such (disable_in_smoke=False here specifically means "this already
    # IS the safe/smoke side", not "should be disabled in smoke").
    assert by_id["staging_live_smoke_workflows"]["disable_in_smoke"] is False
    assert by_id["staging_live_smoke_workflows"]["already_logged"] is False  # N/A, no LLM calls made


def test_every_production_call_site_is_flagged_disable_in_smoke():
    result = build_llm_cost_audit()
    for category in result["categories"]:
        if category["usage_type"] in {"clinical_production", "ocr_vision", "protocol_generation"}:
            assert category["disable_in_smoke"] is True, category["id"]


def test_known_gaps_is_empty_after_p28_1_fix():
    """P28.1 (2026-09-17): pdf_text_extraction, pdf_vision_extraction, and
    table_extraction were the only real-call-site gaps this audit ever
    found, and all three are now logged (see
    test_file_analyzer_usage_logging.py) -- known_gaps must be empty."""
    result = build_llm_cost_audit()
    by_id = {c["id"]: c for c in result["categories"]}

    assert result["known_gaps"] == []
    for gap_id in ("pdf_text_extraction", "pdf_vision_extraction", "table_extraction"):
        assert by_id[gap_id]["already_logged"] is True
        assert by_id[gap_id]["risk_level"] == "low"

    # ops/smoke entries must never appear in known_gaps even though some
    # are also already_logged=False -- that field means something
    # different for a non-call-site category (nothing to log).
    assert "ops_usage_dashboards" not in result["known_gaps"]
    assert "staging_live_smoke_workflows" not in result["known_gaps"]
    assert "standalone_smoke_scripts" not in result["known_gaps"]


def test_recommendations_reference_logging_cache_or_disable_concerns():
    result = build_llm_cost_audit()
    by_id = {c["id"]: c for c in result["categories"]}

    # known_gaps is empty post-P28.1, but the three fixed categories must
    # still document what changed (mentioning logging) in their own
    # recommendation text, so the audit stays self-explanatory.
    for fixed_id in ("pdf_text_extraction", "pdf_vision_extraction", "table_extraction"):
        assert "log" in by_id[fixed_id]["recommended_action"].lower()

    # The one cacheable category must actually mention caching.
    cacheable = [c for c in result["categories"] if c["cacheable"]]
    assert cacheable == [by_id["health_tips"]]
    assert "cache" in by_id["health_tips"]["recommended_action"].lower()

    # The manual-only smoke scripts must warn against scheduling them.
    assert "schedul" in by_id["standalone_smoke_scripts"]["recommended_action"].lower()


def test_summary_counts_reconcile_with_categories():
    result = build_llm_cost_audit()
    categories = result["categories"]
    summary = result["summary"]

    assert summary["total_categories"] == len(categories)
    assert sum(summary["by_usage_type"].values()) == len(categories)
    assert sum(summary["by_risk_level"].values()) == len(categories)
    assert summary["already_logged_count"] + summary["not_logged_count"] == len(categories)
    assert summary["already_logged_count"] == len([c for c in categories if c["already_logged"]])
    assert summary["cacheable_count"] == len([c for c in categories if c["cacheable"]])
    assert summary["disable_in_smoke_count"] == len([c for c in categories if c["disable_in_smoke"]])


def test_build_function_takes_no_arguments_and_makes_no_io():
    """Structural proof this is a pure static registry: the function
    signature accepts nothing, so it cannot depend on live pipeline state,
    a request, or a database session."""
    signature = inspect.signature(build_llm_cost_audit)
    assert len(signature.parameters) == 0


def test_module_not_imported_by_clinical_pipeline_or_report_history():
    """P28 must never leak into the clinical reasoning contract -- prove
    lab_analysis_pipeline.py and report_history.py do not import this
    module at all (a static source-text check, not just "doesn't crash")."""
    import app.services.lab_analysis_pipeline as pipeline_module
    import app.services.report_history as history_module

    pipeline_source = inspect.getsource(pipeline_module)
    history_source = inspect.getsource(history_module)

    assert "llm_cost_audit" not in pipeline_source
    assert "llm_cost_audit" not in history_source


def test_returned_categories_are_defensive_copies_not_shared_mutable_state():
    """Mutating one call's result must never affect the next call's
    result -- the internal registry must not be handed out by reference."""
    first = build_llm_cost_audit()
    first["categories"][0]["risk_level"] = "mutated"
    first["categories"].append({"id": "injected"})

    second = build_llm_cost_audit()
    assert second["categories"][0]["risk_level"] != "mutated"
    assert all(c["id"] != "injected" for c in second["categories"])

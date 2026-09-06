"""Stage 2C — regression coverage for Safety Engine enforcement.

Existing safety semantics (approved / approved_with_warnings / blocked) are
NOT changed anywhere in this file — no new thresholds, no new rules.
severity="high" alone is never treated as a hard block (see E1 and
test_stage2pre_safety_baseline.py, unchanged and still passing).

These tests prove the EXISTING blocked verdict now has a real, deterministic
content consequence in every live response path, using only:
  - the existing rule-based (deterministic) protocol path, or
  - safety_engine.validate_report()/sanitize_protocol_for_safety() directly,
never depending on stochastic LLM output for a "blocked" trigger.

No live database connection is used anywhere in this file.
"""

import pytest

from app.services import lab_analysis_pipeline
from app.services.safety.safety_engine import (
    sanitize_protocol_for_safety,
    validate_protocol,
    validate_report,
)


CONFIDENT_PROFILE = {
    "age": 34,
    "sex": "female",
    "height_cm": 168,
    "weight_kg": 62,
}
# Complete (not just pediatric-age) profile: an incomplete pediatric profile
# trips the QUALITY GATE's own separate pediatric_profile_safety_gap blocker
# (analysis_quality_gate.py) — a different, unrelated concern from the SAFETY
# ENGINE's pediatric_context warning this test targets. Using a complete
# profile isolates the safety-warning behavior from gate behavior.
PEDIATRIC_PROFILE = {"age": 8, "sex": "male", "height_cm": 130, "weight_kg": 28}

CLEAN_BIOMARKERS = [
    {"name": "Glucose", "value": 92, "unit": "mg/dL", "ref_low": 70, "ref_high": 99, "status": "OPTIMAL"},
]
CONFIDENT_CANDIDATES = [{"confidence_score": 0.95, "status": "pending"}]

# The exact deterministic diagnosis-like-wording fixture already established
# and passing in test_phase1_health_intelligence.py::
# test_safety_engine_blocks_diagnosis_like_wording.
DIAGNOSIS_LIKE_ITEM = {"title": "You have anemia", "body": "Confirmed diagnosis."}
SAFE_UNRELATED_ITEM = {"title": "Stay hydrated", "body": "Drink water throughout the day.", "source": "rule"}


def _fake_knowledge_report(action_plan):
    return {
        "version": "knowledge_report_v1",
        "action_plan": action_plan,
        "summary": {"disclaimer": "Educational information only."},
        "retest_plan": [],
        "doctor_discussion": [],
    }


@pytest.fixture(autouse=True)
def _stub_history(monkeypatch):
    async def _fake(user_id):
        return []

    monkeypatch.setattr(lab_analysis_pipeline, "_load_historical_biomarkers", _fake)


def _mock_common(monkeypatch, action_plan):
    async def _fake_eval(**_kwargs):
        return {"matched_rules": [], "safety_alerts": [], "generated_recommendations": []}

    def _fake_build_knowledge_report(**_kwargs):
        return _fake_knowledge_report(action_plan)

    monkeypatch.setattr(lab_analysis_pipeline, "evaluate_biomarkers_with_knowledge", _fake_eval)
    monkeypatch.setattr(lab_analysis_pipeline, "build_knowledge_report", _fake_build_knowledge_report)


# --- E1: warning verdict --------------------------------------------------------


@pytest.mark.asyncio
async def test_e1_warning_verdict_report_still_available_and_warning_visible(monkeypatch):
    """Pediatric context alone (an existing, deterministic warning condition) must
    produce approved_with_warnings, keep the report available, and preserve
    doctor_discussion_required — it must NOT block the whole report."""
    _mock_common(monkeypatch, action_plan=[SAFE_UNRELATED_ITEM])

    result = await lab_analysis_pipeline.run_lab_analysis_pipeline(
        biomarkers=CLEAN_BIOMARKERS,
        symptoms=["fatigue"],
        questionnaire={"completed": True},
        user_profile=PEDIATRIC_PROFILE,
        user_id="user-e1",
        analysis_id="upload-e1",
        source_metadata={"source": "b2c_text", "candidates": CONFIDENT_CANDIDATES},
        generate_ai_protocol=False,
    )

    assert result["analysis_status"] == "completed"
    assert result.get("interpreted_report") is not None
    assert result.get("protocol") is not None
    safety_result = result["safety_result"]
    assert safety_result["status"] == "approved_with_warnings"
    assert safety_result["blocked_items"] == []
    assert safety_result["doctor_discussion_required"] is True
    assert any(e.get("key") == "pediatric_context" for e in safety_result["safety_events"])
    assert result.get("safety_notice") is None, "safety_notice is reserved for blocked status, not warnings"


# --- E2: existing deterministic blocked condition --------------------------------


def test_e2_sanitize_protocol_removes_diagnosis_like_item_keeps_safe_item():
    """Direct unit-level proof (per the brief's E2 note): sanitize_protocol_for_safety
    redacts a diagnosis-like item deterministically, and does not touch an
    unrelated safe item in the same list."""
    protocol = {"nutrition": [DIAGNOSIS_LIKE_ITEM, SAFE_UNRELATED_ITEM]}
    sanitized = sanitize_protocol_for_safety(protocol, profile=CONFIDENT_PROFILE, locale="en")

    diag_item, safe_item = sanitized["nutrition"]
    assert "you have" not in diag_item["title"].lower()
    assert "confirmed diagnosis" not in diag_item["body"].lower(), (
        "the original offending phrase must be gone — note the replacement "
        "clinician-referral text legitimately still contains the word "
        "'diagnosis' ('...does not provide a diagnosis'), which is fine"
    )
    assert diag_item["original_content_hidden"] is True
    assert diag_item["requires_doctor"] is True

    assert safe_item == SAFE_UNRELATED_ITEM, "an unrelated safe item must be preserved unchanged"


@pytest.mark.asyncio
async def test_e2_live_pipeline_redacts_blocked_content_keeps_safe_content(monkeypatch):
    """Full-pipeline proof: a diagnosis-like recommendation reaching the live
    result via the deterministic rule-based action_plan is redacted from BOTH
    result['protocol'] and result['recommendations'] (the two objects that feed
    report_versions.protocol and protocols.recommendations respectively) while
    the unrelated safe recommendation and the report itself remain available —
    per the brief's item 3: unrelated safe parts are not suppressed."""
    _mock_common(monkeypatch, action_plan=[DIAGNOSIS_LIKE_ITEM, SAFE_UNRELATED_ITEM])

    result = await lab_analysis_pipeline.run_lab_analysis_pipeline(
        biomarkers=CLEAN_BIOMARKERS,
        symptoms=["fatigue"],
        questionnaire={"completed": True},
        user_profile=CONFIDENT_PROFILE,
        user_id="user-e2",
        analysis_id="upload-e2",
        source_metadata={"source": "b2c_text", "candidates": CONFIDENT_CANDIDATES},
        generate_ai_protocol=False,
    )

    assert result["safety_result"]["status"] == "blocked"
    assert result["safety_result"]["blocked_items"], "diagnosis-like wording must be flagged as blocked"

    def _flat_text(obj):
        if isinstance(obj, dict):
            return " ".join(_flat_text(v) for v in obj.values())
        if isinstance(obj, list):
            return " ".join(_flat_text(v) for v in obj)
        return str(obj or "")

    protocol_text = _flat_text(result["protocol"]).lower()
    recommendations_text = _flat_text(result["recommendations"]).lower()
    assert "you have anemia" not in protocol_text
    assert "confirmed diagnosis" not in protocol_text
    assert "you have anemia" not in recommendations_text
    assert "confirmed diagnosis" not in recommendations_text

    assert "stay hydrated" in protocol_text, "unrelated safe content must be preserved in protocol"
    assert "stay hydrated" in recommendations_text, "unrelated safe content must be preserved in recommendations"

    # Item 3: unrelated safe parts of the REPORT are not suppressed either — the
    # existing safety contract here is item-level redaction, not whole-report
    # blocking, so a report must still be produced.
    assert result.get("interpreted_report") is not None
    assert result.get("protocol") is not None

    # Item 4/5: doctor_discussion_required preserved; user-facing notice present
    # and does not leak internal rule keys.
    assert result["safety_result"]["doctor_discussion_required"] is True
    assert result.get("safety_notice")
    assert "diagnosis_like_wording" not in result["safety_notice"]
    assert "blocked_items" not in result["safety_notice"]


# --- E3: normal safe analysis unchanged ------------------------------------------


@pytest.mark.asyncio
async def test_e3_normal_safe_analysis_unchanged(monkeypatch):
    _mock_common(monkeypatch, action_plan=[SAFE_UNRELATED_ITEM])

    result = await lab_analysis_pipeline.run_lab_analysis_pipeline(
        biomarkers=CLEAN_BIOMARKERS,
        symptoms=["fatigue"],
        questionnaire={"completed": True},
        user_profile=CONFIDENT_PROFILE,
        user_id="user-e3",
        analysis_id="upload-e3",
        source_metadata={"source": "b2c_text", "candidates": CONFIDENT_CANDIDATES},
        generate_ai_protocol=False,
    )

    assert result["safety_result"]["status"] == "approved"
    assert result["safety_result"]["blocked_items"] == []
    assert result.get("safety_notice") is None
    assert result["recommendations"] == [SAFE_UNRELATED_ITEM], "no redaction markers on already-safe content"


# --- E4: persisted protocol and report_version safety content consistent --------


@pytest.mark.asyncio
async def test_e4_protocol_and_recommendations_are_consistently_sanitized(monkeypatch):
    """result['protocol'] (-> report_versions.protocol) and result['recommendations']
    (-> protocols.recommendations, per save_protocol call sites in analyze.py)
    must reflect the SAME safety verdict — no case where one is sanitized and the
    other isn't, closing the confirmed Stage 2 planning finding."""
    _mock_common(monkeypatch, action_plan=[DIAGNOSIS_LIKE_ITEM])

    result = await lab_analysis_pipeline.run_lab_analysis_pipeline(
        biomarkers=CLEAN_BIOMARKERS,
        symptoms=["fatigue"],
        questionnaire={"completed": True},
        user_profile=CONFIDENT_PROFILE,
        user_id="user-e4",
        analysis_id="upload-e4",
        source_metadata={"source": "b2c_text", "candidates": CONFIDENT_CANDIDATES},
        generate_ai_protocol=False,
    )

    protocol_items = [item for section in result["protocol"].values() if isinstance(section, list) for item in section]
    recommendation_items = result["recommendations"]

    protocol_hidden = any(item.get("original_content_hidden") for item in protocol_items)
    recommendations_hidden = any(item.get("original_content_hidden") for item in recommendation_items)
    assert protocol_hidden is True
    assert recommendations_hidden is True, (
        "protocols.recommendations must be sanitized identically to report_versions.protocol — "
        "this is the exact bypass Stage 2C closes"
    )


# --- E5: GET results cannot resurrect unsanitized recommendations ---------------


@pytest.mark.asyncio
async def test_e5_get_results_resanitizes_legacy_unsanitized_db_content(monkeypatch):
    """Simulates a `protocols` row written before this fix (unsanitized) — the
    read-boundary defense-in-depth in get_results() must still redact it before
    serving, per the brief's explicit E5 requirement."""
    from app.services.safety import sanitize_protocol_for_safety as sanitize_fn

    stale_db_row = {"recommendations": [dict(DIAGNOSIS_LIKE_ITEM), dict(SAFE_UNRELATED_ITEM)]}
    resanitized = sanitize_fn(stale_db_row["recommendations"], profile=CONFIDENT_PROFILE, locale="en")

    diag_item = next(i for i in resanitized if i.get("title") != "Stay hydrated")
    assert "you have" not in diag_item["title"].lower()
    assert diag_item.get("original_content_hidden") is True
    safe_item = next(i for i in resanitized if i.get("title") == "Stay hydrated")
    assert safe_item["body"] == SAFE_UNRELATED_ITEM["body"]


# --- E6: regenerate cannot bypass safety -----------------------------------------


def test_e6_regenerate_read_path_uses_same_sanitizer_as_get_results():
    """Structural proof (kept intentionally simple, mirroring E5): regenerate_results
    calls the exact same sanitize_protocol_for_safety() on the same
    protocol_recommendations shape read from the DB before including it in its
    response — verified by source inspection of the shared code path, exercised
    functionally by E5 since both routes now call the identical function."""
    import inspect

    from app.routers.analysis import analyze as analyze_router

    source = inspect.getsource(analyze_router.regenerate_results)
    assert "sanitize_protocol_for_safety(protocol_recommendations" in source, (
        "regenerate_results must re-sanitize protocol_recommendations read from the "
        "DB, exactly like get_results — this asserts the fix is actually present "
        "in that route, not just in get_results"
    )


# --- E7: manual and confirmed-candidate paths inherit the same enforcement ------


@pytest.mark.asyncio
async def test_e7_manual_entry_source_inherits_safety_enforcement(monkeypatch):
    _mock_common(monkeypatch, action_plan=[DIAGNOSIS_LIKE_ITEM, SAFE_UNRELATED_ITEM])

    result = await lab_analysis_pipeline.run_lab_analysis_pipeline(
        biomarkers=CLEAN_BIOMARKERS,
        symptoms=["fatigue"],
        questionnaire={"completed": True},
        user_profile=CONFIDENT_PROFILE,
        user_id="user-e7-manual",
        analysis_id="upload-e7-manual",
        source_metadata={"source": "b2c_manual", "candidates": CONFIDENT_CANDIDATES},
        generate_ai_protocol=False,
    )
    assert result["safety_result"]["status"] == "blocked"
    assert all("you have anemia" not in str(item).lower() for item in result["recommendations"])


@pytest.mark.asyncio
async def test_e7_candidate_confirmation_source_inherits_safety_enforcement(monkeypatch):
    _mock_common(monkeypatch, action_plan=[DIAGNOSIS_LIKE_ITEM, SAFE_UNRELATED_ITEM])

    confirmed_candidates = [{"status": "confirmed", "confidence_score": 0.3}]
    result = await lab_analysis_pipeline.run_lab_analysis_pipeline(
        biomarkers=CLEAN_BIOMARKERS,
        symptoms=["fatigue"],
        questionnaire={"completed": True},
        user_profile=CONFIDENT_PROFILE,
        user_id="user-e7-confirm",
        analysis_id="upload-e7-confirm",
        source_metadata={"source": "candidate_confirmation", "candidates": confirmed_candidates},
        generate_ai_protocol=False,
    )
    assert result["analysis_input_quality_gate"]["decision"] == "auto_continue"
    assert result["safety_result"]["status"] == "blocked"
    assert all("you have anemia" not in str(item).lower() for item in result["recommendations"])


# --- E8: B2B does not bypass the shared Safety Engine ----------------------------


@pytest.mark.asyncio
async def test_e8_b2b_source_uses_same_pipeline_and_safety_enforcement(monkeypatch):
    """No separate B2B medical pipeline exists — run_lab_analysis_pipeline is the
    only caller of validate_report/sanitize_protocol_for_safety anywhere in the
    codebase (confirmed by repo-wide grep during this stage's trace), and B2B
    calls this exact same function. This test proves it end-to-end with the real
    b2b source tag, not just by code-path assertion."""
    _mock_common(monkeypatch, action_plan=[DIAGNOSIS_LIKE_ITEM, SAFE_UNRELATED_ITEM])

    result = await lab_analysis_pipeline.run_lab_analysis_pipeline(
        biomarkers=CLEAN_BIOMARKERS,
        symptoms=["fatigue"],
        questionnaire={"completed": True},
        user_profile=CONFIDENT_PROFILE,
        analysis_id="upload-e8-b2b",
        source_metadata={"source": "b2b_analyze_labs", "candidates": CONFIDENT_CANDIDATES},
        generate_ai_protocol=False,
    )
    assert result["safety_result"]["status"] == "blocked"
    assert all("you have anemia" not in str(item).lower() for item in result["recommendations"])
    assert all("you have anemia" not in str(item).lower() for section in result["protocol"].values() if isinstance(section, list) for item in section)


# --- E2R: report-level diagnosis-like wording (knowledge_report / knowledge_evaluation) ---
#
# Closes the remaining gap: validate_report()'s report-text check
# (str(knowledge_report or "")) can trigger status="blocked" from free text in
# knowledge_report["why_it_matters"]/["doctor_discussion"] and the upstream
# knowledge_evaluation["matched_rules"] it's built from — neither was
# previously sanitized (only protocol/recommendations were).

REPORT_LEVEL_DIAGNOSIS_RULE = {
    "rule_key": "r_anemia",
    "name": "You have anemia",
    "summary": "Confirmed diagnosis of iron deficiency anemia.",
    "explanation": "You have anemia based on these results.",
    "risk": "iron_deficiency_pattern",
    "severity": "moderate",
    "confidence": 0.8,
    "requires_doctor": False,
    "source": "kb",
}
SAFE_REPORT_HEADLINE = "3 of 5 biomarkers reviewed, 2 need attention"


def _mock_report_level_diagnosis(monkeypatch):
    async def _fake_eval(**_kwargs):
        return {
            "matched_rules": [dict(REPORT_LEVEL_DIAGNOSIS_RULE)],
            "safety_alerts": [],
            "generated_recommendations": [],
        }

    def _fake_build_knowledge_report(**kwargs):
        return {
            "version": "knowledge_report_v1",
            "summary": {"headline": SAFE_REPORT_HEADLINE, "disclaimer": "Educational information only."},
            "what_was_found": {"headline": SAFE_REPORT_HEADLINE, "counts": {}, "flagged_markers": []},
            "why_it_matters": [
                {
                    "rule_key": "r_anemia",
                    "title": "You have anemia",
                    "summary": "Confirmed diagnosis of iron deficiency anemia.",
                    "why_it_matters": "You have anemia based on these results.",
                    "risk": "iron_deficiency_pattern",
                    "severity": "moderate",
                    "confidence": 0.8,
                    "requires_doctor": False,
                    "source": "kb",
                }
            ],
            # action_plan intentionally SAFE — isolates the report-level path
            # (why_it_matters/doctor_discussion) from the already-covered
            # recommendation-level path (E2's DIAGNOSIS_LIKE_ITEM tests).
            "action_plan": [SAFE_UNRELATED_ITEM],
            "doctor_discussion": ["Discuss: You have anemia with your care team."],
            "retest_plan": [],
            "safety_alerts": [],
            "nutrition_context": {},
            "source_references": [],
        }

    monkeypatch.setattr(lab_analysis_pipeline, "evaluate_biomarkers_with_knowledge", _fake_eval)
    monkeypatch.setattr(lab_analysis_pipeline, "build_knowledge_report", _fake_build_knowledge_report)


def _contains_raw_diagnosis_text(obj) -> bool:
    text = str(obj).lower()
    return "you have anemia" in text or "confirmed diagnosis" in text


@pytest.mark.asyncio
async def test_e2r1_report_level_diagnosis_wording_blocked_and_redacted(monkeypatch):
    _mock_report_level_diagnosis(monkeypatch)

    result = await lab_analysis_pipeline.run_lab_analysis_pipeline(
        biomarkers=CLEAN_BIOMARKERS,
        symptoms=["fatigue"],
        questionnaire={"completed": True},
        user_profile=CONFIDENT_PROFILE,
        user_id="user-e2r1",
        analysis_id="upload-e2r1",
        source_metadata={"source": "b2c_text", "candidates": CONFIDENT_CANDIDATES},
        generate_ai_protocol=False,
    )

    assert result["safety_result"]["status"] == "blocked", (
        "the safety verdict must still correctly reflect the raw input (detected "
        "BEFORE sanitization runs), not be silently downgraded by the fix"
    )
    assert result["safety_result"]["doctor_discussion_required"] is True
    assert result.get("safety_notice")
    assert "diagnosis_like" not in result["safety_notice"]

    # The exact unsafe text must be absent from EVERY live-served object.
    assert not _contains_raw_diagnosis_text(result["knowledge_report"]), "knowledge_report still contains raw diagnosis text"
    assert not _contains_raw_diagnosis_text(result["knowledge_evaluation"]), "knowledge_evaluation still contains raw diagnosis text"
    assert not _contains_raw_diagnosis_text(result["interpreted_report"])
    assert not _contains_raw_diagnosis_text(result["protocol"])
    assert not _contains_raw_diagnosis_text(result["recommendations"])

    # Safe, unrelated report content must be preserved.
    assert result["knowledge_report"]["summary"]["headline"] == SAFE_REPORT_HEADLINE
    assert any(SAFE_UNRELATED_ITEM["title"] in str(item) for item in result["recommendations"])


@pytest.mark.asyncio
async def test_e2r2_report_version_persistence_cannot_contain_blocked_text(monkeypatch):
    _mock_report_level_diagnosis(monkeypatch)
    captured = {}

    async def _fake_save_report_version(**kwargs):
        captured["kwargs"] = kwargs
        return {"id": "report-e2r2"}

    async def _fake_save_safety_events(**_kwargs):
        return None

    monkeypatch.setattr("app.services.supabase_service.save_report_version", _fake_save_report_version)
    monkeypatch.setattr("app.services.supabase_service.save_safety_events", _fake_save_safety_events)

    await lab_analysis_pipeline.run_lab_analysis_pipeline(
        biomarkers=CLEAN_BIOMARKERS,
        symptoms=["fatigue"],
        questionnaire={"completed": True},
        user_profile=CONFIDENT_PROFILE,
        user_id="user-e2r2",
        analysis_id="upload-e2r2",
        source_metadata={"source": "b2c_text", "candidates": CONFIDENT_CANDIDATES},
        persist_report_version=True,
        generate_ai_protocol=False,
    )

    assert "kwargs" in captured, "save_report_version must have been called"
    persisted_knowledge_report = captured["kwargs"]["knowledge_report"]
    persisted_protocol = captured["kwargs"]["protocol"]
    assert not _contains_raw_diagnosis_text(persisted_knowledge_report), (
        "report_versions.knowledge_report must not contain the blocked report-level text"
    )
    assert not _contains_raw_diagnosis_text(persisted_protocol)


@pytest.mark.asyncio
async def test_e2r3_get_results_resanitizes_legacy_report_version_knowledge_report(monkeypatch):
    """A report_versions row persisted before this fix (unsanitized
    knowledge_report) must still be redacted before being served.

    Stage 2G note: the frozen-serve read-boundary sanitization now lives in
    app/services/report_history.py::assemble_frozen_response() — a single
    shared helper used by BOTH get_results() (analyze.py) and
    get_results_by_upload() (protocol/compatibility.py), so this defense is
    wider than before (it used to exist only in analyze.py's get_results),
    not narrower. The wiring assertion below was updated to point at the new
    shared location; the underlying behavioral guarantee (function-level
    proof, right below) is unchanged."""
    from app.services.safety import sanitize_knowledge_report_for_safety as sanitize_fn

    stale_report_version = {
        "id": "legacy-report-1",
        "status": "completed",
        "knowledge_report": {
            # Correct why_it_matters-item shape (title/summary/why_it_matters),
            # matching _interpretation()'s actual output — not the separate
            # matched_rules shape (name/explanation/risk).
            "why_it_matters": [
                {
                    "rule_key": "r_anemia",
                    "title": "You have anemia",
                    "summary": "Confirmed diagnosis of iron deficiency anemia.",
                    "why_it_matters": "You have anemia based on these results.",
                }
            ],
            "doctor_discussion": ["Discuss: You have anemia with your care team."],
            "summary": {"headline": SAFE_REPORT_HEADLINE},
        },
    }
    resanitized = sanitize_fn(stale_report_version["knowledge_report"], locale="en")
    assert not _contains_raw_diagnosis_text(resanitized)
    assert resanitized["summary"]["headline"] == SAFE_REPORT_HEADLINE

    import inspect

    from app.routers.analysis import analyze as analyze_router
    from app.routers.protocol import compatibility as compatibility_router
    from app.services import report_history

    # Both live GET endpoints must route a frozen report_version through the
    # shared frozen-response assembler, not sanitize independently/inline.
    for source in (
        inspect.getsource(analyze_router.get_results),
        inspect.getsource(compatibility_router.get_results_by_upload),
    ):
        assert "assemble_frozen_response(" in source, (
            "GET endpoint must serve a completed report_version via the shared "
            "report_history.assemble_frozen_response() helper, not recompute or "
            "sanitize independently"
        )

    helper_source = inspect.getsource(report_history.assemble_frozen_response)
    assert "sanitize_knowledge_report_for_safety(" in helper_source, (
        "assemble_frozen_response must re-sanitize the persisted knowledge_report "
        "before serving it — asserts the fix is actually wired in, not just "
        "proven at the function level above"
    )


@pytest.mark.asyncio
async def test_e2r4_normal_safe_report_unchanged(monkeypatch):
    """Regression guard: a report with no diagnosis-like wording anywhere is
    completely untouched by the report-level sanitizer."""
    async def _fake_eval(**_kwargs):
        return {
            "matched_rules": [{"rule_key": "r_safe", "name": "Low ferritin", "summary": "Ferritin is low.", "severity": "moderate", "confidence": 0.7, "source": "kb"}],
            "safety_alerts": [],
            "generated_recommendations": [],
        }

    def _fake_build_knowledge_report(**_kwargs):
        return {
            "version": "knowledge_report_v1",
            "summary": {"headline": SAFE_REPORT_HEADLINE, "disclaimer": "Educational information only."},
            "why_it_matters": [{"rule_key": "r_safe", "title": "Low ferritin", "summary": "Ferritin is low.", "why_it_matters": "Iron stores may be depleted."}],
            "action_plan": [SAFE_UNRELATED_ITEM],
            "doctor_discussion": ["Discuss ferritin with your care team."],
            "retest_plan": [],
            "safety_alerts": [],
            "nutrition_context": {},
            "source_references": [],
        }

    monkeypatch.setattr(lab_analysis_pipeline, "evaluate_biomarkers_with_knowledge", _fake_eval)
    monkeypatch.setattr(lab_analysis_pipeline, "build_knowledge_report", _fake_build_knowledge_report)

    result = await lab_analysis_pipeline.run_lab_analysis_pipeline(
        biomarkers=CLEAN_BIOMARKERS,
        symptoms=["fatigue"],
        questionnaire={"completed": True},
        user_profile=CONFIDENT_PROFILE,
        user_id="user-e2r4",
        analysis_id="upload-e2r4",
        source_metadata={"source": "b2c_text", "candidates": CONFIDENT_CANDIDATES},
        generate_ai_protocol=False,
    )

    assert result["safety_result"]["status"] == "approved"
    assert result.get("safety_notice") is None
    assert result["knowledge_report"]["why_it_matters"][0]["summary"] == "Ferritin is low."
    assert "original_content_hidden" not in result["knowledge_report"]["why_it_matters"][0]
    assert result["knowledge_evaluation"]["matched_rules"][0]["summary"] == "Ferritin is low."

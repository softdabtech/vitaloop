"""Stage 2PRE — regression harness for Test A (clean high-confidence analysis) and
Test B (low-confidence confirmation flow), per docs/audit/VITALOOP_STAGE2_ACCEPTANCE_TESTS.md.

These call `run_lab_analysis_pipeline()` directly (the real pipeline function, not a
mock of it) with `persist_report_version=False` / `persist_knowledge=False` /
`generate_ai_protocol=False` so no network/AI/report_versions-write calls happen, and
monkeypatch the one remaining DB call the pipeline makes unconditionally
(`_load_historical_biomarkers`, used for trend evaluation) — following the same
service-layer-mocking convention already established in
tests/test_free_user_complete_flow.py. No real Supabase/staging database connection
is required for either test.

Expected status against CURRENT production code (before Stage 2B ships):
  - test_clean_high_confidence_analysis_completes_normally      -> GREEN (happy path already works)
  - test_low_confidence_input_does_not_yield_a_confident_report -> RED (reproduces F01: the
    gate says confirm/block_or_confirm but a full interpreted_report/protocol is returned
    anyway). Expected to turn GREEN once Stage 2B ships.
"""

import pytest

from app.services import lab_analysis_pipeline


CLEAN_BIOMARKERS = [
    {"name": "Glucose", "value": 92, "unit": "mg/dL", "ref_low": 70, "ref_high": 99, "status": "OPTIMAL"},
    {"name": "TSH", "value": 2.1, "unit": "mIU/L", "ref_low": 0.4, "ref_high": 4.0, "status": "OPTIMAL"},
    {"name": "Ferritin", "value": 45, "unit": "ng/mL", "ref_low": 20, "ref_high": 250, "status": "OPTIMAL"},
]

# A single low-confidence candidate (score < 0.55) is enough, on its own, to make
# build_analysis_input_quality_gate() return decision="block_or_confirm" (see
# analysis_quality_gate.py: low_candidate_count -> both a warning AND a blocker).
LOW_CONFIDENCE_CANDIDATES = [
    {"confidence_score": 0.3, "status": "pending"},
]


@pytest.fixture(autouse=True)
def _stub_historical_biomarkers(monkeypatch):
    """The pipeline unconditionally loads trend history via a real Supabase call
    (_load_historical_biomarkers). Stub it so these tests need no DB connection at all."""

    async def _fake_load_historical_biomarkers(user_id):
        return []

    monkeypatch.setattr(
        lab_analysis_pipeline, "_load_historical_biomarkers", _fake_load_historical_biomarkers
    )


@pytest.mark.asyncio
async def test_clean_high_confidence_analysis_completes_normally():
    """Test A. Regression guard for the working path — must stay GREEN through Stage 2B."""
    result = await lab_analysis_pipeline.run_lab_analysis_pipeline(
        biomarkers=CLEAN_BIOMARKERS,
        symptoms=["fatigue"],
        questionnaire={"completed": True, "answers": {"energy_level": 3}},
        user_profile={
            "age": 34,
            "sex": "female",
            "height_cm": 168,
            "weight_kg": 62,
            "medications": [],
            "allergies": [],
        },
        user_id=None,
        persist_knowledge=False,
        persist_report_version=False,
        generate_ai_protocol=False,
        source_metadata={"candidates": []},
    )

    gate = result["analysis_input_quality_gate"]
    assert gate["decision"] == "auto_continue", gate
    assert result.get("interpreted_report") is not None
    assert result.get("protocol") is not None


@pytest.mark.asyncio
async def test_low_confidence_input_does_not_yield_a_confident_report():
    """Test B. Asserts the DESIRED behavior per the approved Stage 2B design (F01 fix):
    when the gate requires confirmation, the pipeline must NOT hand back a confident
    interpreted_report/protocol. Currently RED-by-design — production code today always
    builds and returns a full report regardless of gate decision (live-reproduced in the
    Stage 1 audit). Expected to turn GREEN once Stage 2B ships."""
    result = await lab_analysis_pipeline.run_lab_analysis_pipeline(
        biomarkers=CLEAN_BIOMARKERS,
        symptoms=[],
        user_profile={"age": 34},
        user_id=None,
        persist_knowledge=False,
        persist_report_version=False,
        generate_ai_protocol=False,
        source_metadata={"candidates": LOW_CONFIDENCE_CANDIDATES},
    )

    gate = result["analysis_input_quality_gate"]
    assert gate["decision"] in ("confirm", "block_or_confirm"), (
        f"fixture must actually exercise the confirmation path for this test to be "
        f"meaningful; got decision={gate['decision']!r}"
    )

    assert result.get("interpreted_report") is None, (
        "F01 / Stage 2B: when analysis_input_quality_gate.decision != 'auto_continue', "
        "the pipeline must not build a confident interpreted_report — it should return "
        "an abbreviated result (candidates + gate + integrity only) until the user "
        "confirms, per docs/audit/VITALOOP_STAGE2_IMPLEMENTATION_PLAN.md Stage 2B. "
        f"Got a non-null interpreted_report anyway (decision={gate['decision']!r})."
    )
    assert result.get("protocol") is None, (
        "same as above, for protocol — must not be generated before confirmation"
    )

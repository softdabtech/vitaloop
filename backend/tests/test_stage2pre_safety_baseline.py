"""Stage 2PRE — regression harness for safety-verdict baseline behavior (Test D, Test E.3).

Pure unit tests against `safety_engine.validate_report()` — no DB, no LLM call.

Expected status against CURRENT production code (before Stage 2C ships):
  Both tests should already be GREEN today — this file is a REGRESSION GUARD proving the
  currently-correct semantics (pediatric context alone -> approved_with_warnings, not blocked;
  severity=high alone -> not a hard block) so Stage 2C's enforcement work does not
  accidentally over-trigger a block for these baseline cases.

  This does NOT test Stage 2C's still-to-be-built redaction/withholding behavior — that
  (Test E1/E2) is scoped separately per docs/audit/VITALOOP_STAGE2_IMPLEMENTATION_PLAN.md,
  Stage 2C, and is not part of Stage 2PRE.
"""

from app.services.safety.safety_engine import validate_report


PEDIATRIC_PROFILE = {"age": 8}
NON_DANGEROUS_BIOMARKERS = [
    {"name": "glucose", "value": 92, "unit": "mg/dL", "ref_low": 70, "ref_high": 99},
    {"name": "tsh", "value": 2.1, "unit": "mIU/L", "ref_low": 0.4, "ref_high": 4.0},
]


def test_pediatric_context_alone_is_approved_with_warnings_not_blocked():
    """Test D. A pediatric profile with no dangerous values and no unsafe recommendation
    text must surface as a visible warning (doctor_discussion_required), not a hard block."""
    result = validate_report(
        biomarkers=NON_DANGEROUS_BIOMARKERS,
        knowledge_report="Your thyroid and glucose markers are within the expected range for your age.",
        protocol=[],
        profile=PEDIATRIC_PROFILE,
    )

    assert result["status"] == "approved_with_warnings"
    assert result["blocked_items"] == []
    assert result["doctor_discussion_required"] is True
    assert any(e.get("key") == "pediatric_context" for e in result["safety_events"])


def test_severity_high_alone_does_not_imply_hard_block():
    """Test E.3 (from the acceptance test doc). severity="high" (e.g. a dangerous-but-not-
    critical lab value or a plain pediatric_context event) must not, by itself, produce a
    "blocked" status — only diagnosis-like wording or sensitive-supplement-dosage-in-a-
    pediatric/pregnancy-context should. This guards against Stage 2C conflating severity
    with the hard-block decision, per the explicit correction in the approved plan."""
    result = validate_report(
        biomarkers=[
            # HbA1c >= 9.0 triggers a "high" severity dangerous_hba1c event (not "critical").
            {"name": "hba1c", "value": 9.4, "unit": "%", "ref_low": 4.0, "ref_high": 5.6},
        ],
        knowledge_report="Your HbA1c is elevated and outside the reference range.",
        protocol=[],
        profile=PEDIATRIC_PROFILE,
    )

    assert any(e.get("severity") == "high" for e in result["safety_events"]), (
        "fixture must actually exercise a high-severity event for this test to be meaningful"
    )
    assert result["status"] != "blocked", (
        "a high-severity event alone (no diagnosis-like wording, no sensitive-dosage-in-"
        "pediatric-context) must not produce a hard block"
    )

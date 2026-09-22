"""2026-09-22 regression: validate_recommendation()'s doctor_discussion_
required flag is driven partly by _profile_events(), which used to treat
any non-empty free-text health-profile field as "a real answer" -- so a
"Known allergies" field literally containing "No" fired
known_allergies_context on every report, regardless of biomarkers.
"""

from app.services.safety.safety_engine import validate_recommendation

PLAIN_RECOMMENDATION = {"title": "Nutrition foundation", "body": "Eat a balanced diet."}


def test_negative_free_text_answer_does_not_require_doctor_discussion():
    profile = {
        "current_medications": "No",
        "allergies": "None",
        "current_supplements": "n/a",
        "prior_diagnoses": "Нет",
    }
    result = validate_recommendation(PLAIN_RECOMMENDATION, profile=profile)
    assert result["doctor_discussion_required"] is False
    assert result["status"] == "approved"


def test_real_free_text_answer_still_requires_doctor_discussion():
    profile = {"current_medications": "Metformin 500mg twice daily"}
    result = validate_recommendation(PLAIN_RECOMMENDATION, profile=profile)
    assert result["doctor_discussion_required"] is True
    assert result["status"] == "approved_with_warnings"


def test_empty_profile_fields_do_not_require_doctor_discussion():
    profile = {"current_medications": "", "allergies": "   ", "current_supplements": None}
    result = validate_recommendation(PLAIN_RECOMMENDATION, profile=profile)
    assert result["doctor_discussion_required"] is False


def test_negative_answer_is_case_and_punctuation_insensitive():
    profile = {"allergies": "  NONE.  "}
    result = validate_recommendation(PLAIN_RECOMMENDATION, profile=profile)
    assert result["doctor_discussion_required"] is False


def test_no_profile_at_all_does_not_require_doctor_discussion():
    result = validate_recommendation(PLAIN_RECOMMENDATION, profile=None)
    assert result["doctor_discussion_required"] is False

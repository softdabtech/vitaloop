"""2026-09-22 regression: the fallback protocol generator's "Nutrition
foundation" item mentions food sources of iron/B12/folate (a recognized
"sensitive supplement" keyword) without any clinician/safety wording
anywhere in the item. safety_engine.py's validate_recommendation() then
flags it for "missing safety wording" on every report that hits this
fallback path (AI protocol generation returning empty) -- regardless of
biomarkers or profile. Found while re-verifying the personal-baseline and
safety-engine profile-event fixes: a brand-new, single in-range marker
report still showed a false "discuss with a doctor" banner, traced here.
"""

from app.services.claude_service import _fallback_generate_protocol
from app.services.safety.safety_engine import validate_protocol

IN_RANGE_BIOMARKER = [{"name": "Glucose (Fasting)", "value": 88, "unit": "mg/dL", "status": "OPTIMAL"}]


def test_en_fallback_protocol_does_not_require_doctor_discussion():
    items = _fallback_generate_protocol(IN_RANGE_BIOMARKER, [], locale="en")
    nutrition_item = next(i for i in items if i["supplement"] == "Nutrition foundation")
    assert "clinician" in nutrition_item["rationale"].lower()

    result = validate_protocol({"self_care": items})
    assert result["doctor_discussion_required"] is False
    assert result["status"] == "approved"


def test_uk_fallback_protocol_does_not_require_doctor_discussion():
    items = _fallback_generate_protocol(IN_RANGE_BIOMARKER, [], locale="uk")
    nutrition_item = next(i for i in items if i["supplement"] == "Базове харчування")
    assert "лікар" in nutrition_item["rationale"].lower()

    result = validate_protocol({"self_care": items})
    assert result["doctor_discussion_required"] is False
    assert result["status"] == "approved"

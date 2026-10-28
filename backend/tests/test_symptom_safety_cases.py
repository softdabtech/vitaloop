import json
from pathlib import Path

import pytest

from app.services.symptom_safety_policy import merge_symptom_safety


FIXTURE_PATH = Path(__file__).parent / "fixtures" / "symptom_safety_cases.json"


def _fixture():
    return json.loads(FIXTURE_PATH.read_text(encoding="utf-8"))


@pytest.mark.parametrize("case", _fixture()["contract_cases"], ids=lambda case: case["id"])
def test_safety_contract_matrix(case):
    decision = merge_symptom_safety(
        internal_level=case["internal_level"],
        provider_triage_level=case["provider_triage_level"],
        provider_serious_observations=case["provider_serious"],
        provider_root_cause=case["provider_root_cause"],
    )
    assert decision.final_level.value == case["expected_level"]
    assert decision.interrupt is case["expected_interrupt"]


def test_clinical_review_cases_are_complete_but_cannot_activate_themselves():
    fixture = _fixture()
    cases = fixture["clinical_review_cases"]
    required_ids = {
        "digestive_black_stool",
        "palpitations_with_syncope",
        "heavy_menstrual_bleeding",
        "severe_breathing_difficulty",
        "good_wellbeing_no_concern",
        "insufficient_unknown_answers",
    }
    assert {case["id"] for case in cases} == required_ids
    assert all(case["status"] == "draft" for case in cases)
    assert all(case["root_concern_id"] for case in cases)
    assert all(case["required_decision"] for case in cases)

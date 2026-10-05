from copy import deepcopy

from scripts.audit_semantic_acceptance import build_p5_audit
from tests.test_p5_semantic_acceptance import _contracts
from app.services.semantic_acceptance import build_semantic_acceptance


def _payload():
    synthesis, narrative = _contracts()
    final = {
        "case_synthesis": synthesis,
        "grounded_ai_narrative": narrative,
        "symptom_analysis": {"status": "no_symptom_snapshot"},
        "action_plan_by_role": {"buckets": {}},
        "safety_result": {"status": "approved", "safety_events": []},
    }
    final["semantic_acceptance"] = build_semantic_acceptance(
        case_synthesis=synthesis,
        grounded_ai_narrative=narrative,
        symptom_analysis=final["symptom_analysis"],
        action_plan_by_role=final["action_plan_by_role"],
        safety_result=final["safety_result"],
    )
    return {"final_analysis": final}


def test_read_only_p5_audit_passes_reproducible_contract():
    audit = build_p5_audit(_payload())

    assert audit["passed"] is True
    assert audit["failures"] == []
    assert audit["acceptance_status"] == "passed"


def test_read_only_p5_audit_detects_missing_contract():
    assert build_p5_audit({"final_analysis": {}})["failures"] == ["semantic_acceptance_missing"]


def test_read_only_p5_audit_detects_tampered_frozen_result():
    payload = _payload()
    payload["final_analysis"]["semantic_acceptance"]["passes_dod"] = False

    audit = build_p5_audit(payload)

    assert audit["passed"] is False
    assert "passes_dod_mismatch" in audit["failures"]
    assert "frozen_acceptance_not_reproducible" in audit["failures"]

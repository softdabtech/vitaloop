import copy

import pytest

from app.services.protocol_evidence_snapshot import (
    authorize_action_from_snapshot,
    build_protocol_evidence_snapshot,
    verify_protocol_evidence_snapshot,
)


def _rule(**overrides):
    rule = {
        "rule_id": "rule-1",
        "rule_key": "low_ferritin_followup",
        "version": "v3",
        "recommendation_keys": ["iron_followup"],
        "source": "reviewed-guideline",
        "source_url": "https://example.test/guideline",
        "medical_reviewed_at": "2026-09-01T00:00:00Z",
        "evidence": [
            {
                "type": "lab_marker",
                "key": "ferritin",
                "value": 18,
                "unit": "ng/mL",
                "matched": True,
            }
        ],
    }
    rule.update(overrides)
    return rule


def _recommendation(**overrides):
    recommendation = {
        "id": "rec-1",
        "key": "iron_followup",
        "title": "Discuss iron follow-up",
        "body": "Review ferritin results with a clinician.",
        "source": "reviewed-guideline",
        "source_url": "https://example.test/guideline",
    }
    recommendation.update(overrides)
    return recommendation


def _input_context(status="DEFICIENT"):
    return {
        "biomarkers": [
            {
                "name": "Ferritin",
                "canonical_name": "ferritin",
                "value": 18,
                "unit": "ng/mL",
                "status": status,
            }
        ],
        "symptom_snapshot": None,
    }


def _snapshot(**overrides):
    args = {
        "report_version_id": "report-version-1",
        "input_context": _input_context(),
        "evaluated_rules": [_rule()],
        "canonical_recommendations": [_recommendation()],
    }
    args.update(overrides)
    return build_protocol_evidence_snapshot(**args)


def _action(**overrides):
    action = {
        "key": "iron_followup",
        "title": "Discuss iron follow-up",
        "body": "Review ferritin results with a clinician.",
    }
    action.update(overrides)
    return action


def test_valid_frozen_rule_recommendation_pair_verifies_but_is_not_authoritative():
    first = _snapshot()
    second = _snapshot()

    assert first == second
    assert first["schema"] == "protocol_action_evidence_snapshot_v1"
    entry = first["entries"][0]
    assert entry["rule"]["version"] == "v3"
    assert entry["recommendation"]["body"] == _recommendation()["body"]
    assert any(ref["type"] == "biomarker_measurement" for ref in entry["evidence_refs"])
    assert verify_protocol_evidence_snapshot(
        first,
        report_version_id="report-version-1",
        input_context=_input_context(),
    )["valid"]
    result = authorize_action_from_snapshot(
        _action(),
        first,
        report_version_id="report-version-1",
        input_context=_input_context(),
    )
    assert result["outcome"] == "UNSUPPORTED"
    assert result["reasons"] == ["owner_scoped_report_authorization_required"]


def test_rule_version_mismatch_is_rejected():
    snapshot = _snapshot()
    changed = copy.deepcopy(snapshot)
    changed["entries"][0]["rule"]["version"] = "v4"
    result = verify_protocol_evidence_snapshot(
        changed,
        report_version_id="report-version-1",
        input_context=_input_context(),
    )

    assert result == {"valid": False, "reason": "integrity_hash_mismatch"}


def test_conflicting_evaluated_versions_for_same_rule_are_rejected():
    with pytest.raises(ValueError, match="version is conflicting"):
        _snapshot(
            evaluated_rules=[
                _rule(),
                _rule(version="v4", recommendation_keys=["iron_followup"]),
            ]
        )


def test_canonical_recommendation_modification_is_rejected():
    snapshot = _snapshot()
    changed = copy.deepcopy(snapshot)
    changed["entries"][0]["recommendation"]["body"] = "Different clinical action."

    assert verify_protocol_evidence_snapshot(
        changed,
        report_version_id="report-version-1",
        input_context=_input_context(),
    )["reason"] == "integrity_hash_mismatch"


def test_cross_report_reference_and_report_identity_mismatch_fail_closed():
    snapshot = _snapshot()
    assert verify_protocol_evidence_snapshot(
        snapshot,
        report_version_id="report-version-2",
        input_context=_input_context(),
    )["reason"] == "report_version_mismatch"

    changed = copy.deepcopy(snapshot)
    changed["entries"][0]["evidence_refs"][0]["report_id"] = "other-report"
    assert verify_protocol_evidence_snapshot(
        changed,
        report_version_id="report-version-1",
        input_context=_input_context(),
    )["reason"] == "integrity_hash_mismatch"


@pytest.mark.parametrize(
    "rules,recommendations",
    [
        ([], [_recommendation()]),
        ([_rule(recommendation_keys=[])], [_recommendation()]),
        ([_rule(recommendation_keys=["iron_followup", "iron_followup"])], [_recommendation()]),
        ([_rule()], []),
        ([_rule()], [_recommendation(), _recommendation(id="rec-2")]),
        ([_rule(rule_id="")], [_recommendation()]),
        ([_rule(version="")], [_recommendation()]),
    ],
)
def test_missing_duplicate_or_incomplete_rule_catalog_pairs_are_rejected(rules, recommendations):
    with pytest.raises(ValueError):
        _snapshot(evaluated_rules=rules, canonical_recommendations=recommendations)


@pytest.mark.parametrize("status", ["UNKNOWN", "UNEVALUATED", "NEEDS_CONFIRMATION"])
def test_ineligible_biomarker_evidence_is_rejected(status):
    with pytest.raises(ValueError, match="ineligible"):
        _snapshot(input_context=_input_context(status))


def test_missing_legacy_snapshot_fails_closed():
    result = verify_protocol_evidence_snapshot(
        None,
        report_version_id="report-version-1",
        input_context=_input_context(),
    )
    assert result == {"valid": False, "reason": "missing_evidence_snapshot"}


def test_tampering_and_input_context_mismatch_fail_closed():
    snapshot = _snapshot()
    changed_context = _input_context()
    changed_context["biomarkers"][0]["value"] = 19
    assert verify_protocol_evidence_snapshot(
        snapshot,
        report_version_id="report-version-1",
        input_context=changed_context,
    )["reason"] == "input_context_mismatch"

    changed = copy.deepcopy(snapshot)
    changed["integrity_hash"] = "0" * 64
    assert verify_protocol_evidence_snapshot(
        changed,
        report_version_id="report-version-1",
        input_context=_input_context(),
    )["reason"] == "integrity_hash_mismatch"


def test_snapshot_excludes_patient_ids_and_unrelated_metadata():
    snapshot = _snapshot()

    rendered = str(snapshot)
    assert "private-id" not in rendered
    assert "internal_note" not in rendered
    assert "age" not in rendered
    with pytest.raises(ValueError, match="unsupported fields"):
        _snapshot(
            input_context={
                **_input_context(),
                "patient_id": "private-id",
                "profile": {"age": 42},
                "unrelated_metadata": {"internal_note": "private"},
            }
        )


def test_modified_action_and_missing_snapshot_are_unsupported():
    snapshot = _snapshot()
    assert authorize_action_from_snapshot(
        _action(body="Take vitamin D3 5000 IU daily."),
        snapshot,
        report_version_id="report-version-1",
        input_context=_input_context(),
    )["outcome"] == "UNSUPPORTED"
    assert authorize_action_from_snapshot(
        _action(),
        None,
        report_version_id="report-version-1",
        input_context=_input_context(),
    )["outcome"] == "UNSUPPORTED"

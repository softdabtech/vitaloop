import json

import pytest

from app.services.protocol_evidence import (
    build_protocol_evidence_registry,
    validate_action_grounding,
    validate_evidence_reference,
)


def _biomarker(*, name="Ferritin", value=18, status="DEFICIENT", unit="ng/mL"):
    return {
        "name": name,
        "canonical_name": f"canonical_{name.lower().replace(' ', '_')}",
        "value": value,
        "unit": unit,
        "status": status,
        "ref_low": 30,
        "reference_source": "lab_report",
    }


def _matched_rule(recommendation_keys=None):
    return {
        "rule_id": "rule-123",
        "rule_key": "low_ferritin_followup",
        "recommendation_keys": recommendation_keys or ["iron_followup"],
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


def _registry(**kwargs):
    defaults = {
        "report_id": "report-a",
        "biomarkers": [_biomarker()],
        "matched_rules": [_matched_rule()],
        "symptom_snapshot": None,
        "profile": {},
    }
    defaults.update(kwargs)
    return build_protocol_evidence_registry(**defaults)


def _ref(registry, evidence_type, *, claim=None, report_id=None):
    evidence = next(item for item in registry["evidence"] if item["type"] == evidence_type)
    reference = {
        "type": evidence_type,
        "id": evidence["id"],
        "report_id": report_id or registry["report_id"],
    }
    if claim is not None:
        reference["claim"] = claim
    return reference


def test_registry_ids_are_deterministic_serializable_and_report_scoped():
    kwargs = {
        "report_id": "report-a",
        "biomarkers": [_biomarker(), _biomarker(name="Vitamin D", value=21)],
        "matched_rules": [_matched_rule()],
    }
    first = build_protocol_evidence_registry(**kwargs)
    second = build_protocol_evidence_registry(**kwargs)
    other_report = build_protocol_evidence_registry(**{**kwargs, "report_id": "report-b"})

    assert first == second
    assert json.loads(json.dumps(first)) == first
    assert {item["id"] for item in first["evidence"]}.isdisjoint(
        {item["id"] for item in other_report["evidence"]}
    )


def test_duplicate_measurements_remain_distinguishable():
    registry = _registry(biomarkers=[_biomarker(), _biomarker()])
    rows = [item for item in registry["evidence"] if item["type"] == "biomarker_measurement"]

    assert len(rows) == 2
    assert rows[0]["id"] != rows[1]["id"]
    assert all(item["claim_types"] == ["measurement", "confirmed_abnormality"] for item in rows)


@pytest.mark.parametrize("status", ["UNKNOWN", "UNEVALUATED", "NEEDS_CONFIRMATION", "BORDERLINE", "OPTIMAL"])
def test_unconfirmed_biomarker_cannot_support_confirmed_abnormality(status):
    registry = _registry(biomarkers=[_biomarker(status=status)])
    reference = _ref(registry, "biomarker_measurement", claim="confirmed_abnormality")

    result = validate_evidence_reference(reference, registry)

    assert result == {"valid": False, "reason": "biomarker_claim_not_supported"}
    assert validate_evidence_reference(
        _ref(registry, "biomarker_measurement", claim="measurement"),
        registry,
    )["valid"]


def test_valid_deficient_or_elevated_measurements_support_abnormality_claim():
    for status in ("DEFICIENT", "ELEVATED"):
        registry = _registry(biomarkers=[_biomarker(status=status)])
        reference = _ref(registry, "biomarker_measurement", claim="confirmed_abnormality")
        assert validate_evidence_reference(reference, registry)["valid"]


def test_incomplete_biomarker_cannot_be_referenced_as_a_measurement():
    registry = _registry(biomarkers=[_biomarker(value=None, unit="")])
    reference = _ref(registry, "biomarker_measurement", claim="measurement")

    assert validate_evidence_reference(reference, registry) == {
        "valid": False,
        "reason": "biomarker_measurement_incomplete",
    }


def test_rule_recommendation_reference_preserves_exact_join_and_matched_evidence():
    registry = _registry(matched_rules=[_matched_rule(["iron_followup"])])
    reference = _ref(registry, "kb_rule_recommendation", claim="rule_recommendation")
    evidence = validate_evidence_reference(reference, registry)["evidence"]

    assert evidence["rule_key"] == "low_ferritin_followup"
    assert evidence["recommendation_key"] == "iron_followup"
    assert evidence["evidence"][0]["key"] == "ferritin"
    assert validate_evidence_reference(reference, registry)["valid"]

    unrelated = _registry(matched_rules=[_matched_rule(["other_recommendation"])])
    assert validate_evidence_reference(reference, unrelated)["valid"] is False


def test_action_key_cannot_use_an_unrelated_rule_recommendation_reference():
    registry = _registry(matched_rules=[_matched_rule(["iron_followup"])])
    iron_reference = _ref(registry, "kb_rule_recommendation", claim="rule_recommendation")
    action = {
        "key": "vitamin_d_high_dose",
        "title": "Vitamin D high-dose plan",
        "grounding": {
            "designation": "personalized",
            "evidence_refs": [iron_reference],
        },
    }

    result = validate_action_grounding(action, registry)
    assert result["outcome"] == "UNSUPPORTED"
    assert result["reasons"] == ["action_recommendation_key_mismatch"]

    action["key"] = "iron_followup"
    action["title"] = "Discuss iron follow-up"
    action["body"] = "Review ferritin results with a clinician."
    result = validate_action_grounding(action, registry)
    assert result["outcome"] == "UNSUPPORTED"
    assert result["reasons"] == ["server_owned_recommendation_catalog_required"]


def test_string_recommendation_keys_are_rejected_not_split_into_characters():
    malformed_rule = _matched_rule()
    malformed_rule["recommendation_keys"] = "iron_followup"
    registry = _registry(matched_rules=[malformed_rule])

    assert not any(item["type"] == "kb_rule_recommendation" for item in registry["evidence"])


def test_rules_without_matched_evidence_or_recommendation_relationship_are_excluded():
    no_match = _matched_rule()
    no_match["evidence"][0]["matched"] = False
    registry = _registry(matched_rules=[no_match])

    assert not any(item["type"] == "kb_rule_recommendation" for item in registry["evidence"])


def test_only_present_mapped_symptoms_are_registered():
    snapshot = {
        "version": "symptom_snapshot_v1",
        "session_id": "session-1",
        "completed_at": "2026-10-15T10:00:00Z",
        "evidence": {
            "present": [
                {"vitaloop_concept_id": "fatigue", "mapping_status": "mapped", "display_name_en": "Fatigue"}
            ],
            "absent": [
                {"vitaloop_concept_id": "headache", "mapping_status": "mapped", "display_name_en": "Headache"}
            ],
            "unknown": [
                {"vitaloop_concept_id": "nausea", "mapping_status": "mapped", "display_name_en": "Nausea"}
            ],
        },
    }
    registry = _registry(symptom_snapshot=snapshot, matched_rules=[])
    symptoms = [item for item in registry["evidence"] if item["type"] == "present_symptom_concept"]

    assert [item["concept_id"] for item in symptoms] == ["fatigue"]
    assert validate_evidence_reference(
        _ref(registry, "present_symptom_concept", claim="present_symptom"),
        registry,
    )["valid"]


def test_present_symptom_conflicting_with_absent_or_unknown_is_excluded():
    snapshot = {
        "version": "symptom_snapshot_v1",
        "session_id": "session-1",
        "completed_at": "2026-10-15T10:00:00Z",
        "evidence": {
            "present": [
                {"vitaloop_concept_id": "fatigue", "mapping_status": "mapped"},
                {"vitaloop_concept_id": "nausea", "mapping_status": "approved"},
                {"vitaloop_concept_id": "headache", "mapping_status": "mapped"},
                {"vitaloop_concept_id": "cough", "mapping_status": "mapped"},
            ],
            "absent": [{"vitaloop_concept_id": "fatigue", "mapping_status": "mapped"}],
            "unknown": [
                {"vitaloop_concept_id": "nausea", "mapping_status": "mapped"},
                {"vitaloop_concept_id": "HEADACHE", "mapping_status": "mapped"},
            ],
        },
    }
    registry = _registry(symptom_snapshot=snapshot, matched_rules=[])

    assert [
        item["concept_id"]
        for item in registry["evidence"]
        if item["type"] == "present_symptom_concept"
    ] == ["cough"]


def test_incomplete_or_unmapped_symptom_snapshots_add_no_present_symptoms():
    snapshot = {
        "version": "symptom_snapshot_v1",
        "completed_at": "2026-10-15T10:00:00Z",
        "evidence": {
            "present": [{"vitaloop_concept_id": "symptom-x", "mapping_status": "unmapped"}],
        },
    }
    registry = _registry(symptom_snapshot=snapshot, matched_rules=[])

    assert not any(item["type"] == "present_symptom_concept" for item in registry["evidence"])
    incomplete = _registry(
        symptom_snapshot={"version": "symptom_snapshot_v1", "evidence": {"present": [{"vitaloop_concept_id": "fatigue", "mapping_status": "mapped"}]}},
        matched_rules=[],
    )
    assert not any(item["type"] == "present_symptom_concept" for item in incomplete["evidence"])


def test_profile_fields_are_allowlisted_and_context_only():
    registry = _registry(
        profile={"age": 42, "sex": "female", "unsupported_private_note": "not included"},
        matched_rules=[],
    )
    profile_refs = [item for item in registry["evidence"] if item["type"] == "profile_field"]

    assert {item["field"] for item in profile_refs} == {"age", "sex"}
    assert all(item["claim_types"] == ["context_only"] for item in profile_refs)
    profile_reference = _ref(registry, "profile_field", claim="context_only")
    assert validate_evidence_reference(profile_reference, registry)["valid"]
    assert validate_evidence_reference(
        {**profile_reference, "claim": "confirmed_abnormality"},
        registry,
    )["reason"] == "profile_evidence_context_only"


def test_nested_profile_source_objects_are_never_serialized():
    registry = _registry(
        profile={
            "age": 42,
            "current_medications": [
                "medication-a",
                {
                    "name": "medication-b",
                    "patient_id": "patient-secret",
                    "metadata": {"internal_note": "private"},
                },
            ],
            "patient_id": "patient-secret",
            "internal_note": "private",
            "metadata": {"age": 999, "patient_id": "patient-secret"},
        },
        matched_rules=[],
    )
    encoded = json.dumps(registry)

    assert "patient-secret" not in encoded
    assert "internal_note" not in encoded
    assert "metadata" not in encoded
    profile_rows = [item for item in registry["evidence"] if item["type"] == "profile_field"]
    values_by_field = {item["field"]: item["value"] for item in profile_rows}
    assert values_by_field == {"age": 42, "current_medications": ["medication-a"]}


def test_cross_report_unknown_and_fabricated_references_are_rejected():
    registry = _registry()
    valid = _ref(registry, "biomarker_measurement", claim="measurement")

    assert validate_evidence_reference({**valid, "report_id": "report-b"}, registry)["reason"] == "cross_report_reference"
    assert validate_evidence_reference({**valid, "id": "ev1:fabricated"}, registry)["reason"] == "unknown_or_dangling_reference"
    assert validate_evidence_reference({**valid, "type": "action_id"}, registry)["reason"] == "unknown_or_dangling_reference"
    assert validate_evidence_reference({**valid, "extra": "forged"}, registry)["reason"] == "unexpected_reference_fields"


def test_personalized_actions_require_exact_kb_recommendation_evidence():
    registry = _registry()
    action = {
        "key": "iron_followup",
        "title": "Discuss iron follow-up",
        "body": "Review ferritin results with a clinician.",
        "grounding": {
            "designation": "personalized",
            "evidence_refs": [_ref(registry, "kb_rule_recommendation", claim="rule_recommendation")],
        },
    }
    result = validate_action_grounding(action, registry)
    assert result["outcome"] == "UNSUPPORTED"
    assert result["reasons"] == ["server_owned_recommendation_catalog_required"]
    action["grounding"]["evidence_refs"].append(
        {"type": "kb_rule_recommendation", "id": "fabricated", "report_id": "report-a"}
    )
    assert validate_action_grounding(action, registry)["outcome"] == "UNSUPPORTED"


def test_nested_actionable_instructions_rejected_even_with_canonical_title_body():
    registry = _registry()
    action = {
        "key": "iron_followup",
        "title": "Discuss iron follow-up",
        "body": "Review ferritin results with a clinician.",
        "metadata": {"instructions": "Take vitamin D3 5000 IU daily."},
        "grounding": {
            "designation": "personalized",
            "evidence_refs": [_ref(registry, "kb_rule_recommendation", claim="rule_recommendation")],
        },
    }

    assert validate_action_grounding(action, registry) == {
        "outcome": "UNSUPPORTED",
        "reasons": ["unapproved_action_fields"],
        "valid_reference_ids": [],
    }


def test_caller_supplied_catalog_content_cannot_authorize_personalized_action():
    registry = _registry()
    recommendation_evidence = next(
        item for item in registry["evidence"] if item["type"] == "kb_rule_recommendation"
    )
    recommendation_evidence["canonical_content"] = {
        "title": "Discuss vitamin D follow-up",
        "body": "Take vitamin D3 5000 IU daily.",
    }
    action = {
        "key": "iron_followup",
        "title": "Discuss vitamin D follow-up",
        "body": "Take vitamin D3 5000 IU daily.",
        "grounding": {
            "designation": "personalized",
            "evidence_refs": [_ref(registry, "kb_rule_recommendation", claim="rule_recommendation")],
        },
    }

    result = validate_action_grounding(action, registry)
    assert result["outcome"] == "UNSUPPORTED"
    assert result["reasons"] == ["server_owned_recommendation_catalog_required"]


def test_evidence_registry_does_not_accept_caller_catalog_as_authority():
    with pytest.raises(TypeError, match="canonical_recommendations"):
        build_protocol_evidence_registry(
            report_id="report-a",
            matched_rules=[_matched_rule()],
            canonical_recommendations=[
                {
                    "key": "iron_followup",
                    "title": "Caller-authored",
                    "body": "Caller-authored instructions.",
                }
            ],
        )


@pytest.mark.parametrize(
    "field, altered",
    [
        ("title", "Discuss vitamin D follow-up"),
        ("body", "Start vitamin D supplementation."),
        ("rationale", "Your iron results require treatment."),
        ("dosage", "5000 IU"),
    ],
)
def test_same_key_with_altered_or_unbound_action_content_is_unsupported(field, altered):
    registry = _registry()
    action = {
        "key": "iron_followup",
        "title": "Discuss iron follow-up",
        "body": "Review ferritin results with a clinician.",
        "grounding": {
            "designation": "personalized",
            "evidence_refs": [_ref(registry, "kb_rule_recommendation", claim="rule_recommendation")],
        },
    }
    action[field] = altered

    assert validate_action_grounding(action, registry)["outcome"] == "UNSUPPORTED"


def test_profile_or_measurement_alone_does_not_authorize_a_personalized_action():
    registry = _registry(profile={"age": 42})
    action = {
        "key": "iron_followup",
        "title": "Personalized supplement recommendation",
        "grounding": {
            "designation": "personalized",
            "evidence_refs": [_ref(registry, "profile_field", claim="context_only")],
        },
    }

    result = validate_action_grounding(action, registry)
    assert result["outcome"] == "UNSUPPORTED"
    assert result["reasons"] == ["evidence_does_not_authorize_personalized_recommendation"]

    action["grounding"]["evidence_refs"] = [
        _ref(registry, "biomarker_measurement", claim="confirmed_abnormality")
    ]
    assert validate_action_grounding(action, registry)["outcome"] == "UNSUPPORTED"


def test_unsupported_personalized_actions_are_never_downgraded_to_education():
    registry = _registry()
    action = {
        "title": "Your ferritin is low",
        "grounding": {
            "designation": "personalized",
            "evidence_refs": [],
            "personalized_claims": False,
        },
    }

    assert validate_action_grounding(action, registry)["outcome"] == "UNSUPPORTED"


def test_explicit_general_education_requires_nonpersonalized_content():
    registry = _registry()
    educational = {
        "title": "General education about iron",
        "body": "Iron is an essential nutrient found in a variety of foods.",
        "grounding": {"designation": "general_educational", "personalized_claims": False},
    }
    assert validate_action_grounding(educational, registry)["outcome"] == "GENERAL_EDUCATIONAL"

    educational["grounding"]["evidence_refs"] = [
        _ref(registry, "kb_rule_recommendation", claim="rule_recommendation")
    ]
    assert validate_action_grounding(educational, registry)["outcome"] == "UNSUPPORTED"
    educational["grounding"]["evidence_refs"] = []

    educational["body"] = "Your ferritin is low."
    assert validate_action_grounding(educational, registry)["outcome"] == "UNSUPPORTED"
    educational["body"] = "Ferritin is low."
    assert validate_action_grounding(educational, registry)["outcome"] == "UNSUPPORTED"
    educational["body"] = "Your low iron stores require treatment."
    assert validate_action_grounding(educational, registry)["outcome"] == "UNSUPPORTED"
    educational["body"] = "Discuss iron with your clinician."
    assert validate_action_grounding(educational, registry)["outcome"] == "UNSUPPORTED"
    educational["body"] = "Take iron to improve energy."
    assert validate_action_grounding(educational, registry)["outcome"] == "UNSUPPORTED"
    educational["body"] = "Iron is an essential nutrient."
    educational["grounding"]["personalized_claims"] = True
    assert validate_action_grounding(educational, registry)["outcome"] == "UNSUPPORTED"


def test_malformed_registry_and_nested_input_return_safe_results():
    action = {
        "key": "iron_followup",
        "grounding": {
            "designation": "personalized",
            "evidence_refs": [{"type": "kb_rule_recommendation", "id": "x", "report_id": "report-a"}],
        },
    }
    assert validate_action_grounding(action, None) == {
        "outcome": "UNSUPPORTED",
        "reasons": ["invalid_registry"],
        "valid_reference_ids": [],
    }
    assert validate_evidence_reference(
        {"type": "biomarker_measurement", "id": "x", "report_id": "report-a"},
        None,
    ) == {"valid": False, "reason": "invalid_registry"}

    malformed = _registry(
        biomarkers=[None, {"name": {"bad": object()}, "value": 1}],
        matched_rules=[None, {"recommendation_keys": "iron_followup"}],
        symptom_snapshot={
            "version": "symptom_snapshot_v1",
            "completed_at": "2026-10-15T10:00:00Z",
            "evidence": {
                "present": ["not-a-mapping", {"vitaloop_concept_id": "fatigue", "mapping_status": "mapped", "domain_keys": "not-a-list"}],
                "absent": "not-a-list",
                "unknown": None,
            },
        },
    )
    assert isinstance(malformed["evidence"], list)


def test_registry_rejects_missing_report_scope_and_non_json_data():
    with pytest.raises(ValueError, match="report_id is required"):
        build_protocol_evidence_registry(report_id="")
    assert not any(
        item["type"] == "biomarker_measurement"
        for item in _registry(biomarkers=[_biomarker(value=float("nan"))])["evidence"]
    )

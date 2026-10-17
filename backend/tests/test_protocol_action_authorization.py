import copy

import pytest

from app.services import supabase_service
from app.services.protocol_action_authorization import authorize_protocol_action
from app.services.protocol_evidence_snapshot import authorize_action_from_snapshot
from app.services.protocol_pipeline_evidence import FROZEN_EVIDENCE_KEY, build_pipeline_frozen_evidence

USER_ID = "user-1"
REPORT_VERSION_ID = "report-version-1"
AUTHENTICATED_PRINCIPAL = {"sub": USER_ID}


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
        "key": "iron_followup",
        "title": "Discuss iron follow-up",
        "body": "Review ferritin results with a clinician.",
        "source": "reviewed-guideline",
        "source_url": "https://example.test/guideline",
    }
    recommendation.update(overrides)
    return recommendation


def _report(status="completed", version="report_v1", **overrides):
    report = {
        "id": REPORT_VERSION_ID,
        "user_id": USER_ID,
        "upload_id": "upload-1",
        "status": status,
        "version": version,
        "input_snapshot": {
            "biomarkers": [
                {
                    "name": "Ferritin",
                    "canonical_name": "canonical_ferritin",
                    "value": 18,
                    "unit": "ng/mL",
                    "status": "DEFICIENT",
                }
            ],
            "symptom_snapshot": None,
        },
        "explainability": {
            "knowledge_evaluation": {
                "matched_rules": [_rule()],
                "generated_recommendations": [_recommendation()],
            }
        },
    }
    report.update(overrides)
    return with_frozen(report)


def with_frozen(report):
    """Attach the pipeline-built frozen payload for the report's current inputs/evaluation."""
    explainability = report.get("explainability")
    snapshot = report.get("input_snapshot")
    if not isinstance(explainability, dict) or not isinstance(snapshot, dict):
        return report
    built = build_pipeline_frozen_evidence(
        report_version_id=report["id"],
        normalized_biomarkers=snapshot.get("biomarkers"),
        symptom_snapshot=snapshot.get("symptom_snapshot"),
        knowledge_evaluation=explainability.get("knowledge_evaluation"),
    )
    report["explainability"].pop(FROZEN_EVIDENCE_KEY, None)
    if built["status"] == "BUILT":
        report["explainability"][FROZEN_EVIDENCE_KEY] = built["payload"]
    return report


def _action(**overrides):
    action = {
        "key": "iron_followup",
        "title": "Discuss iron follow-up",
        "body": "Review ferritin results with a clinician.",
    }
    action.update(overrides)
    return action


def _install_report(monkeypatch, report):
    async def get_report(user_id, report_version_id):
        assert user_id == USER_ID
        assert report_version_id == REPORT_VERSION_ID
        return copy.deepcopy(report)

    monkeypatch.setattr(supabase_service, "get_report_version_for_user", get_report)


@pytest.mark.asyncio
async def test_owner_scoped_frozen_evidence_authorizes_exact_action(monkeypatch):
    _install_report(monkeypatch, _report())
    result = await authorize_protocol_action(
        action=_action(),
        authenticated_principal=AUTHENTICATED_PRINCIPAL,
        report_version_id=REPORT_VERSION_ID,
    )

    assert result["outcome"] == "GROUNDED"
    assert result["authorized_action"]["grounding"]["designation"] == "personalized"
    assert result["authorized_action"]["body"] == _recommendation()["body"]
    import json

    json.dumps(result)
    assert "authorized_evidence" not in result


@pytest.mark.asyncio
async def test_forged_report_id_and_caller_context_are_not_accepted(monkeypatch):
    _install_report(monkeypatch, _report())
    for forged_input in (
        {"user_id": USER_ID},
        {"report_context": {"biomarkers": []}},
    ):
        forged_result = await authorize_protocol_action(
            action=_action(),
            authenticated_principal=AUTHENTICATED_PRINCIPAL,
            report_version_id=REPORT_VERSION_ID,
            **forged_input,
        )
        assert forged_result["outcome"] == "UNSUPPORTED"
        assert forged_result["reasons"] == ["unapproved_authorization_inputs"]
    result = await authorize_protocol_action(
        action=_action(),
        authenticated_principal=AUTHENTICATED_PRINCIPAL,
        report_version_id="forged-report-id",
    )
    assert result["outcome"] == "UNSUPPORTED"


@pytest.mark.asyncio
async def test_missing_verified_principal_fails_closed():
    result = await authorize_protocol_action(
        action=_action(),
        authenticated_principal={"user_id": USER_ID},
        report_version_id=REPORT_VERSION_ID,
    )
    assert result["outcome"] == "UNSUPPORTED"
    assert result["reasons"] == ["invalid_authenticated_principal"]


@pytest.mark.parametrize(
    "evidence_override, biomarker_override",
    [
        ({"value": 999}, {}),
        ({"unit": "µg/L"}, {}),
        ({}, {"status": "UNKNOWN"}),
    ],
)
@pytest.mark.asyncio
async def test_frozen_rule_evidence_must_match_same_input_context(
    monkeypatch, evidence_override, biomarker_override
):
    report = _report()
    report["explainability"]["knowledge_evaluation"]["matched_rules"][0]["evidence"][0].update(
        evidence_override
    )
    report["input_snapshot"]["biomarkers"][0].update(biomarker_override)
    # Contradictions present at evaluation time never produce frozen evidence.
    _install_report(monkeypatch, with_frozen(report))

    result = await authorize_protocol_action(
        action=_action(),
        authenticated_principal=AUTHENTICATED_PRINCIPAL,
        report_version_id=REPORT_VERSION_ID,
    )

    assert result["outcome"] == "UNSUPPORTED"


@pytest.mark.parametrize(
    "reported_row",
    [
        None,
        {**_report(), "id": "another-report"},
        {**_report(), "user_id": "another-user"},
    ],
)
@pytest.mark.asyncio
async def test_missing_wrong_owner_or_cross_report_rows_fail_closed(monkeypatch, reported_row):
    _install_report(monkeypatch, reported_row)
    result = await authorize_protocol_action(
        action=_action(),
        authenticated_principal=AUTHENTICATED_PRINCIPAL,
        report_version_id=REPORT_VERSION_ID,
    )
    assert result["outcome"] == "UNSUPPORTED"


@pytest.mark.asyncio
async def test_current_mutable_kb_is_not_reloaded_for_frozen_authorization(monkeypatch):
    _install_report(monkeypatch, _report())

    async def unexpected_loader(*_args, **_kwargs):
        raise AssertionError("historical authorization must not read mutable KB")

    monkeypatch.setattr(
        "app.services.knowledge.evaluator._load_active_rules",
        unexpected_loader,
    )
    monkeypatch.setattr(
        "app.services.knowledge.evaluator._load_recommendations",
        unexpected_loader,
    )
    result = await authorize_protocol_action(
        action=_action(),
        authenticated_principal=AUTHENTICATED_PRINCIPAL,
        report_version_id=REPORT_VERSION_ID,
    )
    assert result["outcome"] == "GROUNDED"


@pytest.mark.parametrize(
    "report",
    [
        _report(explainability={}),
        _report(explainability={"knowledge_evaluation": None}),
        _report(version="unknown_snapshot_version"),
        _report(status="blocked"),
    ],
)
@pytest.mark.asyncio
async def test_missing_provenance_legacy_or_wrong_snapshot_version_is_unsupported(
    monkeypatch, report
):
    _install_report(monkeypatch, report)
    result = await authorize_protocol_action(
        action=_action(),
        authenticated_principal=AUTHENTICATED_PRINCIPAL,
        report_version_id=REPORT_VERSION_ID,
    )
    assert result["outcome"] == "UNSUPPORTED"


@pytest.mark.asyncio
async def test_report_loader_failure_is_unsupported_without_exception_details(monkeypatch):
    async def fail_load(*_args, **_kwargs):
        raise RuntimeError("sensitive backend detail")

    monkeypatch.setattr(supabase_service, "get_report_version_for_user", fail_load)
    result = await authorize_protocol_action(
        action=_action(),
        authenticated_principal=AUTHENTICATED_PRINCIPAL,
        report_version_id=REPORT_VERSION_ID,
    )
    assert result == {
        "outcome": "UNSUPPORTED",
        "reasons": ["report_version_unavailable"],
        "valid_reference_ids": [],
    }
    assert "sensitive backend detail" not in str(result)


@pytest.mark.asyncio
async def test_snapshot_verifier_exception_fails_closed_without_patient_data(monkeypatch, caplog):
    _install_report(monkeypatch, _report())

    def fail_verification(*_args, **_kwargs):
        raise RuntimeError("verifier exploded")

    monkeypatch.setattr(
        "app.services.protocol_action_authorization._authorize_action_from_verified_snapshot",
        fail_verification,
    )
    result = await authorize_protocol_action(
        action=_action(),
        authenticated_principal=AUTHENTICATED_PRINCIPAL,
        report_version_id=REPORT_VERSION_ID,
    )

    assert result == {
        "outcome": "UNSUPPORTED",
        "reasons": ["frozen_evidence_verification_failed"],
        "valid_reference_ids": [],
    }
    assert "exception_type=RuntimeError" in caplog.text
    assert "verifier exploded" not in caplog.text
    assert REPORT_VERSION_ID not in caplog.text


@pytest.mark.asyncio
async def test_general_education_is_not_personalized_kb_authorization(monkeypatch):
    async def unexpected_load(*_args, **_kwargs):
        raise AssertionError("educational content must not load a report")

    monkeypatch.setattr(supabase_service, "get_report_version_for_user", unexpected_load)
    result = await authorize_protocol_action(
        action={
            "title": "General iron education",
            "body": "Iron is an essential nutrient.",
            "grounding": {
                "designation": "general_educational",
                "personalized_claims": False,
            },
        },
        authenticated_principal=AUTHENTICATED_PRINCIPAL,
        report_version_id=REPORT_VERSION_ID,
    )
    assert result["outcome"] == "GENERAL_EDUCATIONAL"


def test_standalone_hash_verification_cannot_authorize_personalized_action():
    from app.services.protocol_evidence_snapshot import build_protocol_evidence_snapshot

    # Even a self-consistent snapshot and recomputed hash is not an owner-scoped
    # report lookup and therefore cannot be used as final authorization.
    context = {
        "biomarkers": _report()["input_snapshot"]["biomarkers"],
        "symptom_snapshot": None,
    }
    snapshot = build_protocol_evidence_snapshot(
        report_version_id=REPORT_VERSION_ID,
        input_context=context,
        evaluated_rules=[_rule()],
        canonical_recommendations=[_recommendation()],
    )

    result = authorize_action_from_snapshot(
        _action(),
        snapshot,
        report_version_id=REPORT_VERSION_ID,
        input_context=context,
    )
    assert result["outcome"] == "UNSUPPORTED"


def _protocol_kwargs():
    return dict(
        biomarkers=[], prioritized=[], safety_result={}, health_states={}, trend_analysis={},
        retest_suggestions=[{"marker": "Ferritin"}, {"marker": "Ferritin (ng/mL)"}],
    )


@pytest.mark.asyncio
async def test_server_owned_orchestration_binds_evidence_to_exact_action(monkeypatch):
    from app.services.protocol_action_authorization import enrich_protocol_with_authorization

    _install_report(monkeypatch, _report())
    action = _action()
    protocol = {"nutrition": [dict(key=action["key"], title=action["title"], body=action["body"])]}
    out = await enrich_protocol_with_authorization(
        protocol=protocol, authenticated_principal=AUTHENTICATED_PRINCIPAL,
        report_version_id=REPORT_VERSION_ID, **_protocol_kwargs(),
    )
    item = out["nutrition"][0]
    assert [b["canonical_name"] for b in item["based_on"]["biomarkers"]] == ["canonical_ferritin"]
    assert item["based_on"]["health_domains"] == []

    tampered = {"nutrition": [dict(key=action["key"], title=action["title"], body="Take iron 65 mg daily.")]}
    out = await enrich_protocol_with_authorization(
        protocol=tampered, authenticated_principal=AUTHENTICATED_PRINCIPAL,
        report_version_id=REPORT_VERSION_ID, **_protocol_kwargs(),
    )
    assert out["nutrition"][0]["based_on"]["biomarkers"] == []


@pytest.mark.asyncio
async def test_orchestration_fails_closed_for_wrong_owner_and_ignores_forged_evidence(monkeypatch):
    from app.services.protocol_action_authorization import enrich_protocol_with_authorization

    _install_report(monkeypatch, _report())
    action = _action()
    protocol = {"nutrition": [dict(key=action["key"], title=action["title"], body=action["body"])]}
    out = await enrich_protocol_with_authorization(
        protocol=protocol, authenticated_principal={"sub": "someone-else"},
        report_version_id=REPORT_VERSION_ID, authorized_evidence={"x": {"verified": True}},
        **_protocol_kwargs(),
    )
    assert out["nutrition"][0]["based_on"]["biomarkers"] == []
    assert out["nutrition"][0]["retest_markers"] == []


def _count_fetches(monkeypatch, report, fail=False):
    calls = []

    async def get_report(user_id, report_version_id):
        calls.append((user_id, report_version_id))
        if fail:
            raise RuntimeError("db down")
        return copy.deepcopy(report) if user_id == USER_ID else None

    monkeypatch.setattr(supabase_service, "get_report_version_for_user", get_report)
    return calls


def _batch(n, bad_at=None):
    items = []
    for i in range(n):
        a = _action()
        if i == bad_at:
            a["body"] = "Take iron 65 mg daily."
        items.append(dict(key=a["key"], title=a["title"], body=a["body"]))
    return {"nutrition": items}


@pytest.mark.asyncio
@pytest.mark.parametrize("n", [1, 2, 20])
async def test_batch_authorization_loads_report_exactly_once(monkeypatch, n):
    from app.services.protocol_action_authorization import enrich_protocol_with_authorization

    calls = _count_fetches(monkeypatch, _report())
    out = await enrich_protocol_with_authorization(
        protocol=_batch(n), authenticated_principal=AUTHENTICATED_PRINCIPAL,
        report_version_id=REPORT_VERSION_ID, **_protocol_kwargs(),
    )
    assert len(calls) == 1
    assert all(i["based_on"]["biomarkers"] for i in out["nutrition"])


@pytest.mark.asyncio
async def test_batch_invalid_action_isolated_and_still_one_fetch(monkeypatch):
    from app.services.protocol_action_authorization import enrich_protocol_with_authorization

    calls = _count_fetches(monkeypatch, _report())
    out = (await enrich_protocol_with_authorization(
        protocol=_batch(3, bad_at=1), authenticated_principal=AUTHENTICATED_PRINCIPAL,
        report_version_id=REPORT_VERSION_ID, **_protocol_kwargs(),
    ))["nutrition"]
    assert len(calls) == 1
    assert [bool(i["based_on"]["biomarkers"]) for i in out] == [True, False, True]


@pytest.mark.asyncio
async def test_batch_wrong_owner_loader_failure_and_forged_inputs_fail_closed(monkeypatch):
    from app.services.protocol_action_authorization import enrich_protocol_with_authorization

    for principal, fail in (({"sub": "other"}, False), (AUTHENTICATED_PRINCIPAL, True)):
        calls = _count_fetches(monkeypatch, _report(), fail=fail)
        out = await enrich_protocol_with_authorization(
            protocol=_batch(2), authenticated_principal=principal, report_version_id=REPORT_VERSION_ID,
            **_protocol_kwargs(),
        )
        assert len(calls) == 1
        assert all(i["based_on"]["biomarkers"] == [] and i["retest_markers"] == [] for i in out["nutrition"])


@pytest.mark.asyncio
async def test_public_single_authorization_still_json_serializable(monkeypatch):
    import json

    _count_fetches(monkeypatch, _report())
    result = await authorize_protocol_action(
        action=_action(), authenticated_principal=AUTHENTICATED_PRINCIPAL, report_version_id=REPORT_VERSION_ID
    )
    assert result["outcome"] == "GROUNDED"
    json.dumps(result)


@pytest.mark.asyncio
async def test_nested_instruction_metadata_bypass_gets_no_evidence(monkeypatch):
    from app.services.protocol_action_authorization import enrich_protocol_with_authorization

    calls = _count_fetches(monkeypatch, _report())
    a = _action()
    protocol = {"nutrition": [
        dict(a),
        {**a, "metadata": {"instructions": "Take iron 65 mg daily"}},
        {**a, "dosage": "65 mg"},
        dict(a),
    ]}
    out = (await enrich_protocol_with_authorization(
        protocol=protocol, authenticated_principal=AUTHENTICATED_PRINCIPAL,
        report_version_id=REPORT_VERSION_ID, **_protocol_kwargs(),
    ))["nutrition"]
    assert len(calls) == 1
    assert [bool(i["based_on"]["biomarkers"]) for i in out] == [True, False, False, True]
    assert out[1]["retest_markers"] == [] and out[2]["retest_markers"] == []


@pytest.mark.asyncio
async def test_identical_actions_each_authorized_independently_with_one_fetch(monkeypatch):
    import app.services.protocol_action_authorization as mod

    calls = _count_fetches(monkeypatch, _report())
    count = []
    original = mod._authorize_with_context

    def counting(action, ctx, sink):
        count.append(1)
        return original(action, ctx, sink)

    monkeypatch.setattr(mod, "_authorize_with_context", counting)
    out = (await mod.enrich_protocol_with_authorization(
        protocol=_batch(20), authenticated_principal=AUTHENTICATED_PRINCIPAL,
        report_version_id=REPORT_VERSION_ID, **_protocol_kwargs(),
    ))["nutrition"]
    assert len(calls) == 1 and len(count) == 20
    assert all(i["based_on"]["biomarkers"] for i in out)


@pytest.mark.asyncio
async def test_duplicate_key_different_body_does_not_reuse_evidence(monkeypatch):
    from app.services.protocol_action_authorization import enrich_protocol_with_authorization

    _count_fetches(monkeypatch, _report())
    a = _action()
    protocol = {"nutrition": [
        dict(a), {**a, "body": "Take iron 65 mg daily."}, dict(a),
    ]}
    out = (await enrich_protocol_with_authorization(
        protocol=protocol, authenticated_principal=AUTHENTICATED_PRINCIPAL,
        report_version_id=REPORT_VERSION_ID, **_protocol_kwargs(),
    ))["nutrition"]
    assert [bool(i["based_on"]["biomarkers"]) for i in out] == [True, False, True]


@pytest.mark.asyncio
async def test_trust_flags_rejected_safely_without_exception_or_evidence(monkeypatch):
    from app.services.protocol_action_authorization import enrich_protocol_with_authorization

    calls = _count_fetches(monkeypatch, _report())
    out = (await enrich_protocol_with_authorization(
        protocol=_batch(2), authenticated_principal=AUTHENTICATED_PRINCIPAL,
        report_version_id=REPORT_VERSION_ID, trust_flags={"verified": True}, **_protocol_kwargs(),
    ))["nutrition"]
    assert calls == []
    assert all(i["based_on"]["biomarkers"] == [] and i["retest_markers"] == [] for i in out)


@pytest.mark.asyncio
async def test_forged_context_and_binding_kwargs_never_authorize(monkeypatch):
    from app.services.protocol_action_authorization import enrich_protocol_with_authorization

    calls = _count_fetches(monkeypatch, _report())
    out = (await enrich_protocol_with_authorization(
        protocol=_batch(2), authenticated_principal=AUTHENTICATED_PRINCIPAL,
        report_version_id=REPORT_VERSION_ID, authorized_evidence={"x": {"verified": True}},
        report_context={"forged": 1}, trusted_evidence={("nutrition", 0): object()}, **_protocol_kwargs(),
    ))["nutrition"]
    assert calls == []
    assert all(i["based_on"]["biomarkers"] == [] for i in out)


@pytest.mark.asyncio
async def test_batch_attributes_real_items_with_presentation_fields_but_not_hidden_content(monkeypatch):
    from app.services.protocol_action_authorization import enrich_protocol_with_authorization

    _count_fetches(monkeypatch, _report())
    a = {**_action(), "category": "nutrition", "priority": "medium", "requires_doctor": True}
    protocol = {"nutrition": [dict(a), {**a, "supplement": "Iron"}]}
    out = (await enrich_protocol_with_authorization(
        protocol=protocol, authenticated_principal=AUTHENTICATED_PRINCIPAL,
        report_version_id=REPORT_VERSION_ID, **_protocol_kwargs(),
    ))["nutrition"]
    assert [bool(i["based_on"]["biomarkers"]) for i in out] == [True, False]

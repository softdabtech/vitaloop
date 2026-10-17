import copy
import json

import pytest

from app.services import supabase_service as svc
from app.services import lab_analysis_pipeline as pipeline
from app.services.protocol_action_authorization import _load_trusted_context
from app.services.protocol_pipeline_evidence import FROZEN_EVIDENCE_KEY, build_pipeline_frozen_evidence

RV = "report-version-1"
USER = "user-1"
BIOMARKERS = [
    {"name": "Ferritin", "canonical_name": "canonical_ferritin", "value": 18, "unit": "ng/mL", "status": "DEFICIENT"}
]


def _rule(**kw):
    rule = {
        "rule_id": "rule-1", "rule_key": "low_ferritin", "version": "v3",
        "recommendation_keys": ["iron_followup"], "source": "g", "source_url": "https://example.org/g",
        "medical_reviewed_at": "2026-09-01T00:00:00Z",
        "evidence": [{"type": "lab_marker", "key": "ferritin", "value": 18, "unit": "ng/mL", "matched": True}],
    }
    return {**rule, **kw}


def _rec(**kw):
    rec = {"key": "iron_followup", "title": "Discuss iron follow-up", "body": "Review ferritin with a clinician.",
           "source": "g", "source_url": "https://example.org/g"}
    return {**rec, **kw}


def _evaluation(**kw):
    ev = {"matched_rules": [_rule()], "generated_recommendations": [_rec()]}
    return {**ev, **kw}


def _build(biomarkers=None, evaluation=None, symptom=None, rv=RV):
    return build_pipeline_frozen_evidence(
        report_version_id=rv,
        normalized_biomarkers=copy.deepcopy(BIOMARKERS if biomarkers is None else biomarkers),
        symptom_snapshot=symptom,
        knowledge_evaluation=_evaluation() if evaluation is None else evaluation,
    )


def test_valid_rule_and_canonical_recommendation_are_frozen():
    result = _build()
    assert result["status"] == "BUILT"
    snap = result["snapshot"]
    assert snap["report_version_id"] == RV
    entry = snap["entries"][0]
    assert entry["rule"]["id"] == "rule-1" and entry["rule"]["version"] == "v3"
    assert entry["recommendation"]["title"] == "Discuss iron follow-up"
    json.dumps(snap)


@pytest.mark.parametrize("rv", [None, "", "  ", 5])
def test_missing_report_version_id_fails_closed(rv):
    assert _build(rv=rv)["status"] == "UNAVAILABLE"


@pytest.mark.parametrize(
    "evaluation",
    [
        None,
        {},
        {"matched_rules": "x", "generated_recommendations": []},
        {"matched_rules": [_rule()], "generated_recommendations": None},
        {"matched_rules": [_rule()], "generated_recommendations": []},  # missing catalog entry
        {"matched_rules": [_rule()], "generated_recommendations": [_rec(), _rec()]},  # duplicate catalog entry
        {"matched_rules": [_rule(version=None)], "generated_recommendations": [_rec()]},
        {"matched_rules": [_rule(), _rule()], "generated_recommendations": [_rec()]},
        {"matched_rules": [_rule()], "generated_recommendations": [_rec(body="")]},
        {"matched_rules": [_rule(evidence=None)], "generated_recommendations": [_rec()]},
        {"matched_rules": [_rule(evidence=[{"value": float("nan")}])], "generated_recommendations": [_rec()]},
        {"matched_rules": [object()], "generated_recommendations": [_rec()]},
    ],
)
def test_malformed_or_incomplete_evaluation_output_fails_closed(evaluation):
    result = _build(evaluation=evaluation if evaluation is not None else None)
    if evaluation is None:
        result = build_pipeline_frozen_evidence(
            report_version_id=RV, normalized_biomarkers=BIOMARKERS, symptom_snapshot=None, knowledge_evaluation=None
        )
    assert result["status"] == "UNAVAILABLE" and result["snapshot"] is None


def test_unrelated_nutrition_recommendations_are_not_frozen_but_do_not_break_build():
    ev = _evaluation(generated_recommendations=[_rec(), {"key": "nutrition_x", "title": "t", "body": "b"}])
    snap = _build(evaluation=ev)["snapshot"]
    assert [e["recommendation"]["key"] for e in snap["entries"]] == ["iron_followup"]


@pytest.mark.parametrize(
    "biomarkers",
    [
        [{**BIOMARKERS[0], "value": 999}],  # context contradicts rule evidence value 18
        [{**BIOMARKERS[0], "unit": "ug/L"}],
        [{**BIOMARKERS[0], "status": "UNKNOWN"}],
        [],
    ],
)
def test_contradictory_or_ineligible_context_never_yields_authorizing_evidence(biomarkers):
    result = _build(biomarkers=biomarkers)
    if result["status"] == "BUILT":
        # Built evidence must not carry a matched ferritin measurement from the contradicting context.
        for entry in result["snapshot"]["entries"]:
            assert all(
                ref.get("type") != "biomarker_measurement" or ref.get("value") == 18
                for ref in entry["evidence_refs"]
            )
    else:
        assert result["snapshot"] is None


def test_frozen_data_is_independent_of_later_mutation_of_evaluation_and_catalog():
    ev = _evaluation()
    first = _build(evaluation=ev)["snapshot"]
    ev["generated_recommendations"][0]["title"] = "Changed later (mutable catalog)"
    ev["matched_rules"][0]["version"] = "v9"
    assert _build(evaluation=_evaluation())["snapshot"] == first
    assert first["entries"][0]["recommendation"]["title"] == "Discuss iron follow-up"


def test_binding_is_to_exact_report_version():
    a = _build(rv="rv-a")["snapshot"]
    b = _build(rv="rv-b")["snapshot"]
    assert a["report_version_id"] == "rv-a" and b["report_version_id"] == "rv-b"
    assert a["integrity_hash"] != b["integrity_hash"]


def _persisted(ev=None, biomarkers=None, **overrides):
    built = _build(evaluation=ev)
    row = {
        "id": RV, "user_id": USER, "upload_id": "u", "status": "completed", "version": "report_v1",
        "input_snapshot": {"biomarkers": copy.deepcopy(BIOMARKERS if biomarkers is None else biomarkers),
                           "symptom_snapshot": None},
        "explainability": {"knowledge_evaluation": copy.deepcopy(ev or _evaluation()),
                           FROZEN_EVIDENCE_KEY: built["payload"]},
    }
    row.update(overrides)
    return built, json.loads(json.dumps(row))


def _install(monkeypatch, row):
    async def fake_get(user_id, report_version_id):
        return copy.deepcopy(row) if user_id == USER and report_version_id == RV else None

    monkeypatch.setattr(svc, "get_report_version_for_user", fake_get)


def test_keyless_interpretive_rule_is_excluded_without_invalidating_valid_rule():
    keyless = _rule(rule_id="rule-2", rule_key="interpretive_only", recommendation_keys=[])
    result = _build(evaluation=_evaluation(matched_rules=[_rule(), keyless]))
    assert result["status"] == "BUILT"
    assert [e["rule"]["id"] for e in result["snapshot"]["entries"]] == ["rule-1"]
    assert result["snapshot"] == _build()["snapshot"]


def test_only_keyless_rules_yield_no_actionable_evidence():
    result = _build(evaluation=_evaluation(matched_rules=[_rule(recommendation_keys=[])], generated_recommendations=[]))
    assert result["status"] == "NON_AUTHORIZING" and result["reason"] == "no_action_authorizing_rules"
    assert result["snapshot"] is None and result["payload"]["schema"] == "protocol_frozen_evidence_nonauthorizing_v1"


@pytest.mark.parametrize("bad", [
    _rule(version=None), _rule(recommendation_keys="iron_followup"), _rule(recommendation_keys=None),
    _rule(recommendation_keys=["iron_followup", "iron_followup"]), _rule(recommendation_keys=["missing_key"]),
    _rule(evidence=None),
])
def test_malformed_recommendation_bearing_rule_fails_whole_build_even_beside_valid_rule(bad):
    ev = _evaluation(matched_rules=[_rule(rule_id="rule-9", rule_key="other", recommendation_keys=[]), bad])
    assert _build(evaluation=ev)["status"] == "UNAVAILABLE"


def test_presentation_transforms_do_not_change_frozen_payload_or_hash():
    ev = _evaluation()
    first = _build(evaluation=ev)
    from app.services.lab_analysis_pipeline import _strip_placeholder_source_urls
    stripped = _strip_placeholder_source_urls(copy.deepcopy(ev))
    stripped["generated_recommendations"][0]["title"] = "Localized title"
    again = _build(evaluation=ev)
    assert again["payload"] == first["payload"]
    assert again["snapshot"]["integrity_hash"] == first["snapshot"]["integrity_hash"]
    assert ev["generated_recommendations"][0]["title"] == "Discuss iron follow-up"


@pytest.mark.asyncio
async def test_build_time_payload_equals_persisted_payload_and_authorizes(monkeypatch):
    built, row = _persisted()
    assert row["explainability"][FROZEN_EVIDENCE_KEY] == json.loads(json.dumps(built["payload"]))
    _install(monkeypatch, row)
    ctx = await _load_trusted_context(USER, RV)
    assert ctx.snapshot == built["snapshot"] and ctx.input_context == built["input_context"]


@pytest.mark.asyncio
async def test_authority_is_stored_payload_not_mutable_knowledge_evaluation(monkeypatch):
    built, row = _persisted()
    row["explainability"]["knowledge_evaluation"]["generated_recommendations"][0]["body"] = "Changed later"
    row["explainability"]["knowledge_evaluation"]["matched_rules"][0]["version"] = "v9"
    _install(monkeypatch, row)
    ctx = await _load_trusted_context(USER, RV)
    assert ctx.snapshot == built["snapshot"]


@pytest.mark.asyncio
async def test_legacy_report_without_frozen_payload_is_unsupported_not_reconstructed(monkeypatch):
    _, row = _persisted()
    del row["explainability"][FROZEN_EVIDENCE_KEY]  # evaluation still present and valid
    _install(monkeypatch, row)
    out = await _load_trusted_context(USER, RV)
    assert out["outcome"] == "UNSUPPORTED" and out["reasons"] == ["frozen_protocol_evidence_unavailable"]


@pytest.mark.asyncio
@pytest.mark.parametrize("mutate", [
    lambda r: r.update(user_id="other"),
    lambda r: r.update(id="other-report"),
    lambda r: r.update(version="report_v0"),
    lambda r: r.update(status="blocked"),
    lambda r: r["explainability"][FROZEN_EVIDENCE_KEY].update(report_version_id="other"),
    lambda r: r["explainability"][FROZEN_EVIDENCE_KEY].update(schema="v0"),
    lambda r: r["explainability"][FROZEN_EVIDENCE_KEY].update(extra=1),
    lambda r: r["explainability"].update({FROZEN_EVIDENCE_KEY: "garbage"}),
    lambda r: r["explainability"][FROZEN_EVIDENCE_KEY]["snapshot"]["entries"][0]["recommendation"].update(body="x"),
    lambda r: r["explainability"][FROZEN_EVIDENCE_KEY]["snapshot"].update(integrity_hash="0" * 64),
    lambda r: r["input_snapshot"]["biomarkers"][0].update(value=999),
    lambda r: r["input_snapshot"].update(biomarkers=[]),
    lambda r: r["input_snapshot"].pop("biomarkers"),
])
async def test_tampered_or_mismatched_persisted_report_is_unsupported(monkeypatch, mutate):
    _, row = _persisted()
    mutate(row)
    _install(monkeypatch, row)
    out = await _load_trusted_context(USER, RV)
    assert isinstance(out, dict) and out["outcome"] == "UNSUPPORTED"


@pytest.mark.asyncio
async def test_wrong_requesting_owner_or_report_is_unsupported(monkeypatch):
    _, row = _persisted()
    _install(monkeypatch, row)
    assert (await _load_trusted_context("intruder", RV))["outcome"] == "UNSUPPORTED"
    assert (await _load_trusted_context(USER, "other-report"))["outcome"] == "UNSUPPORTED"


def test_frozen_payload_is_not_served_in_public_frozen_report_output():
    from app.services.report_history import _public_explainability
    _, row = _persisted()
    public = _public_explainability(row["explainability"])
    assert FROZEN_EVIDENCE_KEY not in public and "knowledge_evaluation" in public
    assert FROZEN_EVIDENCE_KEY in row["explainability"]  # source not mutated


@pytest.mark.asyncio
async def test_pipeline_builds_evidence_once_from_single_evaluation_without_changing_output(monkeypatch):
    calls = {"kb": 0}
    captured = []
    real_build = pipeline.build_pipeline_frozen_evidence

    async def fake_eval(**kwargs):
        calls["kb"] += 1
        return {"matched_rules": [_rule()], "generated_recommendations": [_rec()], "requires_doctor": False}

    def spy(**kwargs):
        out = real_build(**kwargs)
        captured.append((kwargs["report_version_id"], out))
        return out

    saved = []

    async def fake_save_rv(**kwargs):
        saved.append(kwargs)
        return {"id": kwargs["report_version_id"], "status": "completed", "version": "report_v1"}

    async def noop(*a, **k):
        return None

    async def empty(*a, **k):
        return []

    monkeypatch.setattr(pipeline, "evaluate_biomarkers_with_knowledge", fake_eval)
    monkeypatch.setattr(pipeline, "build_pipeline_frozen_evidence", spy)
    monkeypatch.setattr(pipeline, "_load_historical_biomarkers", empty)
    monkeypatch.setattr(svc, "save_report_version", fake_save_rv)
    monkeypatch.setattr(svc, "save_safety_events", noop)
    monkeypatch.setattr(svc, "save_analysis_intelligence_artifacts", noop)
    monkeypatch.setattr(svc, "get_intervention_events", empty)

    result = await pipeline.run_lab_analysis_pipeline(
        biomarkers=[{"name": "Ferritin", "value": 18.0, "unit": "ng/mL", "ref_low": 30, "ref_high": 300, "status": "DEFICIENT"}],
        symptoms=["fatigue"], questionnaire={"completed": True},
        user_profile={"age": 34, "sex": "female", "height_cm": 168, "weight_kg": 62, "current_medications": ["none"]},
        user_id=USER, analysis_id="upload-1", source_metadata={"source": "b2c_manual", "candidates": []},
        persist_biomarkers=False, persist_report_version=True, generate_ai_protocol=False,
    )
    assert calls["kb"] == 1 and len(captured) == 1
    rv_id, evidence = captured[0]
    assert rv_id == saved[0]["report_version_id"]  # reuses the id drawn at pipeline start
    assert evidence["status"] == "BUILT"
    # The persisted sectioned protocol and its flat projection come from the
    # same canonical-adapter decision, never from a later fallback/AI rewrite.
    assert result["recommendations"]
    assert {item["title"] for item in result["recommendations"]} == {"Discuss iron follow-up"}
    assert saved[0]["protocol"] == result["protocol"]
    assert saved[0]["input_snapshot"]["protocol_projection"] == result["recommendations"]
    # Persisted as its own object, equal to the build-time payload, and not in the public result.
    stored = saved[0]["explainability"]
    assert stored[FROZEN_EVIDENCE_KEY] == evidence["payload"]
    assert "frozen_protocol_evidence" not in result
    assert "integrity_hash" not in json.dumps(result, default=str)
    # Authoritative read of what the pipeline actually persisted (JSON round trip), with
    # presentation transforms already applied to knowledge_evaluation.
    row = json.loads(json.dumps({
        "id": rv_id, "user_id": USER, "status": "completed", "version": "report_v1",
        "input_snapshot": saved[0]["input_snapshot"], "explainability": stored,
    }, default=str))

    async def fake_get(user_id, report_version_id):
        return copy.deepcopy(row)

    monkeypatch.setattr(svc, "get_report_version_for_user", fake_get)
    ctx = await _load_trusted_context(USER, rv_id)
    assert not isinstance(ctx, dict), ctx
    assert ctx.snapshot == evidence["snapshot"]


async def _run_with_save(monkeypatch, save_impl):
    async def fake_eval(**kwargs):
        return {"matched_rules": [_rule()], "generated_recommendations": [_rec()], "requires_doctor": False}

    async def noop(*a, **k):
        return None

    async def empty(*a, **k):
        return []

    monkeypatch.setattr(pipeline, "evaluate_biomarkers_with_knowledge", fake_eval)
    monkeypatch.setattr(pipeline, "_load_historical_biomarkers", empty)
    monkeypatch.setattr(svc, "save_report_version", save_impl)
    monkeypatch.setattr(svc, "save_safety_events", noop)
    monkeypatch.setattr(svc, "save_analysis_intelligence_artifacts", noop)
    monkeypatch.setattr(svc, "get_intervention_events", empty)
    return await pipeline.run_lab_analysis_pipeline(
        biomarkers=[{"name": "Ferritin", "value": 18.0, "unit": "ng/mL", "ref_low": 30, "ref_high": 300, "status": "DEFICIENT"}],
        symptoms=["fatigue"], questionnaire={"completed": True},
        user_profile={"age": 34, "sex": "female", "height_cm": 168, "weight_kg": 62, "current_medications": ["none"]},
        user_id=USER, analysis_id="upload-1", source_metadata={"source": "b2c_manual", "candidates": []},
        persist_biomarkers=False, persist_report_version=True, generate_ai_protocol=False,
    )


@pytest.mark.asyncio
async def test_report_save_exception_fails_closed_without_personalized_output(monkeypatch):
    async def boom(**kwargs):
        raise RuntimeError("db down")

    result = await _run_with_save(monkeypatch, boom)
    assert result["analysis_status"] == "failed" and result["error"] == "report_persistence_failed"
    assert result["report_version"] is None
    assert result["recommendations"] == [] and result["protocol"] == {}


@pytest.mark.asyncio
@pytest.mark.parametrize("returned", [{}, None, {"id": ""}])
async def test_report_save_without_persisted_version_fails_closed(monkeypatch, returned):
    async def empty_save(**kwargs):
        return returned

    result = await _run_with_save(monkeypatch, empty_save)
    assert result["analysis_status"] == "failed"
    assert result["recommendations"] == [] and result["protocol"] == {}


@pytest.mark.asyncio
async def test_report_save_success_keeps_existing_workflow_and_retry_uses_fresh_version(monkeypatch):
    ids = []

    async def ok(**kwargs):
        ids.append(kwargs["report_version_id"])
        return {"id": kwargs["report_version_id"], "status": "completed", "version": "report_v1"}

    first = await _run_with_save(monkeypatch, ok)
    second = await _run_with_save(monkeypatch, ok)
    assert first["analysis_status"] == "completed" and "error" not in first
    assert first["report_version"] and second["report_version"]
    assert len(set(ids)) == 2  # nothing from an earlier snapshot/id is reused


@pytest.mark.asyncio
async def test_flat_protocol_not_saved_when_report_not_persisted(monkeypatch):
    from app.routers.analysis import analyze

    async def boom(**kwargs):
        raise RuntimeError("db down")

    result = await _run_with_save(monkeypatch, boom)
    # Every caller gates save_protocol on analysis_status == "completed".
    assert not (result["protocol"] and result["analysis_status"] == "completed")
    import inspect
    src = inspect.getsource(analyze)
    assert src.count('analysis_status == "completed"') >= 5


def test_frozen_evidence_has_no_client_write_path():
    import pathlib
    root = pathlib.Path(pipeline.__file__).resolve().parents[1]
    hits = set()
    for p in root.rglob("*.py"):
        if "tests" in p.parts:
            continue
        text = p.read_text()
        if "frozen_protocol_evidence" in text or "FROZEN_EVIDENCE_KEY" in text:
            hits.add(str(p.relative_to(root)))
    assert hits == {
        "services/lab_analysis_pipeline.py",
        "services/protocol_pipeline_evidence.py", "services/report_history.py",
    }


@pytest.mark.asyncio
@pytest.mark.parametrize("returned", [{"id": "someone-else"}, {"id": 123}, {"id": None}, {}, None])
async def test_wrong_or_malformed_returned_id_fails_closed(monkeypatch, returned):
    async def bad(**kwargs):
        return returned

    result = await _run_with_save(monkeypatch, bad)
    assert result["analysis_status"] == "failed"
    assert result["error_code"] == "report_persistence_failed"
    assert result["report_version"] is None
    assert result["recommendations"] == [] and result["protocol"] == {}


@pytest.mark.asyncio
async def test_insert_exception_is_unconfirmed_outcome_without_flat_output(monkeypatch):
    async def boom(**kwargs):
        raise TimeoutError("ambiguous")

    result = await _run_with_save(monkeypatch, boom)
    assert result["analysis_status"] == "failed"
    assert result["error_code"] == "report_persistence_unconfirmed"
    assert result["recommendations"] == []


@pytest.mark.asyncio
async def test_post_insert_failure_keeps_confirmed_identity_without_false_success(monkeypatch):
    calls = []

    async def ok(**kwargs):
        calls.append(kwargs["report_version_id"])
        return {"id": kwargs["report_version_id"], "status": "completed", "version": "report_v1"}

    async def boom(**kwargs):
        raise RuntimeError("retest table down")

    monkeypatch.setattr(svc, "persist_retest_obligations", boom)
    result = await _run_with_save(monkeypatch, ok)
    assert len(calls) == 1  # no automatic duplicate insert
    assert result["report_version"]["id"] == calls[0]
    assert result["post_persistence_status"] == "partial"
    assert result["error_code"] == "report_post_persistence_failed"
    assert result["analysis_status"] == "partial"  # never reported as full completion


def test_read_paths_never_persist_flat_protocol():
    import inspect
    from app.routers.analysis import analyze
    from app.routers.protocol import compatibility

    assert "results_read_v2" not in inspect.getsource(analyze.get_results)
    assert "save_protocol(" not in inspect.getsource(compatibility.get_results_by_upload)


@pytest.mark.asyncio
async def test_ambiguous_insert_that_committed_is_resolved_by_id_without_reinsert(monkeypatch):
    inserts = []

    async def commit_then_fail(**kwargs):
        inserts.append(kwargs["report_version_id"])
        raise TimeoutError("response lost")

    async def lookup(user_id, report_version_id):
        return {"id": report_version_id, "status": "completed", "version": "report_v1"}

    monkeypatch.setattr(svc, "get_report_version_for_user", lookup)
    result = await _run_with_save(monkeypatch, commit_then_fail)
    assert len(inserts) == 1  # never inserted a second time
    assert result["report_version"]["id"] == inserts[0]
    assert result["analysis_status"] == "completed"


@pytest.mark.asyncio
@pytest.mark.parametrize("lookup_result", ["none", "other_id", "raises"])
async def test_ambiguous_insert_unresolved_fails_closed(monkeypatch, lookup_result):
    async def fail(**kwargs):
        raise TimeoutError("lost")

    async def lookup(user_id, report_version_id):
        if lookup_result == "raises":
            raise RuntimeError("down")
        return None if lookup_result == "none" else {"id": "other"}

    monkeypatch.setattr(svc, "get_report_version_for_user", lookup)
    result = await _run_with_save(monkeypatch, fail)
    assert result["analysis_status"] == "failed"
    assert result["error_code"] == "report_persistence_unconfirmed"
    assert result["recommendations"] == [] and result["protocol"] == {}


@pytest.mark.asyncio
async def test_upload_marked_done_only_after_confirmed_report(monkeypatch):
    marks = []
    calls = []

    async def mark(upload_id, user_id):
        marks.append(upload_id)

    async def boom(**kwargs):
        raise RuntimeError("db down")

    monkeypatch.setattr(svc, "mark_lab_upload_done", mark)
    monkeypatch.setattr(svc, "get_report_version_for_user", lambda *a: _none())

    async def fail_atomic(**kwargs):
        calls.append(kwargs)
        raise svc.AtomicFinalizationError("finalization_storage_error")

    monkeypatch.setattr(svc, "finalize_lab_analysis", fail_atomic)
    failed = await _run_persist(monkeypatch, boom)
    assert failed["analysis_status"] == "failed"
    assert failed["recommendations"] == [] and failed["protocol"] == {}
    assert marks == []  # atomic failure cannot mark the upload done

    async def ok(**kwargs):
        return {"id": kwargs["report_version_id"], "status": "completed", "version": "report_v1"}

    async def complete_atomic(**kwargs):
        calls.append(kwargs)
        return {
            "report_version_id": kwargs["report_version_id"],
            "replay": False,
            "generation": 1,
            "biomarkers": [dict(b) for b in kwargs["biomarkers"]],
            "input_hash": "x" * 64,
        }

    monkeypatch.setattr(svc, "finalize_lab_analysis", complete_atomic)
    completed = await _run_persist(monkeypatch, ok)
    assert completed["analysis_status"] == "completed"
    assert completed["saved_biomarkers"]
    assert marks == []  # completion is part of finalize_lab_analysis, never a follow-up write
    assert len(calls) == 2

    downstream = []

    async def should_not_run(*_args, **_kwargs):
        downstream.append("called")
        return []

    for name in ("persist_retest_obligations", "reconcile_retest_fulfillment",
                 "reconcile_lab_plan_fulfillment", "save_safety_events",
                 "save_analysis_intelligence_artifacts"):
        monkeypatch.setattr(svc, name, should_not_run)

    async def replay_atomic(**kwargs):
        return {
            "report_version_id": "prior-report-version", "replay": True, "generation": 1,
            "biomarkers": [dict(b) for b in kwargs["biomarkers"]], "input_hash": "x" * 64,
        }

    async def authoritative_replay(**kwargs):
        return {
            "report_version": {
                "id": "prior-report-version", "user_id": USER, "upload_id": "upload-1",
                "status": "completed", "version": "stored-v1",
                "knowledge_report": {"stored": True}, "protocol": {"stored_protocol": True},
                "safety_result": {"stored_safety": True}, "explainability": {"stored": True},
            },
            "biomarkers": [{
                "name": "Stored Ferritin", "value": 19.0, "unit": "ng/mL", "ref_low": 30,
                "ref_high": 300, "status": "DEFICIENT", "category": None,
                "canonical_name": "ferritin", "reference_source": None, "unevaluated_reason": None,
            }],
            "followup_work": [],
            "downstream_status": "pending",
        }

    monkeypatch.setattr(svc, "finalize_lab_analysis", replay_atomic)
    monkeypatch.setattr(svc, "load_authoritative_finalization_replay", authoritative_replay)
    replayed = await _run_persist(monkeypatch, ok)
    assert replayed["analysis_status"] == "completed"
    assert replayed["report_version"]["id"] == "prior-report-version"
    assert replayed["protocol"] == {"stored_protocol": True}
    assert replayed["saved_biomarkers"][0]["name"] == "Stored Ferritin"
    assert replayed["finalization_replay"] is True and replayed["downstream_status"] == "pending"
    assert replayed["recommendations"] == []  # never this attempt's output
    assert replayed["quality_snapshot"] == {} and replayed["metadata"]["replay"] is True
    assert downstream == []


@pytest.mark.asyncio
async def test_replay_fails_closed_when_authoritative_report_is_unavailable(monkeypatch):
    async def replay_atomic(**kwargs):
        return {
            "report_version_id": "prior-report-version", "replay": True, "generation": 1,
            "biomarkers": [dict(b) for b in kwargs["biomarkers"]], "input_hash": "x" * 64,
        }

    async def unavailable(**kwargs):
        raise svc.AtomicFinalizationError("replay_report_inconsistent")

    monkeypatch.setattr(svc, "finalize_lab_analysis", replay_atomic)
    monkeypatch.setattr(svc, "load_authoritative_finalization_replay", unavailable)
    result = await _run_persist(monkeypatch, lambda **kwargs: _none())
    assert result["analysis_status"] == "failed"
    assert result["error_code"] == "replay_report_inconsistent"
    assert result["report_version"] is None
    assert result["protocol"] == {} and result["saved_biomarkers"] == []


async def _none():
    return None


async def _run_persist(monkeypatch, save_impl):
    original = pipeline.run_lab_analysis_pipeline

    async def wrapped(**kwargs):
        kwargs["persist_biomarkers"] = True
        return await original(**kwargs)

    monkeypatch.setattr(pipeline, "run_lab_analysis_pipeline", wrapped)
    return await _run_with_save(monkeypatch, save_impl)


@pytest.mark.asyncio
async def test_atomic_finalization_dispatches_only_the_owner_scoped_recovery_ledger(monkeypatch):
    calls = []

    async def committed(**kwargs):
        return {
            "report_version_id": kwargs["report_version_id"], "replay": False, "generation": 1,
            "biomarkers": [dict(row) for row in kwargs["biomarkers"]], "input_hash": "x" * 64,
        }

    async def dispatch(*, authenticated_user_id, report_version_id):
        calls.append((authenticated_user_id, report_version_id))
        return {effect: "completed" for effect in (
            "retest_obligations", "retest_fulfillment", "lab_plan_fulfillment", "safety_events",
            "intelligence_artifacts", "protocol", "timeline", "audit",
        )}

    monkeypatch.setattr(svc, "finalize_lab_analysis", committed)
    monkeypatch.setattr(pipeline, "recover_report_followups", dispatch)
    result = await _run_persist(monkeypatch, _none)
    assert calls == [(USER, result["report_version"]["id"])]
    assert result["downstream_status"] == "completed"
    assert result["downstream_dispatch_invoked"] is True


@pytest.mark.asyncio
async def test_save_biomarkers_identical_retry_is_not_destructive(monkeypatch):
    rows_db = []
    ops = []

    class T:
        def __init__(self): self._op = None
        def select(self, *a): self._op = "select"; return self
        def delete(self): self._op = "delete"; ops.append("delete"); return self
        def insert(self, rows): self._op = "insert"; ops.append("insert"); rows_db[:] = [dict(r) for r in rows]; self._rows = rows; return self
        def eq(self, *a): return self
        def execute(self):
            class R: pass
            r = R(); r.data = list(rows_db); return r

    class C:
        def table(self, name): return T()

    async def run(fn): return fn()

    monkeypatch.setattr(svc, "_get_supabase", lambda: C())
    monkeypatch.setattr(svc, "_run", run)
    bm = [{"name": "Ferritin", "value": 18.0, "unit": "ng/mL", "ref_low": 30, "ref_high": 300, "status": "DEFICIENT"}]
    await svc.save_biomarkers("u1", USER, bm)
    assert ops == ["delete", "insert"]
    ops.clear()
    await svc.save_biomarkers("u1", USER, bm)
    assert ops == []  # identical retry leaves stored rows untouched
    changed = [dict(bm[0], value=20.0)]
    await svc.save_biomarkers("u1", USER, changed)
    assert ops == ["delete", "insert"]  # genuinely different content still replaces


def test_api_response_model_keeps_failure_and_partial_fields():
    from app.routers.analysis.analyze import AnalyzeResponse, _persistence_contract

    fields = _persistence_contract({"error": "report_persistence_failed", "error_code": "report_persistence_failed",
                                    "post_persistence_status": "partial", "other": 1})
    out = AnalyzeResponse(upload_id="u", biomarkers=[], analysis_status="partial", **fields).model_dump()
    assert out["analysis_status"] == "partial" and out["post_persistence_status"] == "partial"
    assert out["error_code"] == "report_persistence_failed"
    assert _persistence_contract({"analysis_status": "completed"}) == {}


def test_api_response_model_keeps_replay_and_downstream_state():
    from app.routers.analysis.analyze import AnalyzeResponse, _persistence_contract

    fields = _persistence_contract({"finalization_replay": True, "downstream_status": "pending"})
    out = AnalyzeResponse(upload_id="u", biomarkers=[], analysis_status="completed", **fields).model_dump()
    assert out["finalization_replay"] is True and out["downstream_status"] == "pending"


def test_frozen_payload_key_sets_match_sql_contract():
    from app.services import protocol_evidence_snapshot as ses
    from app.services import protocol_pipeline_evidence as ppe
    from pathlib import Path
    sql = (Path(__file__).resolve().parents[1] / "migrations" /
           "20261016120000_atomic_lab_analysis_finalization.sql").read_text()
    assert ses._SNAPSHOT_FIELDS == {"schema", "report_version_id", "input_context_hash", "entries", "integrity_hash"}
    for k in ses._SNAPSHOT_FIELDS:
        assert f"'{k}'" in sql
    assert f"'{ppe.FROZEN_EVIDENCE_SCHEMA}'" in sql and f"'{ses.SNAPSHOT_SCHEMA}'" in sql


def _non_authorizing_report():
    from app.services import protocol_pipeline_evidence as ppe
    inputs = {"biomarkers": [{"name": "Ferritin", "value": 45.55555, "unit": "ng/mL", "status": "UNEVALUATED"}],
              "symptom_snapshot": None}
    built = ppe.build_pipeline_frozen_evidence(
        report_version_id="rv-1", normalized_biomarkers=inputs["biomarkers"], symptom_snapshot=None,
        knowledge_evaluation={"matched_rules": [{"recommendation_keys": []}], "generated_recommendations": []})
    rv = {"input_snapshot": inputs, "explainability": {ppe.FROZEN_EVIDENCE_KEY: built["payload"]}}
    return ppe, built, rv


def test_non_authorizing_state_builds_and_reads_as_non_authorizing():
    ppe, built, rv = _non_authorizing_report()
    assert built["status"] == "NON_AUTHORIZING"
    assert ppe.verify_persisted_frozen_evidence(rv, report_version_id="rv-1") == ppe.NON_AUTHORIZING_READ_REASON


def test_non_authorizing_state_fails_closed_on_tamper():
    import copy
    ppe, _, rv = _non_authorizing_report()
    other = copy.deepcopy(rv)
    other["input_snapshot"]["biomarkers"][0]["value"] = 1
    assert ppe.verify_persisted_frozen_evidence(other, report_version_id="rv-1") == "frozen_protocol_evidence_invalid"
    assert ppe.verify_persisted_frozen_evidence(rv, report_version_id="rv-2") == "frozen_protocol_evidence_report_mismatch"
    bad = copy.deepcopy(rv)
    bad["explainability"][ppe.FROZEN_EVIDENCE_KEY]["extra"] = 1
    assert ppe.verify_persisted_frozen_evidence(bad, report_version_id="rv-1") == "frozen_protocol_evidence_malformed"


def test_malformed_recommendation_bearing_rule_still_unavailable():
    from app.services import protocol_pipeline_evidence as ppe
    r = ppe.build_pipeline_frozen_evidence(
        report_version_id="rv-1", normalized_biomarkers=[], symptom_snapshot=None,
        knowledge_evaluation={"matched_rules": [{"recommendation_keys": "x"}], "generated_recommendations": []})
    assert r["status"] == "UNAVAILABLE"


@pytest.mark.parametrize("evaluation", [
    {"matched_rules": [], "generated_recommendations": []},
    {"matched_rules": [_rule(recommendation_keys=[])], "generated_recommendations": [_rec()]},
])
def test_no_recommendation_bearing_rules_is_explicit_non_authorizing(evaluation):
    result = _build(evaluation=evaluation)
    assert result["status"] == "NON_AUTHORIZING" and result["snapshot"] is None

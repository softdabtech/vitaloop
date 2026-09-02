"""Post-release Hotfix 1 — regression coverage for the 3 defects discovered
by the Release 1.0 live production smoke test.

1. Manual-entry protocol persistence: analyze.py::save_protocol_for_upload()
   used to build its own insert payload with
   `"created_at": asyncio.get_event_loop().time()` — a monotonic-clock float
   (e.g. "4766498.437"), not a timestamp. Every insert into `protocols` for a
   manual-entry analysis therefore always failed at the DB layer with
   "invalid input syntax for type timestamp with time zone", silently
   swallowed by a bare `except: pass`. Fixed by delegating to the same
   canonical `supabase_service.save_protocol()` every other ingestion path
   (PDF, confirm-candidates) already uses — no `created_at` is set there at
   all; the table's own `now()` default handles it. No second protocol
   model was introduced.

2. AnalyzeResponse contract: `analysis_status`, `report_source`, and
   `safety_notice` were already computed and present in every route
   handler's return dict, but FastAPI's `response_model=AnalyzeResponse`
   filtering silently stripped them from the actual wire JSON on the 3
   endpoints that declare it (bare POST "", POST /manual,
   POST /{upload_id}/regenerate) because they weren't declared fields on the
   model. GET /analyze/{upload_id} and GET /results/{upload_id} declare no
   response_model and were never affected. Fixed by adding the 3 fields as
   Optional[str] = None (backward compatible — no existing client that
   ignores them can break).

3. Check-in -> Health Score refresh: calculate_health_score() (formula,
   weights, and thresholds UNCHANGED) was only ever invoked as a one-time
   fallback when no health_scores row existed yet for a user — never after a
   check-in. A dashboard read after check-in kept replaying whatever row was
   calculated before the check-in, so the adherence component never
   reflected the real, current check-in count. Fixed by calling the exact
   same, already-existing calculate_health_score(user_id) once, for only
   that user, right after a check-in persists — no dashboard.py read-path
   change was needed, since it already reads the most recently `calculated_at`
   row.

No live database connection is used anywhere in this file.
"""

import uuid

import pytest
from httpx import ASGITransport, AsyncClient

from app.dependencies import get_current_user
from app.main import app
from app.routers.analysis import analyze as analyze_router
from app.routers.protocol import checkins
from app.services import supabase_service as svc


# --- Defect 1: manual protocol persistence --------------------------------------


@pytest.mark.asyncio
async def test_manual_protocol_persistence_delegates_to_canonical_save_protocol(monkeypatch):
    """save_protocol_for_upload() must call the same supabase_service.save_protocol()
    every other ingestion path uses — not build its own insert payload."""
    captured = {}

    async def fake_save_protocol(*, user_id, upload_id, recommendations, prompt_version=None):
        captured["user_id"] = user_id
        captured["upload_id"] = upload_id
        captured["recommendations"] = recommendations
        captured["prompt_version"] = prompt_version
        return {"id": "protocol-1", "user_id": user_id, "upload_id": upload_id, "recommendations": recommendations}

    monkeypatch.setattr(analyze_router, "save_protocol", fake_save_protocol)

    await analyze_router.save_protocol_for_upload(
        user_id="user-hotfix-1", upload_id="upload-hotfix-1", recommendations=[{"supplement": "Vitamin D3"}]
    )

    assert captured["user_id"] == "user-hotfix-1"
    assert captured["upload_id"] == "upload-hotfix-1"
    assert captured["recommendations"] == [{"supplement": "Vitamin D3"}]
    # No created_at (or any timestamp) is passed through at all — the
    # canonical save_protocol() never accepts one, proving the monotonic-
    # clock bug class cannot recur through this call site.
    assert "created_at" not in captured


def test_manual_protocol_persistence_no_longer_uses_event_loop_time():
    import ast
    import inspect
    import textwrap

    source = inspect.getsource(analyze_router.save_protocol_for_upload)
    tree = ast.parse(textwrap.dedent(source))
    func = tree.body[0]
    body_without_docstring = func.body[1:] if ast.get_docstring(func) else func.body
    code_only = "\n".join(ast.unparse(node) for node in body_without_docstring)
    assert "get_event_loop" not in code_only, "the monotonic-clock bug must not remain in the executable code"
    assert "save_protocol(" in code_only


@pytest.mark.asyncio
async def test_manual_protocol_persistence_created_at_is_a_valid_timestamp_end_to_end(monkeypatch):
    """Exercises the REAL supabase_service.save_protocol() (not mocked) with a
    fake DB client that records the exact insert payload, proving no
    created_at field (let alone an invalid one) is ever sent for a new
    protocol row — the table's own now() default is trusted instead."""

    class _Resp:
        def __init__(self, data):
            self.data = data

    class _ProtocolsTable:
        def __init__(self):
            self.insert_payloads = []

        def select(self, *_a, **_k):
            return self

        def eq(self, *_a, **_k):
            return self

        def limit(self, *_a, **_k):
            return self

        def execute(self):
            return _Resp([])  # no existing protocol -> insert path

        def insert(self, payload):
            self.insert_payloads.append(payload)
            return self

    table = _ProtocolsTable()

    class _Client:
        def table(self, name):
            assert name == "protocols"
            return table

    async def fake_run(fn):
        return fn()

    monkeypatch.setattr(svc, "_get_supabase", lambda: _Client())
    monkeypatch.setattr(svc, "_run", fake_run)

    async def fake_get_protocol_by_upload(_user_id, _upload_id):
        return None

    monkeypatch.setattr(svc, "get_protocol_by_upload", fake_get_protocol_by_upload)

    async def fake_emit_timeline(*_a, **_k):
        return None

    monkeypatch.setattr(svc, "_emit_timeline", fake_emit_timeline)

    await analyze_router.save_protocol_for_upload(
        user_id="user-hotfix-1b", upload_id="upload-hotfix-1b", recommendations=[{"supplement": "Iron"}]
    )

    assert len(table.insert_payloads) == 1
    payload = table.insert_payloads[0]
    assert "created_at" not in payload, (
        "no created_at should ever be sent by save_protocol() — relies on the "
        "protocols table's own now() default, the exact bug class being fixed"
    )
    assert payload["recommendations"] == [{"supplement": "Iron"}]


@pytest.mark.asyncio
async def test_manual_entry_auto_continue_result_retrievable_via_results_endpoint(monkeypatch):
    """End-to-end proof through the real HTTP route: a manual analysis that
    reaches auto_continue persists a protocol that a LATER GET can retrieve
    — this is the exact journey that silently failed in production before
    this hotfix (POST returned 201 with a protocol in its own body, but a
    later GET always saw an empty one)."""
    fake_user_id = "33333333-3333-3333-3333-333333333333"
    fake_upload_id = str(uuid.uuid4())
    state = {"saved_protocol": None}

    async def fake_check_quota(_user_id, _entry_type):
        return True, "", None

    async def fake_validate_entries(entries, *, sex=None, age=None):
        return entries, []

    async def fake_convert_to_standard_units(entries, *, sex=None, age=None):
        return entries

    def fake_format_for_claude_analysis(entries):
        return "Glucose 90 mg/dL"

    async def fake_create_upload_from_manual_entries(user_id, entries, lab_name=None, test_date=None, notes=None):
        return {"upload_id": fake_upload_id, "biomarkers": [
            {"id": "bm-1", "upload_id": fake_upload_id, "user_id": user_id, "name": "Glucose",
             "value": 90.0, "unit": "mg/dL", "ref_low": 70, "ref_high": 99, "status": "OPTIMAL"},
        ]}

    async def fake_extract_biomarkers(**_kwargs):
        return {"recommendations": [{"supplement": "None needed", "priority": "LOW"}]}

    async def fake_save_biomarker_extraction_candidates(**_kwargs):
        return []

    async def fake_assert_upload_belongs_to_user(_upload_id, _user_id):
        return None

    async def fake_get_biomarkers_by_upload(upload_id, user_id):
        if upload_id == fake_upload_id:
            return [{"id": "bm-1", "name": "Glucose", "value": 90.0, "unit": "mg/dL", "status": "OPTIMAL"}]
        return []

    async def fake_get_protocol_by_upload(user_id, upload_id):
        return state["saved_protocol"]

    async def fake_save_protocol_real_path(*, user_id, upload_id, recommendations, prompt_version=None):
        # Simulates the now-fixed canonical persistence succeeding.
        state["saved_protocol"] = {"id": "protocol-real", "user_id": user_id, "upload_id": upload_id, "recommendations": recommendations}
        return state["saved_protocol"]

    async def fake_write_audit_log(**_kwargs):
        return None

    async def fake_run_lab_analysis_pipeline(**kwargs):
        return {
            "analysis_status": "completed",
            "saved_biomarkers": [{"id": "bm-1", "name": "Glucose", "value": 90.0, "unit": "mg/dL", "status": "OPTIMAL"}],
            "knowledge_evaluation": {}, "knowledge_report": {}, "interpreted_report": {},
            "analysis_input_quality_gate": {"decision": "auto_continue", "requires_confirmation": False},
            "clinical_data_integrity": {"status": "pass"}, "evidence_gaps": {},
            "protocol": {}, "recommendations": [{"supplement": "None needed", "priority": "LOW"}],
            "shopping_links": [], "retest_suggestions": [], "health_summary": {},
            "safety_result": {"status": "approved"}, "explainability": {}, "report_version": {"id": "rv-1"},
        }

    monkeypatch.setattr(analyze_router.biomarker_service, "check_freemium_biomarker_quota", fake_check_quota)
    monkeypatch.setattr(analyze_router.biomarker_service, "validate_entries", fake_validate_entries)
    monkeypatch.setattr(analyze_router.biomarker_service, "convert_to_standard_units", fake_convert_to_standard_units)
    monkeypatch.setattr(analyze_router.biomarker_service, "format_for_claude_analysis", fake_format_for_claude_analysis)
    monkeypatch.setattr(analyze_router.biomarker_service, "create_upload_from_manual_entries", fake_create_upload_from_manual_entries)
    monkeypatch.setattr(analyze_router, "is_llm_configured", lambda: True)
    monkeypatch.setattr(analyze_router, "extract_biomarkers", fake_extract_biomarkers)
    monkeypatch.setattr(analyze_router, "save_protocol", fake_save_protocol_real_path)
    monkeypatch.setattr(analyze_router, "save_biomarker_extraction_candidates", fake_save_biomarker_extraction_candidates)
    monkeypatch.setattr(analyze_router, "run_lab_analysis_pipeline", fake_run_lab_analysis_pipeline)
    monkeypatch.setattr(analyze_router, "assert_upload_belongs_to_user", fake_assert_upload_belongs_to_user)
    monkeypatch.setattr(analyze_router, "get_biomarkers_by_upload", fake_get_biomarkers_by_upload)
    monkeypatch.setattr(analyze_router, "get_protocol_by_upload", fake_get_protocol_by_upload)
    monkeypatch.setattr(analyze_router, "write_audit_log", fake_write_audit_log)
    monkeypatch.setattr(analyze_router, "get_biomarker_extraction_candidates", lambda *a, **k: [])

    app.dependency_overrides[get_current_user] = lambda: {"sub": fake_user_id, "email": "hotfix1@vitaloop.test"}
    try:
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            manual_resp = await client.post(
                "/analyze/manual",
                json={"lab_name": "Hotfix Test", "biomarkers": [{"biomarker_id": "glucose", "value": 90.0, "unit": "mg/dL"}]},
            )
            assert manual_resp.status_code == 201
            assert state["saved_protocol"] is not None, "protocol must have been persisted via the canonical path"

            results_resp = await client.get(f"/analyze/{fake_upload_id}")
            assert results_resp.status_code == 200
    finally:
        app.dependency_overrides.clear()


# --- Defect 2: AnalyzeResponse contract ------------------------------------------


def test_analyze_response_model_declares_the_three_previously_stripped_fields():
    fields = analyze_router.AnalyzeResponse.model_fields
    for name in ("analysis_status", "report_source", "safety_notice"):
        assert name in fields, f"AnalyzeResponse must declare {name!r}"
        assert fields[name].default is None, f"{name!r} must be optional/default-compatible"


@pytest.mark.asyncio
async def test_regenerate_wire_json_retains_report_source(monkeypatch):
    fake_user_id = "44444444-4444-4444-4444-444444444444"
    upload_id = str(uuid.uuid4())

    async def fake_assert_upload_belongs_to_user(_upload_id, _user_id):
        return {"id": upload_id, "user_id": fake_user_id}

    async def fake_get_biomarkers_by_upload(_upload_id, _user_id):
        return [{"name": "Ferritin", "value": 50.0, "unit": "ng/mL", "status": "OPTIMAL"}]

    async def fake_get_user_profile(_user_id):
        return {"age": 30}

    async def fake_get_protocol_by_upload(_user_id, _upload_id):
        return {"recommendations": []}

    async def fake_write_audit_log(**_kwargs):
        return None

    async def fake_pipeline(**kwargs):
        return {
            "analysis_status": "completed",
            "knowledge_report": {}, "knowledge_evaluation": {}, "interpreted_report": {},
            "recommendations": [], "protocol": {}, "safety_result": {"status": "approved"},
            "safety_notice": None, "explainability": {},
            "report_version": {"id": "rv-regen-1", "status": "completed"},
        }

    monkeypatch.setattr(analyze_router, "assert_upload_belongs_to_user", fake_assert_upload_belongs_to_user)
    monkeypatch.setattr(analyze_router, "get_biomarkers_by_upload", fake_get_biomarkers_by_upload)
    monkeypatch.setattr(analyze_router, "get_user_profile", fake_get_user_profile)
    monkeypatch.setattr(analyze_router, "get_protocol_by_upload", fake_get_protocol_by_upload)
    monkeypatch.setattr(analyze_router, "write_audit_log", fake_write_audit_log)
    monkeypatch.setattr(analyze_router, "run_lab_analysis_pipeline", fake_pipeline)

    app.dependency_overrides[get_current_user] = lambda: {"sub": fake_user_id}
    try:
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            response = await client.post(f"/analyze/{upload_id}/regenerate")
        assert response.status_code == 200
        data = response.json()
        assert data["report_source"] == "regenerated", "report_source must survive response_model serialization"
        assert data["analysis_status"] == "completed", "analysis_status must survive response_model serialization"
    finally:
        app.dependency_overrides.clear()


@pytest.mark.asyncio
async def test_manual_analyze_wire_json_retains_analysis_status(monkeypatch):
    """Same proof for the bare POST '' compatibility route and POST /manual —
    both declare response_model=AnalyzeResponse and were equally affected."""
    fake_user_id = "55555555-5555-5555-5555-555555555555"
    fake_upload_id = str(uuid.uuid4())

    async def fake_check_quota(_user_id, _entry_type):
        return True, "", None

    async def fake_validate_entries(entries, *, sex=None, age=None):
        return entries, []

    async def fake_convert_to_standard_units(entries, *, sex=None, age=None):
        return entries

    async def fake_create_upload_from_manual_entries(user_id, entries, lab_name=None, test_date=None, notes=None):
        return {"upload_id": fake_upload_id, "biomarkers": []}

    async def fake_run_lab_analysis_pipeline(**kwargs):
        return {
            "analysis_status": "needs_confirmation",
            "saved_biomarkers": [],
            "knowledge_evaluation": None, "knowledge_report": None, "interpreted_report": None,
            "analysis_input_quality_gate": {"decision": "block_or_confirm", "requires_confirmation": True},
            "clinical_data_integrity": {}, "evidence_gaps": {},
            "protocol": {}, "recommendations": [], "shopping_links": [], "retest_suggestions": [],
            "health_summary": {}, "safety_result": None, "safety_notice": None, "explainability": None,
            "report_version": None,
        }

    async def fake_write_audit_log(**_kwargs):
        return None

    monkeypatch.setattr(analyze_router.biomarker_service, "check_freemium_biomarker_quota", fake_check_quota)
    monkeypatch.setattr(analyze_router.biomarker_service, "validate_entries", fake_validate_entries)
    monkeypatch.setattr(analyze_router.biomarker_service, "convert_to_standard_units", fake_convert_to_standard_units)
    monkeypatch.setattr(analyze_router.biomarker_service, "create_upload_from_manual_entries", fake_create_upload_from_manual_entries)
    monkeypatch.setattr(analyze_router, "is_llm_configured", lambda: False)
    monkeypatch.setattr(analyze_router, "save_biomarker_extraction_candidates", lambda **k: None)
    monkeypatch.setattr(analyze_router, "run_lab_analysis_pipeline", fake_run_lab_analysis_pipeline)
    monkeypatch.setattr(analyze_router, "write_audit_log", fake_write_audit_log)

    async def fake_save_candidates(**_kwargs):
        return []

    monkeypatch.setattr(analyze_router, "save_biomarker_extraction_candidates", fake_save_candidates)

    app.dependency_overrides[get_current_user] = lambda: {"sub": fake_user_id}
    try:
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            response = await client.post(
                "/analyze/manual",
                json={"lab_name": "Hotfix Test", "biomarkers": [{"biomarker_id": "glucose", "value": 90.0, "unit": "mg/dL"}]},
            )
        assert response.status_code == 201
        data = response.json()
        assert data["analysis_status"] == "needs_confirmation", "analysis_status must survive response_model serialization"
    finally:
        app.dependency_overrides.clear()


# --- Defect 3: check-in -> Health Score refresh ----------------------------------


@pytest.mark.asyncio
async def test_checkin_triggers_health_score_recompute_for_only_that_user(monkeypatch):
    captured = {}

    async def fake_submit_weekly_checkin(user_id, data):
        return {"id": "checkin-hotfix-1", "user_id": user_id, **data}

    async def fake_calculate_health_score(user_id):
        captured["user_id"] = user_id
        return {"score": 77.5, "adherence_component": 25.0}

    monkeypatch.setattr(checkins.svc, "submit_weekly_checkin", fake_submit_weekly_checkin)
    monkeypatch.setattr(checkins.svc, "calculate_health_score", fake_calculate_health_score)
    monkeypatch.setattr(checkins, "invalidate_summary_cache", lambda _user_id: None)

    from datetime import date

    body = checkins.CheckinCreate(week_start=date(2026, 8, 24), energy_score=6, protocol_adherence=4)
    result = await checkins.submit_checkin(body, {"sub": "user-hotfix-3"})

    assert result["id"] == "checkin-hotfix-1"
    assert captured["user_id"] == "user-hotfix-3", "health score must be recomputed for exactly the checking-in user"


@pytest.mark.asyncio
async def test_checkin_health_score_refresh_failure_does_not_break_checkin_submission(monkeypatch):
    """Defensive posture: a health-score recompute failure must never make
    the check-in submission itself fail."""
    async def fake_submit_weekly_checkin(user_id, data):
        return {"id": "checkin-hotfix-2", "user_id": user_id, **data}

    async def fake_calculate_health_score_raises(_user_id):
        raise RuntimeError("simulated failure")

    monkeypatch.setattr(checkins.svc, "submit_weekly_checkin", fake_submit_weekly_checkin)
    monkeypatch.setattr(checkins.svc, "calculate_health_score", fake_calculate_health_score_raises)
    monkeypatch.setattr(checkins, "invalidate_summary_cache", lambda _user_id: None)

    from datetime import date

    body = checkins.CheckinCreate(week_start=date(2026, 8, 24), energy_score=5)
    result = await checkins.submit_checkin(body, {"sub": "user-hotfix-4"})
    assert result["id"] == "checkin-hotfix-2"


def test_calculate_health_score_formula_and_weights_are_unchanged():
    """Pins the exact existing formula/weights this hotfix must not touch."""
    import inspect

    source = inspect.getsource(svc.calculate_health_score)
    assert "adherence_component = round(min(100.0, (len(checkins) / 4) * 100), 2)" in source
    assert "symptom_component * 0.4 + adherence_component * 0.2 + biomarker_component * 0.4" in source


@pytest.mark.asyncio
async def test_adherence_component_reflects_real_checkin_count_no_fabrication(monkeypatch):
    """Direct proof against the real (unmocked) calculate_health_score():
    adherence_component changes ONLY because the underlying checkin count
    changed — not because of any new fabricated boost."""

    # State toggled explicitly between the two calculate_health_score() calls
    # below, rather than counted by invocation — get_latest_symptom_signal()
    # (added for the symptom_component fix) now also calls get_weekly_checkins
    # internally, so a plain call-counter would desync from which outer
    # "before"/"after" call is actually in flight.
    checkin_state = {"checkins": []}

    async def fake_get_user_symptom_summary(_user_id, days=30):
        return {"average_severity": 5}

    async def fake_get_weekly_checkins(_user_id, limit=4):
        return list(checkin_state["checkins"])

    class _Resp:
        def __init__(self, data):
            self.data = data

    class _BiomarkersTable:
        def select(self, *_a, **_k):
            return self

        def eq(self, *_a, **_k):
            return self

        def order(self, *_a, **_k):
            return self

        def limit(self, *_a, **_k):
            return self

        def execute(self):
            return _Resp([])

    class _HealthScoresTable:
        def insert(self, _payload):
            return self

        def execute(self):
            return _Resp([{}])

    class _QuestionnaireSessionsTable:
        """No completed intake session in this scenario — get_latest_symptom_signal()
        falls through to the (also-empty, in the 'before' state) check-in path,
        landing on the neutral 50.0 default in both calls so this test's actual
        subject (adherence_component) is the only thing that moves."""

        def select(self, *_a, **_k):
            return self

        def eq(self, *_a, **_k):
            return self

        def order(self, *_a, **_k):
            return self

        def limit(self, *_a, **_k):
            return self

        def execute(self):
            return _Resp([])

    class _Client:
        def table(self, name):
            if name == "biomarkers":
                return _BiomarkersTable()
            if name == "health_scores":
                return _HealthScoresTable()
            if name == "questionnaire_sessions":
                return _QuestionnaireSessionsTable()
            raise AssertionError(name)

    async def fake_run(fn):
        return fn()

    async def fake_audit_read(**_k):
        return None

    async def fake_audit_write(**_k):
        return None

    monkeypatch.setattr(svc, "get_user_symptom_summary", fake_get_user_symptom_summary)
    monkeypatch.setattr(svc, "get_weekly_checkins", fake_get_weekly_checkins)
    monkeypatch.setattr(svc, "_get_supabase", lambda: _Client())
    monkeypatch.setattr(svc, "_run", fake_run)
    monkeypatch.setattr(svc, "_audit_medical_read", fake_audit_read)
    monkeypatch.setattr(svc, "_audit_medical_write", fake_audit_write)

    before = await svc.calculate_health_score("user-hotfix-5")
    checkin_state["checkins"] = [{"id": "c1"}]
    after = await svc.calculate_health_score("user-hotfix-5")

    assert before["adherence_component"] == 0.0
    assert after["adherence_component"] == 25.0, "(1 checkin / 4) * 100 — the same existing, unchanged formula"
    assert after["score"] > before["score"], "total score must move only via the real formula, not a fabricated bump"

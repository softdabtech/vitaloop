"""Stage 2G — frozen report reproducibility.

Point of truth: a completed historical analysis (a persisted `report_versions`
row) is an immutable historical artifact. GETting it must not silently
recompute it with today's pipeline/prompts/knowledge rules/safety behavior.
Explicit regeneration is the only path that runs the pipeline intentionally
and creates a NEW version; old versions are never overwritten in place.

Traced ownership model (see app/services/report_history.py's module
docstring for the full trace):
  - report_versions: one immutable INSERT-only row per completed generation
    event (initial analysis, candidate confirmation, manual entry, explicit
    regenerate). `version` is a fixed literal, not an incrementing number —
    created_at DESC (via the existing get_latest_report_version()) is the
    authoritative ordering, reused as-is, not reinvented.
  - protocols: one mutable, upserted (never versioned) row per upload,
    holding `recommendations` as a flat list. Traced: no task-completion/
    check-off state exists anywhere for it — not a genuine per-item mutable
    user state, but its shape differs from report_versions.protocol and is
    the shape the frontend contract depends on, so it is preserved and
    served separately, unchanged, alongside the frozen structured snapshot
    (which is still exposed, verbatim, under report_version.protocol).
  - GET /analyze/{upload_id} (analyze.py::get_results) and
    GET /results/{upload_id} (protocol/compatibility.py::get_results_by_upload,
    the endpoint the frontend actually calls — see ProtocolPage.jsx/Results.jsx)
    both route a completed upload through the same shared
    app/services/report_history.py::assemble_frozen_response() helper.
  - B2B (app/services/b2b/analyze_labs.py) never persists report_versions and
    has no GET-by-id endpoint — not applicable to this stage's fix.

No live database connection is used anywhere in this file.
"""

import uuid

import pytest
from fastapi import HTTPException
from httpx import ASGITransport, AsyncClient

from app.dependencies import get_current_user
from app.main import app
from app.routers.analysis import analyze as analyze_router
from app.routers.protocol import compatibility as compatibility_router
from app.services import report_history
from app.services.report_history import (
    REPORT_SOURCE_FROZEN,
    REPORT_SOURCE_LEGACY_FALLBACK,
    assemble_frozen_response,
    is_frozen_report_version,
)

FAKE_USER_ID = "22222222-2222-2222-2222-222222222222"
FOREIGN_USER_ID = "99999999-9999-9999-9999-999999999999"


def _frozen_row(**overrides):
    row = {
        "id": "report-v-1",
        "user_id": FAKE_USER_ID,
        "upload_id": "upload-1",
        "version": "report_v1",
        "locale": "en",
        "status": "completed",
        "created_at": "2026-01-01T00:00:00Z",
        "input_snapshot": {
            "analysis_input_quality_gate": {"decision": "auto_continue"},
            "clinical_data_integrity": {"status": "ok"},
            "evidence_gaps": {"summary": {"gap_count": 0}},
        },
        "knowledge_report": {
            "summary": {"headline": "FROZEN HEADLINE — original historical content"},
            "why_it_matters": [],
            "doctor_discussion": [],
            "interpreted_report": {"narrative": "FROZEN interpreted narrative"},
        },
        "protocol": {"nutrition": [{"title": "FROZEN nutrition item"}]},
        "safety_result": {"status": "approved"},
        "explainability": {
            "version": "explainability_v1",
            "knowledge_evaluation": {"matched_rules": [{"rule_key": "r1"}], "confidence": 0.9},
        },
    }
    row.update(overrides)
    return row


# --- G1/G2: frozen GET never invokes the pipeline, returns persisted content ----


@pytest.mark.asyncio
async def test_g1_g2_analyze_get_results_does_not_invoke_pipeline_when_frozen(monkeypatch):
    upload_id = str(uuid.uuid4())
    frozen = _frozen_row(upload_id=upload_id, user_id=FAKE_USER_ID)
    pipeline_called = {"count": 0}

    async def fake_assert_upload_belongs_to_user(_upload_id, _user_id):
        return {"id": upload_id, "user_id": FAKE_USER_ID}

    async def fake_get_biomarkers_by_upload(_upload_id, _user_id):
        return [{"name": "Ferritin", "value": 12.0, "unit": "ng/mL", "status": "DEFICIENT"}]

    async def fake_get_biomarker_extraction_candidates(_upload_id, _user_id):
        return []

    async def fake_get_user_profile(_user_id):
        return {"age": 35}

    async def fake_get_protocol_by_upload(_user_id, _upload_id):
        return {"recommendations": [{"supplement": "Iron", "dosage": "18mg"}]}

    async def fake_get_latest_report_version(_upload_id, _user_id, _locale):
        return frozen

    async def fake_pipeline(**kwargs):
        # If this is ever called for a frozen upload, G1 has failed — the
        # mocked content below is intentionally DIFFERENT from the frozen
        # row's content (G2's "prove different mock content is ignored").
        pipeline_called["count"] += 1
        return {
            "knowledge_report": {"summary": {"headline": "LIVE RECOMPUTED — must never be served"}},
            "recommendations": [],
        }

    async def fake_write_audit_log(**_kwargs):
        return None

    monkeypatch.setattr(analyze_router, "assert_upload_belongs_to_user", fake_assert_upload_belongs_to_user)
    monkeypatch.setattr(analyze_router, "get_biomarkers_by_upload", fake_get_biomarkers_by_upload)
    monkeypatch.setattr(analyze_router, "get_biomarker_extraction_candidates", fake_get_biomarker_extraction_candidates)
    monkeypatch.setattr(analyze_router, "get_user_profile", fake_get_user_profile)
    monkeypatch.setattr(analyze_router, "get_protocol_by_upload", fake_get_protocol_by_upload)
    monkeypatch.setattr(analyze_router, "get_latest_report_version", fake_get_latest_report_version)
    monkeypatch.setattr(analyze_router, "run_lab_analysis_pipeline", fake_pipeline)
    monkeypatch.setattr(analyze_router, "write_audit_log", fake_write_audit_log)

    app.dependency_overrides[get_current_user] = lambda: {"sub": FAKE_USER_ID}
    try:
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            response = await client.get(f"/analyze/{upload_id}")
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 200
    # G1: the pipeline was never invoked to serve this completed historical result.
    assert pipeline_called["count"] == 0
    payload = response.json()
    # G2: response reflects the FROZEN content, not the (unreachable) live mock.
    assert payload["knowledge_report"]["summary"]["headline"] == "FROZEN HEADLINE — original historical content"
    assert payload["interpreted_report"]["narrative"] == "FROZEN interpreted narrative"
    assert payload["knowledge_evaluation"]["matched_rules"][0]["rule_key"] == "r1"
    assert payload["report_source"] == REPORT_SOURCE_FROZEN


@pytest.mark.asyncio
async def test_g1_g2_results_compat_endpoint_does_not_invoke_pipeline_when_frozen(monkeypatch):
    """Same proof for GET /results/{upload_id} — the endpoint the frontend
    (ProtocolPage.jsx/Results.jsx) actually calls."""
    upload_id = str(uuid.uuid4())
    frozen = _frozen_row(upload_id=upload_id, user_id=FAKE_USER_ID)
    pipeline_called = {"count": 0}

    async def fake_assert_upload_belongs_to_user(_upload_id, _user_id):
        return {"id": upload_id, "user_id": FAKE_USER_ID}

    async def fake_get_biomarkers_by_upload(_upload_id, _user_id):
        return [{"name": "Ferritin", "value": 12.0, "unit": "ng/mL", "status": "DEFICIENT"}]

    async def fake_get_protocol_by_upload(_user_id, _upload_id):
        return {"recommendations": [{"supplement": "Iron", "dosage": "18mg"}]}

    async def fake_get_user_profile(_user_id):
        return {"age": 35}

    async def fake_get_latest_report_version(_upload_id, _user_id, _locale):
        return frozen

    async def fake_pipeline(**kwargs):
        pipeline_called["count"] += 1
        return {"knowledge_report": {"summary": {"headline": "LIVE — must never be served"}}, "recommendations": []}

    monkeypatch.setattr(compatibility_router, "assert_upload_belongs_to_user", fake_assert_upload_belongs_to_user)
    monkeypatch.setattr(compatibility_router, "get_biomarkers_by_upload", fake_get_biomarkers_by_upload)
    monkeypatch.setattr(compatibility_router, "get_protocol_by_upload", fake_get_protocol_by_upload)
    monkeypatch.setattr(compatibility_router, "get_user_profile", fake_get_user_profile)
    monkeypatch.setattr(compatibility_router, "get_latest_report_version", fake_get_latest_report_version)
    monkeypatch.setattr(compatibility_router, "run_lab_analysis_pipeline", fake_pipeline)

    app.dependency_overrides[get_current_user] = lambda: {"sub": FAKE_USER_ID}
    try:
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            response = await client.get(f"/results/{upload_id}")
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 200
    assert pipeline_called["count"] == 0
    payload = response.json()
    assert payload["knowledge_report"]["summary"]["headline"] == "FROZEN HEADLINE — original historical content"
    assert payload["report_source"] == REPORT_SOURCE_FROZEN
    # G6: the flat protocol array (frontend contract shape) still comes from
    # the live protocols-table cache, not the frozen structured snapshot —
    # no legitimate current state was lost by preferring the frozen row.
    assert payload["protocol"][0]["supplement"] == "Iron"
    # ...while the frozen structured snapshot is still available, verbatim.
    assert payload["report_version"]["protocol"]["nutrition"][0]["title"] == "FROZEN nutrition item"


# --- G3: the DB row itself is never mutated by a GET ------------------------------


def test_g3_assemble_frozen_response_does_not_mutate_the_input_row():
    frozen = _frozen_row()
    original_copy = {**frozen, "knowledge_report": dict(frozen["knowledge_report"]), "protocol": dict(frozen["protocol"])}

    assemble_frozen_response(
        upload_id="upload-1",
        biomarkers=[],
        protocol_recommendations=[],
        report_version=frozen,
        user_profile={},
        locale="en",
    )

    assert frozen["knowledge_report"] == original_copy["knowledge_report"]
    assert frozen["protocol"] == original_copy["protocol"]
    assert frozen["status"] == "completed"


# --- G4/G5: regenerate creates a new version, old preserved, GET picks up latest --


def test_g4_g5_get_latest_report_version_orders_by_created_at_desc():
    """Version-selection semantics: proves the authoritative ordering is
    created_at DESC (the existing, already-implemented mechanism in
    supabase_service.get_latest_report_version) — this stage does not invent
    a parallel versioning scheme. A regenerate that inserts a new row with a
    later created_at, alongside the old unmutated row, is what makes GET
    naturally pick up the new version."""
    import asyncio

    from app.services import supabase_service as svc

    old_row = {"id": "old", "created_at": "2026-01-01T00:00:00Z", "locale": "en", "status": "completed"}
    new_row = {"id": "new", "created_at": "2026-02-01T00:00:00Z", "locale": "en", "status": "completed"}

    class _Resp:
        def __init__(self, data):
            self.data = data

    class _Query:
        def __init__(self, rows):
            self._rows = rows

        def select(self, *_a, **_k):
            return self

        def eq(self, *_a, **_k):
            return self

        def order(self, *_a, **_k):
            self._rows = sorted(self._rows, key=lambda r: r["created_at"], reverse=True)
            return self

        def limit(self, n):
            self._rows = self._rows[:n]
            return self

        def execute(self):
            return _Resp(self._rows)

    class _Client:
        def table(self, name):
            assert name == "report_versions"
            return _Query([old_row, new_row])

    async def fake_run(fn):
        return fn()

    svc._get_supabase.__wrapped__ if hasattr(svc._get_supabase, "__wrapped__") else None

    async def _run_test():
        import app.services.supabase_service as svc_mod

        original_get_supabase = svc_mod._get_supabase
        original_run = svc_mod._run
        svc_mod._get_supabase = lambda: _Client()
        svc_mod._run = fake_run
        try:
            latest = await svc_mod.get_latest_report_version("upload-1", "user-1", "en")
        finally:
            svc_mod._get_supabase = original_get_supabase
            svc_mod._run = original_run
        return latest

    latest = asyncio.get_event_loop().run_until_complete(_run_test())
    assert latest["id"] == "new"
    # The old row's dict identity is untouched — proves "preserve the previous
    # version unchanged" holds at this layer too (no write ever issued to it).
    assert old_row == {"id": "old", "created_at": "2026-01-01T00:00:00Z", "locale": "en", "status": "completed"}


def test_g4_regenerate_always_inserts_never_updates_report_versions():
    """Structural guard: regenerate_results must reach report_versions only
    through save_report_version() (an INSERT, per supabase_service.py), never
    through an update/delete call — this is what makes 'preserve the previous
    version unchanged' true without needing a live DB to prove it here."""
    import inspect

    source = inspect.getsource(analyze_router.regenerate_results)
    assert "persist_report_version=True" in source
    assert '.table("report_versions").update' not in source
    assert '.table("report_versions").delete' not in source

    save_source = inspect.getsource(
        __import__("app.services.supabase_service", fromlist=["save_report_version"]).save_report_version
    )
    assert '.table("report_versions").insert' in save_source
    assert '.table("report_versions").update' not in save_source


# --- G6: frozen protocol snapshot vs. current mutable protocols-table state -----


def test_g6_frozen_response_exposes_both_current_and_frozen_protocol_shapes():
    frozen = _frozen_row()
    response = assemble_frozen_response(
        upload_id="upload-1",
        biomarkers=[],
        protocol_recommendations=[{"supplement": "Iron"}],  # simulating current protocols-table cache
        report_version=frozen,
        user_profile={},
        locale="en",
    )
    # Current/frontend-contract shape (flat list) preserved separately.
    assert response["protocol"] == [{"supplement": "Iron"}]
    # Frozen structured snapshot preserved too — nothing lost.
    assert response["report_version"]["protocol"]["nutrition"][0]["title"] == "FROZEN nutrition item"


def test_g6b_frozen_response_sanitizes_current_protocol_cache_on_read():
    unsafe_protocol = [
        {
            "title": "Iron deficiency anemia protocol",
            "body": "Confirmed diagnosis of iron deficiency anemia.",
            "dosage": "Ferrous sulfate 325 mg once daily",
            "rationale": "Take 100 mg iron daily. Smoking increases your risk.",
        }
    ]
    response = assemble_frozen_response(
        upload_id="upload-1",
        biomarkers=[],
        protocol_recommendations=unsafe_protocol,
        report_version=_frozen_row(
            input_snapshot={"ai_orchestration": {"items": unsafe_protocol}},
            explainability={"recommendation_explanations": [{"safety_notes": [{"item": unsafe_protocol[0]}]}]},
        ),
        user_profile={"age": 52, "sex": "female"},
        locale="en",
    )

    served_text = str(
        {
            "protocol": response["protocol"],
            "report_version": response["report_version"],
        }
    ).lower()
    assert "iron deficiency anemia" not in served_text
    assert "confirmed diagnosis" not in served_text
    assert "325 mg" not in served_text
    assert "100 mg" not in served_text
    assert "once daily" not in served_text
    assert "smoking increases your risk" not in served_text
    assert "clinical confirmation" in served_text or "does not provide a diagnosis" in served_text
    assert unsafe_protocol[0]["title"] == "Iron deficiency anemia protocol"


# --- G7: pre-2C unsafe persisted text is sanitized on read, DB not mutated ------


def test_g7_pre_stage2c_diagnosis_like_text_is_redacted_on_read_not_in_storage():
    frozen = _frozen_row(
        knowledge_report={
            "summary": {"headline": "You have anemia"},
            "why_it_matters": [
                {
                    "rule_key": "r_anemia",
                    "title": "You have anemia",
                    "summary": "Confirmed diagnosis of iron deficiency anemia.",
                    "why_it_matters": "You have anemia based on these results.",
                }
            ],
            "doctor_discussion": ["Discuss: You have anemia with your care team."],
        },
    )
    stored_before = dict(frozen["knowledge_report"])

    response = assemble_frozen_response(
        upload_id="upload-1",
        biomarkers=[],
        protocol_recommendations=[],
        report_version=frozen,
        user_profile={},
        locale="en",
    )

    served_why_it_matters = response["knowledge_report"]["why_it_matters"][0]
    assert "you have" not in served_why_it_matters["title"].lower()
    assert served_why_it_matters.get("original_content_hidden") is True
    # The DB row's own dict is untouched — redaction happened only in the
    # in-memory response, immutability of the stored artifact is preserved.
    assert frozen["knowledge_report"] == stored_before
    assert "You have anemia" in stored_before["why_it_matters"][0]["title"]


# --- G8: confirm-candidates / manual-entry completion still persist a version ---


def test_g8_confirm_candidates_and_manual_entry_still_persist_report_version():
    import inspect

    confirm_source = inspect.getsource(analyze_router.confirm_upload_candidates)
    assert "persist_report_version=True" in confirm_source

    manual_source = inspect.getsource(analyze_router.analyze_manual_biomarkers)
    assert "persist_report_version=True" in manual_source


# --- G9: legacy fallback is tagged, never masquerades as frozen -----------------


@pytest.mark.asyncio
async def test_g9_legacy_upload_without_report_version_is_tagged_not_frozen(monkeypatch):
    upload_id = str(uuid.uuid4())

    async def fake_assert_upload_belongs_to_user(_upload_id, _user_id):
        return {"id": upload_id, "user_id": FAKE_USER_ID}

    async def fake_get_biomarkers_by_upload(_upload_id, _user_id):
        return [{"name": "Ferritin", "value": 12.0, "unit": "ng/mL", "status": "DEFICIENT"}]

    async def fake_get_protocol_by_upload(_user_id, _upload_id):
        return {"recommendations": []}

    async def fake_get_user_profile(_user_id):
        return {}

    async def fake_get_latest_report_version(_upload_id, _user_id, _locale):
        return None  # genuinely legacy: no row was ever persisted

    async def fake_pipeline(**kwargs):
        return {
            "analysis_status": "completed",
            "knowledge_report": {"summary": {"headline": "reconstructed"}},
            "recommendations": [],
        }

    monkeypatch.setattr(compatibility_router, "assert_upload_belongs_to_user", fake_assert_upload_belongs_to_user)
    monkeypatch.setattr(compatibility_router, "get_biomarkers_by_upload", fake_get_biomarkers_by_upload)
    monkeypatch.setattr(compatibility_router, "get_protocol_by_upload", fake_get_protocol_by_upload)
    monkeypatch.setattr(compatibility_router, "get_user_profile", fake_get_user_profile)
    monkeypatch.setattr(compatibility_router, "get_latest_report_version", fake_get_latest_report_version)
    monkeypatch.setattr(compatibility_router, "run_lab_analysis_pipeline", fake_pipeline)

    app.dependency_overrides[get_current_user] = lambda: {"sub": FAKE_USER_ID}
    try:
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            response = await client.get(f"/results/{upload_id}")
    finally:
        app.dependency_overrides.clear()

    payload = response.json()
    assert payload["report_source"] == REPORT_SOURCE_LEGACY_FALLBACK
    assert payload["report_source"] != REPORT_SOURCE_FROZEN


# --- Locale P0 fix + protocol-locale fix (cabinet reconciliation) -----------------
# Real-world case this locks in: upload 8a818a14-6dae-4740-a76e-52a2b590c6d5 —
# only a 'uk' report_versions row (and its upload-scoped protocols row,
# written in Ukrainian) exist; an 'en' GET must never leak either.


@pytest.mark.asyncio
async def test_locale_mismatch_results_compat_never_serves_stale_locale_protocol(monkeypatch):
    """A frozen version exists, just not in the requested locale — distinct
    from the genuinely-legacy case above (has_any_report_version=True here,
    vs None/False there). Must: (1) never claim REPORT_SOURCE_FROZEN or
    REPORT_SOURCE_LEGACY_FALLBACK, (2) serve freshly-generated (correct
    locale) protocol content, never the stale-locale protocols row content,
    (3) never persist over the existing protocols row (save_protocol must not
    be called — that would destroy the other locale's legitimately correct
    protocol)."""
    upload_id = str(uuid.uuid4())
    save_protocol_called = {"count": 0}

    async def fake_assert_upload_belongs_to_user(_upload_id, _user_id):
        return {"id": upload_id, "user_id": FAKE_USER_ID}

    async def fake_get_biomarkers_by_upload(_upload_id, _user_id):
        return [{"name": "Hemoglobin", "value": 148.0, "unit": "g/L", "status": "ELEVATED"}]

    async def fake_get_protocol_by_upload(_user_id, _upload_id):
        # Stale: written by the 'uk' generation event, upload-scoped only.
        return {"recommendations": [{"title": "Підтримайте базу харчування", "body": "УКРАЇНСЬКИЙ ТЕКСТ"}]}

    async def fake_get_user_profile(_user_id):
        return {}

    async def fake_get_latest_report_version(_upload_id, _user_id, locale):
        assert locale == "en"
        return None  # no 'en' row — only 'uk' exists

    async def fake_has_any_report_version(_upload_id, _user_id):
        return True  # a 'uk' row DOES exist — this is the mismatch case

    async def fake_pipeline(**kwargs):
        assert kwargs["locale"] == "en"
        assert kwargs["generate_ai_protocol"] is True, (
            "the stale-locale protocol must not suppress fresh generation"
        )
        return {
            "knowledge_report": {"summary": {"headline": "FRESH ENGLISH CONTENT"}},
            "recommendations": [{"title": "Fresh English protocol item", "body": "ENGLISH TEXT"}],
        }

    async def fake_save_protocol(**_kwargs):
        save_protocol_called["count"] += 1
        raise AssertionError("must not persist over the other locale's protocols row")

    monkeypatch.setattr(compatibility_router, "assert_upload_belongs_to_user", fake_assert_upload_belongs_to_user)
    monkeypatch.setattr(compatibility_router, "get_biomarkers_by_upload", fake_get_biomarkers_by_upload)
    monkeypatch.setattr(compatibility_router, "get_protocol_by_upload", fake_get_protocol_by_upload)
    monkeypatch.setattr(compatibility_router, "get_user_profile", fake_get_user_profile)
    monkeypatch.setattr(compatibility_router, "get_latest_report_version", fake_get_latest_report_version)
    monkeypatch.setattr(compatibility_router, "has_any_report_version", fake_has_any_report_version)
    monkeypatch.setattr(compatibility_router, "run_lab_analysis_pipeline", fake_pipeline)
    monkeypatch.setattr(compatibility_router, "save_protocol", fake_save_protocol)

    app.dependency_overrides[get_current_user] = lambda: {"sub": FAKE_USER_ID}
    try:
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            response = await client.get(f"/results/{upload_id}")
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 200
    payload = response.json()
    assert payload["report_source"] == report_history.REPORT_SOURCE_LOCALE_UNAVAILABLE
    assert payload["report_source"] not in {REPORT_SOURCE_FROZEN, REPORT_SOURCE_LEGACY_FALLBACK}
    assert payload["knowledge_report"]["summary"]["headline"] == "FRESH ENGLISH CONTENT"
    # No Ukrainian text anywhere in the served protocol.
    assert payload["protocol"] == [{"title": "Fresh English protocol item", "body": "ENGLISH TEXT"}]
    assert save_protocol_called["count"] == 0


@pytest.mark.asyncio
async def test_locale_mismatch_analyze_get_results_never_serves_stale_locale_protocol(monkeypatch):
    """Same proof for GET /analyze/{upload_id} (analyze.py::get_results) —
    the two GET callers must not drift apart."""
    upload_id = str(uuid.uuid4())

    async def fake_assert_upload_belongs_to_user(_upload_id, _user_id):
        return {"id": upload_id, "user_id": FAKE_USER_ID}

    async def fake_get_biomarkers_by_upload(_upload_id, _user_id):
        return [{"name": "Hemoglobin", "value": 148.0, "unit": "g/L", "status": "ELEVATED"}]

    async def fake_get_biomarker_extraction_candidates(_upload_id, _user_id):
        return []

    async def fake_get_protocol_by_upload(_user_id, _upload_id):
        return {"recommendations": [{"title": "УКРАЇНСЬКИЙ", "body": "STALE UA TEXT"}]}

    async def fake_get_user_profile(_user_id):
        return {}

    async def fake_get_latest_report_version(_upload_id, _user_id, locale):
        assert locale == "en"
        return None

    async def fake_has_any_report_version(_upload_id, _user_id):
        return True

    async def fake_pipeline(**kwargs):
        assert kwargs["generate_ai_protocol"] is True
        return {
            "knowledge_report": {"summary": {"headline": "FRESH ENGLISH"}},
            "recommendations": [{"title": "Fresh EN", "body": "ENGLISH TEXT"}],
        }

    async def fake_write_audit_log(**_kwargs):
        return None

    async def fake_save_protocol(**_kwargs):
        raise AssertionError("must not persist over the other locale's protocols row")

    monkeypatch.setattr(analyze_router, "assert_upload_belongs_to_user", fake_assert_upload_belongs_to_user)
    monkeypatch.setattr(analyze_router, "get_biomarkers_by_upload", fake_get_biomarkers_by_upload)
    monkeypatch.setattr(analyze_router, "get_biomarker_extraction_candidates", fake_get_biomarker_extraction_candidates)
    monkeypatch.setattr(analyze_router, "get_protocol_by_upload", fake_get_protocol_by_upload)
    monkeypatch.setattr(analyze_router, "get_user_profile", fake_get_user_profile)
    monkeypatch.setattr(analyze_router, "get_latest_report_version", fake_get_latest_report_version)
    monkeypatch.setattr(analyze_router, "has_any_report_version", fake_has_any_report_version)
    monkeypatch.setattr(analyze_router, "run_lab_analysis_pipeline", fake_pipeline)
    monkeypatch.setattr(analyze_router, "save_protocol", fake_save_protocol)
    monkeypatch.setattr(analyze_router, "write_audit_log", fake_write_audit_log)

    app.dependency_overrides[get_current_user] = lambda: {"sub": FAKE_USER_ID}
    try:
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            response = await client.get(f"/analyze/{upload_id}")
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 200
    payload = response.json()
    assert payload["report_source"] == report_history.REPORT_SOURCE_LOCALE_UNAVAILABLE
    assert payload["protocol"] == [{"title": "Fresh EN", "body": "ENGLISH TEXT"}]


def test_g9_is_frozen_report_version_rejects_none_and_pending_shapes():
    assert is_frozen_report_version(None) is False
    assert is_frozen_report_version({}) is False
    assert is_frozen_report_version({"status": "needs_confirmation"}) is False
    assert is_frozen_report_version({"status": "completed"}) is True
    assert is_frozen_report_version({"status": "blocked"}) is True


# --- G10: user isolation — a report version belonging to another user 404s ------


@pytest.mark.asyncio
async def test_g10_foreign_upload_is_rejected_before_any_report_version_lookup(monkeypatch):
    upload_id = str(uuid.uuid4())

    async def fake_assert_upload_belongs_to_user(_upload_id, _user_id):
        raise HTTPException(status_code=404, detail={"detail": "Upload not found", "code": "UPLOAD_NOT_FOUND"})

    monkeypatch.setattr(analyze_router, "assert_upload_belongs_to_user", fake_assert_upload_belongs_to_user)

    app.dependency_overrides[get_current_user] = lambda: {"sub": FOREIGN_USER_ID}
    try:
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            response = await client.get(f"/analyze/{upload_id}")
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 404


def test_g10_get_latest_report_version_and_get_report_version_scope_by_user_id():
    import inspect

    from app.services import supabase_service as svc

    latest_source = inspect.getsource(svc.get_latest_report_version)
    assert '.eq("user_id", user_id)' in latest_source

    single_source = inspect.getsource(svc.get_report_version)
    assert '.eq("user_id", user_id)' in single_source


# --- G11/G12: no drift in prior-stage semantics ----------------------------------


def test_g11_g12_new_module_does_not_alter_unrelated_pipeline_functions():
    """This stage adds report_history.py and touches only the two GET routes'
    read path plus one additive explainability field at persist time — full
    behavioral coverage for Safety (Stage 2C), chronology (2D-1), check-in
    (2E), and dashboard (2F/2F.1/2F.2) is re-run as part of this stage's
    required test sweep, not duplicated here. This is a narrow smoke check
    that the persist-time change is additive only."""
    import inspect

    from app.services import lab_analysis_pipeline

    source = inspect.getsource(lab_analysis_pipeline.run_lab_analysis_pipeline)
    assert '"knowledge_evaluation": output_knowledge_evaluation' in source
    assert "evidence_gaps" in source
    assert "version_provenance" in source


def test_report_history_module_importable_and_constants_stable():
    assert report_history.REPORT_SOURCE_FROZEN == "frozen"
    assert report_history.REPORT_SOURCE_REGENERATED == "regenerated"
    assert report_history.REPORT_SOURCE_LEGACY_FALLBACK == "legacy_fallback"

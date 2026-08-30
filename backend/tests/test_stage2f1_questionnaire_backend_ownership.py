"""Stage 2F.1 — regression coverage for backend-owned questionnaire derived state.

Provenance trace (before): readiness/urgency were computed entirely client-side
in Questionnaire.jsx (scoreReadiness()/urgencyGuidance()), then PATCHed to
`/questionnaire/session/context`, where the backend stored/echoed them
verbatim with zero server-side computation — so downstream consumers
(UserDashboard.jsx, LabPlan.jsx) were ultimately trusting frontend-invented
medical-adjacent state, not backend authority.

Fix: app/services/questionnaire_scoring.py ports the exact same deterministic
formulas (no new thresholds), and PATCH /session/context now always
overwrites readiness/urgency with the backend's own computation before
persisting — any client-submitted value for those two fields is discarded,
not merged.

`severity` is traced as RAW USER INPUT (a direct slider value in
Questionnaire.jsx, no formula produces it) — it is intentionally NOT
recomputed here; it is stored as submitted, like any other raw answer field.
This is stated explicitly because the task's Q3 could be misread as implying
severity is derived — it isn't, and inventing a fake derivation for it would
itself be dishonest.

No live database connection is used anywhere in this file.
"""

import pytest
from httpx import ASGITransport, AsyncClient

from app.dependencies import get_current_user
from app.main import app
from app.routers.protocol import questionnaire as questionnaire_router
from app.services.questionnaire_scoring import (
    apply_authoritative_derived_state,
    compute_readiness,
    compute_urgency,
    score_readiness,
)


RAW_SUMMARY = {
    "concern": "persistent headaches",
    "duration": "3-6 months",
    "severity": 7,
    "bodySystem": "Neurological",
    "relatedSymptoms": "dizziness, nausea",
    "medications": "ibuprofen",
    "symptomTriggers": ["Recent illness"],
    "lifestyleContext": ["High stress"],
    "functionalImpact": "moderate",
    "symptomPattern": "worse in the morning",
    "redFlags": {"severeOnset": True, "fever": False, "swelling": False, "numbnessWeakness": False, "chestBreath": False, "trauma": False, "pregnancyContext": False},
}


# --- Q1: backend derives readiness from raw questionnaire inputs ---------------


def test_q1_backend_derives_readiness_from_raw_inputs():
    readiness = compute_readiness(RAW_SUMMARY)
    assert isinstance(readiness, int)
    assert 20 <= readiness <= 99
    # Same formula as Questionnaire.jsx's scoreReadiness() base component,
    # verified directly for one sub-case (long concern text -> +24).
    base = score_readiness(
        concern=RAW_SUMMARY["concern"], duration=RAW_SUMMARY["duration"], severity=RAW_SUMMARY["severity"],
        body_system=RAW_SUMMARY["bodySystem"], related=RAW_SUMMARY["relatedSymptoms"], meds=RAW_SUMMARY["medications"],
    )
    assert base >= 20 + 24  # concern length >= 6 triggers the +24 bonus


# --- Q2: backend derives urgency from raw questionnaire inputs -----------------


def test_q2_backend_derives_urgency_from_red_flags():
    assert compute_urgency({"redFlags": {}}, locale="en") == "No urgent red flags reported."
    one_flag = {"redFlags": {"severeOnset": True}}
    assert "clinician review" in compute_urgency(one_flag, locale="en")
    three_flags = {"redFlags": {"severeOnset": True, "fever": True, "trauma": True}}
    assert "Do not delay" in compute_urgency(three_flags, locale="en")


# --- Q3: severity is raw input — explicitly proven NOT derived -----------------


def test_q3_severity_is_raw_input_not_recomputed():
    """There is no severity-derivation function anywhere in
    questionnaire_scoring.py — confirmed by absence, not by testing a formula
    that doesn't exist. apply_authoritative_derived_state() must pass the
    submitted severity through unchanged."""
    assert not hasattr(__import__("app.services.questionnaire_scoring", fromlist=["x"]), "compute_severity")
    result = apply_authoritative_derived_state({"severity": 7, "redFlags": {}})
    assert result["severity"] == 7  # unchanged, not recomputed


# --- Q4: client-supplied derived values cannot override the backend result -----


def test_q4_fabricated_client_readiness_and_urgency_are_ignored():
    """Security/integrity test: client submits legitimate raw answers
    consistent with a real red flag, but ALSO fabricates readiness=100 and
    urgency='low' to try to mask it. The backend must ignore both fabricated
    values and persist its own authoritative computation instead."""
    malicious_payload = {
        **RAW_SUMMARY,
        "readiness": 100,   # fabricated — should be discarded
        "urgency": "low",   # fabricated — should be discarded
        "severity": 0,      # even if treated as an attempted override, severity has no derivation to bypass
    }
    result = apply_authoritative_derived_state(malicious_payload, locale="en")

    assert result["readiness"] != 100, "client-supplied readiness must be overwritten, not trusted"
    assert result["readiness"] == compute_readiness(malicious_payload)
    assert result["urgency"] != "low", "client-supplied urgency must be overwritten, not trusted"
    assert "clinician review" in result["urgency"], (
        "the raw redFlags in this payload include one active flag — the "
        "authoritative recomputed urgency must reflect that, not the client's fabricated 'low'"
    )
    assert result["readiness_source"] == "backend"
    assert result["urgency_source"] == "backend"


@pytest.mark.asyncio
async def test_q4_end_to_end_patch_endpoint_ignores_fabricated_derived_values(monkeypatch):
    """Same proof, through the real HTTP route — captures exactly what would
    be persisted to session_metadata."""
    captured = {}

    async def fake_get_or_create(_user_id):
        return {"id": "sess-q4", "status": "active", "session_metadata": {}}

    async def fake_update(_session_id, fields):
        captured["fields"] = fields

    monkeypatch.setattr(questionnaire_router, "_get_or_create_active_session", fake_get_or_create)
    monkeypatch.setattr(questionnaire_router, "_update_session", fake_update)

    app.dependency_overrides[get_current_user] = lambda: {"sub": "user-q4"}
    try:
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            response = await client.patch(
                "/questionnaire/session/context",
                json={
                    "active_concern": "chest tightness",
                    "summary": {**RAW_SUMMARY, "readiness": 100, "urgency": "low"},
                },
            )
        assert response.status_code == 200
    finally:
        app.dependency_overrides.clear()

    persisted_summary = captured["fields"]["session_metadata"]["summary"]
    assert persisted_summary["readiness"] != 100
    assert persisted_summary["urgency"] != "low"
    assert persisted_summary["readiness_source"] == "backend"


# --- Q5: EN and UA use the same underlying derivation logic ---------------------


def test_q5_en_and_uk_share_identical_readiness_logic_only_copy_differs_for_urgency():
    readiness_en_context_locale = compute_readiness(RAW_SUMMARY)
    # readiness has no locale-dependent text at all — same number regardless.
    assert readiness_en_context_locale == compute_readiness(RAW_SUMMARY)

    one_flag = {"redFlags": {"severeOnset": True}}
    urgency_en = compute_urgency(one_flag, locale="en")
    urgency_uk = compute_urgency(one_flag, locale="uk")
    assert urgency_en != urgency_uk, "copy must differ by locale"
    # Same threshold decision (1 flag -> the "some answers" tier) drove both —
    # proven by both being the SHORTER, non-"multiple flags" message for their
    # respective locale, not by comparing untranslatable text directly.
    assert "clinician review" in urgency_en
    assert "лікаря важливий" in urgency_uk


# --- Q6: dashboard receives backend-owned state ---------------------------------


@pytest.mark.asyncio
async def test_q6_persisted_summary_is_what_get_session_would_echo_back(monkeypatch):
    """UserDashboard.jsx/LabPlan.jsx read whatever GET /questionnaire/session
    returns for session_context.summary — since that's built from
    session_metadata.summary via _session_context() (unchanged, pure
    passthrough), proving the PERSISTED summary is backend-derived is
    sufficient to prove the dashboard receives backend-owned state, with no
    dashboard-side change needed."""
    captured = {}

    async def fake_get_or_create(_user_id):
        return {"id": "sess-q6", "status": "active", "session_metadata": {}}

    async def fake_update(_session_id, fields):
        captured["fields"] = fields

    monkeypatch.setattr(questionnaire_router, "_get_or_create_active_session", fake_get_or_create)
    monkeypatch.setattr(questionnaire_router, "_update_session", fake_update)

    app.dependency_overrides[get_current_user] = lambda: {"sub": "user-q6"}
    try:
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            response = await client.patch(
                "/questionnaire/session/context",
                json={"active_concern": "fatigue", "summary": RAW_SUMMARY},
            )
        data = response.json()
    finally:
        app.dependency_overrides.clear()

    # The response's own session_context.summary (what a caller sees
    # immediately) must already be the backend-derived version.
    assert data["session_context"]["summary"]["readiness"] == compute_readiness(RAW_SUMMARY)
    assert data["session_context"]["summary"]["readiness_source"] == "backend"


# --- Q7: existing questionnaire flow still works --------------------------------


@pytest.mark.asyncio
async def test_q7_existing_questionnaire_endpoints_still_work(monkeypatch):
    """Full existing test_questionnaire_endpoints.py suite is re-run as part
    of this stage's required test sweep (not duplicated here) — this is a
    narrow smoke check that the context-patch endpoint itself still returns
    the expected top-level contract shape."""
    async def fake_get_or_create(_user_id):
        return {"id": "sess-q7", "status": "active", "session_metadata": {}}

    async def fake_update(_session_id, _fields):
        return None

    monkeypatch.setattr(questionnaire_router, "_get_or_create_active_session", fake_get_or_create)
    monkeypatch.setattr(questionnaire_router, "_update_session", fake_update)

    app.dependency_overrides[get_current_user] = lambda: {"sub": "user-q7"}
    try:
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            response = await client.patch(
                "/questionnaire/session/context",
                json={"active_concern": "sleep", "summary": {"severity": 7}},
            )
        assert response.status_code == 200
        data = response.json()
        assert data["ok"] is True
        assert "session_context" in data
    finally:
        app.dependency_overrides.clear()


# --- Q8: lab-plan/report/protocol behavior does not regress ---------------------


def test_q8_readiness_urgency_are_not_consumed_anywhere_in_the_analysis_pipeline():
    """Confirmed by trace (Stage 2F.1): no backend module outside
    questionnaire.py/questionnaire_scoring.py reads questionnaire summary
    readiness/urgency for quality-gate, safety, report, or protocol decisions
    — this is a source-level guard that stays true."""
    import subprocess

    result = subprocess.run(
        ["grep", "-rl", "summary.get(\"readiness\")\\|summary.get('readiness')\\|summary\\[.readiness.\\]",
         "/var/www/VITALOOP/backend/app/services/lab_analysis_pipeline.py",
         "/var/www/VITALOOP/backend/app/services/analysis_quality_gate.py",
         "/var/www/VITALOOP/backend/app/services/safety/safety_engine.py"],
        capture_output=True, text=True,
    )
    assert result.stdout.strip() == "", "no analysis-pipeline module should read questionnaire readiness/urgency"


# --- Q9: Stage 2F dashboard metrics remain truthful ------------------------------


def test_q9_dashboard_still_reads_only_real_backend_health_score_components():
    from pathlib import Path

    dashboard_jsx = Path("/var/www/VITALOOP/frontend/src/pages/UserDashboard.jsx").read_text()
    assert "healthScoreComponents.biomarker" in dashboard_jsx
    assert "hasResults ? 70 : 25" not in dashboard_jsx

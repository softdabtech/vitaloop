"""Quality Gate UI completion — cabinet reconciliation.

Point of truth: neither current production nor origin/main's frontend ever
called GET /analyze/{upload_id}/candidates — a block_or_confirm upload was a
dead end (Upload.jsx navigated straight to /results/{upload_id}, which shows
an empty "no processed biomarkers yet" state with no way back into
confirmation, since Stage 2B's chokepoint means no canonical biomarkers were
ever persisted for a pending gate decision).

This file proves the EXISTING, already-implemented backend contract
(GET /{upload_id}/candidates, POST /{upload_id}/confirm-candidates — both
pre-dating this reconciliation, Stage 2B) round-trips correctly over real
HTTP, end to end, for both gate outcomes:
  A. auto_continue — a real upload never needs this endpoint at all.
  B. block_or_confirm -> GET candidates -> POST confirm-candidates -> the
     upload resolves to analysis_status=="completed" with real persisted
     biomarkers, exactly what Upload.jsx's new candidateReview UI depends on.

No live database connection is used anywhere in this file. No Quality Gate
semantics, scoring, or backend contract were changed to make this pass —
only the frontend's missing call to this existing endpoint was added
(see Upload.jsx's handleFile()).
"""

import uuid

import pytest
from httpx import ASGITransport, AsyncClient

from app.dependencies import get_current_user
from app.main import app
from app.routers.analysis import analyze as analyze_router
from app.services import lab_analysis_pipeline
from app.services import supabase_service as svc

FAKE_USER_ID = "33333333-3333-3333-3333-333333333333"


@pytest.fixture(autouse=True)
def _stub_historical_biomarkers(monkeypatch):
    async def _fake(_user_id):
        return []

    monkeypatch.setattr(lab_analysis_pipeline, "_load_historical_biomarkers", _fake)


@pytest.fixture(autouse=True)
def _stub_persistence(monkeypatch):
    """No live database connection in this file — mirrors
    test_stage2b_canonical_boundary.py's save_biomarkers_spy pattern, extended
    to save_report_version since confirm_upload_candidates also persists a
    report version (persist_report_version=True)."""

    async def _fake_save_biomarkers(upload_id, user_id, biomarkers):
        return [{"id": f"bm-{i}", **b} for i, b in enumerate(biomarkers)]

    async def _fake_save_report_version(**kwargs):
        return {"id": "report-v-fake", **kwargs}

    async def _fake_save_safety_events(**_kwargs):
        return []

    monkeypatch.setattr(svc, "save_biomarkers", _fake_save_biomarkers)
    monkeypatch.setattr(svc, "save_report_version", _fake_save_report_version)
    monkeypatch.setattr(svc, "save_safety_events", _fake_save_safety_events)


@pytest.mark.asyncio
async def test_a_auto_continue_never_needs_the_candidates_endpoint(monkeypatch):
    """A. A clean, high-confidence upload resolves to auto_continue on its
    own — GET /candidates is never a required step for it. Proven directly
    against the real pipeline (already covered at this layer by
    test_stage2b_canonical_boundary.py::test_auto_continue_persists_canonical_biomarkers;
    re-asserted here as the paired case for B, in the same file, for a single
    point of truth on this reconciliation item)."""
    result = await lab_analysis_pipeline.run_lab_analysis_pipeline(
        biomarkers=[
            {"name": "Glucose", "value": 92, "unit": "mg/dL", "ref_low": 70, "ref_high": 99, "status": "OPTIMAL"},
            {"name": "TSH", "value": 2.1, "unit": "mIU/L", "ref_low": 0.4, "ref_high": 4.0, "status": "OPTIMAL"},
        ],
        symptoms=["fatigue"],
        questionnaire={"completed": True},
        user_profile={
            "age": 34, "sex": "female", "height_cm": 168, "weight_kg": 62,
            "current_medications": ["none"],
        },
        user_id="user-a",
        analysis_id="upload-a",
        source_metadata={"candidates": []},
        persist_biomarkers=True,
        generate_ai_protocol=False,
    )
    assert result["analysis_input_quality_gate"]["decision"] == "auto_continue"
    assert result["analysis_status"] == "completed"


@pytest.mark.asyncio
async def test_b_block_or_confirm_get_candidates_then_confirm_reaches_completed(monkeypatch):
    """B. block_or_confirm -> GET /{upload_id}/candidates (the call
    Upload.jsx's candidateReview UI now makes) -> POST /confirm-candidates
    (the call confirmCandidateReview() makes) -> analysis_status flips to
    "completed" with real persisted biomarkers. Both HTTP calls exercised
    exactly as the frontend calls them (same routes, same request/response
    shapes) via ASGITransport — not a lower-level function call."""
    upload_id = str(uuid.uuid4())

    # Pre-confirmation state: extraction candidates exist (low confidence,
    # nothing confirmed yet), but NO canonical biomarkers — Stage 2B's
    # chokepoint means none were ever persisted for a still-pending gate
    # decision. This is the exact state a real block_or_confirm upload is in
    # when the user lands on the review UI.
    raw_candidates = [
        {
            "id": "cand-1",
            "raw_name": "Ferritin",
            "raw_value": "12",
            "raw_unit": "ng/mL",
            "raw_reference_range": "20-250",
            "ref_low": 20,
            "ref_high": 250,
            "status": "pending",
            "confidence_score": 0.35,
        },
        {
            "id": "cand-2",
            "raw_name": "Vitamin D",
            "raw_value": "18",
            "raw_unit": "ng/mL",
            "raw_reference_range": "30-100",
            "ref_low": 30,
            "ref_high": 100,
            "status": "pending",
            "confidence_score": 0.40,
        },
    ]

    async def fake_assert_upload_belongs_to_user(_upload_id, _user_id):
        return {"id": upload_id, "user_id": FAKE_USER_ID}

    async def fake_get_biomarker_extraction_candidates(_upload_id, _user_id):
        return raw_candidates

    async def fake_get_biomarkers_by_upload(_upload_id, _user_id):
        # Canonical table is empty pre-confirmation — the defining Stage 2B
        # invariant this whole flow depends on.
        return []

    async def fake_get_user_profile(_user_id):
        return {"age": 40, "sex": "female", "height_cm": 165, "weight_kg": 60, "current_medications": ["none"]}

    monkeypatch.setattr(analyze_router, "assert_upload_belongs_to_user", fake_assert_upload_belongs_to_user)
    monkeypatch.setattr(analyze_router, "get_biomarker_extraction_candidates", fake_get_biomarker_extraction_candidates)
    monkeypatch.setattr(analyze_router, "get_biomarkers_by_upload", fake_get_biomarkers_by_upload)
    monkeypatch.setattr(analyze_router, "get_user_profile", fake_get_user_profile)

    app.dependency_overrides[get_current_user] = lambda: {"sub": FAKE_USER_ID}
    try:
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            # --- Step 1: GET /{upload_id}/candidates (Upload.jsx's new call) ---
            get_resp = await client.get(f"/analyze/{upload_id}/candidates")
            assert get_resp.status_code == 200
            get_payload = get_resp.json()

            assert get_payload["upload_id"] == upload_id
            gate = get_payload["analysis_input_quality_gate"]
            assert gate["decision"] == "block_or_confirm", gate
            assert get_payload["requires_confirmation"] is True
            returned_candidates = get_payload["candidates"]
            assert len(returned_candidates) == 2
            assert {c["id"] for c in returned_candidates} == {"cand-1", "cand-2"}
            assert all(c["requires_confirmation"] for c in returned_candidates)
            # No canonical biomarkers were fabricated/persisted just by viewing this.
            assert "biomarkers" not in get_payload

            # --- Step 2: confirm/correct exactly as confirmCandidateReview() does ---
            # (Upload.jsx sends status="corrected" for kept items, "rejected" for
            # dropped ones, always including raw_name/raw_value/raw_unit corrections
            # — mirrored here verbatim from the frontend's request shape.)
            confirm_body = {
                "candidates": [
                    {
                        "id": "cand-1",
                        "status": "corrected",
                        "corrections": {"raw_name": "Ferritin", "raw_value": "12", "raw_unit": "ng/mL", "parsed_value": 12.0},
                    },
                    {
                        "id": "cand-2",
                        "status": "corrected",
                        "corrections": {"raw_name": "Vitamin D", "raw_value": "18", "raw_unit": "ng/mL", "parsed_value": 18.0},
                    },
                ],
            }

            async def fake_update_biomarker_extraction_candidates(*, upload_id, user_id, decisions):
                by_id = {c["id"]: c for c in raw_candidates}
                updated = []
                for decision in decisions:
                    base = dict(by_id[decision["id"]])
                    base["status"] = decision["status"]
                    corrections = decision.get("corrections") or {}
                    base.update({k: v for k, v in corrections.items() if v is not None})
                    updated.append(base)
                return updated

            monkeypatch.setattr(analyze_router, "update_biomarker_extraction_candidates", fake_update_biomarker_extraction_candidates)

            saved_protocol_calls = []

            async def fake_save_protocol(**kwargs):
                saved_protocol_calls.append(kwargs)
                return {"recommendations": kwargs.get("recommendations") or []}

            monkeypatch.setattr(analyze_router, "save_protocol", fake_save_protocol)

            confirm_resp = await client.post(f"/analyze/{upload_id}/confirm-candidates", json=confirm_body)

        assert confirm_resp.status_code == 200, confirm_resp.text
        confirm_payload = confirm_resp.json()

        # --- The gate now resolves once real confirmation happened ---
        assert confirm_payload["analysis_status"] == "completed", confirm_payload["analysis_input_quality_gate"]
        assert confirm_payload["analysis_input_quality_gate"]["decision"] == "auto_continue"
        saved_names = {b["name"].lower() for b in confirm_payload["biomarkers"]}
        assert saved_names == {"ferritin", "vitamin d"}
        assert confirm_payload["report_version"] is not None, "a real report_version must be persisted once confirmed"
    finally:
        app.dependency_overrides.clear()

"""Global safeguards for the isolated backend unit-test suite."""

import pytest


@pytest.fixture(autouse=True)
def _disable_live_pipeline_symptom_snapshot_lookup(monkeypatch):
    """Prevent B2C pipeline tests from reading the configured Supabase project.

    Tests that exercise canonical snapshot loading replace this stub explicitly.
    Every other unit test must provide its snapshot as fixture data, so a green
    suite never depends on network access or on production account state.
    """

    async def no_snapshot(_user_id: str):
        return None

    monkeypatch.setattr(
        "app.services.lab_analysis_pipeline.load_latest_eligible_symptom_snapshot",
        no_snapshot,
    )


@pytest.fixture(autouse=True)
def _stub_mark_lab_upload_done(monkeypatch):
    """Upload-status writes need a live database; tests that assert on them
    replace this stub explicitly."""

    async def noop(*_a, **_k):
        return None

    monkeypatch.setattr("app.services.supabase_service.mark_lab_upload_done", noop)


@pytest.fixture
def stub_post_report_persistence(monkeypatch):
    """Explicitly stubs the writes that follow a confirmed report insert, so tests
    exercising the happy path do not depend on them failing silently (a failure
    there now yields analysis_status="partial")."""

    async def noop(*_a, **_k):
        return []

    for name in ("persist_retest_obligations", "reconcile_retest_fulfillment", "reconcile_lab_plan_fulfillment", "save_safety_events"):
        monkeypatch.setattr(f"app.services.supabase_service.{name}", noop)

    async def atomic_finalization(**kwargs):
        return {
            "report_version_id": kwargs["report_version_id"],
            "replay": False,
            "generation": 1,
            "biomarkers": [dict(item) for item in kwargs["biomarkers"]],
            "input_hash": "0" * 64,
        }

    monkeypatch.setattr("app.services.supabase_service.finalize_lab_analysis", atomic_finalization)

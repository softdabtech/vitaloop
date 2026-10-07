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

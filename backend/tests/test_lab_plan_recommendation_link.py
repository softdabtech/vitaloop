import pytest

from app.services import supabase_service


class _Response:
    def __init__(self, data):
        self.data = data


class _Query:
    def __init__(self, client):
        self.client = client
        self.payload = None

    def upsert(self, payload, **_kwargs):
        self.payload = payload
        return self

    def execute(self):
        self.client.payload = self.payload
        return _Response([{"id": "plan-1", **self.payload}])


class _Client:
    def __init__(self):
        self.payload = None

    def table(self, _name):
        return _Query(self)


def _report(
    report_id="report-1",
    recommendation_id="v1:next-test:evidence_gaps:hemoglobin:0",
    recommendation_report_id=None,
):
    recommendation_report_id = recommendation_report_id or report_id
    return {
        "id": report_id,
        "input_snapshot": {
            "next_best_tests": {
                "recommended_tests": [{
                    "marker": "hemoglobin",
                    "recommendation_id": recommendation_id,
                    "source_report_version_id": recommendation_report_id,
                    "reason": "Clarify iron status.",
                    "priority": "high",
                }]
            },
            "evidence_gaps": {"gaps": []},
        },
        "knowledge_report": {"retest_plan": []},
    }


@pytest.mark.asyncio
async def test_lab_plan_persists_exact_recommendation_link(monkeypatch):
    client = _Client()
    monkeypatch.setattr(supabase_service, "_get_supabase", lambda: client)

    async def get_report(_user_id, _report_id):
        return _report()

    monkeypatch.setattr(supabase_service, "get_report_version_for_user", get_report)

    result = await supabase_service.create_lab_plan_item(
        user_id="user-1",
        report_version_id="report-1",
        test_name="Hemoglobin",
        source_recommendation_id="v1:next-test:evidence_gaps:hemoglobin:0",
    )

    assert result["source_report_version_id"] == "report-1"
    assert result["source_recommendation_id"] == "v1:next-test:evidence_gaps:hemoglobin:0"
    assert result["normalized_test_name"] == "hemoglobin"
    assert result["test_type"] == "new_test"


@pytest.mark.asyncio
async def test_lab_plan_rejects_recommendation_from_another_report(monkeypatch):
    async def get_report(_user_id, _report_id):
        return _report(
            recommendation_report_id="report-2"
        )

    monkeypatch.setattr(supabase_service, "get_report_version_for_user", get_report)

    with pytest.raises(ValueError, match="does not belong"):
        await supabase_service.create_lab_plan_item(
            user_id="user-1",
            report_version_id="report-1",
            test_name="Hemoglobin",
            source_recommendation_id="v1:next-test:evidence_gaps:hemoglobin:0",
        )


@pytest.mark.asyncio
async def test_lab_plan_rejects_recommendation_name_mismatch(monkeypatch):
    async def get_report(_user_id, _report_id):
        return _report()

    monkeypatch.setattr(supabase_service, "get_report_version_for_user", get_report)

    with pytest.raises(ValueError, match="does not match test"):
        await supabase_service.create_lab_plan_item(
            user_id="user-1",
            report_version_id="report-1",
            test_name="Ferritin",
            source_recommendation_id="v1:next-test:evidence_gaps:hemoglobin:0",
        )


@pytest.mark.asyncio
async def test_legacy_lab_plan_creation_keeps_marker_fallback(monkeypatch):
    client = _Client()
    monkeypatch.setattr(supabase_service, "_get_supabase", lambda: client)

    async def get_report(_user_id, _report_id):
        return _report(recommendation_id=None)

    monkeypatch.setattr(supabase_service, "get_report_version_for_user", get_report)

    result = await supabase_service.create_lab_plan_item(
        user_id="user-1",
        report_version_id="report-1",
        test_name="Hemoglobin",
    )

    assert result["source_recommendation_id"] is None
    assert result["normalized_test_name"] == "hemoglobin"

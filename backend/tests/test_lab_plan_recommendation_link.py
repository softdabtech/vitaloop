import pytest

from app.services import supabase_service


class _Response:
    def __init__(self, data):
        self.data = data


class _Query:
    def __init__(self, client):
        self.client = client
        self.payload = None
        self.operation = "select"
        self.filters = []

    def upsert(self, payload, **_kwargs):
        self.operation = "upsert"
        self.payload = payload
        return self

    def select(self, *_columns):
        self.operation = "select"
        return self

    def eq(self, key, value):
        self.filters.append((key, value))
        return self

    def update(self, payload):
        self.operation = "update"
        self.payload = payload
        return self

    def limit(self, _count):
        return self

    def order(self, *_args, **_kwargs):
        return self

    def execute(self):
        rows = [
            row for row in self.client.rows
            if all(row.get(key) == value for key, value in self.filters)
        ]
        if self.operation == "select":
            return _Response(rows)
        self.client.payload = self.payload
        if self.operation == "update":
            for row in rows:
                row.update(self.payload)
            return _Response(rows)
        return _Response([{"id": "plan-1", **self.payload}])


class _Client:
    def __init__(self, rows=None):
        self.payload = None
        self.rows = list(rows or [])

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


def _mch_report(report_id="report-1"):
    report = _report(
        report_id=report_id,
        recommendation_id="v1:next-test:evidence_gaps:mch:3",
    )
    report["input_snapshot"]["next_best_tests"]["recommended_tests"][0].update({
        "marker": "mch",
        "canonical_marker": "mch",
    })
    report["knowledge_report"]["retest_plan"] = [{
        "marker": "Mean Corpuscular Hemoglobin",
        "reason": "Trend after clinical review.",
        "priority": "high",
        "canonical_marker": "mch",
    }]
    return report


@pytest.mark.asyncio
async def test_lab_plan_canonicalizes_mch_aliases_and_reuses_exact_first(monkeypatch):
    client = _Client()
    monkeypatch.setattr(supabase_service, "_get_supabase", lambda: client)

    async def get_report(_user_id, _report_id):
        return _mch_report()

    monkeypatch.setattr(supabase_service, "get_report_version_for_user", get_report)

    exact = await supabase_service.create_lab_plan_item(
        user_id="user-1",
        report_version_id="report-1",
        test_name="mch",
        source_recommendation_id="v1:next-test:evidence_gaps:mch:3",
    )
    client.rows = [exact]
    alias = await supabase_service.create_lab_plan_item(
        user_id="user-1",
        report_version_id="report-1",
        test_name="Mean Corpuscular Hemoglobin",
    )

    assert exact["normalized_test_name"] == "mch"
    assert alias["id"] == exact["id"]
    assert alias["source_recommendation_id"] == "v1:next-test:evidence_gaps:mch:3"


@pytest.mark.asyncio
async def test_lab_plan_canonicalizes_mch_aliases_and_links_alias_first(monkeypatch):
    client = _Client()
    monkeypatch.setattr(supabase_service, "_get_supabase", lambda: client)

    async def get_report(_user_id, _report_id):
        return _mch_report()

    monkeypatch.setattr(supabase_service, "get_report_version_for_user", get_report)

    alias = await supabase_service.create_lab_plan_item(
        user_id="user-1",
        report_version_id="report-1",
        test_name="Mean Corpuscular Hemoglobin",
    )
    client.rows = [alias]
    exact = await supabase_service.create_lab_plan_item(
        user_id="user-1",
        report_version_id="report-1",
        test_name="mch",
        source_recommendation_id="v1:next-test:evidence_gaps:mch:3",
    )

    assert alias["normalized_test_name"] == "mch"
    assert exact["id"] == alias["id"]
    assert exact["source_recommendation_id"] == "v1:next-test:evidence_gaps:mch:3"


@pytest.mark.asyncio
async def test_lab_plan_keeps_unrelated_markers_separate(monkeypatch):
    client = _Client()
    monkeypatch.setattr(supabase_service, "_get_supabase", lambda: client)

    async def get_report(_user_id, _report_id):
        report = _mch_report()
        report["input_snapshot"]["next_best_tests"]["recommended_tests"].append({
            "marker": "ferritin",
            "recommendation_id": "v1:next-test:evidence_gaps:ferritin:4",
            "source_report_version_id": "report-1",
        })
        return report

    monkeypatch.setattr(supabase_service, "get_report_version_for_user", get_report)

    mch = await supabase_service.create_lab_plan_item(
        user_id="user-1",
        report_version_id="report-1",
        test_name="mch",
        source_recommendation_id="v1:next-test:evidence_gaps:mch:3",
    )
    client.rows = [mch]
    ferritin = await supabase_service.create_lab_plan_item(
        user_id="user-1",
        report_version_id="report-1",
        test_name="ferritin",
        source_recommendation_id="v1:next-test:evidence_gaps:ferritin:4",
    )

    assert ferritin["id"] != mch["id"]
    assert ferritin["normalized_test_name"] == "ferritin"


@pytest.mark.asyncio
async def test_lab_plan_unknown_aliases_do_not_collapse(monkeypatch):
    client = _Client()
    monkeypatch.setattr(supabase_service, "_get_supabase", lambda: client)

    async def get_report(_user_id, _report_id):
        return {
            "id": "report-1",
            "input_snapshot": {
                "next_best_tests": {
                    "recommended_tests": [
                        {"marker": "unknown marker one", "reason": "One"},
                        {"marker": "unknown marker two", "reason": "Two"},
                    ]
                },
                "evidence_gaps": {"gaps": []},
            },
            "knowledge_report": {"retest_plan": []},
        }

    monkeypatch.setattr(supabase_service, "get_report_version_for_user", get_report)

    first = await supabase_service.create_lab_plan_item(
        user_id="user-1",
        report_version_id="report-1",
        test_name="unknown marker one",
    )
    client.rows = [first]
    second = await supabase_service.create_lab_plan_item(
        user_id="user-1",
        report_version_id="report-1",
        test_name="unknown marker two",
    )

    assert first["normalized_test_name"] != second["normalized_test_name"]


@pytest.mark.asyncio
async def test_legacy_lab_plan_rows_expose_canonical_identity_without_rewrite(monkeypatch):
    client = _Client([{
        "id": "legacy-1",
        "user_id": "user-1",
        "normalized_test_name": "mean corpuscular hemoglobin",
    }])
    monkeypatch.setattr(supabase_service, "_get_supabase", lambda: client)

    result = await supabase_service.get_lab_plan_items("user-1")

    assert result[0]["normalized_test_name"] == "mean corpuscular hemoglobin"
    assert result[0]["canonical_normalized_test_name"] == "mch"

from datetime import date

import pytest

from app.services import supabase_service


class _FakeQuery:
    def __init__(self, client, table):
        self.client = client
        self.table = table
        self.filters = []
        self.in_filters = {}
        self.payload = None

    def select(self, *_args):
        return self

    def eq(self, key, value):
        self.filters.append((key, value))
        return self

    def in_(self, key, values):
        self.in_filters[key] = {str(value) for value in values}
        return self

    def update(self, payload):
        self.payload = payload
        return self

    def execute(self):
        rows = self.client.rows[self.table]

        def matches(row):
            return all(str(row.get(key)) == str(value) for key, value in self.filters) and all(
                str(row.get(key)) in values for key, values in self.in_filters.items()
            )

        matched = [row for row in rows if matches(row)]
        if self.payload is not None:
            for row in matched:
                row.update(self.payload)
        return type("Response", (), {"data": [dict(row) for row in matched]})()


class _FakeClient:
    def __init__(self, rows, report_versions):
        self.rows = {
            "intervention_events": rows,
            "report_versions": report_versions,
        }

    def table(self, name):
        return _FakeQuery(self, name)


def _obligation(target="Ferritin", *, status="pending"):
    return {
        "id": f"obligation-{target.lower()}",
        "user_id": "user-1",
        "action_type": "retest",
        "fulfillment_status": status,
        "related_recommendation_id": target,
        "source_report_version_id": "source-1",
        "retest_window_start": "2026-02-01",
        "retest_window_end": "2026-03-01",
        "fulfilled_by_upload_id": None,
        "fulfilled_by_report_version_id": None,
        "fulfilled_at": None,
    }


def _report(report_id="report-2", *, created_at="2026-02-15T12:00:00+00:00"):
    return {"id": report_id, "upload_id": f"upload-{report_id}", "created_at": created_at}


def _install_fake(monkeypatch, rows):
    client = _FakeClient(rows, [{"id": "source-1", "created_at": "2026-01-01T12:00:00+00:00"}])
    monkeypatch.setattr(supabase_service, "_get_supabase", lambda: client)
    return client


@pytest.mark.asyncio
@pytest.mark.parametrize(
    ("biomarkers", "test_date", "date_source", "date_confidence", "should_fulfill"),
    [
        ([{"name": "Ferritin"}], date(2026, 2, 15), "extracted_test_date", "high", True),
        ([{"name": "Hemoglobin"}], date(2026, 2, 15), "extracted_test_date", "high", False),
        ([{"name": "Ferritin"}], None, "missing", "low", False),
        ([{"name": "Ferritin"}], date(2026, 2, 15), "extracted_reported_at", "high", False),
        ([{"name": "Ferritin"}], date(2026, 1, 31), "extracted_test_date", "high", False),
        ([{"name": "Ferritin"}], date(2026, 3, 2), "extracted_test_date", "high", False),
    ],
)
async def test_retest_fulfillment_requires_locked_match(
    monkeypatch, biomarkers, test_date, date_source, date_confidence, should_fulfill
):
    client = _install_fake(monkeypatch, [_obligation()])

    result = await supabase_service.reconcile_retest_fulfillment(
        user_id="user-1",
        report_version=_report(),
        biomarkers=biomarkers,
        test_date=test_date,
        date_source=date_source,
        date_confidence=date_confidence,
    )

    assert bool(result) is should_fulfill
    assert (client.rows["intervention_events"][0]["fulfillment_status"] == "fulfilled") is should_fulfill


@pytest.mark.asyncio
async def test_retest_fulfillment_is_idempotent_and_immutable(monkeypatch):
    client = _install_fake(monkeypatch, [_obligation()])
    first = await supabase_service.reconcile_retest_fulfillment(
        user_id="user-1",
        report_version=_report(),
        biomarkers=[{"canonical_name": "canonical_ferritin"}],
        test_date=date(2026, 2, 15),
        date_source="extracted_collected_at",
        date_confidence="medium",
    )
    first_fulfillment = dict(client.rows["intervention_events"][0])
    second = await supabase_service.reconcile_retest_fulfillment(
        user_id="user-1",
        report_version=_report("report-3", created_at="2026-02-20T12:00:00+00:00"),
        biomarkers=[{"name": "Ferritin"}],
        test_date=date(2026, 2, 20),
        date_source="user_provided",
        date_confidence="high",
    )

    assert len(first) == 1
    assert second == []
    assert client.rows["intervention_events"][0] == first_fulfillment


@pytest.mark.asyncio
async def test_retest_fulfillment_handles_multiple_markers(monkeypatch):
    rows = [_obligation("Ferritin"), _obligation("Hemoglobin")]
    client = _install_fake(monkeypatch, rows)
    report = _report()

    result = await supabase_service.reconcile_retest_fulfillment(
        user_id="user-1",
        report_version=report,
        biomarkers=[{"name": "Ferritin"}, {"name": "Hemoglobin"}],
        test_date=date(2026, 2, 15),
        date_source="extracted_test_date",
        date_confidence="high",
    )

    assert {row["related_recommendation_id"] for row in result} == {"Ferritin", "Hemoglobin"}
    assert all(row["fulfillment_status"] == "fulfilled" for row in client.rows["intervention_events"])
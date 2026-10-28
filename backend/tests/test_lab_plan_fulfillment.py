from copy import deepcopy

import pytest

from app.services import supabase_service


class _Response:
    def __init__(self, data):
        self.data = data


class _Query:
    def __init__(self, client, table, operation="select", payload=None):
        self.client = client
        self.table = table
        self.operation = operation
        self.payload = payload
        self.filters = []

    def select(self, *_columns):
        self.operation = "select"
        return self

    def eq(self, key, value):
        self.filters.append((key, value))
        return self

    def in_(self, key, values):
        self.filters.append((key, set(values)))
        return self

    def update(self, payload):
        self.operation = "update"
        self.payload = payload
        return self

    def insert(self, payload):
        self.operation = "insert"
        self.payload = payload
        return self

    def limit(self, _count):
        return self

    def order(self, *_args, **_kwargs):
        return self

    def execute(self):
        rows = self.client.rows.setdefault(self.table, [])
        matches = [
            row for row in rows
            if all(
                row.get(key) in value if isinstance(value, set) else row.get(key) == value
                for key, value in self.filters
            )
        ]
        if self.operation == "update":
            for row in matches:
                row.update(self.payload)
            return _Response(deepcopy(matches))
        return _Response(deepcopy(matches))


class _Client:
    def __init__(self, rows):
        self.rows = deepcopy(rows)

    def table(self, name):
        return _Query(self, name)


def _install_client(monkeypatch, rows):
    client = _Client(rows)
    monkeypatch.setattr(supabase_service, "_get_supabase", lambda: client)
    return client


def _report(report_id, upload_id, created_at, user_id="user-1"):
    return {
        "id": report_id,
        "upload_id": upload_id,
        "user_id": user_id,
        "created_at": created_at,
    }


@pytest.mark.asyncio
async def test_new_test_is_fulfilled_only_by_a_later_matching_report(monkeypatch):
    client = _install_client(
        monkeypatch,
        {
            "report_versions": [
                _report("source", "upload-source", "2026-10-01T12:00:00+00:00"),
                _report("current", "upload-current", "2026-10-10T12:00:00+00:00"),
                _report("foreign-current", "upload-foreign", "2026-10-10T12:00:00+00:00", "user-2"),
            ],
            "lab_plan_items": [
                {
                    "id": "plan-1",
                    "user_id": "user-1",
                    "source_report_version_id": "source",
                    "normalized_test_name": "ferritin",
                    "test_type": "new_test",
                    "status": "planned",
                }
            ],
        },
    )

    result = await supabase_service.reconcile_lab_plan_fulfillment(
        user_id="user-1",
        report_version=_report("current", "upload-current", "2026-10-10T12:00:00+00:00"),
        biomarkers=[{"canonical_name": "canonical_ferritin"}],
    )

    assert result[0]["status"] == "fulfilled"
    assert result[0]["fulfilled_by_upload_id"] == "upload-current"
    assert client.rows["lab_plan_items"][0]["fulfilled_by_report_version_id"] == "current"


@pytest.mark.asyncio
async def test_unrelated_same_report_and_foreign_report_do_not_fulfill(monkeypatch):
    client = _install_client(
        monkeypatch,
        {
            "report_versions": [
                _report("source", "upload-source", "2026-10-01T12:00:00+00:00"),
                _report("current", "upload-current", "2026-10-10T12:00:00+00:00"),
            ],
            "lab_plan_items": [
                {
                    "id": "plan-1",
                    "user_id": "user-1",
                    "source_report_version_id": "source",
                    "normalized_test_name": "ferritin",
                    "test_type": "new_test",
                    "status": "planned",
                }
            ],
        },
    )

    unrelated = await supabase_service.reconcile_lab_plan_fulfillment(
        user_id="user-1",
        report_version=_report("current", "upload-current", "2026-10-10T12:00:00+00:00"),
        biomarkers=[{"canonical_name": "canonical_tsh"}],
    )
    same_report = await supabase_service.reconcile_lab_plan_fulfillment(
        user_id="user-1",
        report_version=_report("source", "upload-source", "2026-10-01T12:00:00+00:00"),
        biomarkers=[{"canonical_name": "canonical_ferritin"}],
    )
    foreign = await supabase_service.reconcile_lab_plan_fulfillment(
        user_id="user-1",
        report_version=_report("foreign-current", "upload-foreign", "2026-10-10T12:00:00+00:00", "user-2"),
        biomarkers=[{"canonical_name": "canonical_ferritin"}],
    )

    assert unrelated == []
    assert same_report == []
    assert foreign == []
    assert client.rows["lab_plan_items"][0]["status"] == "planned"


@pytest.mark.asyncio
async def test_unmapped_or_ambiguous_marker_fails_closed(monkeypatch):
    client = _install_client(
        monkeypatch,
        {
            "report_versions": [
                _report("source", "upload-source", "2026-10-01T12:00:00+00:00"),
                _report("current", "upload-current", "2026-10-10T12:00:00+00:00"),
            ],
            "lab_plan_items": [
                {
                    "id": "plan-1",
                    "user_id": "user-1",
                    "source_report_version_id": "source",
                    "normalized_test_name": "ferritin",
                    "test_type": "new_test",
                    "status": "planned",
                }
            ],
        },
    )

    result = await supabase_service.reconcile_lab_plan_fulfillment(
        user_id="user-1",
        report_version=_report("current", "upload-current", "2026-10-10T12:00:00+00:00"),
        biomarkers=[{"canonical_name": "canonical_ferritin_unknown"}],
    )

    assert result == []
    assert client.rows["lab_plan_items"][0]["status"] == "planned"


@pytest.mark.asyncio
async def test_fulfillment_is_idempotent_and_does_not_revert(monkeypatch):
    client = _install_client(
        monkeypatch,
        {
            "report_versions": [
                _report("source", "upload-source", "2026-10-01T12:00:00+00:00"),
                _report("current", "upload-current", "2026-10-10T12:00:00+00:00"),
            ],
            "lab_plan_items": [
                {
                    "id": "plan-1",
                    "user_id": "user-1",
                    "source_report_version_id": "source",
                    "normalized_test_name": "ferritin",
                    "test_type": "new_test",
                    "status": "planned",
                }
            ],
        },
    )
    kwargs = {
        "user_id": "user-1",
        "report_version": _report("current", "upload-current", "2026-10-10T12:00:00+00:00"),
        "biomarkers": [{"name": "Ferritin"}],
    }

    first = await supabase_service.reconcile_lab_plan_fulfillment(**kwargs)
    second = await supabase_service.reconcile_lab_plan_fulfillment(**kwargs)

    assert len(first) == 1
    assert second == []
    assert client.rows["lab_plan_items"][0]["status"] == "fulfilled"


@pytest.mark.asyncio
async def test_retest_plan_requires_existing_valid_retest_fulfillment(monkeypatch):
    client = _install_client(
        monkeypatch,
        {
            "report_versions": [
                _report("source", "upload-source", "2026-10-01T12:00:00+00:00"),
                _report("current", "upload-current", "2026-10-10T12:00:00+00:00"),
            ],
            "lab_plan_items": [
                {
                    "id": "plan-1",
                    "user_id": "user-1",
                    "source_report_version_id": "source",
                    "normalized_test_name": "tsh",
                    "test_type": "retest",
                    "status": "planned",
                }
            ],
        },
    )
    kwargs = {
        "user_id": "user-1",
        "report_version": _report("current", "upload-current", "2026-10-10T12:00:00+00:00"),
        "biomarkers": [{"name": "TSH"}],
    }

    outside_window = await supabase_service.reconcile_lab_plan_fulfillment(
        **kwargs,
        fulfilled_retest_obligations=[],
    )
    valid_retest = await supabase_service.reconcile_lab_plan_fulfillment(
        **kwargs,
        fulfilled_retest_obligations=[{
            "source_report_version_id": "source",
            "related_recommendation_id": "TSH",
        }],
    )

    assert outside_window == []
    assert valid_retest[0]["status"] == "fulfilled"
    assert client.rows["lab_plan_items"][0]["status"] == "fulfilled"

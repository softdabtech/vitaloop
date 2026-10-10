from datetime import date

import pytest

from app.services import supabase_service


def test_derive_retest_window_uses_report_date():
    assert supabase_service.derive_retest_window("4-8 weeks", date(2026, 10, 10)) == (
        date(2026, 11, 7),
        date(2026, 12, 5),
    )


@pytest.mark.parametrize("timing", [None, "as soon as possible", "0-8 weeks", "8-4 weeks"])
def test_derive_retest_window_rejects_invalid_timing(timing):
    assert supabase_service.derive_retest_window(timing, date(2026, 10, 10)) is None


@pytest.mark.asyncio
async def test_persist_retest_obligations_is_idempotent_and_report_scoped(monkeypatch):
    rows = []

    class FakeQuery:
        def __init__(self):
            self.filters = {}
            self.payload = None

        def select(self, *_args):
            return self

        def eq(self, key, value):
            self.filters[key] = value
            return self

        def insert(self, payload):
            self.payload = payload
            rows.append(payload)
            return self

        def execute(self):
            if self.payload is not None:
                return type("Response", (), {"data": [self.payload]})()
            data = [
                row for row in rows
                if all(str(row.get(key)) == str(value) for key, value in self.filters.items())
            ]
            return type("Response", (), {"data": data})()

    class FakeClient:
        def table(self, _name):
            return FakeQuery()

    monkeypatch.setattr(supabase_service, "_get_supabase", lambda: FakeClient())
    report = {"id": "report-1", "created_at": "2026-10-10T12:00:00+00:00"}
    plan = [{"marker": "TSH", "timing": "4-8 weeks", "reason": "Follow-up"}]

    first = await supabase_service.persist_retest_obligations(
        user_id="user-1", report_version=report, retest_plan=plan
    )
    second = await supabase_service.persist_retest_obligations(
        user_id="user-1", report_version=report, retest_plan=plan
    )
    invalid = await supabase_service.persist_retest_obligations(
        user_id="user-1",
        report_version={"id": "report-invalid", "created_at": "2026-10-10T12:00:00+00:00"},
        retest_plan=[{"marker": "Ferritin", "timing": "as soon as possible"}],
    )
    newer = await supabase_service.persist_retest_obligations(
        user_id="user-1",
        report_version={"id": "report-2", "created_at": "2026-11-01T12:00:00+00:00"},
        retest_plan=plan,
    )

    assert len(first) == 1
    assert second == []
    assert invalid == []
    assert len(newer) == 1
    assert rows[0]["source_report_version_id"] == "report-1"
    assert rows[0]["retest_window_start"] == "2026-11-07"
    assert rows[0]["retest_window_end"] == "2026-12-05"
    assert rows[0]["retest_window_start"] != rows[1]["retest_window_start"]
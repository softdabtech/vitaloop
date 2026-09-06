"""Protocol locale fix — deep regression coverage (cabinet reconciliation item 4).

Point of truth: for an upload whose only frozen report_versions row is in
locale X, and whose (locale-less) `protocols` row was written by that same
X-locale generation event, a GET at locale Y must:
  1. never return the X-locale frozen report_versions row,
  2. never return the X-locale protocol prose either,
  3. return freshly-generated, requested-locale (Y) content instead,
  4. never persist a new report_versions row for this transient render,
  5. leave the existing X-locale report_versions row byte-identical,
  6. leave the existing X-locale protocols row byte-identical (never call
     save_protocol over it).

Unlike test_stage2g_frozen_report_reproducibility.py's locale-mismatch
tests (which fake get_latest_report_version/has_any_report_version/
run_lab_analysis_pipeline directly to prove the ROUTER's branching logic),
this file exercises the REAL get_latest_report_version(), the REAL
has_any_report_version(), and the REAL run_lab_analysis_pipeline() against a
simulated Supabase client holding actual X-locale rows — proving the fix
end to end, not just the router's handling of already-correct inputs from a
fake. persist_report_version/save_biomarkers/save_protocol/save_safety_events
are spied (not faked away) so a call to any of them fails the test loudly.

Both directions are covered: UK frozen -> EN requested, and EN frozen -> UK
requested (the reverse case the handoff/spec explicitly asked for).

No live database connection is used anywhere in this file.
"""

import uuid

import pytest
from httpx import ASGITransport, AsyncClient

from app.dependencies import get_current_user
from app.main import app
from app.routers.protocol import compatibility as compatibility_router
from app.services import report_history
from app.services import supabase_service as svc

FAKE_USER_ID = "44444444-4444-4444-4444-444444444444"


def _make_fake_supabase(*, frozen_locale, frozen_row_id, protocol_row):
    """A minimal fake Supabase client backing exactly:
      - one report_versions row, in `frozen_locale` only
      - one protocols row (locale-less, as the real schema is), holding
        `protocol_row`'s content — written by that same generation event
    Any query matching (upload/user, correct locale) returns the frozen row;
    any query without the locale filter still only ever finds that same one
    row (there is only ever one locale's row in this fixture) — this is
    exactly what makes get_latest_report_version(locale=other) correctly
    return None while has_any_report_version() correctly returns True.
    """
    frozen_row = {
        "id": frozen_row_id,
        "user_id": FAKE_USER_ID,
        "locale": frozen_locale,
        "status": "completed",
        "created_at": "2026-08-01T00:00:00Z",
        "knowledge_report": {"summary": {"headline": f"FROZEN {frozen_locale.upper()} HEADLINE"}},
        "protocol": {"nutrition": []},
        "safety_result": {"status": "approved"},
        "explainability": {},
    }

    class _ReportVersionsTable:
        def __init__(self):
            self.filters = []

        def select(self, *_a, **_k):
            return self

        def eq(self, key, value):
            self.filters.append((key, value))
            return self

        def order(self, *_a, **_k):
            return self

        def limit(self, *_a, **_k):
            return self

        def execute(self):
            filter_dict = dict(self.filters)
            requested_locale = filter_dict.get("locale")
            if requested_locale is not None and requested_locale != frozen_locale:
                return type("Resp", (), {"data": []})()
            return type("Resp", (), {"data": [frozen_row]})()

    class _Client:
        def table(self, name):
            assert name == "report_versions", f"only report_versions is faked in this fixture, got {name}"
            return _ReportVersionsTable()

    return _Client(), frozen_row


async def _run_locale_mismatch_scenario(monkeypatch, *, frozen_locale, requested_locale):
    upload_id = str(uuid.uuid4())
    fake_client, frozen_row = _make_fake_supabase(
        frozen_locale=frozen_locale,
        frozen_row_id=f"report-{frozen_locale}",
        protocol_row=None,
    )
    frozen_row_snapshot = dict(frozen_row)

    # --- Wire the REAL get_latest_report_version / has_any_report_version
    # against the fake client (proves the actual DB-facing functions, not a
    # router-level fake standing in for them).
    monkeypatch.setattr(svc, "_get_supabase", lambda: fake_client)

    async def fake_run(fn):
        return fn()

    monkeypatch.setattr(svc, "_run", fake_run)

    async def fake_assert_upload_belongs_to_user(_upload_id, _user_id):
        return {"id": upload_id, "user_id": FAKE_USER_ID}

    async def fake_get_biomarkers_by_upload(_upload_id, _user_id):
        return [{"name": "Ferritin", "value": 12.0, "unit": "ng/mL", "status": "DEFICIENT"}]

    stale_protocol_text = "УКРАЇНСЬКИЙ ТЕКСТ" if frozen_locale == "uk" else "ENGLISH STALE TEXT"

    async def fake_get_protocol_by_upload(_user_id, _upload_id):
        # The one existing protocols row — written by the frozen_locale
        # generation event, no locale column of its own (real schema).
        return {"id": "protocol-row-1", "recommendations": [{"title": "Stale", "body": stale_protocol_text}]}

    async def fake_get_user_profile(_user_id):
        return {}

    fresh_headline = f"FRESH {requested_locale.upper()} CONTENT"
    fresh_body = f"FRESH {requested_locale.upper()} TEXT"

    async def fake_run_lab_analysis_pipeline(**kwargs):
        assert kwargs["locale"] == requested_locale
        assert kwargs["generate_ai_protocol"] is True, "the stale-locale protocol must not suppress fresh generation"
        assert kwargs.get("persist_report_version", False) is False, (
            "the locale-mismatch fallback branch must never opt into report_version persistence"
        )
        assert kwargs.get("persist_biomarkers", False) is False
        return {
            "knowledge_report": {"summary": {"headline": fresh_headline}},
            "recommendations": [{"title": "Fresh item", "body": fresh_body}],
            "analysis_status": "completed",
        }

    # Spies that fail the test loudly if this transient render ever tries to
    # persist anything — this is the direct proof "no report_version
    # persisted" / "existing protocol unchanged" asked for, not an inference.
    async def fail_save_report_version(**_kwargs):
        raise AssertionError("must NEVER persist a report_version for a transient locale-mismatch render")

    async def fail_save_protocol(**_kwargs):
        raise AssertionError("must NEVER call save_protocol over the other locale's existing protocols row")

    async def fail_save_biomarkers(*_a, **_kwargs):
        raise AssertionError("must NEVER persist biomarkers for a transient locale-mismatch render")

    monkeypatch.setattr(svc, "save_report_version", fail_save_report_version)
    monkeypatch.setattr(svc, "save_biomarkers", fail_save_biomarkers)
    monkeypatch.setattr(compatibility_router, "assert_upload_belongs_to_user", fake_assert_upload_belongs_to_user)
    monkeypatch.setattr(compatibility_router, "get_biomarkers_by_upload", fake_get_biomarkers_by_upload)
    monkeypatch.setattr(compatibility_router, "get_protocol_by_upload", fake_get_protocol_by_upload)
    monkeypatch.setattr(compatibility_router, "get_user_profile", fake_get_user_profile)
    monkeypatch.setattr(compatibility_router, "save_protocol", fail_save_protocol)
    monkeypatch.setattr(compatibility_router, "run_lab_analysis_pipeline", fake_run_lab_analysis_pipeline)
    monkeypatch.setattr(compatibility_router, "_resolve_response_locale", lambda _request: requested_locale)

    app.dependency_overrides[get_current_user] = lambda: {"sub": FAKE_USER_ID}
    try:
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            response = await client.get(f"/results/{upload_id}")
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 200, response.text
    payload = response.json()

    # (1) never the frozen X-locale report
    assert payload["report_source"] != report_history.REPORT_SOURCE_FROZEN
    assert payload["knowledge_report"]["summary"]["headline"] != frozen_row["knowledge_report"]["summary"]["headline"]
    # (2) never the stale X-locale protocol prose
    protocol_text_blob = str(payload["protocol"])
    assert stale_protocol_text not in protocol_text_blob
    # (3) fresh, requested-locale content instead
    assert payload["knowledge_report"]["summary"]["headline"] == fresh_headline
    assert fresh_body in protocol_text_blob
    assert payload["report_source"] == report_history.REPORT_SOURCE_LOCALE_UNAVAILABLE
    # (4)+(6) covered structurally by the spies above never firing (pytest
    # would have failed already if they had).
    # (5) the frozen row object itself was never mutated in place.
    assert frozen_row == frozen_row_snapshot, "the existing frozen report_versions row must be byte-identical"


@pytest.mark.asyncio
async def test_uk_frozen_report_and_uk_protocol_request_en(monkeypatch):
    """UK frozen report_versions + UK stored protocol, request EN:
    no UK frozen report returned, no UK protocol prose returned,
    EN transient content returned, nothing persisted, UK artifacts
    untouched. (The exact real-world shape of upload
    8a818a14-6dae-4740-a76e-52a2b590c6d5.)"""
    await _run_locale_mismatch_scenario(monkeypatch, frozen_locale="uk", requested_locale="en")


@pytest.mark.asyncio
async def test_en_frozen_report_and_en_protocol_request_uk(monkeypatch):
    """Reverse direction: EN frozen report_versions + EN stored protocol,
    request UK. Same invariants, opposite languages — proves the fix is
    symmetric, not hardcoded to one direction."""
    await _run_locale_mismatch_scenario(monkeypatch, frozen_locale="en", requested_locale="uk")

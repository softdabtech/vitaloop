from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest

from app.routers.protocol import compatibility
from app.services import supabase_service as svc


@pytest.mark.asyncio
async def test_get_results_exposes_owned_upload_lab_name_and_verified_measurement_date(monkeypatch):
    upload = {
        "id": "upload-1",
        "user_id": "user-1",
        "lab_name": "Гілевич (8).pdf",
        "created_at": "2026-10-15T12:00:00Z",
        "test_date": "2022-01-04",
    }

    monkeypatch.setattr(compatibility, "assert_upload_belongs_to_user", AsyncMock(return_value=upload))
    monkeypatch.setattr(compatibility, "get_biomarkers_by_upload", AsyncMock(return_value=[]))
    monkeypatch.setattr(compatibility, "get_user_profile", AsyncMock(return_value={}))
    monkeypatch.setattr(compatibility, "get_protocol_by_upload", AsyncMock(return_value=None))
    monkeypatch.setattr(compatibility, "get_latest_report_version", AsyncMock(return_value={
        "id": "report-1",
        "status": "completed",
    }))
    monkeypatch.setattr(compatibility, "is_frozen_report_version", lambda report: True)
    monkeypatch.setattr(compatibility, "assemble_frozen_response", lambda **_: {
        "upload_id": "upload-1",
        "final_analysis": {},
    })
    monkeypatch.setattr(compatibility, "_resolve_response_locale", lambda _request: "en")

    response = await compatibility.get_results_by_upload(
        "upload-1",
        SimpleNamespace(headers={}),
        {"sub": "user-1"},
    )

    assert response["upload"] == {"lab_name": "Гілевич (8).pdf", "measurement_date": "2022-01-04"}
    assert response["final_analysis"]["upload"] == {
        "lab_name": "Гілевич (8).pdf",
        "measurement_date": "2022-01-04",
    }
    compatibility.assert_upload_belongs_to_user.assert_awaited_once_with("upload-1", "user-1")


@pytest.mark.asyncio
async def test_get_results_uses_same_frozen_date_as_history_when_upload_date_is_missing(monkeypatch):
    upload_without_dates = {
        "id": "upload-historical",
        "user_id": "user-1",
        "lab_name": "Historical report.pdf",
        "created_at": "2026-10-15T12:00:00Z",
    }
    monkeypatch.setattr(
        compatibility,
        "assert_upload_belongs_to_user",
        AsyncMock(return_value=upload_without_dates),
    )
    monkeypatch.setattr(compatibility, "get_biomarkers_by_upload", AsyncMock(return_value=[]))
    monkeypatch.setattr(compatibility, "get_user_profile", AsyncMock(return_value={}))
    monkeypatch.setattr(compatibility, "get_protocol_by_upload", AsyncMock(return_value=None))
    monkeypatch.setattr(compatibility, "get_latest_report_version", AsyncMock(return_value={
        "id": "report-version-historical",
        "status": "completed",
        "input_snapshot": {"metadata": {"measurement_date": "2022-01-04"}},
    }))
    monkeypatch.setattr(compatibility, "is_frozen_report_version", lambda _report: True)
    monkeypatch.setattr(compatibility, "assemble_frozen_response", lambda **_: {
        "upload_id": "upload-historical",
        "final_analysis": {},
    })
    monkeypatch.setattr(compatibility, "_resolve_response_locale", lambda _request: "en")

    response = await compatibility.get_results_by_upload(
        "upload-historical",
        SimpleNamespace(headers={}),
        {"sub": "user-1"},
    )

    assert response["upload"]["measurement_date"] == "2022-01-04"
    assert response["final_analysis"]["upload"]["measurement_date"] == "2022-01-04"


@pytest.mark.asyncio
async def test_get_results_selects_legacy_measurement_date_fields_used_by_history(monkeypatch):
    upload_row = {
        "id": "upload-history-date",
        "user_id": "user-1",
        "lab_name": "Historical report.pdf",
        "created_at": "2026-10-15T12:00:00Z",
        "test_date": "2022-01-04",
        "collected_at": None,
        "reported_at": None,
    }

    class Query:
        def __init__(self):
            self.columns = []
            self.filters = {}

        def select(self, columns):
            self.columns = columns.split(",")
            return self

        def eq(self, name, value):
            self.filters[name] = value
            return self

        def limit(self, _limit):
            return self

        def execute(self):
            assert self.filters == {"id": "upload-history-date", "user_id": "user-1"}
            projected = {key: upload_row[key] for key in self.columns if key in upload_row}
            return SimpleNamespace(data=[projected])

    class Supabase:
        def table(self, name):
            assert name == "lab_uploads"
            return Query()

    async def run(operation):
        return operation()

    monkeypatch.setattr(svc, "_get_supabase", lambda: Supabase())
    monkeypatch.setattr(svc, "_run", run)
    monkeypatch.setattr(compatibility, "get_biomarkers_by_upload", AsyncMock(return_value=[]))
    monkeypatch.setattr(compatibility, "get_user_profile", AsyncMock(return_value={}))
    monkeypatch.setattr(compatibility, "get_protocol_by_upload", AsyncMock(return_value=None))
    monkeypatch.setattr(compatibility, "get_latest_report_version", AsyncMock(return_value={
        "id": "report-version-history-date",
        "status": "completed",
        "input_snapshot": {"metadata": {}},
    }))
    monkeypatch.setattr(compatibility, "is_frozen_report_version", lambda _report: True)
    monkeypatch.setattr(compatibility, "assemble_frozen_response", lambda **_: {
        "upload_id": "upload-history-date",
        "final_analysis": {},
    })
    monkeypatch.setattr(compatibility, "_resolve_response_locale", lambda _request: "en")

    response = await compatibility.get_results_by_upload(
        "upload-history-date",
        SimpleNamespace(headers={}),
        {"sub": "user-1"},
    )

    assert response["upload"]["measurement_date"] == "2022-01-04"
    assert response["final_analysis"]["upload"]["measurement_date"] == "2022-01-04"


@pytest.mark.asyncio
async def test_get_results_does_not_use_upload_creation_date_as_measurement_date(monkeypatch):
    upload = {"id": "upload-1", "user_id": "user-1", "created_at": "2026-10-15T12:00:00Z"}
    monkeypatch.setattr(compatibility, "assert_upload_belongs_to_user", AsyncMock(return_value=upload))
    monkeypatch.setattr(compatibility, "get_biomarkers_by_upload", AsyncMock(return_value=[]))
    monkeypatch.setattr(compatibility, "get_user_profile", AsyncMock(return_value={}))
    monkeypatch.setattr(compatibility, "get_protocol_by_upload", AsyncMock(return_value=None))
    monkeypatch.setattr(compatibility, "get_latest_report_version", AsyncMock(return_value=None))
    monkeypatch.setattr(compatibility, "has_any_report_version", AsyncMock(return_value=False))
    monkeypatch.setattr(compatibility, "run_lab_analysis_pipeline", AsyncMock(return_value={}))
    monkeypatch.setattr(compatibility, "_resolve_response_locale", lambda _request: "en")

    response = await compatibility.get_results_by_upload(
        "upload-1",
        SimpleNamespace(headers={}),
        {"sub": "user-1"},
    )

    assert response["upload"]["measurement_date"] is None
    assert response["final_analysis"]["upload"]["measurement_date"] is None

from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest

from app.routers.protocol import compatibility


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

import pytest

from app.services import supabase_service as svc


def _version(version_id, upload_id, created_at, status="completed"):
    return {
        "id": version_id,
        "upload_id": upload_id,
        "created_at": created_at,
        "status": status,
    }


def _upload(upload_id, *, test_date=None, status="done", data_origin=None):
    return {
        "id": upload_id,
        "test_date": test_date,
        "collected_at": None,
        "reported_at": None,
        "status": status,
        **({"data_origin": data_origin} if data_origin is not None else {}),
    }


def test_current_selector_prefers_reliable_clinical_date_then_version_order():
    selected = svc.select_current_active_report(
        [
            _version("rv-old", "upload-old", "2026-10-10T10:00:00Z"),
            _version("rv-new", "upload-new", "2026-10-11T10:00:00Z"),
        ],
        [
            _upload("upload-old", test_date="2026-10-01"),
            _upload("upload-new", test_date="2026-10-02"),
        ],
    )

    assert selected["report_version"]["id"] == "rv-new"
    assert selected["upload"]["id"] == "upload-new"


def test_current_selector_ignores_processing_and_failed_uploads():
    selected = svc.select_current_active_report(
        [
            _version("rv-ready", "upload-ready", "2026-10-10T10:00:00Z"),
            _version("rv-processing", "upload-processing", "2026-10-11T10:00:00Z"),
            _version("rv-failed", "upload-failed", "2026-10-12T10:00:00Z"),
        ],
        [
            _upload("upload-ready", test_date="2026-10-01", status="done"),
            _upload("upload-processing", test_date="2026-10-03", status="processing"),
            _upload("upload-failed", test_date="2026-10-04", status="failed"),
        ],
    )

    assert selected["report_version"]["id"] == "rv-ready"
    assert selected["upload"]["id"] == "upload-ready"


def test_current_selector_requires_a_valid_linked_upload():
    assert svc.select_current_active_report(
        [_version("rv-orphan", "missing-upload", "2026-10-10T10:00:00Z")],
        [],
    ) is None


@pytest.mark.parametrize("origin", ["synthetic", "qa", "smoke", "validation"])
def test_current_selector_excludes_explicit_non_clinical_origins(origin):
    selected = svc.select_current_active_report(
        [
            _version("rv-clinical", "upload-clinical", "2026-10-10T10:00:00Z"),
            _version("rv-non-clinical", "upload-non-clinical", "2026-10-12T10:00:00Z"),
        ],
        [
            _upload("upload-clinical", test_date="2026-10-01", data_origin="clinical"),
            _upload("upload-non-clinical", test_date="2026-10-03", data_origin=origin),
        ],
    )

    assert selected["report_version"]["id"] == "rv-clinical"


def test_current_selector_returns_no_report_when_only_non_clinical_origins_exist():
    assert svc.select_current_active_report(
        [_version("rv-synthetic", "upload-synthetic", "2026-10-10T10:00:00Z")],
        [_upload("upload-synthetic", data_origin="synthetic")],
    ) is None


def test_current_selector_preserves_legacy_unclassified_rows_for_compatibility():
    selected = svc.select_current_active_report(
        [_version("rv-legacy", "upload-legacy", "2026-10-10T10:00:00Z")],
        [_upload("upload-legacy", data_origin="legacy_unclassified")],
    )

    assert selected["report_version"]["id"] == "rv-legacy"


@pytest.mark.asyncio
async def test_production_upload_defaults_to_server_controlled_clinical_origin(monkeypatch):
    captured = {}

    class Response:
        data = [{"id": "upload-clinical"}]

    class Query:
        def insert(self, payload):
            captured.update(payload)
            return self

        def execute(self):
            return Response()

    class Supabase:
        def table(self, name):
            assert name == "lab_uploads"
            return Query()

    async def run(operation, **_kwargs):
        return operation()

    monkeypatch.setattr(svc, "_get_supabase", lambda: Supabase())
    monkeypatch.setattr(svc, "_run", run)

    await svc.save_lab_upload("user-1", "clinical text")

    assert captured["data_origin"] == "clinical"


@pytest.mark.asyncio
async def test_upload_origin_cannot_use_untrusted_or_legacy_value(monkeypatch):
    with pytest.raises(ValueError, match="Unsupported trusted upload data origin"):
        await svc.save_lab_upload("user-1", "fixture", data_origin="legacy_unclassified")


@pytest.mark.asyncio
async def test_progress_exposes_upload_lifecycle_status(monkeypatch):
    class Response:
        def __init__(self, data):
            self.data = data

    class Query:
        def __init__(self, rows):
            self.rows = rows

        def select(self, *_args, **_kwargs):
            return self

        def eq(self, *_args, **_kwargs):
            return self

        def in_(self, *_args, **_kwargs):
            return self

        def order(self, *_args, **_kwargs):
            return self

        def execute(self):
            return Response(self.rows)

    class Supabase:
        def table(self, name):
            if name == "lab_uploads":
                return Query([
                    {
                        "id": "upload-processing",
                        "created_at": "2026-10-12T10:00:00Z",
                        "test_date": None,
                        "collected_at": None,
                        "reported_at": None,
                        "date_source": None,
                        "date_confidence": None,
                        "status": "processing",
                    }
                ])
            if name == "biomarkers":
                return Query([])
            if name == "report_versions":
                return Query([])
            raise AssertionError(name)

    async def no_audit(**_kwargs):
        return None

    monkeypatch.setattr(svc, "_get_supabase", lambda: Supabase())
    monkeypatch.setattr(svc, "_audit_medical_read", no_audit)

    result = await svc.get_user_progress("user-1")

    assert result[0]["status"] == "processing"
    assert result[0]["biomarkers"] == []

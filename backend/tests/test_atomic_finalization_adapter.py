import pytest

from app.services import supabase_service as svc


USER = "11111111-1111-1111-1111-111111111111"
UPLOAD = "22222222-2222-2222-2222-222222222222"
OPERATION = "33333333-3333-3333-3333-333333333333"
REPORT = "44444444-4444-4444-4444-444444444444"


def _biomarkers():
    return [{
        "name": "Ferritin", "value": 18.0, "unit": "ng/mL", "ref_low": 30.0,
        "ref_high": 300.0, "status": "DEFICIENT", "category": None,
        "canonical_name": "ferritin", "reference_source": None, "unevaluated_reason": None,
    }]


def _report():
    return {"version": "report_v1", "locale": "en", "status": "completed", "input_snapshot": {},
            "knowledge_report": {}, "protocol": {}, "safety_result": {}, "explainability": {}}


class _Response:
    def __init__(self, data):
        self.data = data


class _UploadQuery:
    def select(self, *_args): return self
    def eq(self, *_args): return self
    def limit(self, *_args): return self
    def execute(self): return _Response([{"id": UPLOAD, "user_id": USER, "analysis_generation": 4}])


class _RPC:
    def __init__(self, response=None, error=None):
        self.response, self.error = response, error
    def execute(self):
        if self.error:
            raise self.error
        return _Response(self.response)


class _Client:
    def __init__(self, response=None, error=None):
        self.response, self.error, self.params = response, error, None
    def table(self, name):
        assert name == "lab_uploads"
        return _UploadQuery()
    def rpc(self, name, params):
        assert name == "finalize_lab_analysis"
        self.params = params
        return _RPC(self.response, self.error)


async def _inline(fn):
    return fn()


@pytest.mark.asyncio
async def test_first_commit_uses_owner_scoped_generation_and_canonical_projection(monkeypatch):
    client = _Client({"status": "committed", "replay": False, "report_version_id": REPORT, "generation": 5})
    monkeypatch.setattr(svc, "_get_supabase", lambda: client)
    monkeypatch.setattr(svc, "_run", _inline)
    result = await svc.finalize_lab_analysis(
        user_id=USER, upload_id=UPLOAD, operation_key=OPERATION, report_version_id=REPORT,
        locale="en", pipeline_version="lab_analysis_pipeline_v2", biomarkers=_biomarkers(), report=_report(),
    )
    assert result["replay"] is False and result["report_version_id"] == REPORT
    assert client.params["p_base_generation"] == 4
    assert client.params["p_biomarkers"] == _biomarkers()
    assert len(client.params["p_input_hash"]) == 64


@pytest.mark.asyncio
async def test_replay_preserves_database_report_identity(monkeypatch):
    prior_report = "55555555-5555-5555-5555-555555555555"
    client = _Client({"status": "committed", "replay": True, "report_version_id": prior_report, "generation": 5})
    monkeypatch.setattr(svc, "_get_supabase", lambda: client)
    monkeypatch.setattr(svc, "_run", _inline)
    result = await svc.finalize_lab_analysis(
        user_id=USER, upload_id=UPLOAD, operation_key=OPERATION, report_version_id=REPORT,
        locale="en", pipeline_version="lab_analysis_pipeline_v2", biomarkers=_biomarkers(), report=_report(),
    )
    assert result["replay"] is True and result["report_version_id"] == prior_report


@pytest.mark.asyncio
@pytest.mark.parametrize(("message", "code"), [
    ("stale_operation", "stale_operation"),
    ("idempotency_conflict", "idempotency_conflict"),
    ("connection reset", "finalization_storage_error"),
])
async def test_rpc_failure_classes_fail_closed(monkeypatch, message, code):
    client = _Client(error=RuntimeError(message))
    monkeypatch.setattr(svc, "_get_supabase", lambda: client)
    monkeypatch.setattr(svc, "_run", _inline)
    with pytest.raises(svc.AtomicFinalizationError, match=code):
        await svc.finalize_lab_analysis(
            user_id=USER, upload_id=UPLOAD, operation_key=OPERATION, report_version_id=REPORT,
            locale="en", pipeline_version="lab_analysis_pipeline_v2", biomarkers=_biomarkers(), report=_report(),
        )


@pytest.mark.asyncio
async def test_malformed_rpc_response_cannot_be_treated_as_commit(monkeypatch):
    client = _Client({"status": "committed", "replay": "false", "report_version_id": REPORT})
    monkeypatch.setattr(svc, "_get_supabase", lambda: client)
    monkeypatch.setattr(svc, "_run", _inline)
    with pytest.raises(svc.AtomicFinalizationError, match="invalid_finalization_response"):
        await svc.finalize_lab_analysis(
            user_id=USER, upload_id=UPLOAD, operation_key=OPERATION, report_version_id=REPORT,
            locale="en", pipeline_version="lab_analysis_pipeline_v2", biomarkers=_biomarkers(), report=_report(),
        )

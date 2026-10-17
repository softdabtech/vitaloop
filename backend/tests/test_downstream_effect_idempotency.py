"""Focused contracts for database-identified downstream analysis effects."""
from uuid import uuid4

import pytest

from app.services import supabase_service as svc


class _Response:
    def __init__(self, payload):
        self.data = [{"id": "row-1", **payload}]


class _Table:
    def __init__(self, name, writes):
        self.name = name
        self.writes = writes
        self.payload = None

    def upsert(self, payload, *, on_conflict):
        self.payload = payload
        self.writes.append((self.name, "upsert", on_conflict, payload))
        return self

    def execute(self):
        payload = self.payload[0] if isinstance(self.payload, list) else self.payload
        return _Response(payload)


class _Client:
    def __init__(self):
        self.writes = []

    def table(self, name):
        return _Table(name, self.writes)


@pytest.mark.parametrize("effect,sub_key", [
    ("protocol", ""), ("timeline", "lab_analyzed"), ("audit", "biomarker_persisted"),
])
def test_effect_key_is_stable_report_scoped_and_subkey_scoped(effect, sub_key):
    report_id = str(uuid4())
    assert svc.analysis_effect_key(report_id, effect, sub_key) == svc.analysis_effect_key(report_id, effect, sub_key)
    assert svc.analysis_effect_key(report_id, effect, sub_key) != svc.analysis_effect_key(str(uuid4()), effect, sub_key)


def test_effect_key_rejects_unknown_effect_or_non_uuid_report_id():
    with pytest.raises(svc.AtomicFinalizationError):
        svc.analysis_effect_key("not-a-report-id", "timeline", "x")
    with pytest.raises(svc.AtomicFinalizationError):
        svc.analysis_effect_key(str(uuid4()), "invented_effect", "x")


@pytest.mark.asyncio
async def test_safety_events_use_stable_database_effect_keys(monkeypatch):
    client = _Client()

    async def immediate(fn):
        return fn()

    monkeypatch.setattr(svc, "_get_supabase", lambda: client)
    monkeypatch.setattr(svc, "_run", immediate)
    report_id = str(uuid4())
    events = [
        {"key": "iron", "severity": "", "action": "", "reason": "review"},
        {"key": "vitamin_d", "severity": "high", "action": "hold", "reason": "confirm"},
    ]
    await svc.save_safety_events(user_id="user", upload_id="upload", report_version_id=report_id, safety_events=events)
    await svc.save_safety_events(user_id="user", upload_id="upload", report_version_id=report_id, safety_events=events)

    assert [(name, method, conflict) for name, method, conflict, _ in client.writes] == [
        ("safety_events", "upsert", "analysis_effect_key"),
        ("safety_events", "upsert", "analysis_effect_key"),
    ]
    first, second = (write[3] for write in client.writes)
    assert [row["analysis_effect_key"] for row in first] == [row["analysis_effect_key"] for row in second]
    assert len({row["analysis_effect_key"] for row in first}) == 2
    assert first[0]["severity"] == "medium" and first[0]["action"] == "warn"


@pytest.mark.asyncio
async def test_intelligence_artifacts_use_one_stable_key_per_artifact(monkeypatch):
    client = _Client()

    async def immediate(fn):
        return fn()

    monkeypatch.setattr(svc, "_get_supabase", lambda: client)
    monkeypatch.setattr(svc, "_run", immediate)
    report_id = str(uuid4())
    await svc.save_analysis_intelligence_artifacts(
        user_id="user", upload_id="upload", report_version_id=report_id,
        analysis_input_quality_gate={"decision": "pass"},
        clinical_data_integrity={"status": "pass"},
        evidence_gaps={"gaps": [{"domain": "iron"}]},
        health_states={"states": [{"domain": "iron"}]},
    )

    assert {name for name, _, _, _ in client.writes} == {
        "analysis_quality_gates", "clinical_data_integrity_events", "evidence_gaps", "health_state_versions",
    }
    assert all(method == "upsert" and conflict == "analysis_effect_key" for _, method, conflict, _ in client.writes)
    assert len({payload["analysis_effect_key"] for _, _, _, payload in client.writes}) == 4

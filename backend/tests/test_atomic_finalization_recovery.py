import copy
from uuid import uuid4

import pytest

from app.services import supabase_service as svc
from app.services.protocol_pipeline_evidence import build_pipeline_frozen_evidence


def _biomarker():
    return {
        "name": "Ferritin", "value": 18.0, "unit": "ng/mL", "ref_low": 30.0,
        "ref_high": 300.0, "status": "DEFICIENT", "category": None,
        "canonical_name": "ferritin", "reference_source": None, "unevaluated_reason": None,
    }


def _report(*, user_id, upload_id, report_id):
    biomarker = _biomarker()
    evaluation = {
        "matched_rules": [{
            "rule_id": "low_ferritin", "rule_key": "low_ferritin", "version": "v1",
            "recommendation_keys": ["iron_followup"],
            "evidence": [{"type": "lab_marker", "key": "ferritin", "value": 18.0,
                          "unit": "ng/mL", "matched": True}],
        }],
        "generated_recommendations": [{
            "key": "iron_followup", "title": "Discuss iron follow-up",
            "body": "Review with a clinician.",
        }],
    }
    evidence = build_pipeline_frozen_evidence(
        report_version_id=report_id, normalized_biomarkers=[biomarker],
        symptom_snapshot=None, knowledge_evaluation=evaluation,
    )
    return biomarker, {
        "id": report_id, "user_id": user_id, "upload_id": upload_id,
        "status": "completed", "version": "report_v1",
        "input_snapshot": {"biomarkers": [copy.deepcopy(biomarker)], "symptom_snapshot": None},
        "knowledge_report": {}, "protocol": {}, "safety_result": {},
        "explainability": {"frozen_protocol_evidence": evidence["payload"]},
    }


class _Query:
    def __init__(self, rows):
        self.rows = rows

    def select(self, *_args):
        return self

    def eq(self, *_args):
        return self

    def execute(self):
        return type("Response", (), {"data": copy.deepcopy(self.rows)})()


class _Client:
    def __init__(self, rows):
        self.rows = rows

    def table(self, name):
        assert name == "analysis_followup_work"
        return _Query(self.rows)


@pytest.mark.asyncio
async def test_authoritative_replay_loads_only_owner_scoped_persisted_content(monkeypatch):
    user_id, upload_id, report_id = map(lambda _: str(uuid4()), range(3))
    biomarker, report = _report(user_id=user_id, upload_id=upload_id, report_id=report_id)

    async def get_report(owner, identifier):
        return copy.deepcopy(report) if (owner, identifier) == (user_id, report_id) else None

    async def get_biomarkers(upload, owner):
        return [copy.deepcopy(biomarker)] if (upload, owner) == (upload_id, user_id) else []

    rows = [{"effect_type": effect, "status": "pending", "attempt_count": 0}
            for effect in svc.FOLLOWUP_EFFECT_TYPES]
    monkeypatch.setattr(svc, "get_report_version_for_user", get_report)
    monkeypatch.setattr(svc, "get_biomarkers_by_upload", get_biomarkers)
    monkeypatch.setattr(svc, "_get_supabase", lambda: _Client(rows))

    replay = await svc.load_authoritative_finalization_replay(
        user_id=user_id, upload_id=upload_id, report_version_id=report_id,
    )
    assert replay["report_version"] == report
    assert replay["biomarkers"] == [biomarker]
    assert replay["downstream_status"] == "pending"


@pytest.mark.asyncio
async def test_authoritative_replay_fails_closed_for_incomplete_recovery_work(monkeypatch):
    user_id, upload_id, report_id = map(lambda _: str(uuid4()), range(3))
    biomarker, report = _report(user_id=user_id, upload_id=upload_id, report_id=report_id)

    async def get_report(*_args):
        return copy.deepcopy(report)

    async def get_biomarkers(*_args):
        return [copy.deepcopy(biomarker)]

    monkeypatch.setattr(svc, "get_report_version_for_user", get_report)
    monkeypatch.setattr(svc, "get_biomarkers_by_upload", get_biomarkers)
    monkeypatch.setattr(svc, "_get_supabase", lambda: _Client([]))

    with pytest.raises(svc.AtomicFinalizationError, match="followup_work_inconsistent"):
        await svc.load_authoritative_finalization_replay(
            user_id=user_id, upload_id=upload_id, report_version_id=report_id,
        )

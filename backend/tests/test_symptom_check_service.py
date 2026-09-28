from types import SimpleNamespace
from uuid import uuid4

import pytest
from pydantic import ValidationError

from app.schemas.symptom_check import CreateSymptomSessionRequest, InitialEvidenceRequest
from app.schemas.symptom_check import SubmitSymptomAnswersRequest
from app.integrations.infermedica.schemas import ProviderSuggestion
from app.integrations.infermedica.exceptions import InfermedicaUnavailableError
from app.services import symptom_check_service as service
from app.services import supabase_service as svc


VALID_PROFILE = {
    "age": 35,
    "sex": "female",
    "height_cm": 168,
    "weight_kg": 64,
}


class _Query:
    def __init__(self, table_name, writes):
        self.table_name = table_name
        self.writes = writes
        self.payload = None

    def insert(self, payload):
        self.payload = payload
        return self

    def execute(self):
        self.writes.append((self.table_name, self.payload))
        if self.table_name == "symptom_check_sessions":
            return SimpleNamespace(data=[{"id": str(uuid4()), **self.payload}])
        return SimpleNamespace(data=[{"id": str(uuid4()), **self.payload}])


class _Supabase:
    def __init__(self, writes):
        self.writes = writes

    def table(self, table_name):
        return _Query(table_name, self.writes)


def test_create_request_rejects_free_text_and_unknown_values():
    with pytest.raises(ValidationError):
        CreateSymptomSessionRequest.model_validate(
            {
                "overall_wellbeing": "reduced",
                "primary_concern_id": "fatigue_low_energy",
                "locale": "en",
                "details": "unstructured medical answer",
            }
        )


def test_initial_evidence_rejects_duplicates_and_more_than_three_total():
    with pytest.raises(ValidationError):
        InitialEvidenceRequest(
            primary_concept_id="fatigue",
            secondary_concept_ids=["fatigue"],
            duration_bucket="days_2_7",
        )
    with pytest.raises(ValidationError):
        InitialEvidenceRequest(
            primary_concept_id="fatigue",
            secondary_concept_ids=["weakness", "sleepiness", "dizziness"],
            duration_bucket="days_2_7",
        )


def test_initial_mapping_uses_exact_approved_ids_only():
    request = InitialEvidenceRequest(
        primary_concept_id="fatigue",
        secondary_concept_ids=["exercise_intolerance"],
        duration_bucket="months_1_3",
    )
    mappings = [
        {
            "vitaloop_concept_id": "fatigue",
            "provider_concept_id": "s_1",
            "concept_type": "symptom",
            "display_name_en": "Fatigue",
        },
        {
            "vitaloop_concept_id": "exercise_intolerance",
            "provider_concept_id": "s_2",
            "concept_type": "symptom",
            "display_name_en": "Reduced exercise tolerance",
        },
    ]
    selected = service._validate_initial_mappings(request=request, mappings=mappings)
    assert [item["provider_concept_id"] for item in selected] == ["s_1", "s_2"]

    invalid = request.model_copy(update={"primary_concept_id": "fat"})
    with pytest.raises(Exception) as exc_info:
        service._validate_initial_mappings(request=invalid, mappings=mappings)
    assert exc_info.value.detail["code"] == "INVALID_CONCEPT_SELECTION"
    with pytest.raises(ValidationError):
        CreateSymptomSessionRequest.model_validate(
            {"overall_wellbeing": "average", "primary_concern_id": "fatigue_low_energy"}
        )


def test_rollout_is_stable_and_honors_hard_off(monkeypatch):
    monkeypatch.setattr(service.settings, "symptom_engine_allowlist_user_ids", "")
    monkeypatch.setattr(service.settings, "infermedica_enabled", False)
    monkeypatch.setattr(service.settings, "symptom_engine_rollout_percent", 100)
    assert service.is_symptom_engine_enabled_for_user("user-a") is False

    monkeypatch.setattr(service.settings, "infermedica_enabled", True)
    monkeypatch.setattr(service.settings, "symptom_engine_rollout_percent", 0)
    assert service.is_symptom_engine_enabled_for_user("user-a") is False

    monkeypatch.setattr(service.settings, "symptom_engine_rollout_percent", 100)
    assert service.is_symptom_engine_enabled_for_user("user-a") is True

    monkeypatch.setattr(service.settings, "symptom_engine_rollout_percent", 37)
    assert service.is_symptom_engine_enabled_for_user("user-a") == service.is_symptom_engine_enabled_for_user("user-a")


def test_server_allowlist_enables_internal_user_before_percentage_rollout(monkeypatch):
    monkeypatch.setattr(service.settings, "infermedica_enabled", True)
    monkeypatch.setattr(service.settings, "symptom_engine_rollout_percent", 0)
    monkeypatch.setattr(
        service.settings,
        "symptom_engine_allowlist_user_ids",
        "pilot-user-1, pilot-user-2",
    )
    assert service.is_symptom_engine_enabled_for_user("pilot-user-1") is True
    assert service.is_symptom_engine_enabled_for_user("other-user") is False


@pytest.mark.asyncio
async def test_no_current_concern_creates_completed_positive_baseline(monkeypatch):
    user_id = str(uuid4())
    writes = []

    async def fake_profile(_user_id):
        return VALID_PROFILE

    async def fake_no_active(_user_id):
        return None

    async def immediate_run(fn):
        return fn()

    monkeypatch.setattr(svc, "get_user_profile", fake_profile)
    monkeypatch.setattr(service, "_get_active_session", fake_no_active)
    monkeypatch.setattr(svc, "_get_supabase", lambda: _Supabase(writes))
    monkeypatch.setattr(svc, "_run", immediate_run)

    result = await service.create_or_resume_session(
        user_id=user_id,
        request=CreateSymptomSessionRequest(
            overall_wellbeing="good",
            primary_concern_id="no_current_concern",
            locale="en",
        ),
    )

    assert result["created"] is True
    assert result["session"]["status"] == "completed"
    assert result["session"]["stage"] == 3
    assert result["session"]["safety"] == {"level": "routine", "interrupt": False}
    assert [table for table, _payload in writes] == [
        "symptom_check_sessions",
        "symptom_evidence",
        "audit_logs",
        "timeline_events",
    ]
    baseline = writes[1][1]
    assert baseline["concept_type"] == "positive_baseline"
    assert baseline["choice_id"] == "present"
    assert baseline["source"] == "baseline"
    assert writes[2][1]["new_value"]["event"] == "session_created"
    assert writes[3][1]["metadata"]["status"] == "completed"


@pytest.mark.asyncio
async def test_unapproved_root_concern_is_rejected(monkeypatch):
    async def fake_profile(_user_id):
        return VALID_PROFILE

    async def fake_no_active(_user_id):
        return None

    async def fake_approved():
        return set()

    monkeypatch.setattr(svc, "get_user_profile", fake_profile)
    monkeypatch.setattr(service, "_get_active_session", fake_no_active)
    monkeypatch.setattr(service, "_approved_root_ids", fake_approved)

    with pytest.raises(Exception) as exc_info:
        await service.create_or_resume_session(
            user_id=str(uuid4()),
            request=CreateSymptomSessionRequest(
                overall_wellbeing="reduced",
                primary_concern_id="fatigue_low_energy",
                locale="en",
            ),
        )
    assert getattr(exc_info.value, "status_code", None) == 422
    assert exc_info.value.detail["code"] == "CONCERN_NOT_AVAILABLE"


@pytest.mark.asyncio
async def test_initial_evidence_asks_provider_red_flags_before_diagnosis(monkeypatch):
    user_id = str(uuid4())
    session_id = str(uuid4())
    writes = []
    session = {
        "id": session_id,
        "user_id": user_id,
        "status": "active",
        "current_stage": 1,
        "locale": "en",
        "root_concern_id": "fatigue_low_energy",
        "interview_id": str(uuid4()),
        "provider_model": "infermedica-en",
        "overall_wellbeing": "reduced",
        "should_stop": False,
    }
    mappings = [
        {
            "vitaloop_concept_id": "fatigue",
            "provider_concept_id": "s_1",
            "concept_type": "symptom",
            "display_name_en": "Fatigue",
        }
    ]

    class Query:
        def __init__(self, table):
            self.table = table
            self.action = None
            self.payload = None

        def select(self, *_args):
            self.action = "select"
            return self

        def eq(self, *_args):
            return self

        def update(self, payload):
            self.action, self.payload = "update", payload
            return self

        def upsert(self, payload, **_kwargs):
            self.action, self.payload = "upsert", payload
            return self

        def execute(self):
            if self.table == "clinical_concept_mappings":
                return SimpleNamespace(data=mappings)
            if self.action == "upsert":
                writes.append((self.table, self.payload))
                return SimpleNamespace(data=self.payload)
            if self.action == "update":
                writes.append((self.table, self.payload))
                return SimpleNamespace(data=[{**session, **self.payload}])
            raise AssertionError((self.table, self.action))

    class Supabase:
        def table(self, name):
            return Query(name)

    class Provider:
        diagnosis_calls = 0

        async def red_flags(self, **_kwargs):
            return [ProviderSuggestion(id="s_900", name="Warning sign")]

        async def diagnosis(self, **_kwargs):
            self.diagnosis_calls += 1
            raise AssertionError("diagnosis must wait until red-flag answers are collected")

    async def fake_owned(_user_id, _session_id):
        return session

    async def fake_profile(_user_id):
        return VALID_PROFILE

    async def immediate_run(fn):
        return fn()

    provider = Provider()
    monkeypatch.setattr(service, "_get_owned_session", fake_owned)
    monkeypatch.setattr(svc, "get_user_profile", fake_profile)
    monkeypatch.setattr(svc, "_get_supabase", lambda: Supabase())
    monkeypatch.setattr(svc, "_run", immediate_run)

    result = await service.submit_initial_evidence(
        user_id=user_id,
        session_id=session_id,
        request=InitialEvidenceRequest(
            primary_concept_id="fatigue",
            duration_bucket="days_2_7",
        ),
        provider_client=provider,
    )

    assert provider.diagnosis_calls == 0
    assert result["session"]["question"]["source"] == "red_flags"
    assert result["session"]["question"]["items"][0]["id"] == "s_900"
    assert result["session"]["should_stop"] is False
    assert [table for table, _payload in writes] == ["symptom_evidence", "symptom_check_sessions"]


@pytest.mark.asyncio
async def test_provider_failure_is_resumable_and_never_reported_as_safe(monkeypatch):
    user_id = str(uuid4())
    session_id = str(uuid4())
    updates = []
    session = {
        "id": session_id,
        "user_id": user_id,
        "status": "active",
        "current_stage": 1,
        "locale": "en",
        "root_concern_id": "fatigue_low_energy",
        "interview_id": str(uuid4()),
        "provider_model": "infermedica-en",
        "overall_wellbeing": "reduced",
        "should_stop": False,
    }
    mapping = {
        "vitaloop_concept_id": "fatigue",
        "provider_concept_id": "s_1",
        "concept_type": "symptom",
        "display_name_en": "Fatigue",
    }

    class Query:
        def __init__(self, table):
            self.table = table
            self.action = None
            self.payload = None

        def select(self, *_args):
            self.action = "select"
            return self

        def eq(self, *_args):
            return self

        def update(self, payload):
            self.action, self.payload = "update", payload
            return self

        def upsert(self, payload, **_kwargs):
            self.action, self.payload = "upsert", payload
            return self

        def execute(self):
            if self.table == "clinical_concept_mappings":
                return SimpleNamespace(data=[mapping])
            if self.action == "upsert":
                return SimpleNamespace(data=self.payload)
            if self.action == "update":
                updates.append(self.payload)
                return SimpleNamespace(data=[{**session, **self.payload}])
            raise AssertionError((self.table, self.action))

    class Supabase:
        def table(self, name):
            return Query(name)

    class FailingProvider:
        async def red_flags(self, **_kwargs):
            raise InfermedicaUnavailableError("private provider detail")

    async def fake_owned(_user_id, _session_id):
        return session

    async def fake_profile(_user_id):
        return VALID_PROFILE

    async def immediate_run(fn):
        return fn()

    monkeypatch.setattr(service, "_get_owned_session", fake_owned)
    monkeypatch.setattr(svc, "get_user_profile", fake_profile)
    monkeypatch.setattr(svc, "_get_supabase", lambda: Supabase())
    monkeypatch.setattr(svc, "_run", immediate_run)

    with pytest.raises(Exception) as exc_info:
        await service.submit_initial_evidence(
            user_id=user_id,
            session_id=session_id,
            request=InitialEvidenceRequest(
                primary_concept_id="fatigue",
                duration_bucket="days_2_7",
            ),
            provider_client=FailingProvider(),
        )

    assert exc_info.value.status_code == 503
    assert exc_info.value.detail["code"] == "SYMPTOM_PROVIDER_UNAVAILABLE"
    assert exc_info.value.detail["safety"]["level"] == "insufficient_data"
    assert exc_info.value.detail["resumable"] is True
    assert "private provider detail" not in str(exc_info.value.detail)
    assert updates[-1]["final_safety_level"] == "insufficient_data"
    assert updates[-1]["should_stop"] is False
    assert "status" not in updates[-1]


@pytest.mark.asyncio
async def test_completion_path_preserves_internal_emergency_over_provider_self_care(monkeypatch):
    user_id = str(uuid4())
    session_id = str(uuid4())
    session = {
        "id": session_id,
        "user_id": user_id,
        "status": "active",
        "current_stage": 1,
        "locale": "en",
        "root_concern_id": "fatigue_low_energy",
        "interview_id": str(uuid4()),
        "provider_model": "infermedica-en",
        "overall_wellbeing": "poor",
        "should_stop": False,
    }
    mapping = {
        "vitaloop_concept_id": "fatigue",
        "provider_concept_id": "s_1",
        "concept_type": "symptom",
        "display_name_en": "Fatigue",
    }
    final_updates = []

    class Query:
        def __init__(self, table):
            self.table = table
            self.action = None
            self.payload = None

        def select(self, *_args):
            self.action = "select"
            return self

        def eq(self, *_args):
            return self

        def update(self, payload):
            self.action, self.payload = "update", payload
            return self

        def upsert(self, payload, **_kwargs):
            self.action, self.payload = "upsert", payload
            return self

        def execute(self):
            if self.table == "clinical_concept_mappings":
                return SimpleNamespace(data=[mapping])
            if self.table == "symptom_evidence" and self.action == "select":
                return SimpleNamespace(
                    data=[{"vitaloop_concept_id": "approved_emergency_signal", "choice_id": "present"}]
                )
            if self.action == "upsert":
                return SimpleNamespace(data=self.payload)
            if self.action == "update":
                final_updates.append(self.payload)
                return SimpleNamespace(data=[{**session, **self.payload}])
            raise AssertionError((self.table, self.action))

    class Supabase:
        def table(self, name):
            return Query(name)

    class Provider:
        async def red_flags(self, **_kwargs):
            return []

        async def diagnosis(self, **_kwargs):
            return SimpleNamespace(question=None, should_stop=True, conditions=[])

        async def triage(self, **_kwargs):
            return SimpleNamespace(
                triage_level="self_care",
                root_cause="self_care_sufficient",
                serious=[],
            )

    async def fake_owned(_user_id, _session_id):
        return session

    async def fake_profile(_user_id):
        return VALID_PROFILE

    async def immediate_run(fn):
        return fn()

    monkeypatch.setattr(service, "_get_owned_session", fake_owned)
    monkeypatch.setattr(svc, "get_user_profile", fake_profile)
    monkeypatch.setattr(svc, "_get_supabase", lambda: Supabase())
    monkeypatch.setattr(svc, "_run", immediate_run)
    monkeypatch.setattr(
        service,
        "evaluate_internal_red_flags",
        lambda _evidence: SimpleNamespace(level="emergency", interrupt=True),
    )

    result = await service.submit_initial_evidence(
        user_id=user_id,
        session_id=session_id,
        request=InitialEvidenceRequest(
            primary_concept_id="fatigue",
            duration_bucket="days_2_7",
        ),
        provider_client=Provider(),
    )

    assert result["session"]["status"] == "completed"
    assert result["session"]["safety"] == {"level": "emergency", "interrupt": True}
    assert final_updates[-1]["provider_triage_level"] == "self_care"
    assert final_updates[-1]["final_safety_level"] == "emergency"


def test_answer_contract_rejects_stale_items_choices_and_incomplete_red_flags():
    question = {
        "id": "provider_red_flags_1",
        "source": "red_flags",
        "items": [
            {"id": "s_1", "choices": [{"id": "present"}, {"id": "absent"}, {"id": "unknown"}]},
            {"id": "s_2", "choices": [{"id": "present"}, {"id": "absent"}, {"id": "unknown"}]},
        ],
    }
    with pytest.raises(Exception) as stale:
        service._validate_answers_against_question(
            request=SubmitSymptomAnswersRequest(
                question_id="provider_red_flags_old",
                answers=[{"item_id": "s_1", "choice_id": "present"}],
            ),
            question=question,
        )
    assert stale.value.detail["code"] == "STALE_SYMPTOM_QUESTION"

    with pytest.raises(Exception) as incomplete:
        service._validate_answers_against_question(
            request=SubmitSymptomAnswersRequest(
                question_id="provider_red_flags_1",
                answers=[{"item_id": "s_1", "choice_id": "unknown"}],
            ),
            question=question,
        )
    assert incomplete.value.detail["code"] == "INCOMPLETE_RED_FLAG_ANSWERS"


def test_provider_case_omits_source_for_dynamic_diagnosis_answers():
    evidence = service._provider_case_evidence(
        [
            {"provider_concept_id": "s_initial", "choice_id": "present", "source": "initial"},
            {"provider_concept_id": "s_red", "choice_id": "absent", "source": "red_flags"},
            {"provider_concept_id": "s_dynamic", "choice_id": "unknown", "source": "diagnosis"},
        ]
    )
    payload = [item.model_dump(exclude_none=True) for item in evidence]
    assert payload == [
        {"id": "s_initial", "choice_id": "present", "source": "initial"},
        {"id": "s_red", "choice_id": "absent", "source": "red_flags"},
        {"id": "s_dynamic", "choice_id": "unknown"},
    ]


def test_question_cap_never_turns_incomplete_self_care_into_routine():
    assert service._completion_safety_level(
        merged_level="routine", question_cap_reached=True
    ) == "insufficient_data"
    assert service._completion_safety_level(
        merged_level="clinician_review", question_cap_reached=True
    ) == "clinician_review"
    assert service._completion_safety_level(
        merged_level="routine", question_cap_reached=False
    ) == "routine"


def test_processing_idempotency_row_is_not_mistaken_for_a_completed_null_response():
    assert service._resolve_prior_submission(
        {
            "request_hash": "request-a",
            "response_payload": None,
            "state": "processing",
        },
        request_hash="request-a",
    ) is None
    assert service._resolve_prior_submission(
        {
            "request_hash": "request-a",
            "response_payload": {"session": {"status": "completed"}},
            "state": "completed",
        },
        request_hash="request-a",
    ) == {"session": {"status": "completed"}}
    with pytest.raises(Exception) as conflict:
        service._resolve_prior_submission(
            {
                "request_hash": "request-a",
                "response_payload": None,
                "state": "processing",
            },
            request_hash="request-b",
        )
    assert conflict.value.detail["code"] == "IDEMPOTENCY_KEY_REUSED"


@pytest.mark.asyncio
async def test_adaptive_answer_emergency_interrupt_is_idempotent(monkeypatch):
    user_id = str(uuid4())
    session_id = str(uuid4())
    question = {
        "id": "provider_red_flags_1",
        "sequence": 1,
        "type": "group_multiple",
        "source": "red_flags",
        "items": [
            {
                "id": "s_900",
                "label": "Warning sign",
                "choices": [
                    {"id": "present", "label": "Yes"},
                    {"id": "absent", "label": "No"},
                    {"id": "unknown", "label": "Not sure"},
                ],
            }
        ],
    }
    session = {
        "id": session_id,
        "user_id": user_id,
        "status": "active",
        "current_stage": 2,
        "locale": "en",
        "provider": "infermedica_engine",
        "provider_model": "infermedica-en",
        "root_concern_id": "fatigue_low_energy",
        "interview_id": str(uuid4()),
        "overall_wellbeing": "poor",
        "last_question": question,
        "last_question_sequence": 1,
        "should_stop": False,
    }
    ledger = []
    evidence_writes = []
    session_updates = []

    class Query:
        def __init__(self, table):
            self.table = table
            self.action = None
            self.payload = None
            self.columns = ""

        def select(self, columns="*"):
            self.action, self.columns = "select", columns
            return self

        def eq(self, *_args):
            return self

        def in_(self, *_args):
            return self

        def limit(self, *_args):
            return self

        def update(self, payload):
            self.action, self.payload = "update", payload
            return self

        def upsert(self, payload, **_kwargs):
            self.action, self.payload = "upsert", payload
            return self

        def insert(self, payload):
            self.action, self.payload = "insert", payload
            return self

        def delete(self):
            self.action = "delete"
            return self

        def execute(self):
            if self.table == "symptom_answer_submissions" and self.action == "select":
                return SimpleNamespace(data=ledger[-1:] if ledger else [])
            if self.table == "clinical_concept_mappings":
                return SimpleNamespace(data=[{
                    "vitaloop_concept_id": "approved_emergency_signal",
                    "provider_concept_id": "s_900",
                    "concept_type": "symptom",
                    "display_name_en": "Warning sign",
                }])
            if self.table == "symptom_evidence" and self.action == "upsert":
                evidence_writes.append(self.payload)
                return SimpleNamespace(data=self.payload)
            if self.table == "symptom_evidence" and self.action == "select":
                if "provider_concept_id" in self.columns:
                    return SimpleNamespace(data=[{
                        "provider_concept_id": "s_900",
                        "choice_id": "present",
                        "source": "red_flags",
                    }])
                return SimpleNamespace(data=[{
                    "vitaloop_concept_id": "approved_emergency_signal",
                    "choice_id": "present",
                }])
            if self.table == "symptom_check_sessions" and self.action == "update":
                session_updates.append(self.payload)
                return SimpleNamespace(data=[{**session, **self.payload}])
            if self.table == "symptom_answer_submissions" and self.action == "update":
                ledger[-1].update(self.payload)
                return SimpleNamespace(data=[ledger[-1]])
            raise AssertionError((self.table, self.action, self.columns))

    class Supabase:
        def table(self, name):
            return Query(name)

        def rpc(self, name, params):
            assert name == "reserve_symptom_answer_submission"

            class RpcQuery:
                def execute(self):
                    ledger.append({
                        "request_hash": params["p_request_hash"],
                        "response_payload": None,
                        "state": "processing",
                    })
                    return SimpleNamespace(data=[{
                        "reservation_state": "reserved",
                        "stored_request_hash": params["p_request_hash"],
                        "stored_response_payload": None,
                    }])

            return RpcQuery()

    class ProviderMustNotRun:
        async def red_flags(self, **_kwargs):
            raise AssertionError("provider must not run after internal emergency")

    async def fake_owned(_user_id, _session_id):
        return session

    async def fake_profile(_user_id):
        return VALID_PROFILE

    async def immediate_run(fn):
        return fn()

    monkeypatch.setattr(service, "_get_owned_session", fake_owned)
    monkeypatch.setattr(svc, "get_user_profile", fake_profile)
    monkeypatch.setattr(svc, "_get_supabase", lambda: Supabase())
    monkeypatch.setattr(svc, "_run", immediate_run)
    monkeypatch.setattr(
        service,
        "evaluate_internal_red_flags",
        lambda _evidence: SimpleNamespace(level="emergency", interrupt=True),
    )
    request = SubmitSymptomAnswersRequest(
        question_id="provider_red_flags_1",
        answers=[{"item_id": "s_900", "choice_id": "present"}],
    )

    first = await service.submit_answers(
        user_id=user_id,
        session_id=session_id,
        request=request,
        idempotency_key="same-request-123",
        provider_client=ProviderMustNotRun(),
    )
    second = await service.submit_answers(
        user_id=user_id,
        session_id=session_id,
        request=request,
        idempotency_key="same-request-123",
        provider_client=ProviderMustNotRun(),
    )

    assert first == second
    assert first["session"]["status"] == "completed"
    assert first["session"]["safety"] == {"level": "emergency", "interrupt": True}
    assert len(evidence_writes) == 1
    assert len(session_updates) == 1
    assert len(ledger) == 1


def test_public_summary_groups_controlled_evidence_and_excludes_provider_diagnosis_data():
    session = {
        "id": "session-1",
        "status": "completed",
        "locale": "en",
        "questionnaire_version": "symptom_check_v3",
        "started_at": "2026-09-28T10:00:00Z",
        "completed_at": "2026-09-28T10:03:00Z",
        "overall_wellbeing": "reduced",
        "root_concern_id": "fatigue_low_energy",
        "duration_bucket": "weeks_1_4",
        "final_safety_level": "clinician_review",
        "condition_candidates": [{"id": "c_1", "probability": 0.91}],
        "provider_triage_root_cause": "private-provider-detail",
    }
    evidence = [
        {
            "vitaloop_concept_id": "fatigue",
            "display_name_en": "Fatigue",
            "choice_id": "present",
            "concept_type": "symptom",
            "is_primary": True,
            "provider_concept_id": "s_1",
            "provider_payload": {"private": True},
        },
        {
            "vitaloop_concept_id": "dizziness",
            "display_name_en": "Dizziness",
            "choice_id": "unknown",
            "concept_type": "symptom",
            "is_primary": False,
        },
    ]

    result = service._public_summary(session, evidence)
    serialized = str(result)

    assert result["primary_concern"] == {
        "id": "fatigue_low_energy",
        "label": "Energy, fatigue or recovery",
    }
    assert [item["id"] for item in result["evidence"]["present"]] == ["fatigue"]
    assert [item["id"] for item in result["evidence"]["unknown"]] == ["dizziness"]
    assert "condition_candidates" not in serialized
    assert "probability" not in serialized
    assert "provider_concept_id" not in serialized
    assert "private-provider-detail" not in serialized


@pytest.mark.asyncio
async def test_history_selects_only_safe_columns_and_filters_terminal_display_states(monkeypatch):
    selected_columns = []
    audit_calls = []

    class Query:
        def select(self, columns):
            selected_columns.append(columns)
            return self

        def eq(self, *_args):
            return self

        def in_(self, column, values):
            assert column == "status"
            assert values == ["completed", "skipped"]
            return self

        def order(self, column, desc=False):
            assert (column, desc) == ("completed_at", True)
            return self

        def limit(self, value):
            assert value == 20
            return self

        def execute(self):
            return SimpleNamespace(data=[{
                "id": "session-1",
                "status": "completed",
                "locale": "en",
                "questionnaire_version": "symptom_check_v3",
                "overall_wellbeing": "good",
                "root_concern_id": "no_current_concern",
                "duration_bucket": None,
                "final_safety_level": "routine",
                "started_at": "2026-09-28T10:00:00Z",
                "completed_at": "2026-09-28T10:00:01Z",
            }])

    class Supabase:
        def table(self, name):
            assert name == "symptom_check_sessions"
            return Query()

    async def immediate_run(fn):
        return fn()

    async def fake_audit(**kwargs):
        audit_calls.append(kwargs)

    monkeypatch.setattr(svc, "_get_supabase", lambda: Supabase())
    monkeypatch.setattr(svc, "_run", immediate_run)
    monkeypatch.setattr(svc, "write_audit_log", fake_audit)

    result = await service.get_session_history(user_id=str(uuid4()))

    assert len(result["items"]) == 1
    assert result["items"][0]["primary_concern"]["id"] == "no_current_concern"
    assert "condition_candidates" not in selected_columns[0]
    assert "provider_triage" not in selected_columns[0]
    assert audit_calls[0]["action"] == "read"


@pytest.mark.asyncio
async def test_provider_event_records_hashes_and_operational_metadata_only(monkeypatch):
    inserted = []

    class Query:
        def __init__(self):
            self.action = None
            self.payload = None

        def select(self, *_args):
            self.action = "select"
            return self

        def eq(self, *_args):
            return self

        def order(self, *_args, **_kwargs):
            return self

        def limit(self, *_args):
            return self

        def insert(self, payload):
            self.action, self.payload = "insert", payload
            return self

        def execute(self):
            if self.action == "select":
                return SimpleNamespace(data=[])
            inserted.append(self.payload)
            return SimpleNamespace(data=[self.payload])

    class Supabase:
        def table(self, name):
            assert name == "symptom_provider_events"
            return Query()

    async def immediate_run(fn):
        return fn()

    monkeypatch.setattr(svc, "_get_supabase", lambda: Supabase())
    monkeypatch.setattr(svc, "_run", immediate_run)
    session = {
        "id": "session-1",
        "provider_model": "infermedica-en",
        "provider_model_version": "2026-09",
    }

    async def provider_operation():
        return {"question": {"id": "q-private"}, "conditions": [{"probability": 0.9}]}

    result = await service._provider_call(
        user_id=str(uuid4()),
        session=session,
        endpoint_name="diagnosis",
        request_payload={"case": {"evidence": [{"id": "s-private"}]}},
        operation=provider_operation,
    )

    assert result["question"]["id"] == "q-private"
    event = inserted[0]
    assert event["endpoint_name"] == "diagnosis"
    assert event["http_status"] == 200
    assert event["provider_model_version"] == "2026-09"
    assert len(event["request_hash"]) == 64
    assert len(event["response_hash"]) == 64
    assert "request_payload" not in event
    assert "response_payload" not in event
    assert "s-private" not in str(event)
    assert "probability" not in str(event)

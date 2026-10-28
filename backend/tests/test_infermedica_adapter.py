import json
from uuid import uuid4

import httpx
import pytest

from app.integrations.infermedica.adapter import normalize_diagnosis_for_user, normalize_red_flag_question
from app.integrations.infermedica.client import InfermedicaClient
from app.integrations.infermedica.exceptions import (
    InfermedicaAuthenticationError,
    InfermedicaConfigurationError,
    InfermedicaDisabledError,
)
from app.integrations.infermedica.schemas import (
    ProviderAge,
    ProviderCaseRequest,
    ProviderEvidence,
    ProviderSuggestion,
    ProviderTriageResponse,
)


def sample_case() -> ProviderCaseRequest:
    return ProviderCaseRequest(
        sex="female",
        age=ProviderAge(value=34),
        evidence=[ProviderEvidence(id="s_47", choice_id="present", source="initial")],
    )


@pytest.mark.asyncio
async def test_disabled_client_never_calls_provider():
    calls = 0

    async def handler(_request):
        nonlocal calls
        calls += 1
        return httpx.Response(200, json={"updated_at": "2026-01-01T00:00:00Z"})

    async with httpx.AsyncClient(transport=httpx.MockTransport(handler), base_url="https://example.test") as http_client:
        client = InfermedicaClient(http_client=http_client, enabled=False, app_id="id", app_key="key")
        with pytest.raises(InfermedicaDisabledError):
            await client.info(interview_id=uuid4(), model="infermedica-en")

    assert calls == 0


@pytest.mark.asyncio
async def test_diagnosis_sends_server_headers_and_complete_case():
    captured = {}

    async def handler(request: httpx.Request):
        captured["headers"] = request.headers
        captured["body"] = json.loads(request.content)
        return httpx.Response(200, json={
            "should_stop": False,
            "question": {
                "type": "single", "text": "Do you feel dizzy?",
                "items": [{"id": "s_100", "name": "Dizziness", "choices": [
                    {"id": "present", "label": "Yes"},
                    {"id": "absent", "label": "No"},
                    {"id": "unknown", "label": "Not sure"},
                ]}],
                "future_additive_field": True,
            },
            "conditions": [{"id": "c_1", "probability": 0.8}],
        })

    interview_id = uuid4()
    async with httpx.AsyncClient(transport=httpx.MockTransport(handler), base_url="https://example.test") as http_client:
        client = InfermedicaClient(
            http_client=http_client, enabled=True, app_id="server-id", app_key="server-secret",
            dev_mode=True, retry_delay_seconds=0,
        )
        result = await client.diagnosis(case=sample_case(), interview_id=interview_id, model="infermedica-en")

    assert result.question.items[0].id == "s_100"
    assert captured["headers"]["app-id"] == "server-id"
    assert captured["headers"]["app-key"] == "server-secret"
    assert captured["headers"]["interview-id"] == str(interview_id)
    assert captured["headers"]["model"] == "infermedica-en"
    assert captured["headers"]["dev-mode"] == "true"
    assert captured["body"] == {
        "sex": "female",
        "age": {"value": 34, "unit": "year"},
        "evidence": [{"id": "s_47", "choice_id": "present", "source": "initial"}],
    }
    assert not ({"email", "name", "user_id", "free_text", "lab_results"} & captured["body"].keys())


def test_outbound_case_rejects_identity_and_free_text_fields():
    with pytest.raises(Exception):
        ProviderCaseRequest.model_validate(
            {
                "sex": "female",
                "age": {"value": 34, "unit": "year"},
                "evidence": [],
                "email": "person@example.test",
                "free_text": "private medical narrative",
            }
        )


@pytest.mark.asyncio
async def test_enabled_client_rejects_plain_http_transport():
    async with httpx.AsyncClient(transport=httpx.MockTransport(lambda _request: httpx.Response(200))) as http_client:
        client = InfermedicaClient(
            http_client=http_client,
            enabled=True,
            app_id="id",
            app_key="key",
            base_url="http://provider.example.test",
        )
        with pytest.raises(InfermedicaConfigurationError, match="HTTPS"):
            await client.info(interview_id=uuid4(), model="infermedica-en")


@pytest.mark.asyncio
async def test_retryable_response_is_retried_once():
    calls = 0

    async def handler(_request):
        nonlocal calls
        calls += 1
        if calls == 1:
            return httpx.Response(503, json={"message": "temporary"})
        return httpx.Response(200, json={"updated_at": "2026-01-01T00:00:00Z"})

    async with httpx.AsyncClient(transport=httpx.MockTransport(handler), base_url="https://example.test") as http_client:
        client = InfermedicaClient(
            http_client=http_client, enabled=True, app_id="id", app_key="key", retry_delay_seconds=0,
        )
        result = await client.info(interview_id=uuid4(), model="infermedica-en")

    assert result.updated_at == "2026-01-01T00:00:00Z"
    assert calls == 2


@pytest.mark.asyncio
async def test_authentication_error_does_not_expose_credentials():
    async def handler(_request):
        return httpx.Response(403, json={"message": "invalid app key server-secret"})

    async with httpx.AsyncClient(transport=httpx.MockTransport(handler), base_url="https://example.test") as http_client:
        client = InfermedicaClient(http_client=http_client, enabled=True, app_id="id", app_key="server-secret")
        with pytest.raises(InfermedicaAuthenticationError) as exc_info:
            await client.info(interview_id=uuid4(), model="infermedica-en")

    assert "server-secret" not in str(exc_info.value)


def test_user_adapter_strips_condition_rankings():
    normalized = normalize_diagnosis_for_user({
        "should_stop": True,
        "question": None,
        "conditions": [{"id": "c_secret", "name": "Not user-facing", "probability": 0.91}],
    }, sequence=4)

    assert normalized == {"question": None, "should_stop": True}
    assert "conditions" not in normalized


@pytest.mark.asyncio
async def test_red_flags_use_suggest_method_and_keep_controlled_ids():
    captured = {}

    async def handler(request: httpx.Request):
        captured["path"] = request.url.path
        captured["body"] = json.loads(request.content)
        return httpx.Response(200, json=[{"id": "s_900", "name": "Warning sign"}])

    async with httpx.AsyncClient(transport=httpx.MockTransport(handler), base_url="https://example.test") as http_client:
        client = InfermedicaClient(
            http_client=http_client, enabled=True, app_id="id", app_key="key", retry_delay_seconds=0
        )
        result = await client.red_flags(
            case=sample_case(), interview_id=uuid4(), model="infermedica-en"
        )

    assert captured["path"] == "/suggest"
    assert captured["body"]["suggest_method"] == "red_flags"
    assert result[0].id == "s_900"


def test_red_flag_adapter_produces_only_controlled_answers():
    question = normalize_red_flag_question(
        [ProviderSuggestion(id="s_900", name="Technical name", common_name="Warning sign")],
        sequence=2,
    )
    assert question["source"] == "red_flags"
    assert question["items"][0]["id"] == "s_900"
    assert [choice["id"] for choice in question["items"][0]["choices"]] == [
        "present",
        "absent",
        "unknown",
    ]


def test_triage_seriousness_is_strict_and_typed():
    parsed = ProviderTriageResponse.model_validate(
        {
            "triage_level": "consultation",
            "root_cause": "serious_evidence_present",
            "serious": [
                {"id": "s_900", "name": "Warning sign", "seriousness": "emergency"}
            ],
        }
    )
    assert parsed.serious[0].seriousness == "emergency"

    with pytest.raises(Exception):
        ProviderTriageResponse.model_validate(
            {
                "triage_level": "consultation",
                "serious": [{"id": "s_900", "name": "Warning sign", "seriousness": "unknown"}],
            }
        )

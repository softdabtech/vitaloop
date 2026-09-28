import asyncio
import logging
from typing import Any
from urllib.parse import urlparse
from uuid import UUID

import httpx

from app.config import settings
from app.integrations.infermedica.exceptions import (
    InfermedicaAuthenticationError,
    InfermedicaConfigurationError,
    InfermedicaDisabledError,
    InfermedicaRateLimitError,
    InfermedicaRequestError,
    InfermedicaResponseError,
    InfermedicaUnavailableError,
)
from app.integrations.infermedica.schemas import (
    ProviderCaseRequest,
    ProviderDiagnosisResponse,
    ProviderInfoResponse,
    ProviderSearchItem,
    ProviderSuggestion,
    ProviderTriageResponse,
)


logger = logging.getLogger(__name__)
_RETRYABLE_STATUS_CODES = {429, 502, 503}


class InfermedicaClient:
    def __init__(
        self,
        *,
        http_client: httpx.AsyncClient | None = None,
        enabled: bool | None = None,
        app_id: str | None = None,
        app_key: str | None = None,
        base_url: str | None = None,
        timeout_seconds: float | None = None,
        dev_mode: bool | None = None,
        retry_delay_seconds: float = 0.15,
    ) -> None:
        self.enabled = settings.infermedica_enabled if enabled is None else enabled
        self.app_id = settings.infermedica_app_id if app_id is None else app_id
        self.app_key = settings.infermedica_app_key if app_key is None else app_key
        self.base_url = (base_url or settings.infermedica_base_url).rstrip("/")
        self.timeout_seconds = timeout_seconds or settings.infermedica_timeout_seconds
        self.dev_mode = settings.infermedica_dev_mode if dev_mode is None else dev_mode
        self.retry_delay_seconds = retry_delay_seconds
        self._client = http_client
        self._owns_client = http_client is None

    def _assert_ready(self) -> None:
        if not self.enabled:
            raise InfermedicaDisabledError("Infermedica integration is disabled")
        if not self.app_id.strip() or not self.app_key.strip():
            raise InfermedicaConfigurationError("Infermedica server credentials are not configured")
        if urlparse(self.base_url).scheme != "https":
            raise InfermedicaConfigurationError("Infermedica base URL must use HTTPS")

    def _headers(self, *, interview_id: UUID | str, model: str) -> dict[str, str]:
        return {
            "App-Id": self.app_id,
            "App-Key": self.app_key,
            "Interview-Id": str(interview_id),
            "Model": model,
            "Dev-Mode": "true" if self.dev_mode else "false",
            "Content-Type": "application/json",
        }

    async def _http(self) -> httpx.AsyncClient:
        if self._client is None:
            self._client = httpx.AsyncClient(base_url=self.base_url, timeout=self.timeout_seconds)
        return self._client

    async def close(self) -> None:
        if self._client is not None and self._owns_client:
            await self._client.aclose()
            self._client = None

    async def __aenter__(self):
        await self._http()
        return self

    async def __aexit__(self, *_exc):
        await self.close()

    async def _request(
        self,
        method: str,
        path: str,
        *,
        interview_id: UUID | str,
        model: str,
        params: dict[str, Any] | None = None,
        json: dict[str, Any] | None = None,
    ) -> Any:
        self._assert_ready()
        client = await self._http()
        last_status: int | None = None

        for attempt in range(2):
            try:
                response = await client.request(
                    method,
                    path,
                    headers=self._headers(interview_id=interview_id, model=model),
                    params=params,
                    json=json,
                )
                last_status = response.status_code
            except (httpx.TimeoutException, httpx.TransportError) as exc:
                if attempt == 0:
                    await asyncio.sleep(self.retry_delay_seconds)
                    continue
                logger.warning("infermedica_transport_failure endpoint=%s error_type=%s", path, type(exc).__name__)
                raise InfermedicaUnavailableError("Infermedica is temporarily unavailable") from exc

            if response.status_code in _RETRYABLE_STATUS_CODES and attempt == 0:
                await asyncio.sleep(self.retry_delay_seconds)
                continue
            if response.status_code in {401, 403}:
                raise InfermedicaAuthenticationError("Infermedica credentials were rejected")
            if response.status_code == 429:
                raise InfermedicaRateLimitError("Infermedica rate limit exceeded")
            if response.status_code >= 500:
                raise InfermedicaUnavailableError("Infermedica is temporarily unavailable")
            if response.status_code >= 400:
                raise InfermedicaRequestError(response.status_code)
            try:
                return response.json()
            except ValueError as exc:
                raise InfermedicaResponseError("Infermedica returned invalid JSON") from exc

        raise InfermedicaUnavailableError(f"Infermedica request failed with status {last_status}")

    async def info(self, *, interview_id: UUID | str, model: str) -> ProviderInfoResponse:
        payload = await self._request("GET", "/info", interview_id=interview_id, model=model)
        return ProviderInfoResponse.model_validate(payload)

    async def search(
        self, *, phrase: str, age: int, sex: str, interview_id: UUID | str, model: str
    ) -> list[ProviderSearchItem]:
        payload = await self._request(
            "GET", "/search", interview_id=interview_id, model=model,
            params={"phrase": phrase, "age.value": age, "sex": sex, "types": "symptom,risk_factor", "include_pro": "false"},
        )
        if not isinstance(payload, list):
            raise InfermedicaResponseError("Infermedica search response must be a list")
        return [ProviderSearchItem.model_validate(item) for item in payload]

    async def suggest(
        self, *, case: ProviderCaseRequest, method: str, interview_id: UUID | str, model: str
    ) -> list[ProviderSuggestion]:
        body = case.model_dump(exclude_none=True)
        body["suggest_method"] = method
        payload = await self._request("POST", "/suggest", interview_id=interview_id, model=model, json=body)
        if not isinstance(payload, list):
            raise InfermedicaResponseError("Infermedica suggest response must be a list")
        return [ProviderSuggestion.model_validate(item) for item in payload]

    async def red_flags(
        self, *, case: ProviderCaseRequest, interview_id: UUID | str, model: str
    ) -> list[ProviderSuggestion]:
        """Return provider-backed alarming observations for controlled questions.

        Engine API v3 exposes this through ``/suggest`` with the ``red_flags``
        method. The legacy standalone ``/red_flags`` endpoint is not used.
        """
        return await self.suggest(
            case=case,
            method="red_flags",
            interview_id=interview_id,
            model=model,
        )

    async def diagnosis(
        self, *, case: ProviderCaseRequest, interview_id: UUID | str, model: str
    ) -> ProviderDiagnosisResponse:
        payload = await self._request(
            "POST", "/diagnosis", interview_id=interview_id, model=model,
            json=case.model_dump(exclude_none=True),
        )
        return ProviderDiagnosisResponse.model_validate(payload)

    async def triage(
        self, *, case: ProviderCaseRequest, interview_id: UUID | str, model: str
    ) -> ProviderTriageResponse:
        payload = await self._request(
            "POST", "/triage", interview_id=interview_id, model=model,
            json=case.model_dump(exclude_none=True),
        )
        return ProviderTriageResponse.model_validate(payload)

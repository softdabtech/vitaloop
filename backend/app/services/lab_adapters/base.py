from __future__ import annotations

from abc import ABC, abstractmethod
from typing import Any, Dict

from app.schemas.partners.results import PartnerResultIngestRequest
from app.services.lab_normalization.canonical import CanonicalLabResult


class BaseLabAdapter(ABC):
    name: str = "base"

    @abstractmethod
    def to_canonical(self, request: PartnerResultIngestRequest, raw_payload: Dict[str, Any]) -> CanonicalLabResult:
        raise NotImplementedError

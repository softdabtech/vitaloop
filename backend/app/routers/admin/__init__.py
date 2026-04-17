"""Admin domain — runtime readiness, ops tooling, audit access."""
from typing import Protocol, Any


class IAdminService(Protocol):
    async def runtime_readiness(self) -> dict[str, Any]: ...
    async def get_audit_log(self, limit: int) -> list[dict[str, Any]]: ...

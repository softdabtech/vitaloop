"""Billing domain helpers."""
from typing import Protocol, Any


class IBillingService(Protocol):
    async def get_subscription_status(self, user_id: str) -> dict[str, Any]: ...
    async def cancel_subscription(self, user_id: str) -> None: ...

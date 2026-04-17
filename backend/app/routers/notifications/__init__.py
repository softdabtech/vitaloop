"""Notifications domain — push/email notifications, user complaints."""
from typing import Protocol, Any


class INotificationService(Protocol):
    async def send_notification(self, user_id: str, message: str, channel: str) -> None: ...
    async def list_notifications(self, user_id: str) -> list[dict[str, Any]]: ...

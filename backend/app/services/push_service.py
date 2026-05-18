import json
import logging
from typing import Any, Dict

from pywebpush import WebPushException, webpush

from app.config import settings

logger = logging.getLogger(__name__)


def is_push_configured() -> bool:
    return bool(settings.webpush_vapid_public_key and settings.webpush_vapid_private_key)


def build_subscription_payload(row: Dict[str, Any]) -> Dict[str, Any]:
    return {
        "endpoint": row.get("endpoint"),
        "keys": {
            "p256dh": row.get("p256dh_key"),
            "auth": row.get("auth_key"),
        },
    }


def send_web_push(subscription_row: Dict[str, Any], payload: Dict[str, Any]) -> bool:
    if not is_push_configured():
        logger.warning("webpush_not_configured")
        return False

    subscription_info = build_subscription_payload(subscription_row)

    try:
        webpush(
            subscription_info=subscription_info,
            data=json.dumps(payload),
            vapid_private_key=settings.webpush_vapid_private_key,
            vapid_claims={"sub": settings.webpush_vapid_subject},
            ttl=60 * 60,
        )
        return True
    except WebPushException as exc:
        status = getattr(exc.response, "status_code", None) if getattr(exc, "response", None) else None
        logger.warning(
            "webpush_send_failed endpoint=%s status=%s error=%s",
            subscription_row.get("endpoint"),
            status,
            repr(exc),
        )
        return False
    except Exception as exc:
        logger.warning("webpush_send_failed_unknown endpoint=%s error=%s", subscription_row.get("endpoint"), repr(exc))
        return False

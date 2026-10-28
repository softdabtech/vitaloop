"""Brute force protection service for authentication attempts."""

import asyncio
import logging
from datetime import datetime, timedelta, timezone
from typing import Optional, Dict, List
from dataclasses import dataclass, field

_logger = logging.getLogger(__name__)

# In-memory store for failed login attempts
# In production, this should use Redis for distributed deployments
_failed_attempts: Dict[str, List[datetime]] = {}
_lock = asyncio.Lock()

# Configuration
MAX_FAILED_ATTEMPTS = 3
LOCKOUT_MINUTES = 15
CLEANUP_INTERVAL_MINUTES = 60


@dataclass
class LoginAttempt:
    """Represents a login attempt record."""
    email: str
    timestamp: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    success: bool = False
    ip_address: Optional[str] = None
    user_agent: Optional[str] = None

    def to_dict(self) -> dict:
        return {
            "email": self.email,
            "timestamp": self.timestamp.isoformat(),
            "success": self.success,
            "ip_address": self.ip_address,
            "user_agent": self.user_agent,
        }


async def record_login_attempt(
    email: str,
    success: bool,
    ip_address: Optional[str] = None,
    user_agent: Optional[str] = None,
) -> None:
    """Record a login attempt (success or failure).

    Args:
        email: User email
        success: Whether login was successful
        ip_address: Client IP address
        user_agent: Client user agent
    """
    async with _lock:
        if email not in _failed_attempts:
            _failed_attempts[email] = []

        if success:
            # Clear failed attempts on successful login
            _failed_attempts[email] = []
            _logger.info(f"login_success email={email} ip={ip_address}")
        else:
            # Record failed attempt
            attempt = LoginAttempt(
                email=email,
                success=False,
                ip_address=ip_address,
                user_agent=user_agent,
            )
            _failed_attempts[email].append(attempt.timestamp)
            _logger.warning(
                f"login_failure email={email} ip={ip_address} "
                f"attempts={len(_failed_attempts[email])}/{MAX_FAILED_ATTEMPTS}"
            )


async def is_account_locked(email: str) -> bool:
    """Check if account is locked due to too many failed attempts.

    Args:
        email: User email

    Returns:
        True if account is locked, False otherwise
    """
    async with _lock:
        if email not in _failed_attempts:
            return False

        # Clean up old attempts (older than lockout window)
        cutoff_time = datetime.now(timezone.utc) - timedelta(minutes=LOCKOUT_MINUTES)
        recent_attempts = [
            attempt_time
            for attempt_time in _failed_attempts[email]
            if attempt_time > cutoff_time
        ]
        _failed_attempts[email] = recent_attempts

        # Check if account is locked
        if len(recent_attempts) >= MAX_FAILED_ATTEMPTS:
            _logger.warning(f"account_locked email={email} attempts={len(recent_attempts)}")
            return True

        return False


async def get_lockout_time_remaining(email: str) -> Optional[int]:
    """Get remaining lockout time in seconds.

    Args:
        email: User email

    Returns:
        Remaining seconds if locked, None otherwise
    """
    async with _lock:
        if email not in _failed_attempts:
            return None

        attempts = _failed_attempts[email]
        if not attempts or len(attempts) < MAX_FAILED_ATTEMPTS:
            return None

        # Get time of oldest failing attempt in current lockout window
        oldest_recent = min(attempts[-MAX_FAILED_ATTEMPTS:])
        lockout_expires = oldest_recent + timedelta(minutes=LOCKOUT_MINUTES)
        now = datetime.now(timezone.utc)

        if now < lockout_expires:
            remaining_seconds = int((lockout_expires - now).total_seconds())
            return max(1, remaining_seconds)  # At least 1 second

        return None


async def get_failed_attempt_count(email: str) -> int:
    """Get number of failed attempts in current lockout window.

    Args:
        email: User email

    Returns:
        Number of failed attempts
    """
    async with _lock:
        if email not in _failed_attempts:
            return 0

        # Clean up old attempts
        cutoff_time = datetime.now(timezone.utc) - timedelta(minutes=LOCKOUT_MINUTES)
        recent_attempts = [
            attempt_time
            for attempt_time in _failed_attempts[email]
            if attempt_time > cutoff_time
        ]
        _failed_attempts[email] = recent_attempts

        return len(recent_attempts)


async def clear_attempts(email: str) -> None:
    """Clear all failed attempts for an email (usually after password reset).

    Args:
        email: User email
    """
    async with _lock:
        if email in _failed_attempts:
            del _failed_attempts[email]
        _logger.info(f"failed_attempts_cleared email={email}")


async def cleanup_old_attempts() -> None:
    """Clean up old failed attempts to free memory.

    Should be run periodically (e.g., every CLEANUP_INTERVAL_MINUTES).
    """
    async with _lock:
        cutoff_time = datetime.now(timezone.utc) - timedelta(minutes=CLEANUP_INTERVAL_MINUTES)
        cleaned_count = 0

        emails_to_remove = []
        for email, attempts in _failed_attempts.items():
            recent = [a for a in attempts if a > cutoff_time]
            if recent:
                _failed_attempts[email] = recent
            else:
                emails_to_remove.append(email)
                cleaned_count += 1

        for email in emails_to_remove:
            del _failed_attempts[email]

        if cleaned_count > 0:
            _logger.info(f"cleanup_old_attempts removed={cleaned_count} entries")

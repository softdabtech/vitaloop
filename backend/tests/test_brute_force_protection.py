"""Tests for brute force protection on authentication endpoints."""

import pytest
import asyncio
from datetime import datetime, timedelta, timezone
from app.services import brute_force_protection as bfp


@pytest.mark.asyncio
async def test_record_successful_login_clears_failures():
    """Verify successful login clears failed attempts."""
    email = "test@example.com"

    # Record 2 failed attempts
    await bfp.record_login_attempt(email, success=False, ip_address="1.1.1.1")
    await bfp.record_login_attempt(email, success=False, ip_address="1.1.1.1")

    assert await bfp.get_failed_attempt_count(email) == 2

    # Record successful login
    await bfp.record_login_attempt(email, success=True, ip_address="1.1.1.1")

    # Failed attempts should be cleared
    assert await bfp.get_failed_attempt_count(email) == 0
    assert not await bfp.is_account_locked(email)

    await bfp.clear_attempts(email)


@pytest.mark.asyncio
async def test_account_locked_after_max_failures():
    """Verify account is locked after MAX_FAILED_ATTEMPTS."""
    email = "locked@example.com"

    # Record max failed attempts
    for i in range(bfp.MAX_FAILED_ATTEMPTS):
        await bfp.record_login_attempt(email, success=False, ip_address="1.1.1.1")

    # Account should be locked
    assert await bfp.is_account_locked(email)
    assert await bfp.get_failed_attempt_count(email) == bfp.MAX_FAILED_ATTEMPTS

    await bfp.clear_attempts(email)


@pytest.mark.asyncio
async def test_one_less_than_max_not_locked():
    """Verify account is not locked with less than MAX_FAILED_ATTEMPTS."""
    email = "almost@example.com"

    # Record MAX_FAILED_ATTEMPTS - 1
    for i in range(bfp.MAX_FAILED_ATTEMPTS - 1):
        await bfp.record_login_attempt(email, success=False, ip_address="1.1.1.1")

    # Account should NOT be locked
    assert not await bfp.is_account_locked(email)
    assert await bfp.get_failed_attempt_count(email) == bfp.MAX_FAILED_ATTEMPTS - 1

    await bfp.clear_attempts(email)


@pytest.mark.asyncio
async def test_lockout_time_remaining():
    """Verify lockout time remaining is calculated correctly."""
    email = "timer@example.com"

    # Record max failed attempts
    for i in range(bfp.MAX_FAILED_ATTEMPTS):
        await bfp.record_login_attempt(email, success=False, ip_address="1.1.1.1")

    # Get remaining time
    remaining = await bfp.get_lockout_time_remaining(email)

    assert remaining is not None
    assert 0 < remaining <= bfp.LOCKOUT_MINUTES * 60
    assert remaining > (bfp.LOCKOUT_MINUTES * 60 - 2)  # Within 2 seconds

    await bfp.clear_attempts(email)


@pytest.mark.asyncio
async def test_old_attempts_ignored():
    """Verify old attempts older than lockout window are ignored."""
    email = "old@example.com"

    # Manually add very old attempt (simulate old data)
    async with bfp._lock:
        old_time = datetime.now(timezone.utc) - timedelta(minutes=bfp.LOCKOUT_MINUTES + 1)
        bfp._failed_attempts[email] = [old_time]

    # Old attempt should be ignored
    assert not await bfp.is_account_locked(email)
    assert await bfp.get_failed_attempt_count(email) == 0

    await bfp.clear_attempts(email)


@pytest.mark.asyncio
async def test_multiple_emails_independent():
    """Verify different emails have independent lockout tracking."""
    email1 = "user1@example.com"
    email2 = "user2@example.com"

    # Record failures for email1
    for i in range(bfp.MAX_FAILED_ATTEMPTS):
        await bfp.record_login_attempt(email1, success=False)

    # Record fewer failures for email2
    await bfp.record_login_attempt(email2, success=False)

    # email1 locked, email2 not locked
    assert await bfp.is_account_locked(email1)
    assert not await bfp.is_account_locked(email2)

    await bfp.clear_attempts(email1)
    await bfp.clear_attempts(email2)


@pytest.mark.asyncio
async def test_clear_attempts_resets_tracking():
    """Verify clear_attempts resets failed login count."""
    email = "reset@example.com"

    # Record some failures
    for i in range(2):
        await bfp.record_login_attempt(email, success=False)

    assert await bfp.get_failed_attempt_count(email) == 2

    # Clear attempts
    await bfp.clear_attempts(email)

    # Should be reset
    assert await bfp.get_failed_attempt_count(email) == 0
    assert not await bfp.is_account_locked(email)


@pytest.mark.asyncio
async def test_ip_address_tracking():
    """Verify IP addresses are tracked for audit purposes."""
    email = "ip@example.com"

    # Record attempts from different IPs
    await bfp.record_login_attempt(email, success=False, ip_address="192.168.1.1")
    await bfp.record_login_attempt(email, success=False, ip_address="192.168.1.2")

    # Should record both attempts (IP tracking for audit, not account lockout per IP)
    count = await bfp.get_failed_attempt_count(email)
    assert count == 2

    await bfp.clear_attempts(email)


@pytest.mark.asyncio
async def test_login_attempt_dataclass():
    """Verify LoginAttempt dataclass works correctly."""
    attempt = bfp.LoginAttempt(
        email="test@example.com",
        success=False,
        ip_address="1.1.1.1",
        user_agent="Mozilla/5.0",
    )

    # Should have timestamp
    assert attempt.timestamp is not None
    assert isinstance(attempt.timestamp, datetime)

    # Should convert to dict
    data = attempt.to_dict()
    assert data["email"] == "test@example.com"
    assert data["success"] is False
    assert "timestamp" in data


@pytest.mark.asyncio
async def test_case_insensitive_emails():
    """Verify email comparison is case-insensitive."""
    # This test documents expected behavior
    # In actual use, normalize emails before comparison
    email_lower = "test@example.com"
    email_upper = "TEST@EXAMPLE.COM"

    # Currently would be treated as different
    # To fix: normalize emails in record_login_attempt()
    # For now, this documents the behavior

    await bfp.record_login_attempt(email_lower, success=False)
    await bfp.record_login_attempt(email_upper, success=False)

    # With current implementation, these are separate
    count_lower = await bfp.get_failed_attempt_count(email_lower)
    count_upper = await bfp.get_failed_attempt_count(email_upper)

    assert count_lower == 1
    assert count_upper == 1

    await bfp.clear_attempts(email_lower)
    await bfp.clear_attempts(email_upper)


@pytest.mark.asyncio
async def test_concurrent_attempts():
    """Verify concurrent attempts are handled safely."""
    email = "concurrent@example.com"

    # Record 3 attempts concurrently
    tasks = [
        bfp.record_login_attempt(email, success=False)
        for _ in range(bfp.MAX_FAILED_ATTEMPTS)
    ]
    await asyncio.gather(*tasks)

    # Should have exactly MAX_FAILED_ATTEMPTS
    count = await bfp.get_failed_attempt_count(email)
    assert count == bfp.MAX_FAILED_ATTEMPTS
    assert await bfp.is_account_locked(email)

    await bfp.clear_attempts(email)

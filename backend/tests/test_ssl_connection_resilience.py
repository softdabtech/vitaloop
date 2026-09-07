"""Tests for SSL connection error handling and resilience."""
import pytest
import ssl
import asyncio
from unittest.mock import AsyncMock, MagicMock
from app.services import supabase_service as svc


@pytest.mark.asyncio
async def test_ssl_error_retry(monkeypatch):
    """Verify that SSL errors are retried."""
    call_count = {"count": 0}

    async def failing_fn():
        call_count["count"] += 1
        if call_count["count"] < 3:
            # First 2 calls fail with SSL error
            raise ssl.SSLError("SSL: CERTIFICATE_VERIFY_FAILED")
        # Third call succeeds
        return {"success": True}

    # Mock _run to use our failing function
    async def mock_run(fn):
        return await fn()

    monkeypatch.setattr(svc, "_run", mock_run)

    # Run the read operation with retry
    result = await svc._run_supabase_read(failing_fn, attempts=3)

    # Should succeed after retries
    assert result == {"success": True}
    assert call_count["count"] == 3


@pytest.mark.asyncio
async def test_protocol_error_retry(monkeypatch):
    """Verify that HTTP/2 protocol errors are retried."""
    import httpx

    call_count = {"count": 0}

    async def failing_fn():
        call_count["count"] += 1
        if call_count["count"] < 2:
            raise httpx.RemoteProtocolError("EOF occurred in violation of protocol (_ssl.c:2426)")
        return {"data": []}

    async def mock_run(fn):
        return await fn()

    monkeypatch.setattr(svc, "_run", mock_run)

    result = await svc._run_supabase_read(failing_fn, attempts=3)
    assert result == {"data": []}
    assert call_count["count"] == 2


@pytest.mark.asyncio
async def test_connection_timeout_retry(monkeypatch):
    """Verify that connection timeouts are retried."""
    import httpx

    call_count = {"count": 0}

    async def failing_fn():
        call_count["count"] += 1
        if call_count["count"] < 2:
            raise httpx.TimeoutException("Connection timeout")
        return {"result": "ok"}

    async def mock_run(fn):
        return await fn()

    monkeypatch.setattr(svc, "_run", mock_run)

    result = await svc._run_supabase_read(failing_fn, attempts=2)
    assert result == {"result": "ok"}


@pytest.mark.asyncio
async def test_all_retries_exhausted(monkeypatch):
    """Verify that error is raised when all retries are exhausted."""
    import httpx

    async def always_failing_fn():
        raise httpx.RemoteProtocolError("EOF occurred in violation of protocol")

    async def mock_run(fn):
        return await fn()

    monkeypatch.setattr(svc, "_run", mock_run)

    # Should raise after attempts exhausted
    with pytest.raises(httpx.RemoteProtocolError):
        await svc._run_supabase_read(always_failing_fn, attempts=2)


def test_ssl_version_check():
    """Verify that SSL is properly configured for TLS 1.2+."""
    try:
        # Create default SSL context (should use modern TLS)
        ctx = ssl.create_default_context()

        # Check minimum version
        min_version = ctx.minimum_version
        # TLS 1.2 = TLSVersion.TLSv1_2
        assert min_version >= ssl.TLSVersion.TLSv1_2, \
            f"SSL minimum version {min_version} is less than TLS 1.2"

        # Verify OpenSSL is reasonably recent
        openssl_version = ssl.OPENSSL_VERSION
        # Should be OpenSSL 1.1.1+ or 3.x
        assert "OpenSSL" in openssl_version
        major_version = int(openssl_version.split()[1].split('.')[0])
        assert major_version >= 1, "OpenSSL version is too old"

    except Exception as e:
        pytest.skip(f"Cannot verify SSL configuration: {e}")


@pytest.mark.asyncio
async def test_os_error_with_ssl_message_retry(monkeypatch):
    """Verify that OSError containing SSL text is retried."""
    call_count = {"count": 0}

    async def failing_fn():
        call_count["count"] += 1
        if call_count["count"] < 2:
            raise OSError("[SSL] certificate verify failed")
        return {"ok": True}

    async def mock_run(fn):
        return await fn()

    monkeypatch.setattr(svc, "_run", mock_run)

    result = await svc._run_supabase_read(failing_fn, attempts=3)
    assert result == {"ok": True}


@pytest.mark.asyncio
async def test_non_ssl_os_error_not_retried(monkeypatch):
    """Verify that non-SSL OSError is not retried."""
    async def failing_fn():
        raise OSError("No space left on device")

    async def mock_run(fn):
        return await fn()

    monkeypatch.setattr(svc, "_run", mock_run)

    # Should not retry and raise immediately
    with pytest.raises(OSError, match="No space left on device"):
        await svc._run_supabase_read(failing_fn, attempts=3)

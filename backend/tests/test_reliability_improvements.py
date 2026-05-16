"""Tests for Phase 2 reliability improvements: retry logic, email notifications, and metrics."""

import pytest
import time
from unittest.mock import patch, AsyncMock, MagicMock
from app.utils.retry import CircuitBreaker, RetryConfig, with_retry
from app.utils.metrics import MetricsCollector, QueryProfiler, get_performance_report
from app.services.email_notifications import (
    send_subscription_expiry_warning,
    send_protocol_update_notification,
    send_free_to_premium_upsell,
    send_unverified_email_reminder,
)


class TestCircuitBreaker:
    """Test circuit breaker pattern."""

    def test_circuit_breaker_initializes_closed(self):
        """Circuit breaker should start in closed state."""
        cb = CircuitBreaker(failure_threshold=3)
        assert cb.is_open is False
        assert cb.failure_count == 0

    def test_circuit_breaker_opens_after_threshold(self):
        """Circuit breaker should open after failure threshold."""
        cb = CircuitBreaker(failure_threshold=2)
        cb.record_failure()
        assert cb.is_open is False
        cb.record_failure()
        assert cb.is_open is True

    def test_circuit_breaker_resets_on_success(self):
        """Circuit breaker should reset failure count on success."""
        cb = CircuitBreaker(failure_threshold=3)
        cb.record_failure()
        cb.record_failure()
        assert cb.failure_count == 2
        cb.record_success()
        assert cb.failure_count == 0
        assert cb.is_open is False

    def test_circuit_breaker_recovers_after_timeout(self):
        """Circuit breaker should recover after recovery timeout."""
        cb = CircuitBreaker(failure_threshold=1, recovery_timeout=1)
        cb.record_failure()
        assert cb.is_open is True

        # Should not recover immediately
        assert cb.check_state() is False

        # Wait for recovery timeout
        time.sleep(1.1)
        assert cb.check_state() is True
        assert cb.is_open is False


class TestRetryConfig:
    """Test retry configuration."""

    def test_retry_config_defaults(self):
        """RetryConfig should have sensible defaults."""
        config = RetryConfig()
        assert config.max_attempts == 3
        assert config.initial_wait == 1.0
        assert config.max_wait == 10.0
        assert config.exponential_base == 2.0

    def test_retry_config_custom_values(self):
        """RetryConfig should accept custom values."""
        config = RetryConfig(max_attempts=5, initial_wait=0.5, max_wait=30.0)
        assert config.max_attempts == 5
        assert config.initial_wait == 0.5
        assert config.max_wait == 30.0


class TestMetricsCollector:
    """Test metrics collection."""

    def test_metrics_collector_initializes(self):
        """MetricsCollector should initialize with empty metrics."""
        mc = MetricsCollector()
        assert len(mc.metrics) == 0

    def test_record_metric(self):
        """Should record metrics with timestamp."""
        mc = MetricsCollector()
        mc.record_metric("test_metric", 42.5)
        stats = mc.get_metric_stats("test_metric")

        assert stats["count"] == 1
        assert stats["avg"] == 42.5
        assert stats["min"] == 42.5
        assert stats["max"] == 42.5

    def test_metric_stats_calculation(self):
        """Should calculate stats correctly for multiple values."""
        mc = MetricsCollector()
        for value in [1.0, 2.0, 3.0, 4.0, 5.0]:
            mc.record_metric("test", value)

        stats = mc.get_metric_stats("test")
        assert stats["count"] == 5
        assert stats["avg"] == 3.0
        assert stats["min"] == 1.0
        assert stats["max"] == 5.0

    def test_record_error(self):
        """Should record error correctly."""
        mc = MetricsCollector()
        mc.record_error("/api/test", 500)
        stats = mc.get_metric_stats("error_/api/test")
        assert stats["count"] == 1
        assert stats["max"] == 1.0

    def test_record_latency(self):
        """Should record endpoint latency."""
        mc = MetricsCollector()
        mc.record_latency("/api/test", 1.5)
        stats = mc.get_metric_stats("latency_/api/test")
        assert stats["count"] == 1
        assert stats["max"] == 1.5


class TestQueryProfiler:
    """Test query profiling."""

    def test_query_profiler_initializes(self):
        """QueryProfiler should initialize empty."""
        qp = QueryProfiler()
        assert len(qp.slow_queries) == 0

    def test_slow_query_recording(self):
        """Should record slow queries."""
        qp = QueryProfiler()
        # Temporarily lower threshold for testing
        with patch('app.utils.metrics.SLOW_QUERY_THRESHOLD', 0.1):
            qp.record_query(
                query_type="db",
                operation="select",
                duration=0.5,
                table="users",
            )

        slow = qp.get_slow_queries()
        assert len(slow) == 1
        assert slow[0]["operation"] == "select"
        assert slow[0]["table"] == "users"

    def test_slow_query_with_error(self):
        """Should record slow query errors."""
        qp = QueryProfiler()
        with patch('app.utils.metrics.SLOW_QUERY_THRESHOLD', 0.1):
            qp.record_query(
                query_type="api",
                operation="fetch",
                duration=0.5,
                table="logs",
                error="Timeout",
            )

        slow = qp.get_slow_queries()
        assert slow[0]["error"] == "Timeout"


@pytest.mark.asyncio
async def test_send_subscription_expiry_warning():
    """Should send subscription expiry warning email."""
    with patch('app.services.email_notifications._deliver_html_email', new_callable=AsyncMock) as mock_send:
        mock_send.return_value = True

        result = await send_subscription_expiry_warning(
            user_email="test@example.com",
            user_name="Test User",
            days_until_expiry=0,
        )

        assert result is True
        mock_send.assert_called_once()
        args = mock_send.call_args
        assert args[1]["to_email"] == "test@example.com"
        assert "24 hours" in args[1]["html"]


@pytest.mark.asyncio
async def test_send_subscription_expiry_warning_missing_email():
    """Should handle missing email gracefully."""
    result = await send_subscription_expiry_warning(
        user_email="",
        user_name="Test User",
        days_until_expiry=0,
    )
    assert result is False


@pytest.mark.asyncio
async def test_send_protocol_update_notification():
    """Should send protocol update notification."""
    with patch('app.services.email_notifications._deliver_html_email', new_callable=AsyncMock) as mock_send:
        mock_send.return_value = True

        result = await send_protocol_update_notification(
            user_email="test@example.com",
            user_name="Test User",
            protocol_update_details="New supplements recommended",
        )

        assert result is True
        mock_send.assert_called_once()
        args = mock_send.call_args
        assert "protocol" in args[1]["subject"].lower()


@pytest.mark.asyncio
async def test_send_free_to_premium_upsell():
    """Should send premium upsell email."""
    with patch('app.services.email_notifications._deliver_html_email', new_callable=AsyncMock) as mock_send:
        mock_send.return_value = True

        result = await send_free_to_premium_upsell(
            user_email="free@example.com",
            user_name="Free User",
        )

        assert result is True
        mock_send.assert_called_once()
        args = mock_send.call_args
        assert "$19.99" in args[1]["html"]


@pytest.mark.asyncio
async def test_send_unverified_email_reminder():
    """Should send email verification reminder."""
    with patch('app.services.email_notifications._deliver_html_email', new_callable=AsyncMock) as mock_send:
        mock_send.return_value = True

        result = await send_unverified_email_reminder(
            user_email="unverified@example.com",
            user_name="Unverified User",
        )

        assert result is True
        mock_send.assert_called_once()
        args = mock_send.call_args
        assert "verify" in args[1]["subject"].lower()


def test_get_performance_report():
    """Should generate performance report."""
    report = get_performance_report()

    assert "timestamp" in report
    assert "slow_queries" in report
    assert "error_rate" in report
    assert "endpoint_latencies" in report
    assert "health" in report
    assert isinstance(report["slow_queries"], list)

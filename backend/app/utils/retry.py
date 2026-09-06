"""
Retry logic and circuit breaker utilities for resilient API calls.
"""

import logging
from datetime import datetime, timedelta, timezone
from typing import Callable, TypeVar, Optional, Any
from functools import wraps
import asyncio
import httpx
from tenacity import (
    retry,
    stop_after_attempt,
    wait_exponential,
    retry_if_exception_type,
    RetryError,
)

logger = logging.getLogger(__name__)
T = TypeVar("T")


class CircuitBreaker:
    """Simple circuit breaker for preventing cascading failures."""

    def __init__(
        self,
        failure_threshold: int = 5,
        recovery_timeout: int = 60,
        name: str = "circuit_breaker",
    ):
        self.failure_threshold = failure_threshold
        self.recovery_timeout = recovery_timeout
        self.name = name
        self.failure_count = 0
        self.last_failure_time: Optional[datetime] = None
        self.is_open = False

    def record_success(self) -> None:
        """Record a successful call."""
        self.failure_count = 0
        self.is_open = False

    def record_failure(self) -> None:
        """Record a failed call."""
        self.failure_count += 1
        self.last_failure_time = datetime.now(timezone.utc)
        if self.failure_count >= self.failure_threshold:
            self.is_open = True
            logger.warning(f"Circuit breaker {self.name} opened after {self.failure_count} failures")

    def check_state(self) -> bool:
        """Check if circuit breaker is open and should recover."""
        if not self.is_open:
            return True

        if self.last_failure_time is None:
            return True

        recovery_time = self.last_failure_time + timedelta(seconds=self.recovery_timeout)
        if datetime.now(timezone.utc) >= recovery_time:
            self.is_open = False
            self.failure_count = 0
            logger.info(f"Circuit breaker {self.name} closed, attempting recovery")
            return True

        return False

    def __call__(self, func: Callable) -> Callable:
        """Decorator to apply circuit breaker to a function."""
        @wraps(func)
        async def wrapper(*args: Any, **kwargs: Any) -> Any:
            if not self.check_state():
                logger.error(f"Circuit breaker {self.name} is open, rejecting request")
                raise RuntimeError(f"Circuit breaker {self.name} is open")

            try:
                result = await func(*args, **kwargs)
                self.record_success()
                return result
            except Exception as e:
                self.record_failure()
                raise

        return wrapper


class RetryConfig:
    """Configuration for retry behavior."""

    def __init__(
        self,
        max_attempts: int = 3,
        initial_wait: float = 1.0,
        max_wait: float = 10.0,
        exponential_base: float = 2.0,
    ):
        self.max_attempts = max_attempts
        self.initial_wait = initial_wait
        self.max_wait = max_wait
        self.exponential_base = exponential_base


# Default retry config
DEFAULT_RETRY_CONFIG = RetryConfig(max_attempts=3, initial_wait=1.0, max_wait=10.0)

# Supabase-specific retry config (more conservative)
SUPABASE_RETRY_CONFIG = RetryConfig(max_attempts=2, initial_wait=0.5, max_wait=5.0)


def _should_retry(exception: Exception) -> bool:
    """Determine if an exception should trigger a retry."""
    if isinstance(exception, httpx.TimeoutException):
        return True
    if isinstance(exception, httpx.ConnectError):
        return True
    if isinstance(exception, httpx.HTTPStatusError):
        status = exception.response.status_code
        # Retry on 429 (rate limit), 503 (service unavailable), 504 (gateway timeout)
        return status in (429, 503, 504)
    return False


def with_retry(config: RetryConfig = DEFAULT_RETRY_CONFIG):
    """Decorator to add retry logic with exponential backoff."""

    def decorator(func: Callable[..., T]) -> Callable[..., T]:
        @retry(
            stop=stop_after_attempt(config.max_attempts),
            wait=wait_exponential(
                multiplier=config.initial_wait,
                min=config.initial_wait,
                max=config.max_wait,
            ),
            retry=retry_if_exception_type(
                (
                    httpx.TimeoutException,
                    httpx.ConnectError,
                    httpx.RemoteProtocolError,
                    httpx.HTTPStatusError,
                    TimeoutError,
                )
            ),
            before_sleep=lambda retry_state: logger.warning(
                f"Retrying {func.__name__} (attempt {retry_state.attempt_number}/{config.max_attempts})"
            ),
        )
        @wraps(func)
        def wrapper(*args: Any, **kwargs: Any) -> T:
            return func(*args, **kwargs)

        return wrapper

    return decorator


# Circuit breakers for critical services
supabase_circuit_breaker = CircuitBreaker(
    failure_threshold=5,
    recovery_timeout=30,
    name="supabase_api",
)

email_circuit_breaker = CircuitBreaker(
    failure_threshold=3,
    recovery_timeout=60,
    name="email_service",
)

llm_circuit_breaker = CircuitBreaker(
    failure_threshold=3,
    recovery_timeout=120,
    name="llm_service",
)

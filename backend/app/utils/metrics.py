"""
Performance metrics and monitoring utilities.
"""

import logging
import time
from datetime import datetime, timedelta, timezone
from typing import Dict, List, Optional, Any, Callable
from functools import wraps
from collections import defaultdict, deque
import threading

logger = logging.getLogger(__name__)

# Performance thresholds (in seconds)
SLOW_QUERY_THRESHOLD = 2.0  # Query slower than 2s
SLOW_ENDPOINT_THRESHOLD = 5.0  # Endpoint slower than 5s
ERROR_RATE_THRESHOLD = 0.1  # 10% error rate = alert


class MetricsCollector:
    """Collect and track performance metrics."""

    def __init__(self, window_size: int = 300):
        """
        Initialize metrics collector.

        Args:
            window_size: Time window in seconds for tracking metrics (default 5 min)
        """
        self.window_size = window_size
        self.metrics: Dict[str, deque] = defaultdict(deque)
        self.lock = threading.Lock()

    def record_metric(self, name: str, value: float) -> None:
        """Record a metric value."""
        with self.lock:
            now = time.time()
            self.metrics[name].append((now, value))

            # Remove old entries outside window
            cutoff = now - self.window_size
            while self.metrics[name] and self.metrics[name][0][0] < cutoff:
                self.metrics[name].popleft()

    def get_metric_stats(self, name: str) -> Dict[str, float]:
        """Get statistics for a metric."""
        with self.lock:
            values = self.metrics[name]
            if not values:
                return {"count": 0, "avg": 0, "min": 0, "max": 0, "p99": 0}

            nums = [v for _, v in values]
            nums_sorted = sorted(nums)
            count = len(nums)

            return {
                "count": count,
                "avg": sum(nums) / count,
                "min": min(nums),
                "max": max(nums),
                "p99": nums_sorted[int(count * 0.99)] if count > 0 else 0,
            }

    def record_error(self, endpoint: str, status_code: int) -> None:
        """Record an error for an endpoint."""
        self.record_metric(f"error_{endpoint}", 1 if status_code >= 400 else 0)

    def record_latency(self, endpoint: str, duration: float) -> None:
        """Record latency for an endpoint."""
        self.record_metric(f"latency_{endpoint}", duration)

        # Log slow endpoints
        if duration > SLOW_ENDPOINT_THRESHOLD:
            logger.warning(f"Slow endpoint: {endpoint} took {duration:.2f}s")


class QueryProfiler:
    """Profile database and API queries."""

    def __init__(self):
        self.slow_queries: List[Dict[str, Any]] = []
        self.lock = threading.Lock()

    def record_query(
        self,
        query_type: str,
        operation: str,
        duration: float,
        table: Optional[str] = None,
        error: Optional[str] = None,
    ) -> None:
        """Record a query execution."""
        if duration > SLOW_QUERY_THRESHOLD:
            with self.lock:
                self.slow_queries.append(
                    {
                        "timestamp": datetime.now(timezone.utc).isoformat(),
                        "type": query_type,
                        "operation": operation,
                        "table": table,
                        "duration": duration,
                        "error": error,
                    }
                )

                # Keep only last 100 slow queries
                if len(self.slow_queries) > 100:
                    self.slow_queries.pop(0)

                logger.warning(
                    f"Slow {query_type}: {operation} on {table} took {duration:.2f}s"
                )

    def get_slow_queries(self, limit: int = 10) -> List[Dict[str, Any]]:
        """Get recent slow queries."""
        with self.lock:
            return list(reversed(self.slow_queries[-limit:]))


# Global instances
metrics_collector = MetricsCollector()
query_profiler = QueryProfiler()


def track_endpoint_metrics(func: Callable) -> Callable:
    """Decorator to track endpoint performance metrics."""

    @wraps(func)
    async def wrapper(*args: Any, **kwargs: Any) -> Any:
        endpoint = func.__name__
        start_time = time.time()

        try:
            result = await func(*args, **kwargs)
            duration = time.time() - start_time
            metrics_collector.record_latency(endpoint, duration)
            return result
        except Exception as e:
            duration = time.time() - start_time
            logger.error(f"Endpoint error: {endpoint} failed after {duration:.2f}s: {e}")
            raise

    return wrapper


def profile_query(
    query_type: str = "db",
    operation: str = "query",
    table: Optional[str] = None,
) -> Callable:
    """Decorator to profile database/API query performance."""

    def decorator(func: Callable) -> Callable:
        @wraps(func)
        def wrapper(*args: Any, **kwargs: Any) -> Any:
            start_time = time.time()
            error = None

            try:
                result = func(*args, **kwargs)
                return result
            except Exception as e:
                error = str(e)
                raise
            finally:
                duration = time.time() - start_time
                query_profiler.record_query(
                    query_type=query_type,
                    operation=operation,
                    duration=duration,
                    table=table,
                    error=error,
                )

        return wrapper

    return decorator


class HealthCheck:
    """System health check status."""

    def __init__(self):
        self.status = {
            "database": "unknown",
            "email": "unknown",
            "llm": "unknown",
            "sentry": "unknown",
            "cache": "unknown",
        }
        self.last_updated = None
        self.lock = threading.Lock()

    def update(self, service: str, status: str) -> None:
        """Update service health status."""
        with self.lock:
            self.status[service] = status
            self.last_updated = datetime.now(timezone.utc)

    def get_status(self) -> Dict[str, Any]:
        """Get current health status."""
        with self.lock:
            return {
                "status": self.status,
                "timestamp": self.last_updated.isoformat() if self.last_updated else None,
                "overall": "healthy" if all(s == "ok" for s in self.status.values()) else "degraded",
            }


health_check = HealthCheck()


def get_performance_report() -> Dict[str, Any]:
    """Generate performance report for monitoring."""
    return {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "slow_queries": query_profiler.get_slow_queries(10),
        "error_rate": metrics_collector.get_metric_stats("error_rate"),
        "endpoint_latencies": {
            name: metrics_collector.get_metric_stats(name)
            for name in metrics_collector.metrics
            if name.startswith("latency_")
        },
        "health": health_check.get_status(),
    }

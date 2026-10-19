"""Dedicated production process for durable lab-analysis follow-up recovery.

It has no HTTP surface and does not run inside Uvicorn.  All clinical input is
read through the existing frozen-ledger dispatcher; this worker never calls the
analysis pipeline, KB evaluation, or an LLM.
"""
from __future__ import annotations

import asyncio
import logging
import signal

from app.config import settings
from app.services.recovery_dispatcher import recover_global_pending_report_followups

logger = logging.getLogger(__name__)


async def run_recovery_cycle() -> dict[str, int]:
    """Run one bounded cycle. The result contains counters only, never PHI."""
    return await recover_global_pending_report_followups(
        max_reports=settings.recovery_worker_batch_size,
        concurrency=settings.recovery_worker_concurrency,
    )


async def run_worker(*, stop_event: asyncio.Event | None = None) -> None:
    """Run until SIGTERM/SIGINT; durable rows remain for the next process."""
    if not settings.recovery_worker_enabled:
        raise RuntimeError("recovery_worker_disabled")
    stopped = stop_event or asyncio.Event()
    while not stopped.is_set():
        try:
            result = await run_recovery_cycle()
            logger.info(
                "autonomous_recovery_cycle discovered=%s processed=%s failed=%s",
                result["discovered"], result["processed"], result["failed"],
            )
        except Exception as exc:
            logger.error("autonomous_recovery_cycle_failed exception_type=%s", type(exc).__name__)
        try:
            await asyncio.wait_for(stopped.wait(), timeout=settings.recovery_worker_interval_seconds)
        except TimeoutError:
            pass
    logger.info("autonomous_recovery_worker_stopped")


def main() -> None:
    async def _main() -> None:
        stop_event = asyncio.Event()
        loop = asyncio.get_running_loop()
        for sig in (signal.SIGTERM, signal.SIGINT):
            loop.add_signal_handler(sig, stop_event.set)
        await run_worker(stop_event=stop_event)

    asyncio.run(_main())


if __name__ == "__main__":
    main()

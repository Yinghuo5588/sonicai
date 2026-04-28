"""Background task registry — prevents GC from collecting running tasks."""

import asyncio
import logging

logger = logging.getLogger(__name__)

_background_tasks: set[asyncio.Task] = set()
_semaphore: asyncio.Semaphore | None = None
_max_concurrent: int = 2


async def get_semaphore() -> asyncio.Semaphore:
    global _semaphore
    if _semaphore is None:
        _semaphore = asyncio.Semaphore(_max_concurrent)
    return _semaphore


def set_max_concurrent(value: int) -> None:
    global _max_concurrent, _semaphore
    _max_concurrent = value
    _semaphore = asyncio.Semaphore(value)
    logger.info(f"[task_registry] max_concurrent_tasks updated to {value}")


def create_background_task(coro, *, name: str | None = None) -> asyncio.Task:
    """Create a background task protected by the global semaphore."""
    async def _semaphore_protected():
        sem = await get_semaphore()
        async with sem:
            task = asyncio.create_task(coro, name=name)
            _background_tasks.add(task)
            task.add_done_callback(_task_done)
            await task

    task = asyncio.create_task(_semaphore_protected(), name=name)
    _background_tasks.add(task)
    task.add_done_callback(_task_done)
    return task


def _task_done(task: asyncio.Task):
    _background_tasks.discard(task)
    if task.cancelled():
        logger.info(f"[task] {task.get_name()} was cancelled")
    elif exc := task.exception():
        logger.error(f"[task] {task.get_name()} failed with: {exc}", exc_info=exc)
    else:
        logger.debug(f"[task] {task.get_name()} completed successfully")


def get_active_tasks() -> list[str]:
    """Return names of currently running background tasks (for diagnostics)."""
    return [t.get_name() for t in _background_tasks if not t.done()]

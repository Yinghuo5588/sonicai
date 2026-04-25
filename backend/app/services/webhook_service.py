"""Webhook service."""

import asyncio
import json
from datetime import datetime, timezone, timedelta
import httpx

from sqlalchemy import select
from app.db.session import AsyncSessionLocal
from app.db.models import SystemSettings, WebhookBatch, WebhookBatchItem


async def send_webhook_batch(batch_id: int) -> dict:
    """Send a webhook batch and update status."""
    async with AsyncSessionLocal() as db:
        result = await db.execute(select(WebhookBatch).where(WebhookBatch.id == batch_id))
        batch = result.scalar_one_or_none()
        if not batch:
            return {"success": False, "error": "Batch not found"}

        result_settings = await db.execute(select(SystemSettings))
        settings = result_settings.scalar_one_or_none()
        if not settings or not settings.webhook_url:
            batch.status = "failed"
            batch.response_body = "No webhook URL configured"
            await db.commit()
            return {"success": False, "error": "No webhook URL"}

        # Get items
        items_result = await db.execute(
            select(WebhookBatchItem).where(WebhookBatchItem.batch_id == batch_id)
        )
        items = items_result.scalars().all()

        payload = {
            "event": "missing_tracks_batch",
            "playlist_type": batch.playlist_type,
            "run_id": batch.run_id,
            "items": [
                {
                    "track": i.track,
                    "artist": i.artist,
                    "album": i.album,
                    "text": i.text,
                }
                for i in items
            ],
            "count": len(items),
            "created_at": batch.created_at.isoformat() if batch.created_at else datetime.now(timezone.utc).isoformat(),
        }

        headers = {"Content-Type": "application/json"}
        if settings.webhook_headers_json:
            try:
                extra = json.loads(settings.webhook_headers_json)
                headers.update(extra)
            except Exception:
                pass

        timeout = settings.webhook_timeout_seconds or 10

        try:
            async def _do_send():
                async with httpx.AsyncClient(timeout=float(timeout)) as client:
                    body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
                    response = await client.post(
                        settings.webhook_url,
                        content=body,
                        headers=headers,
                    )
                    batch.response_code = response.status_code
                    batch.response_body = response.text[:2000]
                    if 200 <= response.status_code < 300:
                        batch.status = "success"
                    else:
                        batch.status = "failed"
                        batch.retry_count += 1
                        if batch.retry_count < batch.max_retry_count:
                            batch.status = "retrying"
                            batch.next_retry_at = datetime.now(timezone.utc) + timedelta(minutes=_retry_interval(batch.retry_count))
            await _do_send()
        except Exception as e:
            batch.status = "failed"
            batch.response_body = str(e)[:2000]
            batch.retry_count += 1
            if batch.retry_count < batch.max_retry_count:
                batch.status = "retrying"
                batch.next_retry_at = datetime.now(timezone.utc) + timedelta(minutes=_retry_interval(batch.retry_count))

        await db.commit()
        return {"success": batch.status == "success", "code": batch.response_code}


def _retry_interval(retry_count: int) -> int:
    """Exponential backoff: 1min, 5min, 15min."""
    intervals = [1, 5, 15]
    idx = min(retry_count - 1, len(intervals) - 1)
    return intervals[idx]
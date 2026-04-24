"""Webhook batch routes."""

from fastapi import APIRouter, Depends
from sqlalchemy import select

from app.db.session import get_db, AsyncSessionLocal
from app.db.models import WebhookBatch, WebhookBatchItem
from app.api.deps import CurrentUser

router = APIRouter(prefix="/webhooks", tags=["webhooks"])


@router.get("/batches")
async def list_batches(current_user: CurrentUser, db: AsyncSessionLocal = Depends(get_db)):
    result = await db.execute(
        select(WebhookBatch)
        .order_by(WebhookBatch.created_at.desc())
        .limit(50)
    )
    batches = result.scalars().all()
    return [
        {
            "id": b.id,
            "run_id": b.run_id,
            "playlist_type": b.playlist_type,
            "status": b.status,
            "retry_count": b.retry_count,
            "max_retry_count": b.max_retry_count,
            "response_code": b.response_code,
            "created_at": b.created_at.isoformat() if b.created_at else None,
        }
        for b in batches
    ]


@router.get("/batches/{batch_id}")
async def get_batch(batch_id: int, current_user: CurrentUser, db: AsyncSessionLocal = Depends(get_db)):
    result = await db.execute(
        select(WebhookBatch).where(WebhookBatch.id == batch_id)
    )
    batch = result.scalar_one_or_none()
    if not batch:
        raise HTTPException(status_code=404, detail="Batch not found")

    items_result = await db.execute(
        select(WebhookBatchItem).where(WebhookBatchItem.batch_id == batch_id)
    )
    items = items_result.scalars().all()

    return {
        "id": batch.id,
        "run_id": batch.run_id,
        "playlist_type": batch.playlist_type,
        "status": batch.status,
        "response_code": batch.response_code,
        "response_body": batch.response_body,
        "retry_count": batch.retry_count,
        "created_at": batch.created_at.isoformat() if batch.created_at else None,
        "items": [
            {
                "id": i.id,
                "track": i.track,
                "artist": i.artist,
                "album": i.album,
                "text": i.text,
            }
            for i in items
        ],
    }


@router.post("/batches/{batch_id}/retry")
async def retry_batch(batch_id: int, current_user: CurrentUser, db: AsyncSessionLocal = Depends(get_db)):
    from app.services.webhook_service import send_webhook_batch
    from app.db.models import WebhookBatch
    import asyncio
    result = await db.execute(select(WebhookBatch).where(WebhookBatch.id == batch_id))
    batch = result.scalar_one_or_none()
    if not batch:
        raise HTTPException(status_code=404, detail="Batch not found")
    asyncio.create_task(send_webhook_batch(batch_id))
    return {"message": "Retry scheduled", "batch_id": batch_id}

"""Webhook batch routes."""

from fastapi import APIRouter
from sqlalchemy import select

from app.api.deps import CurrentUser

router = APIRouter(prefix="/webhooks", tags=["webhooks"])


@router.get("/batches")
async def list_batches(current_user: CurrentUser):
    async with __import__("app.db.session").AsyncSessionLocal() as session:
        result = await session.execute(
            select(__import__("app.db.models").WebhookBatch)
            .order_by(__import__("app.db.models").WebhookBatch.created_at.desc())
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
async def get_batch(batch_id: int, current_user: CurrentUser):
    async with __import__("app.db.session").AsyncSessionLocal() as session:
        result = await session.execute(
            select(__import__("app.db.models").WebhookBatch).where(__import__("app.db.models").WebhookBatch.id == batch_id)
        )
        batch = result.scalar_one_or_none()
        if not batch:
            return {"error": "Not found"}
        # Get items
        items_result = await session.execute(
            select(__import__("app.db.models").WebhookBatchItem).where(__import__("app.db.models").WebhookBatchItem.batch_id == batch_id)
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
                {"id": i.id, "track": i.track, "artist": i.artist, "album": i.album, "text": i.text}
                for i in items
            ],
        }


@router.post("/batches/{batch_id}/retry")
async def retry_batch(batch_id: int, current_user: CurrentUser):
    # TODO: enqueue retry
    return {"message": "Retry scheduled", "batch_id": batch_id}
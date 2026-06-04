"""Serve generated image assets (local file in dev, S3 redirect in prod)."""
from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import RedirectResponse, Response
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import get_db
from app.core.storage import presigned_url, read_local_asset
from app.models import Asset

router = APIRouter(prefix="/assets", tags=["assets"])


@router.get("/{asset_id}")
async def get_asset(asset_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    asset = await db.get(Asset, asset_id)
    if asset is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Asset not found")

    if bool((asset.generation_meta or {}).get("stored_in_s3")):
        url = presigned_url(asset.storage_key)
        if url:
            return RedirectResponse(url)

    data = read_local_asset(asset.storage_key)
    if data is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Asset bytes missing")
    return Response(
        content=data,
        media_type=asset.mime or "application/octet-stream",
        headers={"Cache-Control": "public, max-age=86400"},
    )

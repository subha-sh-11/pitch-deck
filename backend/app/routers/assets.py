"""Serve generated image assets (local file in dev, S3 redirect in prod)."""
from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import RedirectResponse, Response
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import get_db
from app.core.storage import load_asset_bytes, presigned_url, read_local_asset
from app.models import Asset

router = APIRouter(prefix="/assets", tags=["assets"])

_EXT = {"image/png": "png", "image/jpeg": "jpg", "image/webp": "webp", "image/gif": "gif"}


@router.get("/{asset_id}")
async def get_asset(
    asset_id: uuid.UUID,
    download: bool = Query(False),
    db: AsyncSession = Depends(get_db),
):
    asset = await db.get(Asset, asset_id)
    if asset is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Asset not found")

    stored_s3 = bool((asset.generation_meta or {}).get("stored_in_s3"))

    # Download: always serve the BYTES with an attachment header (no S3 redirect) so the browser
    # saves the file — a cross-origin redirect breaks fetch-based downloads.
    if download:
        data = load_asset_bytes(asset.storage_key, stored_s3) or read_local_asset(asset.storage_key)
        if data is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Asset bytes missing")
        ext = _EXT.get(asset.mime or "", "png")
        return Response(
            content=data,
            media_type=asset.mime or "application/octet-stream",
            headers={"Content-Disposition": f'attachment; filename="{asset_id}.{ext}"'},
        )

    # Serve the bytes THROUGH the backend (with its CORS headers) rather than redirecting to a
    # presigned S3/Floci URL. The redirect target has no CORS, which tainted the html2canvas
    # export ("Export failed"). Proxying keeps images same-origin-clean so PDF/PPTX capture works.
    data = load_asset_bytes(asset.storage_key, stored_s3) or read_local_asset(asset.storage_key)
    if data is None:
        # Last resort: hand back the presigned URL (display still works; export may taint).
        if stored_s3:
            url = presigned_url(asset.storage_key)
            if url:
                return RedirectResponse(url)
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Asset bytes missing")
    return Response(
        content=data,
        media_type=asset.mime or "application/octet-stream",
        headers={"Cache-Control": "public, max-age=86400"},
    )

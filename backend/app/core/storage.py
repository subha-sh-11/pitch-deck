"""Object storage (S3 / MinIO / R2) for generated images and uploads.

Resilient: if S3 is unreachable, `store_asset` falls back to an inline data URI so the
generation pipeline still yields a usable image URL in local/dev without MinIO.
"""
from __future__ import annotations

import base64
import os
from dataclasses import dataclass

from app.core.config import settings

try:
    import boto3
    from botocore.client import Config as _BotoConfig
except Exception:  # pragma: no cover
    boto3 = None  # type: ignore
    _BotoConfig = None  # type: ignore

_s3 = None
_bucket_ready = False
_s3_unavailable = False  # set after first failed reach so we don't retry per image


def get_s3():
    global _s3
    if boto3 is None or _s3_unavailable:
        return None
    if _s3 is None:
        _s3 = boto3.client(
            "s3",
            endpoint_url=settings.s3_endpoint,
            aws_access_key_id=settings.s3_key,
            aws_secret_access_key=settings.s3_secret,
            region_name=settings.s3_region,
            # Fail fast when MinIO/S3 isn't reachable → fall back to data URIs quickly.
            config=_BotoConfig(
                signature_version="s3v4",
                connect_timeout=2,
                read_timeout=5,
                retries={"max_attempts": 1},
            ),
        )
    return _s3


def ensure_bucket() -> bool:
    global _bucket_ready, _s3_unavailable
    if _bucket_ready:
        return True
    s3 = get_s3()
    if s3 is None:
        return False
    try:
        existing = {b["Name"] for b in s3.list_buckets().get("Buckets", [])}
        if settings.s3_bucket not in existing:
            s3.create_bucket(Bucket=settings.s3_bucket)
        _bucket_ready = True
        return True
    except Exception:
        _s3_unavailable = True  # stop hammering a dead endpoint
        return False


def presigned_url(key: str, expires: int = 3600) -> str | None:
    s3 = get_s3()
    if s3 is None:
        return None
    try:
        return s3.generate_presigned_url(
            "get_object",
            Params={"Bucket": settings.s3_bucket, "Key": key},
            ExpiresIn=expires,
        )
    except Exception:
        return None


@dataclass
class StoredAsset:
    key: str
    stored_in_s3: bool


def _local_path(key: str) -> str:
    base = os.path.abspath(settings.local_asset_dir)
    return os.path.join(base, key.replace("/", os.sep))


def store_asset(key: str, data: bytes, content_type: str) -> StoredAsset:
    """Persist bytes to S3 if reachable, else to a local file. Served via GET /assets/{id}."""
    s3 = get_s3()
    if s3 is not None and ensure_bucket():
        try:
            s3.put_object(Bucket=settings.s3_bucket, Key=key, Body=data, ContentType=content_type)
            return StoredAsset(key=key, stored_in_s3=True)
        except Exception:
            pass
    # local fallback
    path = _local_path(key)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "wb") as f:
        f.write(data)
    return StoredAsset(key=key, stored_in_s3=False)


def read_local_asset(key: str) -> bytes | None:
    path = _local_path(key)
    if os.path.exists(path):
        with open(path, "rb") as f:
            return f.read()
    return None


def load_asset_bytes(key: str, stored_in_s3: bool | None = None) -> bytes | None:
    """Read an asset's raw bytes back from wherever it lives (S3 if stored there, else local).

    Used server-side (e.g. feeding user reference images back into image generation), unlike
    `presigned_url`/`read_local_asset` which serve assets to the browser.
    """
    if not key:
        return None
    if stored_in_s3:
        s3 = get_s3()
        if s3 is not None:
            try:
                obj = s3.get_object(Bucket=settings.s3_bucket, Key=key)
                return obj["Body"].read()
            except Exception:
                pass  # fall through to a local copy if one exists
    return read_local_asset(key)


def data_uri(data: bytes, content_type: str) -> str:
    b64 = base64.b64encode(data).decode("ascii")
    return f"data:{content_type};base64,{b64}"

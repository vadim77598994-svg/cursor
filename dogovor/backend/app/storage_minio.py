"""
MinIO storage backend (вариант б) для PDF и подписей.
"""

from __future__ import annotations

from datetime import datetime, timedelta
from io import BytesIO

from minio import Minio

from app.config import settings


def _client() -> Minio:
    if not settings.minio_endpoint or not settings.minio_access_key or not settings.minio_secret_key:
        raise ValueError(
            "MinIO не настроен: задайте minio_endpoint/minio_access_key/minio_secret_key (data_backend=postgres)"
        )
    endpoint = (
        f"{settings.minio_endpoint}:{settings.minio_port}"
        if settings.minio_port
        else settings.minio_endpoint
    )
    return Minio(
        endpoint=endpoint,
        access_key=settings.minio_access_key,
        secret_key=settings.minio_secret_key,
        secure=bool(settings.minio_secure),
    )


def _ensure_bucket(bucket: str) -> None:
    client = _client()
    if not bucket:
        raise ValueError("bucket is empty")
    if not client.bucket_exists(bucket):
        client.make_bucket(bucket)


def get_presigned_url(object_key: str, expires_seconds: int | None = None) -> str:
    client = _client()
    bucket = settings.storage_bucket
    if not expires_seconds:
        expires_seconds = settings.minio_presign_seconds

    # Важно: presigned_get_object возвращает http(s) URL.
    return client.presigned_get_object(
        bucket_name=bucket,
        object_name=object_key,
        expires=timedelta(seconds=int(expires_seconds)),
    )


def upload_contract_pdf(contract_number: str, pdf_bytes: bytes) -> str:
    year = datetime.now().strftime("%Y")
    object_key = f"{year}/{contract_number}.pdf"
    bucket = settings.storage_bucket

    _ensure_bucket(bucket)

    client = _client()
    data = BytesIO(pdf_bytes)
    client.put_object(
        bucket_name=bucket,
        object_name=object_key,
        data=data,
        length=len(pdf_bytes),
        content_type="application/pdf",
    )
    return object_key


def download_contract_pdf(object_key: str) -> bytes | None:
    if not object_key or not object_key.strip():
        return None
    bucket = settings.storage_bucket
    client = _client()
    try:
        obj = client.get_object(bucket, object_key)
        try:
            return obj.read()
        finally:
            obj.close()
            obj.release_conn()
    except Exception:
        return None


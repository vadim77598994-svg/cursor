import logging
from datetime import datetime

from app.config import settings
from app.storage_minio import download_contract_pdf as minio_download_contract_pdf
from app.storage_minio import upload_contract_pdf as minio_upload_contract_pdf

logger = logging.getLogger(__name__)


def upload_contract_pdf(contract_number: str, pdf_bytes: bytes) -> str | None:
    """Загружает PDF в Storage (Supabase или MinIO). Возвращает object key/path."""
    year = datetime.now().strftime("%Y")
    path = f"{year}/{contract_number}.pdf"
    bucket = settings.storage_bucket
    try:
        return minio_upload_contract_pdf(contract_number, pdf_bytes)
    except Exception as e:
        logger.exception("MinIO upload failed for %s: %s", path, e)
        return None


def download_contract_pdf(pdf_path: str) -> bytes | None:
    """Скачивает PDF из Storage (Supabase или MinIO). Возвращает bytes или None."""
    if not pdf_path or not pdf_path.strip():
        return None
    bucket = settings.storage_bucket
    try:
        return minio_download_contract_pdf(pdf_path)
    except Exception as e:
        logger.exception("MinIO download failed for %s: %s", pdf_path, e)
        return None

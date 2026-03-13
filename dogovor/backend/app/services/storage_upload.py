import logging
from datetime import datetime

from app.config import settings
from app.db import supabase

logger = logging.getLogger(__name__)


def upload_contract_pdf(contract_number: str, pdf_bytes: bytes) -> str | None:
    """
    Загружает PDF в Supabase Storage. Путь: {year}/{contract_number}.pdf.
    Возвращает путь в bucket или None при ошибке.
    """
    year = datetime.now().strftime("%Y")
    path = f"{year}/{contract_number}.pdf"
    bucket = settings.storage_bucket
    try:
        supabase.storage.from_(bucket).upload(
            path,
            pdf_bytes,
            {"content-type": "application/pdf"},
        )
        logger.info("Contract PDF uploaded: %s/%s", bucket, path)
        return path
    except Exception as e:
        logger.exception("Storage upload failed for %s: %s", path, e)
        return None


def download_contract_pdf(pdf_path: str) -> bytes | None:
    """Скачивает PDF из Supabase Storage по пути. Возвращает bytes или None."""
    if not pdf_path or not pdf_path.strip():
        return None
    bucket = settings.storage_bucket
    try:
        data = supabase.storage.from_(bucket).download(pdf_path)
        return data if isinstance(data, bytes) else None
    except Exception as e:
        logger.exception("Storage download failed for %s: %s", pdf_path, e)
        return None

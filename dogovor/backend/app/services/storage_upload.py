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

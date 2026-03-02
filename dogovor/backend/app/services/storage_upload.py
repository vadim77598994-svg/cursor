from datetime import datetime

from app.config import settings
from app.db import supabase


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
        return path
    except Exception:
        return None

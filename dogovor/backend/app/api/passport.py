"""
Распознавание паспорта через Beorg API. Фото не сохраняются — только в памяти на время запроса.
Импорт beorg_recognize отложен до первого вызова, чтобы при отсутствии httpx или ошибке зависимостей приложение не падало при старте.
"""
import logging
from typing import Optional

from fastapi import APIRouter, File, HTTPException, UploadFile

from app.config import settings

router = APIRouter()
logger = logging.getLogger(__name__)


def _read_upload_in_memory(file: UploadFile, max_size: int = 20 * 1024 * 1024) -> bytes | None:
    """Читает файл в память (не на диск). max_size = 20 MB."""
    try:
        data = b""
        while chunk := file.file.read(64 * 1024):
            data += chunk
            if len(data) > max_size:
                return None
        return data if data else None
    except Exception:
        return None


@router.post("/passport/recognize")
async def passport_recognize(
    image_spread: UploadFile = File(..., description="Фото разворота 2–3 стр. паспорта"),
    image_registration: Optional[UploadFile] = File(None, description="Фото страницы с пропиской (опционально)"),
):
    """
    Распознаёт паспорт РФ: разворот обязателен, прописка опциональна.
    Фото не сохраняются; возвращает поля для формы (ФИО, даты, серия, номер, кем выдан, адрес).
    Требует настройки BEORG_PROJECT_ID, BEORG_TOKEN, BEORG_MACHINE_UID.
    """
    if not settings.beorg_project_id or not settings.beorg_token or not settings.beorg_machine_uid:
        raise HTTPException(
            status_code=503,
            detail="Сервис распознавания паспорта не настроен (Beorg). Используйте ручной ввод или настройте BEORG_* в переменных окружения.",
        )
    try:
        from app.services.beorg_recognize import recognize_passport
    except ImportError as e:
        logger.warning("Beorg recognize import failed: %s", e)
        raise HTTPException(
            status_code=503,
            detail="Модуль распознавания паспорта недоступен (проверьте зависимости, например httpx).",
        ) from e
    if not image_spread.content_type or not image_spread.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="Файл разворота должен быть изображением")
    spread_bytes = _read_upload_in_memory(image_spread)
    if not spread_bytes:
        raise HTTPException(status_code=400, detail="Не удалось прочитать файл разворота или он слишком большой")
    reg_bytes: bytes | None = None
    if image_registration and image_registration.filename:
        if image_registration.content_type and image_registration.content_type.startswith("image/"):
            reg_bytes = _read_upload_in_memory(image_registration)
    result = recognize_passport(
        settings.beorg_project_id,
        settings.beorg_token,
        settings.beorg_machine_uid,
        spread_bytes,
        reg_bytes,
    )
    if not result:
        raise HTTPException(
            status_code=422,
            detail="Не удалось распознать паспорт. Проверьте качество фото и повторите или введите данные вручную.",
        )
    return result

"""
Распознавание паспорта через Beorg API. Фото не сохраняются — только в памяти на время запроса.
Импорт beorg_recognize отложен до первого вызова, чтобы при отсутствии httpx или ошибке зависимостей приложение не падало при старте.
"""
import logging
from typing import Optional

from fastapi import APIRouter, BackgroundTasks, File, HTTPException, UploadFile

from app.config import settings
from app.services.passport_jobs import (
    create_passport_job,
    get_passport_job,
    run_passport_recognition_job,
)

router = APIRouter()
logger = logging.getLogger(__name__)


@router.get("/passport/status")
def passport_status():
    """Статус сервиса распознавания: настроен ли Beorg (без раскрытия секретов)."""
    configured = bool(
        settings.beorg_project_id and settings.beorg_token and settings.beorg_machine_uid
    )
    return {"beorg_configured": configured}


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


def _ensure_beorg_configured() -> None:
    if not settings.beorg_project_id or not settings.beorg_token or not settings.beorg_machine_uid:
        raise HTTPException(
            status_code=503,
            detail="Сервис распознавания паспорта не настроен (Beorg). Используйте ручной ввод или настройте BEORG_* в переменных окружения.",
        )


def _read_request_images(
    image_spread: UploadFile,
    image_registration: Optional[UploadFile],
) -> tuple[bytes, bytes | None]:
    if not image_spread.content_type or not image_spread.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="Файл разворота должен быть изображением")
    spread_bytes = _read_upload_in_memory(image_spread)
    if not spread_bytes:
        raise HTTPException(status_code=400, detail="Не удалось прочитать файл разворота или он слишком большой")
    reg_bytes: bytes | None = None
    if image_registration and image_registration.filename:
        if image_registration.content_type and image_registration.content_type.startswith("image/"):
            reg_bytes = _read_upload_in_memory(image_registration)
    return spread_bytes, reg_bytes


@router.post("/passport/recognize/start")
async def passport_recognize_start(
    background_tasks: BackgroundTasks,
    image_spread: UploadFile = File(..., description="Фото разворота 2–3 стр. паспорта"),
    image_registration: Optional[UploadFile] = File(None, description="Фото страницы с пропиской (опционально)"),
):
    """
    Запускает распознавание паспорта в фоне и сразу возвращает job_id.
    Нужен для мобильных сценариев, когда пользователь может свернуть приложение.
    """
    _ensure_beorg_configured()
    spread_bytes, reg_bytes = _read_request_images(image_spread, image_registration)
    job = create_passport_job()
    background_tasks.add_task(
        run_passport_recognition_job,
        job["job_id"],
        project_id=settings.beorg_project_id,
        token=settings.beorg_token,
        machine_uid=settings.beorg_machine_uid,
        image_spread=spread_bytes,
        image_registration=reg_bytes,
        preprocess=settings.preprocess_passport_image,
    )
    return {"job_id": job["job_id"], "status": job["status"]}


@router.get("/passport/recognize/status/{job_id}")
def passport_recognize_status(job_id: str):
    job = get_passport_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Задача распознавания не найдена или уже устарела")
    return job


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
    _ensure_beorg_configured()
    try:
        from app.services.beorg_recognize import recognize_passport
    except ImportError as e:
        logger.warning("Beorg recognize import failed: %s", e)
        raise HTTPException(
            status_code=503,
            detail="Модуль распознавания паспорта недоступен (проверьте зависимости, например httpx).",
        ) from e
    spread_bytes, reg_bytes = _read_request_images(image_spread, image_registration)

    if settings.preprocess_passport_image:
        from app.services.image_enhance import enhance_for_ocr
        enhanced_spread = enhance_for_ocr(spread_bytes)
        if enhanced_spread is not None:
            spread_bytes = enhanced_spread
            logger.debug("Spread image preprocessed before Beorg")
        if reg_bytes:
            enhanced_reg = enhance_for_ocr(reg_bytes)
            if enhanced_reg is not None:
                reg_bytes = enhanced_reg
                logger.debug("Registration image preprocessed before Beorg")

    result = recognize_passport(
        settings.beorg_project_id,
        settings.beorg_token,
        settings.beorg_machine_uid,
        spread_bytes,
        reg_bytes,
    )
    if not result:
        logger.warning("Passport recognize: Beorg returned no data (check Beorg logs for broken_reasons_ru)")
        raise HTTPException(
            status_code=422,
            detail="Не удалось распознать паспорт. Проверьте качество фото и повторите или введите данные вручную.",
        )
    logger.info("Passport recognize: success, fields extracted")
    return result

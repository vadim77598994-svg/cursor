"""
Распознавание паспорта РФ через Beorg API (разворот 2–3 и опционально страница прописки).
Фото в память не сохраняются: принимаем bytes, отправляем в API, возвращаем только извлечённые поля.
"""
import base64
import logging
import time
from typing import Any

import httpx

logger = logging.getLogger(__name__)

BEORG_ADD_URL = "https://api.beorg.ru/api/bescan/add_document"
BEORG_RESULT_URL = "https://api.beorg.ru/api/document/result"
POLL_INTERVAL = 2.0
POLL_MAX_WAIT = 45.0


def _beorg_recognize_sync(project_id: str, token: str, machine_uid: str, images_b64: list[str]) -> dict[str, Any] | None:
    """Отправка документа в Beorg и ожидание результата. Возвращает data первого документа или None."""
    if len(images_b64) == 0:
        return None
    is_two_images = len(images_b64) >= 2
    process_info = [
        {"key": "PASSPORT_REG1", "type": "PASSPORT_REG", "options": {"stages": ["verification"]}},
        {"key": "PASSPORT_REG1", "type": "PASSPORT_REG", "options": {"stages": ["verification"]}},
    ] if is_two_images else [
        {"key": "PASSPORT1", "type": "PASSPORT", "options": {"stages": ["verification"]}},
    ]
    images = images_b64[:2] if is_two_images else images_b64[:1]
    payload = {
        "project_id": project_id,
        "token": token,
        "machine_uid": machine_uid,
        "images": images,
        "process_info": process_info[: len(images)],
    }
    with httpx.Client(timeout=30.0) as client:
        r = client.post(BEORG_ADD_URL, json=payload)
        r.raise_for_status()
        body = r.json()
    document_id = body.get("document_id")
    if not document_id:
        logger.warning("Beorg add_document: no document_id in response")
        return None
    deadline = time.monotonic() + POLL_MAX_WAIT
    while time.monotonic() < deadline:
        time.sleep(POLL_INTERVAL)
        with httpx.Client(timeout=15.0) as client:
            r = client.get(f"{BEORG_RESULT_URL}/{document_id}", params={"token": token})
            r.raise_for_status()
            result = r.json()
        docs = result.get("documents") or []
        for doc in docs:
            data = doc.get("data")
            if data and isinstance(data, dict):
                return data
        if result.get("broken") is True:
            logger.warning("Beorg result: document marked broken")
            return None
    logger.warning("Beorg result: timeout waiting for result")
    return None


def _map_beorg_to_patient(data: dict[str, Any]) -> dict[str, str]:
    """Маппинг полей ответа Beorg в наши PatientData (только текстовые поля для договора)."""
    def s(v: Any) -> str:
        if v is None:
            return ""
        return str(v).strip()

    last = s(data.get("LastName"))
    first = s(data.get("FirstName"))
    middle = s(data.get("MiddleName"))
    fio_parts = [p for p in (last, first, middle) if p]
    patient_fio = " ".join(fio_parts) if fio_parts else ""

    return {
        "patient_fio": patient_fio,
        "patient_birth_date": s(data.get("BirthDate")),
        "passport_series": s(data.get("Series")),
        "passport_number": s(data.get("Number")),
        "passport_issued_by": s(data.get("IssuedBy")),
        "passport_date": s(data.get("IssueDate")),
        "reg_address": s(data.get("Address")),
    }


def recognize_passport(
    project_id: str,
    token: str,
    machine_uid: str,
    image_spread: bytes,
    image_registration: bytes | None = None,
) -> dict[str, str] | None:
    """
    Распознаёт паспорт РФ через Beorg API.
    image_spread — разворот 2–3 стр., image_registration — опционально страница прописки.
    Фото нигде не сохраняются. Возвращает словарь полей для подстановки в форму или None при ошибке.
    """
    images_b64 = [base64.b64encode(image_spread).decode("ascii")]
    if image_registration and len(image_registration) > 0:
        images_b64.append(base64.b64encode(image_registration).decode("ascii"))
    try:
        data = _beorg_recognize_sync(project_id, token, machine_uid, images_b64)
        if not data:
            return None
        return _map_beorg_to_patient(data)
    except httpx.HTTPError as e:
        logger.warning("Beorg API error: %s", e)
        return None
    except Exception as e:
        logger.exception("Beorg recognize failed: %s", e)
        return None

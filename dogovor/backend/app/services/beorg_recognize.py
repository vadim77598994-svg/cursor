"""
Распознавание паспорта РФ через Beorg API (разворот 2–3 и опционально страница прописки).
Документация: https://docs.beorg.ru/api_docs/universal/passport_reg/
Рукописное/улучшенное качество: https://docs.beorg.ru/api_docs/universal/handwriting/
- Один снимок: type PASSPORT; два снимка (разворот + прописка): type PASSPORT_REG.
- stages: ["verification"] — подключён для доп. функционала улучшенного качества (рукописное распознавание).
- Ответ: documents[].data — LastName, FirstName, MiddleName, IssuedBy, IssueDate, Series, Number, BirthDate, Address.
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
# Beorg возвращает 425 Too Early, пока документ обрабатывается — ждём перед первым опросом и при 425 повторяем
POLL_INITIAL_DELAY = 4.0
POLL_INTERVAL = 3.0
POLL_MAX_WAIT = 150.0  # до 2.5 мин: разворот и прописка могут обрабатываться долго при «некачественном» изображении


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
        logger.warning("Beorg add_document: no document_id in response, body keys=%s", list(body.keys()))
        return None
    logger.info("Beorg add_document: document_id=%s, polling for result (max %s s)", document_id, int(POLL_MAX_WAIT))
    time.sleep(POLL_INITIAL_DELAY)
    deadline = time.monotonic() + POLL_MAX_WAIT
    poll_425_count = 0
    while time.monotonic() < deadline:
        with httpx.Client(timeout=15.0) as client:
            r = client.get(f"{BEORG_RESULT_URL}/{document_id}", params={"token": token})
            if r.status_code == 425:
                poll_425_count += 1
                if poll_425_count <= 3 or poll_425_count % 5 == 0:
                    logger.info("Beorg 425 Too Early (#%s), retry in %s s", poll_425_count, POLL_INTERVAL)
                time.sleep(POLL_INTERVAL)
                continue
            r.raise_for_status()
            result = r.json()
        logger.info(
            "Beorg result: document_id=%s, keys=%s, broken=%s, documents_count=%s",
            document_id,
            list(result.keys()),
            result.get("broken"),
            len(result.get("documents") or []),
        )
        docs = result.get("documents") or []
        # Данные могут быть в documents[].data, в result.data или в полях самого doc при broken
        data = None
        for doc in docs:
            candidate = doc.get("data")
            if candidate and isinstance(candidate, dict):
                data = candidate
                break
        if not data and isinstance(result.get("data"), dict):
            data = result.get("data")
        if not data and docs and isinstance(docs[0], dict):
            data = _extract_data_from_doc(docs[0])
        if data:
            if result.get("broken") is True:
                broken_reasons = result.get("broken_reasons_ru") or result.get("broken_reasons") or []
                logger.info(
                    "Beorg result: document marked broken (%s), returning extracted fields anyway",
                    broken_reasons,
                )
            return data
        if result.get("broken") is True:
            broken_reasons = result.get("broken_reasons_ru") or result.get("broken_reasons") or []
            logger.warning(
                "Beorg result: document marked broken, no extracted data. broken_reasons_ru=%s, result_keys=%s",
                broken_reasons,
                list(result.keys()),
            )
            if docs:
                logger.info("First document keys: %s", list(docs[0].keys()) if docs[0] else [])
            return None
        time.sleep(POLL_INTERVAL)
    logger.warning(
        "Beorg result: timeout waiting for result (got %s x 425, waited %s s)",
        poll_425_count,
        int(POLL_MAX_WAIT),
    )
    return None


# Поля, которые Beorg может вернуть на верхнем уровне документа (при broken и т.п.)
BEORG_DATA_KEYS = (
    "LastName", "FirstName", "MiddleName", "IssuedBy", "IssuingAuthority", "IssueAuthority",
    "IssueDate", "Series", "Number", "BirthDate", "Address",
)


def _extract_data_from_doc(doc: dict[str, Any]) -> dict[str, Any] | None:
    """Если data пустой, пробуем собрать данные из полей самого doc (формат при broken)."""
    out = {}
    for key in BEORG_DATA_KEYS:
        val = doc.get(key)
        if val is not None and str(val).strip():
            out[key] = val
    return out if out else None


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

    # Защита: если в ФИО попал текст «кем выдан»/адрес (иногда Beorg путает блоки) — не подставлять
    if patient_fio and _looks_like_issuer_or_address(patient_fio):
        patient_fio = ""

    issued_by = s(data.get("IssuedBy")) or s(data.get("IssuingAuthority")) or s(data.get("IssueAuthority"))

    return {
        "patient_fio": patient_fio,
        "patient_birth_date": s(data.get("BirthDate")),
        "passport_series": s(data.get("Series")),
        "passport_number": s(data.get("Number")),
        "passport_issued_by": issued_by,
        "passport_date": s(data.get("IssueDate")),
        "reg_address": s(data.get("Address")),
    }


def _looks_like_issuer_or_address(text: str) -> bool:
    """Текст похож на «кем выдан» или адрес, а не на ФИО."""
    t = text.upper()
    return (
        "В ГОР." in t or "ГОР." in t
        or "ОБЛ." in t
        or "ОВД" in t
        or "ОТДЕЛЕН" in t
        or "ОФМС" in t
        or "УЛ." in t
        or "УЛИЦА" in t
        or "РЕГИОН" in t
    )


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

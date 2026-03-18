import logging
import time
from threading import Lock
from typing import Any
from uuid import uuid4

from app.services.beorg_recognize import recognize_passport

logger = logging.getLogger(__name__)

_JOB_TTL_SECONDS = 60 * 60
_jobs: dict[str, dict[str, Any]] = {}
_jobs_lock = Lock()


def _cleanup_expired_jobs() -> None:
    cutoff = time.time() - _JOB_TTL_SECONDS
    with _jobs_lock:
        expired = [job_id for job_id, job in _jobs.items() if job.get("updated_at", 0) < cutoff]
        for job_id in expired:
            _jobs.pop(job_id, None)


def _update_job(job_id: str, **updates: Any) -> None:
    with _jobs_lock:
        job = _jobs.get(job_id)
        if not job:
            return
        job.update(updates)
        job["updated_at"] = time.time()


def create_passport_job() -> dict[str, Any]:
    _cleanup_expired_jobs()
    now = time.time()
    job_id = uuid4().hex
    job = {
        "job_id": job_id,
        "status": "pending",
        "result": None,
        "error": None,
        "created_at": now,
        "updated_at": now,
    }
    with _jobs_lock:
        _jobs[job_id] = job
    return dict(job)


def get_passport_job(job_id: str) -> dict[str, Any] | None:
    _cleanup_expired_jobs()
    with _jobs_lock:
        job = _jobs.get(job_id)
        return dict(job) if job else None


def run_passport_recognition_job(
    job_id: str,
    *,
    project_id: str,
    token: str,
    machine_uid: str,
    image_spread: bytes,
    image_registration: bytes | None = None,
    preprocess: bool = False,
) -> None:
    _update_job(job_id, status="running", error=None)
    spread_bytes = image_spread
    reg_bytes = image_registration
    try:
        if preprocess:
            from app.services.image_enhance import enhance_for_ocr

            enhanced_spread = enhance_for_ocr(spread_bytes)
            if enhanced_spread is not None:
                spread_bytes = enhanced_spread
            if reg_bytes:
                enhanced_reg = enhance_for_ocr(reg_bytes)
                if enhanced_reg is not None:
                    reg_bytes = enhanced_reg

        result = recognize_passport(
            project_id,
            token,
            machine_uid,
            spread_bytes,
            reg_bytes,
        )
        if not result:
            _update_job(
                job_id,
                status="failed",
                error="Не удалось распознать паспорт. Проверьте качество фото и повторите или введите данные вручную.",
            )
            return

        _update_job(job_id, status="succeeded", result=result, error=None)
    except Exception:
        logger.exception("Passport recognition job failed: job_id=%s", job_id)
        _update_job(
            job_id,
            status="failed",
            error="Ошибка сервиса распознавания. Попробуйте ещё раз.",
        )

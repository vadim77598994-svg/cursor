import logging
from datetime import datetime

from fastapi import APIRouter, HTTPException
from fastapi.responses import Response

from app.db import supabase
from app.models.contracts import GenerateContractRequest
from app.services.contract_number import get_next_contract_number
from app.services.email_send import send_contract_pdf
from app.services.pdf_render import render_contract_html, render_contract_pdf
from app.services.signature_resize import fetch_and_resize_signature
from app.services.storage_upload import download_contract_pdf, upload_contract_pdf

router = APIRouter()
logger = logging.getLogger(__name__)


@router.post("/contracts/preview")
def preview_contract(body: GenerateContractRequest):
    """
    Возвращает HTML договора со всеми приложениями без подписей (для ознакомления на шаге 4).
    """
    try:
        loc = (
            supabase.table("dogovor_locations")
            .select("contract_prefix, address, city")
            .eq("id", body.location_id)
            .single()
            .execute()
        )
        if not loc.data:
            raise HTTPException(status_code=404, detail="Location not found")
        cabinet_address = loc.data["address"]
        city = loc.data["city"]

        staff_row = (
            supabase.table("dogovor_staff")
            .select("fio")
            .eq("id", body.staff_id)
            .single()
            .execute()
        )
        staff_fio = staff_row.data["fio"] if staff_row.data else ""

        current_date = datetime.now().strftime("%d.%m.%Y")
        context = {
            "contract_number": "—",
            "current_date": current_date,
            "city": city,
            "cabinet_address": cabinet_address,
            "staff_fio": staff_fio,
            "staff_signature_url": "",
            "staff_signature_data_url": None,
            "patient_fio": _safe(body.patient.patient_fio),
            "patient_birth_date": _safe(body.patient.patient_birth_date),
            "passport_series": _safe(body.patient.passport_series),
            "passport_number": _safe(body.patient.passport_number),
            "passport_issued_by": _safe(body.patient.passport_issued_by),
            "passport_date": _safe(body.patient.passport_date),
            "reg_address": _safe(body.patient.reg_address),
            "patient_signature_data_url": None,
        }
        html = render_contract_html(context)
        if not html:
            raise HTTPException(status_code=500, detail="Failed to render contract preview")
        return {"html": html}
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("preview_contract failed: %s", e)
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/contracts/{contract_id}/pdf")
def get_contract_pdf(contract_id: str):
    """
    Возвращает подписанный PDF договора по id (для шаринга: «Подписать и поделиться»).
    """
    try:
        row = (
            supabase.table("dogovor_contracts")
            .select("pdf_path, contract_number")
            .eq("id", contract_id)
            .single()
            .execute()
        )
        if not row.data:
            raise HTTPException(status_code=404, detail="Contract not found")
        pdf_path = (row.data or {}).get("pdf_path")
        contract_number = (row.data or {}).get("contract_number") or "contract"
        if not pdf_path:
            raise HTTPException(status_code=404, detail="PDF not found for this contract")
        pdf_bytes = download_contract_pdf(pdf_path)
        if not pdf_bytes:
            raise HTTPException(status_code=404, detail="PDF file not available")
        filename = f"dogovor_{contract_number.replace('/', '-')}.pdf"
        return Response(
            content=pdf_bytes,
            media_type="application/pdf",
            headers={
                "Content-Disposition": f'inline; filename="{filename}"',
            },
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("get_contract_pdf failed: %s", e)
        raise HTTPException(status_code=500, detail=str(e))


def _safe(s: str | None) -> str:
    return (s or "").strip() or "—"


@router.post("/contracts/generate")
def generate_contract(body: GenerateContractRequest):
    """
    Получить номер договора, сгенерировать PDF из шаблона, загрузить в Storage, сохранить метаданные в БД.
    """
    try:
        loc = (
            supabase.table("dogovor_locations")
            .select("contract_prefix, address, city")
            .eq("id", body.location_id)
            .single()
            .execute()
        )
        if not loc.data:
            raise HTTPException(status_code=404, detail="Location not found")
        prefix = loc.data["contract_prefix"]
        cabinet_address = loc.data["address"]
        city = loc.data["city"]

        staff_row = (
            supabase.table("dogovor_staff")
            .select("fio, signature_image_url")
            .eq("id", body.staff_id)
            .single()
            .execute()
        )
        staff_fio = staff_row.data["fio"] if staff_row.data else ""
        staff_signature_url = (staff_row.data or {}).get("signature_image_url") or ""
        staff_signature_data_url = None
        if staff_signature_url:
            staff_signature_data_url = fetch_and_resize_signature(staff_signature_url)

        contract_number = get_next_contract_number(prefix)
        logger.info("Contract number allocated: %s", contract_number)
        current_date = datetime.now().strftime("%d.%m.%Y")

        patient_signature_data_url = (body.signature_data_url or "").strip() or None
        context = {
            "contract_number": contract_number,
            "current_date": current_date,
            "city": city,
            "cabinet_address": cabinet_address,
            "staff_fio": staff_fio,
            "staff_signature_url": staff_signature_url,
            "staff_signature_data_url": staff_signature_data_url,
            "patient_fio": _safe(body.patient.patient_fio),
            "patient_birth_date": _safe(body.patient.patient_birth_date),
            "passport_series": _safe(body.patient.passport_series),
            "passport_number": _safe(body.patient.passport_number),
            "passport_issued_by": _safe(body.patient.passport_issued_by),
            "passport_date": _safe(body.patient.passport_date),
            "reg_address": _safe(body.patient.reg_address),
            "patient_signature_data_url": patient_signature_data_url,
        }

        pdf_bytes = render_contract_pdf(context)
        if not pdf_bytes:
            logger.warning("PDF not generated (xhtml2pdf missing or render error)")
        pdf_path = None
        if pdf_bytes:
            pdf_path = upload_contract_pdf(contract_number, pdf_bytes)
            if not pdf_path:
                logger.warning("Storage upload failed for %s", contract_number)

        row = {
            "contract_number": contract_number,
            "location_id": body.location_id,
            "staff_id": body.staff_id,
            "patient_fio": body.patient.patient_fio,
            "pdf_path": pdf_path,
            "device_uuid": body.device_uuid,
        }
        insert_result = supabase.table("dogovor_contracts").insert(row).execute()
        inserted = (insert_result.data or [{}])[0] if isinstance(insert_result.data, list) else (insert_result.data or {})
        contract_id = inserted.get("id") if isinstance(inserted, dict) else None
        logger.info("Contract row inserted: %s (id=%s)", contract_number, contract_id)

        email_sent = False
        email_fail_reason: str | None = None
        to_email = (body.patient.patient_email or "").strip()
        if to_email and pdf_bytes:
            email_sent, email_fail_reason = send_contract_pdf(
                to_email,
                contract_number,
                pdf_bytes,
                body.patient.patient_fio or "",
            )
        elif not to_email:
            email_fail_reason = "Email не указан в данных пациента (шаг «Проверка данных»)."

        msg = "Договор создан. PDF сохранён в Storage."
        if not pdf_path:
            msg = "Договор создан. PDF не сгенерирован (проверьте шаблон и Storage)."
        elif email_sent:
            msg = "Договор создан. PDF сохранён и отправлен на email клиента."

        return {
            "contract_number": contract_number,
            "contract_id": contract_id,
            "pdf_path": pdf_path,
            "email_sent": email_sent,
            "email_fail_reason": email_fail_reason,
            "message": msg,
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("generate_contract failed: %s", e)
        raise HTTPException(status_code=500, detail=str(e))

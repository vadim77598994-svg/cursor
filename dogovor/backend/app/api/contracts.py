from datetime import datetime

from fastapi import APIRouter, HTTPException

from app.db import supabase
from app.models.contracts import GenerateContractRequest
from app.services.contract_number import get_next_contract_number
from app.services.email_send import send_contract_pdf
from app.services.pdf_render import render_contract_pdf
from app.services.storage_upload import upload_contract_pdf

router = APIRouter()


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

        contract_number = get_next_contract_number(prefix)
        current_date = datetime.now().strftime("%d.%m.%Y")

        patient_signature_data_url = (body.signature_data_url or "").strip() or None
        context = {
            "contract_number": contract_number,
            "current_date": current_date,
            "city": city,
            "cabinet_address": cabinet_address,
            "staff_fio": staff_fio,
            "staff_signature_url": staff_signature_url,
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
        pdf_path = None
        if pdf_bytes:
            pdf_path = upload_contract_pdf(contract_number, pdf_bytes)

        row = {
            "contract_number": contract_number,
            "location_id": body.location_id,
            "staff_id": body.staff_id,
            "patient_fio": body.patient.patient_fio,
            "pdf_path": pdf_path,
            "device_uuid": body.device_uuid,
        }
        supabase.table("dogovor_contracts").insert(row).execute()

        email_sent = False
        to_email = (body.patient.patient_email or "").strip()
        if to_email and pdf_bytes:
            email_sent = send_contract_pdf(
                to_email,
                contract_number,
                pdf_bytes,
                body.patient.patient_fio or "",
            )

        msg = "Договор создан. PDF сохранён в Storage."
        if not pdf_path:
            msg = "Договор создан. PDF не сгенерирован (проверьте шаблон и Storage)."
        elif email_sent:
            msg = "Договор создан. PDF сохранён и отправлен на email клиента."

        return {
            "contract_number": contract_number,
            "pdf_path": pdf_path,
            "email_sent": email_sent,
            "message": msg,
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

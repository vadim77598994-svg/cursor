"""
Отправка письма с подписанным договором (PDF) на email клиента через SMTP.
Используется только если в .env заданы SMTP_*.
"""
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.base import MIMEBase
from email.mime.text import MIMEText
from email import encoders


def send_contract_pdf(
    to_email: str,
    contract_number: str,
    pdf_bytes: bytes,
    patient_fio: str,
) -> bool:
    """
    Отправляет письмо с вложением PDF на to_email.
    Возвращает True при успехе, False при ошибке или если SMTP не настроен.
    """
    from app.config import settings

    if not settings.smtp_host or not settings.smtp_user or not settings.smtp_password:
        return False

    from_addr = settings.smtp_from_email or settings.smtp_user
    from_name = (settings.smtp_from_name or "Пай Оптикс").strip()
    subject = f"Договор № {contract_number} — Пай Оптикс"
    body = f"""Здравствуйте.

Во вложении — подписанный договор № {contract_number} (Пай Оптикс).
Пациент: {patient_fio or '—'}.

С уважением,
{from_name}
"""

    msg = MIMEMultipart()
    msg["From"] = f"{from_name} <{from_addr}>"
    msg["To"] = to_email
    msg["Subject"] = subject
    msg.attach(MIMEText(body, "plain", "utf-8"))

    part = MIMEBase("application", "pdf")
    part.set_payload(pdf_bytes)
    encoders.encode_base64(part)
    part.add_header(
        "Content-Disposition",
        "attachment",
        filename=f"dogovor_{contract_number.replace('/', '-')}.pdf",
    )
    msg.attach(part)

    try:
        with smtplib.SMTP_SSL(settings.smtp_host, settings.smtp_port) as server:
            server.login(settings.smtp_user, settings.smtp_password)
            server.sendmail(from_addr, [to_email], msg.as_string())
        return True
    except Exception:
        return False

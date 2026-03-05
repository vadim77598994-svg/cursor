"""
Отправка письма с подписанным договором (PDF) на email клиента.
Поддерживается два провайдера: SMTP (Яндекс, для Timeweb) и Resend API (для Railway).
"""
import base64
import logging
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.base import MIMEBase
from email.mime.text import MIMEText
from email import encoders

logger = logging.getLogger(__name__)


def check_smtp_connection() -> dict:
    """
    Проверяет подключение к SMTP (connect + login). Не отправляет письмо.
    Возвращает dict: smtp_configured, connection_ok, error (если есть).
    """
    from app.config import settings

    out: dict = {"smtp_configured": False, "connection_ok": False}
    if not settings.smtp_host or not settings.smtp_user or not settings.smtp_password:
        out["error"] = "SMTP не настроен: задайте SMTP_HOST, SMTP_USER, SMTP_PASSWORD"
        return out

    out["smtp_configured"] = True
    out["smtp_host"] = settings.smtp_host
    out["smtp_port"] = settings.smtp_port
    out["smtp_user"] = settings.smtp_user[:3] + "***" if len(settings.smtp_user) > 3 else "***"

    try:
        with smtplib.SMTP_SSL(settings.smtp_host, settings.smtp_port, timeout=10) as server:
            server.login(settings.smtp_user, settings.smtp_password)
        out["connection_ok"] = True
    except smtplib.SMTPAuthenticationError as e:
        out["error"] = "Ошибка авторизации SMTP: неверный логин или пароль приложения. Проверьте SMTP_USER и SMTP_PASSWORD в Railway."
    except smtplib.SMTPException as e:
        out["error"] = f"SMTP: {type(e).__name__}: {str(e)}"
    except OSError as e:
        out["error"] = f"Соединение: {type(e).__name__}: {str(e)}"
    except Exception as e:
        out["error"] = f"{type(e).__name__}: {str(e)}"
    return out


def _send_via_resend(
    to_email: str,
    subject: str,
    body: str,
    from_email: str,
    from_name: str,
    pdf_bytes: bytes,
    pdf_filename: str,
) -> bool:
    """Отправка через Resend API (для Railway)."""
    from app.config import settings

    if not settings.resend_api_key or not from_email:
        logger.warning("Resend not configured (RESEND_API_KEY, RESEND_FROM_EMAIL)")
        return False
    try:
        import resend
        resend.api_key = settings.resend_api_key
        params = {
            "from": f"{from_name} <{from_email}>",
            "to": [to_email],
            "subject": subject,
            "text": body,
            "attachments": [
                {
                    "content": base64.b64encode(pdf_bytes).decode("ascii"),
                    "filename": pdf_filename,
                }
            ],
        }
        resend.Emails.send(params)
        logger.info("Contract PDF sent via Resend to %s", to_email)
        return True
    except Exception as e:
        logger.exception("Resend failed to %s: %s", to_email, e)
        return False


def _send_via_smtp(
    to_email: str,
    subject: str,
    body: str,
    from_addr: str,
    from_name: str,
    pdf_bytes: bytes,
    pdf_filename: str,
) -> bool:
    """Отправка через SMTP (Яндекс и др., для Timeweb)."""
    from app.config import settings

    if not settings.smtp_host or not settings.smtp_user or not settings.smtp_password:
        return False
    msg = MIMEMultipart()
    msg["From"] = f"{from_name} <{from_addr}>"
    msg["To"] = to_email
    msg["Subject"] = subject
    msg.attach(MIMEText(body, "plain", "utf-8"))
    part = MIMEBase("application", "pdf")
    part.set_payload(pdf_bytes)
    encoders.encode_base64(part)
    part.add_header("Content-Disposition", "attachment", filename=pdf_filename)
    msg.attach(part)
    try:
        with smtplib.SMTP_SSL(settings.smtp_host, settings.smtp_port, timeout=5) as server:
            server.login(settings.smtp_user, settings.smtp_password)
            server.sendmail(from_addr, [to_email], msg.as_string())
        logger.info("Contract PDF sent via SMTP to %s", to_email)
        return True
    except Exception as e:
        logger.exception("SMTP failed to %s: %s", to_email, e)
        return False


def send_contract_pdf(
    to_email: str,
    contract_number: str,
    pdf_bytes: bytes,
    patient_fio: str,
) -> bool:
    """
    Отправляет письмо с вложением PDF на to_email.
    Провайдер: EMAIL_PROVIDER=resend|smtp; если не задан — при наличии RESEND_API_KEY используется Resend (удобно для Railway).
    Возвращает True при успехе, False при ошибке или если отправка не настроена.
    """
    from app.config import settings

    from_name = (settings.smtp_from_name or "Пай Оптикс").strip()
    subject = f"Договор № {contract_number} — Пай Оптикс"
    body = f"""Здравствуйте.

Во вложении — подписанный договор № {contract_number} (Пай Оптикс).
Пациент: {patient_fio or '—'}.

С уважением,
{from_name}
"""
    pdf_filename = f"dogovor_{contract_number.replace('/', '-')}.pdf"

    # На Railway SMTP недоступен; при наличии RESEND_API_KEY всегда используем Resend
    provider = (settings.email_provider or "").strip().lower()
    use_resend = bool(settings.resend_api_key) or provider == "resend"
    logger.info("Email: use_resend=%s (provider=%r, has_key=%s)", use_resend, provider, bool(settings.resend_api_key))
    if use_resend:
        from_email = (settings.resend_from_email or "").strip() or (settings.smtp_from_email or settings.smtp_user or "")
        from_name_resend = (settings.resend_from_name or from_name).strip()
        return _send_via_resend(to_email, subject, body, from_email, from_name_resend, pdf_bytes, pdf_filename)

    from_addr = settings.smtp_from_email or settings.smtp_user
    return _send_via_smtp(to_email, subject, body, from_addr or "", from_name, pdf_bytes, pdf_filename)

"""
Отправка письма с подписанным договором (PDF) на email клиента через SMTP.
Используется только если в .env заданы SMTP_*.
"""
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
        logger.warning("SMTP not configured (missing SMTP_HOST/USER/PASSWORD)")
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
        logger.info("Contract PDF sent to %s", to_email)
        return True
    except Exception as e:
        logger.exception("Failed to send contract email to %s: %s", to_email, e)
        return False

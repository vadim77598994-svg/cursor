import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api import locations, staff, contracts
from app.config import settings

logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s %(message)s")
logger = logging.getLogger(__name__)

app = FastAPI(title="Dogovor API", version="0.1.0")

_origins = settings.cors_origins_list or [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:3001",
    "http://127.0.0.1:3001",
]
app.add_middleware(
    CORSMiddleware,
    allow_origins=_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(locations.router, prefix="/api/v1", tags=["locations"])
app.include_router(staff.router, prefix="/api/v1", tags=["staff"])
app.include_router(contracts.router, prefix="/api/v1", tags=["contracts"])
try:
    from app.api import passport
    app.include_router(passport.router, prefix="/api/v1", tags=["passport"])
    logger.info("Passport router loaded")
except Exception as e:
    logger.warning("Passport router not loaded (Beorg/httpx): %s", e)

logger.info("Startup: routers registered")


@app.get("/health")
def health(pdf_check: bool = False):
    """GET /health — статус сервиса. GET /health?pdf_check=true — плюс проверка xhtml2pdf и шаблонов."""
    out = {"status": "ok"}
    if pdf_check:
        try:
            from app.services.pdf_render import TEMPLATES_DIR
            try:
                from xhtml2pdf import pisa  # noqa: F401
                has_xhtml2pdf = True
                import_error = None
            except ImportError as e:
                has_xhtml2pdf = False
                import_error = str(e)
            out["pdf"] = {
                "xhtml2pdf_available": has_xhtml2pdf,
                "templates_dir": str(TEMPLATES_DIR),
                "templates_dir_exists": TEMPLATES_DIR.exists(),
                "contract_html_exists": (TEMPLATES_DIR / "contract.html").exists() if TEMPLATES_DIR.exists() else False,
            }
            if import_error:
                out["pdf"]["xhtml2pdf_import_error"] = import_error
        except Exception as e:
            out["pdf"] = {"error": str(e)}
    return out


@app.get("/debug/smtp-check")
def debug_smtp_check():
    """Проверка настроек отправки писем: SMTP или Resend (без отправки). Секреты в ответ не попадают."""
    from app.config import settings
    out = {"email_provider": (settings.email_provider or "smtp").strip().lower()}
    if out["email_provider"] == "resend":
        out["resend_configured"] = bool(settings.resend_api_key and (settings.resend_from_email or settings.smtp_from_email))
        out["resend_from_email_set"] = bool((settings.resend_from_email or settings.smtp_from_email or "").strip())
        return out
    from app.services.email_send import check_smtp_connection
    return {**out, **check_smtp_connection()}


@app.get("/debug/cors")
def debug_cors():
    # Не содержит секретов; помогает быстро проверить, какие origins реально применены на проде.
    return {
        "cors_origins_raw": settings.cors_origins,
        "cors_origins_list": settings.cors_origins_list,
        "middleware_allow_origins": _origins,
    }


@app.get("/debug/pdf-status")
def debug_pdf_status():
    """Проверка готовности генерации PDF: xhtml2pdf и путь к шаблонам (без секретов)."""
    from app.services.pdf_render import TEMPLATES_DIR
    try:
        from xhtml2pdf import pisa  # noqa: F401
        has_xhtml2pdf = True
        import_error = None
    except ImportError as e:
        has_xhtml2pdf = False
        import_error = str(e)
    out = {
        "xhtml2pdf_available": has_xhtml2pdf,
        "templates_dir": str(TEMPLATES_DIR),
        "templates_dir_exists": TEMPLATES_DIR.exists(),
        "contract_html_exists": (TEMPLATES_DIR / "contract.html").exists() if TEMPLATES_DIR.exists() else False,
    }
    if import_error:
        out["xhtml2pdf_import_error"] = import_error
    return out

import io
import logging
from pathlib import Path

import jinja2

logger = logging.getLogger(__name__)
try:
    from xhtml2pdf import pisa
    _HAS_XHTML2PDF = True
except ImportError as e:
    _HAS_XHTML2PDF = False
    logger.warning("xhtml2pdf not available, PDF will not be generated: %s", e)

TEMPLATES_DIR = Path(__file__).resolve().parent.parent.parent / "templates"


def render_contract_pdf(context: dict) -> bytes | None:
    """Рендер HTML из Jinja2-шаблона и конвертация в PDF. Возвращает bytes или None при ошибке/отсутствии xhtml2pdf."""
    if not _HAS_XHTML2PDF:
        return None
    try:
        if not TEMPLATES_DIR.exists():
            logger.error("Templates dir not found: %s", TEMPLATES_DIR)
            return None
        env = jinja2.Environment(
            loader=jinja2.FileSystemLoader(str(TEMPLATES_DIR)),
            autoescape=jinja2.select_autoescape(["html", "xml"]),
        )
        template = env.get_template("contract.html")
        html = template.render(**context)
    except Exception as e:
        logger.exception("Jinja2 template render failed: %s", e)
        return None

    out = io.BytesIO()
    result = pisa.CreatePDF(html, dest=out, encoding="utf-8")
    if result.err:
        logger.warning("xhtml2pdf CreatePDF failed: err=%s (see pisa errors)", result.err)
        return None
    return out.getvalue()

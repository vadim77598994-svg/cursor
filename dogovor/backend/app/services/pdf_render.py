import base64
import io
import logging
import tempfile
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
FONTS_DIR = TEMPLATES_DIR.parent / "fonts"
FONT_FILE_NAME = "DejaVuSans.ttf"
REPORTLAB_FONT_NAME = "DejaVuSans"

_registered_font = False


def _register_dejavu_font():
    """Регистрирует DejaVu Sans в ReportLab (xhtml2pdf использует ReportLab) — кириллица в PDF."""
    global _registered_font
    if _registered_font:
        return
    font_path = FONTS_DIR / FONT_FILE_NAME
    if not font_path.exists():
        logger.warning("DejaVu font not found: %s", font_path)
        return
    try:
        from reportlab.pdfbase import pdfmetrics
        from reportlab.pdfbase.ttfonts import TTFont
        pdfmetrics.registerFont(TTFont(REPORTLAB_FONT_NAME, str(font_path)))
        _registered_font = True
        logger.debug("Registered font %s for PDF", REPORTLAB_FONT_NAME)
    except Exception as e:
        logger.warning("Failed to register DejaVu font: %s", e)


def _data_url_to_temp_file(uri: str) -> str | None:
    """Декодирует data URL (data:image/png;base64,...) во временный файл. Возвращает путь или None."""
    if not uri.startswith("data:"):
        return None
    try:
        header, _, b64 = uri.partition(",")
        if not b64:
            return None
        data = base64.b64decode(b64)
        suffix = ".png" if "png" in header else ".jpg"
        f = tempfile.NamedTemporaryFile(delete=False, suffix=suffix)
        f.write(data)
        f.close()
        return f.name
    except Exception:
        return None


def _make_link_callback(base_path: Path):
    """link_callback для pisa: data URL подписи → temp файл; шрифт fonts/DejaVuSans.ttf → явный путь; остальное — base_path."""
    base_path = base_path.resolve()
    font_file = base_path / "fonts" / FONT_FILE_NAME

    def link_callback(uri: str, _basepath: str | None = None):
        if not uri or not uri.strip():
            return None
        uri = uri.strip()
        if uri.startswith("data:"):
            return _data_url_to_temp_file(uri)
        # Шрифт для кириллицы: xhtml2pdf запрашивает по url из @font-face
        if ("fonts" in uri and FONT_FILE_NAME in uri) or (uri.endswith(".ttf") and font_file.exists()):
            return str(font_file)
        if Path(uri).is_absolute() and Path(uri).exists():
            return uri
        candidate = (base_path / uri).resolve()
        if candidate.exists() and candidate.is_file():
            return str(candidate)
        return None

    return link_callback


def render_contract_pdf(context: dict) -> bytes | None:
    """Рендер HTML из Jinja2-шаблона и конвертация в PDF. Возвращает bytes или None при ошибке/отсутствии xhtml2pdf."""
    if not _HAS_XHTML2PDF:
        return None
    try:
        if not TEMPLATES_DIR.exists():
            logger.error("Templates dir not found: %s", TEMPLATES_DIR)
            return None
        font_path = FONTS_DIR / FONT_FILE_NAME
        _register_dejavu_font()
        ctx = dict(context)
        ctx["font_available"] = font_path.exists()
        logger.info("PDF font: path=%s exists=%s", font_path, ctx["font_available"])
        env = jinja2.Environment(
            loader=jinja2.FileSystemLoader(str(TEMPLATES_DIR)),
            autoescape=jinja2.select_autoescape(["html", "xml"]),
        )
        template = env.get_template("contract.html")
        html = template.render(**ctx)
    except Exception as e:
        logger.exception("Jinja2 template render failed: %s", e)
        return None

    base_path = TEMPLATES_DIR.parent
    link_cb = _make_link_callback(base_path)

    out = io.BytesIO()
    result = pisa.CreatePDF(
        html,
        dest=out,
        encoding="utf-8",
        path=str(base_path),
        link_callback=link_cb,
    )
    if result.err:
        logger.warning("xhtml2pdf CreatePDF failed: err=%s (see pisa errors)", result.err)
        return None
    pdf_bytes = out.getvalue()
    logger.info("PDF generated: %s bytes", len(pdf_bytes))
    return pdf_bytes

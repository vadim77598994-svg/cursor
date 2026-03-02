import io
from pathlib import Path

import jinja2

try:
    from xhtml2pdf import pisa
    _HAS_XHTML2PDF = True
except ImportError:
    _HAS_XHTML2PDF = False

TEMPLATES_DIR = Path(__file__).resolve().parent.parent.parent / "templates"


def render_contract_pdf(context: dict) -> bytes | None:
    """Рендер HTML из Jinja2-шаблона и конвертация в PDF. Возвращает bytes или None при ошибке/отсутствии xhtml2pdf."""
    if not _HAS_XHTML2PDF:
        return None
    env = jinja2.Environment(
        loader=jinja2.FileSystemLoader(str(TEMPLATES_DIR)),
        autoescape=jinja2.select_autoescape(["html", "xml"]),
    )
    template = env.get_template("contract.html")
    html = template.render(**context)

    out = io.BytesIO()
    result = pisa.CreatePDF(html, dest=out, encoding="utf-8")
    if result.err:
        return None
    return out.getvalue()

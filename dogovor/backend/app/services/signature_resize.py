"""
Загрузка изображения подписи по URL, ресайз до заданной высоты и возврат в виде data URL.
Нужно для предсказуемого размера подписи в PDF: xhtml2pdf плохо применяет height к внешним URL.
"""
import base64
import io
import logging
import urllib.request
from typing import Optional

logger = logging.getLogger(__name__)

try:
    from PIL import Image
    _HAS_PIL = True
except ImportError:
    _HAS_PIL = False
    logger.warning("PIL/Pillow not available, staff signature resize disabled")


def fetch_and_resize_signature(
    image_url: str,
    max_height_px: int = 42,
    timeout_sec: float = 10.0,
) -> Optional[str]:
    """
    Скачивает изображение по URL, масштабирует по высоте (сохраняя пропорции), возвращает data URL (PNG).
    При ошибке или отсутствии PIL возвращает None.
    """
    if not image_url or not (image_url.startswith("http://") or image_url.startswith("https://")):
        return None
    if not _HAS_PIL:
        return None
    try:
        req = urllib.request.Request(image_url, headers={"User-Agent": "PyeOptics-Contract/1.0"})
        with urllib.request.urlopen(req, timeout=timeout_sec) as resp:
            raw = resp.read()
    except Exception as e:
        logger.warning("Failed to fetch staff signature from %s: %s", image_url[:80], e)
        return None
    try:
        img = Image.open(io.BytesIO(raw))
        img.load()
        if img.mode in ("RGBA", "P"):
            img = img.convert("RGBA")
        else:
            img = img.convert("RGB")
    except Exception as e:
        logger.warning("Failed to open staff signature image: %s", e)
        return None
    w, h = img.size
    if h <= 0:
        return None
    scale = max_height_px / h
    new_w = max(1, int(w * scale))
    new_h = max(1, int(h * scale))
    try:
        resample = Image.Resampling.LANCZOS
    except AttributeError:
        resample = Image.LANCZOS
    img = img.resize((new_w, new_h), resample)
    buf = io.BytesIO()
    img.save(buf, format="PNG", optimize=False)
    buf.seek(0)
    b64 = base64.standard_b64encode(buf.read()).decode("ascii")
    return f"data:image/png;base64,{b64}"

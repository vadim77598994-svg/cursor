"""
Загрузка изображения подписи по URL, ресайз до заданной высоты и возврат в виде data URL.
Нужно для предсказуемого размера подписи в PDF: xhtml2pdf плохо применяет height к внешним URL.
Встраиваем в повышенном разрешении (8× от 42px), чтобы высококачественные подписи не пикселились.
"""
import base64
import io
import logging
import urllib.request
import time
from typing import Optional

logger = logging.getLogger(__name__)

try:
    from PIL import Image
    _HAS_PIL = True
except ImportError:
    _HAS_PIL = False
    logger.warning("PIL/Pillow not available, staff signature resize disabled")


# В шаблоне отображаемая высота 42px; встраиваем в 8× (336px), чтобы подпись была чёткой при печати и зуме
STAFF_SIGNATURE_DISPLAY_HEIGHT_PX = 42
STAFF_SIGNATURE_EMBED_HEIGHT_PX = 336  # 8× — высокое разрешение без пикселизации

# Кеш результата ресайза подписи, чтобы ускорять генерацию договора.
# Подписи оптометристов статичны, поэтому повторно ресайзить их каждый раз не нужно.
_SIG_RESIZE_CACHE: dict[str, tuple[str, float]] = {}
_SIG_RESIZE_CACHE_TTL_SEC = 60 * 60  # 1 час


def fetch_and_resize_signature(
    image_url: str,
    max_height_px: int = STAFF_SIGNATURE_EMBED_HEIGHT_PX,
    timeout_sec: float = 10.0,
) -> Optional[str]:
    """
    Скачивает изображение по URL, масштабирует по высоте (сохраняя пропорции), возвращает data URL (PNG).
    Рекомендуется передавать max_height_px в 2–3× от отображаемого в шаблоне (42px), чтобы в PDF подпись была чёткой.
    При ошибке или отсутствии PIL возвращает None.
    """
    if not image_url or not (image_url.startswith("http://") or image_url.startswith("https://")):
        return None
    if not _HAS_PIL:
        return None

    # Быстрый возврат из кеша.
    cached = _SIG_RESIZE_CACHE.get(image_url)
    if cached:
        data_url, ts = cached
        if time.time() - ts < _SIG_RESIZE_CACHE_TTL_SEC:
            return data_url
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
    # Не увеличиваем мелкие изображения (апскейл даёт пикселизацию); только уменьшаем крупные
    target_h = min(max_height_px, h)
    scale = target_h / h
    new_w = max(1, int(w * scale))
    new_h = max(1, int(h * scale))
    if new_w != w or new_h != h:
        try:
            resample = Image.Resampling.LANCZOS
        except AttributeError:
            resample = Image.LANCZOS
        img = img.resize((new_w, new_h), resample)
    buf = io.BytesIO()
    # compress_level=3 — меньше сжатие, лучше чёткость подписи
    img.save(buf, format="PNG", optimize=False, compress_level=3)
    buf.seek(0)
    b64 = base64.standard_b64encode(buf.read()).decode("ascii")
    data_url = f"data:image/png;base64,{b64}"
    _SIG_RESIZE_CACHE[image_url] = (data_url, time.time())
    return data_url

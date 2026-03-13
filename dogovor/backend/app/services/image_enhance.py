"""
Предобработка фото паспорта перед отправкой в Биорг: ресайз, контраст, резкость.
Включается через PREPROCESS_PASSPORT_IMAGE=true (по умолчанию true для теста).
"""
import io
import logging
from typing import Optional

logger = logging.getLogger(__name__)

# Параметры по умолчанию (можно вынести в конфиг при необходимости)
MAX_LONG_SIDE = 2000
CONTRAST_FACTOR = 1.25
SHARPEN_FACTOR = 1.4
JPEG_QUALITY = 92


def enhance_for_ocr(image_bytes: bytes) -> Optional[bytes]:
    """
    Улучшает изображение для OCR/распознавания: ресайз, контраст, резкость.
    Принимает bytes (JPEG/PNG и т.д.), возвращает bytes (JPEG) или None при ошибке.
    """
    try:
        from PIL import Image, ImageEnhance, ImageFilter
    except ImportError as e:
        logger.warning("Pillow not available for image preprocessing: %s", e)
        return None

    try:
        img = Image.open(io.BytesIO(image_bytes)).convert("RGB")
    except Exception as e:
        logger.warning("Could not open image for preprocessing: %s", e)
        return None

    try:
        w, h = img.size
        if w <= 0 or h <= 0:
            return None

        # Ресайз: длинная сторона не больше MAX_LONG_SIDE
        long_side = max(w, h)
        if long_side > MAX_LONG_SIDE:
            ratio = MAX_LONG_SIDE / long_side
            new_w = max(1, round(w * ratio))
            new_h = max(1, round(h * ratio))
            img = img.resize((new_w, new_h), Image.Resampling.LANCZOS)

        # Контраст
        enhancer = ImageEnhance.Contrast(img)
        img = enhancer.enhance(CONTRAST_FACTOR)

        # Резкость (лёгкий unsharp)
        img = img.filter(ImageFilter.UnsharpMask(radius=1, percent=100, threshold=2))

        out = io.BytesIO()
        img.save(out, format="JPEG", quality=JPEG_QUALITY, optimize=True)
        out.seek(0)
        result = out.read()
        logger.debug("Image preprocessed: %s bytes -> %s bytes", len(image_bytes), len(result))
        return result
    except Exception as e:
        logger.exception("Image preprocessing failed: %s", e)
        return None

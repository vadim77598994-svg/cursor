/**
 * Предобработка изображения перед OCR: ресайз по длинной стороне и усиление контраста.
 * Улучшает стабильность Tesseract на фото с телефона/планшета.
 */

const MAX_SIZE_PX = 1800;
const CONTRAST_FACTOR = 1.15; // лёгкое усиление контраста

export async function preprocessForOcr(file: File): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const w = img.naturalWidth;
      const h = img.naturalHeight;
      const long = Math.max(w, h);
      let scale = 1;
      if (long > MAX_SIZE_PX) scale = MAX_SIZE_PX / long;
      const cw = Math.round(w * scale);
      const ch = Math.round(h * scale);

      const canvas = document.createElement("canvas");
      canvas.width = cw;
      canvas.height = ch;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        resolve(file);
        return;
      }
      ctx.drawImage(img, 0, 0, cw, ch);

      // Лёгкое усиление контраста через ImageData
      try {
        const imageData = ctx.getImageData(0, 0, cw, ch);
        const data = imageData.data;
        const mid = 128;
        for (let i = 0; i < data.length; i += 4) {
          data[i] = clamp(mid + (data[i] - mid) * CONTRAST_FACTOR);
          data[i + 1] = clamp(mid + (data[i + 1] - mid) * CONTRAST_FACTOR);
          data[i + 2] = clamp(mid + (data[i + 2] - mid) * CONTRAST_FACTOR);
        }
        ctx.putImageData(imageData, 0, 0);
      } catch {
        // контраст опционален
      }

      canvas.toBlob(
        (blob) => {
          if (blob) resolve(blob);
          else resolve(file);
        },
        "image/jpeg",
        0.92
      );
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Не удалось загрузить изображение"));
    };
    img.src = url;
  });
}

function clamp(v: number): number {
  return Math.max(0, Math.min(255, Math.round(v)));
}

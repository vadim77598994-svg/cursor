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

/**
 * Вырезает область, где на развороте паспорта РФ обычно расположены серия и номер (вертикальный столбик),
 * и поворачивает её на 90° по часовой, чтобы Tesseract видел горизонтальный текст.
 * Координаты — относительные (0–1), подобраны под типовой разворот 2–3 стр.
 */
export async function extractSeriesNumberRegion(file: File): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const w = img.naturalWidth;
      const h = img.naturalHeight;
      const x0 = Math.round(w * 0.05);
      const x1 = Math.round(w * 0.38);
      const y0 = Math.round(h * 0.35);
      const y1 = Math.round(h * 0.88);
      const cw = Math.max(1, x1 - x0);
      const ch = Math.max(1, y1 - y0);
      const canvas = document.createElement("canvas");
      canvas.width = ch;
      canvas.height = cw;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        resolve(file);
        return;
      }
      ctx.translate(ch, 0);
      ctx.rotate((90 * Math.PI) / 180);
      ctx.drawImage(img, x0, y0, cw, ch, 0, 0, cw, ch);
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

/**
 * Вырезает нижнюю часть разворота, где расположена МЧЗ (две строки по 44 символа).
 * По Приказу МВД 851 — нижняя четверть 3-й страницы. Горизонтальный текст, хорошо читается Tesseract.
 */
export async function extractMRZRegion(file: File): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const w = img.naturalWidth;
      const h = img.naturalHeight;
      const y0 = Math.round(h * 0.72);
      const ch = Math.max(50, h - y0);
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = ch;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        resolve(file);
        return;
      }
      ctx.drawImage(img, 0, y0, w, ch, 0, 0, w, ch);
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

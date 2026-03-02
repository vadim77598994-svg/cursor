"use client";

import { useRef, useState, useCallback } from "react";
import type { PatientData } from "@/lib/api";
import { parsePassportOcr } from "@/lib/parsePassportOcr";

const IMAGE_CLEAR_MS = 30_000;

type StepScanProps = {
  onRecognized: (data: Partial<PatientData>) => void;
  onManual: () => void;
};

export function StepScan({ onRecognized, onManual }: StepScanProps) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const clearTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearImage = useCallback(() => {
    if (clearTimerRef.current) {
      clearTimeout(clearTimerRef.current);
      clearTimerRef.current = null;
    }
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
    }
    setFile(null);
  }, [previewUrl]);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f || !f.type.startsWith("image/")) return;
    clearImage();
    setError(null);
    const url = URL.createObjectURL(f);
    setPreviewUrl(url);
    setFile(f);
    clearTimerRef.current = setTimeout(clearImage, IMAGE_CLEAR_MS);
  };

  const handleRecognize = async () => {
    if (!file) {
      setError("Сначала выберите или сделайте фото паспорта");
      return;
    }
    setError(null);
    setLoading(true);
    setProgress(0);
    try {
      const { createWorker } = await import("tesseract.js");
      const worker = await createWorker("rus", 1, {
        logger: (m) => {
          if (m.status === "recognizing text" && typeof m.progress === "number") {
            setProgress(Math.round(m.progress * 100));
          }
        },
      });
      const { data } = await worker.recognize(file);
      await worker.terminate();
      const parsed = parsePassportOcr(data.text);
      clearImage();
      onRecognized(parsed);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка распознавания");
    } finally {
      setLoading(false);
      setProgress(0);
    }
  };

  const handleManual = () => {
    clearImage();
    onManual();
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-gray-900">Сканирование паспорта</h2>
        <p className="mt-1 text-gray-600">
          Сфотографируйте разворот с фото (страницы 2–3) или выберите фото из галереи. Разместите паспорт в кадре, избегайте бликов.
        </p>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <label className="flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-xl border-2 border-medical-blue bg-medical-blueLight px-4 py-3 font-medium text-medical-blue">
          <input
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={handleFile}
            disabled={loading}
          />
          Выбрать фото / камера
        </label>
        <button
          type="button"
          onClick={handleManual}
          disabled={loading}
          className="rounded-xl border-2 border-gray-300 px-4 py-3 font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
        >
          Ввести вручную
        </button>
      </div>

      {previewUrl && (
        <div className="rounded-xl border-2 border-gray-200 bg-white p-2">
          <img
            src={previewUrl}
            alt="Предпросмотр"
            className="max-h-48 w-full object-contain"
          />
          <div className="mt-2 flex gap-2">
            <button
              type="button"
              onClick={() => { clearImage(); setError(null); }}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm hover:bg-gray-50"
            >
              Убрать фото
            </button>
            <button
              type="button"
              onClick={handleRecognize}
              disabled={loading}
              className="flex-1 rounded-xl bg-medical-blue px-4 py-3 font-medium text-white hover:opacity-90 disabled:opacity-50"
            >
              {loading ? `Распознаём… ${progress}%` : "Распознать"}
            </button>
          </div>
        </div>
      )}

      {error && (
        <div className="rounded-xl bg-red-50 p-4 text-red-800">{error}</div>
      )}
    </div>
  );
}

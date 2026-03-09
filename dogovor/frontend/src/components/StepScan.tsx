"use client";

import { useRef, useState, useCallback } from "react";
import type { PatientData } from "@/lib/api";
import { recognizePassport } from "@/lib/api";
import { parseSpreadOcr, parseRegistrationOcr, parseSeriesNumberFromCrop, parseMRZRawForSeriesNumber } from "@/lib/parsePassportOcr";
import { preprocessForOcr, extractSeriesNumberRegion, extractMRZRegion } from "@/lib/preprocessImage";
import { PassportTemplateGuide } from "@/components/PassportTemplateGuide";

const IMAGE_CLEAR_MS = 30_000;

type Phase = "spread" | "registration";

type StepScanProps = {
  onRecognized: (data: Partial<PatientData>) => void;
  onManual: () => void;
};

export function StepScan({ onRecognized, onManual }: StepScanProps) {
  const [phase, setPhase] = useState<Phase>("spread");
  const [spreadData, setSpreadData] = useState<Partial<PatientData> | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const clearTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** Файл разворота храним для вызова Beorg с двумя фото (разворот + прописка). Не сбрасываем при Tesseract. */
  const [spreadFileForApi, setSpreadFileForApi] = useState<File | null>(null);

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
    if (phase === "spread") setSpreadFileForApi(f);
    clearTimerRef.current = setTimeout(clearImage, IMAGE_CLEAR_MS);
  };

  const runOcr = useCallback(
    async (imageFile: File, isSpread: boolean) => {
      setError(null);
      setLoading(true);
      setProgress(0);
      try {
        const blob = await preprocessForOcr(imageFile);
        const { createWorker } = await import("tesseract.js");
        const worker = await createWorker(["rus", "eng"], 1, {
          logger: (m) => {
            if (m.status === "recognizing text" && typeof m.progress === "number") {
              setProgress(Math.round(m.progress * 100));
            }
          },
        });
        const { data } = await worker.recognize(blob);
        let parsed: Partial<PatientData>;
        if (isSpread) {
          parsed = parseSpreadOcr(data.text);
          try {
            const mrzBlob = await extractMRZRegion(imageFile);
            const { data: mrzData } = await worker.recognize(mrzBlob);
            const fromMRZ = parseMRZRawForSeriesNumber(mrzData.text);
            if (fromMRZ.passport_series) parsed.passport_series = fromMRZ.passport_series;
            if (fromMRZ.passport_number) parsed.passport_number = fromMRZ.passport_number;
          } catch {
            // МЧЗ не распознана — пробуем вертикальную область
          }
          if (!parsed.passport_series || !parsed.passport_number) {
            try {
              const cropBlob = await extractSeriesNumberRegion(imageFile);
              const { data: cropData } = await worker.recognize(cropBlob);
              const fromCrop = parseSeriesNumberFromCrop(cropData.text);
              if (fromCrop.passport_series) parsed.passport_series = fromCrop.passport_series;
              if (fromCrop.passport_number) parsed.passport_number = fromCrop.passport_number;
            } catch {
              // область серия/номер не распознана
            }
          }
          await worker.terminate();
          setSpreadData(parsed);
          clearImage();
          setPhase("registration");
          setFile(null);
        } else {
          await worker.terminate();
          parsed = parseRegistrationOcr(data.text);
          clearImage();
          onRecognized({ ...spreadData, ...parsed });
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "Ошибка распознавания");
      } finally {
        setLoading(false);
        setProgress(0);
      }
    },
    [clearImage, onRecognized, spreadData]
  );

  const handleRecognize = async () => {
    if (!file) {
      setError(phase === "spread" ? "Сначала выберите или сделайте фото разворота" : "Сначала выберите фото страницы с пропиской");
      return;
    }
    await runOcr(file, phase === "spread");
  };

  const handleSkipRegistration = () => {
    onRecognized({ ...spreadData });
  };

  const handleManualAddress = () => {
    clearImage();
    onRecognized({ ...spreadData });
  };

  const handleManual = () => {
    clearImage();
    setSpreadData(null);
    setPhase("spread");
    onManual();
  };

  const handleBackToSpread = () => {
    setSpreadData(null);
    setSpreadFileForApi(null);
    setPhase("spread");
    setError(null);
  };

  const handleBeorgRecognize = async () => {
    if (phase === "spread") {
      if (!file) {
        setError("Сначала выберите или сделайте фото разворота");
        return;
      }
      setError(null);
      setLoading(true);
      try {
        const result = await recognizePassport(file);
        setSpreadData(result);
        clearImage();
        setFile(null);
        setPhase("registration");
      } catch (e) {
        setError(e instanceof Error ? e.message : "Ошибка распознавания");
      } finally {
        setLoading(false);
      }
      return;
    }
    if (phase === "registration") {
      if (!spreadFileForApi || !file) {
        setError("Для распознавания через сервис нужны оба фото (разворот уже был — добавьте фото прописки и нажмите кнопку снова, или нажмите «Пропустить»).");
        return;
      }
      setError(null);
      setLoading(true);
      try {
        const result = await recognizePassport(spreadFileForApi, file);
        setSpreadFileForApi(null);
        clearImage();
        onRecognized(result);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Ошибка распознавания");
      } finally {
        setLoading(false);
      }
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-gray-900">Сканирование паспорта</h2>
        <p className="mt-1 text-gray-600">
          {phase === "spread"
            ? "Шаг 1: сфотографируйте разворот с фото (страницы 2–3). Разместите паспорт в кадре, избегайте бликов."
            : "Шаг 2: сфотографируйте страницу с пропиской. Если прописка от руки — нажмите «Ввести адрес вручную»."}
        </p>
      </div>

      <PassportTemplateGuide view={phase} />

      {spreadData && phase === "registration" && (
        <div className="rounded-xl bg-green-50 p-3 text-sm text-gray-700">
          <p className="font-medium text-green-800">Разворот распознан</p>
          <p className="mt-1 truncate">{spreadData.patient_fio || "—"}, {spreadData.passport_series || "—"} {spreadData.passport_number || "—"}</p>
          <button
            type="button"
            onClick={handleBackToSpread}
            className="mt-2 text-medical-blue underline"
          >
            Распознать разворот заново
          </button>
        </div>
      )}

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
          {phase === "spread" ? "Выбрать фото разворота / камера" : "Выбрать фото прописки / камера"}
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

      {phase === "registration" && (
        <div className="flex gap-2">
          <button
            type="button"
            onClick={handleManualAddress}
            disabled={loading}
            className="rounded-xl border-2 border-amber-500 bg-amber-50 px-4 py-3 font-medium text-amber-800 hover:bg-amber-100 disabled:opacity-50"
          >
            Ввести адрес вручную
          </button>
          <button
            type="button"
            onClick={handleSkipRegistration}
            disabled={loading}
            className="rounded-xl border-2 border-gray-300 px-4 py-3 font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            Пропустить (заполню на следующем шаге)
          </button>
        </div>
      )}

      {previewUrl && (
        <div className="rounded-xl border-2 border-gray-200 bg-white p-2">
          <img
            src={previewUrl}
            alt="Предпросмотр"
            className="max-h-48 w-full object-contain"
          />
          <div className="mt-2 flex flex-col gap-2">
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  clearImage();
                  setError(null);
                }}
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
                {loading
                  ? `Распознаём… ${progress}%`
                  : phase === "spread"
                    ? "Распознать разворот"
                    : "Распознать прописку"}
              </button>
            </div>
            <button
              type="button"
              onClick={handleBeorgRecognize}
              disabled={
                loading ||
                (phase === "registration" && !spreadFileForApi)
              }
              className="rounded-xl border-2 border-emerald-600 bg-emerald-50 px-4 py-3 font-medium text-emerald-800 hover:bg-emerald-100 disabled:opacity-50"
            >
              {loading ? "Ожидание…" : "Распознать через сервис (Beorg)"}
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

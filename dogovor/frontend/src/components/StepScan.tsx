"use client";

import { useRef, useState, useCallback } from "react";
import type { PatientData } from "@/lib/api";
import { recognizePassport } from "@/lib/api";

const IMAGE_CLEAR_MS = 30_000;

type Phase = "spread" | "registration";

type StepScanProps = {
  onRecognized: (data: Partial<PatientData>) => void;
  onManual: () => void;
};

export function StepScan({ onRecognized, onManual }: StepScanProps) {
  const [phase, setPhase] = useState<Phase>("spread");
  const [spreadData, setSpreadData] = useState<Partial<PatientData> | null>(null);
  /** Файл разворота храним для второго шага, чтобы отправить оба снимка в Beorg */
  const [spreadFile, setSpreadFile] = useState<File | null>(null);
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
      setError(phase === "spread" ? "Сначала выберите или сделайте фото разворота" : "Сначала выберите фото страницы с пропиской");
      return;
    }
    setError(null);
    setLoading(true);
    setProgress(0);
    try {
      if (phase === "spread") {
        const result = await recognizePassport(file);
        if (result && (result.patient_fio || result.passport_series || result.passport_number)) {
          setSpreadData(result);
          setSpreadFile(file);
          clearImage();
          setPhase("registration");
          setFile(null);
        }
        return;
      }
      if (phase === "registration" && spreadFile) {
        const result = await recognizePassport(spreadFile, file);
        if (result && (result.patient_fio || result.passport_series || result.reg_address)) {
          clearImage();
          setSpreadFile(null);
          onRecognized(result);
        }
        return;
      }
    } catch (apiErr) {
      const msg = apiErr instanceof Error ? apiErr.message : String(apiErr);
      setError(msg);
    } finally {
      setLoading(false);
      setProgress(0);
    }
  };

  const handleManual = () => {
    if (phase === "registration" && spreadData) {
      onRecognized(spreadData);
    } else {
      onManual();
    }
    clearImage();
    setSpreadData(null);
    setSpreadFile(null);
    setPhase("spread");
  };

  const handleBackToSpread = () => {
    setSpreadData(null);
    setSpreadFile(null);
    setPhase("spread");
    setError(null);
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-neutral-900">Сканирование паспорта</h2>
        <p className="mt-1 text-neutral-500">
          {phase === "spread"
            ? "Шаг 1: сфотографируйте разворот с фото (страницы 2–3). Разместите паспорт в кадре, избегайте бликов."
            : "Шаг 2: сфотографируйте страницу с пропиской."}
        </p>
      </div>

      {spreadData && phase === "registration" && (
        <div className="rounded-lg bg-green-50 p-3 text-sm text-neutral-700">
          <p className="font-medium text-green-800">Разворот распознан</p>
          <p className="mt-1 truncate">{spreadData.patient_fio || "—"}, {spreadData.passport_series || "—"} {spreadData.passport_number || "—"}</p>
          <button
            type="button"
            onClick={handleBackToSpread}
            className="mt-2 text-neutral-900 underline"
          >
            Распознать разворот заново
          </button>
        </div>
      )}

      <div className="flex flex-col gap-3 sm:flex-row">
        <label className="flex min-h-touch flex-1 cursor-pointer items-center justify-center gap-2 rounded-lg border border-neutral-300 bg-white px-4 py-3 font-medium text-neutral-900 hover:bg-neutral-50">
          <input
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleFile}
            disabled={loading}
          />
          {phase === "spread" ? "Фото разворота" : "Фото прописки"}
        </label>
        <button
          type="button"
          onClick={handleManual}
          disabled={loading}
          className="min-h-touch rounded-lg border border-neutral-300 px-4 py-3 font-medium text-neutral-700 hover:bg-neutral-50 disabled:opacity-50"
        >
          Ввести вручную
        </button>
      </div>

      {previewUrl && (
        <div className="rounded-lg border border-neutral-200 bg-white p-2">
          <img
            src={previewUrl}
            alt="Предпросмотр"
            className="max-h-48 w-full object-contain"
          />
          <div className="mt-2 flex gap-2">
            <button
                type="button"
                onClick={() => {
                  clearImage();
                  setError(null);
                }}
                className="min-h-touch rounded-lg border border-neutral-300 px-3 py-2 text-sm hover:bg-neutral-50"
              >
                Убрать фото
              </button>
            <button
              type="button"
              onClick={handleRecognize}
              disabled={loading}
              className="min-h-touch flex-1 rounded-lg bg-neutral-900 px-4 py-3 font-medium text-white hover:bg-neutral-800 disabled:opacity-50"
            >
              {loading
                ? (progress > 0 ? `Распознаём… ${progress}%` : "Распознаём…")
                : phase === "spread"
                  ? "Распознать разворот"
                  : "Распознать прописку"}
            </button>
          </div>
        </div>
      )}

      {error && (
        <div className="rounded-lg bg-red-50 p-4 text-red-800">{error}</div>
      )}
    </div>
  );
}

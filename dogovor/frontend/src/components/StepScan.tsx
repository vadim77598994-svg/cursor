"use client";

import { useRef, useState, useCallback, useEffect } from "react";
import type { Location, Staff, PatientData } from "@/lib/api";
import { recognizePassport, previewContract } from "@/lib/api";

const IMAGE_CLEAR_MS = 30_000;

type Phase = "spread" | "registration";

const emptyPatientForPreview: PatientData = {
  patient_fio: "",
  patient_birth_date: "",
  passport_series: "",
  passport_number: "",
  passport_issued_by: "",
  passport_date: "",
  reg_address: "",
  patient_email: "",
};

type StepScanProps = {
  location: Location;
  staff: Staff;
  onRecognized: (data: Partial<PatientData>) => void;
  onManual: () => void;
};

export function StepScan({ location, staff, onRecognized, onManual }: StepScanProps) {
  const [phase, setPhase] = useState<Phase>("spread");
  const [spreadData, setSpreadData] = useState<Partial<PatientData> | null>(null);
  const [spreadFile, setSpreadFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const clearTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [contractToggleOpen, setContractToggleOpen] = useState(false);
  const [contractPreviewHtml, setContractPreviewHtml] = useState<string | null>(null);
  const [contractPreviewLoading, setContractPreviewLoading] = useState(false);

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

  useEffect(() => {
    if (!contractToggleOpen || contractPreviewHtml !== null) return;
    setContractPreviewLoading(true);
    previewContract({
      location_id: location.id,
      staff_id: staff.id,
      patient: emptyPatientForPreview,
    })
      .then(({ html }) => setContractPreviewHtml(html))
      .catch(() => setContractPreviewHtml("<p>Не удалось загрузить текст договора.</p>"))
      .finally(() => setContractPreviewLoading(false));
  }, [contractToggleOpen, contractPreviewHtml, location.id, staff.id]);

  return (
    <div className="space-y-6">

      {/* ── Заголовок ──────────────────────────── */}
      <div>
        <h2 className="text-[13px] font-semibold uppercase tracking-[.05em] text-[var(--pye-text)]">
          Сканирование паспорта
        </h2>
        <p className="mt-1 text-[13px] text-[var(--pye-muted)]">
          {phase === "spread"
            ? "Шаг 1: сфотографируйте разворот с фото (стр. 2–3). Разместите паспорт в кадре, избегайте бликов."
            : "Шаг 2: сфотографируйте страницу с пропиской."}
        </p>
      </div>

      {/* ── Разворот распознан ─────────────────── */}
      {spreadData && phase === "registration" && (
        <div className="rounded-md border border-[var(--pye-border)] bg-white p-4">
          <p className="font-mono text-[9px] uppercase tracking-[.12em] text-[var(--pye-accent)]">
            Разворот распознан
          </p>
          <p className="mt-1 truncate text-[13px] text-[var(--pye-text)]">
            {spreadData.patient_fio || "—"}, {spreadData.passport_series || "—"} {spreadData.passport_number || "—"}
          </p>
          <button
            type="button"
            onClick={handleBackToSpread}
            className="mt-2 font-mono text-[10px] uppercase tracking-[.08em] text-[var(--pye-muted)] underline underline-offset-2 hover:text-[var(--pye-text)] transition-colors"
          >
            Распознать заново
          </button>
        </div>
      )}

      {/* ── Опции ──────────────────────────────── */}
      <div className="space-y-2">
        {/* Первичная опция — фото */}
        <label className="group relative block cursor-pointer rounded-md border border-[var(--pye-border)] bg-white px-5 py-5 transition-colors hover:border-[var(--pye-text)]">
          <input
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleFile}
            disabled={loading}
          />
          <span className="mb-1.5 block font-mono text-[9px] uppercase tracking-[.14em] text-[var(--pye-accent)]">
            {phase === "spread" ? "Рекомендуется" : "Шаг 2"}
          </span>
          <span className="block text-[14px] font-semibold tracking-tight text-[var(--pye-text)]">
            {phase === "spread" ? "Фото разворота" : "Фото прописки"}
          </span>
          <span className="mt-1 block font-mono text-[10px] leading-relaxed text-[var(--pye-muted)]">
            {phase === "spread"
              ? "Автоматическое распознавание через камеру устройства"
              : "Страница с адресом регистрации"}
          </span>
          <span
            className="absolute right-5 top-1/2 -translate-y-1/2 font-mono text-[var(--pye-border)] transition-colors group-hover:text-[var(--pye-text)]"
            aria-hidden
          >
            →
          </span>
        </label>

        {/* Вторичная опция — вручную */}
        <button
          type="button"
          onClick={handleManual}
          disabled={loading}
          className="group flex w-full items-center justify-between rounded-md border border-[var(--pye-border)] bg-white px-5 py-4 text-left transition-colors hover:border-[var(--pye-text)] disabled:opacity-50"
        >
          <div>
            <span className="block text-[14px] font-semibold tracking-tight text-[var(--pye-text)]">
              Ввести вручную
            </span>
            <span className="mt-0.5 block font-mono text-[10px] text-[var(--pye-muted)]">
              Заполнить самостоятельно
            </span>
          </div>
          <span
            className="ml-4 font-mono text-[var(--pye-border)] transition-colors group-hover:text-[var(--pye-text)]"
            aria-hidden
          >
            →
          </span>
        </button>
      </div>

      {/* ── Предпросмотр фото ──────────────────── */}
      {previewUrl && (
        <div className="rounded-md border border-[var(--pye-border)] bg-white p-3">
          <img
            src={previewUrl}
            alt="Предпросмотр"
            className="max-h-48 w-full rounded object-contain"
          />
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={() => { clearImage(); setError(null); }}
              className="min-h-[44px] rounded-[4px] border border-[var(--pye-border)] px-3 py-2 font-mono text-[11px] uppercase tracking-[.06em] text-[var(--pye-muted)] transition-colors hover:border-[var(--pye-text)] hover:text-[var(--pye-text)]"
            >
              Убрать
            </button>
            <button
              type="button"
              onClick={handleRecognize}
              disabled={loading}
              className="flex min-h-[44px] flex-1 items-center justify-between rounded-[4px] bg-[var(--pye-text)] px-4 py-3 transition-colors hover:bg-[#1C1C18] disabled:opacity-50"
            >
              <span className="flex-1 text-center text-[13px] font-medium text-white">
                {loading
                  ? progress > 0
                    ? `Распознаём… ${progress}%`
                    : "Распознаём…"
                  : phase === "spread"
                  ? "Распознать разворот"
                  : "Распознать прописку"}
              </span>
              {!loading && <span className="ml-2 font-mono text-white" aria-hidden>→</span>}
            </button>
          </div>
        </div>
      )}

      {/* ── Ошибка ────────────────────────────── */}
      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 font-mono text-[11px] text-red-800">
          {error}
        </div>
      )}

      {/* ── Договор ───────────────────────────── */}
      <div className="border-t border-[var(--pye-border)] pt-5">
        <button
          type="button"
          onClick={() => setContractToggleOpen((o) => !o)}
          className="flex w-full items-center justify-between rounded-md border border-[var(--pye-border)] bg-white px-[18px] py-3.5 text-left transition-colors hover:border-[var(--pye-text)]"
        >
          <span className="text-[13px] font-medium text-[var(--pye-text)]">
            Ознакомиться с текстом договора
          </span>
          <span className="font-mono text-[11px] text-[var(--pye-muted)]" aria-hidden>
            {contractToggleOpen ? "▼" : "▶"}
          </span>
        </button>
        {contractToggleOpen && (
          <div className="mt-2 rounded-md border border-[var(--pye-border)] bg-white p-2">
            {contractPreviewLoading ? (
              <p className="py-8 text-center font-mono text-[11px] uppercase tracking-[.08em] text-[var(--pye-muted)]">
                Загрузка…
              </p>
            ) : contractPreviewHtml ? (
              <iframe
                title="Текст договора"
                srcDoc={contractPreviewHtml}
                className="h-[60vh] w-full overflow-auto rounded border-0"
                sandbox="allow-same-origin"
              />
            ) : null}
          </div>
        )}
      </div>

    </div>
  );
}

"use client";

import { useRef, useState, useCallback, useEffect } from "react";
import type { Location, Staff, PatientData } from "@/lib/api";
import {
  fetchPassportRecognitionStatus,
  previewContract,
  startPassportRecognition,
} from "@/lib/api";

const IMAGE_CLEAR_MS = 30_000;
const PASSPORT_JOB_STORAGE_KEY = "dogovor:passport-recognition-job-id";
const PASSPORT_STATUS_POLL_MS = 2000;

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
  const [spreadFile, setSpreadFile] = useState<File | null>(null);
  const [registrationFile, setRegistrationFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const clearTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pollingRef = useRef(false);
  const [contractToggleOpen, setContractToggleOpen] = useState(false);
  const [contractPreviewHtml, setContractPreviewHtml] = useState<string | null>(null);
  const [contractPreviewLoading, setContractPreviewLoading] = useState(false);
  const hasPreviewFile = Boolean(file && previewUrl);
  const showManualOption = phase === "spread";
  const showRegistrationOption = phase === "registration" && (!registrationFile || hasPreviewFile);
  const isRegistrationCardActive = phase === "registration" && !registrationFile && !hasPreviewFile;
  const isRecognizePrimary = Boolean(registrationFile);

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
    if (!spreadFile) {
      setError("Сначала сделайте фото разворота (стр. 2–3)");
      return;
    }
    setError(null);
    setLoading(true);
    setProgress(0);
    try {
      const started = await startPassportRecognition(spreadFile, registrationFile);
      setActiveJobId(started.job_id);
      if (typeof window !== "undefined") {
        sessionStorage.setItem(PASSPORT_JOB_STORAGE_KEY, started.job_id);
      }
    } catch (apiErr) {
      const msg = apiErr instanceof Error ? apiErr.message : String(apiErr);
      setError(msg);
      setLoading(false);
    } finally {
      setProgress(0);
    }
  };

  const handleNextToRegistration = () => {
    if (!file) {
      setError("Сначала выберите или сделайте фото разворота (стр. 2–3)");
      return;
    }
    setError(null);
    setSpreadFile(file);
    setRegistrationFile(null);
    clearImage();
    setPhase("registration");
  };

  const handleSetRegistration = () => {
    if (!file) {
      setError("Сначала выберите или сделайте фото страницы с пропиской");
      return;
    }
    setError(null);
    setRegistrationFile(file);
    clearImage();
  };

  const handleManual = () => {
    onManual();
    clearImage();
    setSpreadFile(null);
    setRegistrationFile(null);
    setActiveJobId(null);
    if (typeof window !== "undefined") {
      sessionStorage.removeItem(PASSPORT_JOB_STORAGE_KEY);
    }
    setPhase("spread");
  };

  const handleBackToSpread = () => {
    setSpreadFile(null);
    setRegistrationFile(null);
    setActiveJobId(null);
    if (typeof window !== "undefined") {
      sessionStorage.removeItem(PASSPORT_JOB_STORAGE_KEY);
    }
    setPhase("spread");
    setError(null);
    setLoading(false);
  };

  const finishPolling = useCallback(() => {
    setActiveJobId(null);
    setLoading(false);
    if (typeof window !== "undefined") {
      sessionStorage.removeItem(PASSPORT_JOB_STORAGE_KEY);
    }
  }, []);

  const pollRecognitionStatus = useCallback(async (jobId: string) => {
    if (pollingRef.current) return;
    pollingRef.current = true;
    try {
      const status = await fetchPassportRecognitionStatus(jobId);
      if (status.status === "succeeded" && status.result) {
        clearImage();
        setSpreadFile(null);
        setRegistrationFile(null);
        finishPolling();
        onRecognized(status.result);
        return;
      }
      if (status.status === "failed") {
        setError(status.error || "Не удалось распознать паспорт");
        finishPolling();
        return;
      }
    } catch (e) {
      if (e instanceof Error) {
        if (/не найдена|устарела/i.test(e.message)) {
          setError("Распознавание больше недоступно. Начните заново.");
          finishPolling();
          return;
        }
        if (/load failed|failed to fetch|network/i.test(e.message)) {
          return;
        }
      }
    } finally {
      pollingRef.current = false;
    }
  }, [clearImage, finishPolling, onRecognized]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const storedJobId = sessionStorage.getItem(PASSPORT_JOB_STORAGE_KEY);
    if (storedJobId) {
      setActiveJobId(storedJobId);
      setLoading(true);
    }
  }, []);

  useEffect(() => {
    if (!activeJobId) return;
    void pollRecognitionStatus(activeJobId);
    const intervalId = window.setInterval(() => {
      void pollRecognitionStatus(activeJobId);
    }, PASSPORT_STATUS_POLL_MS);
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        void pollRecognitionStatus(activeJobId);
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      window.clearInterval(intervalId);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [activeJobId, pollRecognitionStatus]);

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
          Данные паспорта
        </h2>
      </div>

      {/* ── Разворот выбран ───────────────────── */}
      {spreadFile && phase === "registration" && (
        <div className="rounded-md border border-[var(--pye-border)] bg-white p-4">
          <p className="font-mono text-[9px] uppercase tracking-[.12em] text-emerald-600">
            Разворот выбран
          </p>
          <p className="mt-1 text-[13px] text-[var(--pye-text)]">Фото сохранено. Теперь можно добавить прописку.</p>
          <button
            type="button"
            onClick={handleBackToSpread}
            className="mt-2 font-mono text-[10px] uppercase tracking-[.08em] text-[var(--pye-muted)] underline underline-offset-2 hover:text-[var(--pye-text)] transition-colors"
          >
            Распознать заново
          </button>
        </div>
      )}

      {/* ── Прописка выбрана ───────────────────── */}
      {registrationFile && phase === "registration" && (
        <div className="rounded-md border border-[var(--pye-border)] bg-white p-4">
          <p className="font-mono text-[9px] uppercase tracking-[.12em] text-emerald-600">
            Прописка выбрана
          </p>
          <p className="mt-1 text-[13px] text-[var(--pye-text)]">Фото сохранено. Можно отправлять на распознавание.</p>
        </div>
      )}

      {/* ── Опции ──────────────────────────────── */}
      <div className="space-y-2">
        {/* Первичная опция — фото */}
        {(phase === "spread" || showRegistrationOption) && (
          <label
            className={`group relative block cursor-pointer rounded-md border px-5 py-5 transition-colors ${
              phase === "spread"
                ? "border-[var(--pye-text)] bg-[var(--pye-text)]"
                : isRegistrationCardActive
                ? "border-[var(--pye-text)] bg-[var(--pye-text)]"
                : "border-[var(--pye-border)] bg-white hover:border-[var(--pye-text)]"
            }`}
          >
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFile}
              disabled={loading}
            />
            <span
              className={`block text-[14px] font-semibold tracking-tight ${
                phase === "spread" || isRegistrationCardActive ? "text-white" : "text-[var(--pye-text)]"
              }`}
            >
              {phase === "spread" ? "Сканирование" : "Фото прописки"}
            </span>
            <span
              className={`mt-1 block font-mono text-[10px] leading-relaxed ${
                phase === "spread" || isRegistrationCardActive ? "text-white/55" : "text-[var(--pye-muted)]"
              }`}
            >
              {phase === "spread"
                ? "Сначала основной разворот, потом прописка."
                : "Опционально: если есть время — добавьте страницу с адресом регистрации"}
            </span>
            <span
              className={`absolute right-5 top-1/2 -translate-y-1/2 font-mono transition-colors ${
                phase === "spread" || isRegistrationCardActive
                  ? "text-white/55"
                  : "text-[var(--pye-border)] group-hover:text-[var(--pye-text)]"
              }`}
              aria-hidden
            >
              →
            </span>
          </label>
        )}

        {/* Вторичная опция — вручную */}
        {showManualOption && (
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
        )}
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
              onClick={phase === "spread" ? handleNextToRegistration : handleSetRegistration}
              disabled={loading}
              className="flex min-h-[44px] flex-1 items-center justify-between rounded-[4px] bg-[var(--pye-text)] px-4 py-3 transition-colors hover:bg-[#1C1C18] disabled:opacity-50"
            >
              <span className="flex-1 text-center text-[13px] font-medium text-white">
                {loading
                  ? progress > 0
                    ? `Распознаём… ${progress}%`
                    : "Распознаём…"
                  : phase === "spread"
                  ? "Далее — фото прописки"
                  : "Сохранить фото прописки"}
              </span>
              {!loading && <span className="ml-2 font-mono text-white" aria-hidden>→</span>}
            </button>
          </div>
        </div>
      )}

      {/* ── Запуск распознавания ───────────────── */}
      {phase === "registration" && spreadFile && (
        <div className="space-y-2">
          <button
            type="button"
            onClick={handleRecognize}
            disabled={loading}
            className={`flex min-h-[48px] w-full items-center justify-between rounded-[4px] px-5 py-4 transition-colors disabled:opacity-50 ${
              isRecognizePrimary
                ? "bg-[var(--pye-text)] hover:bg-[#1C1C18]"
                : "border border-[var(--pye-border)] bg-white hover:border-[var(--pye-text)]"
            }`}
          >
            <span
              className={`flex-1 text-center text-[13px] font-medium ${
                isRecognizePrimary ? "text-white" : "text-[var(--pye-text)]"
              }`}
            >
              {loading
                ? progress > 0
                  ? `Распознаём… ${progress}%`
                  : "Распознаём…"
                : registrationFile
                ? "Распознать (разворот + прописка)"
                : "Распознать (только основной разворот)"}
            </span>
            {!loading && (
              <span
                className={`ml-3 font-mono text-base ${isRecognizePrimary ? "text-white" : "text-[var(--pye-muted)]"}`}
                aria-hidden
              >
                →
              </span>
            )}
          </button>
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

      {/* ── Безопасность данных ───────────────── */}
      <div className="space-y-2">
        <div className="rounded-md border border-[var(--pye-border)] bg-white p-4">
          <p className="font-mono text-[9px] uppercase tracking-[.14em] text-[var(--pye-muted)]">
            Безопасность персональных данных
          </p>
          <p className="mt-1 text-[12px] text-[var(--pye-muted)]">
            Для клиентов, которые хотят подробнее ознакомиться с юридическими документами и политикой обработки данных.
          </p>
        </div>

        <a
          href="https://beorg.ru/politika-konfidencialnosti"
          target="_blank"
          rel="noopener noreferrer"
          className="group flex min-h-[44px] w-full items-center justify-between rounded-[4px] border border-[var(--pye-border)] bg-white px-4 py-3 transition-colors hover:border-[var(--pye-text)]"
        >
          <span className="text-[13px] font-medium text-[var(--pye-text)]">Политика конфиденциальности (Beorg)</span>
          <span className="font-mono text-[var(--pye-muted)]" aria-hidden>↗</span>
        </a>

        <a
          href="/licenses/fstek-tzki-license.pdf"
          target="_blank"
          rel="noopener noreferrer"
          className="group flex min-h-[44px] w-full items-center justify-between rounded-[4px] border border-[var(--pye-border)] bg-white px-4 py-3 transition-colors hover:border-[var(--pye-text)]"
        >
          <span className="text-[13px] text-[var(--pye-text)]">Лицензия ТЗКИ ФСТЭК</span>
          <span className="font-mono text-[var(--pye-muted)]" aria-hidden>PDF</span>
        </a>

        <a
          href="/licenses/fsb-license-1.pdf"
          target="_blank"
          rel="noopener noreferrer"
          className="group flex min-h-[44px] w-full items-center justify-between rounded-[4px] border border-[var(--pye-border)] bg-white px-4 py-3 transition-colors hover:border-[var(--pye-text)]"
        >
          <span className="text-[13px] text-[var(--pye-text)]">Лицензия ФСБ №1</span>
          <span className="font-mono text-[var(--pye-muted)]" aria-hidden>PDF</span>
        </a>

        <a
          href="/licenses/fsb-license-2.pdf"
          target="_blank"
          rel="noopener noreferrer"
          className="group flex min-h-[44px] w-full items-center justify-between rounded-[4px] border border-[var(--pye-border)] bg-white px-4 py-3 transition-colors hover:border-[var(--pye-text)]"
        >
          <span className="text-[13px] text-[var(--pye-text)]">Лицензия ФСБ №2</span>
          <span className="font-mono text-[var(--pye-muted)]" aria-hidden>PDF</span>
        </a>
      </div>

    </div>
  );
}

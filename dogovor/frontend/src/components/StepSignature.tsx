"use client";

import { useRef, useState, useCallback, useEffect } from "react";
import type { GenerateContractResult, Location, Staff, PatientData } from "@/lib/api";
import { fetchContractPdf, generateContract, previewContract } from "@/lib/api";

type StepSignatureProps = {
  location: Location;
  staff: Staff;
  patient: PatientData;
  onPatientChange?: (patient: PatientData) => void;
  onSuccess: (contractNumber: string) => void;
  onReset: () => void;
};

// Внутреннее разрешение канваса 2× — подпись в PDF без пикселизации
const CANVAS_SCALE = 2;
const CANVAS_LOGICAL_W = 600;
const CANVAS_LOGICAL_H = 220;

export function StepSignature({
  location,
  staff,
  patient,
  onPatientChange,
  onSuccess,
  onReset,
}: StepSignatureProps) {
  const [contractToggleOpen, setContractToggleOpen] = useState(false);
  const [contractPreviewHtml, setContractPreviewHtml] = useState<string | null>(null);
  const [contractPreviewLoading, setContractPreviewLoading] = useState(false);
  const [canShare, setCanShare] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const lastPointRef = useRef<{ x: number; y: number } | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [contractId, setContractId] = useState<string | null>(null);
  const [pdfPath, setPdfPath] = useState<string | null>(null);
  const [emailSent, setEmailSent] = useState(false);
  const [emailFailReason, setEmailFailReason] = useState<string | null>(null);

  useEffect(() => {
    setCanShare(typeof window !== "undefined" && typeof navigator !== "undefined" && !!navigator.share);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.strokeStyle = "#0C0C0A";
    ctx.lineWidth = 2 * CANVAS_SCALE;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.imageSmoothingEnabled = true;
  }, []);

  const getSignatureDataUrl = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    return canvas.toDataURL("image/png");
  }, []);

  const hasStroke = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return false;
    const ctx = canvas.getContext("2d");
    if (!ctx) return false;
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    return imageData.data.some((_, i) => i % 4 === 3 && imageData.data[i] > 0);
  }, []);

  const getCoords = useCallback((canvas: HTMLCanvasElement, clientX: number, clientY: number) => {
    const rect = canvas.getBoundingClientRect();
    return {
      x: (clientX - rect.left) * (canvas.width / rect.width),
      y: (clientY - rect.top) * (canvas.height / rect.height),
    };
  }, []);

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    setIsDrawing(true);
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const { x, y } = getCoords(canvas, e.clientX, e.clientY);
    ctx.beginPath();
    ctx.moveTo(x, y);
    lastPointRef.current = { x, y };
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const { x, y } = getCoords(canvas, e.clientX, e.clientY);
    const last = lastPointRef.current;
    if (last) {
      ctx.quadraticCurveTo((last.x + x) / 2, (last.y + y) / 2, x, y);
    } else {
      ctx.lineTo(x, y);
    }
    ctx.stroke();
    lastPointRef.current = { x, y };
  };

  const endDrawing = () => {
    lastPointRef.current = null;
    setIsDrawing(false);
  };

  const startDrawingTouch = (e: React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const touch = e.touches[0];
    if (!touch) return;
    setIsDrawing(true);
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const { x, y } = getCoords(canvas, touch.clientX, touch.clientY);
    ctx.beginPath();
    ctx.moveTo(x, y);
    lastPointRef.current = { x, y };
  };

  const drawTouch = (e: React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    if (!isDrawing) return;
    const touch = e.touches[0];
    if (!touch) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const { x, y } = getCoords(canvas, touch.clientX, touch.clientY);
    const last = lastPointRef.current;
    if (last) {
      ctx.quadraticCurveTo((last.x + x) / 2, (last.y + y) / 2, x, y);
    } else {
      ctx.lineTo(x, y);
    }
    ctx.stroke();
    lastPointRef.current = { x, y };
  };

  const endDrawingTouch = (e: React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    lastPointRef.current = null;
    setIsDrawing(false);
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setError(null);
  };

  const doGenerate = useCallback(
    async (opts?: { sendEmail?: boolean }): Promise<GenerateContractResult | null> => {
      if (!hasStroke()) {
        setError("Поставьте подпись в поле выше");
        return null;
      }
      const sendEmail = opts?.sendEmail !== false;
      setError(null);
      setIsSubmitting(true);
      try {
        const result = await generateContract({
          location_id: location.id,
          staff_id: staff.id,
          patient: sendEmail ? patient : { ...patient, patient_email: undefined },
          signature_data_url: getSignatureDataUrl() ?? undefined,
        });
        setDone(result.contract_number);
        setContractId(result.contract_id ?? null);
        setPdfPath(result.pdf_path ?? null);
        setEmailSent(result.email_sent ?? false);
        setEmailFailReason(result.email_fail_reason ?? null);
        return result;
      } catch (e) {
        setError(e instanceof Error ? e.message : "Ошибка при создании договора");
        return null;
      } finally {
        setIsSubmitting(false);
      }
    },
    [location.id, staff.id, patient, getSignatureDataUrl, hasStroke]
  );

  const handleSubmit = () => doGenerate({ sendEmail: true });

  const handleShareClick = async () => {
    const result = await doGenerate({ sendEmail: false });
    if (!result?.contract_id || !canShare) return;
    try {
      const blob = await fetchContractPdf(result.contract_id);
      const file = new File([blob], `dogovor_${result.contract_number.replace(/\//g, "-")}.pdf`, {
        type: "application/pdf",
      });
      await navigator.share({ title: `Договор № ${result.contract_number}`, files: [file] });
    } catch (err) {
      if ((err as Error).name !== "AbortError") {
        setError((err as Error).message || "Не удалось загрузить или отправить PDF");
      }
    }
  };

  const handleShare = useCallback(async () => {
    if (!contractId || !done) return;
    if (!canShare) {
      const mailto = patient.patient_email
        ? `mailto:${patient.patient_email}?subject=${encodeURIComponent("Договор № " + done)}&body=${encodeURIComponent("Договор оформлен. PDF приложен к письму с сервера.")}`
        : `mailto:?subject=${encodeURIComponent("Договор № " + done)}`;
      window.open(mailto);
      return;
    }
    try {
      const blob = await fetchContractPdf(contractId);
      const file = new File([blob], `dogovor_${done.replace(/\//g, "-")}.pdf`, { type: "application/pdf" });
      await navigator.share({ title: `Договор № ${done}`, files: [file] });
    } catch (err) {
      if ((err as Error).name !== "AbortError") setError((err as Error).message || "Не удалось отправить PDF");
    }
  }, [contractId, done, canShare, patient.patient_email]);

  // ── УСПЕХ ───────────────────────────────────────────────
  if (done) {
    return (
      <div className="space-y-4">
        {/* Главная карточка успеха */}
        <div className="relative">
          <span className="pointer-events-none absolute -left-[3px] -top-[3px] z-10 font-mono text-[9px] leading-none text-[#CACAC3]" aria-hidden>+</span>
          <span className="pointer-events-none absolute -right-[3px] -top-[3px] z-10 font-mono text-[9px] leading-none text-[#CACAC3]" aria-hidden>+</span>
          <span className="pointer-events-none absolute -bottom-[3px] -left-[3px] z-10 font-mono text-[9px] leading-none text-[#CACAC3]" aria-hidden>+</span>
          <span className="pointer-events-none absolute -bottom-[3px] -right-[3px] z-10 font-mono text-[9px] leading-none text-[#CACAC3]" aria-hidden>+</span>
          <div className="rounded-md border border-[var(--pye-border)] bg-white px-6 py-7 text-center">
            <p className="mb-3 font-mono text-[9px] uppercase tracking-[.16em] text-[var(--pye-accent)]">
              Договор оформлен
            </p>
            <p className="text-3xl font-semibold tracking-tight text-[var(--pye-text)]">
              № {done}
            </p>
            {contractId && (
              <p className="mt-2 font-mono text-[10px] text-[var(--pye-muted)]">
                ID: {contractId}
              </p>
            )}

            <div className="mx-auto mt-5 max-w-xs space-y-1.5 text-left">
              {pdfPath ? (
                <div className="flex items-start gap-2">
                  <span className="mt-0.5 font-mono text-[10px] text-[var(--pye-accent)]">✓</span>
                  <span className="font-mono text-[10px] text-[var(--pye-muted)]">PDF сохранён</span>
                </div>
              ) : (
                <div className="flex items-start gap-2">
                  <span className="mt-0.5 font-mono text-[10px] text-[#C8460A]">!</span>
                  <span className="font-mono text-[10px] text-[var(--pye-muted)]">
                    PDF не сгенерирован — проверьте логи бэкенда
                  </span>
                </div>
              )}
              {emailSent ? (
                <div className="flex items-start gap-2">
                  <span className="mt-0.5 font-mono text-[10px] text-[var(--pye-accent)]">✓</span>
                  <span className="font-mono text-[10px] text-[var(--pye-muted)]">
                    Договор отправлен на email клиента
                  </span>
                </div>
              ) : (
                <div className="flex items-start gap-2">
                  <span className="mt-0.5 font-mono text-[10px] text-[#C8460A]">!</span>
                  <span className="font-mono text-[10px] text-[var(--pye-muted)]">
                    {emailFailReason ?? "Письмо не отправлено — проверьте настройки почты"}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Кнопки */}
        <button
          type="button"
          onClick={handleShare}
          className="flex min-h-[48px] w-full items-center justify-between rounded-[4px] border border-[var(--pye-border)] bg-white px-5 py-4 transition-colors hover:border-[var(--pye-text)]"
        >
          <span className="flex-1 text-center text-[13px] font-medium text-[var(--pye-text)]">
            {canShare ? "Поделиться PDF" : "Отправить по email"}
          </span>
          <span className="ml-3 font-mono text-base text-[var(--pye-muted)]" aria-hidden>→</span>
        </button>

        <button
          type="button"
          onClick={onReset}
          className="flex min-h-[48px] w-full items-center justify-between rounded-[4px] bg-[var(--pye-text)] px-5 py-4 transition-colors hover:bg-[#1C1C18]"
        >
          <span className="flex-1 text-center text-[13px] font-medium text-white">
            Оформить следующий договор
          </span>
          <span className="ml-3 font-mono text-base text-white" aria-hidden>→</span>
        </button>
      </div>
    );
  }

  // ── ФОРМА ПОДПИСИ ────────────────────────────────────────
  return (
    <div className="space-y-6">

      {/* Заголовок */}
      <div>
        <h2 className="text-[13px] font-semibold uppercase tracking-[.05em] text-[var(--pye-text)]">
          Подпись клиента
        </h2>
        <p className="mt-0.5 font-mono text-[11px] text-[var(--pye-muted)]">
          При желании ознакомьтесь с договором и поставьте подпись
        </p>
      </div>

      {/* Договор — аккордеон */}
      <div>
        <button
          type="button"
          onClick={async () => {
            const next = !contractToggleOpen;
            setContractToggleOpen(next);
            if (next && !contractPreviewHtml && !contractPreviewLoading) {
              setContractPreviewLoading(true);
              try {
                const { html } = await previewContract({ location_id: location.id, staff_id: staff.id, patient });
                setContractPreviewHtml(html);
              } catch {
                setContractPreviewHtml("<p>Не удалось загрузить текст договора.</p>");
              } finally {
                setContractPreviewLoading(false);
              }
            }
          }}
          className="flex w-full items-center justify-between rounded-md border border-[var(--pye-border)] bg-white px-[18px] py-3.5 text-left transition-colors hover:border-[var(--pye-text)]"
        >
          <span className="text-[13px] font-medium text-[var(--pye-text)]">
            Ознакомиться с договором
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
                className="h-[55vh] w-full border-0 bg-white"
                sandbox="allow-same-origin"
              />
            ) : null}
          </div>
        )}
      </div>

      {/* Канвас подписи */}
      <div className="relative">
        <span className="pointer-events-none absolute -left-[3px] -top-[3px] z-10 font-mono text-[9px] leading-none text-[#CACAC3]" aria-hidden>+</span>
        <span className="pointer-events-none absolute -right-[3px] -top-[3px] z-10 font-mono text-[9px] leading-none text-[#CACAC3]" aria-hidden>+</span>
        <span className="pointer-events-none absolute -bottom-[3px] -left-[3px] z-10 font-mono text-[9px] leading-none text-[#CACAC3]" aria-hidden>+</span>
        <span className="pointer-events-none absolute -bottom-[3px] -right-[3px] z-10 font-mono text-[9px] leading-none text-[#CACAC3]" aria-hidden>+</span>

        <div className="overflow-hidden rounded-md border border-[var(--pye-border)] bg-white">
          {/* Подпись лейбл */}
          <div className="flex items-center justify-between border-b border-[var(--pye-border)] px-[18px] py-2.5">
            <span className="font-mono text-[9px] uppercase tracking-[.14em] text-[var(--pye-muted)]">
              Подпись
            </span>
            <button
              type="button"
              onClick={clearCanvas}
              disabled={isSubmitting}
              className="font-mono text-[9px] uppercase tracking-[.08em] text-[var(--pye-muted)] underline underline-offset-2 transition-colors hover:text-[var(--pye-text)] disabled:opacity-40"
            >
              Очистить
            </button>
          </div>
          <canvas
            ref={canvasRef}
            width={CANVAS_LOGICAL_W * CANVAS_SCALE}
            height={CANVAS_LOGICAL_H * CANVAS_SCALE}
            className="block w-full touch-none cursor-crosshair bg-white"
            style={{ maxWidth: "100%", height: "auto", minHeight: 180 }}
            onMouseDown={startDrawing}
            onMouseMove={draw}
            onMouseUp={endDrawing}
            onMouseLeave={endDrawing}
            onTouchStart={startDrawingTouch}
            onTouchMove={drawTouch}
            onTouchEnd={endDrawingTouch}
          />
        </div>
      </div>

      {/* Email поле */}
      {onPatientChange && (
        <div className="relative">
          <span className="pointer-events-none absolute -left-[3px] -top-[3px] z-10 font-mono text-[9px] leading-none text-[#CACAC3]" aria-hidden>+</span>
          <span className="pointer-events-none absolute -right-[3px] -top-[3px] z-10 font-mono text-[9px] leading-none text-[#CACAC3]" aria-hidden>+</span>
          <span className="pointer-events-none absolute -bottom-[3px] -left-[3px] z-10 font-mono text-[9px] leading-none text-[#CACAC3]" aria-hidden>+</span>
          <span className="pointer-events-none absolute -bottom-[3px] -right-[3px] z-10 font-mono text-[9px] leading-none text-[#CACAC3]" aria-hidden>+</span>
          <div className="overflow-hidden rounded-md border border-[var(--pye-border)] bg-white focus-within:border-[var(--pye-text)]">
            <label
              htmlFor="patient-email"
              className="block px-[18px] pt-2.5 font-mono text-[9px] uppercase tracking-[.12em] text-[var(--pye-muted)]"
            >
              Email для отправки договора
            </label>
            <input
              id="patient-email"
              type="email"
              value={patient.patient_email ?? ""}
              onChange={(e) => onPatientChange({ ...patient, patient_email: e.target.value || undefined })}
              placeholder="client@example.com"
              className="block w-full border-none bg-transparent px-[18px] pb-3 pt-1 text-[13px] text-[var(--pye-text)] outline-none placeholder:text-[var(--pye-border)] focus:ring-0"
            />
          </div>
        </div>
      )}

      {/* Кнопки действий */}
      <div className="space-y-2">
        <button
          type="button"
          onClick={handleSubmit}
          disabled={isSubmitting}
          className="flex min-h-[48px] w-full items-center justify-between rounded-[4px] bg-[var(--pye-text)] px-5 py-4 transition-colors hover:bg-[#1C1C18] disabled:cursor-not-allowed disabled:opacity-50"
        >
          <span className="flex-1 text-center text-[13px] font-medium text-white">
            {isSubmitting ? "Формируем договор…" : "Подписать и отправить"}
          </span>
          {!isSubmitting && <span className="ml-3 font-mono text-base text-white" aria-hidden>→</span>}
        </button>

        {canShare && (
          <button
            type="button"
            onClick={handleShareClick}
            disabled={isSubmitting}
            className="flex min-h-[48px] w-full items-center justify-between rounded-[4px] border border-[var(--pye-border)] bg-white px-5 py-4 transition-colors hover:border-[var(--pye-text)] disabled:opacity-50"
          >
            <span className="flex-1 text-center text-[13px] font-medium text-[var(--pye-text)]">
              Подписать и поделиться
            </span>
            <span className="ml-3 font-mono text-base text-[var(--pye-muted)]" aria-hidden>→</span>
          </button>
        )}
      </div>

      {/* Лоадер */}
      {isSubmitting && (
        <p className="text-center font-mono text-[11px] uppercase tracking-[.08em] text-[var(--pye-muted)]">
          Подождите, формируем PDF (до 2 мин)…
        </p>
      )}

      {/* Ошибка */}
      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 font-mono text-[11px] text-red-800">
          {error}
        </div>
      )}
    </div>
  );
}

"use client";

import { useRef, useState, useCallback, useEffect } from "react";
import type { Location, Staff, PatientData } from "@/lib/api";
import { generateContract } from "@/lib/api";

type StepSignatureProps = {
  location: Location;
  staff: Staff;
  patient: PatientData;
  onPatientChange?: (patient: PatientData) => void;
  onSuccess: (contractNumber: string) => void;
  onReset: () => void;
};

export function StepSignature({
  location,
  staff,
  patient,
  onPatientChange,
  onSuccess,
  onReset,
}: StepSignatureProps) {
  const [contractToggleOpen, setContractToggleOpen] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.strokeStyle = "#1f2937";
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
  }, []);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [contractId, setContractId] = useState<string | null>(null);
  const [pdfPath, setPdfPath] = useState<string | null>(null);
  const [emailSent, setEmailSent] = useState(false);
  const [emailFailReason, setEmailFailReason] = useState<string | null>(null);

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
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const { x, y } = getCoords(canvas, e.clientX, e.clientY);
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const endDrawing = () => setIsDrawing(false);

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
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const endDrawingTouch = (e: React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault();
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

  const handleSubmit = async () => {
    if (!hasStroke()) {
      setError("Поставьте подпись в поле выше");
      return;
    }
    setError(null);
    setIsSubmitting(true);
    try {
      const result = await generateContract({
        location_id: location.id,
        staff_id: staff.id,
        patient,
        signature_data_url: getSignatureDataUrl() ?? undefined,
      });
      setDone(result.contract_number);
      setContractId(result.contract_id ?? null);
      setPdfPath(result.pdf_path ?? null);
      setEmailSent(result.email_sent ?? false);
      setEmailFailReason(result.email_fail_reason ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка при создании договора");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleShare = useCallback(async () => {
    const title = `Договор № ${done}`;
    const text = `Договор об оказании платных медицинских услуг № ${done} оформлен.`;
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({
          title,
          text,
          url: window.location.href,
        });
      } catch (err) {
        if ((err as Error).name !== "AbortError") {
          const mailto = patient.patient_email
            ? `mailto:?subject=${encodeURIComponent(title)}&body=${encodeURIComponent(text + "\n" + window.location.href)}`
            : `mailto:?subject=${encodeURIComponent(title)}&body=${encodeURIComponent(text)}`;
          window.open(mailto);
        }
      }
    } else {
      const mailto = patient.patient_email
        ? `mailto:${patient.patient_email}?subject=${encodeURIComponent(title)}&body=${encodeURIComponent(text)}`
        : `mailto:?subject=${encodeURIComponent(title)}&body=${encodeURIComponent(text)}`;
      window.open(mailto);
    }
  }, [done, patient.patient_email]);

  if (done) {
    const canShare = typeof navigator !== "undefined" && navigator.share;
    return (
      <div className="rounded-xl border-2 border-green-200 bg-green-50 p-8 text-center">
        <p className="text-xl font-semibold text-green-800">Договор оформлен</p>
        <p className="mt-2 text-2xl font-bold text-green-900">№ {done}</p>
        {contractId && (
          <p className="mt-2 text-sm text-neutral-500">ID в БД: {contractId}</p>
        )}
        {pdfPath ? (
          <p className="mt-4 text-neutral-600">PDF сохранён: {pdfPath}</p>
        ) : (
          <p className="mt-4 text-amber-700">PDF не сгенерирован. Проверьте логи бэкенда и наличие xhtml2pdf; bucket «contracts» в Supabase Storage.</p>
        )}
        {emailSent ? (
          <p className="mt-2 text-green-700 font-medium">Договор отправлен на email клиента.</p>
        ) : (
          <p className="mt-2 text-amber-700">
            Письмо не отправлено.{emailFailReason ? ` ${emailFailReason}` : " Проверьте email в данных или настройки почты на сервере (Resend на Railway)."}
          </p>
        )}
        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <button
            type="button"
            onClick={handleShare}
            className="min-h-touch rounded-lg border border-neutral-300 bg-white px-6 py-3 font-medium text-neutral-800 hover:bg-neutral-50"
          >
            {canShare ? "Поделиться (почта, мессенджеры…)" : "Отправить по email"}
          </button>
          <button
            type="button"
            onClick={onReset}
            className="min-h-touch rounded-lg bg-neutral-900 px-6 py-3 text-white hover:bg-neutral-800"
          >
            Оформить следующий договор
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-neutral-900">Подпись клиента</h2>
        <p className="mt-1 text-neutral-500">Укажите email для отправки договора, при желании ознакомьтесь с условиями и поставьте подпись</p>
      </div>

      {onPatientChange && (
        <div>
          <label className="mb-1 block text-sm font-medium text-neutral-700">Email для отправки договора</label>
          <input
            type="email"
            value={patient.patient_email ?? ""}
            onChange={(e) => onPatientChange({ ...patient, patient_email: e.target.value || undefined })}
            placeholder="client@example.com"
            className="w-full rounded-lg border border-neutral-200 px-4 py-3 text-base focus:border-neutral-900 focus:outline-none focus:ring-2 focus:ring-neutral-900/20"
          />
        </div>
      )}

      <div className="rounded-lg border border-neutral-200 bg-white">
        <button
          type="button"
          onClick={() => setContractToggleOpen((o) => !o)}
          className="flex w-full items-center justify-between px-4 py-3 text-left text-sm font-medium text-neutral-700 hover:bg-neutral-50"
        >
          <span>Ознакомиться с договором</span>
          <span className="text-neutral-400" aria-hidden>{contractToggleOpen ? "▼" : "▶"}</span>
        </button>
        {contractToggleOpen && (
          <div className="border-t border-neutral-200 px-4 py-3 text-sm text-neutral-600">
            <p className="mb-2 font-medium text-neutral-800">Договор об оказании платных медицинских услуг</p>
            <p><strong>Пациент:</strong> {patient.patient_fio || "—"}</p>
            <p><strong>Исполнитель:</strong> ООО «ПАЙ ОПТИКС», оптометрист {staff.fio}</p>
            <p><strong>Место оказания услуг:</strong> {location.address}</p>
            <p><strong>Услуга:</strong> Подбор очковой коррекции зрения. Стоимость 1600 руб.</p>
            <p className="mt-2 text-neutral-500">Полный текст договора будет сформирован после подписания и отправлен на указанный email.</p>
          </div>
        )}
      </div>

      <div>
        <p className="mb-2 text-sm font-medium text-neutral-700">Подпись клиента</p>
        <div className="rounded-lg border border-neutral-200 bg-white p-2">
        <canvas
          ref={canvasRef}
          width={600}
          height={220}
          className="block w-full touch-none rounded-lg border border-neutral-200"
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

      <div className="flex flex-col gap-3 sm:flex-row">
        <button
          type="button"
          onClick={clearCanvas}
          disabled={isSubmitting}
          className="min-h-touch rounded-lg border border-neutral-300 px-4 py-3 font-medium text-neutral-700 hover:bg-neutral-50 disabled:opacity-50"
        >
          Очистить
        </button>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={isSubmitting}
          className="min-h-touch flex-1 rounded-lg bg-neutral-900 px-6 py-4 text-base font-medium text-white transition hover:bg-neutral-800 disabled:opacity-50"
        >
          {isSubmitting ? "Формируем договор…" : "Подписать и отправить"}
        </button>
      </div>
      {isSubmitting && (
        <p className="text-center text-sm text-neutral-500">Подождите, формируем PDF (до 2 мин)…</p>
      )}

      {error && (
        <div className="rounded-xl bg-red-50 p-4 text-red-800">
          {error}
        </div>
      )}
    </div>
  );
}

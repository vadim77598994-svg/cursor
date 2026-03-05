"use client";

import { useRef, useState, useCallback, useEffect } from "react";
import type { Location, Staff, PatientData } from "@/lib/api";
import { generateContract } from "@/lib/api";

type StepSignatureProps = {
  location: Location;
  staff: Staff;
  patient: PatientData;
  onSuccess: (contractNumber: string) => void;
  onReset: () => void;
};

export function StepSignature({
  location,
  staff,
  patient,
  onSuccess,
  onReset,
}: StepSignatureProps) {
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
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка при создании договора");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (done) {
    return (
      <div className="rounded-xl border-2 border-green-200 bg-green-50 p-8 text-center">
        <p className="text-xl font-semibold text-green-800">Договор оформлен</p>
        <p className="mt-2 text-2xl font-bold text-green-900">№ {done}</p>
        {contractId && (
          <p className="mt-2 text-sm text-gray-500">ID в БД: {contractId}</p>
        )}
        {pdfPath ? (
          <p className="mt-4 text-gray-600">PDF сохранён: {pdfPath}</p>
        ) : (
          <p className="mt-4 text-amber-700">PDF не сгенерирован. Проверьте логи бэкенда и наличие xhtml2pdf; bucket «contracts» в Supabase Storage.</p>
        )}
        {emailSent ? (
          <p className="mt-2 text-green-700 font-medium">Договор отправлен на email клиента.</p>
        ) : (
          <p className="mt-2 text-amber-700">Письмо не отправлено. Проверьте email в данных или настройки почты на сервере (Resend на Railway).</p>
        )}
        <button
          type="button"
          onClick={onReset}
          className="mt-6 rounded-xl bg-medical-blue px-6 py-3 text-white hover:opacity-90"
        >
          Оформить следующий договор
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-gray-900">Подпись клиента</h2>
        <p className="mt-1 text-gray-600">Клиент ставит подпись в поле ниже</p>
      </div>

      <div className="rounded-xl border-2 border-gray-200 bg-white p-2">
        <canvas
          ref={canvasRef}
          width={600}
          height={220}
          className="block w-full touch-none rounded-lg border border-gray-200"
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

      <div className="flex flex-col gap-3 sm:flex-row">
        <button
          type="button"
          onClick={clearCanvas}
          disabled={isSubmitting}
          className="rounded-xl border-2 border-gray-300 px-4 py-3 font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
        >
          Очистить
        </button>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={isSubmitting}
          className="flex-1 rounded-xl bg-medical-blue px-6 py-4 text-lg font-medium text-white shadow-md transition hover:opacity-90 disabled:opacity-50"
        >
          {isSubmitting ? "Создание договора…" : "Сгенерировать договор"}
        </button>
      </div>
      {isSubmitting && (
        <p className="text-center text-sm text-gray-500">Подождите, формируем PDF (до 2 мин)…</p>
      )}

      {error && (
        <div className="rounded-xl bg-red-50 p-4 text-red-800">
          {error}
        </div>
      )}
    </div>
  );
}

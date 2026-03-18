"use client";

import { useEffect, useState } from "react";
import type { PatientData } from "@/lib/api";

type StepReviewProps = {
  patient: PatientData;
  onNext: (patient: PatientData) => void;
};

const fields: { key: keyof PatientData; label: string; placeholder: string; type?: string }[] = [
  { key: "patient_fio",        label: "ФИО пациента",       placeholder: "Иванов Иван Иванович" },
  { key: "patient_birth_date", label: "Дата рождения",       placeholder: "ДД.ММ.ГГГГ" },
  { key: "passport_series",    label: "Серия паспорта",      placeholder: "40 00" },
  { key: "passport_number",    label: "Номер паспорта",      placeholder: "123456" },
  { key: "passport_issued_by", label: "Кем выдан",           placeholder: "ОВД района..." },
  { key: "passport_date",      label: "Дата выдачи",         placeholder: "ДД.ММ.ГГГГ" },
  { key: "reg_address",        label: "Адрес регистрации",   placeholder: "г. Москва, ул. ..." },
];

export function StepReview({ patient, onNext }: StepReviewProps) {
  const [draft, setDraft] = useState<PatientData>(patient);

  useEffect(() => {
    setDraft(patient);
  }, [patient]);

  const update = (key: keyof PatientData, value: string) => {
    setDraft((prev) => ({ ...prev, [key]: value || undefined }));
  };

  const canNext = draft.patient_fio.trim().length > 0;

  return (
    <div className="space-y-7">

      {/* ── Заголовок ──────────────────────────── */}
      <div>
        <h2 className="text-[13px] font-semibold uppercase tracking-[.05em] text-[var(--pye-text)]">
          Данные пациента
        </h2>
        <p className="mt-0.5 font-mono text-[11px] text-[var(--pye-muted)]">
          Проверьте и при необходимости исправьте
        </p>
      </div>

      {/* ── Поля ──────────────────────────────── */}
      <div className="relative">
        {/* Corner marks */}
        <span className="pointer-events-none absolute -left-[3px] -top-[3px] z-10 font-mono text-[9px] leading-none text-[#CACAC3]" aria-hidden>+</span>
        <span className="pointer-events-none absolute -right-[3px] -top-[3px] z-10 font-mono text-[9px] leading-none text-[#CACAC3]" aria-hidden>+</span>
        <span className="pointer-events-none absolute -bottom-[3px] -left-[3px] z-10 font-mono text-[9px] leading-none text-[#CACAC3]" aria-hidden>+</span>
        <span className="pointer-events-none absolute -bottom-[3px] -right-[3px] z-10 font-mono text-[9px] leading-none text-[#CACAC3]" aria-hidden>+</span>

        <div className="overflow-hidden rounded-md border border-[var(--pye-border)] bg-white">
          {fields.map(({ key, label, placeholder, type = "text" }, index) => (
            <div
              key={key}
              className={`${index > 0 ? "border-t border-[var(--pye-border)]" : ""} focus-within:border-[var(--pye-text)] focus-within:z-10 relative`}
            >
              <label
                htmlFor={key}
                className="block px-[18px] pt-2.5 font-mono text-[9px] uppercase tracking-[.12em] text-[var(--pye-muted)]"
              >
                {label}
              </label>
              <input
                id={key}
                type={type}
                value={draft[key] ?? ""}
                onChange={(e) => update(key, e.target.value)}
                placeholder={placeholder}
                className="block w-full border-none bg-transparent px-[18px] pb-3 pt-1 text-[13px] text-[var(--pye-text)] outline-none placeholder:text-[var(--pye-border)] focus:ring-0"
              />
            </div>
          ))}
        </div>
      </div>

      {/* ── Кнопка ────────────────────────────── */}
      <button
        type="button"
        onClick={() => onNext(draft)}
        disabled={!canNext}
        className="flex min-h-[48px] w-full items-center justify-between rounded-[4px] bg-[var(--pye-text)] px-5 py-4 transition-colors hover:bg-[#1C1C18] disabled:cursor-not-allowed disabled:bg-[var(--pye-border)] disabled:text-[var(--pye-muted)]"
      >
        <span className="flex-1 text-center text-[13px] font-medium text-white">
          Сгенерировать договор
        </span>
        <span className="ml-3 font-mono text-base text-white" aria-hidden>→</span>
      </button>

    </div>
  );
}

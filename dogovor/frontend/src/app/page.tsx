"use client";

import { useState } from "react";
import Image from "next/image";
import type { Location, Staff, PatientData } from "@/lib/api";
import { StepCabinet } from "@/components/StepCabinet";
import { StepScan } from "@/components/StepScan";
import { StepReview } from "@/components/StepReview";
import { StepSignature } from "@/components/StepSignature";

const STEPS = ["Кабинет и врач", "Сканирование", "Проверка данных", "Подпись"];

const MARQUEE_ITEMS = [
  "ПАЙ ОПТИКС",
  "—",
  "КАБИНЕТ ПРОВЕРКИ ЗРЕНИЯ",
  "—",
  "ОФОРМЛЕНИЕ ДОГОВОРА",
  "—",
  "МОСКВА · САНКТ-ПЕТЕРБУРГ",
  "—",
];

const emptyPatient: PatientData = {
  patient_fio: "",
  patient_birth_date: "",
  passport_series: "",
  passport_number: "",
  passport_issued_by: "",
  passport_date: "",
  reg_address: "",
  patient_email: "",
};

export default function DogovorPage() {
  const [step, setStep] = useState(0);
  const [location, setLocation] = useState<Location | null>(null);
  const [staff, setStaff] = useState<Staff | null>(null);
  const [patient, setPatient] = useState<PatientData>(emptyPatient);

  const resetFlow = () => {
    setStep(0);
    setLocation(null);
    setStaff(null);
    setPatient(emptyPatient);
  };

  const marqueeItems = [...MARQUEE_ITEMS, ...MARQUEE_ITEMS];

  return (
    <>
      {/* ── MARQUEE STRIP ─────────────────────────── */}
      <div className="overflow-hidden bg-[var(--pye-text)] py-[7px]" aria-hidden>
        <div className="pye-marquee-inner">
          {marqueeItems.map((item, i) => (
            <span
              key={i}
              className={`px-7 font-mono text-[10px] tracking-[.12em] ${
                item === "—" ? "text-white/25" : "text-white/80"
              }`}
            >
              {item}
            </span>
          ))}
        </div>
      </div>

      {/* ── MAIN ──────────────────────────────────── */}
      <main className="mx-auto min-h-screen max-w-xl px-4 py-10 pb-[env(safe-area-inset-bottom)]">

        {/* HEADER */}
        <div className="mb-10 flex items-start justify-between gap-4">
          <div>
            <p className="mb-1 font-mono text-[9px] uppercase tracking-[.16em] text-[var(--pye-muted)]">
              Оформление договора
            </p>
            <h1 className="text-xl font-semibold leading-tight tracking-tight text-[var(--pye-text)]">
              ПАЙ ОПТИКС
            </h1>
          </div>
          <Image
            src="/logo.png"
            alt="P.Y.E"
            width={96}
            height={40}
            className="h-10 w-auto shrink-0 object-contain"
            priority
            unoptimized
          />
        </div>

        {/* PROGRESS */}
        <div className="mb-9">
          <div className="mb-2 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="font-mono text-[11px] font-medium text-[var(--pye-accent)]">
                {String(step + 1).padStart(2, "0")}
              </span>
              <span className="font-mono text-[10px] uppercase tracking-[.1em] text-[var(--pye-muted)]">
                {STEPS[step]}
              </span>
            </div>
            <span className="font-mono text-[10px] text-[var(--pye-border)]">
              / {String(STEPS.length).padStart(2, "0")}
            </span>
          </div>
          <div className="flex gap-[3px]">
            {STEPS.map((_, i) => (
              <div
                key={i}
                className={`h-[1.5px] flex-1 rounded-full transition-colors duration-300 ${
                  i < step
                    ? "bg-[var(--pye-text)]"
                    : i === step
                    ? "bg-[var(--pye-accent)]"
                    : "bg-[var(--pye-border)]"
                }`}
              />
            ))}
          </div>
        </div>

        {/* BACK BUTTON */}
        {step > 0 && (
          <div className="mb-7">
            <button
              type="button"
              onClick={() => setStep(step - 1)}
              className="flex min-h-[44px] items-center gap-1.5 font-mono text-[10px] uppercase tracking-[.08em] text-[var(--pye-muted)] transition-colors hover:text-[var(--pye-text)]"
            >
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
                <path d="M9 6H3M5 4L3 6l2 2" />
              </svg>
              Назад
            </button>
          </div>
        )}

        {/* STEPS */}
        {step === 0 && (
          <StepCabinet
            onNext={(loc, s) => {
              setLocation(loc);
              setStaff(s);
              setStep(1);
            }}
          />
        )}

        {step === 1 && location && staff && (
          <StepScan
            location={location}
            staff={staff}
            onRecognized={(parsed) => {
              setPatient((prev) => ({ ...prev, ...parsed }));
              setStep(2);
            }}
            onManual={() => setStep(2)}
          />
        )}

        {step === 2 && (
          <StepReview
            patient={patient}
            onChange={setPatient}
            onNext={() => setStep(3)}
          />
        )}

        {step === 3 && location && staff && (
          <StepSignature
            location={location}
            staff={staff}
            patient={patient}
            onPatientChange={setPatient}
            onSuccess={() => {}}
            onReset={resetFlow}
          />
        )}
      </main>
    </>
  );
}

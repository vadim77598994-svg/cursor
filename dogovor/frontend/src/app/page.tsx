"use client";

import { useState } from "react";
import Image from "next/image";
import type { Location, Staff, PatientData } from "@/lib/api";
import { StepCabinet } from "@/components/StepCabinet";
import { StepScan } from "@/components/StepScan";
import { StepReview } from "@/components/StepReview";
import { StepSignature } from "@/components/StepSignature";

const STEPS = ["Кабинет и врач", "Сканирование", "Проверка данных", "Подпись"];

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

  return (
    <main className="mx-auto min-h-screen max-w-2xl px-4 py-8 pb-[env(safe-area-inset-bottom)]">
      <div className="mb-8 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-neutral-900">
            Оформление договора
          </h1>
          <p className="mt-1 text-neutral-500">
            ПАЙ ОПТИКС — кабинет проверки зрения
          </p>
        </div>
        <Image
          src="/logo.png"
          alt="P.Y.E"
          width={96}
          height={32}
          className="h-8 w-auto shrink-0 object-contain"
          priority
        />
      </div>

      {step > 0 && (
        <div className="mb-4">
          <button
            type="button"
            onClick={() => setStep(step - 1)}
            className="flex min-h-[44px] items-center gap-2 text-neutral-600 hover:text-neutral-900"
          >
            <span aria-hidden>←</span>
            <span>Назад</span>
          </button>
        </div>
      )}

      <div className="mb-10">
        <div className="flex justify-between gap-1">
          {STEPS.map((label, i) => (
            <div
              key={label}
              className={`h-1.5 flex-1 rounded-full transition ${
                i <= step ? "bg-[#0f0f0f]" : "bg-neutral-300"
              }`}
              title={label}
            />
          ))}
        </div>
        <p className="mt-2 text-sm font-medium text-neutral-500">
          Шаг {step + 1} из {STEPS.length}: {STEPS[step]}
        </p>
      </div>

      {step === 0 && (
        <StepCabinet
          onNext={(loc, s) => {
            setLocation(loc);
            setStaff(s);
            setStep(1);
          }}
        />
      )}

      {step === 1 && (
        <StepScan
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
          onSuccess={() => {}}
          onReset={resetFlow}
        />
      )}
    </main>
  );
}

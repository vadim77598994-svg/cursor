"use client";

import { useState } from "react";
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
    <main className="mx-auto min-h-screen max-w-2xl px-4 py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-gray-900">
          Оформление договора
        </h1>
        <p className="mt-1 text-gray-600">
          ПАЙ ОПТИКС — кабинет проверки зрения
        </p>
      </div>

      <div className="mb-10">
        <div className="flex justify-between gap-1">
          {STEPS.map((label, i) => (
            <div
              key={label}
              className={`h-2 flex-1 rounded-full transition ${
                i <= step ? "bg-medical-blue" : "bg-gray-200"
              }`}
              title={label}
            />
          ))}
        </div>
        <p className="mt-2 text-sm font-medium text-gray-600">
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

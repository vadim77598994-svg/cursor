"use client";

import type { PatientData } from "@/lib/api";

type StepReviewProps = {
  patient: PatientData;
  onChange: (patient: PatientData) => void;
  onNext: () => void;
};

const fields: { key: keyof PatientData; label: string; placeholder: string; type?: string }[] = [
  { key: "patient_fio", label: "ФИО пациента", placeholder: "Иванов Иван Иванович" },
  { key: "patient_birth_date", label: "Дата рождения", placeholder: "ДД.ММ.ГГГГ" },
  { key: "passport_series", label: "Серия паспорта", placeholder: "40 00" },
  { key: "passport_number", label: "Номер паспорта", placeholder: "123456" },
  { key: "passport_issued_by", label: "Кем выдан", placeholder: "ОВД района..." },
  { key: "passport_date", label: "Дата выдачи", placeholder: "ДД.ММ.ГГГГ" },
  { key: "reg_address", label: "Адрес регистрации", placeholder: "г. Москва, ул. ..." },
  { key: "patient_email", label: "Email для отправки договора", placeholder: "client@example.com", type: "email" },
];

export function StepReview({ patient, onChange, onNext }: StepReviewProps) {
  const update = (key: keyof PatientData, value: string) => {
    onChange({ ...patient, [key]: value || undefined });
  };

  const canNext = patient.patient_fio.trim().length > 0;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-gray-900">Проверка данных</h2>
        <p className="mt-1 text-gray-600">Проверьте и при необходимости исправьте данные пациента</p>
      </div>

      <div className="space-y-4">
        {fields.map(({ key, label, placeholder, type = "text" }) => (
          <div key={key}>
            <label className="mb-1 block text-sm font-medium text-gray-700">{label}</label>
            <input
              type={type}
              value={patient[key] ?? ""}
              onChange={(e) => update(key, e.target.value)}
              placeholder={placeholder}
              className="w-full rounded-xl border-2 border-gray-200 px-4 py-3 text-lg focus:border-medical-blue focus:outline-none focus:ring-2 focus:ring-medical-blue/20"
            />
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={onNext}
        disabled={!canNext}
        className="w-full rounded-xl bg-medical-blue px-6 py-4 text-lg font-medium text-white shadow-md transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
      >
        Далее — подпись
      </button>
    </div>
  );
}

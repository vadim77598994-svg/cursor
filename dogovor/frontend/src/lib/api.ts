export const API_BASE =
  process.env.NEXT_PUBLIC_DOGOVOR_API_URL || "http://localhost:8000";

export type Location = {
  id: string;
  name: string;
  address: string;
  city: string;
  contract_prefix: string;
  sort_order: number;
};

export type Staff = {
  id: string;
  fio: string;
  city: string;
  signature_image_url: string | null;
};

export async function fetchLocations(): Promise<Location[]> {
  const res = await fetch(`${API_BASE}/api/v1/locations`);
  if (!res.ok) throw new Error("Не удалось загрузить список кабинетов");
  return res.json();
}

export async function fetchStaff(city?: string): Promise<Staff[]> {
  const url = city
    ? `${API_BASE}/api/v1/staff?city=${encodeURIComponent(city)}`
    : `${API_BASE}/api/v1/staff`;
  const res = await fetch(url);
  if (!res.ok) throw new Error("Не удалось загрузить список оптометристов");
  return res.json();
}

export type PatientData = {
  patient_fio: string;
  patient_birth_date?: string;
  passport_series?: string;
  passport_number?: string;
  passport_issued_by?: string;
  passport_date?: string;
  reg_address?: string;
  patient_email?: string;
};

export type GenerateContractPayload = {
  location_id: string;
  staff_id: string;
  patient: PatientData;
  signature_data_url?: string;
  device_uuid?: string;
};

export type GenerateContractResult = {
  contract_number: string;
  contract_id?: string | null;
  pdf_path?: string | null;
  email_sent?: boolean;
  /** Причина, если письмо не отправлено (нет email, Resend не настроен, ошибка API и т.д.) */
  email_fail_reason?: string | null;
  message?: string;
};

/** Проверка: настроен ли на бэкенде сервис Beorg (без раскрытия секретов). */
export async function getPassportStatus(): Promise<{ beorg_configured: boolean }> {
  const res = await fetch(`${API_BASE}/api/v1/passport/status`);
  if (!res.ok) return { beorg_configured: false };
  return res.json();
}

const RECOGNIZE_PASSPORT_TIMEOUT_MS = 90_000;

/** Распознавание паспорта через Beorg: разворот обязателен, прописка опциональна. Фото не сохраняются на сервере. Может занять до ~60 с. */
export async function recognizePassport(
  imageSpread: File,
  imageRegistration?: File | null
): Promise<Partial<PatientData>> {
  const form = new FormData();
  form.append("image_spread", imageSpread);
  if (imageRegistration) form.append("image_registration", imageRegistration);
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), RECOGNIZE_PASSPORT_TIMEOUT_MS);
  const res = await fetch(`${API_BASE}/api/v1/passport/recognize`, {
    method: "POST",
    body: form,
    signal: controller.signal,
  });
  clearTimeout(timeoutId);
  if (res.status === 503) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Сервис распознавания не настроен");
  }
  if (res.status === 422) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Не удалось распознать паспорт");
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Ошибка распознавания");
  }
  return res.json();
}

const GENERATE_CONTRACT_TIMEOUT_MS = 120_000;

export async function generateContract(
  payload: GenerateContractPayload
): Promise<GenerateContractResult> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), GENERATE_CONTRACT_TIMEOUT_MS);
  try {
    const res = await fetch(`${API_BASE}/api/v1/contracts/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || "Ошибка при создании договора");
    }
    return res.json();
  } catch (e) {
    if (e instanceof Error && e.name === "AbortError") {
      throw new Error("Запрос занял слишком много времени. Проверьте интернет и попробуйте ещё раз.");
    }
    throw e;
  } finally {
    clearTimeout(timeoutId);
  }
}

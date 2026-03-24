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

let locationsCache: Location[] | null = null;
let locationsPromise: Promise<Location[]> | null = null;
const staffCache = new Map<string, Staff[]>();
const staffPromiseCache = new Map<string, Promise<Staff[]>>();

export async function fetchLocations(): Promise<Location[]> {
  if (locationsCache) return locationsCache;
  if (locationsPromise) return locationsPromise;

  locationsPromise = (async () => {
    const res = await fetch(`${API_BASE}/api/v1/locations`);
    if (!res.ok) throw new Error("Не удалось загрузить список кабинетов");
    const data = (await res.json()) as Location[];
    locationsCache = data;
    return data;
  })();

  try {
    return await locationsPromise;
  } finally {
    locationsPromise = null;
  }
}

export async function fetchStaff(city?: string): Promise<Staff[]> {
  const cacheKey = city?.trim() || "__all__";
  const cached = staffCache.get(cacheKey);
  if (cached) return cached;
  const inflight = staffPromiseCache.get(cacheKey);
  if (inflight) return inflight;

  const url = city
    ? `${API_BASE}/api/v1/staff?city=${encodeURIComponent(city)}`
    : `${API_BASE}/api/v1/staff`;

  const promise = (async () => {
    const res = await fetch(url);
    if (!res.ok) throw new Error("Не удалось загрузить список оптометристов");
    const data = (await res.json()) as Staff[];
    staffCache.set(cacheKey, data);
    return data;
  })();

  staffPromiseCache.set(cacheKey, promise);
  try {
    return await promise;
  } finally {
    staffPromiseCache.delete(cacheKey);
  }
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

export type PassportRecognitionJobStatus = "pending" | "running" | "succeeded" | "failed";

export type PassportRecognitionStartResult = {
  job_id: string;
  status: PassportRecognitionJobStatus;
};

export type PassportRecognitionStatusResult = {
  job_id: string;
  status: PassportRecognitionJobStatus;
  result?: Partial<PatientData> | null;
  error?: string | null;
};

// Общий таймаут распознавания паспорта: один запрос на разворот и, при наличии, страницу прописки.
const RECOGNIZE_PASSPORT_TIMEOUT_MS = 120_000;
const RECOGNIZE_PASSPORT_START_TIMEOUT_MS = 60_000;

/** Распознавание паспорта через Beorg: разворот обязателен, прописка опциональна. Фото не сохраняются. Может занять до ~2 мин. */
export async function recognizePassport(
  imageSpread: File,
  imageRegistration?: File | null
): Promise<Partial<PatientData>> {
  const form = new FormData();
  form.append("image_spread", imageSpread);
  if (imageRegistration) form.append("image_registration", imageRegistration);
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), RECOGNIZE_PASSPORT_TIMEOUT_MS);
  let wasHiddenDuringRequest = false;
  const handleVisibilityChange = () => {
    if (typeof document !== "undefined" && document.visibilityState === "hidden") {
      wasHiddenDuringRequest = true;
    }
  };
  if (typeof document !== "undefined") {
    document.addEventListener("visibilitychange", handleVisibilityChange);
  }
  let res: Response;
  try {
    res = await fetch(`${API_BASE}/api/v1/passport/recognize`, {
      method: "POST",
      body: form,
      signal: controller.signal,
    });
  } catch (e) {
    clearTimeout(timeoutId);
    if (typeof document !== "undefined") {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    }
    if (e instanceof Error && e.name === "AbortError") {
      throw new Error("Превышено время ожидания. Распознавание заняло слишком долго — попробуйте ещё раз.");
    }
    if (
      e instanceof Error &&
      wasHiddenDuringRequest &&
      (e.name === "TypeError" || /load failed|failed to fetch|network/i.test(e.message))
    ) {
      throw new Error(
        "Распознавание прервалось, потому что приложение было свёрнуто или браузер ушёл в фон. Во время сканирования не переключайтесь в другие приложения и дождитесь завершения."
      );
    }
    if (
      e instanceof Error &&
      (e.name === "TypeError" || /load failed|failed to fetch|network/i.test(e.message))
    ) {
      throw new Error("Не удалось завершить распознавание: проверьте интернет и не сворачивайте приложение во время сканирования.");
    }
    throw e;
  }
  clearTimeout(timeoutId);
  if (typeof document !== "undefined") {
    document.removeEventListener("visibilitychange", handleVisibilityChange);
  }
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

export async function startPassportRecognition(
  imageSpread: File,
  imageRegistration?: File | null
): Promise<PassportRecognitionStartResult> {
  const form = new FormData();
  form.append("image_spread", imageSpread);
  if (imageRegistration) form.append("image_registration", imageRegistration);
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), RECOGNIZE_PASSPORT_START_TIMEOUT_MS);
  let res: Response;
  try {
    res = await fetch(`${API_BASE}/api/v1/passport/recognize/start`, {
      method: "POST",
      body: form,
      signal: controller.signal,
    });
  } catch (e) {
    clearTimeout(timeoutId);
    if (e instanceof Error && e.name === "AbortError") {
      throw new Error("Не удалось отправить фото на распознавание. Проверьте интернет и попробуйте ещё раз.");
    }
    if (
      e instanceof Error &&
      (e.name === "TypeError" || /load failed|failed to fetch|network/i.test(e.message))
    ) {
      throw new Error("Не удалось начать распознавание: проверьте интернет и не сворачивайте приложение во время отправки фото.");
    }
    throw e;
  }
  clearTimeout(timeoutId);
  if (res.status === 503) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Сервис распознавания не настроен");
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Не удалось начать распознавание");
  }
  return res.json();
}

export async function fetchPassportRecognitionStatus(
  jobId: string
): Promise<PassportRecognitionStatusResult> {
  const res = await fetch(`${API_BASE}/api/v1/passport/recognize/status/${jobId}`);
  if (res.status === 404) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Задача распознавания не найдена");
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Не удалось получить статус распознавания");
  }
  return res.json();
}

/** Превью договора (HTML без подписей) для ознакомления на шаге 4. */
export async function previewContract(payload: Omit<GenerateContractPayload, "signature_data_url">): Promise<{ html: string }> {
  const res = await fetch(`${API_BASE}/api/v1/contracts/preview`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Не удалось загрузить превью договора");
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

/** Скачать PDF договора по id (для шаринга). */
export async function fetchContractPdf(contractId: string): Promise<Blob> {
  const res = await fetch(`${API_BASE}/api/v1/contracts/${contractId}/pdf`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Не удалось загрузить PDF договора");
  }
  return res.blob();
}

/** Пресайнед URL на PDF (для надежного iOS Web Share). */
export async function fetchContractShareUrl(
  contractId: string
): Promise<{ url: string; filename: string }> {
  const res = await fetch(`${API_BASE}/api/v1/contracts/${contractId}/pdf/share-url`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Не удалось получить share URL договора");
  }
  return res.json();
}

export async function sendContractEmail(
  contractId: string,
  email: string,
  patientFio?: string
): Promise<{ ok: boolean; email_sent: boolean }> {
  const res = await fetch(`${API_BASE}/api/v1/contracts/${contractId}/send-email`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, patient_fio: patientFio }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Не удалось отправить договор на email");
  }
  return res.json();
}

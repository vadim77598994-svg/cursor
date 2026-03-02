const API_BASE =
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
  pdf_path?: string | null;
  email_sent?: boolean;
  message?: string;
};

export async function generateContract(
  payload: GenerateContractPayload
): Promise<GenerateContractResult> {
  const res = await fetch(`${API_BASE}/api/v1/contracts/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Ошибка при создании договора");
  }
  return res.json();
}

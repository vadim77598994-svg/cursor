import type { PatientData } from "./api";

/**
 * Парсит сырой текст OCR (страницы 2–3 паспорта РФ) в поля пациента.
 * Вывод Tesseract может «плыть» — используем несколько эвристик.
 */
export function parsePassportOcr(rawText: string): Partial<PatientData> {
  const text = rawText.replace(/\r\n/g, "\n").replace(/\s+/g, " ").trim();
  const lines = rawText.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);

  const result: Partial<PatientData> = {};

  // Серия: 4 цифры (иногда с пробелом 12 34)
  const seriesMatch = text.match(/\b(\d{2}\s?\d{2})\b/);
  if (seriesMatch) result.passport_series = seriesMatch[1].replace(/\s/g, " ");

  // Номер: 6 цифр подряд
  const numberMatch = text.match(/\b(\d{6})\b/);
  if (numberMatch) result.passport_number = numberMatch[1];

  // Дата выдачи: ДД.ММ.ГГГГ
  const dateMatch = text.match(/\b(\d{1,2})\.(\d{1,2})\.(\d{4})\b/);
  if (dateMatch) {
    const [, d, m, y] = dateMatch;
    result.passport_date = `${d.padStart(2, "0")}.${m.padStart(2, "0")}.${y}`;
  }

  // Дата рождения: вторая дата или после "рождения"
  const birthMatches = text.matchAll(/\b(\d{1,2})\.(\d{1,2})\.(\d{4})\b/g);
  const dates: string[] = [];
  for (const m of birthMatches) {
    dates.push(`${m[1].padStart(2, "0")}.${m[2].padStart(2, "0")}.${m[3]}`);
  }
  if (dates.length >= 2 && !result.patient_birth_date) {
    result.patient_birth_date = dates[1];
  } else if (dates.length >= 1 && !result.patient_birth_date) {
    result.patient_birth_date = dates[0];
  }

  // ФИО: обычно одна из первых нецифровых строк из 3–4 слов (Фамилия Имя Отчество)
  for (const line of lines) {
    const words = line.split(/\s+/).filter((w) => /[а-яА-ЯёЁ-]/.test(w));
    if (words.length >= 2 && words.length <= 5 && !result.patient_fio) {
      const noDigits = line.replace(/\d/g, "").trim();
      if (noDigits.length > 5 && noDigits.length < 80) {
        result.patient_fio = noDigits;
        break;
      }
    }
  }

  // "Кем выдан" / "выдан" — строка после или следующая строка
  const issuedIdx = lines.findIndex(
    (l) => /кем\s+выдан|выдан\s*$/i.test(l) || /выдавший\s+орган/i.test(l)
  );
  if (issuedIdx >= 0 && lines[issuedIdx + 1]) {
    result.passport_issued_by = lines[issuedIdx + 1].replace(/\d{6,}/g, "").trim();
  }
  if (!result.passport_issued_by) {
    const issuedMatch = text.match(/(?:кем\s+выдан|выдан)[:\s]*([^.\n]+?)(?:\d{1,2}\.\d{1,2}\.\d{4}|$)/i);
    if (issuedMatch) result.passport_issued_by = issuedMatch[1].trim();
  }

  // Адрес регистрации: после "место жительства" / "адрес" / "зарегистрирован"
  const addrIdx = lines.findIndex(
    (l) => /место\s+жительства|адрес\s+регистрации|зарегистрирован/i.test(l)
  );
  if (addrIdx >= 0) {
    const rest = lines.slice(addrIdx + 1).join(" ").trim();
    if (rest.length > 10) result.reg_address = rest.slice(0, 200);
  }

  return result;
}

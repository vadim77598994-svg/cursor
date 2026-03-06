import type { PatientData } from "./api";

const HEADER_WORDS = new Set([
  "россия",
  "российская",
  "федерация",
  "паспорт",
  "гражданина",
  "фамилия",
  "имя",
  "отчество",
  "пол",
  "рождения",
  "дата",
  "рождения",
  "место",
  "кем",
  "выдан",
  "код",
  "подразделения",
]);

/** Проверка: строка похожа на заголовок (одно слово или типовой штамп), не ФИО */
function isHeaderLine(line: string): boolean {
  const t = line.trim().toLowerCase();
  if (t.length < 2) return true;
  const words = t.split(/\s+/).filter(Boolean);
  if (words.length === 1 && HEADER_WORDS.has(words[0])) return true;
  if (/^(фамилия|имя|отчество|дата|место|кем|серия|номер)\s*$/i.test(t)) return true;
  if (/^российская\s+федерация$/i.test(t)) return true;
  return false;
}

/** Нормализация даты в ДД.ММ.ГГГГ; возвращает null если нереалистичная */
function normalizeDate(d: string, m: string, y: string): string | null {
  const day = d.padStart(2, "0");
  const month = m.padStart(2, "0");
  const year = y;
  const numY = parseInt(year, 10);
  if (numY < 1950 || numY > 2030) return null;
  const numM = parseInt(month, 10);
  if (numM < 1 || numM > 12) return null;
  return `${day}.${month}.${year}`;
}

/**
 * Парсит текст OCR только с разворота (стр. 2–3): ФИО, дата рождения, серия/номер, кем выдан, дата выдачи.
 * Адрес не извлекается — его берут со второго фото (прописка).
 */
export function parseSpreadOcr(rawText: string): Partial<PatientData> {
  const text = rawText.replace(/\r\n/g, "\n").replace(/\s+/g, " ").trim();
  const lines = rawText.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);

  const result: Partial<PatientData> = {};

  // Серия: 4 цифры (XX XX или XXXX)
  const seriesMatch = text.match(/\b(\d{2}\s?\d{2})\b/);
  if (seriesMatch) result.passport_series = seriesMatch[1].replace(/\s/g, " ").trim();

  // Номер: 6 цифр подряд (не часть серии)
  const numberMatch = text.match(/\b(\d{6})\b/);
  if (numberMatch) result.passport_number = numberMatch[1];

  // Все даты ДД.ММ.ГГГГ
  const dateRegex = /\b(\d{1,2})\.(\d{1,2})\.(\d{4})\b/g;
  const dates: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = dateRegex.exec(text)) !== null) {
    const normalized = normalizeDate(m[1], m[2], m[3]);
    if (normalized) dates.push(normalized);
  }

  // Дата выдачи — обычно последняя по порядку на странице (правая часть)
  if (dates.length >= 1) result.passport_date = dates[dates.length - 1];
  // Дата рождения — раньше даты выдачи или первая
  if (dates.length >= 2) {
    const issueDate = dates[dates.length - 1];
    const birthCandidates = dates.filter((d) => d !== issueDate);
    result.patient_birth_date = birthCandidates[0] ?? dates[0];
  } else if (dates.length === 1) {
    result.patient_birth_date = dates[0];
  }

  // ФИО: строка из 3–4 слов кириллицей, не заголовок
  for (const line of lines) {
    if (result.patient_fio) break;
    const trimmed = line.trim();
    if (isHeaderLine(trimmed)) continue;
    const words = trimmed.split(/\s+/).filter((w) => /[а-яА-ЯёЁ-]/.test(w));
    if (words.length >= 3 && words.length <= 5) {
      const noDigits = trimmed.replace(/\d/g, "").replace(/\s+/g, " ").trim();
      if (noDigits.length >= 6 && noDigits.length < 80 && /^[А-Яа-яёЁ\s.-]+$/.test(noDigits)) {
        result.patient_fio = noDigits;
      }
    }
  }
  // Fallback: первая длинная кириллическая строка без цифр
  if (!result.patient_fio) {
    for (const line of lines) {
      if (isHeaderLine(line)) continue;
      const noDigits = line.replace(/\d/g, "").replace(/\s+/g, " ").trim();
      if (noDigits.length >= 8 && noDigits.length < 80 && /^[А-Яа-яёЁ\s.-]+$/.test(noDigits)) {
        result.patient_fio = noDigits;
        break;
      }
    }
  }

  // Кем выдан
  const issuedIdx = lines.findIndex(
    (l) => /кем\s+выдан|паспорт\s+выдан|выдавший\s+орган/i.test(l)
  );
  if (issuedIdx >= 0 && lines[issuedIdx + 1]) {
    const next = lines[issuedIdx + 1].replace(/\d{6,}/g, "").trim();
    if (next.length > 3 && !isHeaderLine(next)) result.passport_issued_by = next.slice(0, 300);
  }
  if (!result.passport_issued_by) {
    const issuedMatch = text.match(/(?:кем\s+выдан|паспорт\s+выдан)[:\s]*([^.\n]+?)(?:\d{1,2}\.\d{1,2}\.\d{4}|$)/i);
    if (issuedMatch && issuedMatch[1].trim().length > 3) {
      result.passport_issued_by = issuedMatch[1].trim().slice(0, 300);
    }
  }

  return result;
}

/**
 * Парсит текст OCR только со страницы прописки: адрес регистрации.
 */
export function parseRegistrationOcr(rawText: string): { reg_address?: string } {
  const lines = rawText.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const addrIdx = lines.findIndex(
    (l) => /место\s+жительства|адрес\s+регистрации|зарегистрирован/i.test(l)
  );
  if (addrIdx < 0) return {};
  const rest = lines.slice(addrIdx + 1).join(" ").replace(/\s+/g, " ").trim();
  if (rest.length < 10) return {};
  return { reg_address: rest.slice(0, 250) };
}

/**
 * Парсит сырой текст OCR (страницы 2–3 паспорта РФ) в поля пациента.
 * Используется при одном фото (обратная совместимость). Для двух шагов лучше parseSpreadOcr + parseRegistrationOcr.
 */
export function parsePassportOcr(rawText: string): Partial<PatientData> {
  const spread = parseSpreadOcr(rawText);
  const reg = parseRegistrationOcr(rawText);
  return { ...spread, ...reg };
}

import type { PatientData } from "./api";

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
 * Извлекает значение после метки в строке (метку игнорируем).
 * Пример: "Фамилия ИВАНОВ" → "ИВАНОВ", "Дата рождения 01.02.1990" → "01.02.1990"
 */
function valueAfterLabel(line: string, labelPattern: RegExp): string | null {
  const match = line.match(labelPattern);
  if (!match) return null;
  const rest = line.slice(match.index! + match[0].length).trim();
  return rest.length > 0 ? rest : null;
}

/**
 * Парсит текст OCR только с разворота (стр. 2–3) по шпаргалке:
 * - ФИО: три отдельные строки — Фамилия, Имя, Отчество (берём значения, названия строк игнорируем)
 * - Дата рождения — после метки "Дата рождения"
 * - Серия — 4 цифры (могут идти вертикально в OCR)
 * - Номер — 6 цифр (вертикально)
 * - Выдан — блок "Паспорт выдан" (до "Дата выдачи" / "Код подразделения")
 * - Дата выдачи — после "Дата выдачи"
 */
export function parseSpreadOcr(rawText: string): Partial<PatientData> {
  const text = rawText.replace(/\r\n/g, "\n").replace(/\s+/g, " ").trim();
  const lines = rawText.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);

  const result: Partial<PatientData> = {};

  // —— ФИО: три строки — значение после меток "Фамилия", "Имя", "Отчество" (метки игнорируем)
  function valueAfterLabelInLines(labelRegex: RegExp): string | null {
    const idx = lines.findIndex((l) => labelRegex.test(l));
    if (idx < 0) return null;
    const line = lines[idx];
    const onLine = valueAfterLabel(line, labelRegex);
    if (onLine && onLine.length > 0) return onLine.replace(/\d{6,}/g, "").trim();
    const next = lines[idx + 1];
    if (next && /[а-яА-ЯёЁ-]/.test(next) && !/^(дата|место|пол|код)/i.test(next))
      return next.replace(/\d{6,}/g, "").trim();
    return null;
  }
  const surname = valueAfterLabelInLines(/фамилия\s*/i);
  const name = valueAfterLabelInLines(/имя\.?\s*/i);
  const patronymic = valueAfterLabelInLines(/отчество\s*/i);
  if (surname || name || patronymic) {
    result.patient_fio = [surname, name, patronymic].filter(Boolean).join(" ").replace(/\s+/g, " ").trim();
    if (result.patient_fio.length < 3) result.patient_fio = undefined;
  }

  // Fallback ФИО: одна строка из 3–4 слов кириллицей (если по меткам не нашли)
  if (!result.patient_fio) {
    for (const line of lines) {
      if (/^(фамилия|имя|отчество|пол|дата|место|российская|федерация|паспорт)\s*$/i.test(line)) continue;
      const words = line.split(/\s+/).filter((w) => /[а-яА-ЯёЁ-]/.test(w));
      if (words.length >= 3 && words.length <= 5) {
        const noDigits = line.replace(/\d/g, "").replace(/\s+/g, " ").trim();
        if (noDigits.length >= 6 && noDigits.length < 80 && /^[А-Яа-яёЁ\s.-]+$/.test(noDigits)) {
          result.patient_fio = noDigits;
          break;
        }
      }
    }
  }

  // —— Дата рождения — после метки "Дата рождения"
  const birthLabelIdx = lines.findIndex((l) => /дата\s+рождения/i.test(l));
  if (birthLabelIdx >= 0) {
    const onSameLine = valueAfterLabel(lines[birthLabelIdx], /дата\s+рождения\s*/i);
    const birthDateMatch = (onSameLine ?? lines[birthLabelIdx + 1] ?? "").match(/\b(\d{1,2})\.(\d{1,2})\.(\d{4})\b/);
    if (birthDateMatch) {
      const normalized = normalizeDate(birthDateMatch[1], birthDateMatch[2], birthDateMatch[3]);
      if (normalized) result.patient_birth_date = normalized;
    }
  }
  if (!result.patient_birth_date) {
    const allDates = [...text.matchAll(/\b(\d{1,2})\.(\d{1,2})\.(\d{4})\b/g)];
    const normalized = allDates.map((m) => normalizeDate(m[1], m[2], m[3])).filter(Boolean) as string[];
    if (normalized.length >= 2) result.patient_birth_date = normalized[0];
    else if (normalized.length === 1) result.patient_birth_date = normalized[0];
  }

  // —— Серия: 4 цифры (в паспорте по вертикали — в OCR могут идти подряд или с пробелом 40 05)
  const seriesMatch = text.match(/\b(\d{2}\s?\d{2})\b/);
  if (seriesMatch) result.passport_series = seriesMatch[1].replace(/\s/g, " ").trim();
  if (!result.passport_series) {
    const fourDigits = text.match(/(\d{4})/);
    if (fourDigits) result.passport_series = fourDigits[1];
  }

  // —— Номер: 6 цифр (вертикально в паспорте)
  const numberMatch = text.match(/\b(\d{6})\b/);
  if (numberMatch) result.passport_number = numberMatch[1];

  // —— Выдан — блок "Паспорт выдан" (многострочный), до "Дата выдачи" или "Код подразделения"
  const issuedStart = lines.findIndex((l) => /паспорт\s+выдан/i.test(l));
  if (issuedStart >= 0) {
    const collected: string[] = [];
    for (let i = issuedStart; i < lines.length; i++) {
      const line = lines[i];
      if (i > issuedStart && (/дата\s+выдачи|код\s+подразделения/i.test(line))) break;
      const value = i === issuedStart ? line.replace(/паспорт\s+выдан\s*/i, "").trim() : line;
      if (value && !/^\d{1,2}\.\d{1,2}\.\d{4}\s*$/.test(value)) {
        collected.push(value.replace(/\d{6,}/g, "").trim());
      }
    }
    const issued = collected.filter(Boolean).join(" ").replace(/\s+/g, " ").trim();
    if (issued.length > 3) result.passport_issued_by = issued.slice(0, 300);
  }
  if (!result.passport_issued_by) {
    const m = text.match(/паспорт\s+выдан\s*([\s\S]+?)(?=дата\s+выдачи|код\s+подразделения|$)/i);
    if (m && m[1].trim().length > 3) result.passport_issued_by = m[1].trim().replace(/\s+/g, " ").slice(0, 300);
  }

  // —— Дата выдачи — после "Дата выдачи"
  const issueLabelIdx = lines.findIndex((l) => /дата\s+выдачи/i.test(l));
  if (issueLabelIdx >= 0) {
    const onSameLine = valueAfterLabel(lines[issueLabelIdx], /дата\s+выдачи\s*/i);
    const dateMatch = (onSameLine ?? lines[issueLabelIdx + 1] ?? "").match(/\b(\d{1,2})\.(\d{1,2})\.(\d{4})\b/);
    if (dateMatch) {
      const normalized = normalizeDate(dateMatch[1], dateMatch[2], dateMatch[3]);
      if (normalized) result.passport_date = normalized;
    }
  }
  if (!result.passport_date && result.patient_birth_date) {
    const allDates = [...text.matchAll(/\b(\d{1,2})\.(\d{1,2})\.(\d{4})\b/g)];
    const normalized = allDates.map((m) => normalizeDate(m[1], m[2], m[3])).filter(Boolean) as string[];
    const issueDate = normalized.find((d) => d !== result.patient_birth_date);
    if (issueDate) result.passport_date = issueDate;
  }

  return result;
}

/**
 * Парсит текст OCR только со страницы прописки (второй разворот):
 * - Игнорируем шапку "Зарегестрирован", дату регистрации и всё после номера квартиры. Сам номер квартиры сканируем.
 * - После "пункт", "город" и т.п. — название города.
 * - Улица, проспект, переулок — название.
 * - Номер дома, корпус (если есть), номер квартиры (если есть).
 */
export function parseRegistrationOcr(rawText: string): { reg_address?: string } {
  const lines = rawText.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const text = rawText.replace(/\r\n/g, "\n").replace(/\s+/g, " ").trim();

  // Найти блок с пропиской (зарегестрирован / место жительства)
  const startIdx = lines.findIndex(
    (l) => /зарег[ie]стрирован|место\s+жительства|адрес\s+регистрации/i.test(l)
  );
  if (startIdx < 0) return {};

  const restLines = lines.slice(startIdx + 1);
  const restText = restLines.join(" ").replace(/\s+/g, " ");

  const parts: string[] = [];

  // Город: после "пункт", "город", "гор." и т.п.
  const cityMatch = restText.match(/(?:пункт|город|гор\.?)\s*([А-Яа-яёЁ\s.-]+?)(?=\s*р-н|\s*улица|\s*пр-кт|\s*пер\.|дом|$)/i);
  if (cityMatch && cityMatch[1].trim().length > 1) {
    parts.push(cityMatch[1].trim());
  }

  // Улица / проспект / переулок
  const streetMatch = restText.match(/(?:улица|пр-кт|проспект|пер\.?|переулок)\s*([А-Яа-яёЁ0-9\s.-]+?)(?=\s*дом|д\.|$)/i);
  if (streetMatch && streetMatch[1].trim().length > 1) {
    parts.push(streetMatch[1].trim());
  }

  // Дом
  const houseMatch = restText.match(/дом\s*(\d+[А-Яа-я]?)/i);
  if (houseMatch) parts.push(`д. ${houseMatch[1]}`);

  // Корпус (если есть)
  const corpMatch = restText.match(/корп\.?\s*(\d+[А-Яа-я]?)/i);
  if (corpMatch) parts.push(`корп. ${corpMatch[1]}`);

  // Квартира (если есть) — сканируем, всё после неё игнорируем
  const aptMatch = restText.match(/кв\.?\s*(\d+)/i);
  if (aptMatch) parts.push(`кв. ${aptMatch[1]}`);

  if (parts.length === 0) {
    // Fallback: весь текст после "зарегистрирован" до типичного конца блока (УФМС, ТП и т.д.)
    const untilOrg = restText.split(/\s*(?:ТП\s*№|ОТДЕЛ|УФМС|заверил)/i)[0].trim();
    if (untilOrg.length > 10) return { reg_address: untilOrg.slice(0, 250) };
    return {};
  }

  return { reg_address: parts.join(", ").slice(0, 250) };
}

/**
 * Обратная совместимость: один текст с обоих разворотов.
 */
export function parsePassportOcr(rawText: string): Partial<PatientData> {
  const spread = parseSpreadOcr(rawText);
  const reg = parseRegistrationOcr(rawText);
  return { ...spread, ...reg };
}

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
 */
function valueAfterLabel(line: string, labelPattern: RegExp): string | null {
  const match = line.match(labelPattern);
  if (!match) return null;
  const rest = line.slice(match.index! + match[0].length).trim();
  return rest.length > 0 ? rest : null;
}

/** Оставляет только кириллицу, пробелы, дефис — убирает мусор OCR (латиница, символы). */
function cleanCyrillicPart(s: string | null): string | null {
  if (!s || !s.trim()) return null;
  const cleaned = s.replace(/[^А-Яа-яёЁ\s-]/g, " ").replace(/\s+/g, " ").trim();
  return cleaned.length >= 2 ? cleaned : null;
}

/** Проверка: строка из 4 цифр — не год (1950–2030), чтобы не путать серию с годом. */
function isLikelyYearFourDigits(s: string): boolean {
  const n = parseInt(s, 10);
  return n >= 1950 && n <= 2030;
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
  const surname = cleanCyrillicPart(valueAfterLabelInLines(/фамилия\s*/i));
  const name = cleanCyrillicPart(valueAfterLabelInLines(/имя\.?\s*/i));
  const patronymic = cleanCyrillicPart(valueAfterLabelInLines(/отчество\s*/i));
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

  // —— Все даты ДД.ММ.ГГГГ из текста (для разбора по хронологии)
  const allDatesRaw = [...text.matchAll(/\b(\d{1,2})\.(\d{1,2})\.(\d{4})\b/g)];
  const allDates = allDatesRaw
    .map((m) => normalizeDate(m[1], m[2], m[3]))
    .filter(Boolean) as string[];

  // —— Дата рождения и дата выдачи: по меткам, но если OCR перепутал значения — назначаем по хронологии (ранняя = рождение, поздняя = выдача)
  let dateByBirthLabel: string | null = null;
  let dateByIssueLabel: string | null = null;
  const birthLabelIdx = lines.findIndex((l) => /дата\s+рождения/i.test(l));
  if (birthLabelIdx >= 0) {
    const onSameLine = valueAfterLabel(lines[birthLabelIdx], /дата\s+рождения\s*/i);
    const birthDateMatch = (onSameLine ?? lines[birthLabelIdx + 1] ?? "").match(/\b(\d{1,2})\.(\d{1,2})\.(\d{4})\b/);
    if (birthDateMatch) dateByBirthLabel = normalizeDate(birthDateMatch[1], birthDateMatch[2], birthDateMatch[3]);
  }
  const issueLabelIdx = lines.findIndex((l) => /дата\s+выдачи/i.test(l));
  if (issueLabelIdx >= 0) {
    const onSameLine = valueAfterLabel(lines[issueLabelIdx], /дата\s+выдачи\s*/i);
    const dateMatch = (onSameLine ?? lines[issueLabelIdx + 1] ?? "").match(/\b(\d{1,2})\.(\d{1,2})\.(\d{4})\b/);
    if (dateMatch) dateByIssueLabel = normalizeDate(dateMatch[1], dateMatch[2], dateMatch[3]);
  }
  if (dateByBirthLabel && dateByIssueLabel) {
    const earlier = dateByBirthLabel < dateByIssueLabel ? dateByBirthLabel : dateByIssueLabel;
    const later = dateByBirthLabel > dateByIssueLabel ? dateByBirthLabel : dateByIssueLabel;
    result.patient_birth_date = earlier;
    result.passport_date = later;
  } else if (dateByBirthLabel) {
    result.patient_birth_date = dateByBirthLabel;
    const other = allDates.find((d) => d !== dateByBirthLabel);
    if (other) result.passport_date = other;
  } else if (dateByIssueLabel) {
    result.passport_date = dateByIssueLabel;
    const other = allDates.find((d) => d !== dateByIssueLabel);
    if (other) result.patient_birth_date = other;
  } else if (allDates.length >= 2) {
    const sorted = [...allDates].sort();
    result.patient_birth_date = sorted[0];
    result.passport_date = sorted[sorted.length - 1];
  } else if (allDates.length === 1) {
    result.patient_birth_date = allDates[0];
  }

  // —— Серия: 4 цифры (не год 1950–2030 — иначе OCR мог подставить год из даты)
  const seriesCandidates = text.match(/\b(\d{2}\s?\d{2})\b/g) ?? [];
  for (const cand of seriesCandidates) {
    const four = cand.replace(/\s/g, "");
    if (!isLikelyYearFourDigits(four)) {
      result.passport_series = cand.replace(/\s/g, " ").trim();
      break;
    }
  }
  if (!result.passport_series) {
    const fourMatch = text.match(/\b(\d{4})\b/g);
    if (fourMatch) {
      const notYear = fourMatch.find((s) => !isLikelyYearFourDigits(s));
      if (notYear) result.passport_series = notYear;
    }
  }

  // —— Номер: 6 цифр (не путать с серией; в паспорте номер идёт после серии)
  const numberMatch = text.match(/\b(\d{6})\b/g);
  if (numberMatch) {
    const excludeSeries = result.passport_series?.replace(/\s/g, "") ?? "";
    const sixDigit = numberMatch.find((s) => s !== excludeSeries && !isLikelyYearFourDigits(s.slice(0, 4)));
    if (sixDigit) result.passport_number = sixDigit;
    else result.passport_number = numberMatch[0];
  }

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
 * Парсит серию и номер из второй строки МЧЗ (44 символа).
 * Приказ МВД 851: позиции 1–3 = первые 3 цифры серии, 4–9 = номер, позиция 29 = 4-я цифра серии.
 */
export function parseSeriesNumberFromMRZ(line2: string): {
  passport_series?: string;
  passport_number?: string;
} {
  const s = line2.replace(/\s/g, "").replace(/[<>]/g, "");
  if (s.length < 9) return {};
  const three = s.slice(0, 3).replace(/\D/g, "");
  const six = s.slice(3, 9).replace(/\D/g, "");
  if (three.length !== 3 || six.length !== 6) return {};
  const fourth = s.length >= 29 ? s.slice(28, 29).replace(/\D/g, "") : "";
  const series = fourth ? three + fourth : three + "0";
  if (!/^\d{4}$/.test(series)) return {};
  return {
    passport_series: series,
    passport_number: six,
  };
}

/**
 * Из сырого текста OCR зоны МЧЗ находит вторую строку (44 символа) и парсит серию/номер.
 */
export function parseMRZRawForSeriesNumber(rawText: string): {
  passport_series?: string;
  passport_number?: string;
} {
  const lines = rawText.split(/\r?\n/).map((l) => l.replace(/\s/g, "").replace(/[<>]/g, ""));
  for (const line of lines) {
    if (line.length >= 44) {
      const parsed = parseSeriesNumberFromMRZ(line.slice(0, 44));
      if (parsed.passport_series && parsed.passport_number) return parsed;
    }
  }
  const merged = rawText.replace(/\s/g, "").replace(/[<>]/g, "");
  const nineMatch = merged.match(/\d{9}/);
  if (nineMatch) {
    const nine = nineMatch[0];
    const idx = merged.indexOf(nine);
    const fourth = (merged[idx + 9] ?? "").match(/\d/) ? merged[idx + 9] : "";
    return {
      passport_series: nine.slice(0, 3) + (fourth || "0"),
      passport_number: nine.slice(3, 9),
    };
  }
  return {};
}

/**
 * Парсит только серию и номер из текста, полученного с повёрнутой области (crop + rotate 90°).
 * В вырезанной области — только вертикальный столбик цифр, после поворота: 4 цифры + 6 цифр.
 */
export function parseSeriesNumberFromCrop(rawText: string): {
  passport_series?: string;
  passport_number?: string;
} {
  const digitsOnly = rawText.replace(/\D/g, "");
  const result: { passport_series?: string; passport_number?: string } = {};
  if (digitsOnly.length >= 4) {
    const four = digitsOnly.slice(0, 4);
    if (!isLikelyYearFourDigits(four)) result.passport_series = four;
  }
  if (digitsOnly.length >= 10) {
    const series = result.passport_series ?? digitsOnly.slice(0, 4);
    const afterSeries = digitsOnly.slice(4);
    const six = afterSeries.slice(0, 6);
    if (six.length === 6 && !isLikelyYearFourDigits(six.slice(0, 4)))
      result.passport_number = six;
  }
  if (!result.passport_series && digitsOnly.length >= 4) {
    for (let i = 0; i <= digitsOnly.length - 4; i++) {
      const four = digitsOnly.slice(i, i + 4);
      if (!isLikelyYearFourDigits(four)) {
        result.passport_series = four;
        break;
      }
    }
  }
  if (!result.passport_number && digitsOnly.length >= 6) {
    const sixMatch = rawText.match(/\d{6}/);
    if (sixMatch) result.passport_number = sixMatch[0];
  }
  return result;
}

/**
 * Обратная совместимость: один текст с обоих разворотов.
 */
export function parsePassportOcr(rawText: string): Partial<PatientData> {
  const spread = parseSpreadOcr(rawText);
  const reg = parseRegistrationOcr(rawText);
  return { ...spread, ...reg };
}

"use client";

/**
 * Визуальная подсказка: где в паспорте РФ расположены поля.
 * Помогает пользователю правильно разместить документ в кадре и снижает ошибки OCR.
 */
type View = "spread" | "registration";

type Props = {
  view: View;
  className?: string;
};

export function PassportTemplateGuide({ view, className = "" }: Props) {
  if (view === "spread") {
    return (
      <div
        className={`rounded-xl border-2 border-dashed border-medical-blue/50 bg-medical-blueLight/30 p-4 ${className}`}
        role="img"
        aria-label="Схема разворота паспорта: где расположены ФИО, дата рождения, серия и номер, кем выдан, дата выдачи"
      >
        <p className="mb-3 text-sm font-medium text-gray-700">
          Разворот с фото (страницы 2–3). Расположите в кадре так, чтобы был виден весь текст.
        </p>
        <div className="grid grid-cols-[1fr_auto] gap-2 text-left text-xs">
          <div className="rounded bg-white/80 p-2 ring-1 ring-medical-blue/30">
            <span className="font-semibold text-medical-blue">ФИО</span>
            <p className="mt-0.5 text-gray-600">Фамилия, имя, отчество — под фото</p>
          </div>
          <div className="rounded bg-white/80 p-2 ring-1 ring-medical-blue/30">
            <span className="font-semibold text-medical-blue">Дата рождения</span>
            <p className="mt-0.5 text-gray-600">Под полем «Дата рождения»</p>
          </div>
          <div className="rounded bg-white/80 p-2 ring-1 ring-medical-blue/30">
            <span className="font-semibold text-medical-blue">Серия и номер</span>
            <p className="mt-0.5 text-gray-600">Серия: 4 цифры (XX XX), номер: 6 цифр</p>
          </div>
          <div className="rounded bg-white/80 p-2 ring-1 ring-medical-blue/30">
            <span className="font-semibold text-medical-blue">Кем выдан / Дата выдачи</span>
            <p className="mt-0.5 text-gray-600">Блок «Паспорт выдан»</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`rounded-xl border-2 border-dashed border-amber-500/50 bg-amber-50/50 p-4 ${className}`}
      role="img"
      aria-label="Схема страницы с пропиской: где расположен адрес регистрации"
    >
      <p className="mb-3 text-sm font-medium text-gray-700">
        Страница с пропиской (например, стр. 5). Сфотографируйте блок «Место жительства».
      </p>
      <div className="rounded bg-white/80 p-3 ring-1 ring-amber-500/30 text-left text-xs">
        <span className="font-semibold text-amber-700">Адрес регистрации</span>
        <p className="mt-1 text-gray-600">
          Текст после заголовка «Место жительства» или «Адрес регистрации». Если прописка от руки — после распознавания нажмите «Ввести адрес вручную».
        </p>
      </div>
    </div>
  );
}

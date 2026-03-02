# Парсинг шаблона договора .docx

**Зачем:** безопасно перенести изменения из обновлённого `ПАЙ_ОПТИКС_МЕД_ДОГ.docx` в HTML-шаблон `backend/templates/contract.html` без потери данных. Исходный .docx не изменяется — скрипт только читает файл.

## Автоматизация (одна команда)

Положите обновлённый договор **в папку проекта** `dogovor/contract_template/` с именем `ПАЙ_ОПТИКС_МЕД_ДОГ.docx` — так он не потеряется при переносе проекта. Затем:

```bash
cd dogovor/scripts
python3 sync_from_docx.py
```

Скрипт по умолчанию читает `dogovor/contract_template/ПАЙ_ОПТИКС_МЕД_ДОГ.docx`. Или укажите свой путь:

```bash
python3 sync_from_docx.py "/путь/к/договор.docx"
```

Скрипт создаст/обновит `backend/templates/contract_extracted.html`. Дальше откройте его и `contract.html` и перенесите нужные правки (новые формулировки, пункты), не трогая переменные `{{ ... }}` и блоки `{% if %}`.

## Как обновить шаблон после правок в .docx (пошагово)

1. Запустите `sync_from_docx.py` (см. выше).
2. Откройте `contract_extracted.html` и `contract.html`, сравните (diff или визуально).
3. Перенесите в `contract.html` новые/изменённые абзацы, сохраняя переменные Jinja2.
4. Файл `contract_extracted.html` в .gitignore — не коммитить.

## Переменные в шаблоне

- `{{ contract_number }}`, `{{ current_date }}`, `{{ city }}`, `{{ cabinet_address }}`
- `{{ patient_fio }}`, `{{ patient_birth_date }}`, паспорт, `{{ reg_address }}`
- `{{ staff_fio }}`, `{{ staff_signature_url }}` — подпись оптометриста
- `{{ patient_signature_data_url }}` — подпись клиента (в 4 местах: основной блок, приложения 1–3)

Новые поля из .docx добавляйте в `context` в `app/api/contracts.py` и в шаблон.

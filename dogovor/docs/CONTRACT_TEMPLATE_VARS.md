# Переменные шаблона договора (Jinja2)

Список переменных для `templates/contract.html`. Используются в тексте как `{{ variable_name }}`.

| Переменная | Описание | Источник |
|------------|----------|----------|
| `contract_number` | Номер договора (например R10-2025-00001) | БД, Sequence + префикс локации |
| `current_date` | Дата оформления (ДД.месяц.ГГГГ) | Сервер |
| `city` | Город | locations.city |
| `cabinet_address` | Полный адрес точки | locations.address |
| `staff_fio` | ФИО оптометриста | выбранный оптометрист (dogovor_staff.fio) |
| `staff_signature_url` | URL изображения подписи оптометриста | dogovor_staff.signature_image_url (загрузить позже) |
| `patient_fio` | ФИО пациента | OCR паспорта |
| `patient_birth_date` | Дата рождения | OCR |
| `passport_series` | Серия паспорта | OCR |
| `passport_number` | Номер паспорта | OCR |
| `passport_issued_by` | Кем выдан | OCR |
| `passport_date` | Дата выдачи | OCR |
| `reg_address` | Адрес регистрации | OCR |

Реквизиты ООО «ПАЙ ОПТИКС» (ИНН 7715944987 и др.) — константы в шаблоне или в конфиге бэкенда.

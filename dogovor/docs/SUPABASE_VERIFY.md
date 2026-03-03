# Проверка Supabase для модуля «Договор»

Если бэкенд возвращает 200 при создании договора, но запись не появляется в Supabase и письмо не приходит — чаще всего данные пишутся в **другой проект** или схема не применена.

## 1. Один и тот же проект

В Railway в **Variables** бэкенда заданы `SUPABASE_URL` и `SUPABASE_SERVICE_KEY`.  
Этот **URL должен совпадать** с проектом, в котором ты смотришь данные.

- Открой [Supabase Dashboard](https://supabase.com/dashboard) и выбери проект.
- В **Settings → API** скопируй **Project URL**.
- Сравни с `SUPABASE_URL` в Railway (Variables сервиса бэкенда). Должны быть **одинаковые** (вплоть до `https://xxxxx.supabase.co`).

Если в Railway указан другой URL — бэкенд пишет в другой проект. Исправь `SUPABASE_URL` (и при необходимости `SUPABASE_SERVICE_KEY` от этого же проекта) и сделай Redeploy.

## 2. Проверка схемы в Supabase

В **том же проекте** (Project URL = `SUPABASE_URL` из Railway):

1. Открой **SQL Editor**.
2. Скопируй и выполни скрипт из файла **`dogovor/supabase/verify_schema.sql`** (в репозитории).
3. Проверь результат:
   - Должны быть 3 таблицы: `dogovor_locations`, `dogovor_staff`, `dogovor_contracts`.
   - Должна быть функция `get_next_contract_number`.
   - Должна быть последовательность `dogovor_contract_seq`.
   - Должна быть политика INSERT для `dogovor_contracts`.
   - В конце запрос покажет последние 5 договоров — если записей нет, но бэкенд отдаёт 200, значит пишет в другой проект или схема не выполнялась.

Если чего-то нет — выполни в том же проекте полный скрипт **`dogovor/supabase/001_contracts_schema.sql`** (создание таблиц, RLS, функцию, сиды).

## 3. Переменные в Railway

| Переменная | Назначение |
|------------|------------|
| `SUPABASE_URL` | Project URL из Supabase (Settings → API). |
| `SUPABASE_SERVICE_KEY` | **service_role** key (не anon) из того же раздела. |
| `STORAGE_BUCKET` | Имя бакета для PDF, по умолчанию `contracts`. Бакет должен быть создан в Storage. |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM_EMAIL`, `SMTP_FROM_NAME` | Для отправки письма с PDF. |

После смены переменных сделай **Redeploy** сервиса бэкенда.

## 4. Поиск записи по ID

После успешного создания договора на экране показывается **«ID в БД: …»** (UUID).  
В Supabase: **Table Editor → dogovor_contracts** — открой фильтр по столбцу `id` и вставь этот UUID. Если запись есть в этом проекте — она найдётся.

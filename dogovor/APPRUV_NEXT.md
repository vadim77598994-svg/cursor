# Что уже сделано и что осталось на апрув

## Используется проект Supabase «dogovor»

URL: **https://sojsihvhpvmzzdmqgpri.supabase.co**

---

## Сделано автоматически

1. **SQL в проекте dogovor** (через MCP):
   - таблицы `dogovor_locations`, `dogovor_staff`, `dogovor_contracts`;
   - sequence и функция `get_next_contract_number`;
   - RLS и политики;
   - **3 кабинета** и **6 оптометристов** вставлены.

2. **Конфиги**
   - **dogovor/backend/.env** — указан `SUPABASE_URL` проекта dogovor. **Нужно вручную вписать `SUPABASE_SERVICE_KEY`** (service_role из Dashboard → проект dogovor → Settings → API).
   - **dogovor/frontend/.env.local** — `NEXT_PUBLIC_DOGOVOR_API_URL=http://localhost:8000`.

---

## Что сделать вручную

### 1. Service role ключ для бэкенда

В Supabase открой проект **dogovor** → **Project Settings** (шестерёнка) → **API** → в блоке **Project API keys** нажми **Reveal** у ключа **service_role** и скопируй его. Вставь в **dogovor/backend/.env** в строку `SUPABASE_SERVICE_KEY=...` (без кавычек и пробелов).

### 2. Bucket для PDF

В проекте **dogovor** → **Storage** → **New bucket** → имя **contracts**. При необходимости включи **Public bucket**.

### 3. Запуск

- **Бэкенд:** `cd dogovor/backend && python3 -m venv .venv && source .venv/bin/activate && pip install -r requirements.txt && uvicorn app.main:app --reload --port 8000`
- **Фронт:** в другом терминале `cd dogovor/frontend && npm install && npm run dev`

Открой http://localhost:3001 и пройди сценарий: кабинет → врач → ввод данных вручную → подпись → Сгенерировать договор.

# Деплой бэкенда и фронта на Timeweb

Краткий чеклист: перенос с Railway на Timeweb, почта через Яндекс SMTP.

Быстрый путь для реального переезда: `docs/TIMEWEB_QUICKSTART.md`  
Там готовый вариант через `docker compose` + nginx + certbot.

## 1. Подготовка

- Сохрани переменные окружения с Railway (Supabase, Beorg, CORS) — понадобятся на Timeweb.
- На Timeweb SMTP (порты 465/587) обычно не блокируется — в отличие от Railway.

## 2. Бэкенд на Timeweb

- **Рабочая директория:** `dogovor/backend` (или корень репо с указанием пути к бэку).
- **Запуск:** `uvicorn app.main:app --host 0.0.0.0 --port 8000` (или порт из настроек панели). При использовании Docker — см. `backend/Dockerfile` при наличии.
- **Домен/HTTPS:** в панели Timeweb привяжи домен к сервису — HTTPS (Let's Encrypt) настраивается автоматически.

### Переменные окружения (скопировать и подставить значения)

```
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_SERVICE_KEY=eyJ...
STORAGE_BUCKET=contracts

CORS_ORIGINS=https://твой-фронт.ru
# Несколько доменов через запятую без пробелов:
# CORS_ORIGINS=https://dogovor.pyeoptics.com,https://www.pyeoptics.com

EMAIL_PROVIDER=smtp
SMTP_HOST=smtp.yandex.ru
SMTP_PORT=465
SMTP_USER=support@pyeoptics.com
SMTP_PASSWORD=пароль_приложения_яндекс
SMTP_FROM_EMAIL=support@pyeoptics.com
SMTP_FROM_NAME=Пай Оптикс

BEORG_PROJECT_ID=...
BEORG_TOKEN=...
BEORG_MACHINE_UID=...
```

Опционально: `PREPROCESS_PASSPORT_IMAGE=true` (по умолчанию true).

### Проверка почты после деплоя

Открой в браузере: `https://ТВОЙ-БЭКЕНД-НА-TIMEWEB/debug/smtp-check`  
Ожидаемо: `smtp_configured: true`, `connection_ok: true`. Подробнее: `docs/EMAIL_SMTP.md`.

## 3. Фронт на Timeweb

- Собрать: `cd dogovor/frontend && npm ci && npm run build`.
- Раздавать статику из `out` (при `output: 'export'`) через nginx или панель, либо запустить `npm run start` и проксировать на него.
- В настройках (или в `.env.production`) задать:
  - `NEXT_PUBLIC_DOGOVOR_API_URL=https://твой-бэкенд-на-timeweb.ru` (без слэша в конце).

В бэкенде в `CORS_ORIGINS` должен быть URL этого фронта.

## 4. После переезда

1. Открыть фронт → кабинет → врач → сканирование или ввод вручную → проверка → подпись → «Подписать и отправить» с своим email.
2. Убедиться, что письмо с PDF пришло.
3. При ошибках запросов к API проверить `CORS_ORIGINS` и `NEXT_PUBLIC_DOGOVOR_API_URL`.

Сводный чеклист безопасности и переезда: `docs/CHECKLIST_SECURITY_AND_TIMEWEB.md`.

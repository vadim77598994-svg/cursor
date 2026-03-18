# Timeweb: какие env собрать заранее

Перед входом на сервер Timeweb удобно заранее выписать все переменные из текущего проекта.

## 1. Из Railway / текущего бэкенда

Найти в Variables сервиса:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_KEY`
- `STORAGE_BUCKET`
- `BEORG_PROJECT_ID`
- `BEORG_TOKEN`
- `BEORG_MACHINE_UID`
- `CORS_ORIGINS` (потом обновишь под новый домен)

## 2. Для Яндекс SMTP

Подготовить:

- `EMAIL_PROVIDER=smtp`
- `SMTP_HOST=smtp.yandex.ru`
- `SMTP_PORT=465`
- `SMTP_USER`
- `SMTP_PASSWORD` — именно пароль приложения Яндекса
- `SMTP_FROM_EMAIL`
- `SMTP_FROM_NAME=Пай Оптикс`

## 3. Для фронта

Подготовить итоговый адрес API:

- `NEXT_PUBLIC_DOGOVOR_API_URL=https://api.dogovor.example.com`

Если на первом этапе тестируешь по IP:

- `NEXT_PUBLIC_DOGOVOR_API_URL=http://IP_СЕРВЕРА`

## 4. Что куда пойдёт

### В `backend/.env.production`

- `SUPABASE_URL`
- `SUPABASE_SERVICE_KEY`
- `STORAGE_BUCKET`
- `CORS_ORIGINS`
- `EMAIL_PROVIDER`
- `SMTP_HOST`
- `SMTP_PORT`
- `SMTP_USER`
- `SMTP_PASSWORD`
- `SMTP_FROM_EMAIL`
- `SMTP_FROM_NAME`
- `BEORG_PROJECT_ID`
- `BEORG_TOKEN`
- `BEORG_MACHINE_UID`

### В `.env.timeweb`

- `NEXT_PUBLIC_DOGOVOR_API_URL`

## 5. Где лежат шаблоны

- бэкенд: [`backend/.env.example`](backend/.env.example)
- фронт: [`.env.timeweb.example`](.env.timeweb.example)

## 6. Минимальная проверка перед деплоем

Перед запуском на сервере проверь:

- все секреты скопированы без лишних пробелов
- `STORAGE_BUCKET` совпадает с бакетом в Supabase
- `CORS_ORIGINS` указывает на будущий фронтовый домен
- `NEXT_PUBLIC_DOGOVOR_API_URL` указывает на будущий API-домен

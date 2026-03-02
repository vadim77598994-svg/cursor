# Вынос проекта в прод — пошагово

Ниже: что в итоге делаем, что нужно сделать тебе по шагам, и какие переменные куда подставить.

---

## Что делаем в целом

1. **Бэкенд** (FastAPI) выносим на облачный хостинг — он будет доступен по своему URL (например `https://dogovor-api.railway.app`). Там же задаём все секреты (Supabase, SMTP, CORS).
2. **Фронт** (Next.js) выносим на Vercel — получится URL типа `https://dogovor-xxx.vercel.app`. В настройках указываем URL бэкенда, чтобы фронт ходил в API по HTTPS.
3. **CORS** на бэкенде разрешаем только твой прод-адрес фронта (чтобы с других сайтов к API не обращались).
4. По желанию привязываем **свой домен** к фронту (например `dogovor.pyeoptics.com`).

После этого планшеты в кабинетах открывают сайт по домену, данные уходят на твой бэкенд и в Supabase, PDF сохраняются и уходят на email.

---

## Часть 1. Бэкенд (что тебе сделать)

**Подробный пошаговый план с разделением «что делаю я / что делаешь ты»:** см. **`docs/DEPLOY_PART1_PLAN.md`**.

Рекомендуемый вариант — **Railway** (удобно подключать GitHub; есть пробный период и ограниченный free tier, для стабильного прода обычно платный план, см. [railway.app/pricing](https://railway.app/pricing)).  
**Сравнение бесплатных и платных вариантов, насколько подходят для стабильной работы:** см. **`docs/HOSTING_ALTERNATIVES.md`**.

### Шаг 1.1. Регистрация и проект

1. Зайди на [railway.app](https://railway.app), войди через GitHub.
2. **New Project** → **Deploy from GitHub repo**.
3. Выбери свой репозиторий (тот, где лежит папка `dogovor`). Если репо ещё не подключён — разреши доступ Railway к нему.
4. Railway создаст сервис из репо. Нужно указать, что запускаем **не корень репо**, а папку с бэкендом.

### Шаг 1.2. Корень проекта и команда запуска

1. В настройках сервиса найди **Root Directory** (или **Source**) и укажи: **`dogovor/backend`**.
2. **Build Command** (если спрашивают):  
   `pip install -r requirements.txt`  
   или оставь автоопределение.
3. **Start Command** (команда запуска):  
   `uvicorn app.main:app --host 0.0.0.0 --port $PORT`  
   (Railway подставляет `$PORT` сам.)

Сохрани настройки. Деплой может упасть, пока не заданы переменные — переходи к шагу 1.3.

### Шаг 1.3. Переменные окружения (Environment Variables)

В проекте Railway открой свой сервис → вкладка **Variables** (или **Environment**). Добавь переменные по одной (имя и значение):

| Имя | Значение (подставь свои) |
|-----|--------------------------|
| `SUPABASE_URL` | Твой URL Supabase, например `https://sojsihvhpvmzzdmqgpri.supabase.co` |
| `SUPABASE_SERVICE_KEY` | service_role ключ из Supabase (Dashboard → Settings → API → service_role) |
| `SUPABASE_STORAGE_BUCKET` | `contracts` |
| `CORS_ORIGINS` | Пока оставь пустым или укажи временный URL фронта (см. часть 2). После деплоя фронта замени на итоговый, например `https://dogovor.pyeoptics.com` или `https://твой-проект.vercel.app` |
| `SMTP_HOST` | `smtp.yandex.ru` |
| `SMTP_PORT` | `465` |
| `SMTP_USER` | `support@pyeoptics.com` |
| `SMTP_PASSWORD` | Пароль приложения Яндекса (тот же, что в локальном `.env`) |
| `SMTP_FROM_EMAIL` | `support@pyeoptics.com` |
| `SMTP_FROM_NAME` | `Пай Оптикс` |

Сохрани. Railway пересоберёт и перезапустит сервис.

### Шаг 1.4. Получить URL бэкенда

1. В Railway открой сервис → вкладка **Settings**.
2. Раздел **Networking** → **Generate Domain**. Railway выдаст домен вида `твой-сервис.up.railway.app`.
3. Скопируй полный URL, например `https://dogovor-production.up.railway.app` — это **URL бэкенда**. Он понадобится для фронта и для `CORS_ORIGINS`.

Проверка: открой в браузере `https://твой-url/health`. Должен вернуться JSON: `{"status":"ok"}`.

---

## Часть 2. Фронт (что тебе сделать)

Используем **Vercel** (удобно для Next.js, есть бесплатный план).

### Шаг 2.1. Подключить репозиторий

1. Зайди на [vercel.com](https://vercel.com), войди через GitHub.
2. **Add New** → **Project** → выбери тот же репозиторий, что и для бэкенда.
3. Важно: в настройках проекта укажи **Root Directory** → **Edit** → выбери папку **`dogovor/frontend`** (не корень репо).
4. **Framework Preset** оставь Next.js.

### Шаг 2.2. Переменная для URL бэкенда

1. Перед деплоем открой **Environment Variables**.
2. Добавь переменную:
   - **Name:** `NEXT_PUBLIC_DOGOVOR_API_URL`
   - **Value:** URL бэкенда из шага 1.4, без слэша в конце, например `https://dogovor-production.up.railway.app`
3. Сохрани.

### Шаг 2.3. Деплой

Нажми **Deploy**. Vercel соберёт проект и выдаст ссылку вида `https://dogovor-frontend-xxx.vercel.app`.

### Шаг 2.4. Вернуться к бэкенду — указать CORS

1. Открой снова Railway → твой сервис → **Variables**.
2. Переменная **`CORS_ORIGINS`**: задай точный URL фронта. Например:
   - `https://dogovor-frontend-xxx.vercel.app`  
   или, если уже привязал свой домен:
   - `https://dogovor.pyeoptics.com`
3. Сохрани. Railway перезапустит бэкенд.

Теперь браузер с фронта на Vercel сможет обращаться к твоему API без CORS-ошибок.

---

## Часть 3. Свой домен (опционально)

Если хочешь открывать приложение по своему домену (например `dogovor.pyeoptics.com`):

1. В **Vercel** в настройках проекта: **Settings** → **Domains** → добавь домен (например `dogovor.pyeoptics.com`).
2. Vercel покажет, какую запись добавить у регистратора домена (CNAME или A). Настрой DNS у того, у кого куплен домен.
3. После того как домен начнёт открываться через Vercel, обнови на **Railway** переменную **`CORS_ORIGINS`**: укажи новый URL, например `https://dogovor.pyeoptics.com`, и перезапусти при необходимости.

---

## Часть 4. Проверка

1. Открой фронт по итоговому URL (Vercel или свой домен).
2. Пройди сценарий: кабинет → сканирование/ввод → проверка данных (можно указать свой email) → подпись → «Сгенерировать договор».
3. Убедись: номер договора появился, в Supabase в Storage есть PDF, в таблице `dogovor_contracts` — запись. Если указывал email — письмо с PDF должно прийти.
4. В браузере открой DevTools (F12) → вкладка Network/Сеть. Не должно быть ошибок CORS при запросах к бэкенду.

---

## Краткая шпаргалка

| Где | Что задать |
|-----|------------|
| **Railway (бэкенд)** | Root: `dogovor/backend`. Start: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`. Все переменные из таблицы в шаге 1.3, включая `CORS_ORIGINS` с URL фронта. |
| **Vercel (фронт)** | Root: `dogovor/frontend`. Одна переменная: `NEXT_PUBLIC_DOGOVOR_API_URL` = URL бэкенда. |
| **После смены домена** | Обновить `CORS_ORIGINS` на бэкенде и перезапустить. |

Безопасность при запуске — см. **`docs/SECURITY_DEPLOY.md`**.

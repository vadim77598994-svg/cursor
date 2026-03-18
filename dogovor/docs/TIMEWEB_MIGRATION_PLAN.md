# Подробный план переезда на Timeweb

Пошагово: что создать на Timeweb, что настроить, как запустить бэкенд и фронт и проверить работу. Рассчитан на один сервер (VPS или облачный сервер) с Docker.

---

## Что получится в итоге

- **Бэкенд (API):** доступен по своему адресу, например `https://api.dogovor.pyeoptics.com` или `https://dogovor-api.ваш-сервер.timeweb.cloud`.
- **Фронт:** доступен по основному адресу, например `https://dogovor.pyeoptics.com` или `https://dogovor.ваш-сервер.timeweb.cloud`.
- **Почта:** отправка через Яндекс SMTP с этого же сервера (порты 465/587 на Timeweb не блокируются).
- **БД и файлы:** остаются в Supabase (ничего переносить не нужно).

---

## Шаг 0. Что подготовить до начала

Сделай это до переезда.

### 0.1. Сохранить переменные окружения с Railway

В панели Railway открой проект с бэкендом → сервис бэкенда → **Variables**. Выпиши или экспортируй:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_KEY`
- `STORAGE_BUCKET` (обычно `contracts`)
- `BEORG_PROJECT_ID`, `BEORG_TOKEN`, `BEORG_MACHINE_UID`
- `CORS_ORIGINS` (URL текущего фронта — потом заменишь на новый)

Остальное (почта, CORS) настроишь заново на Timeweb.

### 0.2. Пароль приложения Яндекса для SMTP

Если ещё нет:

1. Зайди в [Яндекс ID](https://id.yandex.ru) → Безопасность → Пароли приложений.
2. Создай пароль приложения (например «Dogovor Timeweb»). Скопируй его — понадобится для `SMTP_PASSWORD`.

Ящик может быть свой доменный (например `support@pyeoptics.com`) или `@yandex.ru`. Для доменного нужно настроить почту в панели хостинга домена или в Яндекс 360.

### 0.3. Репозиторий с кодом

Код должен быть в Git (GitHub/GitLab и т.д.), чтобы на сервере можно было сделать `git clone`. Либо подготовь архив и план загрузки на сервер.

### 0.4. Домены (если будут свои)

Реши, какие адреса использовать:

- Вариант А: поддомены Timeweb, например `dogovor-xxx.twc1.net` для фронта и `dogovor-api-xxx.twc1.net` для API (панель Timeweb выдаёт их при создании сервиса/сервера).
- Вариант Б: свой домен (например `dogovor.pyeoptics.com` для фронта и `api.dogovor.pyeoptics.com` для API). Позже в панели Timeweb привяжешь домен к серверу и включишь HTTPS.

Пока можно ориентироваться на поддомены Timeweb; домен привязать потом.

---

## Шаг 1. Создать сервер на Timeweb

1. Зайди в [timeweb.cloud](https://timeweb.cloud) (или [timeweb.com](https://timeweb.com) — в зависимости от того, чем пользуешься).
2. Создай **облачный сервер** (VPS) или **VDS**:
   - ОС: **Ubuntu 22.04** (или 24.04) — удобно для Docker и nginx.
   - Регион: ближе к пользователям (Москва/СПб если есть).
   - Минимум 1 GB RAM, 1 vCPU; для бэкенда + фронт разумно 2 GB RAM.
3. Сохрани:
   - IP-адрес сервера;
   - логин по SSH (часто `root` или имя пользователя из письма);
   - пароль или путь к SSH-ключу (если добавлял свой ключ при создании).

Доступ по SSH: `ssh root@IP_АДРЕС` (или `ssh пользователь@IP_АДРЕС`).

---

## Шаг 2. Подключиться по SSH и обновить систему

```bash
ssh root@IP_АДРЕС
```

(Подставь свой IP и пользователя.)

```bash
apt update && apt upgrade -y
```

Установи базовые пакеты (нужны для Docker и nginx):

```bash
apt install -y curl git
```

---

## Шаг 3. Установить Docker и Docker Compose

На сервере:

```bash
curl -fsSL https://get.docker.com | sh
usermod -aG docker root
```

Проверка:

```bash
docker --version
docker compose version
```

Если используешь не `root`, а отдельного пользователя — добавь его в группу `docker`:  
`usermod -aG docker ИМЯ_ПОЛЬЗОВАТЕЛЯ`.

---

## Шаг 4. Подготовить каталог проекта и клонировать репо

Выбери каталог, где будет жить проект (например `/var/www` или домашняя папка):

```bash
mkdir -p /var/www
cd /var/www
git clone https://github.com/ТВОЙ_ЛОГИН/ТВОЙ_РЕПО.git
cd ТВОЙ_РЕПО/dogovor
```

Если репо приватный, настрой на сервере SSH-ключ и добавь его в GitHub/GitLab, либо используй HTTPS с токеном. После клона в каталоге должны быть папки `backend` и `frontend` (внутри `dogovor`).

---

## Шаг 5. Запустить бэкенд в Docker

Бэкенд уже есть в `dogovor/backend` с готовым `Dockerfile`. Запускаем его вручную (без docker-compose пока), чтобы не усложнять план.

### 5.1. Создать файл с переменными окружения на сервере

На сервере создай файл (например `/var/www/ТВОЙ_РЕПО/dogovor/backend/.env.production`) **только с нужными переменными** — в репозиторий этот файл не коммитить. Либо задай переменные в `docker run -e ...` (см. ниже).

Минимальный набор (подставь свои значения):

```bash
cd /var/www/ТВОЙ_РЕПО/dogovor/backend
nano .env.production
```

Вставь (значения замени):

```env
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_SERVICE_KEY=eyJ...
STORAGE_BUCKET=contracts

CORS_ORIGINS=https://твой-фронт-адрес
# Пока можно указать временно http://IP_АДРЕС:3000 или оставить пустым, потом поправить.

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

Сохрани (в nano: Ctrl+O, Enter, Ctrl+X).

### 5.2. Собрать и запустить контейнер бэкенда

Из каталога `dogovor/backend`:

```bash
cd /var/www/ТВОЙ_РЕПО/dogovor/backend
docker build -t dogovor-backend .
docker run -d \
  --name dogovor-backend \
  --restart unless-stopped \
  -p 8000:8080 \
  --env-file .env.production \
  dogovor-backend
```

Проверка: на сервере `curl http://127.0.0.1:8000/health` (порт в контейнере 8080, мы пробросили на 8000). Должен вернуться `{"status":"ok"}`.

Если что-то не так — посмотри логи: `docker logs dogovor-backend`.

---

## Шаг 6. Установить Node.js и собрать фронт

На сервере нужны Node.js 18+ и npm.

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs
node -v
npm -v
```

Создай файл с URL бэкенда для фронта (на сервере он будет известен после настройки nginx/домена; пока можно указать `http://IP_АДРЕС:8000` для проверки):

```bash
cd /var/www/ТВОЙ_РЕПО/dogovor/frontend
echo "NEXT_PUBLIC_DOGOVOR_API_URL=http://IP_АДРЕС:8000" > .env.production
```

(Потом замени на итоговый URL API, например `https://api.dogovor.pyeoptics.com`.)

Сборка и запуск в фоне (для проверки):

```bash
npm ci
npm run build
npm run start &
```

Фронт по умолчанию слушает порт 3000. Проверка: открой в браузере `http://IP_АДРЕС:3000`. Должна открыться форма договора. Если фронт открывается, но запросы к API падают — вернёшься к CORS и URL после настройки nginx.

Остановить процесс: `pkill -f "next start"` (потом запустим через systemd или через отдельный скрипт с `npm run start`).

---

## Шаг 7. Настроить nginx и HTTPS (прокси на бэкенд и фронт)

Установи nginx:

```bash
apt install -y nginx
```

Дальше два варианта: с твоим доменом или пока по IP.

### Вариант А: Пока без своего домена (доступ по IP)

Один виртуальный хост: порт 80 → фронт на 3000, а запросы к API — на 8000. Тогда фронт должен обращаться к API по тому же IP (например `http://IP:8000`). Создай конфиг:

```bash
nano /etc/nginx/sites-available/dogovor
```

Вставь (замени `ВАШ_IP` на реальный IP сервера):

```nginx
server {
    listen 80 default_server;
    server_name ВАШ_IP;

    # Фронт (Next.js)
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # Бэкенд (FastAPI)
    location /api/ {
        proxy_pass http://127.0.0.1:8000/api/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
    location /health {
        proxy_pass http://127.0.0.1:8000/health;
        proxy_set_header Host $host;
    }
    location /debug/ {
        proxy_pass http://127.0.0.1:8000/debug/;
        proxy_set_header Host $host;
    }
}
```

Включи сайт и перезагрузи nginx:

```bash
ln -sf /etc/nginx/sites-available/dogovor /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx
```

Тогда:

- Фронт: `http://ВАШ_IP/`
- API: `http://ВАШ_IP/api/` (в т.ч. `http://ВАШ_IP/api/v1/...`)

В `.env.production` фронта поставь:  
`NEXT_PUBLIC_DOGOVOR_API_URL=http://ВАШ_IP`  
(без слэша в конце; фронт сам допишет `/api/v1/...` при запросах).  
В бэкенде в `CORS_ORIGINS` укажи `http://ВАШ_IP`.

Проверка: открой `http://ВАШ_IP`, выбери кабинет/врача. Если запросы идут на `http://ВАШ_IP/api/v1/...` — всё ок.

### Вариант Б: Со своим доменом (рекомендуется для прода)

Пусть фронт: `dogovor.pyeoptics.com`, API: `api.dogovor.pyeoptics.com`.

1. В панели DNS (где куплен домен) создай A-записи:
   - `dogovor.pyeoptics.com` → IP сервера
   - `api.dogovor.pyeoptics.com` → IP сервера

2. На сервере создай два конфига nginx (или один с двумя `server`):

```bash
nano /etc/nginx/sites-available/dogovor-frontend
```

```nginx
server {
    listen 80;
    server_name dogovor.pyeoptics.com;
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

```bash
nano /etc/nginx/sites-available/dogovor-api
```

```nginx
server {
    listen 80;
    server_name api.dogovor.pyeoptics.com;
    location / {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Включи оба и перезагрузи nginx:

```bash
ln -sf /etc/nginx/sites-available/dogovor-frontend /etc/nginx/sites-enabled/
ln -sf /etc/nginx/sites-available/dogovor-api /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx
```

3. HTTPS через Let's Encrypt (certbot):

```bash
apt install -y certbot python3-certbot-nginx
certbot --nginx -d dogovor.pyeoptics.com -d api.dogovor.pyeoptics.com
```

Следуй подсказкам (email, согласие). Certbot сам настроит HTTPS в nginx.

4. Переменные после этого:
   - На фронте (`.env.production`): `NEXT_PUBLIC_DOGOVOR_API_URL=https://api.dogovor.pyeoptics.com`
   - В бэкенде (`.env.production`): `CORS_ORIGINS=https://dogovor.pyeoptics.com`
   - Пересобери фронт и перезапусти бэкенд (см. ниже).

---

## Шаг 8. Запускать фронт постоянно (systemd)

Чтобы фронт поднимался после перезагрузки и не падал:

```bash
nano /etc/systemd/system/dogovor-frontend.service
```

Вставь (путь к проекту поправь при необходимости):

```ini
[Unit]
Description=Dogovor Next.js frontend
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/var/www/ТВОЙ_РЕПО/dogovor/frontend
Environment=NODE_ENV=production
EnvironmentFile=/var/www/ТВОЙ_РЕПО/dogovor/frontend/.env.production
ExecStart=/usr/bin/npm run start
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```

Включи и запусти:

```bash
systemctl daemon-reload
systemctl enable dogovor-frontend
systemctl start dogovor-frontend
systemctl status dogovor-frontend
```

Бэкенд уже запущен в Docker с `--restart unless-stopped`, перезапуск сервера его поднимет.

---

## Шаг 9. Обновить переменные и перезапустить после смены домена

Если сначала проверял по IP, а потом привязал домен:

1. В `dogovor/backend/.env.production` поменяй `CORS_ORIGINS` на итоговый URL фронта (например `https://dogovor.pyeoptics.com`).
2. В `dogovor/frontend/.env.production` поменяй `NEXT_PUBLIC_DOGOVOR_API_URL` на итоговый URL API (например `https://api.dogovor.pyeoptics.com`).
3. Перезапуск бэка и пересборка фронта:

```bash
docker restart dogovor-backend
cd /var/www/ТВОЙ_РЕПО/dogovor/frontend
npm run build
systemctl restart dogovor-frontend
```

---

## Шаг 10. Проверка после переезда

1. **Здоровье бэка:** открой `https://api.../health` (или `http://IP/api/health` при варианте по IP). Ожидаемо: `{"status":"ok"}`.
2. **Почта:** открой `https://api.../debug/smtp-check` (или `http://IP/debug/smtp-check`). Ожидаемо: `smtp_configured: true`, `connection_ok: true`.
3. **Сценарий договора:** открой фронт → кабинет → врач → ввод данных (или сканирование) → проверка → подпись → «Подписать и отправить», укажи свой email. Убедись, что письмо с PDF пришло.
4. При ошибках CORS в браузере проверь `CORS_ORIGINS` на бэке и что фронт обращается именно к тому URL, который указан в CORS.

---

## Краткая шпаргалка команд

| Действие | Команда |
|----------|--------|
| Логи бэкенда | `docker logs -f dogovor-backend` |
| Перезапуск бэкенда | `docker restart dogovor-backend` |
| Пересборка бэка после изменений кода | `cd dogovor/backend && docker build -t dogovor-backend . && docker stop dogovor-backend && docker rm dogovor-backend && docker run -d --name dogovor-backend --restart unless-stopped -p 8000:8080 --env-file .env.production dogovor-backend` |
| Статус фронта | `systemctl status dogovor-frontend` |
| Перезапуск фронта | `systemctl restart dogovor-frontend` |
| Пересборка фронта | `cd dogovor/frontend && npm run build && systemctl restart dogovor-frontend` |
| Обновление кода с Git | `cd /var/www/ТВОЙ_РЕПО && git pull` (потом пересобрать бэк и/или фронт по необходимости) |

---

## Что создано на Timeweb (итог)

- Один сервер (VPS/VDS) с Ubuntu.
- Docker: контейнер `dogovor-backend` (порт 8000 → 8080 внутри).
- Node.js: приложение фронта в `dogovor/frontend`, запуск через systemd `dogovor-frontend.service`.
- Nginx: прокси на фронт (3000) и на бэкенд (8000), при наличии домена — HTTPS через certbot.
- Файлы `.env.production` только на сервере (в репо не коммитить).

Supabase и Beorg остаются как есть; меняется только место запуска бэкенда и фронта и включена отправка почты через Яндекс SMTP.

Если на каком-то шаге что-то пойдёт не так — пришли вывод команды или скрин, разберём по шагу.

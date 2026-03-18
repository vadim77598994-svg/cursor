# Timeweb Quickstart

Самый короткий путь переезда на Timeweb для этого проекта: один VPS/VDS, `docker compose` для фронта и бэка, nginx + certbot на сервере.

## Что подготовить

На сервере должны быть:

- Ubuntu 22.04/24.04
- `git`
- `docker`
- `docker compose`
- `nginx`
- позже `certbot`

## 1. Клонировать проект

```bash
mkdir -p /var/www
cd /var/www
git clone https://github.com/vadim77598994-svg/cursor.git
cd cursor/dogovor
```

## 2. Подготовить env-файлы

### Бэкенд

```bash
cp backend/.env.example backend/.env.production
nano backend/.env.production
```

Минимум заполнить:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_KEY`
- `STORAGE_BUCKET=contracts`
- `CORS_ORIGINS=https://dogovor.example.com`
- `EMAIL_PROVIDER=smtp`
- `SMTP_HOST=smtp.yandex.ru`
- `SMTP_PORT=465`
- `SMTP_USER=...`
- `SMTP_PASSWORD=...`
- `SMTP_FROM_EMAIL=...`
- `SMTP_FROM_NAME=Пай Оптикс`
- `BEORG_PROJECT_ID=...`
- `BEORG_TOKEN=...`
- `BEORG_MACHINE_UID=...`

### Фронт

```bash
cp .env.timeweb.example .env.timeweb
nano .env.timeweb
```

Поставить:

- если API на отдельном поддомене: `NEXT_PUBLIC_DOGOVOR_API_URL=https://api.dogovor.example.com`
- если API будет идти через тот же домен: `NEXT_PUBLIC_DOGOVOR_API_URL=https://dogovor.example.com`

## 3. Поднять контейнеры

```bash
docker compose --env-file .env.timeweb -f docker-compose.timeweb.yml up -d --build
```

Проверка:

```bash
docker ps
curl http://127.0.0.1:8000/health
```

Ожидаемо:

- контейнеры `dogovor-backend` и `dogovor-frontend` запущены
- `/health` отдаёт `{"status":"ok"}`

## 4. Настроить nginx

Скопировать шаблон:

```bash
cp deploy/nginx/dogovor-timeweb.conf.example /etc/nginx/sites-available/dogovor
nano /etc/nginx/sites-available/dogovor
```

Заменить:

- `dogovor.example.com`
- `api.dogovor.example.com`

Включить:

```bash
ln -sf /etc/nginx/sites-available/dogovor /etc/nginx/sites-enabled/dogovor
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx
```

## 5. Включить HTTPS

```bash
apt install -y certbot python3-certbot-nginx
certbot --nginx -d dogovor.example.com -d api.dogovor.example.com
```

## 6. После каждого обновления кода

```bash
cd /var/www/cursor/dogovor
git pull
docker compose --env-file .env.timeweb -f docker-compose.timeweb.yml up -d --build
```

## 7. Что проверить после переезда

- `https://api.dogovor.example.com/health`
- `https://api.dogovor.example.com/debug/smtp-check`
- фронт открывается
- список кабинетов загружается
- сканирование паспорта работает
- PDF приходит на email

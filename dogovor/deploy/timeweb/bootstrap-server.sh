#!/usr/bin/env bash
set -euo pipefail

echo "==> Updating system"
apt update && apt upgrade -y

echo "==> Installing base packages"
apt install -y git curl nginx ca-certificates gnupg

if ! command -v docker >/dev/null 2>&1; then
  echo "==> Installing Docker"
  curl -fsSL https://get.docker.com | sh
fi

echo "==> Docker version"
docker --version

if docker compose version >/dev/null 2>&1; then
  echo "==> Docker Compose is available"
else
  echo "Docker Compose is not available. Install the compose plugin before continuing." >&2
  exit 1
fi

echo "==> Nginx version"
nginx -v

cat <<'EOF'

Server bootstrap completed.

Next steps:
1. Clone repo into /var/www
2. Fill backend/.env.production
3. Fill .env.timeweb
4. Run:
   docker compose --env-file .env.timeweb -f docker-compose.timeweb.yml up -d --build
EOF

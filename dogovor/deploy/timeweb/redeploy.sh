#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT_DIR"

if [[ ! -f ".env.timeweb" ]]; then
  echo "Missing .env.timeweb in $ROOT_DIR" >&2
  exit 1
fi

if [[ ! -f "backend/.env.production" ]]; then
  echo "Missing backend/.env.production in $ROOT_DIR/backend" >&2
  exit 1
fi

docker compose --env-file .env.timeweb -f docker-compose.timeweb.yml up -d --build

echo
echo "Containers:"
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
echo
echo "Backend health:"
curl -sS http://127.0.0.1:8000/health || true
echo

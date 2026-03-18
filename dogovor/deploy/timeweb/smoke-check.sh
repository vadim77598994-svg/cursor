#!/usr/bin/env bash
set -euo pipefail

FRONTEND_URL="${1:-http://127.0.0.1:3000}"
API_URL="${2:-http://127.0.0.1:8000}"

echo "==> Backend health"
curl -fsS "${API_URL}/health"
echo
echo

echo "==> SMTP check"
curl -fsS "${API_URL}/debug/smtp-check"
echo
echo

echo "==> Frontend headers"
curl -I -fsS "${FRONTEND_URL}"
echo
echo

echo "==> Backend CORS debug"
curl -fsS "${API_URL}/debug/cors"
echo
echo

echo "Smoke check completed."

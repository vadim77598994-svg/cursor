#!/bin/bash
# Запуск бэкенда (использует venv из этой папки, activate не нужен)
cd "$(dirname "$0")"
echo "Запуск бэкенда на http://127.0.0.1:8000 ... (оставьте окно терминала открытым)"
# Без буферизации — в терминале сразу видно "Uvicorn running on..."
export PYTHONUNBUFFERED=1
exec .venv/bin/uvicorn app.main:app --reload --port 8000

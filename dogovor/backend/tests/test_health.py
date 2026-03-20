"""Минимальный тест API: health endpoint. Каркас для расширения тестами (smart test generator и т.д.)."""
import os

import pytest
from fastapi.testclient import TestClient

# Минимальные env, чтобы app загрузился (без реального Supabase)
from app.main import app

client = TestClient(app)


def test_health():
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data.get("status") == "ok"

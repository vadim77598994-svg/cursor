from fastapi import APIRouter, HTTPException

from app.config import settings
from app.db_postgres import get_locations as get_locations_postgres

router = APIRouter()


@router.get("/locations")
def list_locations():
    """Список кабинетов проверки зрения для выбора в интерфейсе."""
    try:
        # В этом проекте данные обслуживаются Postgres+MinIO (без Supabase).
        return get_locations_postgres()
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"postgres error: {e}")

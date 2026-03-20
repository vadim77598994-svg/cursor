from fastapi import APIRouter, HTTPException, Query

from app.config import settings
from app.db_postgres import get_staff as get_staff_postgres

router = APIRouter()


@router.get("/staff")
def list_staff(city: str | None = Query(None, description="Фильтр по городу (оптометристы кабинета)")):
    """Список оптометристов. Если передан city — только из этого города."""
    try:
        return get_staff_postgres(city)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"postgres error: {e}")

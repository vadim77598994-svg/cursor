from fastapi import APIRouter, HTTPException, Query

from app.config import settings
from app.db import supabase
from app.db_postgres import get_staff as get_staff_postgres

router = APIRouter()


@router.get("/staff")
def list_staff(city: str | None = Query(None, description="Фильтр по городу (оптометристы кабинета)")):
    """Список оптометристов. Если передан city — только из этого города."""
    try:
        if settings.data_backend.strip().lower() == "postgres":
            return get_staff_postgres(city)

        q = supabase.table("dogovor_staff").select("id, fio, city, signature_image_url").order("sort_order")
        if city:
            q = q.eq("city", city)
        r = q.execute()
        return r.data
    except Exception as e:
        provider = settings.data_backend.strip().lower()
        raise HTTPException(status_code=502, detail=f"{provider} error: {e}")

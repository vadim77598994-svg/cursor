from fastapi import APIRouter, HTTPException

from app.config import settings
from app.db import supabase
from app.db_postgres import get_locations as get_locations_postgres

router = APIRouter()


@router.get("/locations")
def list_locations():
    """Список кабинетов проверки зрения для выбора в интерфейсе."""
    try:
        if settings.data_backend.strip().lower() == "postgres":
            return get_locations_postgres()

        r = supabase.table("dogovor_locations").select("*").order("sort_order").execute()
        return r.data
    except Exception as e:
        provider = settings.data_backend.strip().lower()
        raise HTTPException(status_code=502, detail=f"{provider} error: {e}")

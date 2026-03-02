from fastapi import APIRouter, HTTPException

from app.db import supabase

router = APIRouter()


@router.get("/locations")
def list_locations():
    """Список кабинетов проверки зрения для выбора в интерфейсе."""
    try:
        r = supabase.table("dogovor_locations").select("*").order("sort_order").execute()
        return r.data
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Supabase error: {e}")

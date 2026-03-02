from fastapi import APIRouter, HTTPException, Query

from app.db import supabase

router = APIRouter()


@router.get("/staff")
def list_staff(city: str | None = Query(None, description="Фильтр по городу (оптометристы кабинета)")):
    """Список оптометристов. Если передан city — только из этого города."""
    try:
        q = supabase.table("dogovor_staff").select("id, fio, city, signature_image_url").order("sort_order")
        if city:
            q = q.eq("city", city)
        r = q.execute()
        return r.data
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Supabase error: {e}")

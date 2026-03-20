from supabase import create_client

from app.config import settings

supabase = None

# В режиме postgres Supabase не используется — не падаем при отсутствии env.
if settings.data_backend.strip().lower() == "supabase":
    if not settings.supabase_url or not settings.supabase_service_key:
        raise ValueError("SUPABASE_URL and SUPABASE_SERVICE_KEY must be set in .env for data_backend=supabase")
    supabase = create_client(settings.supabase_url, settings.supabase_service_key)

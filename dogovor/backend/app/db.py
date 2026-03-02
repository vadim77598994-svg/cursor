from supabase import create_client

from app.config import settings

if not settings.supabase_url or not settings.supabase_service_key:
    raise ValueError("SUPABASE_URL and SUPABASE_SERVICE_KEY must be set in .env")

supabase = create_client(settings.supabase_url, settings.supabase_service_key)

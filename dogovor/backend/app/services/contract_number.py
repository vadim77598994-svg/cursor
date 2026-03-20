from app.config import settings
from app.db import supabase
from app.db_postgres import get_next_contract_number as get_next_contract_number_postgres


def get_next_contract_number(prefix: str) -> str:
    """Получить следующий номер договора: PREFIX-YYYY-NNNNN (атомарно через Sequence)."""
    if settings.data_backend.strip().lower() == "postgres":
        return get_next_contract_number_postgres(prefix)

    r = supabase.rpc("get_next_contract_number", {"loc_prefix": prefix}).execute()
    raw = r.data
    if raw is None:
        raise ValueError("get_next_contract_number returned empty")
    value = raw[0] if isinstance(raw, list) and len(raw) == 1 else raw
    return str(value)

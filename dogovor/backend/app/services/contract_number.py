from app.db import supabase


def get_next_contract_number(prefix: str) -> str:
    """Получить следующий номер договора: PREFIX-YYYY-NNNNN (атомарно через Sequence)."""
    r = supabase.rpc("get_next_contract_number", {"loc_prefix": prefix}).execute()
    raw = r.data
    if raw is None:
        raise ValueError("get_next_contract_number returned empty")
    value = raw[0] if isinstance(raw, list) and len(raw) == 1 else raw
    return str(value)

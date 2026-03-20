from app.db_postgres import get_next_contract_number as get_next_contract_number_postgres


def get_next_contract_number(prefix: str) -> str:
    """Получить следующий номер договора: PREFIX-YYYY-NNNNN (атомарно через Sequence)."""
    return get_next_contract_number_postgres(prefix)

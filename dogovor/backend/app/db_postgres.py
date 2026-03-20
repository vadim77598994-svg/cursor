"""
Postgres backend для модуля "договор" (вариант б).

Таблицы: public.dogovor_locations, public.dogovor_staff, public.dogovor_contracts
Функции/последовательность: public.get_next_contract_number(prefix text)
"""

from __future__ import annotations

from typing import Any

import psycopg
from psycopg.rows import dict_row

from app.config import settings


def _connect():
    if not settings.postgres_host or not settings.postgres_user or not settings.postgres_password:
        raise ValueError(
            "Postgres не настроен: задайте postgres_host/postgres_user/postgres_password (data_backend=postgres)"
        )

    # В Docker-сценарии обычно используем внутреннюю сеть без SSL.
    return psycopg.connect(
        host=settings.postgres_host,
        port=settings.postgres_port,
        dbname=settings.postgres_db,
        user=settings.postgres_user,
        password=settings.postgres_password,
        connect_timeout=5,
    )


def get_locations() -> list[dict[str, Any]]:
    with _connect() as conn:
        with conn.cursor(row_factory=dict_row) as cur:
            cur.execute(
                """
                select id, name, address, city, contract_prefix, sort_order
                from public.dogovor_locations
                order by sort_order asc, name asc
                """
            )
            rows = cur.fetchall()
            return list(rows)


def get_staff(city: str | None = None) -> list[dict[str, Any]]:
    with _connect() as conn:
        with conn.cursor(row_factory=dict_row) as cur:
            if city:
                cur.execute(
                    """
                    select id, fio, city, signature_image_url
                    from public.dogovor_staff
                    where city = %s
                    order by sort_order asc, fio asc
                    """,
                    (city,),
                )
            else:
                cur.execute(
                    """
                    select id, fio, city, signature_image_url
                    from public.dogovor_staff
                    order by sort_order asc, city asc, fio asc
                    """
                )
            rows = cur.fetchall()
            return list(rows)


def get_location_for_preview(location_id: str) -> dict[str, Any] | None:
    with _connect() as conn:
        with conn.cursor(row_factory=dict_row) as cur:
            cur.execute(
                """
                select contract_prefix, address, city
                from public.dogovor_locations
                where id = %s
                """,
                (location_id,),
            )
            return cur.fetchone()


def get_staff_for_preview(staff_id: str) -> dict[str, Any] | None:
    with _connect() as conn:
        with conn.cursor(row_factory=dict_row) as cur:
            cur.execute(
                """
                select fio, signature_image_url
                from public.dogovor_staff
                where id = %s
                """,
                (staff_id,),
            )
            return cur.fetchone()


def get_next_contract_number(loc_prefix: str) -> str:
    with _connect() as conn:
        with conn.cursor(row_factory=dict_row) as cur:
            cur.execute("select public.get_next_contract_number(%s) as contract_number", (loc_prefix,))
            row = cur.fetchone()
            if not row or not row.get("contract_number"):
                raise ValueError("get_next_contract_number returned empty")
            return str(row["contract_number"])


def insert_contract(
    *,
    contract_number: str,
    location_id: str,
    staff_id: str,
    patient_fio: str,
    pdf_path: str | None,
    device_uuid: str | None,
) -> str | None:
    with _connect() as conn:
        with conn.cursor(row_factory=dict_row) as cur:
            cur.execute(
                """
                insert into public.dogovor_contracts (
                    contract_number, location_id, staff_id, patient_fio, pdf_path, device_uuid
                )
                values (%s, %s, %s, %s, %s, %s)
                returning id
                """,
                (
                    contract_number,
                    location_id,
                    staff_id,
                    patient_fio,
                    pdf_path,
                    device_uuid,
                ),
            )
            row = cur.fetchone()
            return str(row["id"]) if row and row.get("id") else None


def get_contract_pdf_meta(contract_id: str) -> dict[str, Any] | None:
    with _connect() as conn:
        with conn.cursor(row_factory=dict_row) as cur:
            cur.execute(
                """
                select pdf_path, contract_number
                from public.dogovor_contracts
                where id = %s
                """,
                (contract_id,),
            )
            return cur.fetchone()


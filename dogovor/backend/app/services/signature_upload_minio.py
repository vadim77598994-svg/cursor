"""
Загрузка подписей оптометристов в MinIO и обновление:
  public.dogovor_staff.signature_image_url (как object key в бакете)

Использование:
  Из корня backend:
    python -m app.services.signature_upload_minio [папка_с_подписями]

По смыслу повторяет signature_upload.py для Supabase, но без Supabase.
"""

from __future__ import annotations

import sys
from pathlib import Path

import psycopg
from minio import Minio
from psycopg.rows import dict_row

from app.config import settings


# Фамилии оптометристов (первое слово из ФИО в БД)
STAFF_SURNAMES = [
    "Карташева",
    "Величко",
    "Еремина",
    "Ефремова",
    "Ивченко",
    "Никитина",
    "Коваленко",
    "Карасева",
]

# Имена файлов в Storage — только ASCII
STAFF_STORAGE_NAMES = [
    "Kartasheva",
    "Velichko",
    "Eremina",
    "Efremova",
    "Ivchenko",
    "Nikitina",
    "Kovalenko",
    "Karaseva",
]

# Вариант написания фамилии в имени файла (е/ё)
STAFF_FILE_ALT = {"Карасева": "Карасёва", "Карташева": "Карташёва"}


def _client() -> Minio:
    endpoint = (
        f"{settings.minio_endpoint}:{settings.minio_port}"
        if settings.minio_port
        else settings.minio_endpoint
    )
    return Minio(
        endpoint=endpoint,
        access_key=settings.minio_access_key,
        secret_key=settings.minio_secret_key,
        secure=bool(settings.minio_secure),
    )


def _connect_pg() -> psycopg.Connection:
    return psycopg.connect(
        host=settings.postgres_host,
        port=settings.postgres_port,
        dbname=settings.postgres_db,
        user=settings.postgres_user,
        password=settings.postgres_password,
        connect_timeout=5,
    )


def _ensure_bucket(client: Minio, bucket: str) -> None:
    if not client.bucket_exists(bucket):
        client.make_bucket(bucket)


def _upload_object(client: Minio, bucket: str, object_key: str, file_path: Path) -> None:
    with open(file_path, "rb") as f:
        length = file_path.stat().st_size
        client.put_object(
            bucket_name=bucket,
            object_name=object_key,
            data=f,
            length=length,
            content_type="image/png",
        )


def upload_signatures(signatures_dir: str) -> None:
    signatures_dir_path = Path(signatures_dir)
    if not signatures_dir_path.is_dir():
        print(f"Папка не найдена: {signatures_dir}")
        sys.exit(1)

    bucket = settings.storage_bucket
    client = _client()
    _ensure_bucket(client, bucket)

    with _connect_pg() as conn:
        with conn.cursor(row_factory=dict_row) as cur:
            cur.execute("select id, fio from public.dogovor_staff")
            staff_rows = cur.fetchall()

        for surname, storage_name in zip(STAFF_SURNAMES, STAFF_STORAGE_NAMES):
            fname = f"{surname}.png"
            local = signatures_dir_path / fname
            if not local.exists() and surname in STAFF_FILE_ALT:
                alt_fname = f"{STAFF_FILE_ALT[surname]}.png"
                alt_local = signatures_dir_path / alt_fname
                if alt_local.exists():
                    fname = alt_fname
                    local = alt_local

            if not local.exists():
                print(f"Пропуск: файл не найден: {local}")
                continue

            object_key = f"signatures/{storage_name}.png"
            try:
                _upload_object(client, bucket, object_key, local)
                print(f"{surname}: загружено -> {object_key}")
            except Exception as e:
                print(f"{surname}: ошибка загрузки: {e}")
                continue

            # Обновляем signature_image_url по staff.id (ищем по старту fio)
            staff = next((r for r in staff_rows if str(r["fio"]).startswith(surname)), None)
            if not staff:
                print(f"{surname}: не найден в dogovor_staff")
                continue

            with conn.cursor() as cur2:
                cur2.execute(
                    """
                    update public.dogovor_staff
                    set signature_image_url = %s
                    where id = %s
                    """,
                    (object_key, staff["id"]),
                )
                conn.commit()
                print(f"  {surname}: signature_image_url обновлён")


if __name__ == "__main__":
    # По умолчанию: backend/signatures_to_upload (либо как в вашем репо)
    # - запускайте из backend, чтобы не путаться с путями
    dogovor_root = Path(__file__).resolve().parent.parent.parent.parent
    default_dir = dogovor_root / "signatures_to_upload"

    sig_dir = str(default_dir)
    if len(sys.argv) > 1:
        arg = Path(sys.argv[1])
        sig_dir = str(arg if arg.is_absolute() else (Path.cwd() / arg).resolve())

    upload_signatures(sig_dir)


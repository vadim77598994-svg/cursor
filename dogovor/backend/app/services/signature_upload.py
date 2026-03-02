"""
Загрузка подписей оптометристов в Supabase Storage и обновление dogovor_staff.signature_image_url.

Использование:
  Из корня backend: .venv/bin/python -m app.services.signature_upload [папка_с_подписями]

  Файлы в папке должны называться по фамилии: Карташева.png, Величко.png, Еремина.png,
  Ефремова.png, Ивченко.png, Никитина.png
"""
import os
import sys
from pathlib import Path

# Фамилии оптометристов (первое слово из ФИО в БД)
STAFF_SURNAMES = [
    "Карташева",
    "Величко",
    "Еремина",
    "Ефремова",
    "Ивченко",
    "Никитина",
]
# Имена файлов в Storage — только ASCII (Supabase не принимает кириллицу в ключах)
STAFF_STORAGE_NAMES = [
    "Kartasheva",
    "Velichko",
    "Eremina",
    "Efremova",
    "Ivchenko",
    "Nikitina",
]


def get_public_url(supabase_client, bucket: str, path: str) -> str:
    """Публичный URL файла в Storage (через SDK)."""
    url = supabase_client.storage.from_(bucket).get_public_url(path)
    if isinstance(url, str):
        return url.rstrip("?")
    return getattr(url, "publicUrl", str(url)).rstrip("?")


def upload_signatures(signatures_dir: str) -> None:
    """
    Загружает PNG из signatures_dir в bucket signatures/ и обновляет dogovor_staff.
    Имена файлов: {фамилия}.png (например Карташева.png).
    """
    from app.config import settings
    from app.db import supabase

    bucket = settings.storage_bucket
    path = Path(signatures_dir)
    if not path.is_dir():
        print(f"Папка не найдена: {signatures_dir}")
        sys.exit(1)

    # 1) Загружаем файлы в Storage (путь только ASCII — Supabase не принимает кириллицу)
    for surname, storage_name in zip(STAFF_SURNAMES, STAFF_STORAGE_NAMES):
        fname = f"{surname}.png"
        local = path / fname
        if not local.exists():
            print(f"Пропуск: файл не найден {local}")
            continue
        storage_path = f"signatures/{storage_name}.png"
        try:
            with open(local, "rb") as f:
                data = f.read()
            supabase.storage.from_(bucket).upload(
                storage_path,
                data,
                {"content-type": "image/png", "upsert": "true"},
            )
            url = get_public_url(supabase, bucket, storage_path)
            print(f"  {surname}: загружено -> {url}")
        except Exception as e:
            print(f"  {surname}: ошибка загрузки: {e}")
            continue

    # 2) Получаем id оптометристов по ФИО (начинается с фамилии)
    try:
        r = supabase.table("dogovor_staff").select("id, fio").execute()
        staff_list = r.data or []
    except Exception as e:
        print(f"Ошибка чтения dogovor_staff: {e}")
        sys.exit(1)

    # 3) Обновляем signature_image_url (URL с ASCII-именем файла)
    for surname, storage_name in zip(STAFF_SURNAMES, STAFF_STORAGE_NAMES):
        staff = next((s for s in staff_list if s["fio"].startswith(surname)), None)
        if not staff:
            print(f"  {surname}: не найден в dogovor_staff")
            continue
        storage_path = f"signatures/{storage_name}.png"
        url = get_public_url(supabase, bucket, storage_path)
        try:
            supabase.table("dogovor_staff").update({"signature_image_url": url}).eq(
                "id", staff["id"]
            ).execute()
            print(f"  {surname}: signature_image_url обновлён")
        except Exception as e:
            print(f"  {surname}: ошибка обновления: {e}")


if __name__ == "__main__":
    # Путь к папке dogovor (backend/app/services -> 3 уровня вверх = backend, ещё 1 = dogovor)
    dogovor_root = Path(__file__).resolve().parent.parent.parent.parent
    if len(sys.argv) > 1:
        arg = Path(sys.argv[1])
        sig_dir = (arg if arg.is_absolute() else (Path.cwd() / arg).resolve())
    else:
        sig_dir = dogovor_root / "signatures_to_upload"
    upload_signatures(str(sig_dir))

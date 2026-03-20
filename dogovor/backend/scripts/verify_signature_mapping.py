#!/usr/bin/env python3
"""
Проверка сопоставления «ФИО оптометриста ↔ подпись».

Печатает таблицу: кто в БД (fio) и какой URL подписи ему проставлен.
Откройте каждую ссылку в браузере и убедитесь, что подпись совпадает с ФИО.

Запуск из корня backend:
  .venv/bin/python scripts/verify_signature_mapping.py
"""
import os
import sys

# добавить корень backend в path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.db_postgres import get_staff as get_staff_postgres
from app.storage_minio import get_presigned_url


def main():
    rows = get_staff_postgres()
    # signature_image_url хранит object key в MinIO, преобразуем в URL для просмотра
    for row in rows:
        key = (row.get("signature_image_url") or "").strip()
        row["signature_image_url"] = get_presigned_url(key) if key else ""
    if not rows:
        print("В dogovor_staff нет записей.")
        return
    print("Проверка сопоставления ФИО → подпись\n")
    print("Откройте каждую ссылку в браузере и убедитесь: подпись на картинке совпадает с ФИО в первой колонке.\n")
    for s in rows:
        fio = s.get("fio") or "—"
        url = s.get("signature_image_url") or ""
        # из URL можно увидеть имя файла в Storage (например .../signatures/Karaseva.png)
        file_hint = ""
        if "signatures/" in url:
            file_hint = " → " + url.split("signatures/")[-1].split("?")[0]
        print(f"  {fio}")
        print(f"    URL: {url}{file_hint}")
        print()
    print("Если у кого-то подпись не та (например у Карасевой видна подпись Ивченко):")
    print("  1) Проверьте на компе файлы в signatures_to_upload: имя файла = фамилия (Карасева.png = подпись Карасевой).")
    print("  2) Если файл перепутан — переименуйте/замените содержимое и заново запустите загрузку:")
    print("     .venv/bin/python -m app.services.signature_upload_minio ../signatures_to_upload")


if __name__ == "__main__":
    main()

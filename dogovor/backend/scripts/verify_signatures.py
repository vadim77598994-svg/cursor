#!/usr/bin/env python3
"""
Проверка: подписи загружены в Storage и URL в БД открываются.
Запуск из папки backend: .venv/bin/python scripts/verify_signatures.py
"""
import sys
from pathlib import Path

# Добавляем backend в путь
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

def main():
    from app.config import settings
    from app.db import supabase

    r = supabase.table("dogovor_staff").select("id, fio, signature_image_url").execute()
    rows = r.data or []
    if not rows:
        print("В dogovor_staff нет записей.")
        return

    try:
        import urllib.request
    except ImportError:
        print("Проверка URL пропущена (нет urllib).")
        for row in rows:
            url = (row.get("signature_image_url") or "").strip()
            status = "—" if not url else "URL задан"
            print(f"  {row.get('fio', '')}: {status}")
        return

    ok = 0
    fail = 0
    for row in rows:
        fio = row.get("fio", "")
        url = (row.get("signature_image_url") or "").strip()
        if not url:
            print(f"  {fio}: нет URL")
            fail += 1
            continue
        try:
            req = urllib.request.Request(url, method="GET")
            with urllib.request.urlopen(req, timeout=10) as resp:
                if resp.status == 200:
                    print(f"  {fio}: OK (200)")
                    ok += 1
                else:
                    print(f"  {fio}: HTTP {resp.status}")
                    fail += 1
        except Exception as e:
            print(f"  {fio}: ошибка — {e}")
            fail += 1

    print()
    print(f"Итого: {ok} OK, {fail} с ошибками.")


if __name__ == "__main__":
    main()

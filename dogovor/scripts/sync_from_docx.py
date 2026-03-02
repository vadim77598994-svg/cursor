#!/usr/bin/env python3
"""
Автоматизация: извлечь текст из .docx и сохранить для сравнения с contract.html.
Исходный .docx не меняется. Дальше вручную перенесите нужные правки в contract.html.

Использование:
  python sync_from_docx.py   # читает dogovor/contract_template/ПАЙ_ОПТИКС_МЕД_ДОГ.docx
  python sync_from_docx.py /путь/к/договор.docx
"""
import sys
from pathlib import Path

BASE = Path(__file__).resolve().parent.parent
DOCX_DEFAULT = BASE / "contract_template" / "ПАЙ_ОПТИКС_МЕД_ДОГ.docx"
OUTPUT = BASE / "backend" / "templates" / "contract_extracted.html"


def main():
    docx_path = Path(sys.argv[1]).expanduser() if len(sys.argv) > 1 else DOCX_DEFAULT
    if not docx_path.exists():
        print(f"Файл не найден: {docx_path}")
        print("Укажите путь: python sync_from_docx.py /путь/к/ПАЙ_ОПТИКС_МЕД_ДОГ.docx")
        sys.exit(1)

    # Импорт из того же каталога
    import importlib.util
    spec = importlib.util.spec_from_file_location(
        "docx_to_html", BASE / "scripts" / "docx_to_html.py"
    )
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)

    html = mod.docx_to_html(str(docx_path))
    OUTPUT.write_text(html, encoding="utf-8")
    print(f"Сохранено: {OUTPUT}")
    contract = BASE / "backend" / "templates" / "contract.html"
    print("\nДальше сравните с шаблоном и перенесите нужные правки:")
    print(f"  {OUTPUT.name}")
    print(f"  {contract.name}")
    print("\nПеременные Jinja2 ({{ ... }}) в contract.html не удаляйте — в extracted они могут быть с тегами <u>.</u>")


if __name__ == "__main__":
    main()

#!/bin/bash
# Автоматическое извлечение из .docx и подсказка для сравнения с contract.html
# Использование: ./scripts/sync_from_docx.sh [путь/к/договор.docx]

set -e
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DOCX="${1:-$SCRIPT_DIR/../contract_template/ПАЙ_ОПТИКС_МЕД_ДОГ.docx}"
OUTPUT="$SCRIPT_DIR/../backend/templates/contract_extracted.html"

if [[ ! -f "$DOCX" ]]; then
  echo "Файл не найден: $DOCX"
  echo "Укажите путь: $0 /путь/к/ПАЙ_ОПТИКС_МЕД_ДОГ.docx"
  exit 1
fi

echo "Извлекаю из .docx..."
python3 "$SCRIPT_DIR/docx_to_html.py" "$DOCX" --output "$OUTPUT"
echo "Сохранено: $OUTPUT"
echo ""
echo "Дальше: сравните с шаблоном и перенесите нужные правки:"
echo "  diff $OUTPUT $SCRIPT_DIR/../backend/templates/contract.html"
echo "  или откройте оба файла в редакторе."
echo ""
echo "Переменные Jinja2 ({{ ... }}) в contract.html не трогайте — в extracted они могут быть разбиты тегами."

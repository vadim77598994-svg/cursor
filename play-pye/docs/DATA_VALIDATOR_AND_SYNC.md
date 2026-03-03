# Play Pye — Data Validator и сервис синхронизации

Контент живёт в Notion (квесты, текст) и Miro (визуал уровней). В игре используются только кешированные и провалидированные данные в Supabase. Ошибки в источниках не должны ронять клиент.

---

## 1. Общая схема потока данных

```
┌─────────────┐     ┌─────────────┐     ┌──────────────────┐     ┌─────────────┐
│   Notion    │     │    Miro     │     │  Sync Service     │     │  Supabase   │
│   API       │────▶│   API       │────▶│  (Edge/Cron)      │────▶│  (levels,   │
│             │     │             │     │  Validator        │     │   quests)   │
└─────────────┘     └─────────────┘     └──────────────────┘     └─────────────┘
                           │                        │
                           │                        ▼
                           │             ┌──────────────────┐
                           └────────────▶│  Miro → Level    │
                                         │  Mapper          │
                                         └──────────────────┘
```

- **Sync Service** периодически (cron) или по вебхуку запрашивает Notion и Miro.
- **Data Validator** проверяет сырые и преобразованные данные перед записью в БД.
- **Miro → Level Mapper** переводит frames/shapes в канонический `level_data`.

---

## 2. Data Validator — компоненты

### 2.1 Входы

| Источник | Что приходит | Что проверяем |
|----------|--------------|----------------|
| Notion   | Блоки страницы (paragraphs, headings, lists), DB rows | Непустые поля, валидные ссылки, обязательные поля для квеста |
| Miro     | Frames, shapes, sticky notes (после маппинга — `level_data`) | Проходимость, spawn/exit, размеры платформ, битые asset URL |

### 2.2 Правила валидации

**Notion (квесты):**

- `title` не пустой.
- Нет битых внутренних ссылок (на несуществующие страницы).
- Обязательные поля контента (например, `objectives`, `rewards`) присутствуют и не пустые массивы/строки.

**Level (после Miro → Level Mapper):**

- `spawn` и `exit` в границах уровня и не внутри стены.
- Все платформы с `width/height` >= минимума (например, 16px).
- Проходимость: от spawn до exit существует путь (опционально — граф достижимости или A*).
- Все URL в `assets` возвращают 200 (или проверка по allowlist Supabase Storage).

### 2.3 Выход валидатора

- **valid** — запись в Supabase с `validation_status = 'valid'`, при необходимости `published_at = now()`.
- **invalid** — запись с `validation_status = 'invalid'`, `validation_errors = [{ "field", "message" }]`. Клиент такие уровни не отдаёт.
- **pending** — до первой проверки или при временной ошибке (rate limit) — не публиковать.

---

## 3. Сервис синхронизации

### 3.1 Размещение

- **Supabase Edge Functions** (или отдельный cron-сервис): одна функция `sync-notion`, одна `sync-miro`, одна `validate-and-publish`.
- Альтернатива: Vercel Cron + API routes в Next.js, которые вызывают Supabase с service role.

### 3.2 Алгоритм (высокоуровнево)

1. **Notion sync**
   - Получить список страниц из нужной DB (filter by tag/type «quest»).
   - Для каждой страницы: получить блоки, извлечь title, description, objectives, rewards.
   - Валидатор проверяет каждую запись.
   - Upsert в `quests` с `validation_status` и `validation_errors`.
   - Логировать в `sync_log` (source: notion, action: fetch/upsert, status).

2. **Miro sync**
   - Получить элементы доски (frames, shapes).
   - **Mapper:** преобразовать в канонический `level_data` (платформы, spawn, exit, triggers).
   - Валидатор проверяет `level_data` (геометрия, проходимость, assets).
   - Upsert в `levels` с `validation_status` и `validation_errors`.
   - Логировать в `sync_log` (source: miro, action: fetch/transform/upsert).

3. **Частота и лимиты (Free Tier)**

   - Notion: лимит запросов в минуту — батчить запросы, кешировать в Supabase на 1–24 часа.
   - Miro: аналогично; тяжёлые доски не опрашивать чаще раза в час.
   - Хранить в `sync_log` только последние N записей или по TTL, чтобы не раздувать хранилище.

### 3.3 Защита от дублирования

- Уникальные ключи: `levels.slug`, `quests.slug` (или `notion_page_id` / `miro_board_id` + id элемента).
- Upsert по `slug` (или по внешнему id), чтобы один и тот же уровень/квест не создавал дубликатов при повторном запуске синка.

---

## 4. Клиентская часть

- Игра и UI запрашивают только Supabase: таблицы `levels` и `quests` с условием `validation_status = 'valid'` и `published_at is not null` (для уровней).
- При пустом ответе или 404 — показывать «Уровень временно недоступен» / заглушку, без падения приложения.
- Опционально: лёгкая проверка формата `level_data` на клиенте (наличие `spawn`, `platforms`) перед передачей в Phaser, с fallback на дефолтный уровень при ошибке.

---

## 5. Краткий чек-лист

- [ ] Edge Functions или API routes для sync (Notion, Miro).
- [ ] Mapper Miro → `level_data` с конфигурируемыми правилами (какой frame = spawn, какой = платформа).
- [ ] Валидатор: пустые блоки, битые ссылки, геометрия уровня, проходимость.
- [ ] Запись в `levels`/`quests` только с `validation_status` и `validation_errors`.
- [ ] `sync_log` для отладки и контроля лимитов.
- [ ] Клиент читает только валидные и опубликованные данные; ошибки данных не роняют игру.

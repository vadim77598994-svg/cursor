# Play Pye

Автономная веб-игра (платформер/квест) с Notion и Miro в роли Headless CMS. Next.js SPA, Supabase (Auth, DB, Storage), свободный выбор уровней на карте мира и сохранение прогресса.

## Стек

- **Frontend:** Next.js (App Router), React, Phaser.js (геймплей), Framer Motion (UI)
- **Контент:** Notion API (квесты, текст), Miro API (визуал уровней)
- **Backend:** Supabase (Auth, PostgreSQL, Storage)
- **Стиль:** Modern Game UI — пиксель-арт, градиенты, палитра: синий, изумруд, золото

## Структура проекта

```
play-pye/
├── docs/
│   ├── DATABASE_SCHEMA.md    # Схема БД и RLS
│   ├── DATA_VALIDATOR_AND_SYNC.md  # Валидатор и синхронизация Notion/Miro
│   └── STEP_BY_STEP.md      # Пошаговый план реализации
├── supabase/
│   └── schema.sql           # Миграции Supabase
├── EXPERT_REVIEW.md         # Экспертная оценка и 3 правки архитектуры
└── README.md
```

## Стратегия реализации

**Сначала игра, потом подключение.** Сначала делаем играбельный платформер с уровнями из статики (JSON) и прогрессом в localStorage; все данные — в каноническом формате (`level_data`, квесты). Затем подключаем Supabase, Notion и Miro без смены контракта данных.

## Ключевые решения (Expert Review)

1. **Один игровой движок:** Phaser.js — весь геймплей; Framer Motion — только меню, HUD, тизеры уровней.
2. **Гостевой режим:** Игра без регистрации; прогресс в localStorage/сессии; при входе — привязка прогресса к аккаунту.
3. **Miro → Level:** Не сырые данные Miro, а маппинг в канонический `level_data` + валидация геометрии и проходимости.

## Быстрый старт

- **Часть A (игра сначала):** достаточно Next.js и статики в `data/levels/`; прогресс в localStorage. Env для Supabase не обязателен.
- **Часть B (подключение):** скопировать `.env.example` в `.env.local`, заполнить ключи Supabase, Notion, Miro; применить `supabase/schema.sql`; затем заменить источники данных в коде на API/БД.

## Документация

- **Архитектура и БД:** `docs/DATABASE_SCHEMA.md`
- **Валидация и синк:** `docs/DATA_VALIDATOR_AND_SYNC.md`
- **План работ:** `docs/STEP_BY_STEP.md`
- **Правки и обоснования:** `EXPERT_REVIEW.md`

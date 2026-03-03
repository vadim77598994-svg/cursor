# Play Pye — Финальная схема базы данных (Supabase)

Источники контента: Notion (квесты, текст), Miro (визуал). Кеш и игровые данные — в Supabase. Учтены гостевой режим и отложенная привязка прогресса.

---

## 1. Таблицы

### 1.1 `profiles` — профиль игрока (связь с Supabase Auth)

```sql
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text,
  avatar_url text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.profiles enable row level security;

create policy "Profiles read" on public.profiles for select using (true);
create policy "Profiles insert own" on public.profiles for insert with check (auth.uid() = id);
create policy "Profiles update own" on public.profiles for update using (auth.uid() = id);
```

---

### 1.2 `game_sessions` — анонимные/гостевые сессии (для отложенной привязки)

```sql
create table public.game_sessions (
  id uuid primary key default gen_random_uuid(),
  session_token text unique not null,  -- хранится в localStorage до регистрации
  user_id uuid references public.profiles(id) on delete set null,  -- null = гость
  created_at timestamptz default now(),
  last_active_at timestamptz default now()
);

create index idx_game_sessions_user_id on public.game_sessions(user_id);
create index idx_game_sessions_session_token on public.game_sessions(session_token);

alter table public.game_sessions enable row level security;

create policy "Sessions read own" on public.game_sessions for select
  using (auth.uid() = user_id or user_id is null);
create policy "Sessions insert" on public.game_sessions for insert with check (true);
create policy "Sessions update own" on public.game_sessions for update
  using (auth.uid() = user_id or user_id is null);
```

---

### 1.3 `player_progress` — прогресс по уровням и квестам

```sql
create table public.player_progress (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.game_sessions(id) on delete cascade,
  level_slug text not null,
  stars int default 0 check (stars >= 0 and stars <= 3),
  completed_at timestamptz,
  best_time_ms int,
  payload jsonb default '{}',  -- доп. данные (собранные предметы, флаги квестов)
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(session_id, level_slug)
);

create index idx_player_progress_session on public.player_progress(session_id);
create index idx_player_progress_level on public.player_progress(level_slug);

alter table public.player_progress enable row level security;

create policy "Progress read own session" on public.player_progress for select
  using (session_id in (select id from public.game_sessions where user_id = auth.uid() or user_id is null));
create policy "Progress insert" on public.player_progress for insert with check (true);
create policy "Progress update own" on public.player_progress for update
  using (session_id in (select id from public.game_sessions where user_id = auth.uid() or user_id is null));
```

---

### 1.4 `levels` — кеш уровней (результат маппинга Notion + Miro → канонический JSON)

```sql
create table public.levels (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name text not null,
  description text,
  notion_page_id text,
  miro_board_id text,
  level_data jsonb not null,  -- каноническая модель: platforms, spawn, triggers, assets
  validation_status text default 'pending',  -- pending | valid | invalid
  validation_errors jsonb default '[]',
  published_at timestamptz,
  sort_order int default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index idx_levels_slug on public.levels(slug);
create index idx_levels_validation on public.levels(validation_status);
create index idx_levels_published on public.levels(published_at) where published_at is not null;

alter table public.levels enable row level security;

create policy "Levels read published" on public.levels for select
  using (validation_status = 'valid' and published_at is not null);
-- Запись только через service role / Edge Function (синхронизация)
```

---

### 1.5 `quests` — кеш квестов из Notion

```sql
create table public.quests (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  notion_page_id text,
  title text not null,
  description text,
  quest_data jsonb not null,  -- цели, награды, условия
  validation_status text default 'pending',
  validation_errors jsonb default '[]',
  level_slug text references public.levels(slug),
  sort_order int default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index idx_quests_slug on public.quests(slug);
create index idx_quests_level on public.quests(level_slug);

alter table public.quests enable row level security;

create policy "Quests read valid" on public.quests for select
  using (validation_status = 'valid');
```

---

### 1.6 `sync_log` — лог синхронизации Notion/Miro → Supabase (для отладки и лимитов)

```sql
create table public.sync_log (
  id uuid primary key default gen_random_uuid(),
  source text not null,  -- 'notion' | 'miro'
  resource_id text,
  action text not null,  -- 'fetch' | 'transform' | 'upsert' | 'validate'
  status text not null,  -- 'ok' | 'error' | 'rate_limited'
  details jsonb default '{}',
  created_at timestamptz default now()
);

create index idx_sync_log_created on public.sync_log(created_at desc);
create index idx_sync_log_source on public.sync_log(source);

alter table public.sync_log enable row level security;

-- Только сервис/админ пишет и читает
create policy "Sync log service only" on public.sync_log for all using (false);
-- Реализуется через service_role на бэкенде
```

---

## 2. Каноническая модель `level_data` (JSON Schema, концепт)

Используется в `levels.level_data` после маппинга Miro → Level.

```json
{
  "version": 1,
  "spawn": { "x": 0, "y": 0 },
  "exit": { "x": 320, "y": 100 },
  "platforms": [
    { "id": "p1", "x": 0, "y": 200, "width": 160, "height": 16, "type": "solid" }
  ],
  "triggers": [
    { "id": "t1", "x": 100, "y": 180, "width": 32, "height": 32, "kind": "quest", "payload": { "quest_slug": "first-gem" } }
  ],
  "assets": {
    "tileset_url": "https://...",
    "background_url": "https://..."
  }
}
```

---

## 3. Миграция прогресса гостя → пользователь

При первом входе/регистрации:

1. По `session_token` из localStorage найти `game_sessions` (где `user_id` is null).
2. Обновить `game_sessions.user_id = auth.uid()`.
3. Если для этого `user_id` уже есть записи в `player_progress` (из другой сессии), выполнить merge: для каждого `level_slug` оставить запись с большим `stars` или более ранним `completed_at` по политике продукта.

---

## 4. RLS и Free Tier

- Чтение уровней/квестов — только валидные и опубликованные.
- Запись в `levels`, `quests`, `sync_log` — только через service role (cron/Edge Functions).
- Профили и прогресс — по `auth.uid()` и привязке сессии, чтобы уложиться в лимиты и не открывать лишнее.

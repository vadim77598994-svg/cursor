-- Play Pye — Supabase schema
-- Run in Supabase SQL Editor or via migration tool.

-- 1. Profiles (extends auth.users)
create table if not exists public.profiles (
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

-- 2. Game sessions (guest + linked user)
create table if not exists public.game_sessions (
  id uuid primary key default gen_random_uuid(),
  session_token text unique not null,
  user_id uuid references public.profiles(id) on delete set null,
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

-- 3. Player progress
create table if not exists public.player_progress (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.game_sessions(id) on delete cascade,
  level_slug text not null,
  stars int default 0 check (stars >= 0 and stars <= 3),
  completed_at timestamptz,
  best_time_ms int,
  payload jsonb default '{}',
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

-- 4. Levels (cached from Notion + Miro)
create table if not exists public.levels (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name text not null,
  description text,
  notion_page_id text,
  miro_board_id text,
  level_data jsonb not null,
  validation_status text default 'pending',
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

-- 5. Quests (cached from Notion)
create table if not exists public.quests (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  notion_page_id text,
  title text not null,
  description text,
  quest_data jsonb not null,
  validation_status text default 'pending',
  validation_errors jsonb default '[]',
  level_slug text,
  sort_order int default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index idx_quests_slug on public.quests(slug);
create index idx_quests_level on public.quests(level_slug);

alter table public.quests enable row level security;

create policy "Quests read valid" on public.quests for select
  using (validation_status = 'valid');

-- 6. Sync log (service role only in app)
create table if not exists public.sync_log (
  id uuid primary key default gen_random_uuid(),
  source text not null,
  resource_id text,
  action text not null,
  status text not null,
  details jsonb default '{}',
  created_at timestamptz default now()
);

create index idx_sync_log_created on public.sync_log(created_at desc);
create index idx_sync_log_source on public.sync_log(source);

alter table public.sync_log enable row level security;
-- No public policies; use service_role for sync jobs.

-- Trigger: create profile on signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, username)
  values (new.id, new.raw_user_meta_data->>'username');
  return new;
end;
$$ language plpgsql security definer;

create or replace trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

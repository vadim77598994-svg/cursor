-- Шаг 1: выполни этот файл в Supabase → SQL Editor (New query → вставь → Run)
-- Каталог предметов коллекции (физические очки → будущий NFT). Фото = визуал для NFT.
create table if not exists public.collection_items (
  id uuid primary key default gen_random_uuid(),
  slug text unique,
  name text not null,
  description text,
  image_url text not null,
  rarity text,
  lenses text,
  frame text,
  material text,
  attributes jsonb default '[]',
  sort_order int default 0,
  status text default 'draft',
  token_id text,
  chain_id int,
  contract_address text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.collection_items enable row level security;
create policy "Collection items read" on public.collection_items for select using (true);

-- Индекс для сортировки и фильтров
create index if not exists idx_collection_items_sort on public.collection_items (sort_order);
create index if not exists idx_collection_items_rarity on public.collection_items (rarity);
create index if not exists idx_collection_items_frame on public.collection_items (frame);

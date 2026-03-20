-- Schema "договор" для Postgres (вариант б): без Supabase (без RLS).

create extension if not exists pgcrypto;

-- Локации (кабинеты)
create table if not exists public.dogovor_locations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  address text not null,
  city text not null,
  contract_prefix text not null,
  sort_order int default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Оптометристы
create table if not exists public.dogovor_staff (
  id uuid primary key default gen_random_uuid(),
  fio text not null,
  city text not null,
  signature_image_url text,
  sort_order int default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Счётчик номеров договоров
create sequence if not exists public.dogovor_contract_seq start 1;

-- Функция номера договора: PREFIX-YYYY-NNNNN
create or replace function public.get_next_contract_number(loc_prefix text)
returns text as $$
  select loc_prefix || '-' || to_char(now(), 'YYYY') || '-' ||
         lpad(nextval('public.dogovor_contract_seq')::text, 5, '0');
$$ language sql;

-- Контракты (метаданные)
create table if not exists public.dogovor_contracts (
  id uuid primary key default gen_random_uuid(),
  contract_number text not null unique,
  location_id uuid references public.dogovor_locations(id),
  staff_id uuid references public.dogovor_staff(id),
  patient_fio text,
  signed_at timestamptz default now(),
  pdf_path text,
  device_uuid text,
  created_at timestamptz default now()
);

-- Seed данных (тестовые, как в вашем Supabase-скрипте)
insert into public.dogovor_locations (name, address, city, contract_prefix, sort_order)
values
  ('Потаповский пер., 8/12 стр. 6', 'Москва, Потаповский пер., 8/12 строение 6', 'Москва', 'M08', 1),
  ('Рубинштейна, 10', 'Санкт-Петербург, ул. Рубинштейна, 10', 'Санкт-Петербург', 'R10', 2),
  ('Бармалеева, 1', 'Санкт-Петербург, ул. Бармалеева, 1', 'Санкт-Петербург', 'B01', 3);

insert into public.dogovor_staff (fio, city, sort_order)
values
  ('Карташева Татьяна Владиславовна', 'Санкт-Петербург', 1),
  ('Величко Ирина Владимировна', 'Санкт-Петербург', 2),
  ('Еремина Анжелика Юрьевна', 'Санкт-Петербург', 3),
  ('Ефремова Светлана Павловна', 'Санкт-Петербург', 4),
  ('Ивченко Виолетта Евгеньевна', 'Москва', 5),
  ('Никитина Елена Михайловна', 'Москва', 6),
  ('Коваленко Николай Валентинович', 'Санкт-Петербург', 7),
  ('Карасева Виктория Викторовна', 'Москва', 8);


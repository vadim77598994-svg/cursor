-- Схема для модуля "Договор" (сканирование паспорта, подписание).
-- Выполнить в Supabase → SQL Editor (отдельный проект или тот же, что web/ — таблицы с префиксом или в схеме).

-- Локации (кабинеты проверки зрения): адрес, город, префикс номера договора
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

-- Оптометристы по городам; подпись для автоподстановки в договор (загрузить позже)
create table if not exists public.dogovor_staff (
  id uuid primary key default gen_random_uuid(),
  fio text not null,
  city text not null,
  signature_image_url text,
  sort_order int default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Единый счётчик номеров договоров (формат: PREFIX-YYYY-NNNNN)
create sequence if not exists public.dogovor_contract_seq start 1;

-- Функция для получения следующего номера договора (вызов из бэкенда через RPC)
create or replace function get_next_contract_number(loc_prefix text)
returns text as $$
  select loc_prefix || '-' || to_char(now(), 'YYYY') || '-' || lpad(nextval('public.dogovor_contract_seq')::text, 5, '0');
$$ language sql security definer;

-- Метаданные подписанных договоров (ссылка на PDF в Storage, оптометрист, устройство)
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

alter table public.dogovor_locations enable row level security;
alter table public.dogovor_staff enable row level security;
alter table public.dogovor_contracts enable row level security;

create policy "dogovor_locations read" on public.dogovor_locations for select using (true);
create policy "dogovor_staff read" on public.dogovor_staff for select using (true);
create policy "dogovor_contracts read" on public.dogovor_contracts for select using (true);
create policy "dogovor_contracts insert" on public.dogovor_contracts for insert with check (true);

-- Кабинеты проверки зрения
insert into public.dogovor_locations (name, address, city, contract_prefix, sort_order) values
  ('Потаповский пер., 8/12 стр. 6', 'Москва, Потаповский пер., 8/12 строение 6', 'Москва', 'M08', 1),
  ('Рубинштейна, 10', 'Санкт-Петербург, ул. Рубинштейна, 10', 'Санкт-Петербург', 'R10', 2),
  ('Бармалеева, 1', 'Санкт-Петербург, ул. Бармалеева, 1', 'Санкт-Петербург', 'B01', 3);

-- Оптометристы (signature_image_url — отсканированные подписи для автоподстановки, загрузить позже)
insert into public.dogovor_staff (fio, city, sort_order) values
  ('Карташева Татьяна Владиславовна', 'Санкт-Петербург', 1),
  ('Величко Ирина Владимировна', 'Санкт-Петербург', 2),
  ('Еремина Анжелика Юрьевна', 'Санкт-Петербург', 3),
  ('Ефремова Светлана Павловна', 'Санкт-Петербург', 4),
  ('Ивченко Виолетта Евгеньевна', 'Москва', 5),
  ('Никитина Елена Михайловна', 'Москва', 6);

-- Добавление двух новых оптометристов (для БД, где уже выполнена 001_contracts_schema.sql).
-- Выполнить в Supabase → SQL Editor один раз, если в dogovor_staff пока только 6 записей.
insert into public.dogovor_staff (fio, city, sort_order)
select 'Коваленко Николай Валентинович', 'Санкт-Петербург', 7
where not exists (select 1 from public.dogovor_staff where fio = 'Коваленко Николай Валентинович');
insert into public.dogovor_staff (fio, city, sort_order)
select 'Карасева Виктория Викторовна', 'Москва', 8
where not exists (select 1 from public.dogovor_staff where fio = 'Карасева Виктория Викторовна');

-- Проверка схемы модуля "Договор" в Supabase.
-- ВАЖНО: в SQL Editor вставляй этот весь текст (запросы ниже), а не путь к файлу.

-- 1) Таблицы должны существовать
select table_name
from information_schema.tables
where table_schema = 'public'
  and table_name in ('dogovor_locations', 'dogovor_staff', 'dogovor_contracts')
order by table_name;

-- 2) Функция номера договора
select routine_name
from information_schema.routines
where routine_schema = 'public'
  and routine_name = 'get_next_contract_number';

-- 3) Последовательность счётчика
select sequence_name
from information_schema.sequences
where sequence_schema = 'public'
  and sequence_name = 'dogovor_contract_seq';

-- 4) Политики RLS для вставки в dogovor_contracts
select policyname from pg_policies
where tablename = 'dogovor_contracts' and cmd = 'INSERT';

-- 5) Последние 5 договоров (если есть)
select id, contract_number, patient_fio, pdf_path, created_at
from public.dogovor_contracts
order by created_at desc
limit 5;

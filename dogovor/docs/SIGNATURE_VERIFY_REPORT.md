# Проверка: ФИО ↔ подпись

Ниже — актуальная привязка из БД (таблица `dogovor_staff`). Открой каждую ссылку в браузере и убедись: **на картинке подпись того человека, чьё ФИО в первой колонке**.

---

## Текущая привязка (по данным БД)

| № | ФИО | Файл в Storage | Ссылка на подпись |
|---|-----|----------------|-------------------|
| 1 | Карташева Татьяна Владиславовна | Kartasheva.png | https://sojsihvhpvmzzdmqgpri.supabase.co/storage/v1/object/public/contracts/signatures/Kartasheva.png |
| 2 | Величко Ирина Владимировна | Velichko.png | https://sojsihvhpvmzzdmqgpri.supabase.co/storage/v1/object/public/contracts/signatures/Velichko.png |
| 3 | Еремина Анжелика Юрьевна | Eremina.png | https://sojsihvhpvmzzdmqgpri.supabase.co/storage/v1/object/public/contracts/signatures/Eremina.png |
| 4 | Ефремова Светлана Павловна | Efremova.png | https://sojsihvhpvmzzdmqgpri.supabase.co/storage/v1/object/public/contracts/signatures/Efremova.png |
| 5 | Ивченко Виолетта Евгеньевна | Ivchenko.png | https://sojsihvhpvmzzdmqgpri.supabase.co/storage/v1/object/public/contracts/signatures/Ivchenko.png |
| 6 | Никитина Елена Михайловна | Nikitina.png | https://sojsihvhpvmzzdmqgpri.supabase.co/storage/v1/object/public/contracts/signatures/Nikitina.png |
| 7 | Коваленко Николай Валентинович | Kovalenko.png | https://sojsihvhpvmzzdmqgpri.supabase.co/storage/v1/object/public/contracts/signatures/Kovalenko.png |
| 8 | Карасева Виктория Викторовна | Karaseva.png | https://sojsihvhpvmzzdmqgpri.supabase.co/storage/v1/object/public/contracts/signatures/Karaseva.png |

---

## Как проверить

1. Открой по очереди ссылки из таблицы (где они есть).
2. На каждой картинке должна быть подпись **именно этого** человека (Карташева — подпись Карташевой, Ивченко — Ивченко и т.д.).
3. Если у кого-то подпись не та (например у Карасевой открылась подпись Ивченко):
   - **На компе:** в папке `signatures_to_upload/` проверь, что в файле с именем по фамилии лежит подпись этого человека (в `Карасева.png` — подпись Карасевой).
   - Исправь файлы при необходимости и заново запусти загрузку (команда ниже).

---

## Повторная загрузка подписей

Если обновил файлы в `signatures_to_upload/`, заново загрузи их в Storage и обнови БД:

```bash
cd dogovor/backend
.venv/bin/python -m app.services.signature_upload ../signatures_to_upload
```

---

*Отчёт сформирован по данным из Supabase (таблица dogovor_staff).*

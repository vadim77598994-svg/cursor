# Какой Supabase-проект использовать

В списке проектов видны **названия** («nft», «vadim77598994-svg's Project»). В `.env.local` записан **URL проекта** — в нём есть ref, например `ypzumyyycdzrwxqldpth`.

## Узнать, какой проект уже в .env.local

1. Открой проект **«nft»** (клик по карточке).
2. Слева **Settings** (шестерёнка) → **API**.
3. В блоке **Project URL** будет ссылка вида `https://XXXX.supabase.co`. Запомни **XXXX**.
4. Если **XXXX = ypzumyyycdzrwxqldpth** — это тот же проект, что и в `.env.local`. Создавай bucket `glasses` и ключи бери **в этом проекте**.
5. Если нет — открой второй проект («vadim77598994-svg's Project») и повтори шаги 2–3. Один из двух проектов должен совпасть с ref из `.env.local`.

---

## Подключить другой проект (например «nft»)

Если хочешь, чтобы приложение работало с проектом **«nft»** (или другим):

1. В Dashboard открой нужный проект → **Settings** → **API**.
2. Скопируй:
   - **Project URL**
   - **anon public** (ключ)
   - **service_role** (ключ, для админки)
3. Открой `web/.env.local` и замени значения:
   ```env
   NEXT_PUBLIC_SUPABASE_URL=сюда_Project_URL
   NEXT_PUBLIC_SUPABASE_ANON_KEY=сюда_anon_key
   SUPABASE_SERVICE_ROLE_KEY=сюда_service_role_key
   ```
4. В **этом** проекте нужно один раз выполнить SQL (таблица `collection_items`):  
   **SQL Editor** → New query → вставь содержимое файла `supabase/schema.sql` из корня репозитория → Run.
5. В **этом** же проекте создай bucket **glasses** (Public), как в `STORAGE_SETUP.md`.

После этого приложение будет использовать выбранный проект.

# NFT Glasses — фронт (Фаза 0)

Next.js 15, TypeScript, Tailwind, Supabase.

## Быстрый старт

1. Установка зависимостей:
   ```bash
   cd web && npm install
   ```

2. Supabase: создай проект на [supabase.com](https://supabase.com), выполни SQL из `../supabase/schema.sql` в SQL Editor.

3. Переменные окружения: скопируй `.env.example` в `.env.local`, подставь:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`

4. Запуск:
   ```bash
   npm run dev
   ```
   Открой [http://localhost:3000](http://localhost:3000).

Полный пошаговый план — в корне репо: `STEP_BY_STEP.md`.

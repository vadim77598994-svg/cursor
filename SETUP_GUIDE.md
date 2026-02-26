# Пошаговый гайд по настройке среды

> Web3 NFT Glasses — подготовка окружения с нуля.

---

## Предварительные требования

- Node.js 18+
- npm или pnpm
- Аккаунты: GitHub, Thirdweb, Supabase, Vercel (или Netlify)
- Кошелёк (MetaMask или другой) для тестов

---

## Шаг 1: Репозиторий и локальный проект

```bash
mkdir nft-glasses-app && cd nft-glasses-app
git init
```

Создайте репозиторий на GitHub и привяжите remote:

```bash
git remote add origin https://github.com/YOUR_ORG/nft-glasses-app.git
```

Инициализация фронта (React + Vite или Next.js):

```bash
# Вариант Next.js (рекомендуется для Thirdweb)
npx create-next-app@latest . --typescript --tailwind --eslint --app

# Или Vite + React
# npm create vite@latest . -- --template react-ts
```

---

## Шаг 2: Thirdweb

1. Зайдите на [thirdweb.com](https://thirdweb.com) → Dashboard.
2. Создайте проект (или используйте существующий).
3. **Contract:** Deploy → NFT Collection → выберите ERC-721 (или ERC-1155). Укажите имя, символ, royalty. Деплой в тестовую сеть (например, Base Sepolia, Polygon Amoy).
4. Сохраните **Contract Address** и **Chain ID** — понадобятся во фронте.
5. В настройках проекта скопируйте **Client ID** (для Connect Wallet).
6. Установите SDK во фронт:

```bash
npm install @thirdweb-dev/react @thirdweb-dev/sdk
```

Создайте `.env.local`:

```env
NEXT_PUBLIC_THIRDWEB_CLIENT_ID=ваш_client_id
NEXT_PUBLIC_CHAIN_ID=84532
NEXT_PUBLIC_NFT_CONTRACT_ADDRESS=0x...
```

---

## Шаг 3: Supabase

1. [supabase.com](https://supabase.com) → New Project → выберите организацию и регион.
2. Сохраните **Project URL** и **anon public** key (Settings → API).
3. В SQL Editor выполните схему из `TECH_SPEC.md` (таблицы `profiles`, `nft_metadata`, `transaction_log`, RLS).
4. Storage: создайте bucket `avatars` (public при необходимости).
5. Установите клиент:

```bash
npm install @supabase/supabase-js
```

Добавьте в `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=ваш_anon_key
```

Создайте утилиту инициализации (например `src/lib/supabase.ts`):

```ts
import { createClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
export const supabase = createClient(url, key);
```

---

## Шаг 4: Структура папок (рекомендуемая)

```
src/
  app/           # Next.js App Router (или pages/)
  components/
    mint/
    gallery/
    profile/
    wallet/
  lib/
    supabase.ts
    thirdweb.ts
  hooks/
  types/
contracts/       # опционально: Solidity + скрипты деплоя
```

---

## Шаг 5: Обёртка Thirdweb Provider

В корне приложения (например `app/layout.tsx` или `_app.tsx`) оберните приложение в провайдер:

```tsx
import { ThirdwebProvider } from "@thirdweb-dev/react";

export default function RootLayout({ children }) {
  return (
    <ThirdwebProvider
      activeChain="base-sepolia"
      clientId={process.env.NEXT_PUBLIC_THIRDWEB_CLIENT_ID}
    >
      {children}
    </ThirdwebProvider>
  );
}
```

Цепь и контракт лучше выносить в константы (env).

---

## Шаг 6: Проверка

- Запуск: `npm run dev`. Откройте приложение, нажмите Connect Wallet — должно открыться окно подключения.
- Проверка Supabase: в коде выполните `supabase.from('profiles').select('*').limit(1)` — без ошибок и с корректными RLS.

---

## Шаг 7: Деплой фронта (Vercel)

1. Подключите репозиторий к Vercel.
2. Укажите Root Directory (если монорепо), Build Command: `npm run build`, Output: Next.js.
3. Добавьте Environment Variables из `.env.local` (без префикса `NEXT_PUBLIC_` только те, что нужны на сервере).
4. Деплой по коммиту в `main`.

Контракты продолжаете деплоить и обновлять через Thirdweb Dashboard; адрес контракта храните в переменных окружения прод-окружения.

---

*После выполнения гайда вы готовы к реализации модулей по TECH_SPEC.md.*

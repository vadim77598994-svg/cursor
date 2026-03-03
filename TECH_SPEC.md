# Web3 NFT Glasses Collection — Техническая спецификация

> Футуристичная NFT-коллекция очков: Thirdweb + Supabase + современный Web-интерфейс.

---

## 0. Концепция: физический объект ↔ цифровой дух (NFT)

**Цель:** связать физическую пару очков с цифровым духом (NFT) с возможностью передарить цифровую часть без передачи физического объекта.

- **Фото очков** — у тебя уже есть; они становятся **визуалом для NFT** (изображение в метаданных = фото реальной пары). Одна пара очков = один будущий NFT (связь 1:1).
- **Реализация по фазам:**
  - **Фаза 0 (текущая):** без подключения кошелька и без минта. Показываем каталог коллекции: фото очков + метаданные (редкость, линзы, оправа). Заложена возможность «передарить» (пока как UI/концепт или заглушка «скоро»). Архитектура и данные готовы к добавлению кошелька и минта позже.
  - **Фаза 1 (позже):** подключаем кошелёк (Thirdweb), минт NFT по выбранному предмету из каталога; после минта — реальный трансфер/передарок через блокчейн.

**Источник правды для визуала и атрибутов:** каталог в Supabase (таблица `collection_items`), где каждая запись = одна пара очков: фото (URL), имя, описание, атрибуты. Позже при минте этот же образ и атрибуты уходят в метаданные NFT (IPFS/Thirdweb), в контракт записывается `tokenId` и привязка к этой записи.

**Референс сайта:** если фронтенд будет в виде сайта, заказчик предоставит референсный сайт для визуала/UX — заложить в дизайн галереи и общий стиль (см. также STEP_BY_STEP, шаг 3).

**Официальный лендинг коллекции:** [PYE × Hello Kitty](https://pyeoptics.com/hellokitty/) — там товар и заказ; наш сайт — цифровой дух (каталог, минт, передарить). Ссылка на лендинг вынесена в `web/src/lib/constants.ts` (COLLECTION_LANDING_URL).

---

## 1. Tech Stack Detail

| Слой | Технология | Назначение |
|------|------------|------------|
| **Smart Contracts** | Thirdweb (Solidity) | ERC-721/1155, минт, метаданные |
| **Auth & DB** | Supabase | Auth (optional social), PostgreSQL, RLS |
| **Storage** | Supabase Storage + IPFS (Thirdweb) | Изображения NFT, метаданные оффчейн |
| **Frontend** | React + Thirdweb React SDK | Connect Wallet, минт, галерея, профиль |
| **Version Control** | GitHub | Код, CI/CD, ревью |
| **Deploy** | Vercel/Netlify + Thirdweb Dashboard | Фронт + контракты |

---

## 2. Архитектура Smart Contract (Thirdweb)

### Выбор стандарта: ERC-721 vs ERC-1155

- **ERC-721** — один токен = один уникальный предмет (одна пара очков). Идеально для **уникальных дизайнов**, генерируемых или кураторских.
- **ERC-1155** — один tokenId может иметь несколько копий (editions). Идеально, если одна модель очков продаётся тиражом (например, 100 копий «Solar Frame #7»).

**Рекомендация:** ERC-721 для максимальной уникальности и простоты UX; ERC-1155 — если планируются лимитированные серии с несколькими копиями одной модели.

### Метаданные NFT (Metadata)

Структура, совместимая с OpenSea/Thirdweb и вашим бэкендом:

```json
{
  "name": "Neon Aviator #42",
  "description": "Limited edition futuristic glasses from the collection.",
  "image": "ipfs://Qm...",
  "animation_url": "https://...",
  "attributes": [
    { "trait_type": "Rarity", "value": "Legendary" },
    { "trait_type": "Lenses", "value": "Polarized Blue" },
    { "trait_type": "Frame", "value": "Titanium Aviator" },
    { "trait_type": "Collection", "value": "Genesis 2025" }
  ]
}
```

### Атрибуты (трайты) для NFT-очков

| Атрибут | Описание | Примеры значений |
|---------|----------|-------------------|
| **Rarity** | Редкость | Common, Uncommon, Rare, Epic, Legendary |
| **Lenses** | Тип линз | Clear, Polarized Blue, Mirror Gold, Gradient, Photochromic |
| **Frame** | Оправа | Aviator, Round, Cat-Eye, Sport, Geometric |
| **Material** (опционально) | Материал оправы | Titanium, Acetate, Metal, Carbon |
| **Collection** | Серия | Genesis 2025, Limited Drop, Collab |

### Структура контракта через Thirdweb

- **Core:** `ERC721Base` или `ERC1155Base` (Thirdweb pre-built).
- **Модули:** `Mintable`, `BatchMetadata` (если нужна пакетная загрузка метаданных).
- **Роли:** `minter` (минт), `admin` (настройки), при необходимости `transfer`-ограничения.
- **Метаданные:** хранятся оффчейн (IPFS через Thirdweb Storage или Supabase → URI в контракте). Контракт хранит только `baseURI` или `tokenURI(tokenId)`.

---

## 3. Backend & State (Supabase)

### Назначение Supabase в проекте

- **Профили пользователей:** привязка `wallet_address` к никнейму, аватарке, настройкам (не заменяет кошелёк как источник правды для владения NFT).
- **Кэш/зеркало метаданных:** копия метаданных NFT для быстрых запросов и фильтров (редкость, линзы, оправа) без чтения контракта каждый раз.
- **Логирование транзакций:** минты, трансферы (события можно дублировать из блокчейна в таблицы для аналитики и истории в приложении).

### Схема БД (основные таблицы)

```sql
-- Каталог предметов коллекции (физические очки → будущий NFT). Фото = визуал для NFT.
-- Фаза 0: заполняем и показываем без минта; Фаза 1: при минте заполняем token_id, chain_id, contract_address.
create table public.collection_items (
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
  status text default 'draft', -- draft | ready | minted
  token_id text,
  chain_id int,
  contract_address text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Профили (связь с Auth или только по wallet)
create table public.profiles (
  id uuid primary key default gen_random_uuid(),
  wallet_address text unique not null,
  username text,
  avatar_url text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Кэш метаданных NFT (синхронизация с контрактом/IPFS)
create table public.nft_metadata (
  id uuid primary key default gen_random_uuid(),
  chain_id int not null,
  contract_address text not null,
  token_id text not null,
  name text,
  description text,
  image_url text,
  rarity text,
  lenses text,
  frame text,
  attributes jsonb,
  owner_address text,
  updated_at timestamptz default now(),
  unique(chain_id, contract_address, token_id)
);

-- Лог транзакций (минт, трансфер)
create table public.transaction_log (
  id uuid primary key default gen_random_uuid(),
  chain_id int not null,
  tx_hash text not null,
  contract_address text not null,
  event_type text not null, -- 'mint', 'transfer'
  from_address text,
  to_address text,
  token_id text,
  created_at timestamptz default now()
);

-- RLS
alter table public.profiles enable row level security;
create policy "Profiles read" on public.profiles for select using (true);
create policy "Profiles insert/update own" on public.profiles
  for all using (auth.jwt() ->> 'wallet_address' = wallet_address);

-- Каталог: чтение всем (для галереи), запись — только через service role или админ
alter table public.collection_items enable row level security;
create policy "Collection items read" on public.collection_items for select using (true);
```


- **Auth:** можно использовать Supabase Auth с custom provider (например, SIWE — Sign-In with Ethereum) и сохранять `wallet_address` в `profiles` при первом подключении кошелька.

### Storage

- **Supabase Storage:** фото очков для каталога (`collection_items.image_url` указывает на файлы в bucket, например `glasses` или `collection`); аватары пользователей. В Фазе 1 при минте эти же изображения можно дублировать в IPFS (Thirdweb Storage) для NFT.
- **Thirdweb Storage / IPFS:** каноническое хранилище изображений и JSON метаданных NFT после минта (контракт ссылается на IPFS URI).

---

## 4. Frontend Flow: от кошелька до минта

### Последовательность шагов

1. **Landing / выбор сети**  
   Пользователь видит приложение, кнопка «Connect Wallet» (Thirdweb `ConnectWallet` или `useConnect`).

2. **Подключение кошелька**  
   Thirdweb SDK подключает MetaMask/WalletConnect/и др. Выбор сети (например, Base, Polygon, Ethereum) — через `ChainId` и при необходимости переключение сети.

3. **Проверка сети**  
   Если сеть не та, что нужна для минта — показать переключатель или автоматически предложить переключиться (например, `switchChain`).

4. **Страница минта (Mint Page)**  
   - Отображение превью коллекции, цены, лимита на кошелёк.  
   - Кнопка «Mint» → вызов контракта `mintTo(address, quantity)` (или для ERC-1155 — `mintTo(address, tokenId, quantity)`).  
   - Ожидание подписания и подтверждения транзакции (useWaitForTransaction или аналоги в Thirdweb).  
   - Успех: toast/уведомление, редирект в галерею или профиль.

5. **Галерея (Gallery)**  
   Список NFT коллекции: чтение с контракта (`getAll`) или из Supabase `nft_metadata` с фильтрами по rarity/lenses/frame.

6. **Профиль (Profile)**  
   «My NFTs» — NFT текущего подключённого кошелька (контракт `balanceOf` + `tokenOfOwnerByIndex` или Thirdweb `useOwnedNFTs`). Плюс данные из `profiles` (ник, аватар).

### Критичные точки UX

- Всегда показывать статус: disconnected / connecting / wrong network / ready to mint.
- После минта — явный фидбек (success/error) и ссылка на эксплорер (tx hash).
- Стабильность: повторные запросы при обрыве RPC, fallback RPC в Thirdweb.

---

## 5. AI-Driven Development: правила и контекст для Cursor

### Что подгружать в Cursor

- **Rules (.cursor/rules/):**  
  - Общие: TypeScript/React, единый стиль (именование, структура папок).  
  - Специфичные: «При работе с контрактами использовать только Thirdweb SDK (react); не вызывать ethers напрямую для контрактов проекта.» «При работе с БД использовать Supabase client и RLS.»

- **Docs/контекст:**  
  - Официальная документация Thirdweb (React SDK, Contracts).  
  - Supabase: Auth, Database, Storage, RLS.  
  - Файл `TECH_SPEC.md` и `SETUP_GUIDE.md` в корне — как обязательный контекст проекта.

### Рекомендуемая структура правил

- `project-context.mdc` (alwaysApply: true) — стек: Thirdweb + Supabase, ссылка на SPEC.  
- `thirdweb.mdc` (globs: `**/*.tsx`, `**/contracts/**`) — использовать только @thirdweb-dev/react и @thirdweb-dev/sdk для кошелька и контрактов.  
- `supabase.mdc` (globs: `**/lib/supabase/**`, `**/api/**`) — использовать @supabase/supabase-js, не хардкодить ключи, использовать env.

---

## 6. Deployment Strategy

### Репозиторий (GitHub)

- Один репозиторий (monorepo) или два: `frontend`, `contracts` (по желанию).  
- Ветки: `main` — прод, `develop` — разработка.  
- Pull Request — обязательный ревью перед мержем в `main`.

### CI/CD

- **Frontend:** при пуше в `main` — сборка (build) и деплой на Vercel/Netlify (автоподключение к GitHub).  
- **Контракты:** исходники контрактов в репо; деплой контрактов — через **Thirdweb Dashboard** (Deploy Contract → загрузка ABI/bytecode или подключение репо для автоматического деплоя при тегах, если доступно).  
- Переменные окружения: в GitHub Secrets / Vercel Env — `NEXT_PUBLIC_THIRDWEB_CLIENT_ID`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`. Приватные ключи не коммитить.

### Чек-лист перед продакшеном

- [ ] Контракт задеплоен в целевую сеть (Thirdweb Dashboard), адрес записан в env.  
- [ ] Frontend использует правильные `chainId` и `contractAddress`.  
- [ ] Supabase RLS включён, политики проверены.  
- [ ] Лимиты минта и цена (если есть) проверены на контракте.

---

## 7. Разбивка на модули (Agentic Development)

**Сначала Фаза 0 (без кошелька и минта), затем Фаза 1 (добавить Web3).**

### Фаза 0 — Каталог и цифровой дух (без кошелька/минта)

| # | Модуль | Задачи | Критерий готовности |
|---|--------|--------|----------------------|
| 0.1 | **Каталог в Supabase** | Таблица `collection_items`, Storage для фото очков, RLS. Заполнение из твоих фото + метаданные (редкость, линзы, оправа). | В БД есть предметы с `image_url`, атрибутами; фото залиты в Storage. |
| 0.2 | **Галерея на сайте** | Страница Gallery: список из `collection_items`, карточки с фото и атрибутами, фильтры. Без кошелька. | Посетитель видит все очки коллекции, может фильтровать. |
| 0.3 | **Карточка предмета + «Передарить»** | Детальная страница одного очка (фото, описание, атрибуты). Блок «Передарить цифровой дух» — заглушка (текст «Скоро: подключи кошелёк и получи NFT» или кнопка неактивна). | Визуально и концептуально готово к добавлению минта/трансфера. |

### Фаза 1 — Подключение кошелька и минт (позже)

| # | Модуль | Задачи | Критерий готовности |
|---|--------|--------|----------------------|
| 1.1 | **Smart Contract** | ERC-721, деплой через Thirdweb, минт и роли. Метаданные NFT = фото + атрибуты из `collection_items`. | Контракт в тестовой сети, минт из Dashboard/скрипта работает. |
| 1.2 | **Minting Page** | Connect Wallet, выбор предмета из каталога, Mint, успех/ошибка. | Пользователь может заминтить NFT с фронта. |
| 1.3 | **Profile + «Передарить»** | «My NFTs», кнопка передарить (transfer) — вызов контракта. | Владелец видит свои NFT и может передать другому адресу. |
| 1.4 | **Backend sync** | Синхронизация `collection_items` с mint (token_id после минта), лог транзакций. | Данные в Supabase актуальны после минта/трансфера. |

После каждого модуля — проверка (ручной тест или e2e), затем следующий шаг.

---

*Документ является единым источником правды для разработки. Все изменения архитектуры вносятся сюда.*

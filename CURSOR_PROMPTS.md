# Примеры промптов для Cursor

> Используй эти промпты в чате Cursor для генерации ключевых компонентов проекта NFT Glasses. Перед запросом подгрузи контекст: @TECH_SPEC.md и при необходимости @SETUP_GUIDE.md.

---

## 1. Smart Contract (метаданные и минт)

```
Проект: Web3 NFT-коллекция очков. Стек: Thirdweb, Supabase.

Задача: опиши структуру JSON метаданных для одного NFT очков с атрибутами:
- rarity (Common | Uncommon | Rare | Epic | Legendary)
- lenses (тип линз)
- frame (тип оправы)

И напиши пример вызова минта через Thirdweb SDK (React): один NFT на адрес connected wallet. Контракт ERC-721, адрес и chainId брать из env. Обработать состояния: pending, success, error.
```

---

## 2. Minting Page

```
По TECH_SPEC.md реализуй страницу минта NFT:

- Использовать только @thirdweb-dev/react (useContract, useMint, useAddress, useChain).
- Кнопка Connect Wallet если не подключён кошелёк.
- Если сеть не совпадает с NEXT_PUBLIC_CHAIN_ID — показать кнопку «Switch network».
- Кнопка «Mint» вызывает mintTo для текущего адреса, quantity 1.
- После успешного минта: toast/уведомление и редирект на /gallery или /profile.
- Показать превью коллекции (статичная картинка или описание) и цену, если есть.
```

---

## 3. Gallery

```
Реализуй страницу Gallery для NFT-коллекции очков:

- Список NFT: либо через Thirdweb useContract + getAll (ERC-721), либо через Supabase таблицу nft_metadata (если синхронизация уже есть).
- Карточка: image, name, rarity, lenses, frame.
- Фильтры: по rarity, по lenses, по frame (dropdown или chips). Фильтрация на клиенте или через Supabase query.
- Адаптивная сетка (grid), скелетоны при загрузке.
- Стек: React, Thirdweb SDK, при необходимости Supabase client. Ссылка на TECH_SPEC.md.
```

---

## 4. Profile (My NFTs)

```
Реализуй страницу Profile:

- Показать NFT текущего подключённого кошелька (useAddress + useOwnedNFTs из Thirdweb или balanceOf + tokenOfOwnerByIndex).
- Секция «Профиль»: форма для обновления username и avatar. Данные сохранять в Supabase таблицу profiles по wallet_address (upsert). RLS уже настроен по TECH_SPEC.
- Если кошелёк не подключён — показать кнопку Connect Wallet и краткий текст «Connect to see your NFTs».
```

---

## 5. Supabase: синхронизация метаданных и лог транзакций

```
В проекте есть контракт ERC-721 для NFT очков и таблицы Supabase: nft_metadata, transaction_log (см. TECH_SPEC.md).

Задача: предложи архитектуру синхронизации:
1) при минте нового токена — записать/обновить запись в nft_metadata (token_id, contract_address, chain_id, image_url, rarity, lenses, frame из metadata JSON);
2) логировать каждую транзакцию минта в transaction_log (tx_hash, event_type: 'mint', to_address, token_id).

Варианты: серверный API route (Next.js), который вызывается после минта с фронта и получает tokenId + txHash; или отдельный скрипт/воркер, который слушает события контракта. Опиши плюсы/минусы и дай пример кода для варианта «API route после минта».
```

---

## 6. Cursor Rules для проекта

```
Создай правило для Cursor (.cursor/rules/), которое:
- alwaysApply: true
- Описывает стек проекта: Thirdweb (React SDK) для Web3 и контрактов, Supabase для БД и профилей. Не использовать ethers.js напрямую для вызовов контрактов проекта — только Thirdweb. Не хардкодить API ключи — только process.env.
- Упоминает, что полная спецификация в TECH_SPEC.md и настройка в SETUP_GUIDE.md.
```

---

## 7. Деплой и env

```
По TECH_SPEC.md раздел Deployment: составь чек-лист для продакшен-деплоя и список переменных окружения для Vercel (frontend). Учтены: Thirdweb Client ID, chain ID, contract address, Supabase URL и anon key. Приватные ключи не должны попадать во фронт.
```

---

*Копируй нужный блок в чат Cursor и при необходимости добавляй пути к файлам (@filename).*

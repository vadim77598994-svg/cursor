# Часть 2. Фронт на Railway (второй сервис)

Деплой Next.js-фронта в том же проекте Railway, где уже работает бэкенд.

---

## Что уже сделано в коде

- В `package.json` скрипт **start** — `next start` (без фиксированного порта). Next.js возьмёт порт из переменной **PORT**, которую подставляет Railway.
- Переменная **NEXT_PUBLIC_DOGOVOR_API_URL** задаётся в Railway Variables — в неё подставь URL бэкенда.

---

## Шаги в Railway

### 1. Добавить новый сервис

1. Открой свой **проект** в Railway (тот, где уже есть сервис **cursor** с бэкендом).
2. Нажми **+ New** (или **Add service** / **Create**).
3. Выбери **GitHub Repo** → репозиторий **cursor** (тот же, что и у бэкенда).
4. Подтверди — Railway создаст новый сервис из этого репо.

### 2. Root Directory и команды

1. Открой **новый** сервис (не бэкенд). Перейди в **Settings**.
2. **Root Directory:** укажи **`dogovor/frontend`** (без слэша в начале).
3. **Build Command:** можно оставить пустым — Railway (Nixpacks/Railpack) поставит `npm install` и `npm run build`. Или явно: `npm ci && npm run build`.
4. **Start Command:** укажи **`npm start`** (или `npx next start`). Порт Railway подставит через переменную **PORT** автоматически.
5. Сохрани.

### 3. Переменные окружения (Variables)

Во вкладке **Variables** нового сервиса добавь:

| Имя | Значение |
|-----|----------|
| `NEXT_PUBLIC_DOGOVOR_API_URL` | URL бэкенда, например `https://cursor-production-92d8.up.railway.app` (без слэша в конце). Бери из настроек **первого** сервиса (бэкенда) → Networking. |

Других переменных для фронта не нужно.

### 4. Домен (Networking)

1. В настройках **фронт-**сервиса открой **Networking**.
2. Нажми **Generate Domain** (или **Add domain**).
3. Скопируй выданный URL (например `https://cursor-production-xxxx.up.railway.app` — будет другой суффикс, чем у бэкенда).

### 5. CORS на бэкенде

Чтобы браузер мог ходить с фронта на API:

1. Открой **первый** сервис (бэкенд) → **Variables**.
2. Найди или добавь переменную **`CORS_ORIGINS`**.
3. Значение — **полный URL фронта** из шага 4, без слэша в конце, например:  
   `https://твой-фронт-домен.up.railway.app`
4. Сохрани. Railway перезапустит бэкенд.

### 6. Проверка

1. Открой в браузере URL фронта из шага 4.
2. Должна открыться форма «Оформление договора» (кабинет → сканирование → и т.д.).
3. Пройди сценарий до «Сгенерировать договор». Если запрос уходит на бэкенд без CORS-ошибок — всё настроено верно.

---

## Краткий чеклист

- [ ] New service → GitHub repo **cursor**.
- [ ] Root Directory = `dogovor/frontend`.
- [ ] Start Command = `npm start`.
- [ ] Variables: `NEXT_PUBLIC_DOGOVOR_API_URL` = URL бэкенда.
- [ ] Generate Domain для фронта, скопировать URL.
- [ ] У бэкенда в Variables: `CORS_ORIGINS` = URL фронта.
- [ ] Открыть URL фронта в браузере и проверить сценарий.

# Альтернативы Vercel для деплоя фронта (Next.js)

Если Vercel просит верификацию по телефону и её нет — можно задеплоить фронт на других сервисах. Ниже сравнение и краткие шаги.

---

## Сравнение

| Сервис           | Регистрация        | Next.js        | Бесплатный tier | Насколько ок вместо Vercel      |
|------------------|--------------------|----------------|-----------------|---------------------------------|
| **Netlify**      | GitHub + email     | Полная поддержка | Да, лимиты     | **Ок.** Обычно без телефона, деплой из GitHub, переменные env. |
| **Cloudflare Pages** | GitHub + email | Через static export | Да, щедрый   | **Ок.** Нужна настройка `output: 'export'` в next.config. Наш фронт только клиент + запросы к API — подходит. |
| **Railway (второй сервис)** | Уже есть аккаунт | Node (next start) | В пределах кредитов | **Ок.** Один сервис = бэкенд, второй = фронт в том же проекте. Не нужен новый сервис. |

**Итог:** для твоего случая (фронт только ходит в API на Railway) все три варианта нормальны. Быстрее всего попробовать **Netlify** (часто только email). Если и там попросят телефон — **Railway** (второй сервис в том же проекте) или **Cloudflare Pages** (со static export).

---

## Вариант 1: Netlify

1. Зайди на [netlify.com](https://netlify.com) → **Sign up** → **Continue with GitHub** (логин через GitHub, без телефона).
2. **Add new site** → **Import an existing project** → **GitHub** → выбери репо **cursor**.
3. В настройках сборки:
   - **Base directory:** `dogovor/frontend`
   - **Build command:** `npm run build` (или `npm ci && npm run build`)
   - **Publish directory:** `dogovor/frontend/.next` — **нет.** Для Next.js на Netlify укажи **Publish directory:** `.next` (относительно base). Или оставь автоматику: Netlify сам подхватит Next.js, если в base directory есть `package.json` и next.
4. **Environment variables** → добавь: `NEXT_PUBLIC_DOGOVOR_API_URL` = `https://cursor-production-92d8.up.railway.app`
5. **Deploy site.** Домен будет вида `xxx.netlify.app`.
6. В **Railway** в переменных бэкенда задай **CORS_ORIGINS** = `https://xxx.netlify.app` (твой URL с Netlify).

Если Netlify при первом деплое спросит **Framework** — выбери **Next.js**; Publish directory оставь пустым или `.next` (Netlify сам настроит для Next).

---

## Вариант 2: Cloudflare Pages (со static export)

Наш фронт только запрашивает API и рендерится на клиенте — подходит статический экспорт.

1. В **dogovor/frontend/next.config.ts** добавь `output: 'export'` (см. ниже).
2. [dash.cloudflare.com](https://dash.cloudflare.com) → **Workers & Pages** → **Create** → **Pages** → **Connect to Git** → репо **cursor**.
3. **Build settings:**
   - **Root directory (advanced):** `dogovor/frontend`
   - **Framework preset:** Next.js (Static HTML Export)
   - **Build command:** `npm run build`
   - **Build output directory:** `out`
4. **Environment variables:** `NEXT_PUBLIC_DOGOVOR_API_URL` = `https://cursor-production-92d8.up.railway.app`
5. После деплоя домен вида `xxx.pages.dev`. В Railway **CORS_ORIGINS** = `https://xxx.pages.dev`

Фрагмент для **next.config.ts** (временно для Cloudflare):

```ts
const nextConfig: NextConfig = {
  output: 'export',  // только для Cloudflare Pages
  outputFileTracingRoot: path.join(__dirname),
};
```

Если позже будешь деплоить на Netlify/Railway без static export — убери `output: 'export'`.

---

## Вариант 3: Фронт на Railway (второй сервис)

В том же проекте Railway, где уже есть бэкенд:

1. **Add service** → **GitHub repo** → снова выбери **cursor**.
2. У нового сервиса в **Settings** задай **Root Directory:** `dogovor/frontend`.
3. **Build command:** `npm install && npm run build` (или Nixpacks сам подставит).
4. **Start command:** `npm start` (запустит `next start -p $PORT`). Чтобы порт был от Railway, в **Variables** добавь `PORT` (Railway обычно подставляет сам) или в `package.json` в скрипте start используй `-p ${PORT:-3000}`.
5. **Variables:** `NEXT_PUBLIC_DOGOVOR_API_URL` = `https://cursor-production-92d8.up.railway.app` (URL твоего бэкенда-сервиса на Railway).
6. **Networking** → **Generate Domain** для фронта. В бэкенде в **CORS_ORIGINS** укажи этот новый домен (например `https://cursor-frontend-xxxx.up.railway.app`).

Плюс: один аккаунт, один биллинг. Минус: расход кредитов Railway на два сервиса.

---

## После деплоя фронта

В любом варианте в **Railway** у бэкенда в переменных задай **CORS_ORIGINS** = полный URL фронта (без слэша в конце). Иначе браузер будет блокировать запросы к API.

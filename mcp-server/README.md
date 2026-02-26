# MCP Server для Cursor

Минимальный [Model Context Protocol](https://modelcontextprotocol.io) (MCP) сервер с примерами инструментов. Подключается к Cursor и даёт ассистенту вызывать ваши инструменты (tools).

## Что внутри

- **Tools (инструменты):**
  - `add` — складывает два числа
  - `echo` — возвращает переданную строку

Дальше можно добавить свои инструменты, ресурсы (resources) и промпты (prompts).

## Требования

- Node.js 18+

## Установка и запуск

```bash
cd mcp-server
npm install
npm run build
npm start
```

Для разработки (без сборки):

```bash
npm run dev
```

Сервер общается через stdin/stdout — его должен запускать Cursor, а не вручную в терминале.

## Как добавить в Cursor

1. Открой настройки Cursor: **Cmd + ,** → поиск «MCP» → **Edit MCP Settings** (или отредактируй `~/.cursor/mcp.json` вручную).

2. Добавь сервер. Варианты:

   **Вариант A — из папки проекта (после `npm run build`):**

   ```json
   {
     "mcpServers": {
       "cursor-mcp": {
         "command": "node",
         "args": ["/Users/mac/Desktop/cursor/mcp-server/dist/index.js"]
       }
     }
   }
   ```

   **Вариант B — через npx (если опубликуешь пакет в npm):**

   ```json
   {
     "mcpServers": {
       "cursor-mcp": {
         "command": "npx",
         "args": ["-y", "cursor-mcp-server"]
       }
     }
   }
   ```

3. Перезапусти Cursor. В чате с AI должны появиться инструменты этого MCP.

## Как выложить код в GitHub (vadim77598994-svg/cursor)

1. Инициализируй репозиторий в папке с MCP (или в корне проекта):

   ```bash
   cd /Users/mac/Desktop/cursor
   git init
   git remote add origin https://github.com/vadim77598994-svg/cursor.git
   ```

2. Добавь `.gitignore` в корне (если ещё нет):

   ```
   node_modules/
   dist/
   .env
   .env.local
   ```

3. Закоммить и отправить:

   ```bash
   git add .
   git commit -m "Add MCP server"
   git branch -M main
   git push -u origin main
   ```

Если хочешь в репозитории только MCP, скопируй в отдельную папку только `mcp-server/` (вместе с `package.json`, `tsconfig.json`, `src/`, `README.md`), сделай `git init` внутри неё и пуш в свой репо.

## Как добавить свой инструмент

1. В `src/index.ts` в обработчике **ListToolsRequestSchema** добавь описание нового tool в массив `tools` (name, description, inputSchema).
2. В обработчике **CallToolRequestSchema** добавь ветку `if (name === "my_tool") { ... }`, распарсь аргументы через `zod` и верни `{ content: [{ type: "text", text: "..." }], isError: false }`.

Документация протокола: [modelcontextprotocol.io](https://modelcontextprotocol.io).  
TypeScript SDK: [@modelcontextprotocol/sdk](https://www.npmjs.com/package/@modelcontextprotocol/sdk).

#!/usr/bin/env node
/**
 * MCP Server для Cursor
 * Запуск: npm run dev  или  node dist/index.js после npm run build
 */

import { Server } from "@modelcontextprotocol/sdk/server";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
  type CallToolRequest,
} from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";

const server = new Server(
  {
    name: "cursor-mcp-server",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Список доступных инструментов
server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "add",
      description: "Складывает два числа",
      inputSchema: {
        type: "object",
        properties: {
          a: { type: "number", description: "Первое число" },
          b: { type: "number", description: "Второе число" },
        },
        required: ["a", "b"],
      },
    },
    {
      name: "echo",
      description: "Возвращает переданное сообщение",
      inputSchema: {
        type: "object",
        properties: {
          message: { type: "string", description: "Текст для эха" },
        },
        required: ["message"],
      },
    },
  ],
}));

// Обработка вызова инструментов
server.setRequestHandler(CallToolRequestSchema, async (request: CallToolRequest) => {
  const { name, arguments: args } = request.params;

  if (name === "add") {
    const schema = z.object({ a: z.number(), b: z.number() });
    const { a, b } = schema.parse(args ?? {});
    return {
      content: [{ type: "text", text: String(a + b) }],
      isError: false,
    };
  }

  if (name === "echo") {
    const schema = z.object({ message: z.string() });
    const { message } = schema.parse(args ?? {});
    return {
      content: [{ type: "text", text: message }],
      isError: false,
    };
  }

  throw new Error(`Unknown tool: ${name}`);
});

const transport = new StdioServerTransport();
await server.connect(transport);

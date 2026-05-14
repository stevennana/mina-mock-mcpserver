import assert from "node:assert/strict";
import { test } from "node:test";

import {
  createMcpFetchHandler,
  MCP_PROTOCOL_VERSION_HEADER,
  type McpRuntimeProvider,
} from "@minasoft/mcp-runtime";

function jsonRequest(body: unknown, headers: HeadersInit = {}) {
  return new Request("https://consumer.example/mcp", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...headers,
    },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

async function readJson(response: Response) {
  return response.json() as Promise<unknown>;
}

test("Fetch handler maps initialize responses with JSON content and protocol-version headers", async () => {
  const handler = createMcpFetchHandler({
    serverInfo: {
      name: "http-fixture",
      version: "0.0.1",
    },
    resources: {
      async list() {
        return { items: [] };
      },
      async read() {
        return { kind: "not_found" };
      },
    },
  });

  const response = await handler(
    jsonRequest(
      {
        jsonrpc: "2.0",
        id: "init",
        method: "initialize",
        params: { protocolVersion: "2025-03-26" },
      },
      { [MCP_PROTOCOL_VERSION_HEADER]: "2025-03-26" },
    ),
  );

  assert.equal(response.status, 200);
  assert.equal(response.headers.get("content-type"), "application/json; charset=utf-8");
  assert.equal(response.headers.get(MCP_PROTOCOL_VERSION_HEADER), "2025-03-26");
  assert.deepEqual(await readJson(response), {
    jsonrpc: "2.0",
    id: "init",
    result: {
      protocolVersion: "2025-03-26",
      capabilities: {
        resources: { subscribe: false, listChanged: true },
      },
      serverInfo: {
        name: "http-fixture",
        version: "0.0.1",
      },
    },
  });
});

test("Fetch handler rejects unsupported protocol headers before provider dispatch", async () => {
  let called = false;
  const handler = createMcpFetchHandler({
    resources: {
      async list() {
        called = true;
        return { items: [] };
      },
      async read() {
        return { kind: "not_found" };
      },
    },
  });

  const response = await handler(
    jsonRequest(
      { jsonrpc: "2.0", id: "list", method: "resources/list" },
      { [MCP_PROTOCOL_VERSION_HEADER]: "1900-01-01" },
    ),
  );

  assert.equal(response.status, 400);
  assert.equal(response.headers.get(MCP_PROTOCOL_VERSION_HEADER), "2025-06-18");
  assert.equal(called, false);
  assert.deepEqual(await readJson(response), {
    jsonrpc: "2.0",
    id: null,
    error: { code: -32600, message: "Unsupported MCP protocol version." },
  });
});

test("Fetch handler maps JSON parse failures to JSON-RPC parse errors", async () => {
  const handler = createMcpFetchHandler({});

  const response = await handler(jsonRequest("{malformed"));

  assert.equal(response.status, 400);
  assert.equal(response.headers.get("content-type"), "application/json; charset=utf-8");
  assert.deepEqual(await readJson(response), {
    jsonrpc: "2.0",
    id: null,
    error: { code: -32700, message: "Parse error" },
  });
});

test("Fetch handler injects provider context from the Request", async () => {
  const handler = createMcpFetchHandler(
    {
      resources: {
        async list(input) {
          return {
            items: [
              {
                uri: `mock://published/${input.context.principal}`,
                name: String(input.context.principal),
              },
            ],
          };
        },
        async read() {
          return { kind: "not_found" };
        },
      },
    },
    {
      context(request) {
        return {
          requestId: request.headers.get("x-request-id") ?? undefined,
          principal: request.headers.get("x-user") ?? "anonymous",
        };
      },
    },
  );

  const response = await handler(
    jsonRequest(
      { jsonrpc: "2.0", id: "list", method: "resources/list" },
      {
        "x-request-id": "request-1",
        "x-user": "published-user",
      },
    ),
  );

  assert.equal(response.status, 200);
  assert.deepEqual(await readJson(response), {
    jsonrpc: "2.0",
    id: "list",
    result: {
      resources: [
        {
          uri: "mock://published/published-user",
          name: "published-user",
        },
      ],
    },
  });
});

test("Fetch handler preserves raw tool response content type and headers", async () => {
  const provider: McpRuntimeProvider = {
    tools: {
      async list() {
        return { items: [] };
      },
      async call() {
        return {
          kind: "raw",
          status: 418,
          body: "{raw",
          contentType: "application/vnd.fixture",
          headers: { "x-fixture": "raw" },
        };
      },
    },
  };
  const handler = createMcpFetchHandler(provider);

  const response = await handler(
    jsonRequest({ jsonrpc: "2.0", id: "raw", method: "tools/call", params: { name: "raw" } }),
  );

  assert.equal(response.status, 418);
  assert.equal(response.headers.get("content-type"), "application/vnd.fixture");
  assert.equal(response.headers.get("x-fixture"), "raw");
  assert.equal(response.headers.get(MCP_PROTOCOL_VERSION_HEADER), "2025-06-18");
  assert.equal(await response.text(), "{raw");
});

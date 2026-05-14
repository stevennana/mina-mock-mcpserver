import assert from "node:assert/strict";
import { test } from "node:test";

import {
  createMcpCorsHeaders,
  createMcpFetchHandler,
  createMcpOptionsResponse,
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

test("Fetch handler honors custom protocol-version options", async () => {
  const handler = createMcpFetchHandler(
    {
      serverInfo: {
        name: "custom-protocol-fixture",
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
    },
    {
      supportedProtocolVersions: ["2030-01-01"],
      defaultProtocolVersion: "2030-01-01",
    },
  );

  const accepted = await handler(
    jsonRequest(
      {
        jsonrpc: "2.0",
        id: "custom-init",
        method: "initialize",
        params: { protocolVersion: "2030-01-01" },
      },
      { [MCP_PROTOCOL_VERSION_HEADER]: "2030-01-01" },
    ),
  );
  const rejected = await handler(
    jsonRequest(
      {
        jsonrpc: "2.0",
        id: "unsupported",
        method: "resources/list",
      },
      { [MCP_PROTOCOL_VERSION_HEADER]: "2025-06-18" },
    ),
  );
  const defaulted = await handler(
    jsonRequest({
      jsonrpc: "2.0",
      id: "defaulted",
      method: "resources/list",
    }),
  );

  assert.equal(accepted.status, 200);
  assert.equal(accepted.headers.get(MCP_PROTOCOL_VERSION_HEADER), "2030-01-01");
  assert.deepEqual(await readJson(accepted), {
    jsonrpc: "2.0",
    id: "custom-init",
    result: {
      protocolVersion: "2030-01-01",
      capabilities: {
        resources: { subscribe: false, listChanged: true },
      },
      serverInfo: {
        name: "custom-protocol-fixture",
        version: "0.0.1",
      },
    },
  });

  assert.equal(rejected.status, 400);
  assert.equal(rejected.headers.get(MCP_PROTOCOL_VERSION_HEADER), "2030-01-01");
  assert.deepEqual(await readJson(rejected), {
    jsonrpc: "2.0",
    id: null,
    error: { code: -32600, message: "Unsupported MCP protocol version." },
  });

  assert.equal(defaulted.status, 200);
  assert.equal(defaulted.headers.get(MCP_PROTOCOL_VERSION_HEADER), "2030-01-01");
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

test("CORS helpers create opt-in Inspector-compatible preflight headers", () => {
  const request = new Request("https://consumer.example/mcp", {
    method: "OPTIONS",
    headers: {
      origin: "http://localhost:6274",
      "access-control-request-method": "POST",
    },
  });
  const options = {
    allowedOrigins: ["http://localhost:6274"],
    maxAgeSeconds: 86400,
  };

  const headers = createMcpCorsHeaders(options, request);
  const response = createMcpOptionsResponse(options, request);

  assert.equal(headers.get("access-control-allow-origin"), "http://localhost:6274");
  assert.equal(headers.get("access-control-allow-methods"), "POST, OPTIONS");
  assert.equal(
    headers.get("access-control-allow-headers"),
    "Authorization, Content-Type, MCP-Protocol-Version, MCP-Session-Id, Last-Event-ID",
  );
  assert.equal(headers.get("access-control-expose-headers"), "MCP-Protocol-Version");
  assert.equal(headers.get("access-control-max-age"), "86400");
  assert.equal(response.status, 204);
  assert.equal(response.headers.get("access-control-allow-origin"), "http://localhost:6274");
});

test("Fetch handler applies CORS to OPTIONS and POST only when enabled", async () => {
  const provider: McpRuntimeProvider = {
    resources: {
      async list() {
        return { items: [] };
      },
      async read() {
        return { kind: "not_found" };
      },
    },
  };
  const handler = createMcpFetchHandler(provider, {
    cors: {
      allowedOrigins: ["http://localhost:6274"],
      exposedHeaders: ["MCP-Protocol-Version", "MCP-Session-Id"],
    },
  });
  const defaultHandler = createMcpFetchHandler(provider);

  const preflight = await handler(
    new Request("https://consumer.example/mcp", {
      method: "OPTIONS",
      headers: { origin: "http://localhost:6274" },
    }),
  );
  const post = await handler(
    jsonRequest(
      {
        jsonrpc: "2.0",
        id: "list",
        method: "resources/list",
      },
      { origin: "http://localhost:6274" },
    ),
  );
  const defaultPost = await defaultHandler(
    jsonRequest(
      {
        jsonrpc: "2.0",
        id: "list",
        method: "resources/list",
      },
      { origin: "http://localhost:6274" },
    ),
  );

  assert.equal(preflight.status, 204);
  assert.equal(preflight.headers.get("access-control-allow-origin"), "http://localhost:6274");
  assert.equal(post.status, 200);
  assert.equal(post.headers.get("access-control-allow-origin"), "http://localhost:6274");
  assert.equal(post.headers.get("access-control-expose-headers"), "MCP-Protocol-Version, MCP-Session-Id");
  assert.equal(defaultPost.headers.get("access-control-allow-origin"), null);
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

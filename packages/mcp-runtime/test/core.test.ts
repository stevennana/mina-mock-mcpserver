import assert from "node:assert/strict";
import { test } from "node:test";

import {
  createMcpErrorResponseFromProviderError,
  deriveMcpCapabilities,
  handleMcpJsonRpcMessage,
  type McpRuntimeProvider,
} from "@minasoft/mcp-runtime";

function resourcesOnlyProvider(): McpRuntimeProvider {
  return {
    serverInfo: {
      name: "fixture-server",
      version: "1.2.3",
    },
    resources: {
      async list() {
        return { items: [] };
      },
      async read() {
        return { kind: "not_found", message: "Missing resource" };
      },
    },
  };
}

test("initialize returns negotiated protocol version, provider capabilities, and server info", async () => {
  const result = await handleMcpJsonRpcMessage(
    {
      jsonrpc: "2.0",
      id: "init-1",
      method: "initialize",
      params: {
        protocolVersion: "2025-03-26",
        capabilities: {},
        clientInfo: { name: "unit-test", version: "0.0.0" },
      },
    },
    {
      ...resourcesOnlyProvider(),
      tools: {
        async list() {
          return { items: [] };
        },
        async call() {
          return { kind: "invalid_params", message: "not implemented here" };
        },
      },
      prompts: {
        async list() {
          return { items: [] };
        },
        async get() {
          return { kind: "not_found" };
        },
        async complete() {
          return { kind: "success", values: [] };
        },
      },
    },
  );

  assert.equal(result.kind, "json");
  if (result.kind !== "json") return;

  assert.equal(result.status, 200);
  assert.deepEqual(result.body, {
    jsonrpc: "2.0",
    id: "init-1",
    result: {
      protocolVersion: "2025-03-26",
      capabilities: {
        tools: { listChanged: false },
        resources: { subscribe: false, listChanged: true },
        prompts: { listChanged: true },
        completions: {},
      },
      serverInfo: {
        name: "fixture-server",
        version: "1.2.3",
      },
    },
  });
});

test("initialized notification is accepted without a JSON-RPC body", async () => {
  const result = await handleMcpJsonRpcMessage(
    {
      jsonrpc: "2.0",
      method: "notifications/initialized",
    },
    resourcesOnlyProvider(),
  );

  assert.deepEqual(result, { kind: "accepted" });
});

test("invalid JSON-RPC envelopes and batches return invalid request errors", async () => {
  const invalid = await handleMcpJsonRpcMessage({ jsonrpc: "2.0", id: "bad" }, resourcesOnlyProvider());
  const invalidId = await handleMcpJsonRpcMessage(
    { jsonrpc: "2.0", id: { nested: true }, method: "initialize" },
    resourcesOnlyProvider(),
  );
  const batch = await handleMcpJsonRpcMessage(
    [{ jsonrpc: "2.0", id: "init", method: "initialize" }],
    resourcesOnlyProvider(),
  );

  assert.deepEqual(invalid, {
    kind: "json",
    status: 400,
    body: {
      jsonrpc: "2.0",
      id: "bad",
      error: { code: -32600, message: "Invalid Request" },
    },
  });
  assert.deepEqual(invalidId, {
    kind: "json",
    status: 400,
    body: {
      jsonrpc: "2.0",
      id: null,
      error: { code: -32600, message: "Invalid Request" },
    },
  });
  assert.deepEqual(batch, {
    kind: "json",
    status: 400,
    body: {
      jsonrpc: "2.0",
      id: null,
      error: { code: -32600, message: "Batch requests are not supported" },
    },
  });
});

test("initialize rejects malformed params", async () => {
  const result = await handleMcpJsonRpcMessage(
    {
      jsonrpc: "2.0",
      id: "init",
      method: "initialize",
      params: "bad",
    },
    resourcesOnlyProvider(),
  );

  assert.deepEqual(result, {
    kind: "json",
    status: 200,
    body: {
      jsonrpc: "2.0",
      id: "init",
      error: { code: -32602, message: "Invalid params" },
    },
  });
});

test("unsupported feature methods intentionally return method not found", async () => {
  const result = await handleMcpJsonRpcMessage(
    {
      jsonrpc: "2.0",
      id: 10,
      method: "resources/list",
    },
    resourcesOnlyProvider(),
  );

  assert.deepEqual(result, {
    kind: "json",
    status: 200,
    body: {
      jsonrpc: "2.0",
      id: 10,
      error: {
        code: -32601,
        message: "Method not found",
        data: { method: "resources/list" },
      },
    },
  });
});

test("provider errors map through reusable JSON-RPC error helpers", () => {
  assert.deepEqual(
    createMcpErrorResponseFromProviderError("missing", {
      kind: "not_found",
      message: "Resource not found",
    }),
    {
      jsonrpc: "2.0",
      id: "missing",
      error: {
        code: -32002,
        message: "Resource not found",
        data: { error: "not_found" },
      },
    },
  );

  assert.deepEqual(
    createMcpErrorResponseFromProviderError("denied", {
      kind: "forbidden",
      message: "Token lacks permission",
    }),
    {
      jsonrpc: "2.0",
      id: "denied",
      error: {
        code: -32003,
        message: "Token lacks permission",
        data: { error: "forbidden", message: "Token lacks permission" },
      },
    },
  );

  assert.deepEqual(
    createMcpErrorResponseFromProviderError("invalid", {
      kind: "invalid_params",
      message: "Bad cursor",
      data: { cursor: "bad" },
    }),
    {
      jsonrpc: "2.0",
      id: "invalid",
      error: {
        code: -32602,
        message: "Bad cursor",
        data: { cursor: "bad" },
      },
    },
  );

  assert.deepEqual(
    createMcpErrorResponseFromProviderError("protocol", {
      kind: "protocol_error",
      message: "Provider failed",
      data: { detail: "boom" },
    }),
    {
      jsonrpc: "2.0",
      id: "protocol",
      error: {
        code: -32000,
        message: "Provider failed",
        data: { error: "protocol_error", detail: "boom" },
      },
    },
  );
});

test("capabilities are derived from provider shape with no optional providers", () => {
  assert.deepEqual(deriveMcpCapabilities(resourcesOnlyProvider()), {
    resources: {
      subscribe: false,
      listChanged: true,
    },
  });
});

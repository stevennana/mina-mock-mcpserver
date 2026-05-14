import assert from "node:assert/strict";
import { test } from "node:test";

import {
  createMcpErrorResponseFromProviderError,
  deriveMcpCapabilities,
  handleMcpJsonRpcMessage,
  paginateMcpItemsByOffset,
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

test("resources/list returns provider resources with cursor pagination input", async () => {
  let observedCursor: string | undefined;
  let observedLimit: number | undefined;
  let observedRequestId: string | undefined;

  const result = await handleMcpJsonRpcMessage(
    {
      jsonrpc: "2.0",
      id: 10,
      method: "resources/list",
      params: { cursor: "cursor-1", limit: 1 },
    },
    {
      resources: {
        async list(input) {
          observedCursor = input.cursor;
          observedLimit = input.limit;
          observedRequestId = input.context.requestId;
          return {
            items: [
              {
                uri: "mock://content/alpha",
                name: "alpha",
                title: "Alpha",
                description: "Provider-owned resource",
                mimeType: "text/plain",
                size: 5,
                annotations: { audience: ["assistant"] },
              },
            ],
            nextCursor: "cursor-2",
          };
        },
        async read() {
          return { kind: "not_found" };
        },
      },
    },
    { context: { requestId: "request-1" } },
  );

  assert.equal(observedCursor, "cursor-1");
  assert.equal(observedLimit, 1);
  assert.equal(observedRequestId, "request-1");
  assert.deepEqual(result, {
    kind: "json",
    status: 200,
    body: {
      jsonrpc: "2.0",
      id: 10,
      result: {
        resources: [
          {
            uri: "mock://content/alpha",
            name: "alpha",
            title: "Alpha",
            description: "Provider-owned resource",
            mimeType: "text/plain",
            size: 5,
            annotations: { audience: ["assistant"] },
          },
        ],
        nextCursor: "cursor-2",
      },
    },
  });
});

test("resources/templates/list returns provider templates", async () => {
  const result = await handleMcpJsonRpcMessage(
    {
      jsonrpc: "2.0",
      id: "templates",
      method: "resources/templates/list",
    },
    {
      resources: {
        async list() {
          return { items: [] };
        },
        async read() {
          return { kind: "not_found" };
        },
        templates: {
          async list() {
            return {
              items: [
                {
                  uriTemplate: "mock://content/{slug}",
                  name: "content-by-slug",
                  mimeType: "text/markdown",
                },
              ],
            };
          },
        },
      },
    },
  );

  assert.deepEqual(result, {
    kind: "json",
    status: 200,
    body: {
      jsonrpc: "2.0",
      id: "templates",
      result: {
        resourceTemplates: [
          {
            uriTemplate: "mock://content/{slug}",
            name: "content-by-slug",
            mimeType: "text/markdown",
          },
        ],
      },
    },
  });
});

test("resources/read returns provider contents", async () => {
  const result = await handleMcpJsonRpcMessage(
    {
      jsonrpc: "2.0",
      id: "read",
      method: "resources/read",
      params: { uri: "mock://content/alpha" },
    },
    {
      resources: {
        async list() {
          return { items: [] };
        },
        async read(input) {
          return {
            kind: "success",
            contents: [
              {
                uri: input.uri,
                mimeType: "text/plain",
                text: "alpha",
              },
            ],
          };
        },
      },
    },
  );

  assert.deepEqual(result, {
    kind: "json",
    status: 200,
    body: {
      jsonrpc: "2.0",
      id: "read",
      result: {
        contents: [
          {
            uri: "mock://content/alpha",
            mimeType: "text/plain",
            text: "alpha",
          },
        ],
      },
    },
  });
});

test("resources/read maps not-found and forbidden provider outcomes", async () => {
  const provider: McpRuntimeProvider = {
    resources: {
      async list() {
        return { items: [] };
      },
      async read(input) {
        if (input.uri === "mock://content/denied") {
          return { kind: "forbidden", message: "Token lacks resource permission" };
        }

        return { kind: "not_found", message: "Resource not found" };
      },
    },
  };

  const missing = await handleMcpJsonRpcMessage(
    {
      jsonrpc: "2.0",
      id: "missing",
      method: "resources/read",
      params: { uri: "mock://content/missing" },
    },
    provider,
  );
  const denied = await handleMcpJsonRpcMessage(
    {
      jsonrpc: "2.0",
      id: "denied",
      method: "resources/read",
      params: { uri: "mock://content/denied" },
    },
    provider,
  );

  assert.deepEqual(missing, {
    kind: "json",
    status: 200,
    body: {
      jsonrpc: "2.0",
      id: "missing",
      error: {
        code: -32002,
        message: "Resource not found",
        data: { error: "not_found" },
      },
    },
  });
  assert.deepEqual(denied, {
    kind: "json",
    status: 200,
    body: {
      jsonrpc: "2.0",
      id: "denied",
      error: {
        code: -32003,
        message: "Token lacks resource permission",
        data: { error: "forbidden", message: "Token lacks resource permission" },
      },
    },
  });
});

test("resource subscriptions return empty success or provider-owned invalid params errors", async () => {
  const provider: McpRuntimeProvider = {
    resources: {
      async list() {
        return { items: [] };
      },
      async read() {
        return { kind: "not_found" };
      },
    },
    subscriptions: {
      async subscribe(input) {
        if (input.uri === "mock://content/no-session") {
          return { kind: "invalid_params", message: "Resource subscriptions require a live session" };
        }

        return { kind: "success" };
      },
      async unsubscribe() {
        return { kind: "success" };
      },
    },
  };

  const subscribed = await handleMcpJsonRpcMessage(
    {
      jsonrpc: "2.0",
      id: "subscribe",
      method: "resources/subscribe",
      params: { uri: "mock://content/alpha" },
    },
    provider,
  );
  const unsupported = await handleMcpJsonRpcMessage(
    {
      jsonrpc: "2.0",
      id: "unsupported",
      method: "resources/subscribe",
      params: { uri: "mock://content/no-session" },
    },
    provider,
  );

  assert.deepEqual(subscribed, {
    kind: "json",
    status: 200,
    body: {
      jsonrpc: "2.0",
      id: "subscribe",
      result: {},
    },
  });
  assert.deepEqual(unsupported, {
    kind: "json",
    status: 200,
    body: {
      jsonrpc: "2.0",
      id: "unsupported",
      error: {
        code: -32602,
        message: "Resource subscriptions require a live session",
      },
    },
  });
});

test("subscription methods are gated when the provider does not advertise support", async () => {
  const result = await handleMcpJsonRpcMessage(
    {
      jsonrpc: "2.0",
      id: "subscribe",
      method: "resources/subscribe",
      params: { uri: "mock://content/alpha" },
    },
    resourcesOnlyProvider(),
  );

  assert.deepEqual(result, {
    kind: "json",
    status: 200,
    body: {
      jsonrpc: "2.0",
      id: "subscribe",
      error: {
        code: -32601,
        message: "Method not found",
        data: { method: "resources/subscribe" },
      },
    },
  });
});

test("tools/list and tools/call return provider-owned tool results", async () => {
  let observedName: string | undefined;
  let observedArguments: Record<string, unknown> | undefined;
  let observedPrincipal: unknown;

  const provider: McpRuntimeProvider = {
    tools: {
      async list() {
        return {
          items: [
            {
              name: "echo",
              description: "Echo input",
              inputSchema: {
                type: "object",
                properties: { value: { type: "string" } },
              },
            },
          ],
        };
      },
      async call(input) {
        observedName = input.name;
        observedArguments = input.arguments;
        observedPrincipal = input.context.principal;
        return {
          kind: "success",
          content: [{ type: "text", text: String(input.arguments?.value ?? "") }],
          structuredContent: { echoed: input.arguments?.value ?? null },
        };
      },
    },
  };

  const listed = await handleMcpJsonRpcMessage(
    { jsonrpc: "2.0", id: "tools-list", method: "tools/list" },
    provider,
  );
  const called = await handleMcpJsonRpcMessage(
    {
      jsonrpc: "2.0",
      id: "tools-call",
      method: "tools/call",
      params: { name: "echo", arguments: { value: "hello" } },
    },
    provider,
    { context: { principal: { subject: "unit-user" } } },
  );

  assert.equal(observedName, "echo");
  assert.deepEqual(observedArguments, { value: "hello" });
  assert.deepEqual(observedPrincipal, { subject: "unit-user" });
  assert.deepEqual(listed, {
    kind: "json",
    status: 200,
    body: {
      jsonrpc: "2.0",
      id: "tools-list",
      result: {
        tools: [
          {
            name: "echo",
            description: "Echo input",
            inputSchema: {
              type: "object",
              properties: { value: { type: "string" } },
            },
          },
        ],
      },
    },
  });
  assert.deepEqual(called, {
    kind: "json",
    status: 200,
    body: {
      jsonrpc: "2.0",
      id: "tools-call",
      result: {
        content: [{ type: "text", text: "hello" }],
        structuredContent: { echoed: "hello" },
      },
    },
  });
});

test("tools/call preserves tool error and raw provider outcomes", async () => {
  const provider: McpRuntimeProvider = {
    tools: {
      async list() {
        return { items: [] };
      },
      async call(input) {
        if (input.name === "raw") {
          return {
            kind: "raw",
            status: 200,
            body: "{malformed",
            contentType: "application/json",
            headers: { "x-fixture": "raw" },
          };
        }

        return {
          kind: "tool_error",
          content: [{ type: "text", text: "Tool failed by fixture" }],
          structuredContent: { failed: true },
        };
      },
    },
  };

  const toolError = await handleMcpJsonRpcMessage(
    { jsonrpc: "2.0", id: "tool-error", method: "tools/call", params: { name: "fails" } },
    provider,
  );
  const raw = await handleMcpJsonRpcMessage(
    { jsonrpc: "2.0", id: "raw", method: "tools/call", params: { name: "raw" } },
    provider,
  );

  assert.deepEqual(toolError, {
    kind: "json",
    status: 200,
    body: {
      jsonrpc: "2.0",
      id: "tool-error",
      result: {
        content: [{ type: "text", text: "Tool failed by fixture" }],
        structuredContent: { failed: true },
        isError: true,
      },
    },
  });
  assert.deepEqual(raw, {
    kind: "raw",
    status: 200,
    body: "{malformed",
    contentType: "application/json",
    headers: { "x-fixture": "raw" },
  });
});

test("tools/call maps invalid params, not found, forbidden, and protocol provider errors", async () => {
  const provider: McpRuntimeProvider = {
    tools: {
      async list() {
        return { items: [] };
      },
      async call(input) {
        if (input.name === "denied") return { kind: "forbidden", message: "Token lacks tool permission" };
        if (input.name === "bad") return { kind: "invalid_params", message: "Bad tool arguments" };
        if (input.name === "boom") return { kind: "protocol_error", message: "Provider failed" };
        return { kind: "not_found", message: "Tool not found" };
      },
    },
  };

  const malformed = await handleMcpJsonRpcMessage(
    { jsonrpc: "2.0", id: "malformed", method: "tools/call", params: { name: "bad", arguments: [] } },
    provider,
  );
  const missing = await handleMcpJsonRpcMessage(
    { jsonrpc: "2.0", id: "missing", method: "tools/call", params: { name: "missing" } },
    provider,
  );
  const denied = await handleMcpJsonRpcMessage(
    { jsonrpc: "2.0", id: "denied", method: "tools/call", params: { name: "denied" } },
    provider,
  );
  const bad = await handleMcpJsonRpcMessage(
    { jsonrpc: "2.0", id: "bad", method: "tools/call", params: { name: "bad" } },
    provider,
  );
  const protocol = await handleMcpJsonRpcMessage(
    { jsonrpc: "2.0", id: "boom", method: "tools/call", params: { name: "boom" } },
    provider,
  );

  assert.deepEqual(malformed, {
    kind: "json",
    status: 200,
    body: { jsonrpc: "2.0", id: "malformed", error: { code: -32602, message: "Invalid params" } },
  });
  assert.deepEqual(missing, {
    kind: "json",
    status: 200,
    body: {
      jsonrpc: "2.0",
      id: "missing",
      error: { code: -32002, message: "Tool not found", data: { error: "not_found" } },
    },
  });
  assert.deepEqual(denied, {
    kind: "json",
    status: 200,
    body: {
      jsonrpc: "2.0",
      id: "denied",
      error: {
        code: -32003,
        message: "Token lacks tool permission",
        data: { error: "forbidden", message: "Token lacks tool permission" },
      },
    },
  });
  assert.deepEqual(bad, {
    kind: "json",
    status: 200,
    body: { jsonrpc: "2.0", id: "bad", error: { code: -32602, message: "Bad tool arguments" } },
  });
  assert.deepEqual(protocol, {
    kind: "json",
    status: 200,
    body: {
      jsonrpc: "2.0",
      id: "boom",
      error: { code: -32000, message: "Provider failed", data: { error: "protocol_error" } },
    },
  });
});

test("prompts/list and prompts/get delegate argument validation to the provider", async () => {
  const provider: McpRuntimeProvider = {
    prompts: {
      async list() {
        return {
          items: [
            {
              name: "summarize",
              title: "Summarize",
              arguments: [{ name: "topic", required: true }],
            },
          ],
          nextCursor: "next",
        };
      },
      async get(input) {
        if (typeof input.arguments?.topic !== "string") {
          return { kind: "invalid_params", message: "Missing required prompt argument: topic" };
        }

        return {
          kind: "success",
          description: "Prompt fixture",
          messages: [{ role: "user", content: { type: "text", text: `Summarize ${input.arguments.topic}` } }],
        };
      },
    },
  };

  const listed = await handleMcpJsonRpcMessage(
    { jsonrpc: "2.0", id: "prompts-list", method: "prompts/list", params: { limit: 1 } },
    provider,
  );
  const missingArgument = await handleMcpJsonRpcMessage(
    { jsonrpc: "2.0", id: "prompt-bad", method: "prompts/get", params: { name: "summarize", arguments: {} } },
    provider,
  );
  const got = await handleMcpJsonRpcMessage(
    {
      jsonrpc: "2.0",
      id: "prompt-get",
      method: "prompts/get",
      params: { name: "summarize", arguments: { topic: "runtime boundaries" } },
    },
    provider,
  );

  assert.deepEqual(listed, {
    kind: "json",
    status: 200,
    body: {
      jsonrpc: "2.0",
      id: "prompts-list",
      result: {
        prompts: [
          {
            name: "summarize",
            title: "Summarize",
            arguments: [{ name: "topic", required: true }],
          },
        ],
        nextCursor: "next",
      },
    },
  });
  assert.deepEqual(missingArgument, {
    kind: "json",
    status: 200,
    body: {
      jsonrpc: "2.0",
      id: "prompt-bad",
      error: { code: -32602, message: "Missing required prompt argument: topic" },
    },
  });
  assert.deepEqual(got, {
    kind: "json",
    status: 200,
    body: {
      jsonrpc: "2.0",
      id: "prompt-get",
      result: {
        description: "Prompt fixture",
        messages: [{ role: "user", content: { type: "text", text: "Summarize runtime boundaries" } }],
      },
    },
  });
});

test("completion/complete returns provider completions", async () => {
  let observedRef: unknown;

  const provider: McpRuntimeProvider = {
    completion: {
      async complete(input) {
        observedRef = input.ref;
        return {
          kind: "success",
          values: [`${input.argument.value ?? ""}alpha`, `${input.argument.value ?? ""}beta`],
          total: 3,
          hasMore: true,
        };
      },
    },
  };

  const completed = await handleMcpJsonRpcMessage(
    {
      jsonrpc: "2.0",
      id: "complete",
      method: "completion/complete",
      params: {
        ref: { type: "ref/prompt", name: "summarize" },
        argument: { name: "topic", value: "a" },
      },
    },
    provider,
  );

  assert.deepEqual(observedRef, { type: "ref/prompt", name: "summarize" });
  assert.deepEqual(completed, {
    kind: "json",
    status: 200,
    body: {
      jsonrpc: "2.0",
      id: "complete",
      result: {
        completion: {
          values: ["aalpha", "abeta"],
          total: 3,
          hasMore: true,
        },
      },
    },
  });
});

test("optional tools, prompts, and completion methods are method-not-found when absent", async () => {
  const provider = resourcesOnlyProvider();
  const toolList = await handleMcpJsonRpcMessage(
    { jsonrpc: "2.0", id: "tools", method: "tools/list" },
    provider,
  );
  const promptGet = await handleMcpJsonRpcMessage(
    { jsonrpc: "2.0", id: "prompt", method: "prompts/get", params: { name: "missing" } },
    provider,
  );
  const complete = await handleMcpJsonRpcMessage(
    {
      jsonrpc: "2.0",
      id: "complete",
      method: "completion/complete",
      params: { ref: { type: "ref/prompt", name: "x" }, argument: { name: "topic" } },
    },
    provider,
  );

  assert.deepEqual(toolList, {
    kind: "json",
    status: 200,
    body: {
      jsonrpc: "2.0",
      id: "tools",
      error: { code: -32601, message: "Method not found", data: { method: "tools/list" } },
    },
  });
  assert.deepEqual(promptGet, {
    kind: "json",
    status: 200,
    body: {
      jsonrpc: "2.0",
      id: "prompt",
      error: { code: -32601, message: "Method not found", data: { method: "prompts/get" } },
    },
  });
  assert.deepEqual(complete, {
    kind: "json",
    status: 200,
    body: {
      jsonrpc: "2.0",
      id: "complete",
      error: { code: -32601, message: "Method not found", data: { method: "completion/complete" } },
    },
  });
});

test("offset pagination helpers are opt-in and keep provider-owned cursors out of core dispatch", () => {
  assert.deepEqual(paginateMcpItemsByOffset({ items: ["a", "b", "c"], limit: 2 }), {
    items: ["a", "b"],
    nextCursor: "2",
    offset: 0,
    limit: 2,
  });
  assert.deepEqual(paginateMcpItemsByOffset({ items: ["a", "b", "c"], cursor: "2", limit: 2 }), {
    items: ["c"],
    offset: 2,
    limit: 2,
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

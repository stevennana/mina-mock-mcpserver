import assert from "node:assert/strict";
import test from "node:test";
import { handleMcpJsonRpcMessage } from "@minasoft/mcp-runtime";
import type { McpRuntimeProvider } from "@minasoft/mcp-runtime";

test("MCP resource and prompt permission denials map to JSON-RPC forbidden errors", async () => {
  const resourceDenied = await handleMcpJsonRpcMessage(
    { jsonrpc: "2.0", id: "resource", method: "resources/read", params: { uri: "mock://resources/private" } },
    {
      resources: {
        async list() {
          return { items: [] };
        },
        async read(input) {
          return {
            kind: "forbidden",
            message: "Forbidden",
            data: {
              message: "Bearer token does not grant permission for this resource.",
              uri: input.uri,
            },
          };
        },
      },
    },
  );
  assert.deepEqual(resourceDenied, {
    kind: "json",
    status: 200,
    body: {
      jsonrpc: "2.0",
      id: "resource",
      error: {
        code: -32003,
        message: "Forbidden",
        data: {
          error: "forbidden",
          message: "Bearer token does not grant permission for this resource.",
          uri: "mock://resources/private",
        },
      },
    },
  });

  const promptDenied = await handleMcpJsonRpcMessage(
    { jsonrpc: "2.0", id: "prompt", method: "prompts/get", params: { name: "private_prompt", arguments: {} } },
    {
      prompts: {
        async list() {
          return { items: [] };
        },
        async get(input) {
          return {
            kind: "forbidden",
            message: "Forbidden",
            data: {
              message: "Bearer token does not grant permission for this prompt.",
              prompt: input.name,
            },
          };
        },
      },
    },
  );
  assert.deepEqual(promptDenied, {
    kind: "json",
    status: 200,
    body: {
      jsonrpc: "2.0",
      id: "prompt",
      error: {
        code: -32003,
        message: "Forbidden",
        data: {
          error: "forbidden",
          message: "Bearer token does not grant permission for this prompt.",
          prompt: "private_prompt",
        },
      },
    },
  });
});

test("MCP list methods expose cursor pagination", async () => {
  const provider: McpRuntimeProvider = {
    resources: {
      async list(input) {
        const items = Array.from({ length: 101 }, (_, index) => ({
          uri: `mock://resources/${index}`,
          name: `resource_${index}`,
          mimeType: "text/plain",
        }));
        const offset = input.cursor ? Number.parseInt(input.cursor, 10) : 0;
        const page = items.slice(offset, offset + 100);
        return { items: page, ...(offset + page.length < items.length ? { nextCursor: String(offset + page.length) } : {}) };
      },
      async read() {
        return { kind: "not_found" };
      },
    },
    prompts: {
      async list(input) {
        const items = Array.from({ length: 101 }, (_, index) => ({
          name: `prompt_${index}`,
        }));
        const offset = input.cursor ? Number.parseInt(input.cursor, 10) : 0;
        const page = items.slice(offset, offset + 100);
        return { items: page, ...(offset + page.length < items.length ? { nextCursor: String(offset + page.length) } : {}) };
      },
      async get() {
        return { kind: "invalid_params", message: "Invalid prompt" };
      },
    },
  };

  const resources = await handleMcpJsonRpcMessage(
    { jsonrpc: "2.0", id: "resources", method: "resources/list" },
    provider,
  );
  assert.equal(resources.kind, "json");
  if (resources.kind === "json") {
    const body = resources.body as { result: { resources: Array<{ uri: string }>; nextCursor?: string } };
    assert.equal(body.result.resources.length, 100);
    assert.equal(body.result.nextCursor, "100");
  }

  const prompts = await handleMcpJsonRpcMessage(
    { jsonrpc: "2.0", id: "prompts", method: "prompts/list", params: { cursor: "100" } },
    provider,
  );
  assert.equal(prompts.kind, "json");
  if (prompts.kind === "json") {
    const body = prompts.body as { result: { prompts: Array<{ name: string }>; nextCursor?: string } };
    assert.deepEqual(body.result.prompts, [{ name: "prompt_100" }]);
    assert.equal(body.result.nextCursor, undefined);
  }
});

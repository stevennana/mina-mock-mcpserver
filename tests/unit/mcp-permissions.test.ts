import assert from "node:assert/strict";
import test from "node:test";
import { handleMcpJsonRpcMessage } from "@/lib/mcp/protocol";

test("MCP resource and prompt permission denials map to JSON-RPC 403", async () => {
  const resourceDenied = await handleMcpJsonRpcMessage(
    { jsonrpc: "2.0", id: "resource", method: "resources/read", params: { uri: "mock://resources/private" } },
    async () => [],
    undefined,
    {
      loadResources: async () => [],
      loadResourceTemplates: async () => [],
      readResource: async () => ({
        kind: "forbidden",
        message: "Bearer token does not grant permission for this resource.",
      }),
    },
  );
  assert.deepEqual(resourceDenied, {
    kind: "json",
    status: 403,
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
    async () => [],
    undefined,
    {},
    {
      loadPrompts: async () => [],
      getPrompt: async () => ({
        kind: "forbidden",
        message: "Bearer token does not grant permission for this prompt.",
      }),
      complete: async () => null,
    },
  );
  assert.deepEqual(promptDenied, {
    kind: "json",
    status: 403,
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
  const resources = await handleMcpJsonRpcMessage(
    { jsonrpc: "2.0", id: "resources", method: "resources/list" },
    async () => [],
    undefined,
    {
      loadResources: async () =>
        Array.from({ length: 101 }, (_, index) => ({
          uri: `mock://resources/${index}`,
          name: `resource_${index}`,
          mimeType: "text/plain",
        })),
      loadResourceTemplates: async () => [],
      readResource: async () => null,
    },
  );
  assert.equal(resources.kind, "json");
  if (resources.kind === "json" && "result" in resources.body && "resources" in resources.body.result) {
    assert.equal(resources.body.result.resources.length, 100);
    assert.equal(resources.body.result.nextCursor, "100");
  }

  const prompts = await handleMcpJsonRpcMessage(
    { jsonrpc: "2.0", id: "prompts", method: "prompts/list", params: { cursor: "100" } },
    async () => [],
    undefined,
    {},
    {
      loadPrompts: async () =>
        Array.from({ length: 101 }, (_, index) => ({
          name: `prompt_${index}`,
        })),
      getPrompt: async () => null,
      complete: async () => null,
    },
  );
  assert.equal(prompts.kind, "json");
  if (prompts.kind === "json" && "result" in prompts.body && "prompts" in prompts.body.result) {
    assert.deepEqual(prompts.body.result.prompts, [{ name: "prompt_100" }]);
    assert.equal(prompts.body.result.nextCursor, undefined);
  }
});

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

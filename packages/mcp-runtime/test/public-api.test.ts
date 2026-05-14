import assert from "node:assert/strict";
import { test } from "node:test";

import {
  DEFAULT_MCP_PROTOCOL_VERSION,
  SUPPORTED_MCP_PROTOCOL_VERSIONS,
  type McpJsonRpcResponse,
  type McpRuntimeProvider,
} from "@minasoft/mcp-runtime";

test("public API supports a minimal resources-only provider", async () => {
  const provider: McpRuntimeProvider = {
    serverInfo: {
      name: "consumer-fixture",
      version: "0.0.0",
    },
    resources: {
      async list() {
        return {
          items: [
            {
              uri: "mock://content/readme",
              name: "readme",
              title: "Readme",
              mimeType: "text/markdown",
            },
          ],
        };
      },
      async read(input) {
        if (input.uri !== "mock://content/readme") {
          return { kind: "not_found", message: "Unknown resource" };
        }

        return {
          kind: "success",
          contents: [
            {
              uri: input.uri,
              mimeType: "text/markdown",
              text: "# Readme",
            },
          ],
        };
      },
    },
  };

  const listed = await provider.resources.list({ context: { requestId: "test-request" } });
  const read = await provider.resources.read({ uri: listed.items[0].uri, context: {} });
  const response: McpJsonRpcResponse<typeof read> = {
    jsonrpc: "2.0",
    id: "read-1",
    result: read,
  };

  assert.equal(DEFAULT_MCP_PROTOCOL_VERSION, "2025-06-18");
  assert.deepEqual([...SUPPORTED_MCP_PROTOCOL_VERSIONS], ["2025-06-18", "2025-03-26"]);
  assert.equal(listed.items[0].name, "readme");
  assert.equal(response.result.kind, "success");
});

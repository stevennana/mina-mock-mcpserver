import assert from "node:assert/strict";
import { test } from "node:test";

import {
  createMcpFetchHandler,
  DEFAULT_MCP_PROTOCOL_VERSION,
  MCP_PROTOCOL_VERSION_HEADER,
  SUPPORTED_MCP_PROTOCOL_VERSIONS,
  type McpRuntimeProvider,
} from "@minasoft/mcp-runtime";

function jsonRpcRequest(body: unknown) {
  return new Request("https://published-content.example/api/mcp", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      [MCP_PROTOCOL_VERSION_HEADER]: DEFAULT_MCP_PROTOCOL_VERSION,
    },
    body: JSON.stringify(body),
  });
}

test("public API supports a published-content resources fixture through the Fetch helper", async () => {
  const publishedContent = [
    {
      slug: "readme",
      title: "Readme",
      body: "# Readme",
      mimeType: "text/markdown",
    },
  ];
  const provider: McpRuntimeProvider = {
    serverInfo: {
      name: "consumer-fixture",
      version: "0.0.0",
    },
    resources: {
      async list() {
        return {
          items: publishedContent.map((content) => ({
            uri: `published://content/${content.slug}`,
            name: content.slug,
            title: content.title,
            mimeType: content.mimeType,
          })),
        };
      },
      async read(input) {
        const content = publishedContent.find((item) => input.uri === `published://content/${item.slug}`);
        if (!content) {
          return { kind: "not_found", message: "Unknown resource" };
        }

        return {
          kind: "success",
          contents: [
            {
              uri: input.uri,
              mimeType: content.mimeType,
              text: content.body,
            },
          ],
        };
      },
    },
  };
  const handler = createMcpFetchHandler(provider, {
    context(request) {
      return { requestId: request.headers.get("x-request-id") ?? undefined };
    },
  });

  const initialized = await handler(
    jsonRpcRequest({
      jsonrpc: "2.0",
      id: "init",
      method: "initialize",
      params: { protocolVersion: DEFAULT_MCP_PROTOCOL_VERSION },
    }),
  );
  const listed = await handler(jsonRpcRequest({ jsonrpc: "2.0", id: "list", method: "resources/list" }));
  const read = await handler(
    jsonRpcRequest({
      jsonrpc: "2.0",
      id: "read",
      method: "resources/read",
      params: { uri: "published://content/readme" },
    }),
  );

  assert.equal(initialized.status, 200);
  assert.equal(listed.status, 200);
  assert.equal(read.status, 200);
  assert.equal(read.headers.get(MCP_PROTOCOL_VERSION_HEADER), DEFAULT_MCP_PROTOCOL_VERSION);
  assert.equal(DEFAULT_MCP_PROTOCOL_VERSION, "2025-06-18");
  assert.deepEqual([...SUPPORTED_MCP_PROTOCOL_VERSIONS], ["2025-06-18", "2025-03-26"]);
  assert.deepEqual(await initialized.json(), {
    jsonrpc: "2.0",
    id: "init",
    result: {
      protocolVersion: "2025-06-18",
      capabilities: {
        resources: { subscribe: false, listChanged: true },
      },
      serverInfo: {
        name: "consumer-fixture",
        version: "0.0.0",
      },
    },
  });
  assert.deepEqual(await listed.json(), {
    jsonrpc: "2.0",
    id: "list",
    result: {
      resources: [
        {
          uri: "published://content/readme",
          name: "readme",
          title: "Readme",
          mimeType: "text/markdown",
        },
      ],
    },
  });
  assert.deepEqual(await read.json(), {
    jsonrpc: "2.0",
    id: "read",
    result: {
      contents: [
        {
          uri: "published://content/readme",
          mimeType: "text/markdown",
          text: "# Readme",
        },
      ],
    },
  });
});

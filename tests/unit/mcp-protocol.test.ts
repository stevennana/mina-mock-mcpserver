import assert from "node:assert/strict";
import test from "node:test";
import { handleMcpJsonRpcMessage } from "@/lib/mcp/protocol";
import type { McpTool } from "@/lib/mcp/types";

const tools: McpTool[] = [
  {
    name: "echo",
    description: "Echo test tool.",
    inputSchema: {
      type: "object",
      properties: {
        message: {
          type: "string",
          title: "Message",
          description: "Message to echo.",
        },
      },
      required: ["message"],
      additionalProperties: false,
    },
  },
];

test("MCP initialize returns explicit no-auth MVP capabilities", async () => {
  const result = await handleMcpJsonRpcMessage(
    {
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: {
        protocolVersion: "2025-06-18",
        capabilities: {},
        clientInfo: { name: "unit-client", version: "1.0.0" },
      },
    },
    async () => tools,
  );

  assert.equal(result.kind, "json");
  if (result.kind !== "json") return;
  assert.equal(result.status, 200);
  assert.deepEqual(result.body, {
    jsonrpc: "2.0",
    id: 1,
    result: {
      protocolVersion: "2025-06-18",
      capabilities: { tools: { listChanged: false } },
      serverInfo: { name: "mina-mock-mcpserver", version: "1.0.0" },
    },
  });
});

test("MCP initialized notification is accepted without a JSON-RPC body", async () => {
  const result = await handleMcpJsonRpcMessage(
    {
      jsonrpc: "2.0",
      method: "notifications/initialized",
    },
    async () => tools,
  );

  assert.deepEqual(result, { kind: "accepted" });
});

test("MCP tools/list returns loaded tools without executing them", async () => {
  const result = await handleMcpJsonRpcMessage(
    {
      jsonrpc: "2.0",
      id: "list-1",
      method: "tools/list",
    },
    async () => tools,
  );

  assert.equal(result.kind, "json");
  if (result.kind !== "json") return;
  assert.deepEqual(result.body, {
    jsonrpc: "2.0",
    id: "list-1",
    result: { tools },
  });
});

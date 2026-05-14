import assert from "node:assert/strict";
import test from "node:test";
import { mcpToolResultFromEndpointCall, MOCK_MCP_SERVER_INFO } from "@/lib/mcp/runtime-provider";
import { handleMcpJsonRpcMessage } from "@minasoft/mcp-runtime";
import type { EndpointCallResult } from "@/lib/endpoints/runtime";
import type { McpRuntimeProvider, McpTool } from "@minasoft/mcp-runtime";

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

function toolsProvider(call?: (name: string, rawArguments: unknown) => Promise<EndpointCallResult>): McpRuntimeProvider {
  return {
    serverInfo: MOCK_MCP_SERVER_INFO,
    tools: {
      async list() {
        return { items: tools };
      },
      async call(input) {
        if (!call) return { kind: "invalid_params", message: "Invalid params" };
        return mcpToolResultFromEndpointCall(input.name, await call(input.name, input.arguments ?? {}));
      },
    },
  };
}

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
    toolsProvider(),
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
      serverInfo: MOCK_MCP_SERVER_INFO,
    },
  });
});

test("MCP initialized notification is accepted without a JSON-RPC body", async () => {
  const result = await handleMcpJsonRpcMessage(
    {
      jsonrpc: "2.0",
      method: "notifications/initialized",
    },
    toolsProvider(),
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
    toolsProvider(),
  );

  assert.equal(result.kind, "json");
  if (result.kind !== "json") return;
  assert.deepEqual(result.body, {
    jsonrpc: "2.0",
    id: "list-1",
    result: { tools },
  });
});

test("MCP tools/call converts endpoint success to content and structuredContent", async () => {
  const result = await handleMcpJsonRpcMessage(
    {
      jsonrpc: "2.0",
      id: "call-1",
      method: "tools/call",
      params: {
        name: "echo",
        arguments: { message: "hello" },
      },
    },
    toolsProvider(async () => ({
      kind: "matched",
      matchedCase: { id: "case_hello", name: "hello-world", isDefault: false },
      body: { ok: true, message: "world" },
      statusCode: 200,
      delayMs: 0,
    })),
  );

  assert.equal(result.kind, "json");
  if (result.kind !== "json") return;
  assert.deepEqual(result.body, {
    jsonrpc: "2.0",
    id: "call-1",
    result: {
      content: [{ type: "text", text: '{"ok":true,"message":"world"}' }],
      structuredContent: { ok: true, message: "world" },
    },
  });
});

test("MCP tools/call maps unknown tools and invalid params to JSON-RPC invalid params", async () => {
  const unknownTool = await handleMcpJsonRpcMessage(
    {
      jsonrpc: "2.0",
      id: "call-missing",
      method: "tools/call",
      params: { name: "missing", arguments: {} },
    },
    toolsProvider(async () => ({ kind: "not_found" })),
  );

  assert.equal(unknownTool.kind, "json");
  if (unknownTool.kind !== "json") return;
  assert.deepEqual(unknownTool.body, {
    jsonrpc: "2.0",
    id: "call-missing",
    error: { code: -32602, message: "Unknown tool" },
  });

  const invalidParams = await handleMcpJsonRpcMessage(
    {
      jsonrpc: "2.0",
      id: "call-invalid",
      method: "tools/call",
      params: { name: "echo", arguments: [] },
    },
    toolsProvider(async () => ({ kind: "not_found" })),
  );

  assert.equal(invalidParams.kind, "json");
  if (invalidParams.kind !== "json") return;
  assert.deepEqual(invalidParams.body, {
    jsonrpc: "2.0",
    id: "call-invalid",
    error: { code: -32602, message: "Invalid params" },
  });
});

test("MCP tools/call maps forced tool and protocol errors distinctly", async () => {
  const toolError = await handleMcpJsonRpcMessage(
    {
      jsonrpc: "2.0",
      id: "tool-error",
      method: "tools/call",
      params: { name: "echo", arguments: { message: "fail" } },
    },
    toolsProvider(async () => ({
      kind: "case_error",
      matchedCase: { id: "case_fail", name: "forced-tool-error", isDefault: false },
      statusCode: 503,
      body: null,
      message: "Forced tool error.",
      delayMs: 0,
    })),
  );

  assert.equal(toolError.kind, "json");
  if (toolError.kind !== "json") return;
  assert.deepEqual(toolError.body, {
    jsonrpc: "2.0",
    id: "tool-error",
    result: {
      isError: true,
      content: [
        {
          type: "text",
          text: '{"error":"tool_error","message":"Forced tool error.","matchedCase":"forced-tool-error"}',
        },
      ],
      structuredContent: {
        error: "tool_error",
        message: "Forced tool error.",
        matchedCase: "forced-tool-error",
      },
    },
  });

  const protocolError = await handleMcpJsonRpcMessage(
    {
      jsonrpc: "2.0",
      id: "protocol-error",
      method: "tools/call",
      params: { name: "echo", arguments: { message: "fail" } },
    },
    toolsProvider(async () => ({
      kind: "protocol_error",
      matchedCase: { id: "case_protocol", name: "forced-protocol-error", isDefault: false },
      statusCode: 502,
      body: null,
      message: "Forced protocol error.",
      delayMs: 0,
    })),
  );

  assert.equal(protocolError.kind, "json");
  if (protocolError.kind !== "json") return;
  assert.deepEqual(protocolError.body, {
    jsonrpc: "2.0",
    id: "protocol-error",
    error: {
      code: -32000,
      message: "Forced protocol error.",
      data: {
        error: "protocol_error",
        tool: "echo",
        matchedCase: "forced-protocol-error",
      },
    },
  });
});

test("MCP tools/call can intentionally return raw malformed HTTP evidence", async () => {
  const result = await handleMcpJsonRpcMessage(
    {
      jsonrpc: "2.0",
      id: "malformed-call",
      method: "tools/call",
      params: { name: "echo", arguments: { message: "fail" } },
    },
    toolsProvider(async () => ({
      kind: "malformed",
      mode: "invalid_json",
      matchedCase: { id: "case_malformed", name: "malformed-json", isDefault: false },
      statusCode: 200,
      body: '{"error":"intentionally malformed response",',
      contentType: "application/json",
      delayMs: 0,
    })),
  );

  assert.deepEqual(result, {
    kind: "raw",
    status: 200,
    body: '{"error":"intentionally malformed response",',
    contentType: "application/json",
    headers: { "X-MCP-Mock-Matched-Case": "malformed-json" },
  });
});

test("MCP tools/call maps OAuth permission denial to HTTP 403 with error data", async () => {
  const result = await handleMcpJsonRpcMessage(
    {
      jsonrpc: "2.0",
      id: 8,
      method: "tools/call",
      params: { name: "denied-tool", arguments: {} },
    },
    toolsProvider(async () => ({
      kind: "forbidden",
      message: "Bearer token does not grant permission for this endpoint.",
    })),
  );

  assert.equal(result.kind, "json");
  if (result.kind === "json") {
    assert.equal(result.status, 200);
    assert.deepEqual(result.body, {
      jsonrpc: "2.0",
      id: 8,
      error: {
        code: -32003,
        message: "Forbidden",
        data: {
          error: "forbidden",
          message: "Bearer token does not grant permission for this endpoint.",
          tool: "denied-tool",
        },
      },
    });
  }
});

test("MCP unknown methods return JSON-RPC method not found", async () => {
  const result = await handleMcpJsonRpcMessage(
    {
      jsonrpc: "2.0",
      id: "unknown-1",
      method: "tools/unknown",
    },
    toolsProvider(),
  );

  assert.equal(result.kind, "json");
  if (result.kind !== "json") return;
  assert.deepEqual(result.body, {
    jsonrpc: "2.0",
    id: "unknown-1",
    error: { code: -32601, message: "Method not found", data: { method: "tools/unknown" } },
  });
});

import { createServer, type Server } from "node:http";
import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  buildMcpRequest,
  createAuthorizationHeaders,
  inspectMcpTarget,
  parseKeyValueArgs,
  redactHeaders,
} from "../src/index.js";

let server: Server;
let baseUrl = "";
let sseUrl = "";

before(async () => {
  const sseSessions = new Map<string, import("node:http").ServerResponse>();
  server = createServer(async (request, response) => {
    if (request.method === "GET" && request.url === "/sse") {
      const sessionId = "test-session";
      response.writeHead(200, {
        "content-type": "text/event-stream",
        "cache-control": "no-cache",
      });
      response.write(`event: endpoint\ndata: /sse/message?sessionId=${sessionId}\n\n`);
      sseSessions.set(sessionId, response);
      request.on("close", () => sseSessions.delete(sessionId));
      return;
    }
    const chunks: Buffer[] = [];
    for await (const chunk of request) chunks.push(Buffer.from(chunk));
    const body = JSON.parse(Buffer.concat(chunks).toString("utf8")) as { id?: string; method?: string; params?: Record<string, unknown> };
    if (request.url?.startsWith("/sse/message")) {
      const sessionId = new URL(request.url, "http://127.0.0.1").searchParams.get("sessionId") ?? "";
      const stream = sseSessions.get(sessionId);
      response.writeHead(202).end();
      stream?.write(`event: message\ndata: ${JSON.stringify(mcpResponse(body))}\n\n`);
      return;
    }
    response.setHeader("content-type", "application/json");
    response.setHeader("MCP-Protocol-Version", request.headers["mcp-protocol-version"] ?? "2025-06-18");
    response.end(JSON.stringify(mcpResponse(body)));
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Missing server address.");
  baseUrl = `http://127.0.0.1:${address.port}/mcp`;
  sseUrl = `http://127.0.0.1:${address.port}/sse`;
});

after(async () => {
  await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
});

describe("mcp inspector core", () => {
  it("builds JSON-RPC payloads for tools, resources, prompts, completion, and raw", () => {
    assert.equal(buildMcpRequest({ family: "tools", action: "list" }).method, "tools/list");
    assert.deepEqual(buildMcpRequest({ family: "tools", action: "call", name: "echo", args: { message: "hi" } }).params, {
      name: "echo",
      arguments: { message: "hi" },
    });
    assert.equal(buildMcpRequest({ family: "resources", action: "read", uri: "mock://x" }).method, "resources/read");
    assert.equal(buildMcpRequest({ family: "resources", action: "templates" }).method, "resources/templates/list");
    assert.equal(buildMcpRequest({ family: "prompts", action: "get", name: "reply", args: { tone: "brief" } }).method, "prompts/get");
    assert.equal(buildMcpRequest({ family: "completion", action: "prompt", name: "reply", argument: { name: "tone" } }).method, "completion/complete");
    assert.equal(buildMcpRequest({ family: "raw", action: "raw", method: "resources/list" }).method, "resources/list");
  });

  it("parses key-value args and redacts sensitive headers", () => {
    assert.deepEqual(parseKeyValueArgs(["count=2", "enabled=true", "message=hello"]), {
      count: 2,
      enabled: true,
      message: "hello",
    });
    assert.deepEqual(createAuthorizationHeaders({ basic: "user:pass" }), {
      Authorization: "Basic dXNlcjpwYXNz",
    });
    assert.deepEqual(redactHeaders({ Authorization: "Bearer abc", "X-Test": "ok" }), {
      Authorization: "<redacted>",
      "X-Test": "ok",
    });
  });

  it("inspects a Streamable HTTP MCP target", async () => {
    const result = await inspectMcpTarget({ url: baseUrl, method: "tools/list" });
    assert.equal(result.ok, true);
    assert.equal(result.summary.fail, 0);
    assert.equal(result.steps[0]?.name, "MCP initialize");
    assert.equal(result.steps[1]?.name, "MCP tools/list");
  });

  it("inspects a legacy SSE MCP target", async () => {
    const result = await inspectMcpTarget({ url: sseUrl, transport: "sse", method: "tools/list" });
    assert.equal(result.ok, true);
    assert.equal(result.transport, "sse");
    assert.equal(result.steps[1]?.name, "MCP tools/list");
  });

  it("keeps JSON-RPC error envelopes as valid transport evidence", async () => {
    const result = await inspectMcpTarget({ url: baseUrl, method: "unknown/method" });
    assert.equal(result.ok, true);
    assert.equal((result.result as { error?: { code: number } }).error?.code, -32601);
  });
});

function mcpResponse(body: { id?: string; method?: string; params?: Record<string, unknown> }): unknown {
  if (body.method === "initialize") {
    return { jsonrpc: "2.0", id: body.id, result: { protocolVersion: "2025-06-18", capabilities: {} } };
  }
  if (body.method === "tools/list") {
    return { jsonrpc: "2.0", id: body.id, result: { tools: [{ name: "echo" }] } };
  }
  if (body.method === "resources/read") {
    return { jsonrpc: "2.0", id: body.id, result: { contents: [{ uri: body.params?.uri, text: "ok" }] } };
  }
  return { jsonrpc: "2.0", id: body.id, error: { code: -32601, message: "Method not found" } };
}

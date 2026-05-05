import { expect, test } from "@playwright/test";

function basic(username: string, password: string) {
  return `Basic ${Buffer.from(`${username}:${password}`, "utf8").toString("base64")}`;
}

test("Basic Auth MCP strict route and unified precedence fail closed and allow valid callers @basic-auth-mcp", async ({
  request,
}) => {
  const suffix = Date.now();
  const endpointName = `basic_mcp_${suffix}`;
  const username = `mcp_basic_${suffix}`;
  const password = "created-secret";

  const endpointCreate = await request.post("/api/endpoints", {
    data: {
      name: endpointName,
      title: "Basic MCP endpoint",
      description: "Callable through Basic-authenticated MCP routes.",
      enabled: true,
      deleteCode: "87654321",
      defaultResponseJson: "{}",
      failureMode: "none",
      failureDelayMs: 0,
      parameters: [
        {
          name: "message",
          label: "Message",
          description: "Message exact-match key.",
          type: "string",
          required: true,
          defaultValueJson: null,
        },
      ],
      responseCases: [
        {
          name: "default",
          priority: 0,
          matchArgsJson: "{}",
          responseJson: JSON.stringify({ ok: true, source: "basic-default" }),
          statusCode: 200,
          delayMs: 0,
          errorMode: "none",
          isDefault: true,
        },
        {
          name: "hello",
          priority: 10,
          matchArgsJson: JSON.stringify({ message: "hello" }),
          responseJson: JSON.stringify({ ok: true, route: "basic", message: "world" }),
          statusCode: 200,
          delayMs: 0,
          errorMode: "none",
          isDefault: false,
        },
      ],
    },
  });
  expect(endpointCreate.status()).toBe(201);

  const userCreate = await request.post("/api/basic-users", {
    data: { username, password, enabled: true },
  });
  expect(userCreate.status()).toBe(201);

  const strictMissing = await request.post("/mcp/basic", {
    data: { jsonrpc: "2.0", id: "missing", method: "tools/list" },
  });
  expect(strictMissing.status()).toBe(401);
  expect(strictMissing.headers()["www-authenticate"]).toContain("Basic");

  const strictMalformed = await request.post("/mcp/basic", {
    headers: { Authorization: "Basic !!!" },
    data: { jsonrpc: "2.0", id: "malformed", method: "tools/list" },
  });
  expect(strictMalformed.status()).toBe(401);

  const strictInvalid = await request.post("/mcp/basic", {
    headers: { Authorization: basic("default", "wrong") },
    data: { jsonrpc: "2.0", id: "invalid", method: "tools/list" },
  });
  expect(strictInvalid.status()).toBe(401);

  const strictDefaultList = await request.post("/mcp/basic", {
    headers: { Authorization: basic("default", "default") },
    data: { jsonrpc: "2.0", id: "default-list", method: "tools/list" },
  });
  expect(strictDefaultList.status()).toBe(200);
  const defaultListJson = await strictDefaultList.json();
  expect(defaultListJson.result.tools.map((tool: { name: string }) => tool.name)).toContain(endpointName);

  const strictCreatedCall = await request.post("/mcp/basic", {
    headers: { Authorization: basic(username, password) },
    data: {
      jsonrpc: "2.0",
      id: "created-call",
      method: "tools/call",
      params: { name: endpointName, arguments: { message: "hello" } },
    },
  });
  expect(strictCreatedCall.status()).toBe(200);
  expect(await strictCreatedCall.json()).toEqual({
    jsonrpc: "2.0",
    id: "created-call",
    result: {
      content: [{ type: "text", text: '{"ok":true,"route":"basic","message":"world"}' }],
      structuredContent: { ok: true, route: "basic", message: "world" },
    },
  });

  const unifiedInvalid = await request.post("/mcp", {
    headers: { Authorization: basic("default", "wrong") },
    data: { jsonrpc: "2.0", id: "unified-invalid", method: "tools/list" },
  });
  expect(unifiedInvalid.status()).toBe(401);

  const unifiedUnsupported = await request.post("/mcp", {
    headers: { Authorization: "Digest something" },
    data: { jsonrpc: "2.0", id: "unified-unsupported", method: "tools/list" },
  });
  expect(unifiedUnsupported.status()).toBe(401);

  const unifiedCreatedCall = await request.post("/mcp", {
    headers: { Authorization: basic(username, password) },
    data: {
      jsonrpc: "2.0",
      id: "unified-created",
      method: "tools/call",
      params: { name: endpointName, arguments: { message: "hello" } },
    },
  });
  expect(unifiedCreatedCall.status()).toBe(200);
  expect(await unifiedCreatedCall.json()).toEqual({
    jsonrpc: "2.0",
    id: "unified-created",
    result: {
      content: [{ type: "text", text: '{"ok":true,"route":"basic","message":"world"}' }],
      structuredContent: { ok: true, route: "basic", message: "world" },
    },
  });
});

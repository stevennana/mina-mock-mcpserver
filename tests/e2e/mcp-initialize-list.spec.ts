import { expect, test } from "@playwright/test";

test("no-auth MCP initialize, initialized notification, and tools/list use enabled endpoint schemas @mcp-initialize-list", async ({
  request,
}) => {
  const suffix = Date.now();
  const enabledName = `mcp_list_enabled_${suffix}`;
  const disabledName = `mcp_list_disabled_${suffix}`;

  const enabledCreate = await request.post("/api/endpoints", {
    data: {
      name: enabledName,
      title: "MCP list enabled",
      description: "Visible through MCP tools/list.",
      enabled: true,
      deleteCode: "87654321",
      defaultResponseJson: "{}",
      failureMode: "none",
      failureDelayMs: 0,
      parameters: [
        {
          name: "city",
          label: "City",
          description: "City name for generated schema.",
          type: "string",
          required: true,
          defaultValueJson: '"Seoul"',
        },
      ],
      responseCases: [
        {
          name: "default",
          priority: 0,
          matchArgsJson: "{}",
          responseJson: "{}",
          statusCode: 200,
          delayMs: 0,
          errorMode: "none",
          isDefault: true,
        },
      ],
    },
  });
  expect(enabledCreate.status()).toBe(201);

  const disabledCreate = await request.post("/api/endpoints", {
    data: {
      name: disabledName,
      title: "MCP list disabled",
      description: "Hidden from MCP tools/list.",
      enabled: false,
      deleteCode: "87654321",
      defaultResponseJson: "{}",
      failureMode: "none",
      failureDelayMs: 0,
      parameters: [],
      responseCases: [
        {
          name: "default",
          priority: 0,
          matchArgsJson: "{}",
          responseJson: "{}",
          statusCode: 200,
          delayMs: 0,
          errorMode: "none",
          isDefault: true,
        },
      ],
    },
  });
  expect(disabledCreate.status()).toBe(201);

  const initialize = await request.post("/mcp", {
    headers: {
      Accept: "application/json, text/event-stream",
      "MCP-Protocol-Version": "2025-06-18",
    },
    data: {
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: {
        protocolVersion: "2025-06-18",
        capabilities: {},
        clientInfo: { name: "playwright", version: "1.0.0" },
      },
    },
  });
  expect(initialize.status()).toBe(200);
  expect(initialize.headers()["content-type"]).toMatch(/application\/json/);
  expect(initialize.headers()["mcp-protocol-version"]).toBe("2025-06-18");
  expect(initialize.headers()["mcp-session-id"]).toBeUndefined();
  expect(await initialize.json()).toEqual({
    jsonrpc: "2.0",
    id: 1,
    result: {
      protocolVersion: "2025-06-18",
      capabilities: { tools: { listChanged: false } },
      serverInfo: { name: "mina-mock-mcpserver", version: "1.0.0" },
    },
  });

  const initialized = await request.post("/mcp/none", {
    headers: {
      Accept: "application/json, text/event-stream",
      "MCP-Protocol-Version": "2025-06-18",
    },
    data: {
      jsonrpc: "2.0",
      method: "notifications/initialized",
    },
  });
  expect(initialized.status()).toBe(202);
  expect(await initialized.text()).toBe("");

  const listResponse = await request.post("/mcp/none", {
    headers: {
      Accept: "application/json, text/event-stream",
      "MCP-Protocol-Version": "2025-06-18",
    },
    data: {
      jsonrpc: "2.0",
      id: "tools-1",
      method: "tools/list",
    },
  });
  expect(listResponse.status()).toBe(200);
  const listBody = (await listResponse.json()) as {
    result: { tools: Array<{ name: string; description: string; inputSchema: unknown }> };
  };
  const toolNames = listBody.result.tools.map((tool: { name: string }) => tool.name);
  expect(toolNames).toContain(enabledName);
  expect(toolNames).not.toContain(disabledName);

  const enabledTool = listBody.result.tools.find((tool: { name: string }) => tool.name === enabledName);
  expect(enabledTool).toMatchObject({
    name: enabledName,
    description: "Visible through MCP tools/list.",
    inputSchema: {
      type: "object",
      properties: {
        city: {
          type: "string",
          title: "City",
          description: "City name for generated schema.",
          default: "Seoul",
        },
      },
      required: ["city"],
      additionalProperties: false,
    },
  });

  const getResponse = await request.get("/mcp/none");
  expect(getResponse.status()).toBe(405);
  expect(getResponse.headers().allow).toBe("POST, OPTIONS");

  const deleteResponse = await request.delete("/mcp");
  expect(deleteResponse.status()).toBe(405);
  expect(deleteResponse.headers().allow).toBe("POST, OPTIONS");
});

test("MCP HTTP transport rejects unsupported protocol versions and allows browser Inspector CORS @mcp-http-hardening", async ({
  request,
}) => {
  const unsupportedProtocol = await request.post("/mcp/none", {
    headers: {
      Accept: "application/json, text/event-stream",
      "MCP-Protocol-Version": "1900-01-01",
    },
    data: {
      jsonrpc: "2.0",
      id: 1,
      method: "tools/list",
    },
  });
  expect(unsupportedProtocol.status()).toBe(400);
  expect(unsupportedProtocol.headers()["mcp-protocol-version"]).toBe("2025-06-18");
  expect(await unsupportedProtocol.json()).toMatchObject({
    jsonrpc: "2.0",
    id: null,
    error: { code: -32600, message: "Unsupported MCP protocol version." },
  });

  const inspectorPreflight = await request.fetch("/mcp/none", {
    method: "OPTIONS",
    headers: {
      Origin: "http://localhost:6274",
      "Access-Control-Request-Method": "POST",
      "Access-Control-Request-Headers": "content-type,mcp-protocol-version,authorization",
    },
  });
  expect(inspectorPreflight.status()).toBe(204);
  expect(inspectorPreflight.headers()["access-control-allow-origin"]).toBe("*");
  expect(inspectorPreflight.headers()["access-control-allow-methods"]).toContain("POST");
  expect(inspectorPreflight.headers()["access-control-allow-headers"]).toContain("MCP-Protocol-Version");

  const inspectorOrigin = await request.post("/mcp/none", {
    headers: {
      Accept: "application/json, text/event-stream",
      "MCP-Protocol-Version": "2025-06-18",
      Origin: "http://localhost:6274",
    },
    data: {
      jsonrpc: "2.0",
      id: 3,
      method: "tools/list",
    },
  });
  expect(inspectorOrigin.status()).toBe(200);
  expect(inspectorOrigin.headers()["access-control-allow-origin"]).toBe("*");
  expect(inspectorOrigin.headers()["access-control-expose-headers"]).toContain("MCP-Protocol-Version");
});

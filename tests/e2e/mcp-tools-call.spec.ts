import { expect, test } from "@playwright/test";

test("no-auth MCP tools/call executes enabled endpoint cases and deterministic errors @mcp-tools-call", async ({
  request,
}) => {
  const suffix = Date.now();
  const enabledName = `mcp_call_enabled_${suffix}`;
  const disabledName = `mcp_call_disabled_${suffix}`;

  const enabledCreate = await request.post("/api/endpoints", {
    data: {
      name: enabledName,
      title: "MCP call enabled",
      description: "Callable through MCP tools/call.",
      enabled: true,
      deleteCode: "87654321",
      defaultResponseJson: "{}",
      failureMode: "none",
      failureDelayMs: 0,
      parameters: [
        {
          name: "city",
          label: "City",
          description: "City exact-match key.",
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
          responseJson: JSON.stringify({ ok: true, source: "default-case" }),
          statusCode: 200,
          delayMs: 0,
          errorMode: "none",
          isDefault: true,
        },
        {
          name: "seoul",
          priority: 10,
          matchArgsJson: JSON.stringify({ city: "Seoul" }),
          responseJson: JSON.stringify({ ok: true, city: "Seoul", temperature: 22 }),
          statusCode: 200,
          delayMs: 0,
          errorMode: "none",
          isDefault: false,
        },
      ],
    },
  });
  expect(enabledCreate.status()).toBe(201);

  const disabledCreate = await request.post("/api/endpoints", {
    data: {
      name: disabledName,
      title: "MCP call disabled",
      description: "Disabled tool should not be callable.",
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

  const success = await request.post("/mcp/none", {
    data: {
      jsonrpc: "2.0",
      id: "call-success",
      method: "tools/call",
      params: {
        name: enabledName,
        arguments: { city: "Seoul" },
      },
    },
  });
  expect(success.status()).toBe(200);
  expect(await success.json()).toEqual({
    jsonrpc: "2.0",
    id: "call-success",
    result: {
      content: [{ type: "text", text: '{"ok":true,"city":"Seoul","temperature":22}' }],
      structuredContent: { ok: true, city: "Seoul", temperature: 22 },
    },
  });

  const noMatchDefault = await request.post("/mcp/none", {
    data: {
      jsonrpc: "2.0",
      id: "call-default",
      method: "tools/call",
      params: {
        name: enabledName,
        arguments: { city: "Busan" },
      },
    },
  });
  expect(noMatchDefault.status()).toBe(200);
  expect(await noMatchDefault.json()).toEqual({
    jsonrpc: "2.0",
    id: "call-default",
    result: {
      content: [{ type: "text", text: '{"ok":true,"source":"default-case"}' }],
      structuredContent: { ok: true, source: "default-case" },
    },
  });

  const unknownTool = await request.post("/mcp/none", {
    data: {
      jsonrpc: "2.0",
      id: "call-unknown",
      method: "tools/call",
      params: { name: `missing_${suffix}`, arguments: {} },
    },
  });
  expect(unknownTool.status()).toBe(200);
  expect(await unknownTool.json()).toEqual({
    jsonrpc: "2.0",
    id: "call-unknown",
    error: { code: -32602, message: "Unknown tool" },
  });

  const disabledTool = await request.post("/mcp/none", {
    data: {
      jsonrpc: "2.0",
      id: "call-disabled",
      method: "tools/call",
      params: { name: disabledName, arguments: {} },
    },
  });
  expect(disabledTool.status()).toBe(200);
  expect(await disabledTool.json()).toEqual({
    jsonrpc: "2.0",
    id: "call-disabled",
    error: { code: -32602, message: "Unknown tool" },
  });

  const invalidArguments = await request.post("/mcp/none", {
    data: {
      jsonrpc: "2.0",
      id: "call-invalid",
      method: "tools/call",
      params: { name: enabledName, arguments: { city: 123 } },
    },
  });
  expect(invalidArguments.status()).toBe(200);
  expect(await invalidArguments.json()).toEqual({
    jsonrpc: "2.0",
    id: "call-invalid",
    error: { code: -32602, message: 'Argument "city" must be string.' },
  });

  const unknownMethod = await request.post("/mcp/none", {
    data: {
      jsonrpc: "2.0",
      id: "method-unknown",
      method: "tools/nope",
    },
  });
  expect(unknownMethod.status()).toBe(200);
  expect(await unknownMethod.json()).toEqual({
    jsonrpc: "2.0",
    id: "method-unknown",
    error: { code: -32601, message: "Method not found" },
  });
});

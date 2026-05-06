import { expect, test } from "@playwright/test";

function endpointInput(name: string, overrides: Record<string, unknown> = {}) {
  return {
    name,
    title: name,
    description: "Failure simulation E2E fixture.",
    enabled: true,
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
        responseJson: JSON.stringify({ ok: true, name }),
        statusCode: 200,
        delayMs: 0,
        errorMode: "none",
        isDefault: true,
      },
    ],
    ...overrides,
  };
}

test("delay and forced error runtime behavior stays protocol-specific @failure-delay-error", async ({
  page,
  request,
}) => {
  const suffix = Date.now() % 1_000_000;
  const delayedName = `failure_delay_${suffix}`;
  const fastName = `failure_fast_${suffix}`;
  const forcedName = `failure_forced_${suffix}`;

  const delayedCreate = await request.post("/api/endpoints", {
    data: endpointInput(delayedName, {
      failureMode: "delay",
      failureDelayMs: 300,
      responseCases: [
        {
          name: "default",
          priority: 0,
          matchArgsJson: "{}",
          responseJson: JSON.stringify({ ok: true, delayed: true }),
          statusCode: 200,
          delayMs: 0,
          errorMode: "none",
          isDefault: true,
        },
      ],
    }),
  });
  expect(delayedCreate.status()).toBe(201);
  const delayedEndpoint = (await delayedCreate.json()).endpoint as { id: string };

  const fastCreate = await request.post("/api/endpoints", {
    data: endpointInput(fastName),
  });
  expect(fastCreate.status()).toBe(201);

  const forcedCreate = await request.post("/api/endpoints", {
    data: endpointInput(forcedName, {
      parameters: [
        {
          name: "mode",
          label: "Mode",
          description: "Failure mode selector.",
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
          responseJson: JSON.stringify({ ok: true }),
          statusCode: 200,
          delayMs: 0,
          errorMode: "none",
          isDefault: true,
        },
        {
          name: "tool-error",
          priority: 10,
          matchArgsJson: JSON.stringify({ mode: "tool" }),
          responseJson: "{}",
          statusCode: 200,
          delayMs: 25,
          errorMode: "error",
          errorStatusCode: 503,
          errorMessage: "Forced tool outage.",
          errorBodyJson: JSON.stringify({ error: "forced_tool", message: "Forced tool outage." }),
          isDefault: false,
        },
        {
          name: "protocol-error",
          priority: 20,
          matchArgsJson: JSON.stringify({ mode: "protocol" }),
          responseJson: "{}",
          statusCode: 200,
          delayMs: 0,
          errorMode: "protocol_error",
          errorStatusCode: 502,
          errorMessage: "Forced protocol outage.",
          isDefault: false,
        },
      ],
    }),
  });
  expect(forcedCreate.status()).toBe(201);

  const delayedStart = Date.now();
  const delayedRestPromise = request.post(`/rest/tools/${delayedName}/call`, { data: { arguments: {} } });
  const fastRestPromise = request.post(`/rest/tools/${fastName}/call`, { data: { arguments: {} } });
  const fastRest = await fastRestPromise;
  const fastElapsedMs = Date.now() - delayedStart;
  const delayedRest = await delayedRestPromise;
  const delayedElapsedMs = Date.now() - delayedStart;

  expect(fastRest.status()).toBe(200);
  expect(delayedRest.status()).toBe(200);
  expect(fastElapsedMs).toBeLessThan(delayedElapsedMs);
  expect(delayedElapsedMs).toBeGreaterThanOrEqual(240);
  await expect(delayedRest.json()).resolves.toEqual({ ok: true, delayed: true });

  const clientId = `failure-delay-client-${suffix}`;
  const createClientResponse = await request.post("/api/oauth-clients", {
    data: {
      clientId,
      displayName: "Failure Delay E2E",
      enabled: true,
      redirectUris: ["http://localhost:3000/oauth/callback"],
      clientCredentialsTtlSeconds: 900,
      allowedEndpointIds: [delayedEndpoint.id],
    },
  });
  expect(createClientResponse.status()).toBe(201);
  const createdClient = await createClientResponse.json();
  const tokenResponse = await request.post("/oauth/token", {
    form: {
      grant_type: "client_credentials",
      client_id: clientId,
      client_secret: createdClient.clientSecret,
      resource: "https://resource.example/failure-delay",
    },
  });
  expect(tokenResponse.status()).toBe(200);
  const tokenPayload = await tokenResponse.json();

  const oauthDelayedStart = Date.now();
  const oauthDelayedRest = await request.post(`/rest/tools/${delayedName}/call`, {
    headers: { Authorization: `Bearer ${tokenPayload.access_token}` },
    data: { arguments: {} },
  });
  const oauthDelayedElapsedMs = Date.now() - oauthDelayedStart;
  expect(oauthDelayedRest.status()).toBe(200);
  expect(oauthDelayedRest.headers()["x-mcp-mock-principal"]).toBe(`oauth:${clientId}`);
  expect(oauthDelayedElapsedMs).toBeGreaterThanOrEqual(240);
  expect(oauthDelayedElapsedMs).toBeLessThan(550);
  await expect(oauthDelayedRest.json()).resolves.toEqual({ ok: true, delayed: true });

  const delayedMcpStart = Date.now();
  const delayedMcp = await request.post("/mcp/none", {
    data: {
      jsonrpc: "2.0",
      id: "delayed-mcp",
      method: "tools/call",
      params: { name: delayedName, arguments: {} },
    },
  });
  expect(Date.now() - delayedMcpStart).toBeGreaterThanOrEqual(240);
  expect(delayedMcp.status()).toBe(200);
  expect((await delayedMcp.json()).result.structuredContent).toEqual({ ok: true, delayed: true });

  const restToolError = await request.post(`/rest/tools/${forcedName}/call`, {
    data: { arguments: { mode: "tool" } },
  });
  expect(restToolError.status()).toBe(503);
  expect(restToolError.headers()["x-mcp-mock-matched-case"]).toBe("tool-error");
  await expect(restToolError.json()).resolves.toEqual({
    error: "forced_tool",
    message: "Forced tool outage.",
  });

  const mcpToolError = await request.post("/mcp/none", {
    data: {
      jsonrpc: "2.0",
      id: "tool-error",
      method: "tools/call",
      params: { name: forcedName, arguments: { mode: "tool" } },
    },
  });
  expect(mcpToolError.status()).toBe(200);
  expect((await mcpToolError.json()).result).toMatchObject({
    isError: true,
    structuredContent: { error: "forced_tool", message: "Forced tool outage." },
  });

  const restProtocolError = await request.post(`/rest/tools/${forcedName}/call`, {
    data: { arguments: { mode: "protocol" } },
  });
  expect(restProtocolError.status()).toBe(502);
  await expect(restProtocolError.json()).resolves.toEqual({
    error: "protocol_error",
    message: "Forced protocol outage.",
    matchedCase: "protocol-error",
  });

  const mcpProtocolError = await request.post("/mcp/none", {
    data: {
      jsonrpc: "2.0",
      id: "protocol-error",
      method: "tools/call",
      params: { name: forcedName, arguments: { mode: "protocol" } },
    },
  });
  expect(mcpProtocolError.status()).toBe(200);
  await expect(mcpProtocolError.json()).resolves.toEqual({
    jsonrpc: "2.0",
    id: "protocol-error",
    error: {
      code: -32000,
      message: "Forced protocol outage.",
      data: {
        error: "protocol_error",
        tool: forcedName,
        matchedCase: "protocol-error",
      },
    },
  });

  await page.goto("/endpoints");
  await page.getByLabel("Search").fill(delayedName);
  await page.getByRole("link", { name: delayedName }).click();
  await page.getByRole("link", { name: "Failure", exact: true }).click();
  await page.getByRole("button", { name: "Set 30s delay" }).click();
  await expect(page.getByLabel("Failure mode")).toHaveValue("delay");
  await expect(page.getByLabel("Failure delay ms")).toHaveValue("30000");

  const beforeTimeoutSave = await request.get(`/api/endpoints/${delayedEndpoint.id}`);
  expect(beforeTimeoutSave.status()).toBe(200);
  const timeoutPayload = await beforeTimeoutSave.json();
  const timeoutSave = await request.patch(`/api/endpoints/${delayedEndpoint.id}`, {
    data: {
      ...timeoutPayload.endpoint,
      failureMode: "delay",
      failureDelayMs: 30_000,
    },
  });
  expect(timeoutSave.status()).toBe(200);
  const savedPayload = await timeoutSave.json();
  expect(savedPayload.endpoint.failureMode).toBe("delay");
  expect(savedPayload.endpoint.failureDelayMs).toBe(30_000);
});

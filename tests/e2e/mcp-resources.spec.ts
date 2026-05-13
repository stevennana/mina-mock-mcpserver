import { expect, test, type APIRequestContext } from "@playwright/test";

const mcpHeaders = {
  Accept: "application/json, text/event-stream",
  "MCP-Protocol-Version": "2025-06-18",
};

async function postMcp(request: APIRequestContext, path: string, data: unknown, headers: Record<string, string> = {}) {
  return request.post(path, { headers: { ...mcpHeaders, ...headers }, data });
}

test("MCP resources runtime lists and reads direct and templated resources across no-auth, Basic, and legacy SSE @mcp-resources", async ({
  baseURL,
  request,
}) => {
  expect(baseURL).toBeTruthy();
  const suffix = Date.now();
  const resourceUri = `mock://resources/e2e-${suffix}`;
  const disabledUri = `mock://resources/e2e-disabled-${suffix}`;

  const createdResource = await request.post("/api/resources", {
    data: {
      uri: resourceUri,
      name: `e2e_resource_${suffix}`,
      title: "E2E Resource",
      description: "Visible through MCP resources/list.",
      mimeType: "text/plain",
      enabled: true,
      textContent: `resource body ${suffix}`,
      annotationsJson: "{\"audience\":[\"assistant\"]}",
    },
  });
  expect(createdResource.status()).toBe(201);

  const disabledResource = await request.post("/api/resources", {
    data: {
      uri: disabledUri,
      name: `e2e_disabled_${suffix}`,
      title: "E2E Disabled Resource",
      mimeType: "text/plain",
      enabled: false,
      textContent: "hidden",
    },
  });
  expect(disabledResource.status()).toBe(201);

  const initialize = await postMcp(request, "/mcp/none", {
    jsonrpc: "2.0",
    id: "init",
    method: "initialize",
    params: {
      protocolVersion: "2025-06-18",
      capabilities: {},
      clientInfo: { name: "playwright", version: "1.0.0" },
    },
  });
  expect(initialize.status()).toBe(200);
  expect(await initialize.json()).toMatchObject({
    jsonrpc: "2.0",
    id: "init",
    result: {
      capabilities: {
        tools: { listChanged: false },
        resources: { subscribe: true, listChanged: true },
      },
    },
  });

  const resourcesList = await postMcp(request, "/mcp/none", {
    jsonrpc: "2.0",
    id: "resources",
    method: "resources/list",
  });
  expect(resourcesList.status()).toBe(200);
  const resourcesBody = (await resourcesList.json()) as { result: { resources: Array<{ uri: string; name: string }> } };
  expect(resourcesBody.result.resources.map((resource) => resource.uri)).toContain(resourceUri);
  expect(resourcesBody.result.resources.map((resource) => resource.uri)).not.toContain(disabledUri);

  const templatesList = await postMcp(request, "/mcp/basic", {
    jsonrpc: "2.0",
    id: "templates",
    method: "resources/templates/list",
  }, {
    Authorization: `Basic ${Buffer.from("default:default").toString("base64")}`,
  });
  expect(templatesList.status()).toBe(200);
  expect(await templatesList.json()).toMatchObject({
    jsonrpc: "2.0",
    id: "templates",
    result: {
      resourceTemplates: [
        {
          uriTemplate: "mock://resources/customers/{customerId}",
          name: "customer_profile",
          mimeType: "application/json",
        },
      ],
    },
  });

  const directRead = await postMcp(request, "/mcp/none", {
    jsonrpc: "2.0",
    id: "read-direct",
    method: "resources/read",
    params: { uri: resourceUri },
  });
  expect(directRead.status()).toBe(200);
  expect(await directRead.json()).toMatchObject({
    jsonrpc: "2.0",
    id: "read-direct",
    result: {
      contents: [{ uri: resourceUri, mimeType: "text/plain", text: `resource body ${suffix}` }],
    },
  });

  const templateRead = await postMcp(request, "/mcp/basic", {
    jsonrpc: "2.0",
    id: "read-template",
    method: "resources/read",
    params: { uri: "mock://resources/customers/cust_777" },
  }, {
    Authorization: `Basic ${Buffer.from("default:default").toString("base64")}`,
  });
  expect(templateRead.status()).toBe(200);
  expect(await templateRead.json()).toMatchObject({
    jsonrpc: "2.0",
    id: "read-template",
    result: {
      contents: [
        {
          uri: "mock://resources/customers/cust_777",
          mimeType: "application/json",
          text: "{\"customerId\":\"cust_777\",\"tier\":\"demo\"}",
        },
      ],
    },
  });

  const missing = await postMcp(request, "/mcp/none", {
    jsonrpc: "2.0",
    id: "missing",
    method: "resources/read",
    params: { uri: disabledUri },
  });
  expect(missing.status()).toBe(200);
  expect(await missing.json()).toEqual({
    jsonrpc: "2.0",
    id: "missing",
    error: {
      code: -32002,
      message: "Resource not found",
      data: { error: "resource_not_found", uri: disabledUri },
    },
  });

  const invalid = await postMcp(request, "/mcp/none", {
    jsonrpc: "2.0",
    id: "invalid",
    method: "resources/read",
    params: { uri: 123 },
  });
  expect(invalid.status()).toBe(200);
  expect(await invalid.json()).toEqual({
    jsonrpc: "2.0",
    id: "invalid",
    error: { code: -32602, message: "Invalid params" },
  });

  const controller = new AbortController();
  const legacy = await fetch(new URL("/sse/none", baseURL).toString(), {
    headers: { Accept: "text/event-stream" },
    signal: controller.signal,
  });
  expect(legacy.status).toBe(200);
  const reader = legacy.body?.getReader();
  expect(reader).toBeTruthy();
  const decoder = new TextDecoder();
  let opening = "";
  for (let index = 0; index < 8 && !opening.includes("event: endpoint"); index += 1) {
    const chunk = await reader!.read();
    opening += decoder.decode(chunk.value ?? new Uint8Array(), { stream: !chunk.done });
  }
  const endpoint = opening.match(/data: (\/sse\/none\/message\?sessionId=[^\n]+)/)?.[1];
  expect(endpoint).toBeTruthy();

  const posted = await postMcp(request, endpoint!, {
    jsonrpc: "2.0",
    id: "sse-resources",
    method: "resources/list",
  });
  expect(posted.status()).toBe(202);

  let responseEvent = "";
  for (let index = 0; index < 8 && !responseEvent.includes('"id":"sse-resources"'); index += 1) {
    const chunk = await reader!.read();
    responseEvent += decoder.decode(chunk.value ?? new Uint8Array(), { stream: !chunk.done });
  }
  expect(responseEvent).toContain("event: message");
  expect(responseEvent).toContain(resourceUri);
  controller.abort();
});

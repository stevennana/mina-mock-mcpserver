import { expect, test, type APIRequestContext } from "@playwright/test";

const mcpHeaders = {
  Accept: "application/json, text/event-stream",
  "MCP-Protocol-Version": "2025-06-18",
};

async function postMcp(request: APIRequestContext, path: string, data: unknown, headers: Record<string, string> = {}) {
  return request.post(path, { headers: { ...mcpHeaders, ...headers }, data });
}

test("MCP prompts and completion runtime works over Streamable HTTP and legacy SSE @mcp-prompts-completion", async ({
  baseURL,
  request,
}) => {
  expect(baseURL).toBeTruthy();

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
        prompts: { listChanged: true },
        completions: {},
      },
    },
  });

  const promptsList = await postMcp(request, "/mcp/basic", {
    jsonrpc: "2.0",
    id: "prompts",
    method: "prompts/list",
  }, {
    Authorization: `Basic ${Buffer.from("default:default").toString("base64")}`,
  });
  expect(promptsList.status()).toBe(200);
  const promptsBody = (await promptsList.json()) as { result: { prompts: Array<{ name: string; arguments?: Array<{ name: string }> }> } };
  expect(promptsBody.result.prompts.map((prompt) => prompt.name)).toContain("support_reply");
  expect(promptsBody.result.prompts.find((prompt) => prompt.name === "support_reply")?.arguments?.map((argument) => argument.name)).toContain("tone");

  const promptGet = await postMcp(request, "/mcp/none", {
    jsonrpc: "2.0",
    id: "get",
    method: "prompts/get",
    params: { name: "support_reply", arguments: { tone: "friendly" } },
  });
  expect(promptGet.status()).toBe(200);
  const promptGetBody = await promptGet.json();
  expect(promptGetBody).toMatchObject({
    jsonrpc: "2.0",
    id: "get",
    result: {
      messages: [
        { role: "user", content: { type: "text", text: "Write a friendly support reply for the provided mock ticket." } },
        { role: "user", content: { type: "resource", resource: { uri: "mock://resources/server-status", mimeType: "application/json" } } },
      ],
    },
  });
  expect(promptGetBody.result.messages[1].content.resource.text).toContain('"status": "ok"');

  const missingArgs = await postMcp(request, "/mcp/none", {
    jsonrpc: "2.0",
    id: "missing-args",
    method: "prompts/get",
    params: { name: "support_reply", arguments: {} },
  });
  expect(missingArgs.status()).toBe(200);
  expect(await missingArgs.json()).toEqual({
    jsonrpc: "2.0",
    id: "missing-args",
    error: { code: -32602, message: "Invalid prompt" },
  });

  const promptCompletion = await postMcp(request, "/mcp/none", {
    jsonrpc: "2.0",
    id: "complete-prompt",
    method: "completion/complete",
    params: { ref: { type: "ref/prompt", name: "support_reply" }, argument: { name: "tone", value: "fri" } },
  });
  expect(promptCompletion.status()).toBe(200);
  expect(await promptCompletion.json()).toEqual({
    jsonrpc: "2.0",
    id: "complete-prompt",
    result: { completion: { values: ["friendly"], total: 1, hasMore: false } },
  });

  const resourceTemplateCompletion = await postMcp(request, "/mcp/none", {
    jsonrpc: "2.0",
    id: "complete-resource",
    method: "completion/complete",
    params: {
      ref: { type: "ref/resource", uri: "mock://resources/customers/{customerId}" },
      argument: { name: "customerId", value: "cust" },
    },
  });
  expect(resourceTemplateCompletion.status()).toBe(200);
  expect(await resourceTemplateCompletion.json()).toEqual({
    jsonrpc: "2.0",
    id: "complete-resource",
    result: { completion: { values: ["cust_123"], total: 1, hasMore: false } },
  });

  const malformedCompletion = await postMcp(request, "/mcp/none", {
    jsonrpc: "2.0",
    id: "bad-ref",
    method: "completion/complete",
    params: { ref: { type: "ref/resource", name: "wrong" }, argument: { name: "customerId" } },
  });
  expect(malformedCompletion.status()).toBe(200);
  expect(await malformedCompletion.json()).toEqual({
    jsonrpc: "2.0",
    id: "bad-ref",
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
    id: "sse-complete",
    method: "completion/complete",
    params: { ref: { type: "ref/prompt", name: "support_reply" }, argument: { name: "tone", value: "f" } },
  });
  expect(posted.status()).toBe(202);

  let responseEvent = "";
  for (let index = 0; index < 8 && !responseEvent.includes('"id":"sse-complete"'); index += 1) {
    const chunk = await reader!.read();
    responseEvent += decoder.decode(chunk.value ?? new Uint8Array(), { stream: !chunk.done });
  }
  expect(responseEvent).toContain("event: message");
  expect(responseEvent).toContain("friendly");
  controller.abort();
});

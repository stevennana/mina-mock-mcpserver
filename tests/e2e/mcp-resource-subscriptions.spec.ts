import { expect, test, type APIRequestContext } from "@playwright/test";

const mcpHeaders = {
  Accept: "application/json, text/event-stream",
  "MCP-Protocol-Version": "2025-06-18",
};

async function postMcp(request: APIRequestContext, path: string, data: unknown) {
  return request.post(path, { headers: mcpHeaders, data });
}

async function readUntil(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  needle: string,
  timeoutMs = 5_000,
) {
  const decoder = new TextDecoder();
  const deadline = Date.now() + timeoutMs;
  let output = "";
  while (!output.includes(needle)) {
    const remaining = deadline - Date.now();
    if (remaining <= 0) break;
    const read = await Promise.race([
      reader.read(),
      new Promise<ReadableStreamReadResult<Uint8Array>>((resolve) =>
        setTimeout(() => resolve({ done: true, value: undefined }), remaining),
      ),
    ]);
    if (read.done) break;
    output += decoder.decode(read.value, { stream: true });
  }
  return output;
}

test("legacy SSE resource subscriptions and list-change notifications are best-effort observable @mcp-resource-subscriptions", async ({
  baseURL,
  request,
}) => {
  expect(baseURL).toBeTruthy();
  const suffix = Date.now();
  const resourceUri = `mock://resources/subscription-${suffix}`;

  const createdResourceResponse = await request.post("/api/resources", {
    data: {
      uri: resourceUri,
      name: `subscription_resource_${suffix}`,
      title: "Subscription Resource",
      description: "Initial resource for SSE subscription coverage.",
      mimeType: "text/plain",
      enabled: true,
      textContent: "initial body",
    },
  });
  expect(createdResourceResponse.status()).toBe(201);
  const createdResource = (await createdResourceResponse.json()) as {
    resource: {
      id: string;
      uri: string;
      name: string;
      title: string;
      description: string;
      mimeType: string;
      enabled: boolean;
      textContent: string | null;
      blobContentBase64: string | null;
    };
  };

  const controller = new AbortController();
  const legacy = await fetch(new URL("/sse/none", baseURL).toString(), {
    headers: { Accept: "text/event-stream" },
    signal: controller.signal,
  });
  expect(legacy.status).toBe(200);
  const reader = legacy.body?.getReader();
  expect(reader).toBeTruthy();

  const opening = await readUntil(reader!, "event: endpoint");
  const endpoint = opening.match(/data: (\/sse\/none\/message\?sessionId=[^\n]+)/)?.[1];
  expect(endpoint).toBeTruthy();

  const subscribe = await postMcp(request, endpoint!, {
    jsonrpc: "2.0",
    id: "subscribe",
    method: "resources/subscribe",
    params: { uri: resourceUri },
  });
  expect(subscribe.status()).toBe(202);
  const subscribeEvent = await readUntil(reader!, '"id":"subscribe"');
  expect(subscribeEvent).toContain('"result":{}');

  const updatedResource = await request.patch(`/api/resources/${createdResource.resource.id}`, {
    data: {
      ...createdResource.resource,
      textContent: "updated body",
    },
  });
  expect(updatedResource.status()).toBe(200);
  const updateEvent = await readUntil(reader!, "notifications/resources/updated");
  expect(updateEvent).toContain(resourceUri);

  const listResourceResponse = await request.post("/api/resources", {
    data: {
      uri: `mock://resources/list-change-${suffix}`,
      name: `list_change_resource_${suffix}`,
      title: "List Change Resource",
      mimeType: "text/plain",
      enabled: true,
      textContent: "list change body",
    },
  });
  expect(listResourceResponse.status()).toBe(201);
  const resourceListEvent = await readUntil(reader!, "notifications/resources/list_changed");
  expect(resourceListEvent).toContain("notifications/resources/list_changed");

  const promptResponse = await request.post("/api/prompts", {
    data: {
      name: `subscription_prompt_${suffix}`,
      title: "Subscription Prompt",
      description: "Prompt list-change coverage.",
      enabled: true,
      arguments: [],
      messages: [{ role: "user", textTemplate: "Summarize the current mock status." }],
      completionCandidates: [],
    },
  });
  expect(promptResponse.status()).toBe(201);
  const promptListEvent = await readUntil(reader!, "notifications/prompts/list_changed");
  expect(promptListEvent).toContain("notifications/prompts/list_changed");

  controller.abort();
});

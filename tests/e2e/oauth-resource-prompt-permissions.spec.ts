import { expect, test, type APIRequestContext } from "@playwright/test";
import { createPrismaClient } from "@/lib/db/client";

const mcpHeaders = {
  Accept: "application/json, text/event-stream",
  "MCP-Protocol-Version": "2025-06-18",
};

async function postMcp(request: APIRequestContext, data: unknown, token: string) {
  return request.post("/mcp/oauth", {
    headers: { ...mcpHeaders, Authorization: `Bearer ${token}` },
    data,
  });
}

function decodeJwt(token: string) {
  const [, encodedPayload] = token.split(".");
  expect(encodedPayload).toBeTruthy();
  return JSON.parse(Buffer.from(encodedPayload ?? "", "base64url").toString("utf8"));
}

test("OAuth Bearer filters resources and prompts and denies unselected access @oauth-resource-prompt-permissions", async ({
  request,
}) => {
  const suffix = Date.now();
  const prisma = createPrismaClient();
  const allowedResourceId = `mcp_resource_oauth_allowed_${suffix}`;
  const deniedResourceId = `mcp_resource_oauth_denied_${suffix}`;
  const allowedPromptId = `mcp_prompt_oauth_allowed_${suffix}`;
  const deniedPromptId = `mcp_prompt_oauth_denied_${suffix}`;
  const allowedResourceUri = `mock://resources/oauth-allowed-${suffix}`;
  const deniedResourceUri = `mock://resources/oauth-denied-${suffix}`;
  const allowedPromptName = `oauth_allowed_prompt_${suffix}`;
  const deniedPromptName = `oauth_denied_prompt_${suffix}`;

  try {
    await prisma.mcpResource.createMany({
      data: [
        {
          id: allowedResourceId,
          uri: allowedResourceUri,
          name: `oauth-allowed-resource-${suffix}`,
          title: "Allowed OAuth resource",
          mimeType: "text/plain",
          textContent: "allowed resource body",
        },
        {
          id: deniedResourceId,
          uri: deniedResourceUri,
          name: `oauth-denied-resource-${suffix}`,
          title: "Denied OAuth resource",
          mimeType: "text/plain",
          textContent: "denied resource body",
        },
      ],
    });
    await prisma.mcpPrompt.create({
      data: {
        id: allowedPromptId,
        name: allowedPromptName,
        title: "Allowed OAuth prompt",
        messages: {
          create: {
            id: `${allowedPromptId}_message`,
            position: 0,
            role: "user",
            textTemplate: "Allowed prompt body",
          },
        },
      },
    });
    await prisma.mcpPrompt.create({
      data: {
        id: deniedPromptId,
        name: deniedPromptName,
        title: "Denied OAuth prompt",
        messages: {
          create: {
            id: `${deniedPromptId}_message`,
            position: 0,
            role: "user",
            textTemplate: "Denied prompt body",
          },
        },
      },
    });

    const clientResponse = await request.post("/api/oauth-clients", {
      data: {
        clientId: `oauth-rp-${suffix}`,
        displayName: "OAuth Resource Prompt E2E",
        enabled: true,
        redirectUris: ["http://localhost:3000/oauth/callback"],
        clientCredentialsTtlSeconds: 900,
        allowedEndpointIds: ["endpoint_default_echo"],
        allowedResourceIds: [allowedResourceId],
        allowedPromptIds: [allowedPromptId],
      },
    });
    expect(clientResponse.status()).toBe(201);
    const createdClient = await clientResponse.json();

    const tokenResponse = await request.post("/oauth/token", {
      form: {
        grant_type: "client_credentials",
        client_id: createdClient.client.clientId,
        client_secret: createdClient.clientSecret,
        resource: "https://resource.example/oauth-resource-prompt",
      },
    });
    expect(tokenResponse.status()).toBe(200);
    const tokenPayload = await tokenResponse.json();
    const claims = decodeJwt(tokenPayload.access_token);
    expect(claims.resource_permissions).toEqual([allowedResourceId]);
    expect(claims.prompt_permissions).toEqual([allowedPromptId]);

    const invalid = await request.post("/mcp/oauth", {
      headers: { ...mcpHeaders, Authorization: "Bearer invalid-token" },
      data: { jsonrpc: "2.0", id: "invalid", method: "resources/list" },
    });
    expect(invalid.status()).toBe(401);

    const resourcesList = await postMcp(request, { jsonrpc: "2.0", id: "resources", method: "resources/list" }, tokenPayload.access_token);
    expect(resourcesList.status()).toBe(200);
    const resources = (await resourcesList.json()).result.resources as Array<{ uri: string }>;
    expect(resources.map((resource) => resource.uri)).toContain(allowedResourceUri);
    expect(resources.map((resource) => resource.uri)).not.toContain(deniedResourceUri);

    const resourceRead = await postMcp(
      request,
      { jsonrpc: "2.0", id: "read", method: "resources/read", params: { uri: allowedResourceUri } },
      tokenPayload.access_token,
    );
    expect(resourceRead.status()).toBe(200);
    expect(await resourceRead.json()).toMatchObject({
      result: { contents: [{ uri: allowedResourceUri, text: "allowed resource body" }] },
    });

    const resourceDenied = await postMcp(
      request,
      { jsonrpc: "2.0", id: "denied-resource", method: "resources/read", params: { uri: deniedResourceUri } },
      tokenPayload.access_token,
    );
    expect(resourceDenied.status()).toBe(403);
    expect(await resourceDenied.json()).toMatchObject({
      error: { code: -32003, data: { error: "forbidden", uri: deniedResourceUri } },
    });

    const promptsList = await postMcp(request, { jsonrpc: "2.0", id: "prompts", method: "prompts/list" }, tokenPayload.access_token);
    expect(promptsList.status()).toBe(200);
    const prompts = (await promptsList.json()).result.prompts as Array<{ name: string }>;
    expect(prompts.map((prompt) => prompt.name)).toContain(allowedPromptName);
    expect(prompts.map((prompt) => prompt.name)).not.toContain(deniedPromptName);

    const promptGet = await postMcp(
      request,
      { jsonrpc: "2.0", id: "get", method: "prompts/get", params: { name: allowedPromptName, arguments: {} } },
      tokenPayload.access_token,
    );
    expect(promptGet.status()).toBe(200);
    expect(await promptGet.json()).toMatchObject({
      result: { messages: [{ role: "user", content: { type: "text", text: "Allowed prompt body" } }] },
    });

    const promptDenied = await postMcp(
      request,
      { jsonrpc: "2.0", id: "denied-prompt", method: "prompts/get", params: { name: deniedPromptName, arguments: {} } },
      tokenPayload.access_token,
    );
    expect(promptDenied.status()).toBe(403);
    expect(await promptDenied.json()).toMatchObject({
      error: { code: -32003, data: { error: "forbidden", prompt: deniedPromptName } },
    });

    const detailResponse = await request.get(`/api/oauth/tokens/${claims.jti}`);
    expect(detailResponse.status()).toBe(200);
    const detail = await detailResponse.json();
    expect(detail.resource_permissions.map((resource: { id: string }) => resource.id)).toEqual([allowedResourceId]);
    expect(detail.prompt_permissions.map((prompt: { id: string }) => prompt.id)).toEqual([allowedPromptId]);
    expect(JSON.stringify(detail)).not.toContain(tokenPayload.access_token);
  } finally {
    await prisma.$disconnect();
  }
});

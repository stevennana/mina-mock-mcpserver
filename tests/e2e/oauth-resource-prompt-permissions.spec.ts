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
  const embeddedDeniedPromptId = `mcp_prompt_oauth_embedded_denied_${suffix}`;
  const allowedTemplateId = `mcp_resource_template_oauth_allowed_${suffix}`;
  const deniedTemplateId = `mcp_resource_template_oauth_denied_${suffix}`;
  const allowedResourceUri = `mock://resources/oauth-allowed-${suffix}`;
  const deniedResourceUri = `mock://resources/oauth-denied-${suffix}`;
  const allowedTemplateUri = `mock://customers/oauth-allowed-${suffix}/{customerId}`;
  const deniedTemplateUri = `mock://customers/oauth-denied-${suffix}/{customerId}`;
  const renderedAllowedTemplateUri = `mock://customers/oauth-allowed-${suffix}/acme`;
  const renderedDeniedTemplateUri = `mock://customers/oauth-denied-${suffix}/acme`;
  const allowedPromptName = `oauth_allowed_prompt_${suffix}`;
  const deniedPromptName = `oauth_denied_prompt_${suffix}`;
  const embeddedDeniedPromptName = `oauth_embedded_denied_prompt_${suffix}`;

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
    await prisma.mcpPrompt.create({
      data: {
        id: embeddedDeniedPromptId,
        name: embeddedDeniedPromptName,
        title: "Embedded denied resource prompt",
        messages: {
          create: {
            id: `${embeddedDeniedPromptId}_message`,
            position: 0,
            role: "user",
            resourceUri: deniedResourceUri,
          },
        },
      },
    });
    await prisma.mcpResourceTemplate.create({
      data: {
        id: allowedTemplateId,
        uriTemplate: allowedTemplateUri,
        name: `oauth-allowed-template-${suffix}`,
        title: "Allowed OAuth resource template",
        mimeType: "text/plain",
        textTemplate: "customer {customerId} allowed template body",
        arguments: {
          create: {
            id: `${allowedTemplateId}_argument_customer`,
            position: 0,
            name: "customerId",
            description: "Customer ID",
            sampleValueJson: JSON.stringify("acme"),
          },
        },
        completionCandidates: {
          create: {
            id: `${allowedTemplateId}_candidate_customer_acme`,
            ownerType: "resource_template",
            position: 0,
            argumentName: "customerId",
            value: "acme",
            label: "Acme",
          },
        },
      },
    });
    await prisma.mcpResourceTemplate.create({
      data: {
        id: deniedTemplateId,
        uriTemplate: deniedTemplateUri,
        name: `oauth-denied-template-${suffix}`,
        title: "Denied OAuth resource template",
        mimeType: "text/plain",
        textTemplate: "customer {customerId} denied template body",
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
        allowedResourceTemplateIds: [allowedTemplateId],
        allowedPromptIds: [allowedPromptId, embeddedDeniedPromptId],
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
    expect(claims.resource_template_permissions).toEqual([allowedTemplateId]);
    expect(claims.prompt_permissions).toEqual([allowedPromptId, embeddedDeniedPromptId].sort());

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

    const templatesList = await postMcp(
      request,
      { jsonrpc: "2.0", id: "templates", method: "resources/templates/list" },
      tokenPayload.access_token,
    );
    expect(templatesList.status()).toBe(200);
    const templates = (await templatesList.json()).result.resourceTemplates as Array<{ uriTemplate: string }>;
    expect(templates.map((template) => template.uriTemplate)).toContain(allowedTemplateUri);
    expect(templates.map((template) => template.uriTemplate)).not.toContain(deniedTemplateUri);

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

    const renderedTemplateRead = await postMcp(
      request,
      { jsonrpc: "2.0", id: "read-template", method: "resources/read", params: { uri: renderedAllowedTemplateUri } },
      tokenPayload.access_token,
    );
    expect(renderedTemplateRead.status()).toBe(200);
    expect(await renderedTemplateRead.json()).toMatchObject({
      result: { contents: [{ uri: renderedAllowedTemplateUri, text: "customer acme allowed template body" }] },
    });

    const renderedTemplateDenied = await postMcp(
      request,
      { jsonrpc: "2.0", id: "denied-template", method: "resources/read", params: { uri: renderedDeniedTemplateUri } },
      tokenPayload.access_token,
    );
    expect(renderedTemplateDenied.status()).toBe(403);
    expect(await renderedTemplateDenied.json()).toMatchObject({
      error: { code: -32003, data: { error: "forbidden", uri: renderedDeniedTemplateUri } },
    });

    const templateCompletion = await postMcp(
      request,
      {
        jsonrpc: "2.0",
        id: "template-complete",
        method: "completion/complete",
        params: { ref: { type: "ref/resource", uri: allowedTemplateUri }, argument: { name: "customerId", value: "a" } },
      },
      tokenPayload.access_token,
    );
    expect(templateCompletion.status()).toBe(200);
    expect(await templateCompletion.json()).toMatchObject({
      result: { completion: { values: ["acme"], total: 1, hasMore: false } },
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

    const embeddedResourceDenied = await postMcp(
      request,
      { jsonrpc: "2.0", id: "embedded-denied", method: "prompts/get", params: { name: embeddedDeniedPromptName, arguments: {} } },
      tokenPayload.access_token,
    );
    expect(embeddedResourceDenied.status()).toBe(403);
    expect(await embeddedResourceDenied.json()).toMatchObject({
      error: { code: -32003, data: { error: "forbidden", prompt: embeddedDeniedPromptName } },
    });

    const detailResponse = await request.get(`/api/oauth/tokens/${claims.jti}`);
    expect(detailResponse.status()).toBe(200);
    const detail = await detailResponse.json();
    expect(detail.resource_permissions.map((resource: { id: string }) => resource.id)).toEqual([allowedResourceId]);
    expect(detail.resource_template_permissions.map((template: { id: string }) => template.id)).toEqual([allowedTemplateId]);
    expect(detail.prompt_permissions.map((prompt: { id: string }) => prompt.id)).toEqual([allowedPromptId, embeddedDeniedPromptId].sort());
    expect(JSON.stringify(detail)).not.toContain(tokenPayload.access_token);
  } finally {
    await prisma.$disconnect();
  }
});

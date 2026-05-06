import { expect, test } from "@playwright/test";
import { createPrismaClient } from "@/lib/db/client";

test.setTimeout(60_000);

function basic(username: string, password: string) {
  return `Basic ${Buffer.from(`${username}:${password}`, "utf8").toString("base64")}`;
}

function decodeJwt(token: string) {
  const [, encodedPayload] = token.split(".");
  expect(encodedPayload).toBeTruthy();
  return JSON.parse(Buffer.from(encodedPayload ?? "", "base64url").toString("utf8"));
}

test("OAuth Bearer permissions filter MCP and REST and distinguish 401 from 403 @oauth-permissions", async ({
  request,
}) => {
  const suffix = Date.now();
  const allowedEndpointId = `endpoint_oauth_allowed_${suffix}`;
  const deniedEndpointId = `endpoint_oauth_denied_${suffix}`;
  const allowedName = `oauth-allowed-${suffix}`;
  const deniedName = `oauth-denied-${suffix}`;
  const prisma = createPrismaClient();

  try {
    await prisma.endpoint.create({
      data: {
        id: allowedEndpointId,
        name: allowedName,
        title: "OAuth allowed E2E",
        description: "Allowed through Bearer permissions.",
        defaultResponseJson: JSON.stringify({ allowed: true }),
        responseCases: {
          create: {
            id: `${allowedEndpointId}_default`,
            name: "Default",
            responseJson: JSON.stringify({ allowed: true }),
            isDefault: true,
          },
        },
      },
    });
    await prisma.endpoint.create({
      data: {
        id: deniedEndpointId,
        name: deniedName,
        title: "OAuth denied E2E",
        description: "Denied through Bearer permissions.",
        defaultResponseJson: JSON.stringify({ denied: true }),
        responseCases: {
          create: {
            id: `${deniedEndpointId}_default`,
            name: "Default",
            responseJson: JSON.stringify({ denied: true }),
            isDefault: true,
          },
        },
      },
    });

    const clientId = `oauth-permissions-${suffix}`;
    const createClientResponse = await request.post("/api/oauth-clients", {
      data: {
        clientId,
        displayName: "OAuth Permissions E2E",
        enabled: true,
        redirectUris: ["http://localhost:3000/oauth/callback"],
        clientCredentialsTtlSeconds: 900,
        allowedEndpointIds: [allowedEndpointId],
      },
    });
    expect(createClientResponse.status()).toBe(201);
    const createdClient = await createClientResponse.json();

    const tokenResponse = await request.post("/oauth/token", {
      form: {
        grant_type: "client_credentials",
        client_id: clientId,
        client_secret: createdClient.clientSecret,
        resource: "https://resource.example/oauth-permissions",
      },
    });
    expect(tokenResponse.status()).toBe(200);
    const tokenPayload = await tokenResponse.json();
    const bearer = `Bearer ${tokenPayload.access_token}`;

    const strictMissing = await request.post("/mcp/oauth", {
      data: { jsonrpc: "2.0", id: 1, method: "tools/list" },
    });
    expect(strictMissing.status()).toBe(401);
    expect(strictMissing.headers()["www-authenticate"]).toContain("Bearer");
    expect(strictMissing.headers()["www-authenticate"]).toContain("resource_metadata=");

    const invalidUnified = await request.post("/mcp", {
      headers: { Authorization: "Bearer invalid-token" },
      data: { jsonrpc: "2.0", id: 2, method: "tools/list" },
    });
    expect(invalidUnified.status()).toBe(401);
    expect(invalidUnified.headers()["www-authenticate"]).toContain("Bearer");
    expect(invalidUnified.headers()["www-authenticate"]).toContain("resource_metadata=");
    expect(invalidUnified.headers()["www-authenticate"]).toContain('error="invalid_token"');

    const restList = await request.get("/rest/tools", { headers: { Authorization: bearer } });
    expect(restList.status()).toBe(200);
    const restTools = (await restList.json()).tools as Array<{ name: string }>;
    expect(restTools.some((tool) => tool.name === allowedName)).toBe(true);
    expect(restTools.some((tool) => tool.name === deniedName)).toBe(false);

    const mcpList = await request.post("/mcp/oauth", {
      headers: { Authorization: bearer },
      data: { jsonrpc: "2.0", id: 3, method: "tools/list" },
    });
    expect(mcpList.status()).toBe(200);
    const mcpTools = (await mcpList.json()).result.tools as Array<{ name: string }>;
    expect(mcpTools.some((tool) => tool.name === allowedName)).toBe(true);
    expect(mcpTools.some((tool) => tool.name === deniedName)).toBe(false);

    const restAllowed = await request.post(`/rest/tools/${allowedName}/call`, {
      headers: { Authorization: bearer },
      data: { arguments: {} },
    });
    expect(restAllowed.status()).toBe(200);
    expect(restAllowed.headers()["x-mcp-mock-principal"]).toBe(`oauth:${clientId}`);
    expect(await restAllowed.json()).toEqual({ allowed: true });

    const mcpAllowed = await request.post("/mcp/oauth", {
      headers: { Authorization: bearer },
      data: {
        jsonrpc: "2.0",
        id: 4,
        method: "tools/call",
        params: { name: allowedName, arguments: {} },
      },
    });
    expect(mcpAllowed.status()).toBe(200);
    expect((await mcpAllowed.json()).result.structuredContent).toEqual({ allowed: true });

    const restDenied = await request.post(`/rest/tools/${deniedName}/call`, {
      headers: { Authorization: bearer },
      data: { arguments: {} },
    });
    expect(restDenied.status()).toBe(403);
    expect(await restDenied.json()).toMatchObject({
      error: "forbidden",
      tool: deniedName,
    });

    const mcpDenied = await request.post("/mcp/oauth", {
      headers: { Authorization: bearer },
      data: {
        jsonrpc: "2.0",
        id: 5,
        method: "tools/call",
        params: { name: deniedName, arguments: {} },
      },
    });
    expect(mcpDenied.status()).toBe(403);
    expect(await mcpDenied.json()).toMatchObject({
      error: {
        code: -32003,
        message: "Forbidden",
        data: { error: "forbidden", tool: deniedName },
      },
    });

    const noAuthRestList = await request.get("/rest/tools");
    expect(((await noAuthRestList.json()).tools as Array<{ name: string }>).some((tool) => tool.name === deniedName)).toBe(true);
    const basicRestList = await request.get("/rest/tools", { headers: { Authorization: basic("default", "default") } });
    expect(((await basicRestList.json()).tools as Array<{ name: string }>).some((tool) => tool.name === deniedName)).toBe(true);

    const claims = decodeJwt(tokenPayload.access_token);
    await prisma.oAuthIssuedToken.update({
      where: { jti: claims.jti },
      data: { revokedAt: new Date() },
    });
    const revoked = await request.get("/rest/tools", { headers: { Authorization: bearer } });
    expect(revoked.status()).toBe(401);
    expect(revoked.headers()["www-authenticate"]).toContain("resource_metadata=");
    expect(revoked.headers()["www-authenticate"]).toContain('error="invalid_token"');
  } finally {
    await prisma.$disconnect();
  }
});

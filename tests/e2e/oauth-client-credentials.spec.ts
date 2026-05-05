import { expect, test } from "@playwright/test";
import { createPrismaClient } from "@/lib/db/client";

test.setTimeout(60_000);

function decodeJwt(token: string) {
  const [, encodedPayload] = token.split(".");
  expect(encodedPayload).toBeTruthy();
  return JSON.parse(Buffer.from(encodedPayload ?? "", "base64url").toString("utf8"));
}

test("OAuth client_credentials issues tokens with endpoint scope intersection @oauth-client-credentials", async ({
  request,
}) => {
  const clientId = `cc-client-${Date.now()}`;
  const endpointId = `endpoint_cc_${Date.now()}`;
  const prisma = createPrismaClient();
  try {
    await prisma.endpoint.create({
      data: {
        id: endpointId,
        name: `cc-tool-${Date.now()}`,
        title: "Client credentials E2E tool",
        defaultResponseJson: JSON.stringify({ ok: true }),
      },
    });
  } finally {
    await prisma.$disconnect();
  }

  const createResponse = await request.post("/api/oauth-clients", {
    data: {
      clientId,
      displayName: "Client Credentials E2E",
      enabled: true,
      redirectUris: ["http://localhost:3000/oauth/callback"],
      clientCredentialsTtlSeconds: 900,
      allowedEndpointIds: ["endpoint_default_echo", endpointId],
    },
  });
  expect(createResponse.status()).toBe(201);
  const created = await createResponse.json();
  const oauthClientId = created.client.id as string;
  const clientSecret = created.clientSecret as string;

  const narrowedResponse = await request.post("/oauth/token", {
    form: {
      grant_type: "client_credentials",
      client_id: clientId,
      client_secret: clientSecret,
      scope: `endpoint:${endpointId} endpoint:not_allowed profile endpoint:${endpointId}`,
      resource: "https://resource.example/client-credentials",
    },
  });
  expect(narrowedResponse.status()).toBe(200);
  const narrowedPayload = await narrowedResponse.json();
  expect(narrowedPayload.token_type).toBe("Bearer");
  expect(narrowedPayload.expires_in).toBe(900);
  expect(narrowedPayload.scope).toBe(`endpoint:${endpointId}`);
  expect(narrowedPayload.access_token).toMatch(/^eyJ/);

  const claims = decodeJwt(narrowedPayload.access_token);
  expect(claims.client_id).toBe(clientId);
  expect(claims.sub).toBe(`client:${clientId}`);
  expect(claims.grant_type).toBe("client_credentials");
  expect(claims.resource).toBe("https://resource.example/client-credentials");
  expect(claims.endpoint_permissions).toEqual([endpointId]);

  const fullResponse = await request.post("/oauth/token", {
    form: {
      grant_type: "client_credentials",
      client_id: clientId,
      client_secret: clientSecret,
    },
  });
  expect(fullResponse.status()).toBe(200);
  const fullPayload = await fullResponse.json();
  expect(fullPayload.scope).toBe(`endpoint:${endpointId} endpoint:endpoint_default_echo`);
  expect(decodeJwt(fullPayload.access_token).endpoint_permissions).toEqual([endpointId, "endpoint_default_echo"]);

  const invalidSecretResponse = await request.post("/oauth/token", {
    form: {
      grant_type: "client_credentials",
      client_id: clientId,
      client_secret: "wrong",
    },
  });
  expect(invalidSecretResponse.status()).toBe(401);
  expect(await invalidSecretResponse.json()).toMatchObject({
    error: "invalid_client",
    error_description: "OAuth client is invalid.",
  });

  const disableResponse = await request.patch(`/api/oauth-clients/${oauthClientId}`, { data: { enabled: false } });
  expect(disableResponse.status()).toBe(200);
  const disabledResponse = await request.post("/oauth/token", {
    form: {
      grant_type: "client_credentials",
      client_id: clientId,
      client_secret: clientSecret,
    },
  });
  expect(disabledResponse.status()).toBe(401);
  expect(await disabledResponse.json()).toMatchObject({ error: "invalid_client" });
});

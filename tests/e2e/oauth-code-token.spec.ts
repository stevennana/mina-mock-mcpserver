import { expect, test } from "@playwright/test";
import { createPrismaClient } from "@/lib/db/client";

test.setTimeout(60_000);

function decodeJwt(token: string) {
  const [, encodedPayload] = token.split(".");
  expect(encodedPayload).toBeTruthy();
  return JSON.parse(Buffer.from(encodedPayload ?? "", "base64url").toString("utf8"));
}

test("OAuth authorization code exchanges once for endpoint-permission JWT @oauth-code-token", async ({
  page,
  request,
}) => {
  const clientId = `token-client-${Date.now()}`;
  const redirectUri = "http://127.0.0.1:3100/oauth/callback";
  const createResponse = await request.post("/api/oauth-clients", {
    data: {
      clientId,
      displayName: "Token E2E Client",
      enabled: true,
      redirectUris: [redirectUri],
      clientCredentialsTtlSeconds: 3600,
      allowedEndpointIds: ["endpoint_default_echo"],
    },
  });
  expect(createResponse.status()).toBe(201);
  const created = await createResponse.json();
  const oauthClientId = created.client.id as string;
  const clientSecret = created.clientSecret as string;

  const authorizeParams = new URLSearchParams({
    response_type: "code",
    client_id: clientId,
    redirect_uri: redirectUri,
    resource: "https://resource.example/token-e2e",
    state: "state-token-e2e",
  });

  await page.goto(`/oauth/authorize?${authorizeParams.toString()}`);
  await page.getByLabel("Username").fill("default");
  await page.getByLabel("Password").fill("default");
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("button", { name: "Approve selected endpoints" }).click();
  await page.waitForURL(/\/oauth\/callback\?code=.*state=state-token-e2e/);

  const callbackUrl = new URL(page.url());
  const code = callbackUrl.searchParams.get("code") ?? "";
  expect(code).toBeTruthy();

  const tokenResponse = await request.post("/oauth/token", {
    form: {
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri,
      client_id: clientId,
      client_secret: clientSecret,
    },
  });
  expect(tokenResponse.status()).toBe(200);
  const tokenPayload = await tokenResponse.json();
  expect(tokenPayload.token_type).toBe("Bearer");
  expect(tokenPayload.expires_in).toBe(3600);
  expect(tokenPayload.scope).toBe("endpoint:endpoint_default_echo");
  expect(tokenPayload.access_token).toMatch(/^eyJ/);

  const claims = decodeJwt(tokenPayload.access_token);
  expect(claims.iss).toMatch(/^http:\/\/(127\.0\.0\.1|localhost):3100$/);
  expect(claims.aud).toBe("https://resource.example/token-e2e");
  expect(claims.resource).toBe("https://resource.example/token-e2e");
  expect(claims.client_id).toBe(clientId);
  expect(claims.grant_type).toBe("authorization_code");
  expect(claims.scope).toBe("endpoint:endpoint_default_echo");
  expect(claims.endpoint_permissions).toEqual(["endpoint_default_echo"]);
  expect(typeof claims.jti).toBe("string");
  expect(claims.exp).toBeGreaterThan(claims.iat);

  const reuseResponse = await request.post("/oauth/token", {
    form: {
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri,
      client_id: clientId,
      client_secret: clientSecret,
    },
  });
  expect(reuseResponse.status()).toBe(400);
  expect(await reuseResponse.json()).toMatchObject({ error: "invalid_grant" });

  const prisma = createPrismaClient();
  try {
    const storedCode = await prisma.oAuthAuthorizationCode.findUniqueOrThrow({ where: { code } });
    const storedToken = await prisma.oAuthIssuedToken.findUniqueOrThrow({ where: { jti: claims.jti } });
    expect(storedCode.usedAt).not.toBeNull();
    expect(storedToken.oauthClientId).toBe(oauthClientId);
    expect(storedToken.grantType).toBe("authorization_code");
    expect(storedToken.endpointPermissionsJson).toBe(JSON.stringify(["endpoint_default_echo"]));
    expect(storedToken.revokedAt).toBeNull();
  } finally {
    await prisma.$disconnect();
  }

  const deleteResponse = await request.delete(`/api/oauth-clients/${oauthClientId}`);
  expect(deleteResponse.status()).toBe(200);
});

test("OAuth token endpoint rejects invalid authorization_code exchanges @oauth-code-token", async ({ request }) => {
  const redirectUri = "http://localhost:3000/oauth/callback";
  const unsupported = await request.post("/oauth/token", {
    form: {
      grant_type: "client_credentials",
      client_id: "default",
      client_secret: "default",
    },
  });
  expect(unsupported.status()).toBe(400);
  expect(await unsupported.json()).toMatchObject({ error: "unsupported_grant_type" });

  const missing = await request.post("/oauth/token", {
    form: {
      grant_type: "authorization_code",
      code: "",
      redirect_uri: redirectUri,
      client_id: "default",
      client_secret: "default",
    },
  });
  expect(missing.status()).toBe(400);
  expect(await missing.json()).toMatchObject({ error: "invalid_request" });

  const invalid = await request.post("/oauth/token", {
    form: {
      grant_type: "authorization_code",
      code: "not-a-real-code",
      redirect_uri: redirectUri,
      client_id: "default",
      client_secret: "default",
    },
  });
  expect(invalid.status()).toBe(400);
  expect(await invalid.json()).toMatchObject({ error: "invalid_grant" });

  const invalidClient = await request.post("/oauth/token", {
    form: {
      grant_type: "authorization_code",
      code: "not-a-real-code",
      redirect_uri: redirectUri,
      client_id: "default",
      client_secret: "wrong",
    },
  });
  expect(invalidClient.status()).toBe(400);
  expect(await invalidClient.json()).toMatchObject({ error: "invalid_grant" });
});

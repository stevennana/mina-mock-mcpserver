import { expect, test } from "@playwright/test";
import { createHash } from "node:crypto";
import { createPrismaClient } from "@/lib/db/client";

test.setTimeout(60_000);

function decodeJwt(token: string) {
  const [, encodedPayload] = token.split(".");
  expect(encodedPayload).toBeTruthy();
  return JSON.parse(Buffer.from(encodedPayload ?? "", "base64url").toString("utf8"));
}

function pkceChallenge(verifier: string) {
  return createHash("sha256").update(verifier).digest("base64url");
}

test("OAuth authorization code exchanges once for endpoint-permission JWT @oauth-code-token", async ({
  page,
  request,
}, testInfo) => {
  const baseURL = testInfo.project.use.baseURL as string;
  const clientId = `token-client-${Date.now()}`;
  const redirectUri = new URL("/oauth/callback", baseURL).toString();
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
  await page.getByRole("button", { name: "Approve selected permissions" }).click();
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
  expect(claims.iss).toBe(baseURL);
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
      grant_type: "password",
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

test("OAuth authorization code supports PKCE S256 and standard revocation @oauth-code-token", async ({
  page,
  request,
}, testInfo) => {
  const baseURL = testInfo.project.use.baseURL as string;
  const clientId = `pkce-client-${Date.now()}`;
  const redirectUri = new URL("/oauth/callback", baseURL).toString();
  const codeVerifier = "pkce-verifier-abcdefghijklmnopqrstuvwxyz-0123456789";
  const createResponse = await request.post("/api/oauth-clients", {
    data: {
      clientId,
      displayName: "PKCE Client",
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
    resource: baseURL,
    state: "state-pkce",
    code_challenge: pkceChallenge(codeVerifier),
    code_challenge_method: "S256",
  });

  await page.goto(`/oauth/authorize?${authorizeParams.toString()}`);
  await page.getByLabel("Username").fill("default");
  await page.getByLabel("Password").fill("default");
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("button", { name: "Approve selected permissions" }).click();
  await page.waitForURL(/\/oauth\/callback\?code=.*state=state-pkce/);

  const code = new URL(page.url()).searchParams.get("code") ?? "";
  expect(code).toBeTruthy();

  const missingVerifier = await request.post("/oauth/token", {
    form: {
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri,
      client_id: clientId,
      client_secret: clientSecret,
    },
  });
  expect(missingVerifier.status()).toBe(400);
  expect(await missingVerifier.json()).toMatchObject({ error: "invalid_request" });

  const tokenResponse = await request.post("/oauth/token", {
    form: {
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri,
      client_id: clientId,
      client_secret: clientSecret,
      code_verifier: codeVerifier,
    },
  });
  expect(tokenResponse.status()).toBe(200);
  expect(tokenResponse.headers()["access-control-allow-origin"]).toBe("*");
  const tokenPayload = await tokenResponse.json();
  const claims = decodeJwt(tokenPayload.access_token);
  expect(claims.grant_type).toBe("authorization_code");

  const revokeResponse = await request.post("/oauth/revoke", {
    form: {
      token: tokenPayload.access_token,
      client_id: clientId,
      client_secret: clientSecret,
    },
  });
  expect(revokeResponse.status()).toBe(200);
  expect(revokeResponse.headers()["access-control-allow-origin"]).toBe("*");

  const prisma = createPrismaClient();
  try {
    const storedCode = await prisma.oAuthAuthorizationCode.findUniqueOrThrow({ where: { code } });
    const storedToken = await prisma.oAuthIssuedToken.findUniqueOrThrow({ where: { jti: claims.jti } });
    expect(storedCode.codeChallengeMethod).toBe("S256");
    expect(storedToken.revokedAt).not.toBeNull();
  } finally {
    await prisma.$disconnect();
  }

  const deleteResponse = await request.delete(`/api/oauth-clients/${oauthClientId}`);
  expect(deleteResponse.status()).toBe(200);
});

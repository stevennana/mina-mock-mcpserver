import assert from "node:assert/strict";
import { createPublicKey, createVerify } from "node:crypto";
import { execFile } from "node:child_process";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import test from "node:test";
import { createPrismaClient } from "@/lib/db/client";
import { seedAllDefaults } from "@/lib/db/seed";
import { createOAuthAuthorizationCode, exchangeOAuthAuthorizationCode, loginOAuthUserForConsent } from "@/lib/oauth/service";
import { DEFAULT_OAUTH_CLIENT_REDIRECT_URI, DEFAULT_OAUTH_PRIVATE_KEY_PEM, OAuthTokenError } from "@/lib/oauth/types";

const execFileAsync = promisify(execFile);

async function withIsolatedDb(fn: (client: ReturnType<typeof createPrismaClient>) => Promise<void>) {
  const directory = await mkdtemp(join(tmpdir(), "mcp-mock-oauth-token-"));
  const previousDatabaseUrl = process.env.DATABASE_URL;
  process.env.DATABASE_URL = `file:${join(directory, "runtime.sqlite")}`;

  await execFileAsync("npx", ["prisma", "migrate", "deploy"], { env: { ...process.env } });

  const client = createPrismaClient();
  try {
    await seedAllDefaults(client);
    await fn(client);
  } finally {
    await client.$disconnect();
    if (previousDatabaseUrl === undefined) {
      delete process.env.DATABASE_URL;
    } else {
      process.env.DATABASE_URL = previousDatabaseUrl;
    }
  }
}

function defaultAuthorizeRequest(overrides: Record<string, string> = {}) {
  return {
    response_type: "code",
    client_id: "default",
    redirect_uri: DEFAULT_OAUTH_CLIENT_REDIRECT_URI,
    resource: "https://resource.example/mcp",
    state: "state-123",
    ...overrides,
  };
}

function decodeJwt(token: string) {
  const [encodedHeader, encodedPayload, signature] = token.split(".");
  assert.ok(encodedHeader);
  assert.ok(encodedPayload);
  assert.ok(signature);
  return {
    header: JSON.parse(Buffer.from(encodedHeader, "base64url").toString("utf8")),
    payload: JSON.parse(Buffer.from(encodedPayload, "base64url").toString("utf8")),
    signingInput: `${encodedHeader}.${encodedPayload}`,
    signature,
  };
}

test("authorization_code exchange issues RS256 JWT claims and stores token metadata", async () => {
  await withIsolatedDb(async (client) => {
    const login = await loginOAuthUserForConsent(
      { authorizeRequest: defaultAuthorizeRequest(), username: "default", password: "default" },
      client,
    );
    const code = await createOAuthAuthorizationCode(
      {
        authorizeRequest: defaultAuthorizeRequest(),
        loginTicket: login.loginTicket,
        selectedEndpointIds: ["endpoint_default_echo"],
      },
      client,
    );

    const result = await exchangeOAuthAuthorizationCode(
      {
        grantType: "authorization_code",
        code: code.code,
        redirectUri: DEFAULT_OAUTH_CLIENT_REDIRECT_URI,
        clientId: "default",
        clientSecret: "default",
        issuer: "https://issuer.example",
        now: new Date("2026-05-05T00:00:00.000Z"),
      },
      client,
    );
    const decoded = decodeJwt(result.access_token);
    const publicKey = createPublicKey(DEFAULT_OAUTH_PRIVATE_KEY_PEM).export({ type: "spki", format: "pem" });
    const verified = createVerify("RSA-SHA256")
      .update(decoded.signingInput)
      .end()
      .verify(publicKey, decoded.signature, "base64url");

    assert.equal(verified, true);
    assert.equal(decoded.header.alg, "RS256");
    assert.equal(result.token_type, "Bearer");
    assert.equal(result.expires_in, 3600);
    assert.equal(result.scope, "endpoint:endpoint_default_echo");
    assert.equal(decoded.payload.iss, "https://issuer.example");
    assert.equal(decoded.payload.aud, "https://resource.example/mcp");
    assert.equal(decoded.payload.resource, "https://resource.example/mcp");
    assert.equal(decoded.payload.sub, login.user.id);
    assert.equal(decoded.payload.client_id, "default");
    assert.equal(decoded.payload.grant_type, "authorization_code");
    assert.equal(decoded.payload.iat, 1777939200);
    assert.equal(decoded.payload.exp, 1777942800);
    assert.deepEqual(decoded.payload.endpoint_permissions, ["endpoint_default_echo"]);

    const storedCode = await client.oAuthAuthorizationCode.findUniqueOrThrow({ where: { code: code.code } });
    const storedToken = await client.oAuthIssuedToken.findUniqueOrThrow({ where: { jti: decoded.payload.jti } });
    assert.ok(storedCode.usedAt);
    assert.equal(storedToken.oauthClientId, login.client.id);
    assert.equal(storedToken.oauthUserId, login.user.id);
    assert.equal(storedToken.grantType, "authorization_code");
    assert.equal(storedToken.scope, "endpoint:endpoint_default_echo");
    assert.equal(storedToken.resource, "https://resource.example/mcp");
    assert.equal(storedToken.endpointPermissionsJson, JSON.stringify(["endpoint_default_echo"]));
    assert.equal(storedToken.revokedAt, null);
  });
});

test("authorization_code exchange rejects reuse, redirect mismatch, expired code, invalid client, and unsupported grants", async () => {
  await withIsolatedDb(async (client) => {
    const login = await loginOAuthUserForConsent(
      { authorizeRequest: defaultAuthorizeRequest(), username: "default", password: "default" },
      client,
    );
    const makeCode = async () =>
      createOAuthAuthorizationCode(
        {
          authorizeRequest: defaultAuthorizeRequest(),
          loginTicket: login.loginTicket,
          selectedEndpointIds: ["endpoint_default_echo"],
        },
        client,
      );

    const code = await makeCode();
    await exchangeOAuthAuthorizationCode(
      {
        grantType: "authorization_code",
        code: code.code,
        redirectUri: DEFAULT_OAUTH_CLIENT_REDIRECT_URI,
        clientId: "default",
        clientSecret: "default",
      },
      client,
    );
    await assert.rejects(
      () =>
        exchangeOAuthAuthorizationCode(
          {
            grantType: "authorization_code",
            code: code.code,
            redirectUri: DEFAULT_OAUTH_CLIENT_REDIRECT_URI,
            clientId: "default",
            clientSecret: "default",
          },
          client,
        ),
      (error: unknown) => error instanceof OAuthTokenError && error.code === "invalid_grant",
    );

    const mismatchCode = await makeCode();
    await assert.rejects(
      () =>
        exchangeOAuthAuthorizationCode(
          {
            grantType: "authorization_code",
            code: mismatchCode.code,
            redirectUri: "http://localhost:3000/wrong",
            clientId: "default",
            clientSecret: "default",
          },
          client,
        ),
      (error: unknown) => error instanceof OAuthTokenError && error.code === "invalid_grant",
    );

    const invalidClientCode = await makeCode();
    await assert.rejects(
      () =>
        exchangeOAuthAuthorizationCode(
          {
            grantType: "authorization_code",
            code: invalidClientCode.code,
            redirectUri: DEFAULT_OAUTH_CLIENT_REDIRECT_URI,
            clientId: "default",
            clientSecret: "wrong",
          },
          client,
        ),
      (error: unknown) => error instanceof OAuthTokenError && error.code === "invalid_client" && error.status === 401,
    );

    const expiredCode = await makeCode();
    await client.oAuthAuthorizationCode.update({
      where: { code: expiredCode.code },
      data: { expiresAt: new Date("2026-05-05T00:00:00.000Z") },
    });
    await assert.rejects(
      () =>
        exchangeOAuthAuthorizationCode(
          {
            grantType: "authorization_code",
            code: expiredCode.code,
            redirectUri: DEFAULT_OAUTH_CLIENT_REDIRECT_URI,
            clientId: "default",
            clientSecret: "default",
            now: new Date("2026-05-05T00:00:01.000Z"),
          },
          client,
        ),
      (error: unknown) => error instanceof OAuthTokenError && error.code === "invalid_grant",
    );

    await assert.rejects(
      () =>
        exchangeOAuthAuthorizationCode(
          {
            grantType: "client_credentials",
            code: "unused",
            redirectUri: DEFAULT_OAUTH_CLIENT_REDIRECT_URI,
            clientId: "default",
            clientSecret: "default",
          },
          client,
        ),
      (error: unknown) => error instanceof OAuthTokenError && error.code === "unsupported_grant_type",
    );
  });
});

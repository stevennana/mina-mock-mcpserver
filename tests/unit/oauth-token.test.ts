import assert from "node:assert/strict";
import { createPublicKey, createVerify } from "node:crypto";
import { execFile } from "node:child_process";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import test from "node:test";
import { parseBearerAuthorizationHeader, resolveOAuthBearerAuthorizationHeader } from "@/lib/auth/oauth";
import { createPrismaClient } from "@/lib/db/client";
import { seedAllDefaults } from "@/lib/db/seed";
import {
  createOAuthAuthorizationCode,
  createOAuthClient,
  exchangeOAuthAuthorizationCode,
  exchangeOAuthToken,
  getOAuthIssuedTokenDetail,
  issueOAuthClientCredentialsToken,
  listOAuthIssuedTokens,
  loginOAuthUserForConsent,
  revokeOAuthIssuedToken,
} from "@/lib/oauth/service";
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
    assert.equal(storedToken.issuer, "https://issuer.example");
    assert.equal(storedToken.resource, "https://resource.example/mcp");
    assert.equal(storedToken.endpointPermissionsJson, JSON.stringify(["endpoint_default_echo"]));
    assert.equal(storedToken.revokedAt, null);
  });
});

test("Bearer token resolver verifies signature, issuer, audience, expiry, revocation, and permissions", async () => {
  await withIsolatedDb(async (client) => {
    assert.deepEqual(parseBearerAuthorizationHeader(null), { kind: "missing" });
    assert.deepEqual(parseBearerAuthorizationHeader("Bearer"), { kind: "invalid", reason: "malformed" });
    assert.deepEqual(parseBearerAuthorizationHeader("Basic abc"), { kind: "unsupported", scheme: "Basic" });

    const issued = await issueOAuthClientCredentialsToken(
      {
        grantType: "client_credentials",
        clientId: "default",
        clientSecret: "default",
        resource: "https://resource.example/runtime",
        issuer: "https://issuer.example",
        now: new Date("2026-05-05T00:00:00.000Z"),
        code: "",
        redirectUri: "",
      },
      client,
    );

    const valid = await resolveOAuthBearerAuthorizationHeader(
      `Bearer ${issued.access_token}`,
      "https://issuer.example/mcp/oauth",
      client,
      new Date("2026-05-05T00:10:00.000Z"),
    );
    assert.equal(valid.kind, "authenticated");
    assert.deepEqual(valid.kind === "authenticated" ? valid.principal.endpointIds : [], ["endpoint_default_echo"]);

    assert.equal(
      (
        await resolveOAuthBearerAuthorizationHeader(
          `Bearer ${issued.access_token}`,
          "https://wrong-issuer.example/mcp/oauth",
          client,
          new Date("2026-05-05T00:10:00.000Z"),
        )
      ).kind,
      "unauthorized",
    );
    assert.equal(
      (
        await resolveOAuthBearerAuthorizationHeader(
          `Bearer ${issued.access_token}`,
          "https://issuer.example/mcp/oauth",
          client,
          new Date("2026-05-05T02:00:00.000Z"),
        )
      ).kind,
      "unauthorized",
    );

    const claims = decodeJwt(issued.access_token).payload;
    await client.oAuthIssuedToken.update({
      where: { jti: claims.jti },
      data: { revokedAt: new Date("2026-05-05T00:20:00.000Z") },
    });
    assert.equal(
      (
        await resolveOAuthBearerAuthorizationHeader(
          `Bearer ${issued.access_token}`,
          "https://issuer.example/mcp/oauth",
          client,
          new Date("2026-05-05T00:30:00.000Z"),
        )
      ).kind,
      "unauthorized",
    );
  });
});

test("issued token listing, detail, filters, and revoke use stored jti metadata", async () => {
  await withIsolatedDb(async (client) => {
    const issued = await issueOAuthClientCredentialsToken(
      {
        grantType: "client_credentials",
        clientId: "default",
        clientSecret: "default",
        resource: "https://resource.example/token-ui",
        issuer: "https://issuer.example",
        now: new Date("2026-05-05T00:00:00.000Z"),
        code: "",
        redirectUri: "",
      },
      client,
    );
    const claims = decodeJwt(issued.access_token).payload;

    const activeList = await listOAuthIssuedTokens(
      { status: "active", subject: "client:default", client: "default", grantType: "client_credentials" },
      client,
      new Date("2026-05-05T00:10:00.000Z"),
    );
    assert.equal(activeList.active, 1);
    assert.equal(activeList.tokens.length, 1);
    assert.equal(activeList.tokens[0]?.jti, claims.jti);
    assert.equal(activeList.tokens[0]?.endpointPermissionCount, 1);

    const detail = await getOAuthIssuedTokenDetail(claims.jti, client, new Date("2026-05-05T00:10:00.000Z"));
    assert.equal(detail.status, "active");
    assert.equal(detail.subject, "client:default");
    assert.equal(detail.claims.iss, claims.iss);
    assert.equal(detail.claims.iss, "https://issuer.example");
    assert.equal(detail.claims.jti, claims.jti);
    assert.equal(detail.claims.client_id, "default");
    assert.deepEqual(detail.claims.endpoint_permissions, ["endpoint_default_echo"]);
    assert.deepEqual(
      detail.endpoint_permissions.map((endpoint) => endpoint.id),
      ["endpoint_default_echo"],
    );
    assert.equal(JSON.stringify(detail).includes(issued.access_token), false);

    const revoked = await revokeOAuthIssuedToken(
      claims.jti,
      client,
      new Date("2026-05-05T00:20:00.000Z"),
    );
    assert.equal(revoked.status, "revoked");
    assert.equal(revoked.revokedAt, "2026-05-05T00:20:00.000Z");

    const revokedList = await listOAuthIssuedTokens({ status: "revoked" }, client, new Date("2026-05-05T00:30:00.000Z"));
    assert.equal(revokedList.revoked, 1);
    assert.equal(revokedList.tokens.length, 1);

    const expiringIssued = await issueOAuthClientCredentialsToken(
      {
        grantType: "client_credentials",
        clientId: "default",
        clientSecret: "default",
        resource: "https://resource.example/token-ui-expired",
        issuer: "https://issuer.example",
        now: new Date("2026-05-05T00:00:00.000Z"),
        code: "",
        redirectUri: "",
      },
      client,
    );
    const expiringClaims = decodeJwt(expiringIssued.access_token).payload;
    const expiredList = await listOAuthIssuedTokens({ status: "expired" }, client, new Date("2026-05-05T02:00:00.000Z"));
    assert.equal(expiredList.expired, 1);
    assert.equal(expiredList.tokens.length, 1);
    assert.equal(expiredList.tokens[0]?.jti, expiringClaims.jti);

    const afterRevoke = await resolveOAuthBearerAuthorizationHeader(
      `Bearer ${issued.access_token}`,
      "https://issuer.example/mcp/oauth",
      client,
      new Date("2026-05-05T00:30:00.000Z"),
    );
    assert.equal(afterRevoke.kind, "unauthorized");
  });
});

test("client_credentials exchange issues client-subject JWT with scoped endpoint intersection", async () => {
  await withIsolatedDb(async (client) => {
    await client.endpoint.create({
      data: {
        id: "endpoint_client_extra",
        name: "client-extra",
        title: "Client Extra",
        defaultResponseJson: JSON.stringify({ ok: true }),
      },
    });
    const created = await createOAuthClient(
      {
        clientId: "machine-client",
        displayName: "Machine Client",
        enabled: true,
        redirectUris: ["http://localhost:3000/callback"],
        clientCredentialsTtlSeconds: 900,
        allowedEndpointIds: ["endpoint_default_echo", "endpoint_client_extra"],
      },
      client,
    );

    const narrowed = await issueOAuthClientCredentialsToken(
      {
        grantType: "client_credentials",
        clientId: "machine-client",
        clientSecret: created.clientSecret,
        scope: "endpoint:endpoint_client_extra endpoint:missing profile endpoint:endpoint_client_extra",
        resource: "https://resource.example/machine",
        issuer: "https://issuer.example",
        now: new Date("2026-05-05T00:00:00.000Z"),
        code: "",
        redirectUri: "",
      },
      client,
    );
    const narrowedClaims = decodeJwt(narrowed.access_token).payload;

    assert.equal(narrowed.token_type, "Bearer");
    assert.equal(narrowed.expires_in, 900);
    assert.equal(narrowed.scope, "endpoint:endpoint_client_extra");
    assert.equal(narrowedClaims.iss, "https://issuer.example");
    assert.equal(narrowedClaims.aud, "https://resource.example/machine");
    assert.equal(narrowedClaims.resource, "https://resource.example/machine");
    assert.equal(narrowedClaims.sub, "client:machine-client");
    assert.equal(narrowedClaims.client_id, "machine-client");
    assert.equal(narrowedClaims.grant_type, "client_credentials");
    assert.deepEqual(narrowedClaims.endpoint_permissions, ["endpoint_client_extra"]);

    const storedNarrowed = await client.oAuthIssuedToken.findUniqueOrThrow({ where: { jti: narrowedClaims.jti } });
    assert.equal(storedNarrowed.oauthClientId, created.client.id);
    assert.equal(storedNarrowed.oauthUserId, null);
    assert.equal(storedNarrowed.grantType, "client_credentials");
    assert.equal(storedNarrowed.scope, "endpoint:endpoint_client_extra");
    assert.equal(storedNarrowed.resource, "https://resource.example/machine");
    assert.equal(storedNarrowed.endpointPermissionsJson, JSON.stringify(["endpoint_client_extra"]));

    const full = await exchangeOAuthToken(
      {
        grantType: "client_credentials",
        clientId: "machine-client",
        clientSecret: created.clientSecret,
        issuer: "https://issuer.example",
        code: "",
        redirectUri: "",
      },
      client,
    );
    const fullClaims = decodeJwt(full.access_token).payload;
    assert.equal(full.scope, "endpoint:endpoint_client_extra endpoint:endpoint_default_echo");
    assert.deepEqual(fullClaims.endpoint_permissions, ["endpoint_client_extra", "endpoint_default_echo"]);
  });
});

test("client_credentials exchange rejects invalid credentials and disabled clients", async () => {
  await withIsolatedDb(async (client) => {
    const created = await createOAuthClient(
      {
        clientId: "disabled-machine",
        displayName: "Disabled Machine",
        enabled: false,
        redirectUris: ["http://localhost:3000/callback"],
        clientCredentialsTtlSeconds: 3600,
        allowedEndpointIds: ["endpoint_default_echo"],
      },
      client,
    );

    await assert.rejects(
      () =>
        issueOAuthClientCredentialsToken(
          {
            grantType: "client_credentials",
            clientId: "missing-machine",
            clientSecret: "secret",
            code: "",
            redirectUri: "",
          },
          client,
        ),
      (error: unknown) => error instanceof OAuthTokenError && error.code === "invalid_client" && error.status === 401,
    );
    await assert.rejects(
      () =>
        issueOAuthClientCredentialsToken(
          {
            grantType: "client_credentials",
            clientId: "disabled-machine",
            clientSecret: created.clientSecret,
            code: "",
            redirectUri: "",
          },
          client,
        ),
      (error: unknown) => error instanceof OAuthTokenError && error.code === "invalid_client" && error.status === 401,
    );
    await client.oAuthClient.update({ where: { id: created.client.id }, data: { enabled: true } });
    await assert.rejects(
      () =>
        issueOAuthClientCredentialsToken(
          {
            grantType: "client_credentials",
            clientId: "disabled-machine",
            clientSecret: "wrong",
            code: "",
            redirectUri: "",
          },
          client,
        ),
      (error: unknown) => error instanceof OAuthTokenError && error.code === "invalid_client" && error.status === 401,
    );
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
            grantType: "password",
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

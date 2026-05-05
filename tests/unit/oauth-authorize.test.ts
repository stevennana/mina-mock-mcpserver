import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import test from "node:test";
import { createPrismaClient } from "@/lib/db/client";
import { seedAllDefaults } from "@/lib/db/seed";
import {
  createOAuthAuthorizationCode,
  loginOAuthUserForConsent,
  validateOAuthAuthorizeRequest,
} from "@/lib/oauth/service";
import {
  DEFAULT_OAUTH_CLIENT_REDIRECT_URI,
  OAuthAuthorizeRequestError,
  OAuthLoginError,
} from "@/lib/oauth/types";

const execFileAsync = promisify(execFile);

async function withIsolatedDb(fn: (client: ReturnType<typeof createPrismaClient>) => Promise<void>) {
  const directory = await mkdtemp(join(tmpdir(), "mcp-mock-oauth-authorize-"));
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

test("OAuth authorize validates client and exact registered redirect URI", async () => {
  await withIsolatedDb(async (client) => {
    const context = await validateOAuthAuthorizeRequest(defaultAuthorizeRequest(), client);
    assert.equal(context.client.clientId, "default");
    assert.equal(context.request.redirectUri, DEFAULT_OAUTH_CLIENT_REDIRECT_URI);

    await assert.rejects(
      () => validateOAuthAuthorizeRequest(defaultAuthorizeRequest({ redirect_uri: "http://localhost:3000/wrong" }), client),
      (error: unknown) => error instanceof OAuthAuthorizeRequestError && error.code === "invalid_redirect_uri",
    );
    await assert.rejects(
      () => validateOAuthAuthorizeRequest(defaultAuthorizeRequest({ client_id: "missing-client" }), client),
      (error: unknown) => error instanceof OAuthAuthorizeRequestError && error.code === "invalid_client",
    );
  });
});

test("OAuth consent creates a single-use-ready authorization code with endpoint bindings", async () => {
  await withIsolatedDb(async (client) => {
    const login = await loginOAuthUserForConsent(
      {
        authorizeRequest: defaultAuthorizeRequest(),
        username: "default",
        password: "default",
      },
      client,
    );
    const endpoint = await client.endpoint.findUniqueOrThrow({ where: { id: "endpoint_default_echo" } });
    const code = await createOAuthAuthorizationCode(
      {
        authorizeRequest: defaultAuthorizeRequest(),
        loginTicket: login.loginTicket,
        selectedEndpointIds: [endpoint.id],
      },
      client,
    );
    const stored = await client.oAuthAuthorizationCode.findUniqueOrThrow({
      where: { code: code.code },
      include: { selectedEndpoints: true },
    });

    assert.match(code.code, /^[a-zA-Z0-9_-]+$/);
    assert.equal(stored.oauthClientId, login.client.id);
    assert.equal(stored.oauthUserId, login.user.id);
    assert.equal(stored.redirectUri, DEFAULT_OAUTH_CLIENT_REDIRECT_URI);
    assert.equal(stored.resource, "https://resource.example/mcp");
    assert.equal(stored.state, "state-123");
    assert.equal(stored.usedAt, null);
    assert.deepEqual(stored.selectedEndpoints.map((selected) => selected.endpointId), [endpoint.id]);
    assert.ok(stored.expiresAt.getTime() > Date.now());
  });
});

test("OAuth consent rejects invalid users and endpoint selections outside the client allowed set", async () => {
  await withIsolatedDb(async (client) => {
    await assert.rejects(
      () => loginOAuthUserForConsent({ authorizeRequest: defaultAuthorizeRequest(), username: "default", password: "wrong" }, client),
      OAuthLoginError,
    );

    const login = await loginOAuthUserForConsent(
      {
        authorizeRequest: defaultAuthorizeRequest(),
        username: "default",
        password: "default",
      },
      client,
    );
    await assert.rejects(
      () =>
        createOAuthAuthorizationCode(
          {
            authorizeRequest: defaultAuthorizeRequest(),
            loginTicket: login.loginTicket,
            selectedEndpointIds: ["endpoint-outside-client"],
          },
          client,
        ),
      (error: unknown) => error instanceof OAuthLoginError && error.code === "invalid_selection",
    );
  });
});

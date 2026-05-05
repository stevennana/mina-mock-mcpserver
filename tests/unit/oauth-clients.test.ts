import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import test from "node:test";
import { verifyBasicPassword } from "@/lib/basic-auth/passwords";
import { createPrismaClient } from "@/lib/db/client";
import { seedAllDefaults } from "@/lib/db/seed";
import {
  createOAuthClient,
  deleteOAuthClient,
  regenerateOAuthClientSecret,
  updateOAuthClient,
  verifyOAuthClientSecret,
} from "@/lib/oauth/service";
import { DEFAULT_OAUTH_CLIENT_ID, OAuthClientBuiltInError, OAuthClientValidationError } from "@/lib/oauth/types";

const execFileAsync = promisify(execFile);

async function withIsolatedDb(fn: (client: ReturnType<typeof createPrismaClient>) => Promise<void>) {
  const directory = await mkdtemp(join(tmpdir(), "mcp-mock-oauth-clients-"));
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

test("OAuth client secrets are generated once, hashed, and verifiable", async () => {
  await withIsolatedDb(async (client) => {
    const endpoint = await client.endpoint.findUniqueOrThrow({ where: { id: "endpoint_default_echo" } });
    const result = await createOAuthClient(
      {
        clientId: "unit-client",
        displayName: "Unit Client",
        enabled: true,
        redirectUris: ["http://localhost:3000/callback"],
        clientCredentialsTtlSeconds: 3600,
        allowedEndpointIds: [endpoint.id],
      },
      client,
    );
    const record = await client.oAuthClient.findUniqueOrThrow({ where: { id: result.client.id } });

    assert.match(result.clientSecret, /^mcp_mock_/);
    assert.notEqual(record.secretHash, result.clientSecret);
    assert.match(record.secretHash, /^scrypt\$/);
    assert.equal(await verifyBasicPassword(result.clientSecret, record.secretHash), true);
    assert.equal(await verifyOAuthClientSecret("unit-client", result.clientSecret, client).then(Boolean), true);
    assert.equal("clientSecret" in result.client, false);
  });
});

test("OAuth client allowed endpoints persist and reject unknown endpoint IDs", async () => {
  await withIsolatedDb(async (client) => {
    const endpoint = await client.endpoint.findUniqueOrThrow({ where: { id: "endpoint_default_echo" } });
    const result = await createOAuthClient(
      {
        clientId: "allowed-client",
        displayName: "",
        enabled: true,
        redirectUris: [],
        clientCredentialsTtlSeconds: 900,
        allowedEndpointIds: [endpoint.id],
      },
      client,
    );

    assert.deepEqual(result.client.allowedEndpointIds, [endpoint.id]);
    const updated = await updateOAuthClient(result.client.id, { allowedEndpointIds: [], clientCredentialsTtlSeconds: 86400 }, client);
    assert.deepEqual(updated.allowedEndpointIds, []);
    assert.equal(updated.clientCredentialsTtlSeconds, 86400);

    await assert.rejects(
      () => updateOAuthClient(result.client.id, { allowedEndpointIds: ["missing_endpoint"] }, client),
      OAuthClientValidationError,
    );
  });
});

test("built-in default OAuth client cannot be disabled, regenerated, or deleted", async () => {
  await withIsolatedDb(async (client) => {
    const builtIn = await client.oAuthClient.findUniqueOrThrow({ where: { id: DEFAULT_OAUTH_CLIENT_ID } });

    assert.equal(builtIn.clientId, "default");
    assert.equal(builtIn.enabled, true);
    assert.equal(builtIn.builtIn, true);
    assert.notEqual(builtIn.secretHash, "default");
    assert.equal(await verifyOAuthClientSecret("default", "default", client).then(Boolean), true);

    await assert.rejects(
      () => updateOAuthClient(DEFAULT_OAUTH_CLIENT_ID, { enabled: false, allowedEndpointIds: [] }, client),
      OAuthClientBuiltInError,
    );
    await assert.rejects(() => regenerateOAuthClientSecret(DEFAULT_OAUTH_CLIENT_ID, client), OAuthClientBuiltInError);
    await assert.rejects(() => deleteOAuthClient(DEFAULT_OAUTH_CLIENT_ID, client), OAuthClientBuiltInError);

    const after = await client.oAuthClient.findUniqueOrThrow({ where: { id: DEFAULT_OAUTH_CLIENT_ID } });
    assert.equal(after.enabled, true);
    assert.equal(await verifyOAuthClientSecret("default", "default", client).then(Boolean), true);
  });
});

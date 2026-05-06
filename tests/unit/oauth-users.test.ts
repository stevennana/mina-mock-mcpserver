import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import test from "node:test";
import { verifyBasicPassword } from "@/lib/basic-auth/passwords";
import { createPrismaClient } from "@/lib/db/client";
import {
  createOAuthUser,
  deleteOAuthUser,
  seedOAuthUserDefaults,
  updateOAuthUser,
  verifyOAuthUserCredentials,
} from "@/lib/oauth/service";
import { DEFAULT_OAUTH_USER_ID, OAuthUserBuiltInError, OAuthUserValidationError } from "@/lib/oauth/types";

const execFileAsync = promisify(execFile);

async function withIsolatedDb(fn: (client: ReturnType<typeof createPrismaClient>) => Promise<void>) {
  const directory = await mkdtemp(join(tmpdir(), "mcp-mock-oauth-users-"));
  const previousDatabaseUrl = process.env.DATABASE_URL;
  const databasePath = join(directory, "runtime.sqlite");
  await writeFile(databasePath, "", { flag: "a" });
  process.env.DATABASE_URL = `file:${databasePath}`;

  await execFileAsync("npx", ["prisma", "migrate", "deploy"], { env: { ...process.env } });

  const client = createPrismaClient();
  try {
    await seedOAuthUserDefaults(client);
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

test("OAuth user passwords are hashed and verified without plaintext storage", async () => {
  await withIsolatedDb(async (client) => {
    const user = await createOAuthUser(
      { username: "unit_oauth", password: "unit-password", enabled: true, accessTokenTtlSeconds: 3600 },
      client,
    );
    const record = await client.oAuthUser.findUniqueOrThrow({ where: { id: user.id } });

    assert.notEqual(record.passwordHash, "unit-password");
    assert.match(record.passwordHash, /^scrypt\$/);
    assert.equal(await verifyBasicPassword("unit-password", record.passwordHash), true);
    assert.equal(await verifyOAuthUserCredentials("unit_oauth", "unit-password", client).then(Boolean), true);
  });
});

test("built-in default OAuth user cannot be disabled, changed, or deleted", async () => {
  await withIsolatedDb(async (client) => {
    const builtIn = await client.oAuthUser.findUniqueOrThrow({ where: { id: DEFAULT_OAUTH_USER_ID } });

    assert.equal(builtIn.username, "default");
    assert.equal(builtIn.enabled, true);
    assert.equal(builtIn.builtIn, true);
    assert.equal(builtIn.accessTokenTtlSeconds, 3600);
    assert.notEqual(builtIn.passwordHash, "default");
    assert.equal(await verifyOAuthUserCredentials("default", "default", client).then(Boolean), true);

    await assert.rejects(
      () =>
        updateOAuthUser(
          DEFAULT_OAUTH_USER_ID,
          { enabled: false, password: "weakened", accessTokenTtlSeconds: 86400 },
          client,
        ),
      OAuthUserBuiltInError,
    );
    await assert.rejects(() => deleteOAuthUser(DEFAULT_OAUTH_USER_ID, client), OAuthUserBuiltInError);

    const after = await client.oAuthUser.findUniqueOrThrow({ where: { id: DEFAULT_OAUTH_USER_ID } });
    assert.equal(after.enabled, true);
    assert.equal(after.accessTokenTtlSeconds, 3600);
    assert.equal(await verifyOAuthUserCredentials("default", "default", client).then(Boolean), true);
  });
});

test("OAuth user TTL validation rejects non-preset and never-expiring values", async () => {
  await withIsolatedDb(async (client) => {
    await assert.rejects(
      () =>
        createOAuthUser(
          { username: "bad_ttl", password: "unit-password", enabled: true, accessTokenTtlSeconds: 0 },
          client,
        ),
      OAuthUserValidationError,
    );
    await assert.rejects(
      () =>
        createOAuthUser(
          { username: "custom_ttl", password: "unit-password", enabled: true, accessTokenTtlSeconds: 12345 },
          client,
        ),
      OAuthUserValidationError,
    );

    const user = await createOAuthUser(
      { username: "valid_ttl", password: "unit-password", enabled: true, accessTokenTtlSeconds: 900 },
      client,
    );
    const updated = await updateOAuthUser(user.id, { accessTokenTtlSeconds: 86400 }, client);
    assert.equal(updated.accessTokenTtlSeconds, 86400);
  });
});

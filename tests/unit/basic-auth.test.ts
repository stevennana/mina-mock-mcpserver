import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import test from "node:test";
import { parseBasicAuthorizationHeader, resolveBasicAuthorizationHeader } from "@/lib/auth/basic";
import { hashBasicPassword, verifyBasicPassword } from "@/lib/basic-auth/passwords";
import {
  createBasicUser,
  deleteBasicUser,
  seedBasicUserDefaults,
  updateBasicUser,
  verifyBasicCredentials,
} from "@/lib/basic-auth/service";
import { BasicUserBuiltInError, DEFAULT_BASIC_USER_ID } from "@/lib/basic-auth/types";
import { createPrismaClient } from "@/lib/db/client";

const execFileAsync = promisify(execFile);

async function withIsolatedDb(fn: (client: ReturnType<typeof createPrismaClient>) => Promise<void>) {
  const directory = await mkdtemp(join(tmpdir(), "mcp-mock-basic-"));
  const previousDatabaseUrl = process.env.DATABASE_URL;
  process.env.DATABASE_URL = `file:${join(directory, "runtime.sqlite")}`;

  await execFileAsync("npx", ["prisma", "migrate", "deploy"], { env: { ...process.env } });

  const client = createPrismaClient();
  try {
    await seedBasicUserDefaults(client);
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

test("Basic passwords are hashed and verified without plaintext storage", async () => {
  const hash = await hashBasicPassword("secret-value");

  assert.notEqual(hash, "secret-value");
  assert.match(hash, /^scrypt\$/);
  assert.equal(await verifyBasicPassword("secret-value", hash), true);
  assert.equal(await verifyBasicPassword("wrong-value", hash), false);
});

test("Basic Authorization parser handles missing, valid, unsupported, and malformed headers", () => {
  const encoded = Buffer.from("default:default", "utf8").toString("base64");

  assert.deepEqual(parseBasicAuthorizationHeader(null), { kind: "missing" });
  assert.deepEqual(parseBasicAuthorizationHeader(`Basic ${encoded}`), {
    kind: "basic",
    username: "default",
    password: "default",
  });
  assert.deepEqual(parseBasicAuthorizationHeader(`bAsIc ${encoded}`), {
    kind: "basic",
    username: "default",
    password: "default",
  });
  assert.deepEqual(parseBasicAuthorizationHeader("Bearer token-value"), { kind: "unsupported", scheme: "Bearer" });
  assert.deepEqual(parseBasicAuthorizationHeader("Basic"), { kind: "invalid", reason: "malformed" });
  assert.deepEqual(parseBasicAuthorizationHeader("Basic !!!"), { kind: "invalid", reason: "malformed" });
  assert.deepEqual(parseBasicAuthorizationHeader(`Basic ${Buffer.from("missing-colon", "utf8").toString("base64")}`), {
    kind: "invalid",
    reason: "malformed",
  });
});

test("Basic Authorization resolver authenticates enabled users and fails closed otherwise", async () => {
  await withIsolatedDb(async (client) => {
    const valid = Buffer.from("default:default", "utf8").toString("base64");
    const invalidPassword = Buffer.from("default:wrong", "utf8").toString("base64");

    const authenticated = await resolveBasicAuthorizationHeader(`Basic ${valid}`, client);
    assert.equal(authenticated.kind, "authenticated");
    if (authenticated.kind === "authenticated") {
      assert.equal(authenticated.principal.username, "default");
    }

    assert.deepEqual(await resolveBasicAuthorizationHeader(null, client), { kind: "missing" });
    assert.deepEqual(await resolveBasicAuthorizationHeader(`Basic ${invalidPassword}`, client), {
      kind: "unauthorized",
      reason: "invalid",
    });
    assert.deepEqual(await resolveBasicAuthorizationHeader("Bearer token-value", client), {
      kind: "unauthorized",
      reason: "unsupported",
    });
  });
});

test("Basic credential verification uses stored hashes and enabled state", async () => {
  await withIsolatedDb(async (client) => {
    await createBasicUser({ username: "unit_basic", password: "unit-password", enabled: true }, client);

    const verified = await verifyBasicCredentials("unit_basic", "unit-password", client);
    assert.equal(verified?.username, "unit_basic");

    assert.equal(await verifyBasicCredentials("unit_basic", "wrong-password", client), null);

    await updateBasicUser(verified!.id, { enabled: false }, client);
    assert.equal(await verifyBasicCredentials("unit_basic", "unit-password", client), null);
  });
});

test("built-in default Basic user cannot be disabled, changed, or deleted", async () => {
  await withIsolatedDb(async (client) => {
    const builtIn = await client.basicUser.findUniqueOrThrow({ where: { id: DEFAULT_BASIC_USER_ID } });

    assert.equal(builtIn.username, "default");
    assert.equal(builtIn.enabled, true);
    assert.equal(builtIn.builtIn, true);
    assert.notEqual(builtIn.passwordHash, "default");
    assert.equal(await verifyBasicCredentials("default", "default", client).then(Boolean), true);

    await assert.rejects(
      () => updateBasicUser(DEFAULT_BASIC_USER_ID, { enabled: false, password: "weakened" }, client),
      BasicUserBuiltInError,
    );
    await assert.rejects(() => deleteBasicUser(DEFAULT_BASIC_USER_ID, client), BasicUserBuiltInError);

    const after = await client.basicUser.findUniqueOrThrow({ where: { id: DEFAULT_BASIC_USER_ID } });
    assert.equal(after.enabled, true);
    assert.equal(await verifyBasicCredentials("default", "default", client).then(Boolean), true);
  });
});

import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import test from "node:test";
import { createPrismaClient } from "@/lib/db/client";

const execFileAsync = promisify(execFile);

async function runDbPrepare(databaseUrl: string) {
  await execFileAsync("npm", ["run", "db:prepare"], {
    env: { ...process.env, DATABASE_URL: databaseUrl },
  });
}

test("db:prepare is repeatable and keeps seed rows singular", async () => {
  const directory = await mkdtemp(join(tmpdir(), "mcp-mock-db-"));
  const databaseUrl = `file:${join(directory, "runtime.sqlite")}`;

  await runDbPrepare(databaseUrl);
  await runDbPrepare(databaseUrl);

  const previousDatabaseUrl = process.env.DATABASE_URL;
  process.env.DATABASE_URL = databaseUrl;
  const prisma = createPrismaClient();

  try {
    assert.equal(await prisma.endpoint.count(), 1);
    assert.equal(await prisma.endpointParam.count(), 1);
    assert.equal(await prisma.responseCase.count(), 2);
    assert.equal(await prisma.basicUser.count(), 1);
    assert.equal(await prisma.oAuthUser.count(), 1);

    const endpoint = await prisma.endpoint.findUniqueOrThrow({
      where: { id: "endpoint_default_echo" },
      include: { parameters: true, responseCases: true },
    });

    assert.equal(endpoint.name, "echo");
    assert.equal(endpoint.title, "Echo");
    assert.equal(endpoint.enabled, true);
    assert.equal(endpoint.protectedDefault, true);
    assert.equal(endpoint.parameters[0]?.position, 0);
    assert.equal(endpoint.responseCases.some((responseCase) => responseCase.isDefault), true);

    const helloCase = endpoint.responseCases.find((responseCase) => responseCase.name === "hello-world");
    assert.equal(helloCase?.priority, 10);
    assert.equal(helloCase?.delayMs, 0);
    assert.equal(helloCase?.errorMode, "none");
    assert.equal(helloCase?.errorStatusCode, null);

    const basicUser = await prisma.basicUser.findUniqueOrThrow({ where: { id: "basic_user_default" } });
    assert.equal(basicUser.username, "default");
    assert.equal(basicUser.enabled, true);
    assert.equal(basicUser.builtIn, true);
    assert.notEqual(basicUser.passwordHash, "default");

    const oauthUser = await prisma.oAuthUser.findUniqueOrThrow({ where: { id: "oauth_user_default" } });
    assert.equal(oauthUser.username, "default");
    assert.equal(oauthUser.enabled, true);
    assert.equal(oauthUser.builtIn, true);
    assert.equal(oauthUser.accessTokenTtlSeconds, 3600);
    assert.notEqual(oauthUser.passwordHash, "default");
  } finally {
    await prisma.$disconnect();
    if (previousDatabaseUrl === undefined) {
      delete process.env.DATABASE_URL;
    } else {
      process.env.DATABASE_URL = previousDatabaseUrl;
    }
  }
});

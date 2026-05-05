import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { createPrismaClient } from "@/lib/db/client";
import { seedEndpointDefaults } from "@/lib/db/seed";
import { createEndpoint } from "@/lib/endpoints/service";
import { resetToDefaults } from "@/lib/reset/service";
import { ResetAuthorizationError } from "@/lib/reset/types";

async function withIsolatedDb(fn: (client: ReturnType<typeof createPrismaClient>) => Promise<void>) {
  const directory = await mkdtemp(join(tmpdir(), "mcp-mock-reset-"));
  const previousDatabaseUrl = process.env.DATABASE_URL;
  const previousRootPassword = process.env.ROOT_PASSWORD;
  process.env.DATABASE_URL = `file:${join(directory, "runtime.sqlite")}`;
  process.env.ROOT_PASSWORD = "unit-root-password";

  const { execFile } = await import("node:child_process");
  const { promisify } = await import("node:util");
  await promisify(execFile)("npx", ["prisma", "migrate", "deploy"], { env: { ...process.env } });

  const client = createPrismaClient();
  try {
    await seedEndpointDefaults(client);
    await fn(client);
  } finally {
    await client.$disconnect();
    if (previousDatabaseUrl === undefined) {
      delete process.env.DATABASE_URL;
    } else {
      process.env.DATABASE_URL = previousDatabaseUrl;
    }
    if (previousRootPassword === undefined) {
      delete process.env.ROOT_PASSWORD;
    } else {
      process.env.ROOT_PASSWORD = previousRootPassword;
    }
  }
}

test("reset requires confirmation and leaves endpoint state untouched on failure", async () => {
  await withIsolatedDb(async (client) => {
    await assert.rejects(
      () => resetToDefaults({ rootPassword: "unit-root-password", confirmation: "wrong" }, client),
      ResetAuthorizationError,
    );

    assert.equal(await client.endpoint.count(), 1);
    assert.equal(await client.auditEvent.count({ where: { eventType: "system.reset", outcome: "failure" } }), 1);
  });
});

test("reset clears mutable endpoint data and recreates current seed defaults", async () => {
  await withIsolatedDb(async (client) => {
    await createEndpoint(
      {
        name: "temporary_reset_endpoint",
        title: "Temporary reset endpoint",
        description: "Removed by reset.",
        enabled: true,
        deleteCode: "87654321",
        defaultResponseJson: "{}",
        failureMode: "none",
        failureDelayMs: 0,
        parameters: [],
        responseCases: [
          {
            name: "default",
            priority: 0,
            matchArgsJson: "{}",
            responseJson: "{}",
            statusCode: 200,
            delayMs: 0,
            errorMode: "none",
            isDefault: true,
          },
        ],
      },
      client,
    );

    assert.equal(await client.endpoint.count(), 2);

    const result = await resetToDefaults({ rootPassword: "unit-root-password", confirmation: "RESET DEFAULTS" }, client);

    assert.equal(result.seededEndpoints, 1);
    assert.equal(await client.endpoint.count(), 1);
    assert.equal(await client.endpointParam.count(), 1);
    assert.equal(await client.responseCase.count(), 2);
    assert.equal(await client.endpoint.count({ where: { name: "temporary_reset_endpoint" } }), 0);
    assert.equal(await client.endpoint.count({ where: { id: "endpoint_default_echo", protectedDefault: true } }), 1);
    assert.equal(await client.auditEvent.count({ where: { eventType: "system.reset", outcome: "success" } }), 1);
  });
});

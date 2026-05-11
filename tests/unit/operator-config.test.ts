import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import test from "node:test";
import { createPrismaClient } from "@/lib/db/client";
import { seedAllDefaults } from "@/lib/db/seed";
import packageJson from "../../package.json";
import {
  getOperatorHealth,
  getPublicOperatorConfig,
  getTlsRuntimeConfig,
  normalizeBaseUrl,
  resolveBaseUrl,
  updateOperatorBaseUrl,
} from "@/lib/operator/config";
import { redactLogMetadata } from "@/lib/operator/logger";

const execFileAsync = promisify(execFile);

async function withIsolatedDb(fn: (client: ReturnType<typeof createPrismaClient>) => Promise<void>) {
  const directory = await mkdtemp(join(tmpdir(), "mcp-mock-operator-config-"));
  const previousDatabaseUrl = process.env.DATABASE_URL;
  const previousAppBaseUrl = process.env.APP_BASE_URL;
  const previousRootPassword = process.env.ROOT_PASSWORD;
  const previousTlsCertFile = process.env.TLS_CERT_FILE;
  const previousTlsKeyFile = process.env.TLS_KEY_FILE;
  const previousTlsCaFile = process.env.TLS_CA_FILE;
  const databasePath = join(directory, "runtime.sqlite");
  await writeFile(databasePath, "", { flag: "a" });
  process.env.DATABASE_URL = `file:${databasePath}`;
  process.env.ROOT_PASSWORD = "unit-root-password";
  delete process.env.APP_BASE_URL;
  delete process.env.TLS_CERT_FILE;
  delete process.env.TLS_KEY_FILE;
  delete process.env.TLS_CA_FILE;

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
    if (previousAppBaseUrl === undefined) {
      delete process.env.APP_BASE_URL;
    } else {
      process.env.APP_BASE_URL = previousAppBaseUrl;
    }
    if (previousRootPassword === undefined) {
      delete process.env.ROOT_PASSWORD;
    } else {
      process.env.ROOT_PASSWORD = previousRootPassword;
    }
    if (previousTlsCertFile === undefined) {
      delete process.env.TLS_CERT_FILE;
    } else {
      process.env.TLS_CERT_FILE = previousTlsCertFile;
    }
    if (previousTlsKeyFile === undefined) {
      delete process.env.TLS_KEY_FILE;
    } else {
      process.env.TLS_KEY_FILE = previousTlsKeyFile;
    }
    if (previousTlsCaFile === undefined) {
      delete process.env.TLS_CA_FILE;
    } else {
      process.env.TLS_CA_FILE = previousTlsCaFile;
    }
  }
}

test("operator base URL precedence is APP_BASE_URL, database, forwarded headers, Host, local fallback", async () => {
  await withIsolatedDb(async (client) => {
    assert.equal((await resolveBaseUrl(undefined, client)).baseUrl, "http://localhost:3000");
    assert.equal((await resolveBaseUrl(undefined, client)).source, "local_fallback");

    const hostRequest = new Request("http://ignored.example/config", { headers: { host: "host.example:3100" } });
    assert.deepEqual(await resolveBaseUrl(hostRequest, client), {
      baseUrl: "http://host.example:3100",
      source: "host",
      databaseOverride: null,
      appBaseUrl: null,
    });

    const forwardedRequest = new Request("http://ignored.example/config", {
      headers: {
        host: "host.example:3100",
        "x-forwarded-host": "forwarded.example",
        "x-forwarded-proto": "https",
      },
    });
    assert.equal((await resolveBaseUrl(forwardedRequest, client)).baseUrl, "https://forwarded.example");
    assert.equal((await resolveBaseUrl(forwardedRequest, client)).source, "forwarded_headers");

    await updateOperatorBaseUrl({ rootPassword: "unit-root-password", baseUrl: "https://db.example/" }, client);
    assert.equal((await resolveBaseUrl(forwardedRequest, client)).baseUrl, "https://db.example");
    assert.equal((await resolveBaseUrl(forwardedRequest, client)).source, "database");

    process.env.APP_BASE_URL = "https://env.example/";
    assert.equal((await resolveBaseUrl(forwardedRequest, client)).baseUrl, "https://env.example");
    assert.equal((await resolveBaseUrl(forwardedRequest, client)).source, "app_base_url");
    assert.equal((await resolveBaseUrl(forwardedRequest, client)).databaseOverride, "https://db.example");
  });
});

test("operator public config and health report persisted runtime state", async () => {
  await withIsolatedDb(async (client) => {
    const health = await getOperatorHealth(client);
    assert.equal(health.status, "ok");
    assert.equal(health.version, packageJson.version);
    assert.equal(health.database.status, "ok");
    assert.ok(health.database.counts);
    assert.equal(health.database.counts.endpoints, 1);
    assert.equal(health.database.counts.enabledEndpoints, 1);
    assert.equal(health.database.counts.basicUsers, 1);
    assert.equal(health.database.counts.oauthClients, 1);

    await updateOperatorBaseUrl({ rootPassword: "unit-root-password", baseUrl: "https://guide.example" }, client);
    const config = await getPublicOperatorConfig(undefined, client);
    assert.equal(config.routes.mcp.noAuth, "https://guide.example/mcp/none");
    assert.equal(config.routes.rest.tools, "https://guide.example/rest/tools");
    assert.equal(config.routes.oauth.authorizationServerMetadata, "https://guide.example/.well-known/oauth-authorization-server");
    assert.equal(config.examples.curl.callTool.includes("https://guide.example/rest/tools/echo/call"), true);
    assert.equal(config.tls.enabled, false);
    assert.equal(config.tls.mode, "http_or_proxy");
    assert.equal(config.examples.tls.devCertCommand, "npm run cert:dev");
    assert.equal(config.examples.tls.smokeCommand, "npm run start:tls:smoke");
    assert.equal(config.examples.tls.inspectorCommand, "npm run inspector:mock -- --base-url https://127.0.0.1:3443 --insecure-tls");
  });
});

test("operator TLS runtime config reports app HTTPS when certificate inputs are configured", () => {
  const previousTlsCertFile = process.env.TLS_CERT_FILE;
  const previousTlsKeyFile = process.env.TLS_KEY_FILE;
  const previousTlsCaFile = process.env.TLS_CA_FILE;
  try {
    process.env.TLS_CERT_FILE = "certs/localhost-cert.pem";
    process.env.TLS_KEY_FILE = "certs/localhost-key.pem";
    process.env.TLS_CA_FILE = "certs/local-ca.pem";
    assert.deepEqual(getTlsRuntimeConfig(), {
      enabled: true,
      mode: "app_https",
      recommendedPublicMode: "nginx_tls_termination",
      certFileConfigured: true,
      keyFileConfigured: true,
      caFileConfigured: true,
      command: "TLS_CERT_FILE=certs/localhost-cert.pem TLS_KEY_FILE=certs/localhost-key.pem PORT=3443 npm run start:tls",
      loggedCommand: "TLS_CERT_FILE=certs/localhost-cert.pem TLS_KEY_FILE=certs/localhost-key.pem PORT=3443 npm run start:logged",
    });
  } finally {
    if (previousTlsCertFile === undefined) {
      delete process.env.TLS_CERT_FILE;
    } else {
      process.env.TLS_CERT_FILE = previousTlsCertFile;
    }
    if (previousTlsKeyFile === undefined) {
      delete process.env.TLS_KEY_FILE;
    } else {
      process.env.TLS_KEY_FILE = previousTlsKeyFile;
    }
    if (previousTlsCaFile === undefined) {
      delete process.env.TLS_CA_FILE;
    } else {
      process.env.TLS_CA_FILE = previousTlsCaFile;
    }
  }
});

test("operator base URL validation failures with valid root password write non-secret audit evidence", async () => {
  await withIsolatedDb(async (client) => {
    await assert.rejects(
      () => updateOperatorBaseUrl({ rootPassword: "unit-root-password", baseUrl: "https://root:secret@mock.example" }, client),
      { name: "OperatorConfigValidationError" },
    );

    const auditEvent = await client.auditEvent.findFirst({
      where: {
        eventType: "system.config.base_url",
        outcome: "failure",
      },
      orderBy: { createdAt: "desc" },
    });

    assert.ok(auditEvent);
    assert.equal(auditEvent.subjectName, "baseUrl");
    assert.deepEqual(JSON.parse(auditEvent.metadataJson), {
      reason: "validation_failed",
      fields: "baseUrl",
    });
    assert.equal(auditEvent.metadataJson.includes("secret"), false);
    assert.equal(await client.serverSetting.count(), 0);
  });
});

test("operator config validation and log redaction avoid secrets", () => {
  assert.equal(normalizeBaseUrl("https://mock.example/path/"), "https://mock.example/path");
  assert.throws(() => normalizeBaseUrl("ftp://mock.example"), { name: "OperatorConfigValidationError" });
  assert.deepEqual(redactLogMetadata({ rootPassword: "secret", clientSecret: "secret", baseUrl: "https://mock.example" }), {
    rootPassword: "[redacted]",
    clientSecret: "[redacted]",
    baseUrl: "https://mock.example",
  });
});

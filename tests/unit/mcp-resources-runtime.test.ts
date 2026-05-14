import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import test from "node:test";
import { createPrismaClient } from "@/lib/db/client";
import { seedAllDefaults } from "@/lib/db/seed";
import {
  createMcpResource,
  listEnabledMcpResources,
  listEnabledMcpResourceTemplates,
  readEnabledMcpResource,
} from "@/lib/mcp-fixtures/service";
import { handleMcpJsonRpcMessage } from "@minasoft/mcp-runtime";
import type { McpResourceContent, McpRuntimeProvider } from "@minasoft/mcp-runtime";

const execFileAsync = promisify(execFile);

async function withIsolatedDb(fn: (client: ReturnType<typeof createPrismaClient>) => Promise<void>) {
  const directory = await mkdtemp(join(tmpdir(), "mcp-mock-resources-runtime-"));
  const previousDatabaseUrl = process.env.DATABASE_URL;
  const databasePath = join(directory, "runtime.sqlite");
  await writeFile(databasePath, "", { flag: "a" });
  process.env.DATABASE_URL = `file:${databasePath}`;

  await execFileAsync("npx", ["prisma", "migrate", "deploy"], { env: { ...process.env } });

  const client = createPrismaClient();
  try {
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

function resourceContent(resource: Awaited<ReturnType<typeof readEnabledMcpResource>>): McpResourceContent | null {
  if (!resource) return null;
  return {
    uri: resource.uri,
    mimeType: resource.mimeType,
    ...(resource.textContent !== null ? { text: resource.textContent } : { blob: resource.blobContentBase64 ?? "" }),
  };
}

function resourceProvider(overrides: Partial<NonNullable<McpRuntimeProvider["resources"]>>): McpRuntimeProvider {
  return {
    resources: {
      async list() {
        return { items: [] };
      },
      async read() {
        return { kind: "not_found", message: "Resource not found", data: { error: "resource_not_found" } };
      },
      ...overrides,
    },
  };
}

test("MCP resources runtime lists seeded resources and templates", async () => {
  await withIsolatedDb(async (client) => {
    await seedAllDefaults(client);
    await createMcpResource(
      {
        uri: "mock://resources/disabled-runtime",
        name: "disabled_runtime",
        mimeType: "text/plain",
        enabled: false,
        textContent: "hidden",
      },
      client,
    );

    const listResources = await handleMcpJsonRpcMessage(
      { jsonrpc: "2.0", id: "resources", method: "resources/list" },
      resourceProvider({
        async list() {
          return {
            items: (await listEnabledMcpResources(client)).map((resource) => ({
              uri: resource.uri,
              name: resource.name,
              title: resource.title,
              description: resource.description,
              mimeType: resource.mimeType,
            })),
          };
        },
      }),
    );
    assert.equal(listResources.kind, "json");
    if (listResources.kind !== "json") return;
    const resourceListBody = listResources.body as { result: { resources: Array<{ uri: string }> } };
    assert.deepEqual(
      resourceListBody.result.resources.map((resource) => resource.uri),
      ["mock://resources/server-status"],
    );

    const listTemplates = await handleMcpJsonRpcMessage(
      { jsonrpc: "2.0", id: "templates", method: "resources/templates/list" },
      resourceProvider({
        templates: {
          async list() {
            return {
              items: (await listEnabledMcpResourceTemplates(client)).map((template) => ({
                uriTemplate: template.uriTemplate,
                name: template.name,
                title: template.title,
                description: template.description,
                mimeType: template.mimeType,
              })),
            };
          },
        },
      }),
    );
    assert.equal(listTemplates.kind, "json");
    if (listTemplates.kind !== "json") return;
    assert.deepEqual(listTemplates.body, {
      jsonrpc: "2.0",
      id: "templates",
      result: {
        resourceTemplates: [
          {
            uriTemplate: "mock://resources/customers/{customerId}",
            name: "customer_profile",
            title: "Customer profile",
            description: "Default rendered text resource template for MCP smoke tests.",
            mimeType: "application/json",
          },
        ],
      },
    });
  });
});

test("MCP resources/read returns direct and rendered-template content with JSON-RPC errors", async () => {
  await withIsolatedDb(async (client) => {
    await seedAllDefaults(client);

    const directRead = await handleMcpJsonRpcMessage(
      { jsonrpc: "2.0", id: "direct", method: "resources/read", params: { uri: "mock://resources/server-status" } },
      resourceProvider({
        async read(input) {
          const content = resourceContent(await readEnabledMcpResource(input.uri, client));
          return content ? { kind: "success", contents: [content] } : { kind: "not_found", message: "Resource not found", data: { error: "resource_not_found", uri: input.uri } };
        },
      }),
    );
    assert.equal(directRead.kind, "json");
    if (directRead.kind !== "json") return;
    const directReadBody = directRead.body as { result: { contents: Array<{ uri: string; text?: string }> } };
    assert.equal(directReadBody.result.contents[0]?.uri, "mock://resources/server-status");
    assert.match(directReadBody.result.contents[0]?.text ?? "", /"status": "ok"/);

    const templateRead = await handleMcpJsonRpcMessage(
      { jsonrpc: "2.0", id: "template", method: "resources/read", params: { uri: "mock://resources/customers/cust_999" } },
      resourceProvider({
        async read(input) {
          const content = resourceContent(await readEnabledMcpResource(input.uri, client));
          return content ? { kind: "success", contents: [content] } : { kind: "not_found", message: "Resource not found", data: { error: "resource_not_found", uri: input.uri } };
        },
      }),
    );
    assert.equal(templateRead.kind, "json");
    if (templateRead.kind !== "json") return;
    assert.deepEqual(templateRead.body, {
      jsonrpc: "2.0",
      id: "template",
      result: {
        contents: [
          {
            uri: "mock://resources/customers/cust_999",
            mimeType: "application/json",
            text: "{\"customerId\":\"cust_999\",\"tier\":\"demo\"}",
          },
        ],
      },
    });

    const missing = await handleMcpJsonRpcMessage(
      { jsonrpc: "2.0", id: "missing", method: "resources/read", params: { uri: "mock://resources/missing" } },
      resourceProvider({
        async read(input) {
          const content = resourceContent(await readEnabledMcpResource(input.uri, client));
          return content ? { kind: "success", contents: [content] } : { kind: "not_found", message: "Resource not found", data: { error: "resource_not_found", uri: input.uri } };
        },
      }),
    );
    assert.equal(missing.kind, "json");
    if (missing.kind !== "json") return;
    assert.deepEqual(missing.body, {
      jsonrpc: "2.0",
      id: "missing",
      error: {
        code: -32002,
        message: "Resource not found",
        data: { error: "resource_not_found", uri: "mock://resources/missing" },
      },
    });

    const invalid = await handleMcpJsonRpcMessage(
      { jsonrpc: "2.0", id: "invalid", method: "resources/read", params: { uri: "" } },
      resourceProvider({
        async read(input) {
          const content = resourceContent(await readEnabledMcpResource(input.uri, client));
          return content ? { kind: "success", contents: [content] } : { kind: "not_found", message: "Resource not found", data: { error: "resource_not_found", uri: input.uri } };
        },
      }),
    );
    assert.equal(invalid.kind, "json");
    if (invalid.kind !== "json") return;
    assert.deepEqual(invalid.body, {
      jsonrpc: "2.0",
      id: "invalid",
      error: { code: -32602, message: "Invalid params" },
    });
  });
});

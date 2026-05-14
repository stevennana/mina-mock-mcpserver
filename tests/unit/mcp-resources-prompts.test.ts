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
  createMcpPrompt,
  createMcpResource,
  createMcpResourceTemplate,
  deleteMcpPrompt,
  deleteMcpResource,
  deleteMcpResourceTemplate,
  listEnabledMcpPrompts,
  listEnabledMcpResources,
  listEnabledMcpResourceTemplates,
  listMcpPrompts,
  updateMcpPrompt,
  updateMcpResource,
  updateMcpResourceTemplate,
} from "@/lib/mcp-fixtures/service";
import { McpFixtureProtectedDefaultError, McpFixtureValidationError } from "@/lib/mcp-fixtures/types";
import {
  validateMcpPromptInput,
  validateMcpResourceInput,
  validateMcpResourceTemplateInput,
} from "@/lib/mcp-fixtures/validation";

const execFileAsync = promisify(execFile);

async function withIsolatedDb(fn: (client: ReturnType<typeof createPrismaClient>) => Promise<void>) {
  const directory = await mkdtemp(join(tmpdir(), "mcp-mock-fixtures-"));
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

test("MCP resource validation rejects local paths and ambiguous content", () => {
  assert.throws(
    () =>
      validateMcpResourceInput({
        uri: "file:///etc/passwd",
        name: "bad resource",
        mimeType: "text/plain",
        enabled: true,
        textContent: "text",
        blobContentBase64: "Ym9keQ==",
      }),
    (error) => {
      assert.equal(error instanceof McpFixtureValidationError, true);
      const fieldErrors = (error as McpFixtureValidationError).fieldErrors;
      assert.match(fieldErrors.uri, /Local file/);
      assert.match(fieldErrors.name, /letters/);
      assert.match(fieldErrors.textContent, /exactly one/);
      return true;
    },
  );
});

test("MCP resource template validation checks URI arguments and completion limits", () => {
  assert.throws(
    () =>
      validateMcpResourceTemplateInput({
        uriTemplate: "mock://resources/customers/{customerId}",
        name: "customer_profile",
        mimeType: "application/json",
        enabled: true,
        textTemplate: "{\"customerId\":\"{customerId}\"}",
        arguments: [{ name: "accountId", sampleValueJson: "{", required: true }],
        completionCandidates: Array.from({ length: 101 }, (_, index) => ({
          argumentName: "customerId",
          value: `cust_${index}`,
        })),
      }),
    (error) => {
      assert.equal(error instanceof McpFixtureValidationError, true);
      const fieldErrors = (error as McpFixtureValidationError).fieldErrors;
      assert.match(fieldErrors.uriTemplate, /matching argument/);
      assert.match(fieldErrors["arguments.0.name"], /URI template/);
      assert.match(fieldErrors["arguments.0.sampleValueJson"], /valid JSON/);
      assert.match(fieldErrors.completionCandidates, /100/);
      return true;
    },
  );
});

test("MCP prompt validation protects required argument and message rules", () => {
  assert.throws(
    () =>
      validateMcpPromptInput({
        name: "bad prompt",
        enabled: true,
        arguments: [{ name: "tone", required: true }, { name: "tone", required: false }],
        messages: [{ role: "user", resourceUri: "/tmp/prompt.txt" }],
        completionCandidates: [{ argumentName: "missing", value: "friendly" }],
      }),
    (error) => {
      assert.equal(error instanceof McpFixtureValidationError, true);
      const fieldErrors = (error as McpFixtureValidationError).fieldErrors;
      assert.match(fieldErrors.name, /letters/);
      assert.match(fieldErrors["arguments.1.name"], /unique/);
      assert.match(fieldErrors["messages.0.resourceUri"], /absolute/);
      assert.match(fieldErrors["completionCandidates.0.argumentName"], /existing/);
      return true;
    },
  );
});

test("seed defaults are idempotent and expose enabled resource and prompt fixtures", async () => {
  await withIsolatedDb(async (client) => {
    await seedAllDefaults(client);
    await seedAllDefaults(client);

    assert.equal(await client.mcpResource.count(), 1);
    assert.equal(await client.mcpResourceTemplate.count(), 1);
    assert.equal(await client.mcpResourceTemplateArgument.count(), 1);
    assert.equal(await client.mcpPrompt.count(), 2);
    assert.equal(await client.mcpPromptArgument.count(), 2);
    assert.equal(await client.mcpPromptMessage.count(), 2);
    assert.equal(await client.mcpCompletionCandidate.count(), 3);

    const resources = await listEnabledMcpResources(client);
    assert.equal(resources[0]?.uri, "mock://resources/server-status");
    assert.equal(resources[0]?.protectedDefault, true);
    assert.equal(resources[0]?.textContent?.includes("\"status\": \"ok\""), true);

    const templates = await listEnabledMcpResourceTemplates(client);
    assert.equal(templates[0]?.uriTemplate, "mock://resources/customers/{customerId}");
    assert.equal(templates[0]?.arguments[0]?.name, "customerId");
    assert.equal(templates[0]?.completionCandidates[0]?.value, "cust_123");

    const prompts = await listEnabledMcpPrompts(client);
    assert.deepEqual(
      prompts.map((prompt) => prompt.name),
      ["release_notes", "support_reply"],
    );
    assert.equal(prompts.find((prompt) => prompt.name === "support_reply")?.messages[0]?.resourceUri, "mock://resources/server-status");
  });
});

test("MCP fixture services create and map resources, templates, prompts, and enabled reads", async () => {
  await withIsolatedDb(async (client) => {
    const disabledResource = await createMcpResource(
      {
        uri: "mock://resources/disabled",
        name: "disabled_resource",
        mimeType: "text/plain",
        enabled: false,
        textContent: "disabled",
      },
      client,
    );
    const enabledResource = await createMcpResource(
      {
        uri: "mock://resources/enabled",
        name: "enabled_resource",
        title: "Enabled resource",
        mimeType: "text/plain",
        enabled: true,
        textContent: "enabled",
      },
      client,
    );
    const template = await createMcpResourceTemplate(
      {
        uriTemplate: "mock://resources/orders/{orderId}",
        name: "order_resource",
        mimeType: "application/json",
        enabled: true,
        textTemplate: "{\"orderId\":\"{orderId}\"}",
        arguments: [{ name: "orderId", description: "Order ID", sampleValueJson: "\"ord_1\"" }],
        completionCandidates: [{ argumentName: "orderId", value: "ord_1", label: "Order 1" }],
      },
      client,
    );
    await createMcpPrompt(
      {
        name: "order_summary",
        title: "Order summary",
        enabled: true,
        arguments: [{ name: "orderId", required: true }],
        messages: [{ role: "user", textTemplate: "Summarize order {orderId}." }],
        completionCandidates: [{ argumentName: "orderId", value: "ord_1" }],
      },
      client,
    );

    assert.equal(disabledResource.enabled, false);
    assert.equal(enabledResource.title, "Enabled resource");
    assert.equal(template.arguments[0]?.sampleValueJson, "\"ord_1\"");
    assert.equal(template.completionCandidates[0]?.label, "Order 1");

    const enabledResources = await listEnabledMcpResources(client);
    assert.deepEqual(
      enabledResources.map((resource) => resource.name),
      ["enabled_resource"],
    );

    const prompts = await listMcpPrompts(client);
    assert.equal(prompts.total, 1);
    assert.equal(prompts.items[0]?.argumentCount, 1);
    assert.equal(prompts.items[0]?.messageCount, 1);
    assert.equal(prompts.items[0]?.completionCandidateCount, 1);
  });
});

test("protected default MCP fixtures cannot be edited or deleted through normal services", async () => {
  await withIsolatedDb(async (client) => {
    await seedAllDefaults(client);

    await assert.rejects(
      () =>
        updateMcpResource(
          "mcp_resource_default_status",
          {
            uri: "mock://resources/server-status",
            name: "server_status",
            mimeType: "application/json",
            enabled: false,
            textContent: "{\"status\":\"changed\"}",
          },
          client,
        ),
      McpFixtureProtectedDefaultError,
    );
    await assert.rejects(() => deleteMcpResource("mcp_resource_default_status", client), McpFixtureProtectedDefaultError);

    await assert.rejects(
      () =>
        updateMcpResourceTemplate(
          "mcp_resource_template_default_customer",
          {
            uriTemplate: "mock://resources/customers/{customerId}",
            name: "customer_profile",
            mimeType: "application/json",
            enabled: false,
            textTemplate: "{\"changed\":true}",
            arguments: [{ name: "customerId", required: true }],
            completionCandidates: [],
          },
          client,
        ),
      McpFixtureProtectedDefaultError,
    );
    await assert.rejects(
      () => deleteMcpResourceTemplate("mcp_resource_template_default_customer", client),
      McpFixtureProtectedDefaultError,
    );

    await assert.rejects(
      () =>
        updateMcpPrompt(
          "mcp_prompt_default_support_reply",
          {
            name: "support_reply",
            enabled: false,
            arguments: [{ name: "customerId", required: true }],
            messages: [{ role: "user", textTemplate: "changed" }],
            completionCandidates: [],
          },
          client,
        ),
      McpFixtureProtectedDefaultError,
    );
    await assert.rejects(() => deleteMcpPrompt("mcp_prompt_default_support_reply", client), McpFixtureProtectedDefaultError);
  });
});

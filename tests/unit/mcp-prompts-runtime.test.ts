import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import test from "node:test";
import { createPrismaClient } from "@/lib/db/client";
import { seedAllDefaults } from "@/lib/db/seed";
import { renderTemplateWithValues } from "@/lib/mcp-fixtures/template-render";
import { createMcpResource, listEnabledMcpPrompts, listEnabledMcpResourceTemplates, readEnabledMcpResource, updateMcpResource } from "@/lib/mcp-fixtures/service";
import type { McpPromptDetail } from "@/lib/mcp-fixtures/types";
import { handleMcpJsonRpcMessage } from "@minasoft/mcp-runtime";
import type { McpCompletionResult, McpPrompt, McpPromptGetResult, McpResourceContent, McpRuntimeProvider } from "@minasoft/mcp-runtime";

const execFileAsync = promisify(execFile);

async function withIsolatedDb(fn: (client: ReturnType<typeof createPrismaClient>) => Promise<void>) {
  const directory = await mkdtemp(join(tmpdir(), "mcp-mock-prompts-runtime-"));
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

function promptFromDetail(prompt: McpPromptDetail): McpPrompt {
  return {
    name: prompt.name,
    title: prompt.title,
    description: prompt.description,
    arguments: prompt.arguments.map((argument) => ({
      name: argument.name,
      title: argument.title,
      description: argument.description,
      required: argument.required,
    })),
  };
}

async function promptGet(prompt: McpPromptDetail, args: Record<string, unknown>, client: ReturnType<typeof createPrismaClient>): Promise<McpPromptGetResult> {
  const values = Object.fromEntries(Object.entries(args).map(([name, value]) => [name, typeof value === "string" ? value : ""]));
  if (prompt.arguments.some((argument) => argument.required && !values[argument.name])) return { kind: "invalid_params", message: "Invalid prompt" };

  const messages: Extract<McpPromptGetResult, { kind: "success" }>["messages"] = [];
  for (const message of prompt.messages) {
    if (message.textTemplate) {
      messages.push({ role: message.role, content: { type: "text", text: renderTemplateWithValues(message.textTemplate, values) } });
    }
    if (message.resourceUri) {
      const content = resourceContent(await readEnabledMcpResource(message.resourceUri, client));
      if (!content) return { kind: "invalid_params", message: "Invalid prompt" };
      messages.push({ role: message.role, content: { type: "resource", resource: content } });
    }
  }
  return { kind: "success", description: prompt.description, messages };
}

function completion(values: string[], prefix: string): McpCompletionResult {
  const matches = values.filter((value) => value.startsWith(prefix));
  return { kind: "success", values: matches.slice(0, 100), total: matches.length, hasMore: matches.length > 100 };
}

test("MCP prompts runtime advertises, lists, renders, and completes seeded prompts", async () => {
  await withIsolatedDb(async (client) => {
    await seedAllDefaults(client);

    const provider: McpRuntimeProvider = {
      prompts: {
        async list() {
          return { items: (await listEnabledMcpPrompts(client)).map(promptFromDetail) };
        },
        async get(input) {
          const prompt = (await listEnabledMcpPrompts(client)).find((item) => item.name === input.name);
          return prompt ? promptGet(prompt, input.arguments ?? {}, client) : { kind: "invalid_params", message: "Invalid prompt" };
        },
        async complete(input) {
          const ref = input.ref;
          if (ref.type === "ref/prompt") {
            const prompt = (await listEnabledMcpPrompts(client)).find((item) => item.name === ref.name);
            return prompt
              ? completion(prompt.completionCandidates.filter((candidate) => candidate.argumentName === input.argument.name).map((candidate) => candidate.value), input.argument.value ?? "")
              : { kind: "invalid_params", message: "Invalid completion ref" };
          }
          const template = (await listEnabledMcpResourceTemplates(client)).find((item) => item.uriTemplate === ref.uri);
          return template
            ? completion(template.completionCandidates.filter((candidate) => candidate.argumentName === input.argument.name).map((candidate) => candidate.value), input.argument.value ?? "")
            : { kind: "invalid_params", message: "Invalid completion ref" };
        },
      },
    };

    const initialize = await handleMcpJsonRpcMessage({ jsonrpc: "2.0", id: "init", method: "initialize" }, provider);
    assert.equal(initialize.kind, "json");
    if (initialize.kind !== "json") return;
    assert.ok("result" in initialize.body);
    const initializeResult = initialize.body.result as { capabilities: Record<string, unknown> };
    assert.deepEqual(initializeResult.capabilities, {
      prompts: { listChanged: true },
      completions: {},
    });

    const list = await handleMcpJsonRpcMessage({ jsonrpc: "2.0", id: "list", method: "prompts/list" }, provider);
    assert.equal(list.kind, "json");
    if (list.kind !== "json") return;
    const listBody = list.body as { result: { prompts: Array<{ name: string }> } };
    assert.deepEqual(listBody.result.prompts.map((prompt) => prompt.name), ["release_notes", "support_reply"]);

    const rendered = await handleMcpJsonRpcMessage(
      { jsonrpc: "2.0", id: "get", method: "prompts/get", params: { name: "support_reply", arguments: { tone: "friendly" } } },
      provider,
    );
    assert.equal(rendered.kind, "json");
    if (rendered.kind !== "json") return;
    const renderedBody = rendered.body as { result: Extract<McpPromptGetResult, { kind: "success" }> };
    assert.match(renderedBody.result.messages[0]?.content.type === "text" ? renderedBody.result.messages[0].content.text : "", /friendly support reply/);
    assert.equal(renderedBody.result.messages[1]?.content.type, "resource");

    const completePrompt = await handleMcpJsonRpcMessage(
      {
        jsonrpc: "2.0",
        id: "complete",
        method: "completion/complete",
        params: { ref: { type: "ref/prompt", name: "support_reply" }, argument: { name: "tone", value: "fri" } },
      },
      provider,
    );
    assert.equal(completePrompt.kind, "json");
    if (completePrompt.kind !== "json") return;
    assert.deepEqual(completePrompt.body, {
      jsonrpc: "2.0",
      id: "complete",
      result: { completion: { values: ["friendly"], total: 1, hasMore: false } },
    });
  });
});

test("MCP prompts runtime returns invalid params for missing args, invalid names, malformed refs, and disabled embedded resources", async () => {
  await withIsolatedDb(async (client) => {
    await seedAllDefaults(client);
    const resource = await createMcpResource(
      { uri: "mock://resources/prompt-hidden", name: "prompt_hidden", mimeType: "text/plain", enabled: true, textContent: "hidden" },
      client,
    );
    await client.mcpPrompt.update({
      where: { name: "release_notes" },
      data: { messages: { update: { where: { promptId_position: { promptId: "mcp_prompt_default_release_notes", position: 0 } }, data: { resourceUri: resource.uri } } } },
    });
    await updateMcpResource(resource.id, { ...resource, enabled: false }, client);

    const provider: McpRuntimeProvider = {
      prompts: {
        async list() {
          return { items: (await listEnabledMcpPrompts(client)).map(promptFromDetail) };
        },
        async get(input) {
          const prompt = (await listEnabledMcpPrompts(client)).find((item) => item.name === input.name);
          return prompt ? promptGet(prompt, input.arguments ?? {}, client) : { kind: "invalid_params", message: "Invalid prompt" };
        },
        async complete() {
          return { kind: "invalid_params", message: "Invalid completion ref" };
        },
      },
    };

    for (const request of [
      { jsonrpc: "2.0", id: "missing", method: "prompts/get", params: { name: "support_reply", arguments: {} } },
      { jsonrpc: "2.0", id: "unknown", method: "prompts/get", params: { name: "missing", arguments: {} } },
      { jsonrpc: "2.0", id: "disabled-embedded", method: "prompts/get", params: { name: "release_notes", arguments: { version: "v1" } } },
      { jsonrpc: "2.0", id: "bad-ref", method: "completion/complete", params: { ref: { type: "ref/prompt" }, argument: { name: "tone" } } },
    ]) {
      const result = await handleMcpJsonRpcMessage(request, provider);
      assert.equal(result.kind, "json");
      if (result.kind !== "json") return;
      assert.ok("error" in result.body);
      assert.equal(result.body.error?.code, -32602);
    }
  });
});

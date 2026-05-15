import { createServer, type Server } from "node:http";
import { spawn } from "node:child_process";
import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";

let server: Server;
let baseUrl = "";

before(async () => {
  server = createServer(async (request, response) => {
    const chunks: Buffer[] = [];
    for await (const chunk of request) chunks.push(Buffer.from(chunk));
    const body = JSON.parse(Buffer.concat(chunks).toString("utf8")) as { id?: string; method?: string; params?: Record<string, unknown> };
    response.setHeader("content-type", "application/json");
    response.setHeader("MCP-Protocol-Version", "2025-06-18");
    if (body.method === "initialize") {
      response.end(JSON.stringify({ jsonrpc: "2.0", id: body.id, result: { protocolVersion: "2025-06-18", capabilities: {} } }));
      return;
    }
    if (body.method === "tools/list") {
      response.end(JSON.stringify({ jsonrpc: "2.0", id: body.id, result: { tools: [{ name: "echo" }] } }));
      return;
    }
    if (body.method === "tools/call") {
      response.end(JSON.stringify({ jsonrpc: "2.0", id: body.id, result: { content: [{ type: "text", text: "hello" }] } }));
      return;
    }
    if (body.method === "resources/read") {
      response.end(JSON.stringify({ jsonrpc: "2.0", id: body.id, result: { contents: [{ uri: body.params?.uri, text: "ok" }] } }));
      return;
    }
    if (body.method === "prompts/get") {
      response.end(JSON.stringify({ jsonrpc: "2.0", id: body.id, result: { messages: [] } }));
      return;
    }
    response.end(JSON.stringify({ jsonrpc: "2.0", id: body.id, result: {} }));
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Missing server address.");
  baseUrl = `http://127.0.0.1:${address.port}/mcp`;
});

after(async () => {
  await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
});

describe("mmcp cli", () => {
  it("prints help", async () => {
    const result = await runMmcp(["--help"]);
    assert.equal(result.code, 0);
    assert.match(result.stdout, /mmcp - command line MCP inspector/);
  });

  it("runs tools list and call", async () => {
    const list = await runMmcp(["tools", "list", baseUrl]);
    assert.equal(list.code, 0);
    assert.match(list.stdout, /MCP tools\/list/);

    const call = await runMmcp(["tools", "call", baseUrl, "--name", "echo", "--arg", "message=hello"]);
    assert.equal(call.code, 0);
    assert.match(call.stdout, /hello/);
  });

  it("runs resources read and prompts get", async () => {
    const resource = await runMmcp(["resources", "read", baseUrl, "--uri", "mock://resources/server-status"]);
    assert.equal(resource.code, 0);
    assert.match(resource.stdout, /resources\/read/);

    const prompt = await runMmcp(["prompts", "get", baseUrl, "--name", "support_reply", "--arg", "tone=friendly"]);
    assert.equal(prompt.code, 0);
    assert.match(prompt.stdout, /prompts\/get/);
  });

  it("returns non-zero for invalid JSON", async () => {
    const result = await runMmcp(["raw", baseUrl, "--method", "resources/list", "--params", "{"]);
    assert.notEqual(result.code, 0);
    assert.match(result.stderr, /JSON/);
  });

  it("returns non-zero for invalid transport", async () => {
    const result = await runMmcp(["tools", "list", baseUrl, "--transport", "see"]);
    assert.notEqual(result.code, 0);
    assert.match(result.stderr, /--transport must be either http or sse/);
  });
});

function runMmcp(args: string[]): Promise<{ code: number | null; stdout: string; stderr: string }> {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, ["dist/bin/mmcp.js", ...args], {
      cwd: new URL("..", import.meta.url),
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.on("close", (code) => resolve({ code, stdout, stderr }));
  });
}

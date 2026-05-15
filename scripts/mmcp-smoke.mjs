#!/usr/bin/env node

import { createServer } from "node:http";
import { spawn } from "node:child_process";
import { Buffer } from "node:buffer";
import { URL } from "node:url";

const server = createServer(async (request, response) => {
  const chunks = [];
  for await (const chunk of request) chunks.push(Buffer.from(chunk));
  const body = JSON.parse(Buffer.concat(chunks).toString("utf8"));
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
  if (body.method === "resources/list") {
    response.end(JSON.stringify({ jsonrpc: "2.0", id: body.id, result: { resources: [{ uri: "mock://resources/server-status", name: "Server status" }] } }));
    return;
  }
  if (body.method === "prompts/list") {
    response.end(JSON.stringify({ jsonrpc: "2.0", id: body.id, result: { prompts: [{ name: "support_reply" }] } }));
    return;
  }
  response.end(JSON.stringify({ jsonrpc: "2.0", id: body.id, result: {} }));
});

await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const address = server.address();
const url = `http://127.0.0.1:${address.port}/mcp`;

try {
  await run(["tools", "list", url, "--format", "json"]);
  await run(["resources", "list", url, "--format", "json"]);
  await run(["prompts", "list", url, "--format", "json"]);
  console.log("mmcp smoke passed");
} finally {
  await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
}

function run(args) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ["packages/mmcp-cli/dist/bin/mmcp.js", ...args], {
      cwd: new URL("..", import.meta.url),
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stderr = "";
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`mmcp ${args.slice(0, 2).join(" ")} failed: ${stderr}`));
    });
  });
}

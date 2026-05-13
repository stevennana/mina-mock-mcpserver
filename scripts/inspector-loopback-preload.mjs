/* global Headers, Request, Response, TextDecoder, URL */
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const handlerPath = path.join(repoRoot, "scripts", "inspector-loopback-handler.ts");
const originalFetch = globalThis.fetch;

function isLoopbackMcpNone(url) {
  return url.protocol === "http:" && url.hostname === "127.0.0.1" && url.port === "3100" && url.pathname === "/mcp/none";
}

function headersFrom(input, init) {
  const headers = new Headers(input instanceof Request ? input.headers : undefined);
  if (init?.headers) {
    new Headers(init.headers).forEach((value, key) => {
      headers.set(key, value);
    });
  }
  return Array.from(headers.entries());
}

async function bodyFrom(input, init) {
  if (init?.body !== undefined && init.body !== null) {
    if (typeof init.body === "string") return init.body;
    if (init.body instanceof Uint8Array) return new TextDecoder().decode(init.body);
    return String(init.body);
  }
  if (input instanceof Request && input.body) {
    return input.clone().text();
  }
  return null;
}

globalThis.fetch = async (input, init) => {
  const url = new URL(input instanceof Request ? input.url : String(input));
  const method = (init?.method ?? (input instanceof Request ? input.method : "GET")).toUpperCase();

  if (!isLoopbackMcpNone(url) || method !== "POST") {
    return originalFetch(input, init);
  }

  const result = spawnSync(
    process.execPath,
    ["--import", "tsx", handlerPath],
    {
      cwd: repoRoot,
      input: JSON.stringify({
        url: url.toString(),
        method,
        headers: headersFrom(input, init),
        body: await bodyFrom(input, init),
      }),
      encoding: "utf8",
    },
  );

  if (result.status !== 0) {
    throw new Error(result.stderr || result.stdout || "Loopback MCP handler failed.");
  }

  const response = JSON.parse(result.stdout);
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: response.headers,
  });
};

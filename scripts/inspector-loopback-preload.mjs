/* global Headers, ReadableStream, Request, Response, TextDecoder, TextEncoder, URL */
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const handlerPath = path.join(repoRoot, "scripts", "inspector-loopback-handler.ts");
const originalFetch = globalThis.fetch;
const sseSessions = new Map();

function isLoopbackMockServer(url) {
  return url.protocol === "http:" && url.hostname === "127.0.0.1" && url.port === "3100";
}

function isLoopbackMcpPost(url) {
  return isLoopbackMockServer(url) && ["/mcp/none", "/mcp/basic"].includes(url.pathname);
}

function isLoopbackSseOpen(url) {
  return isLoopbackMockServer(url) && url.pathname === "/sse/none";
}

function isLoopbackSseMessage(url) {
  return isLoopbackMockServer(url) && url.pathname === "/sse/none/message";
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

function routeMcpPostThroughHandler(url, input, init, method, body) {
  const result = spawnSync(
    process.execPath,
    ["--import", "tsx", handlerPath],
    {
      cwd: repoRoot,
      input: JSON.stringify({
        url: url.toString(),
        method,
        headers: headersFrom(input, init),
        body,
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
}

function openLoopbackSse() {
  const encoder = new TextEncoder();
  const sessionId = `shim-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const stream = new ReadableStream({
    start(controller) {
      sseSessions.set(sessionId, controller);
      controller.enqueue(encoder.encode(`event: endpoint\ndata: /sse/none/message?sessionId=${sessionId}\n\n`));
    },
    cancel() {
      sseSessions.delete(sessionId);
    },
  });
  return new Response(stream, {
    status: 200,
    headers: {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-cache, no-transform",
      connection: "keep-alive",
      "access-control-allow-origin": "*",
      "mcp-protocol-version": "2025-06-18",
    },
  });
}

globalThis.fetch = async (input, init) => {
  const url = new URL(input instanceof Request ? input.url : String(input));
  const method = (init?.method ?? (input instanceof Request ? input.method : "GET")).toUpperCase();

  if (isLoopbackSseOpen(url) && method === "GET") {
    return openLoopbackSse();
  }

  if (isLoopbackSseMessage(url) && method === "POST") {
    const sessionId = url.searchParams.get("sessionId");
    const controller = sessionId ? sseSessions.get(sessionId) : null;
    if (!controller) return new Response("Unknown SSE session.", { status: 404 });

    const body = await bodyFrom(input, init);
    const mcpResponse = routeMcpPostThroughHandler(new URL("/mcp/none", url), input, init, method, body);
    const text = await mcpResponse.text();
    controller.enqueue(new TextEncoder().encode(`event: message\ndata: ${text}\n\n`));
    return new Response(null, {
      status: 202,
      headers: {
        "access-control-allow-origin": "*",
        "mcp-protocol-version": "2025-06-18",
      },
    });
  }

  if (!isLoopbackMcpPost(url) || method !== "POST") {
    return originalFetch(input, init);
  }

  return routeMcpPostThroughHandler(url, input, init, method, await bodyFrom(input, init));
};

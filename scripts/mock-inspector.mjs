#!/usr/bin/env node

/* global Request */
import { Buffer } from "node:buffer";
import { URL, URLSearchParams } from "node:url";
import { TextDecoder } from "node:util";
import { fetchWithTls } from "./lib/fetch-with-tls.mjs";

const DEFAULT_BASE_URL = process.env.MCP_MOCK_BASE_URL ?? "http://127.0.0.1:3100";
const DEFAULT_DELETE_CODE = "87654321";

function parseArgs(argv) {
  const options = {
    baseUrl: DEFAULT_BASE_URL,
    includeReset: false,
    rootPassword: process.env.ROOT_PASSWORD ?? "",
    insecureTls: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--base-url") {
      options.baseUrl = argv[index + 1] ?? options.baseUrl;
      index += 1;
    } else if (arg === "--include-reset") {
      options.includeReset = true;
    } else if (arg === "--root-password") {
      options.rootPassword = argv[index + 1] ?? "";
      index += 1;
    } else if (arg === "--insecure-tls") {
      options.insecureTls = true;
    } else if (arg === "--help" || arg === "-h") {
      printHelp();
      process.exit(0);
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  options.baseUrl = options.baseUrl.replace(/\/+$/, "");
  return options;
}

function printHelp() {
  console.log(`MCP Mock Server local inspector

Usage:
  npm run inspector:mock
  npm run inspector:mock -- --base-url http://127.0.0.1:3100
  ROOT_PASSWORD=change-this npm run inspector:mock -- --include-reset

Options:
  --base-url <url>       Mock server base URL. Defaults to MCP_MOCK_BASE_URL or ${DEFAULT_BASE_URL}
  --include-reset        Also verify root-protected reset. Requires --root-password or ROOT_PASSWORD.
  --root-password <pw>   Root password for reset verification.
  --insecure-tls         Allow self-signed or untrusted HTTPS certificates for local tests.
`);
}

function logStep(message) {
  console.log(`\n== ${message}`);
}

function pass(message) {
  console.log(`OK ${message}`);
}

function addDiagnostic(diagnostics, check, value) {
  diagnostics.push({ check, value: String(value) });
}

function printDiagnostics(diagnostics) {
  const checkWidth = Math.max("Check".length, ...diagnostics.map((item) => item.check.length));
  const valueWidth = Math.max("Evidence".length, ...diagnostics.map((item) => item.value.length));
  const line = `+-${"-".repeat(checkWidth)}-+-${"-".repeat(valueWidth)}-+`;

  console.log("\n== Protocol diagnostics");
  console.log(line);
  console.log(`| ${"Check".padEnd(checkWidth)} | ${"Evidence".padEnd(valueWidth)} |`);
  console.log(line);
  for (const item of diagnostics) {
    console.log(`| ${item.check.padEnd(checkWidth)} | ${item.value.padEnd(valueWidth)} |`);
  }
  console.log(line);
}

function decodeJwt(token) {
  const [, payload] = token.split(".");
  if (!payload) throw new Error("Access token is not a JWT.");
  return JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
}

function basic(username, password) {
  return `Basic ${Buffer.from(`${username}:${password}`, "utf8").toString("base64")}`;
}

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isLoopbackBaseUrl(baseUrl) {
  try {
    const url = new URL(baseUrl);
    return url.protocol === "http:" && url.hostname === "127.0.0.1";
  } catch {
    return false;
  }
}

function shouldUseLocalRouteFallback(baseUrl, error) {
  const code = error?.cause?.code ?? error?.code;
  return isLoopbackBaseUrl(baseUrl) && (code === "EPERM" || code === "ECONNREFUSED");
}

async function routeModuleFor(pathname) {
  const dynamicRoutes = [
    [/^\/api\/endpoints\/([^/]+)$/, "../app/api/endpoints/[id]/route.ts", (match) => ({ id: match[1] })],
    [/^\/api\/basic-users\/([^/]+)$/, "../app/api/basic-users/[id]/route.ts", (match) => ({ id: match[1] })],
    [/^\/api\/oauth-users\/([^/]+)$/, "../app/api/oauth-users/[id]/route.ts", (match) => ({ id: match[1] })],
    [/^\/api\/oauth-clients\/([^/]+)$/, "../app/api/oauth-clients/[id]/route.ts", (match) => ({ id: match[1] })],
    [/^\/api\/oauth\/tokens\/([^/]+)\/revoke$/, "../app/api/oauth/tokens/[jti]/revoke/route.ts", (match) => ({ jti: match[1] })],
    [/^\/api\/resources\/([^/]+)$/, "../app/api/resources/[id]/route.ts", (match) => ({ id: match[1] })],
    [/^\/api\/prompts\/([^/]+)$/, "../app/api/prompts/[id]/route.ts", (match) => ({ id: match[1] })],
    [/^\/rest\/tools\/([^/]+)\/call$/, "../app/rest/tools/[name]/call/route.ts", (match) => ({ name: decodeURIComponent(match[1]) })],
  ];

  for (const [pattern, modulePath, paramsForMatch] of dynamicRoutes) {
    const match = pathname.match(pattern);
    if (match) return { module: await import(modulePath), params: paramsForMatch(match) };
  }

  const staticRoutes = {
    "/api/health": "../app/api/health/route.ts",
    "/api/config": "../app/api/config/route.ts",
    "/api/endpoints": "../app/api/endpoints/route.ts",
    "/api/basic-users": "../app/api/basic-users/route.ts",
    "/api/oauth-users": "../app/api/oauth-users/route.ts",
    "/api/oauth-clients": "../app/api/oauth-clients/route.ts",
    "/api/oauth/tokens": "../app/api/oauth/tokens/route.ts",
    "/api/resources": "../app/api/resources/route.ts",
    "/api/prompts": "../app/api/prompts/route.ts",
    "/api/audit": "../app/api/audit/route.ts",
    "/api/reset": "../app/api/reset/route.ts",
    "/.well-known/oauth-authorization-server": "../app/.well-known/oauth-authorization-server/route.ts",
    "/.well-known/oauth-protected-resource": "../app/.well-known/oauth-protected-resource/route.ts",
    "/oauth/jwks": "../app/oauth/jwks/route.ts",
    "/oauth/token": "../app/oauth/token/route.ts",
    "/mcp/none": "../app/mcp/none/route.ts",
    "/mcp/basic": "../app/mcp/basic/route.ts",
    "/mcp/oauth": "../app/mcp/oauth/route.ts",
    "/rest/tools": "../app/rest/tools/route.ts",
    "/sse/none": "../app/sse/none/route.ts",
    "/sse/none/message": "../app/sse/none/message/route.ts",
  };
  const modulePath = staticRoutes[pathname];
  if (!modulePath) return null;
  return { module: await import(modulePath), params: {} };
}

async function localRouteFetch(baseUrl, path, options = {}) {
  const url = new URL(path, baseUrl);
  const route = await routeModuleFor(url.pathname);
  if (!route) throw new Error(`No local route fallback for ${url.pathname}.`);
  const method = String(options.method ?? "GET").toUpperCase();
  const handler = route.module[method];
  if (typeof handler !== "function") throw new Error(`No ${method} handler for ${url.pathname}.`);
  const request = new Request(url.toString(), {
    method,
    headers: options.headers,
    body: options.body,
    signal: options.signal,
  });
  return handler(request, { params: Promise.resolve(route.params) });
}

class Client {
  constructor(baseUrl, options = {}) {
    this.baseUrl = baseUrl;
    this.insecureTls = Boolean(options.insecureTls);
  }

  url(path) {
    return `${this.baseUrl}${path}`;
  }

  async request(path, options = {}) {
    const response = await this.fetchPath(path, options);
    const contentType = response.headers.get("content-type") ?? "";
    const text = await response.text();
    const body = contentType.includes("application/json") && text ? JSON.parse(text) : text;
    return { response, body };
  }

  async fetchPath(path, options = {}) {
    try {
      return await fetchWithTls(this.url(path), options, { insecureTls: this.insecureTls });
    } catch (error) {
      if (!shouldUseLocalRouteFallback(this.baseUrl, error)) throw error;
      return localRouteFetch(this.baseUrl, path, options);
    }
  }

  async json(method, path, body, headers = {}) {
    return this.request(path, {
      method,
      headers: { "content-type": "application/json", ...headers },
      body: JSON.stringify(body),
    });
  }

  async form(path, fields) {
    const body = new URLSearchParams();
    for (const [key, value] of Object.entries(fields)) {
      body.set(key, value);
    }
    return this.request(path, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body,
    });
  }
}

function assertStatus(result, expected, label) {
  if (result.response.status !== expected) {
    throw new Error(`${label} expected HTTP ${expected}, got ${result.response.status}: ${JSON.stringify(result.body)}`);
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function mcp(client, path, message, headers = {}) {
  return client.json("POST", path, message, {
    Accept: "application/json, text/event-stream",
    "MCP-Protocol-Version": "2025-06-18",
    ...headers,
  });
}

async function readSseUntil(reader, predicate, maxChunks = 8) {
  const decoder = new TextDecoder();
  let text = "";
  for (let index = 0; index < maxChunks && !predicate(text); index += 1) {
    const chunk = await reader.read();
    text += decoder.decode(chunk.value ?? new Uint8Array(), { stream: !chunk.done });
    if (chunk.done) break;
  }
  return text;
}

async function verifyLegacySseToolsList(client) {
  const controller = new globalThis.AbortController();
  let reader = null;
  try {
    const response = await client.fetchPath("/sse/none", {
      headers: { Accept: "text/event-stream" },
      signal: controller.signal,
    });
    assert(response.status === 200, `Legacy SSE expected HTTP 200, got ${response.status}.`);
    assert(response.headers.get("content-type")?.includes("text/event-stream"), "Legacy SSE must return text/event-stream.");
    assert(response.body, "Legacy SSE response must expose a readable body.");

    reader = response.body.getReader();
    const opening = await readSseUntil(reader, (text) => text.includes("event: endpoint"));
    const endpoint = opening.match(/data: (\/sse\/none\/message\?sessionId=[^\n]+)/)?.[1]?.trim();
    assert(endpoint, "Legacy SSE must emit a message endpoint.");

    const posted = await mcp(client, endpoint, { jsonrpc: "2.0", id: "inspector-sse-list", method: "tools/list" });
    assertStatus(posted, 202, "Legacy SSE message POST");
    const event = await readSseUntil(reader, (text) => text.includes('"id":"inspector-sse-list"'));
    assert(event.includes("event: message"), "Legacy SSE must send JSON-RPC responses as message events.");
    assert(event.includes('"id":"inspector-sse-list"'), "Legacy SSE response must include the original JSON-RPC id.");
  } finally {
    try {
      await reader?.cancel();
    } catch {
      // The stream may already be closed after the abort signal.
    }
    controller.abort();
  }
}

async function createEndpoint(client, name) {
  const result = await client.json("POST", "/api/endpoints", {
    name,
    title: "Inspector temporary endpoint",
    description: "Created by the local inspector smoke client.",
    enabled: true,
    deleteCode: DEFAULT_DELETE_CODE,
    defaultResponseJson: JSON.stringify({ ok: true, source: "default" }),
    failureMode: "none",
    failureDelayMs: 0,
    parameters: [
      {
        name: "city",
        label: "City",
        description: "City exact-match key.",
        type: "string",
        required: true,
        defaultValueJson: null,
      },
    ],
    responseCases: [
      {
        name: "default",
        priority: 0,
        matchArgsJson: "{}",
        responseJson: JSON.stringify({ ok: true, source: "default" }),
        statusCode: 200,
        delayMs: 0,
        errorMode: "none",
        isDefault: true,
      },
      {
        name: "seoul",
        priority: 10,
        matchArgsJson: JSON.stringify({ city: "Seoul" }),
        responseJson: JSON.stringify({ ok: true, city: "Seoul", temperature: 22 }),
        statusCode: 201,
        delayMs: 0,
        errorMode: "none",
        isDefault: false,
      },
      {
        name: "forced-error",
        priority: 20,
        matchArgsJson: JSON.stringify({ city: "Error" }),
        responseJson: JSON.stringify({ unused: true }),
        statusCode: 200,
        delayMs: 0,
        errorMode: "error",
        errorStatusCode: 503,
        errorMessage: "Inspector forced error.",
        errorBodyJson: JSON.stringify({ error: "inspector_forced_error", message: "Inspector forced error." }),
        isDefault: false,
      },
    ],
  });
  assertStatus(result, 201, "Create endpoint");
  return result.body.endpoint;
}

async function createResource(client, stamp) {
  const result = await client.json("POST", "/api/resources", {
    uri: `mock://resources/inspector-${stamp}`,
    name: `inspector_resource_${stamp}`,
    title: "Inspector temporary resource",
    description: "Created by the local inspector smoke client.",
    mimeType: "text/plain",
    enabled: true,
    textContent: `inspector resource body ${stamp}`,
    annotationsJson: JSON.stringify({ audience: ["assistant"] }),
  });
  assertStatus(result, 201, "Create MCP resource");
  return result.body.resource;
}

async function createPrompt(client, stamp) {
  const result = await client.json("POST", "/api/prompts", {
    name: `inspector_prompt_${stamp}`,
    title: "Inspector temporary prompt",
    description: "Created by the local inspector smoke client.",
    enabled: true,
    arguments: [{ name: "tone", title: "Tone", description: "Reply tone.", required: true }],
    messages: [{ role: "user", textTemplate: "Write a {tone} inspector summary." }],
    completionCandidates: [{ argumentName: "tone", value: "friendly", label: "Friendly" }],
  });
  assertStatus(result, 201, "Create MCP prompt");
  return result.body.prompt;
}

async function safeDelete(client, label, path, body) {
  try {
    const result = body === undefined ? await client.request(path, { method: "DELETE" }) : await client.json("DELETE", path, body);
    if (result.response.status >= 400 && result.response.status !== 404) {
      console.warn(`WARN cleanup failed for ${label}: HTTP ${result.response.status}`);
    }
  } catch (error) {
    console.warn(`WARN cleanup failed for ${label}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

async function run(options) {
  const client = new Client(options.baseUrl, { insecureTls: options.insecureTls });
  const stamp = Date.now();
  const endpointName = `inspector_${stamp}`;
  const basicUsername = `inspector_basic_${stamp}`;
  const basicPassword = "inspector-basic-secret";
  const oauthUsername = `inspector_oauth_${stamp}`;
  const oauthPassword = "inspector-oauth-secret";
  const clientId = `inspector-client-${stamp}`;
  const protectedResourceMetadataUrl = `${options.baseUrl}/.well-known/oauth-protected-resource`;
  const cleanup = {
    endpointId: "",
    basicUserId: "",
    oauthUserId: "",
    oauthClientId: "",
    resourceId: "",
    promptId: "",
    revokedTokenJti: "",
  };
  const diagnostics = [];
  addDiagnostic(diagnostics, "target", options.baseUrl);
  addDiagnostic(diagnostics, "tls verification", options.insecureTls ? "self-signed allowed" : "default");

  try {
    logStep("Health and operator config");
    const health = await client.request("/api/health");
    assertStatus(health, 200, "Health");
    assert(health.body.status === "ok", "Health status must be ok.");
    pass("health reports ok");

    const config = await client.request("/api/config");
    assertStatus(config, 200, "Operator config");
    assert(isRecord(config.body.routes?.mcp), "Operator config must expose MCP routes.");
    addDiagnostic(diagnostics, "health", health.body.status);
    addDiagnostic(diagnostics, "mcp route", config.body.routes.mcp.noAuth ?? "/mcp/none");
    pass("operator config exposes route map");

    const discovery = await client.request("/.well-known/oauth-authorization-server");
    assertStatus(discovery, 200, "OAuth authorization metadata");
    assert(discovery.body.issuer === options.baseUrl, "OAuth issuer must match inspector base URL.");
    assert(discovery.body.token_endpoint === `${options.baseUrl}/oauth/token`, "OAuth token endpoint must match base URL.");
    assert(Array.isArray(discovery.body.code_challenge_methods_supported), "OAuth discovery must report PKCE support state.");
    assert(discovery.body.code_challenge_methods_supported.includes("S256"), "OAuth discovery must advertise implemented PKCE S256 support.");
    assert(discovery.body.revocation_endpoint === `${options.baseUrl}/oauth/revoke`, "OAuth discovery must advertise standard revocation.");
    addDiagnostic(diagnostics, "oauth issuer", discovery.body.issuer);
    addDiagnostic(diagnostics, "pkce advertised", discovery.body.code_challenge_methods_supported.join(","));
    addDiagnostic(diagnostics, "oauth revocation", discovery.body.revocation_endpoint);

    const protectedResource = await client.request("/.well-known/oauth-protected-resource");
    assertStatus(protectedResource, 200, "OAuth protected-resource metadata");
    assert(
      protectedResource.body.authorization_servers?.includes(`${options.baseUrl}/.well-known/oauth-authorization-server`),
      "Protected-resource metadata must link to authorization-server metadata.",
    );
    addDiagnostic(diagnostics, "protected resource", protectedResource.body.resource);

    const jwks = await client.request("/oauth/jwks");
    assertStatus(jwks, 200, "OAuth JWKS");
    assert(Array.isArray(jwks.body.keys), "JWKS must contain keys.");
    addDiagnostic(diagnostics, "jwks keys", jwks.body.keys.length);
    pass("OAuth discovery and JWKS respond");

    logStep("Endpoint, REST, and MCP runtime");
    const endpoint = await createEndpoint(client, endpointName);
    cleanup.endpointId = endpoint.id;
    pass(`created endpoint ${endpointName}`);

    const endpointDetail = await client.request(`/api/endpoints/${endpoint.id}`);
    assertStatus(endpointDetail, 200, "Endpoint detail");
    assert(endpointDetail.body.endpoint.name === endpointName, "Endpoint detail returned wrong endpoint.");

    const endpointUpdate = await client.json("PATCH", `/api/endpoints/${endpoint.id}`, {
      ...endpointDetail.body.endpoint,
      title: "Inspector temporary endpoint updated",
      deleteCode: DEFAULT_DELETE_CODE,
    });
    assertStatus(endpointUpdate, 200, "Endpoint update");
    pass("endpoint detail and update work");

    const restList = await client.request("/rest/tools");
    assertStatus(restList, 200, "REST tools list");
    assert(restList.body.tools.some((tool) => tool.name === endpointName), "REST tools list must include temporary endpoint.");

    const restCall = await client.json("POST", `/rest/tools/${endpointName}/call`, { arguments: { city: "Seoul" } });
    assertStatus(restCall, 201, "REST tool call");
    assert(restCall.body.city === "Seoul", "REST tool call returned unexpected body.");

    const restForcedError = await client.json("POST", `/rest/tools/${endpointName}/call`, { arguments: { city: "Error" } });
    assertStatus(restForcedError, 503, "REST forced error");
    assert(restForcedError.body.error === "inspector_forced_error", "REST forced error body mismatch.");
    pass("REST list, call, and forced error work");

    const mcpInitialize = await mcp(client, "/mcp/none", {
      jsonrpc: "2.0",
      id: "initialize",
      method: "initialize",
      params: {
        protocolVersion: "2025-06-18",
        capabilities: {},
        clientInfo: { name: "mina-mock-local-inspector", version: "1.0.0" },
      },
    });
    assertStatus(mcpInitialize, 200, "MCP initialize");
    assert(mcpInitialize.body.result.protocolVersion === "2025-06-18", "MCP initialize must negotiate 2025-06-18.");
    assert(
      mcpInitialize.response.headers.get("mcp-protocol-version") === "2025-06-18",
      "MCP response must include MCP-Protocol-Version.",
    );
    addDiagnostic(diagnostics, "mcp negotiated", mcpInitialize.body.result.protocolVersion);
    addDiagnostic(diagnostics, "mcp response header", mcpInitialize.response.headers.get("mcp-protocol-version"));

    const unsupportedMcpVersion = await client.json(
      "POST",
      "/mcp/none",
      { jsonrpc: "2.0", id: "bad-version", method: "tools/list" },
      {
        Accept: "application/json, text/event-stream",
        "MCP-Protocol-Version": "1900-01-01",
      },
    );
    assertStatus(unsupportedMcpVersion, 400, "Unsupported MCP protocol version");
    assert(
      unsupportedMcpVersion.body.error?.message === "Unsupported MCP protocol version.",
      "Unsupported MCP protocol version must return deterministic JSON-RPC error.",
    );
    addDiagnostic(diagnostics, "bad mcp version", "400");

    const foreignOrigin = await client.json(
      "POST",
      "/mcp/none",
      { jsonrpc: "2.0", id: "inspector-origin", method: "tools/list" },
      {
        Accept: "application/json, text/event-stream",
        "MCP-Protocol-Version": "2025-06-18",
        Origin: "https://invalid.example",
      },
    );
    assertStatus(foreignOrigin, 200, "Browser Inspector CORS-open Origin");
    assert(
      foreignOrigin.response.headers.get("access-control-allow-origin") === "*",
      "MCP responses must be CORS-open for browser Inspector compatibility.",
    );
    addDiagnostic(diagnostics, "origin cors", foreignOrigin.response.headers.get("access-control-allow-origin"));

    const mcpList = await mcp(client, "/mcp/none", { jsonrpc: "2.0", id: 1, method: "tools/list" });
    assertStatus(mcpList, 200, "MCP tools/list");
    assert(mcpList.body.result.tools.some((tool) => tool.name === endpointName), "MCP tools/list must include endpoint.");

    const mcpCall = await mcp(client, "/mcp/none", {
      jsonrpc: "2.0",
      id: 2,
      method: "tools/call",
      params: { name: endpointName, arguments: { city: "Seoul" } },
    });
    assertStatus(mcpCall, 200, "MCP tools/call");
    assert(mcpCall.body.result.structuredContent.city === "Seoul", "MCP tools/call structured content mismatch.");
    await verifyLegacySseToolsList(client);
    addDiagnostic(diagnostics, "legacy sse", "tools/list via /sse/none");
    pass("MCP tools/list, tools/call, and legacy SSE work");

    logStep("Resources, prompts, completion, and SSE notifications");
    const resource = await createResource(client, stamp);
    cleanup.resourceId = resource.id;
    const prompt = await createPrompt(client, stamp);
    cleanup.promptId = prompt.id;

    const resourcesList = await mcp(client, "/mcp/none", { jsonrpc: "2.0", id: "resources-list", method: "resources/list" });
    assertStatus(resourcesList, 200, "MCP resources/list");
    assert(
      resourcesList.body.result.resources.some((item) => item.uri === resource.uri),
      "MCP resources/list must include temporary resource.",
    );

    const resourceRead = await mcp(client, "/mcp/none", {
      jsonrpc: "2.0",
      id: "resources-read",
      method: "resources/read",
      params: { uri: resource.uri },
    });
    assertStatus(resourceRead, 200, "MCP resources/read");
    assert(resourceRead.body.result.contents[0].text === resource.textContent, "MCP resources/read text mismatch.");

    const templatesList = await mcp(client, "/mcp/none", {
      jsonrpc: "2.0",
      id: "resource-templates",
      method: "resources/templates/list",
    });
    assertStatus(templatesList, 200, "MCP resources/templates/list");
    assert(
      templatesList.body.result.resourceTemplates.some((item) => item.uriTemplate === "mock://resources/customers/{customerId}"),
      "MCP resources/templates/list must include seeded customer template.",
    );

    const promptsList = await mcp(client, "/mcp/none", { jsonrpc: "2.0", id: "prompts-list", method: "prompts/list" });
    assertStatus(promptsList, 200, "MCP prompts/list");
    assert(promptsList.body.result.prompts.some((item) => item.name === prompt.name), "MCP prompts/list must include temporary prompt.");

    const promptGet = await mcp(client, "/mcp/none", {
      jsonrpc: "2.0",
      id: "prompts-get",
      method: "prompts/get",
      params: { name: prompt.name, arguments: { tone: "friendly" } },
    });
    assertStatus(promptGet, 200, "MCP prompts/get");
    assert(
      promptGet.body.result.messages[0].content.text === "Write a friendly inspector summary.",
      "MCP prompts/get message mismatch.",
    );

    const completion = await mcp(client, "/mcp/none", {
      jsonrpc: "2.0",
      id: "completion",
      method: "completion/complete",
      params: { ref: { type: "ref/prompt", name: prompt.name }, argument: { name: "tone", value: "fri" } },
    });
    assertStatus(completion, 200, "MCP completion/complete");
    assert(completion.body.result.completion.values.includes("friendly"), "MCP completion/complete must return prompt candidate.");

    const controller = new globalThis.AbortController();
    let reader = null;
    try {
      const response = await client.fetchPath("/sse/none", { headers: { Accept: "text/event-stream" }, signal: controller.signal });
      assert(response.status === 200, `Legacy SSE expected HTTP 200, got ${response.status}.`);
      assert(response.body, "Legacy SSE response must expose a readable body.");
      reader = response.body.getReader();
      const opening = await readSseUntil(reader, (text) => text.includes("event: endpoint"));
      const endpoint = opening.match(/data: (\/sse\/none\/message\?sessionId=[^\n]+)/)?.[1]?.trim();
      assert(endpoint, "Legacy SSE must emit a message endpoint.");
      const subscribe = await mcp(client, endpoint, {
        jsonrpc: "2.0",
        id: "inspector-subscribe",
        method: "resources/subscribe",
        params: { uri: resource.uri },
      });
      assertStatus(subscribe, 202, "Legacy SSE resources/subscribe POST");
      const subscribeEvent = await readSseUntil(reader, (text) => text.includes('"id":"inspector-subscribe"'));
      assert(subscribeEvent.includes('"result":{}'), "Legacy SSE subscribe must return empty success result.");
      const updatedResource = await client.json("PATCH", `/api/resources/${resource.id}`, {
        ...resource,
        textContent: `updated inspector resource body ${stamp}`,
      });
      assertStatus(updatedResource, 200, "Update subscribed resource");
      const updateEvent = await readSseUntil(reader, (text) => text.includes("notifications/resources/updated"), 12);
      assert(updateEvent.includes(resource.uri), "Legacy SSE subscription must emit resource update notification.");
    } finally {
      try {
        await reader?.cancel();
      } catch {
        // The stream may already be closed after the abort signal.
      }
      controller.abort();
    }

    addDiagnostic(diagnostics, "resources", "list/read/templates");
    addDiagnostic(diagnostics, "prompts", "list/get");
    addDiagnostic(diagnostics, "completion", "prompt candidate");
    addDiagnostic(diagnostics, "sse notifications", "resources/updated");
    pass("resources, prompts, completion, and SSE subscription notification work");

    logStep("Basic Auth management and runtime");
    const basicCreate = await client.json("POST", "/api/basic-users", {
      username: basicUsername,
      password: basicPassword,
      enabled: true,
    });
    assertStatus(basicCreate, 201, "Create Basic user");
    cleanup.basicUserId = basicCreate.body.user.id;

    const basicHeader = { Authorization: basic(basicUsername, basicPassword) };
    const basicRest = await client.json("POST", `/rest/tools/${endpointName}/call`, { arguments: { city: "Seoul" } }, basicHeader);
    assertStatus(basicRest, 201, "REST Basic tool call");
    assert(basicRest.response.headers.get("x-mcp-mock-principal") === `basic:${basicUsername}`, "REST Basic principal mismatch.");

    const basicMcp = await mcp(
      client,
      "/mcp/basic",
      { jsonrpc: "2.0", id: 3, method: "tools/list" },
      basicHeader,
    );
    assertStatus(basicMcp, 200, "Strict Basic MCP tools/list");

    const basicDisable = await client.json("PATCH", `/api/basic-users/${cleanup.basicUserId}`, { enabled: false });
    assertStatus(basicDisable, 200, "Disable Basic user");
    const basicDisabled = await mcp(
      client,
      "/mcp/basic",
      { jsonrpc: "2.0", id: 4, method: "tools/list" },
      basicHeader,
    );
    assertStatus(basicDisabled, 401, "Disabled Basic user rejection");
    pass("Basic user create, runtime auth, disable, and rejection work");

    logStep("OAuth users, clients, Bearer permissions, tokens, and revocation");
    const missingBearer = await mcp(client, "/mcp/oauth", { jsonrpc: "2.0", id: "missing-bearer", method: "tools/list" });
    assertStatus(missingBearer, 401, "Strict OAuth missing Bearer challenge");
    const missingBearerChallenge = missingBearer.response.headers.get("www-authenticate") ?? "";
    assert(missingBearerChallenge.includes("Bearer"), "Strict OAuth 401 must include Bearer challenge.");
    assert(
      missingBearerChallenge.includes(`resource_metadata="${protectedResourceMetadataUrl}"`),
      "Strict OAuth 401 must point to protected-resource metadata.",
    );
    addDiagnostic(diagnostics, "bearer challenge", "resource_metadata");

    const oauthUserCreate = await client.json("POST", "/api/oauth-users", {
      username: oauthUsername,
      password: oauthPassword,
      enabled: true,
      accessTokenTtlSeconds: 900,
    });
    assertStatus(oauthUserCreate, 201, "Create OAuth user");
    cleanup.oauthUserId = oauthUserCreate.body.user.id;

    const oauthUserUpdate = await client.json("PATCH", `/api/oauth-users/${cleanup.oauthUserId}`, {
      accessTokenTtlSeconds: 86400,
    });
    assertStatus(oauthUserUpdate, 200, "Update OAuth user");

    const oauthClientCreate = await client.json("POST", "/api/oauth-clients", {
      clientId,
      displayName: "Inspector client",
      enabled: true,
      redirectUris: ["http://localhost:3000/oauth/callback"],
      clientCredentialsTtlSeconds: 900,
      allowedEndpointIds: [endpoint.id],
      allowedResourceIds: [resource.id],
      allowedResourceTemplateIds: ["mcp_resource_template_default_customer"],
      allowedPromptIds: [prompt.id],
    });
    assertStatus(oauthClientCreate, 201, "Create OAuth client");
    cleanup.oauthClientId = oauthClientCreate.body.client.id;
    const clientSecret = oauthClientCreate.body.clientSecret;
    assert(typeof clientSecret === "string" && clientSecret.length > 0, "OAuth client secret must be returned once.");

    const token = await client.form("/oauth/token", {
      grant_type: "client_credentials",
      client_id: clientId,
      client_secret: clientSecret,
      resource: options.baseUrl,
    });
    assertStatus(token, 200, "OAuth client_credentials token");
    assert(token.body.token_type === "Bearer", "OAuth token type mismatch.");
    const bearerHeader = { Authorization: `Bearer ${token.body.access_token}` };
    const claims = decodeJwt(token.body.access_token);
    cleanup.revokedTokenJti = claims.jti;
    assert(claims.endpoint_permissions.includes(endpoint.id), "OAuth token must include endpoint permission.");
    assert(claims.resource_permissions.includes(resource.id), "OAuth token must include resource permission.");
    assert(
      claims.resource_template_permissions.includes("mcp_resource_template_default_customer"),
      "OAuth token must include resource template permission.",
    );
    assert(claims.prompt_permissions.includes(prompt.id), "OAuth token must include prompt permission.");
    assert(claims.aud === options.baseUrl, "OAuth token audience must match requested resource.");
    addDiagnostic(diagnostics, "jwt audience", claims.aud);
    addDiagnostic(
      diagnostics,
      "jwt permissions",
      `${claims.endpoint_permissions.length} tools, ${claims.resource_permissions.length} resources, ${claims.resource_template_permissions.length} templates, ${claims.prompt_permissions.length} prompts`,
    );

    const tokenList = await client.request("/api/oauth/tokens");
    assertStatus(tokenList, 200, "Issued token list");
    assert(JSON.stringify(tokenList.body).includes(claims.jti), "Issued token list must include created token jti.");

    const oauthMcpList = await mcp(client, "/mcp/oauth", { jsonrpc: "2.0", id: 5, method: "tools/list" }, bearerHeader);
    assertStatus(oauthMcpList, 200, "OAuth MCP tools/list");
    const oauthToolNames = oauthMcpList.body.result.tools.map((tool) => tool.name);
    assert(oauthToolNames.includes(endpointName), "OAuth MCP tools/list must include permitted endpoint.");
    assert(!oauthToolNames.includes("echo"), "OAuth MCP tools/list must filter non-permitted echo endpoint.");

    const oauthResourcesList = await mcp(client, "/mcp/oauth", { jsonrpc: "2.0", id: "oauth-resources", method: "resources/list" }, bearerHeader);
    assertStatus(oauthResourcesList, 200, "OAuth MCP resources/list");
    const oauthResourceUris = oauthResourcesList.body.result.resources.map((item) => item.uri);
    assert(oauthResourceUris.includes(resource.uri), "OAuth resources/list must include permitted resource.");
    assert(!oauthResourceUris.includes("mock://resources/server-status"), "OAuth resources/list must filter non-permitted resources.");

    const oauthTemplatesList = await mcp(
      client,
      "/mcp/oauth",
      { jsonrpc: "2.0", id: "oauth-templates", method: "resources/templates/list" },
      bearerHeader,
    );
    assertStatus(oauthTemplatesList, 200, "OAuth MCP resources/templates/list");
    const oauthTemplateUris = oauthTemplatesList.body.result.resourceTemplates.map((item) => item.uriTemplate);
    assert(
      oauthTemplateUris.includes("mock://resources/customers/{customerId}"),
      "OAuth resources/templates/list must include permitted resource template.",
    );

    const oauthTemplateRead = await mcp(
      client,
      "/mcp/oauth",
      {
        jsonrpc: "2.0",
        id: "oauth-template-read",
        method: "resources/read",
        params: { uri: "mock://resources/customers/cust_123" },
      },
      bearerHeader,
    );
    assertStatus(oauthTemplateRead, 200, "OAuth MCP templated resources/read");
    assert(
      oauthTemplateRead.body.result.contents[0].text.includes('"customerId":"cust_123"'),
      "OAuth templated resources/read must render permitted resource template.",
    );

    const oauthPromptGet = await mcp(
      client,
      "/mcp/oauth",
      { jsonrpc: "2.0", id: "oauth-prompt", method: "prompts/get", params: { name: prompt.name, arguments: { tone: "friendly" } } },
      bearerHeader,
    );
    assertStatus(oauthPromptGet, 200, "OAuth MCP prompts/get");

    const oauthRestAllowed = await client.json(
      "POST",
      `/rest/tools/${endpointName}/call`,
      { arguments: { city: "Seoul" } },
      bearerHeader,
    );
    assertStatus(oauthRestAllowed, 201, "OAuth REST allowed call");

    const oauthRestDenied = await client.json("POST", "/rest/tools/echo/call", { arguments: { message: "hello" } }, bearerHeader);
    assertStatus(oauthRestDenied, 403, "OAuth REST denied call");
    addDiagnostic(diagnostics, "oauth denied call", "403");

    const revoke = await client.request(`/api/oauth/tokens/${claims.jti}/revoke`, { method: "POST" });
    assertStatus(revoke, 200, "Token revocation");
    const revokedCall = await client.request("/rest/tools", { headers: bearerHeader });
    assertStatus(revokedCall, 401, "Revoked token rejection");
    const revokedChallenge = revokedCall.response.headers.get("www-authenticate") ?? "";
    assert(revokedChallenge.includes('error="invalid_token"'), "Revoked token challenge must include invalid_token.");
    assert(
      revokedChallenge.includes(`resource_metadata="${protectedResourceMetadataUrl}"`),
      "Revoked token challenge must point to protected-resource metadata.",
    );
    addDiagnostic(diagnostics, "revoked token", "401 invalid_token");
    pass("OAuth user/client/token, tool/resource/template/prompt permission filtering, denial, and revocation work");

    logStep("Audit and reset guard");
    const audit = await client.request("/api/audit");
    assertStatus(audit, 200, "Audit list");
    assert(Array.isArray(audit.body.events), "Audit response must include an events array.");
    assert(JSON.stringify(audit.body).includes(clientId), "Audit should include token activity for the inspector client.");
    pass("audit exposes inspector activity");

    const resetDenied = await client.json("POST", "/api/reset", {
      rootPassword: "wrong",
      confirmation: "RESET DEFAULTS",
    });
    assertStatus(resetDenied, 403, "Reset denial");
    pass("reset rejects invalid root password");

    if (options.includeReset) {
      assert(options.rootPassword, "--include-reset requires --root-password or ROOT_PASSWORD.");
      const reset = await client.json("POST", "/api/reset", {
        rootPassword: options.rootPassword,
        confirmation: "RESET DEFAULTS",
      });
      assertStatus(reset, 200, "Root reset");
      cleanup.endpointId = "";
      cleanup.basicUserId = "";
      cleanup.oauthUserId = "";
      cleanup.oauthClientId = "";
      pass("root reset restored defaults");
    }

    addDiagnostic(diagnostics, "cleanup mode", options.includeReset ? "root reset" : "delete temporary records");
    printDiagnostics(diagnostics);
    console.log("\nInspector completed successfully.");
  } finally {
    if (!options.includeReset) {
      if (cleanup.oauthClientId) await safeDelete(client, "OAuth client", `/api/oauth-clients/${cleanup.oauthClientId}`);
      if (cleanup.oauthUserId) await safeDelete(client, "OAuth user", `/api/oauth-users/${cleanup.oauthUserId}`);
      if (cleanup.basicUserId) await safeDelete(client, "Basic user", `/api/basic-users/${cleanup.basicUserId}`);
      if (cleanup.promptId) await safeDelete(client, "Prompt", `/api/prompts/${cleanup.promptId}`);
      if (cleanup.resourceId) await safeDelete(client, "Resource", `/api/resources/${cleanup.resourceId}`);
      if (cleanup.endpointId) {
        await safeDelete(client, "Endpoint", `/api/endpoints/${cleanup.endpointId}`, { deleteCode: DEFAULT_DELETE_CODE });
      }
    }
  }
}

try {
  await run(parseArgs(process.argv.slice(2)));
} catch (error) {
  console.error(`\nInspector failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
}

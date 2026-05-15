#!/usr/bin/env node

import { createServer } from "node:http";
import { Buffer } from "node:buffer";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { performance } from "node:perf_hooks";
import { URL, URLSearchParams } from "node:url";
import { TextDecoder } from "node:util";
import { fetchWithTls } from "./lib/fetch-with-tls.mjs";
import {
  buildMcpRequest as buildGenericMcpRequest,
  inspectMcpTarget as inspectGenericMcpTarget,
} from "../packages/mcp-inspector-core/dist/index.js";

const DEFAULT_HOST = process.env.INSPECTOR_UI_HOST ?? "127.0.0.1";
const DEFAULT_PORT = Number(process.env.INSPECTOR_UI_PORT ?? "3200");
const DEFAULT_PROTOCOL_VERSION = "2025-06-18";
const DEFAULT_MOCK_BASE_URL = process.env.MCP_MOCK_BASE_URL ?? "http://127.0.0.1:3100";
const DEFAULT_DELETE_CODE = "87654321";
const MOCK_SCENARIO_STEP_NAMES = [
  "Health and route config",
  "OAuth discovery and JWKS",
  "Create temporary endpoint",
  "Endpoint detail and update",
  "REST list, call, and forced error",
  "MCP initialize, list, call, and guards",
  "Resources, prompts, completion, and SSE",
  "Basic Auth runtime",
  "OAuth Bearer runtime",
  "Audit evidence and reset guard",
  "Optional root reset",
  "Cleanup temporary records",
];
const MOCK_SCENARIO_STEP_HELP = {
  "Health and route config": "Checks that the Mock Server is alive and publishes the MCP route URLs a client will use.",
  "OAuth discovery and JWKS": "Checks the standard OAuth metadata and signing keys that Bearer-token clients discover before calling MCP.",
  "Create temporary endpoint": "Creates a disposable mock tool so the scenario can prove tool discovery and calls against real server state.",
  "Endpoint detail and update": "Verifies the admin API can read and update the tool definition before clients use it.",
  "REST list, call, and forced error": "Exercises the REST tool API and a configured failure case so non-MCP clients see predictable behavior.",
  "MCP initialize, list, call, and guards": "Runs the core MCP handshake, tool listing, tool call, protocol-version guard, and permissive browser Origin compatibility check.",
  "Resources, prompts, completion, and SSE": "Checks server-side Resources, Resource Templates, Prompts, Completion, and live legacy SSE resource update notifications.",
  "Basic Auth runtime": "Checks that the strict Basic MCP route accepts valid credentials and rejects disabled credentials.",
  "OAuth Bearer runtime": "Issues a token, proves tool/resource/prompt permission filtering, allowed and denied calls, revocation, and revoked-token rejection.",
  "Audit evidence and reset guard": "Confirms security-relevant activity is visible and reset rejects invalid root credentials.",
  "Optional root reset": "Runs only when enabled; otherwise records that destructive reset was intentionally skipped.",
  "Cleanup temporary records": "Removes scenario-created records so repeated local runs stay predictable.",
};
const GENERIC_ROUTE_PRESET_HELP = {
  custom: "Use any MCP HTTP endpoint path with the Base URL above. The path stays editable and auth helper fields are left alone.",
  none: "Locks Endpoint path to /mcp/none and sends no Authorization header. Good for learning initialize, tools/list, resources, and prompts without credentials.",
  basic: "Locks Endpoint path to /mcp/basic and fills the seeded default/default Basic credentials.",
  oauth: "Locks Endpoint path to /mcp/oauth. Use Issue Mock OAuth token or the OAuth Popup flow to fill a Bearer token before running.",
};
const GENERIC_AUTH_HELP = {
  none: "Sends no Authorization header. Use this for public/no-auth MCP routes.",
  basic: "Builds an Authorization: Basic header from the username and password fields.",
  bearer: "Builds an Authorization: Bearer header from the token field, usually issued by OAuth.",
};
const GENERIC_METHOD_PRESET_HELP = {
  tools: "Runs initialize, tools/list, and optional tools/call using the tool fields below.",
  resourcesList: "Runs initialize and resources/list to verify direct MCP resource discovery.",
  resourcesRead: "Runs initialize and resources/read with a seeded or custom resource URI.",
  resourceTemplatesList: "Runs initialize and resources/templates/list to verify parameterized resource descriptors.",
  promptsList: "Runs initialize and prompts/list to verify prompt template discovery.",
  promptsGet: "Runs initialize and prompts/get with seeded or custom prompt arguments.",
  completionPrompt: "Runs initialize and completion/complete for a prompt argument candidate.",
  completionResource: "Runs initialize and completion/complete for a resource-template argument candidate.",
};
const GENERIC_DRAFT_STORAGE_KEY = "mcp-mock-standalone-inspector:generic-draft:v1";
const oauthPopupSessions = new Map();

function parseArgs(argv) {
  const options = {
    host: DEFAULT_HOST,
    port: DEFAULT_PORT,
    open: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--host") {
      options.host = argv[index + 1] ?? options.host;
      index += 1;
    } else if (arg === "--port") {
      options.port = Number(argv[index + 1] ?? options.port);
      index += 1;
    } else if (arg === "--open") {
      options.open = true;
    } else if (arg === "--help" || arg === "-h") {
      printHelp();
      process.exit(0);
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  if (!Number.isInteger(options.port) || options.port < 1 || options.port > 65_535) {
    throw new Error("--port must be a valid TCP port.");
  }

  return options;
}

function printHelp() {
  console.log(`Standalone MCP Inspector UI

Usage:
  npm run inspector:ui
  npm run inspector:ui -- --port 3201

Options:
  --host <host>   Host to bind. Defaults to ${DEFAULT_HOST}
  --port <port>   Port to bind. Defaults to ${DEFAULT_PORT}
  --open          Print the URL in a browser-friendly form only; no browser is launched.
`);
}

function jsonResponse(response, status, body) {
  response.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
  });
  response.end(JSON.stringify(body, null, 2));
}

function htmlResponse(response, body) {
  response.writeHead(200, {
    "content-type": "text/html; charset=utf-8",
    "cache-control": "no-store",
  });
  response.end(body);
}

function escapeAttribute(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function helpTooltip(text) {
  const escaped = escapeAttribute(text);
  return `<span class="help-tooltip" tabindex="0" title="${escaped}" data-tooltip="${escaped}"></span>`;
}

async function readJson(request) {
  const chunks = [];
  for await (const chunk of request) {
    chunks.push(chunk);
  }
  const text = Buffer.concat(chunks).toString("utf8");
  if (!text.trim()) return {};
  return JSON.parse(text);
}

function parseHeadersJson(value) {
  if (!value || !String(value).trim()) return {};
  const parsed = JSON.parse(value);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("Headers JSON must be an object.");
  }
  return Object.fromEntries(Object.entries(parsed).map(([key, headerValue]) => [key, String(headerValue)]));
}

function parseToolArgs(value) {
  if (!value || !String(value).trim()) return {};
  const parsed = JSON.parse(value);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("Tool arguments must be a JSON object.");
  }
  return parsed;
}

function parseJsonObject(value, label) {
  if (!value || !String(value).trim()) return {};
  const parsed = JSON.parse(value);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error(`${label} must be a JSON object.`);
  }
  return parsed;
}

function normalizeBaseUrl(value) {
  const baseUrl = String(value ?? "").trim() || DEFAULT_MOCK_BASE_URL;
  const url = new URL(baseUrl);
  if (!["http:", "https:"].includes(url.protocol)) {
    throw new Error("Mock Server base URL must be http or https.");
  }
  return baseUrl.replace(/\/+$/, "");
}

function normalizeEndpointPath(value) {
  const endpointPath = String(value ?? "").trim() || "/mcp/none";
  if (!endpointPath.startsWith("/")) {
    throw new Error("Endpoint path must start with /.");
  }
  return endpointPath;
}

function resolveMcpTargetUrl(input) {
  const explicitUrl = String(input.mcpUrl ?? "").trim();
  if (explicitUrl) return explicitUrl;
  const baseUrl = normalizeBaseUrl(input.baseUrl);
  const endpointPath = normalizeEndpointPath(input.endpointPath);
  return new URL(endpointPath, `${baseUrl}/`).toString();
}

function makeStep(name, status, data) {
  return {
    name,
    status,
    ...data,
  };
}

function addDiagnostic(diagnostics, check, value) {
  diagnostics.push({ check, value: String(value) });
}

function basic(username, password) {
  return `Basic ${Buffer.from(`${username}:${password}`, "utf8").toString("base64")}`;
}

function base64url(bytes) {
  return Buffer.from(bytes).toString("base64url");
}

function createCodeVerifier() {
  return base64url(randomBytes(48));
}

function createCodeChallenge(verifier) {
  return base64url(createHash("sha256").update(verifier).digest());
}

function decodeJwt(token) {
  const [, payload] = String(token).split(".");
  if (!payload) throw new Error("Access token is not a JWT.");
  return JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
}

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

class MockClient {
  constructor(baseUrl, options = {}) {
    this.baseUrl = baseUrl;
    this.insecureTls = Boolean(options.insecureTls);
  }

  url(path) {
    return `${this.baseUrl}${path}`;
  }

  async request(path, options = {}) {
    const startedAt = performance.now();
    const response = await fetchWithTls(this.url(path), options, { insecureTls: this.insecureTls });
    const elapsedMs = Math.round(performance.now() - startedAt);
    const contentType = response.headers.get("content-type") ?? "";
    const text = await response.text();
    const body = contentType.includes("application/json") && text ? JSON.parse(text) : text;
    return {
      status: response.status,
      ok: response.ok,
      elapsedMs,
      headers: Object.fromEntries(response.headers.entries()),
      body,
    };
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
  if (result.status !== expected) {
    throw new Error(`${label} expected HTTP ${expected}, got ${result.status}: ${JSON.stringify(result.body)}`);
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function mockMcp(client, path, message, headers = {}) {
  return client.json("POST", path, message, {
    Accept: "application/json, text/event-stream",
    "MCP-Protocol-Version": DEFAULT_PROTOCOL_VERSION,
    ...headers,
  });
}

async function safeDelete(client, path, body) {
  try {
    if (body === undefined) {
      await client.request(path, { method: "DELETE" });
    } else {
      await client.json("DELETE", path, body);
    }
  } catch {
    // Cleanup is best-effort because the scenario report already captures the user-facing failure.
  }
}

async function createScenarioEndpoint(client, name) {
  const result = await client.json("POST", "/api/endpoints", {
    name,
    title: "Standalone inspector endpoint",
    description: "Created by the standalone inspector scenario runner.",
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
        errorMessage: "Standalone inspector forced error.",
        errorBodyJson: JSON.stringify({ error: "inspector_forced_error", message: "Standalone inspector forced error." }),
        isDefault: false,
      },
    ],
  });
  assertStatus(result, 201, "Create endpoint");
  return { result, endpoint: result.body.endpoint };
}

async function createScenarioResource(client, stamp) {
  const result = await client.json("POST", "/api/resources", {
    uri: `mock://resources/ui-inspector-${stamp}`,
    name: `ui_inspector_resource_${stamp}`,
    title: "Standalone inspector resource",
    description: "Created by the standalone inspector scenario runner.",
    mimeType: "text/plain",
    enabled: true,
    textContent: `standalone inspector resource body ${stamp}`,
    annotationsJson: JSON.stringify({ audience: ["assistant"] }),
  });
  assertStatus(result, 201, "Create MCP resource");
  return { result, resource: result.body.resource };
}

async function createScenarioPrompt(client, stamp) {
  const result = await client.json("POST", "/api/prompts", {
    name: `ui_inspector_prompt_${stamp}`,
    title: "Standalone inspector prompt",
    description: "Created by the standalone inspector scenario runner.",
    enabled: true,
    arguments: [{ name: "tone", title: "Tone", description: "Reply tone.", required: true }],
    messages: [{ role: "user", textTemplate: "Write a {tone} standalone inspector summary." }],
    completionCandidates: [{ argumentName: "tone", value: "friendly", label: "Friendly" }],
  });
  assertStatus(result, 201, "Create MCP prompt");
  return { result, prompt: result.body.prompt };
}

async function readSseUntil(reader, needle, timeoutMs = 5000) {
  const decoder = new TextDecoder();
  const deadline = Date.now() + timeoutMs;
  let output = "";
  while (!output.includes(needle)) {
    const remaining = deadline - Date.now();
    if (remaining <= 0) break;
    const read = await Promise.race([
      reader.read(),
      new Promise((resolve) => setTimeout(() => resolve({ done: true, value: undefined }), remaining)),
    ]);
    if (read.done) break;
    output += decoder.decode(read.value ?? new Uint8Array(), { stream: true });
  }
  return output;
}

async function runScenarioStep(steps, name, action, options = {}) {
  try {
    const data = await action();
    steps.push(makeStep(name, "pass", data));
    return data;
  } catch (error) {
    steps.push(makeStep(name, options.warn ? "warn" : "fail", {
      evidence: error instanceof Error ? error.message : String(error),
    }));
    if (options.critical) throw error;
    return null;
  }
}

function genericMcpTarget(baseUrl, preset, insecureTls) {
  const targets = {
    none: {
      mockRoutePreset: "none",
      endpointPath: "/mcp/none",
      mcpUrl: `${baseUrl}/mcp/none`,
      authMode: "none",
    },
    basic: {
      mockRoutePreset: "basic",
      endpointPath: "/mcp/basic",
      mcpUrl: `${baseUrl}/mcp/basic`,
      authMode: "basic",
      basicUsername: "default",
      basicPassword: "default",
    },
    oauth: {
      mockRoutePreset: "oauth",
      endpointPath: "/mcp/oauth",
      mcpUrl: `${baseUrl}/mcp/oauth`,
      authMode: "bearer",
      oauthClientId: "default",
      oauthClientSecret: "default",
      oauthScope: "endpoint:endpoint_default_echo",
    },
  };
  return {
    baseUrl,
    ...targets[preset],
    methodPreset: "tools",
    methodParamsJson: "{}",
    toolName: "echo",
    toolArgsJson: JSON.stringify({ message: "hello" }),
    protocolVersion: DEFAULT_PROTOCOL_VERSION,
    insecureTls,
  };
}

async function inspectMockServerScenario(input) {
  const baseUrl = normalizeBaseUrl(input.baseUrl);
  const includeReset = input.includeReset === true || input.includeReset === "on";
  const insecureTls = input.insecureTls === true || input.insecureTls === "on";
  const rootPassword = String(input.rootPassword ?? "");
  const client = new MockClient(baseUrl, { insecureTls });
  const stamp = Date.now();
  const endpointName = `ui_inspector_${stamp}`;
  const basicUsername = `ui_basic_${stamp}`;
  const basicPassword = "ui-basic-secret";
  const oauthUsername = `ui_oauth_${stamp}`;
  const oauthPassword = "ui-oauth-secret";
  const clientId = `ui-inspector-client-${stamp}`;
  const protectedResourceMetadataUrl = `${baseUrl}/.well-known/oauth-protected-resource`;
  const diagnostics = [];
  const steps = [];
  addDiagnostic(diagnostics, "tls verification", insecureTls ? "self-signed allowed" : "default");
  const cleanup = {
    endpointId: "",
    basicUserId: "",
    oauthUserId: "",
    oauthClientId: "",
    resourceId: "",
    promptId: "",
  };
  let endpoint = null;
  let resource = null;
  let prompt = null;
  let bearerHeader = null;
  let claims = null;
  let clientSecret = "";

  addDiagnostic(diagnostics, "target", baseUrl);

  try {
    await runScenarioStep(steps, "Health and route config", async () => {
      const health = await client.request("/api/health");
      assertStatus(health, 200, "Health");
      assert(health.body.status === "ok", "Health status must be ok.");
      const config = await client.request("/api/config");
      assertStatus(config, 200, "Operator config");
      assert(isRecord(config.body.routes?.mcp), "Operator config must expose MCP routes.");
      addDiagnostic(diagnostics, "health", health.body.status);
      addDiagnostic(diagnostics, "mcp route", config.body.routes.mcp.noAuth ?? "/mcp/none");
      return {
        evidence: "Health is ok and config exposes MCP route URLs.",
        genericTarget: genericMcpTarget(baseUrl, "none", insecureTls),
        response: { health, config },
      };
    }, { critical: true });

    await runScenarioStep(steps, "OAuth discovery and JWKS", async () => {
      const discovery = await client.request("/.well-known/oauth-authorization-server");
      assertStatus(discovery, 200, "OAuth authorization metadata");
      assert(discovery.body.issuer === baseUrl, "OAuth issuer must match base URL.");
      assert(discovery.body.token_endpoint === `${baseUrl}/oauth/token`, "OAuth token endpoint must match base URL.");
      assert(Array.isArray(discovery.body.code_challenge_methods_supported), "OAuth discovery must report PKCE support state.");
      const protectedResource = await client.request("/.well-known/oauth-protected-resource");
      assertStatus(protectedResource, 200, "OAuth protected-resource metadata");
      assert(
        protectedResource.body.authorization_servers?.includes(`${baseUrl}/.well-known/oauth-authorization-server`),
        "Protected-resource metadata must link to authorization-server metadata.",
      );
      const jwks = await client.request("/oauth/jwks");
      assertStatus(jwks, 200, "OAuth JWKS");
      assert(Array.isArray(jwks.body.keys), "JWKS must contain keys.");
      addDiagnostic(diagnostics, "oauth issuer", discovery.body.issuer);
      addDiagnostic(diagnostics, "protected resource", protectedResource.body.resource);
      addDiagnostic(diagnostics, "jwks keys", jwks.body.keys.length);
      return {
        evidence: "OAuth metadata, protected-resource metadata, and JWKS are reachable.",
        genericTarget: genericMcpTarget(baseUrl, "oauth", insecureTls),
        response: { discovery, protectedResource, jwks },
      };
    });

    const endpointData = await runScenarioStep(steps, "Create temporary endpoint", async () => {
      const created = await createScenarioEndpoint(client, endpointName);
      endpoint = created.endpoint;
      cleanup.endpointId = endpoint.id;
      addDiagnostic(diagnostics, "temporary endpoint", endpointName);
      return {
        evidence: `Created ${endpointName} with exact-match and forced-error response cases.`,
        genericTarget: genericMcpTarget(baseUrl, "none", insecureTls),
        response: created.result,
      };
    }, { critical: true });

    if (endpointData && endpoint) {
      await runScenarioStep(steps, "Endpoint detail and update", async () => {
        const detail = await client.request(`/api/endpoints/${endpoint.id}`);
        assertStatus(detail, 200, "Endpoint detail");
        assert(detail.body.endpoint.name === endpointName, "Endpoint detail returned wrong endpoint.");
        const update = await client.json("PATCH", `/api/endpoints/${endpoint.id}`, {
          ...detail.body.endpoint,
          title: "Standalone inspector endpoint updated",
          deleteCode: DEFAULT_DELETE_CODE,
        });
        assertStatus(update, 200, "Endpoint update");
        return {
          evidence: "Endpoint can be read and updated through admin APIs.",
          genericTarget: genericMcpTarget(baseUrl, "none", insecureTls),
          response: { detail, update },
        };
      });

      await runScenarioStep(steps, "REST list, call, and forced error", async () => {
        const list = await client.request("/rest/tools");
        assertStatus(list, 200, "REST tools list");
        assert(list.body.tools.some((tool) => tool.name === endpointName), "REST list must include temporary endpoint.");
        const call = await client.json("POST", `/rest/tools/${endpointName}/call`, { arguments: { city: "Seoul" } });
        assertStatus(call, 201, "REST tool call");
        assert(call.body.city === "Seoul", "REST tool call returned unexpected body.");
        const forcedError = await client.json("POST", `/rest/tools/${endpointName}/call`, { arguments: { city: "Error" } });
        assertStatus(forcedError, 503, "REST forced error");
        assert(forcedError.body.error === "inspector_forced_error", "REST forced error body mismatch.");
        return {
          evidence: "REST list, exact-match call, and configured forced-error case work.",
          genericTarget: genericMcpTarget(baseUrl, "none", insecureTls),
          response: { list, call, forcedError },
        };
      });

      await runScenarioStep(steps, "MCP initialize, list, call, and guards", async () => {
        const initialize = await mockMcp(client, "/mcp/none", {
          jsonrpc: "2.0",
          id: "initialize",
          method: "initialize",
          params: {
            protocolVersion: DEFAULT_PROTOCOL_VERSION,
            capabilities: {},
            clientInfo: { name: "standalone-ui-inspector", version: "1.0.0" },
          },
        });
        assertStatus(initialize, 200, "MCP initialize");
        assert(initialize.body.result.protocolVersion === DEFAULT_PROTOCOL_VERSION, "MCP protocol negotiation mismatch.");
        const badVersion = await client.json(
          "POST",
          "/mcp/none",
          { jsonrpc: "2.0", id: "bad-version", method: "tools/list" },
          { Accept: "application/json, text/event-stream", "MCP-Protocol-Version": "1900-01-01" },
        );
        assertStatus(badVersion, 400, "Unsupported MCP protocol version");
        const foreignOrigin = await client.json(
          "POST",
          "/mcp/none",
          { jsonrpc: "2.0", id: "bad-origin", method: "tools/list" },
          { Accept: "application/json, text/event-stream", "MCP-Protocol-Version": DEFAULT_PROTOCOL_VERSION, Origin: "https://invalid.example" },
        );
        assertStatus(foreignOrigin, 200, "Browser Origin compatibility");
        const list = await mockMcp(client, "/mcp/none", { jsonrpc: "2.0", id: 1, method: "tools/list" });
        assertStatus(list, 200, "MCP tools/list");
        assert(list.body.result.tools.some((tool) => tool.name === endpointName), "MCP tools/list must include endpoint.");
        const call = await mockMcp(client, "/mcp/none", {
          jsonrpc: "2.0",
          id: 2,
          method: "tools/call",
          params: { name: endpointName, arguments: { city: "Seoul" } },
        });
        assertStatus(call, 200, "MCP tools/call");
        assert(call.body.result.structuredContent.city === "Seoul", "MCP structured content mismatch.");
        addDiagnostic(diagnostics, "mcp negotiated", initialize.body.result.protocolVersion);
        addDiagnostic(diagnostics, "bad mcp version", "400");
        addDiagnostic(diagnostics, "foreign origin", "200 permissive");
        return {
          evidence: "MCP protocol negotiation, list, call, protocol-version guard, and permissive browser Origin compatibility work.",
          genericTarget: genericMcpTarget(baseUrl, "none", insecureTls),
          response: { initialize, badVersion, foreignOrigin, list, call },
        };
      });

      await runScenarioStep(steps, "Resources, prompts, completion, and SSE", async () => {
        const createdResource = await createScenarioResource(client, stamp);
        resource = createdResource.resource;
        cleanup.resourceId = resource.id;
        const createdPrompt = await createScenarioPrompt(client, stamp);
        prompt = createdPrompt.prompt;
        cleanup.promptId = prompt.id;

        const resourcesList = await mockMcp(client, "/mcp/none", { jsonrpc: "2.0", id: "resources-list", method: "resources/list" });
        assertStatus(resourcesList, 200, "MCP resources/list");
        assert(resourcesList.body.result.resources.some((item) => item.uri === resource.uri), "MCP resources/list must include temporary resource.");
        const resourceRead = await mockMcp(client, "/mcp/none", {
          jsonrpc: "2.0",
          id: "resources-read",
          method: "resources/read",
          params: { uri: resource.uri },
        });
        assertStatus(resourceRead, 200, "MCP resources/read");
        assert(resourceRead.body.result.contents[0].text === resource.textContent, "MCP resources/read text mismatch.");
        const templatesList = await mockMcp(client, "/mcp/none", {
          jsonrpc: "2.0",
          id: "resource-templates",
          method: "resources/templates/list",
        });
        assertStatus(templatesList, 200, "MCP resources/templates/list");
        assert(
          templatesList.body.result.resourceTemplates.some((item) => item.uriTemplate === "mock://resources/customers/{customerId}"),
          "MCP resources/templates/list must include seeded customer template.",
        );
        const promptsList = await mockMcp(client, "/mcp/none", { jsonrpc: "2.0", id: "prompts-list", method: "prompts/list" });
        assertStatus(promptsList, 200, "MCP prompts/list");
        assert(promptsList.body.result.prompts.some((item) => item.name === prompt.name), "MCP prompts/list must include temporary prompt.");
        const promptGet = await mockMcp(client, "/mcp/none", {
          jsonrpc: "2.0",
          id: "prompts-get",
          method: "prompts/get",
          params: { name: prompt.name, arguments: { tone: "friendly" } },
        });
        assertStatus(promptGet, 200, "MCP prompts/get");
        const completion = await mockMcp(client, "/mcp/none", {
          jsonrpc: "2.0",
          id: "completion",
          method: "completion/complete",
          params: { ref: { type: "ref/prompt", name: prompt.name }, argument: { name: "tone", value: "fri" } },
        });
        assertStatus(completion, 200, "MCP completion/complete");
        assert(completion.body.result.completion.values.includes("friendly"), "MCP completion/complete must return prompt candidate.");

        const controller = new globalThis.AbortController();
        let subscribe = null;
        let updateEvent = "";
        try {
          const response = await fetchWithTls(
            client.url("/sse/none"),
            { headers: { Accept: "text/event-stream" }, signal: controller.signal },
            { insecureTls: client.insecureTls },
          );
          assert(response.status === 200, `Legacy SSE expected HTTP 200, got ${response.status}.`);
          assert(response.body, "Legacy SSE response must expose a readable body.");
          const reader = response.body.getReader();
          const opening = await readSseUntil(reader, "event: endpoint");
          const endpointPath = opening.match(/data: (\/sse\/none\/message\?sessionId=[^\n]+)/)?.[1]?.trim();
          assert(endpointPath, "Legacy SSE must emit a message endpoint.");
          subscribe = await mockMcp(client, endpointPath, {
            jsonrpc: "2.0",
            id: "ui-inspector-subscribe",
            method: "resources/subscribe",
            params: { uri: resource.uri },
          });
          assertStatus(subscribe, 202, "Legacy SSE resources/subscribe POST");
          const subscribeEvent = await readSseUntil(reader, '"id":"ui-inspector-subscribe"');
          assert(subscribeEvent.includes('"result":{}'), "Legacy SSE subscribe must return empty success result.");
          const updatedResource = await client.json("PATCH", `/api/resources/${resource.id}`, {
            ...resource,
            textContent: `updated standalone inspector resource body ${stamp}`,
          });
          assertStatus(updatedResource, 200, "Update subscribed resource");
          updateEvent = await readSseUntil(reader, "notifications/resources/updated", 6000);
          assert(updateEvent.includes(resource.uri), "Legacy SSE subscription must emit resource update notification.");
        } finally {
          controller.abort();
        }

        addDiagnostic(diagnostics, "resources", "list/read/templates");
        addDiagnostic(diagnostics, "prompts", "list/get");
        addDiagnostic(diagnostics, "completion", "prompt candidate");
        addDiagnostic(diagnostics, "sse notifications", "resources/updated");
        return {
          evidence: "MCP Resources, Resource Templates, Prompts, Completion, and legacy SSE resource update notifications work.",
          genericTarget: {
            ...genericMcpTarget(baseUrl, "none", insecureTls),
            methodPreset: "resourcesRead",
            methodParamsJson: JSON.stringify({ uri: resource.uri }),
            toolName: "",
            toolArgsJson: "{}",
          },
          response: { createdResource, createdPrompt, resourcesList, resourceRead, templatesList, promptsList, promptGet, completion, subscribe, updateEvent },
        };
      });

      await runScenarioStep(steps, "Basic Auth runtime", async () => {
        const create = await client.json("POST", "/api/basic-users", {
          username: basicUsername,
          password: basicPassword,
          enabled: true,
        });
        assertStatus(create, 201, "Create Basic user");
        cleanup.basicUserId = create.body.user.id;
        const basicHeader = { Authorization: basic(basicUsername, basicPassword) };
        const strictList = await mockMcp(client, "/mcp/basic", { jsonrpc: "2.0", id: 3, method: "tools/list" }, basicHeader);
        assertStatus(strictList, 200, "Strict Basic MCP tools/list");
        const disable = await client.json("PATCH", `/api/basic-users/${cleanup.basicUserId}`, { enabled: false });
        assertStatus(disable, 200, "Disable Basic user");
        const disabled = await mockMcp(client, "/mcp/basic", { jsonrpc: "2.0", id: 4, method: "tools/list" }, basicHeader);
        assertStatus(disabled, 401, "Disabled Basic user rejection");
        return {
          evidence: "Basic user create, strict MCP access, disable, and rejection work.",
          genericTarget: genericMcpTarget(baseUrl, "basic", insecureTls),
          response: { create, strictList, disable, disabled },
        };
      });

      await runScenarioStep(steps, "OAuth Bearer runtime", async () => {
        assert(resource && prompt, "Resources/prompts step must complete before OAuth permission checks.");
        const missingBearer = await mockMcp(client, "/mcp/oauth", { jsonrpc: "2.0", id: "missing-bearer", method: "tools/list" });
        assertStatus(missingBearer, 401, "Strict OAuth missing Bearer challenge");
        const challenge = missingBearer.headers["www-authenticate"] ?? "";
        assert(challenge.includes("Bearer"), "Strict OAuth 401 must include Bearer challenge.");
        assert(challenge.includes(`resource_metadata="${protectedResourceMetadataUrl}"`), "Bearer challenge must point to protected-resource metadata.");
        const userCreate = await client.json("POST", "/api/oauth-users", {
          username: oauthUsername,
          password: oauthPassword,
          enabled: true,
          accessTokenTtlSeconds: 900,
        });
        assertStatus(userCreate, 201, "Create OAuth user");
        cleanup.oauthUserId = userCreate.body.user.id;
        const clientCreate = await client.json("POST", "/api/oauth-clients", {
          clientId,
          displayName: "Standalone inspector client",
          enabled: true,
          redirectUris: ["http://localhost:3000/oauth/callback"],
          clientCredentialsTtlSeconds: 900,
          allowedEndpointIds: [endpoint.id],
          allowedResourceIds: [resource.id],
          allowedPromptIds: [prompt.id],
        });
        assertStatus(clientCreate, 201, "Create OAuth client");
        cleanup.oauthClientId = clientCreate.body.client.id;
        clientSecret = clientCreate.body.clientSecret;
        assert(typeof clientSecret === "string" && clientSecret.length > 0, "OAuth client secret must be returned once.");
        const token = await client.form("/oauth/token", {
          grant_type: "client_credentials",
          client_id: clientId,
          client_secret: clientSecret,
          resource: baseUrl,
        });
        assertStatus(token, 200, "OAuth client_credentials token");
        bearerHeader = { Authorization: `Bearer ${token.body.access_token}` };
        claims = decodeJwt(token.body.access_token);
        assert(claims.endpoint_permissions.includes(endpoint.id), "OAuth token must include endpoint permission.");
        assert(claims.resource_permissions.includes(resource.id), "OAuth token must include resource permission.");
        assert(claims.prompt_permissions.includes(prompt.id), "OAuth token must include prompt permission.");
        assert(claims.aud === baseUrl, "OAuth token audience must match requested resource.");
        const tokenList = await client.request("/api/oauth/tokens");
        assertStatus(tokenList, 200, "Issued token list");
        assert(JSON.stringify(tokenList.body).includes(claims.jti), "Issued token list must include created token jti.");
        const oauthList = await mockMcp(client, "/mcp/oauth", { jsonrpc: "2.0", id: 5, method: "tools/list" }, bearerHeader);
        assertStatus(oauthList, 200, "OAuth MCP tools/list");
        const toolNames = oauthList.body.result.tools.map((tool) => tool.name);
        assert(toolNames.includes(endpointName), "OAuth tools/list must include permitted endpoint.");
        assert(!toolNames.includes("echo"), "OAuth tools/list must filter non-permitted echo endpoint.");
        const oauthResources = await mockMcp(client, "/mcp/oauth", { jsonrpc: "2.0", id: "oauth-resources", method: "resources/list" }, bearerHeader);
        assertStatus(oauthResources, 200, "OAuth MCP resources/list");
        const resourceUris = oauthResources.body.result.resources.map((item) => item.uri);
        assert(resourceUris.includes(resource.uri), "OAuth resources/list must include permitted resource.");
        assert(!resourceUris.includes("mock://resources/server-status"), "OAuth resources/list must filter non-permitted resources.");
        const oauthPrompt = await mockMcp(
          client,
          "/mcp/oauth",
          { jsonrpc: "2.0", id: "oauth-prompt", method: "prompts/get", params: { name: prompt.name, arguments: { tone: "friendly" } } },
          bearerHeader,
        );
        assertStatus(oauthPrompt, 200, "OAuth MCP prompts/get");
        const allowed = await client.json("POST", `/rest/tools/${endpointName}/call`, { arguments: { city: "Seoul" } }, bearerHeader);
        assertStatus(allowed, 201, "OAuth REST allowed call");
        const denied = await client.json("POST", "/rest/tools/echo/call", { arguments: { message: "hello" } }, bearerHeader);
        assertStatus(denied, 403, "OAuth REST denied call");
        const revoke = await client.request(`/api/oauth/tokens/${claims.jti}/revoke`, { method: "POST" });
        assertStatus(revoke, 200, "Token revocation");
        const revoked = await client.request("/rest/tools", { headers: bearerHeader });
        assertStatus(revoked, 401, "Revoked token rejection");
        addDiagnostic(diagnostics, "bearer challenge", "resource_metadata");
        addDiagnostic(diagnostics, "jwt audience", claims.aud);
        addDiagnostic(
          diagnostics,
          "jwt permissions",
          `${claims.endpoint_permissions.length} tools, ${claims.resource_permissions.length} resources, ${claims.prompt_permissions.length} prompts`,
        );
        addDiagnostic(diagnostics, "oauth denied call", "403");
        addDiagnostic(diagnostics, "revoked token", "401 invalid_token");
        return {
          evidence: "OAuth client credentials, tool/resource/prompt permission filtering, allowed/denied calls, token list, revocation, and revoked-token rejection work.",
          genericTarget: genericMcpTarget(baseUrl, "oauth", insecureTls),
          response: { missingBearer, userCreate, clientCreate: { ...clientCreate, body: { ...clientCreate.body, clientSecret: "<redacted>" } }, token: { ...token, body: { ...token.body, access_token: "<redacted>" } }, tokenList, oauthList, oauthResources, oauthPrompt, allowed, denied, revoke, revoked },
        };
      });

      await runScenarioStep(steps, "Audit evidence and reset guard", async () => {
        const audit = await client.request("/api/audit");
        assertStatus(audit, 200, "Audit list");
        assert(Array.isArray(audit.body.events), "Audit response must include events array.");
        assert(JSON.stringify(audit.body).includes(clientId), "Audit should include inspector client activity.");
        const resetDenied = await client.json("POST", "/api/reset", {
          rootPassword: "wrong",
          confirmation: "RESET DEFAULTS",
        });
        assertStatus(resetDenied, 403, "Reset denial");
        return {
          evidence: "Audit contains scenario activity and reset rejects invalid root credentials.",
          genericTarget: genericMcpTarget(baseUrl, "none", insecureTls),
          response: { audit, resetDenied },
        };
      });

      if (includeReset) {
        await runScenarioStep(steps, "Optional root reset", async () => {
          assert(rootPassword, "Root password is required when optional reset is enabled.");
          const reset = await client.json("POST", "/api/reset", {
            rootPassword,
            confirmation: "RESET DEFAULTS",
          });
          assertStatus(reset, 200, "Root reset");
          cleanup.endpointId = "";
          cleanup.basicUserId = "";
          cleanup.oauthUserId = "";
          cleanup.oauthClientId = "";
          return {
            evidence: "Root reset restored seeded defaults.",
            genericTarget: genericMcpTarget(baseUrl, "none", insecureTls),
            response: reset,
          };
        });
      } else {
        steps.push(makeStep("Optional root reset", "skip", {
          evidence: "Destructive root reset is skipped unless explicitly enabled.",
          genericTarget: genericMcpTarget(baseUrl, "none", insecureTls),
        }));
      }
    }
  } finally {
    if (!includeReset) {
      if (cleanup.oauthClientId) await safeDelete(client, `/api/oauth-clients/${cleanup.oauthClientId}`);
      if (cleanup.oauthUserId) await safeDelete(client, `/api/oauth-users/${cleanup.oauthUserId}`);
      if (cleanup.basicUserId) await safeDelete(client, `/api/basic-users/${cleanup.basicUserId}`);
      if (cleanup.promptId) await safeDelete(client, `/api/prompts/${cleanup.promptId}`);
      if (cleanup.resourceId) await safeDelete(client, `/api/resources/${cleanup.resourceId}`);
      if (cleanup.endpointId) await safeDelete(client, `/api/endpoints/${cleanup.endpointId}`, { deleteCode: DEFAULT_DELETE_CODE });
      addDiagnostic(diagnostics, "cleanup mode", "delete temporary records");
      steps.push(makeStep("Cleanup temporary records", "pass", {
        evidence: "Temporary endpoint, Basic user, OAuth user, and OAuth client records were removed when present.",
        genericTarget: genericMcpTarget(baseUrl, "none", insecureTls),
      }));
    } else {
      addDiagnostic(diagnostics, "cleanup mode", "root reset or best-effort cleanup");
      steps.push(makeStep("Cleanup temporary records", "pass", {
        evidence: "Optional root reset handled cleanup, or cleanup was already reduced to best-effort recovery.",
        genericTarget: genericMcpTarget(baseUrl, "none", insecureTls),
      }));
    }
  }

  const failed = steps.filter((step) => step.status === "fail").length;
  return {
    ok: failed === 0,
    kind: "mock-scenario",
    target: baseUrl,
    diagnostics,
    steps,
    summary: {
      pass: steps.filter((step) => step.status === "pass").length,
      warn: steps.filter((step) => step.status === "warn").length,
      skip: steps.filter((step) => step.status === "skip").length,
      fail: failed,
    },
  };
}

async function inspectMcpTarget(input) {
  const targetUrl = resolveMcpTargetUrl(input);
  if (!targetUrl) throw new Error("Full MCP URL is required.");
  const url = new URL(targetUrl);
  if (!["http:", "https:"].includes(url.protocol)) {
    throw new Error("Full MCP URL must be http or https.");
  }

  const protocolVersion = String(input.protocolVersion || DEFAULT_PROTOCOL_VERSION);
  const insecureTls = input.insecureTls === true || input.insecureTls === "on";
  const userHeaders = parseHeadersJson(input.headersJson);
  const methodPreset = String(input.methodPreset || "tools");
  const steps = [];
  const diagnostics = [];

  if (methodPreset === "tools") {
    const list = await inspectGenericMcpTarget({
      url: targetUrl,
      method: "tools/list",
      headers: userHeaders,
      protocolVersion,
      insecureTls,
      includeProtocolProbe: false,
      clientInfo: { name: "standalone-local-inspector", version: "1.0.0" },
    });
    appendGenericResult(steps, diagnostics, list);
    const tools = Array.isArray(list.raw?.body?.result?.tools) ? list.raw.body.result.tools : [];
    const listStep = steps.find((step) => step.name === "MCP tools/list");
    if (listStep) listStep.evidence = `${tools.length} tools returned`;
    diagnostics.push(["tools returned", tools.length]);

    const toolName = String(input.toolName ?? "").trim();
    if (toolName) {
      const args = parseToolArgs(input.toolArgsJson);
      const callPayload = buildGenericMcpRequest({
        family: "tools",
        action: "call",
        id: "inspector-tools-call",
        name: toolName,
        args,
      });
      const call = await inspectGenericMcpTarget({
        url: targetUrl,
        method: callPayload.method,
        params: callPayload.params,
        headers: userHeaders,
        protocolVersion,
        insecureTls,
        initialize: false,
        includeProtocolProbe: true,
        clientInfo: { name: "standalone-local-inspector", version: "1.0.0" },
      });
      appendGenericResult(steps, diagnostics, call);
      diagnostics.push(["called tool", toolName]);
    } else {
      steps.push(makeStep("MCP tools/call", "skip", {
        evidence: "No tool name was provided.",
      }));
      const probe = await inspectGenericMcpTarget({
        url: targetUrl,
        method: "tools/list",
        headers: userHeaders,
        protocolVersion,
        insecureTls,
        initialize: false,
        includeProtocolProbe: true,
        clientInfo: { name: "standalone-local-inspector", version: "1.0.0" },
      });
      appendGenericResult(steps, diagnostics, probe, { skipFirstMethodStep: true });
    }
  } else {
    const params = parseJsonObject(input.methodParamsJson, "Method params JSON");
    const methodByPreset = {
      resourcesList: "resources/list",
      resourcesRead: "resources/read",
      resourceTemplatesList: "resources/templates/list",
      promptsList: "prompts/list",
      promptsGet: "prompts/get",
      completionPrompt: "completion/complete",
      completionResource: "completion/complete",
    };
    const method = methodByPreset[methodPreset];
    if (!method) throw new Error(`Unknown MCP method preset: ${methodPreset}`);
    const result = await inspectGenericMcpTarget({
      url: targetUrl,
      method,
      params,
      headers: userHeaders,
      protocolVersion,
      insecureTls,
      includeProtocolProbe: true,
      clientInfo: { name: "standalone-local-inspector", version: "1.0.0" },
    });
    appendGenericResult(steps, diagnostics, result);
    diagnostics.push(["method preset", method]);
  }

  const failed = steps.filter((step) => step.status === "fail").length;
  return {
    ok: failed === 0,
    target: targetUrl,
    diagnostics: diagnostics.map(([check, value]) => ({ check, value: String(value) })),
    steps,
    summary: {
      pass: steps.filter((step) => step.status === "pass").length,
      warn: steps.filter((step) => step.status === "warn").length,
      skip: steps.filter((step) => step.status === "skip").length,
      fail: failed,
    },
  };
}

function appendGenericResult(steps, diagnostics, result, options = {}) {
  const nextSteps = options.skipFirstMethodStep
    ? result.steps.filter((step) => !step.name.startsWith("MCP tools/list"))
    : result.steps;
  steps.push(...nextSteps);
  diagnostics.push(...result.diagnostics);
}

async function issueMockOAuthToken(input) {
  const baseUrl = normalizeBaseUrl(input.baseUrl);
  const clientId = String(input.clientId || "default").trim();
  const clientSecret = String(input.clientSecret || "");
  const scope = String(input.scope || "").trim();
  const insecureTls = input.insecureTls === true || input.insecureTls === "on";
  if (!clientId || !clientSecret) {
    throw new Error("OAuth client id and secret are required.");
  }

  const client = new MockClient(baseUrl, { insecureTls });
  const token = await client.form("/oauth/token", {
    grant_type: "client_credentials",
    client_id: clientId,
    client_secret: clientSecret,
    resource: baseUrl,
    ...(scope ? { scope } : {}),
  });
  assertStatus(token, 200, "OAuth client_credentials token");
  const claims = decodeJwt(token.body.access_token);
  return {
    ok: true,
    tokenType: token.body.token_type,
    accessToken: token.body.access_token,
    expiresIn: token.body.expires_in,
    scope: token.body.scope,
    diagnostics: [
      { check: "target", value: baseUrl },
      { check: "client", value: clientId },
      { check: "grant", value: "client_credentials" },
      { check: "jwt audience", value: claims.aud },
      { check: "jwt permissions", value: String(claims.endpoint_permissions?.length ?? 0) },
    ],
  };
}

function inspectorOrigin(request) {
  const host = request.headers.host || `${DEFAULT_HOST}:${DEFAULT_PORT}`;
  return `http://${host}`;
}

function pruneOAuthPopupSessions() {
  const expiresBefore = Date.now() - 10 * 60 * 1000;
  for (const [state, session] of oauthPopupSessions.entries()) {
    if (session.createdAt < expiresBefore) oauthPopupSessions.delete(state);
  }
}

async function prepareOAuthPopupFlow(input, origin) {
  pruneOAuthPopupSessions();
  const baseUrl = normalizeBaseUrl(input.baseUrl);
  const insecureTls = input.insecureTls === true || input.insecureTls === "on";
  const client = new MockClient(baseUrl, { insecureTls });
  const endpoints = await client.request("/api/endpoints");
  assertStatus(endpoints, 200, "Endpoint catalog");
  const resources = await client.request("/api/resources");
  assertStatus(resources, 200, "Resource catalog");
  const prompts = await client.request("/api/prompts");
  assertStatus(prompts, 200, "Prompt catalog");
  const enabledEndpointIds = (endpoints.body.endpoints ?? [])
    .filter((endpoint) => endpoint.enabled)
    .map((endpoint) => endpoint.id);
  const enabledResourceIds = (resources.body.items ?? [])
    .filter((resource) => resource.enabled)
    .map((resource) => resource.id);
  const enabledPromptIds = (prompts.body.items ?? [])
    .filter((prompt) => prompt.enabled)
    .map((prompt) => prompt.id);
  if (enabledEndpointIds.length === 0) {
    throw new Error("At least one enabled endpoint is required before running popup OAuth.");
  }

  const redirectUri = `${origin}/oauth-callback`;
  const stamp = Date.now();
  const clientId = `inspector-popup-${stamp}-${randomUUID().slice(0, 8)}`;
  const createClient = await client.json("POST", "/api/oauth-clients", {
    clientId,
    displayName: "Standalone Inspector popup OAuth",
    enabled: true,
    redirectUris: [redirectUri],
    clientCredentialsTtlSeconds: 900,
    allowedEndpointIds: enabledEndpointIds,
    allowedResourceIds: enabledResourceIds,
    allowedPromptIds: enabledPromptIds,
  });
  assertStatus(createClient, 201, "Create popup OAuth client");
  const clientSecret = createClient.body.clientSecret;
  assert(typeof clientSecret === "string" && clientSecret.length > 0, "OAuth client secret must be returned once.");

  const state = base64url(randomBytes(24));
  const codeVerifier = createCodeVerifier();
  const codeChallenge = createCodeChallenge(codeVerifier);
  const authorizationUrl = new URL(`${baseUrl}/oauth/authorize`);
  authorizationUrl.searchParams.set("response_type", "code");
  authorizationUrl.searchParams.set("client_id", clientId);
  authorizationUrl.searchParams.set("redirect_uri", redirectUri);
  authorizationUrl.searchParams.set("resource", baseUrl);
  authorizationUrl.searchParams.set("state", state);
  authorizationUrl.searchParams.set("code_challenge", codeChallenge);
  authorizationUrl.searchParams.set("code_challenge_method", "S256");
  oauthPopupSessions.set(state, {
    baseUrl,
    insecureTls,
    redirectUri,
    clientId,
    clientSecret,
    codeVerifier,
    createdAt: Date.now(),
  });

  return {
    ok: true,
    baseUrl,
    authorizationUrl: authorizationUrl.toString(),
    clientId,
    clientSecret,
    redirectUri,
    state,
    codeVerifier,
    diagnostics: [
      { check: "target", value: baseUrl },
      { check: "grant", value: "authorization_code + PKCE S256" },
      { check: "redirect_uri", value: redirectUri },
      { check: "allowed endpoints", value: String(enabledEndpointIds.length) },
      { check: "allowed resources", value: String(enabledResourceIds.length) },
      { check: "allowed prompts", value: String(enabledPromptIds.length) },
      { check: "temporary client", value: clientId },
    ],
  };
}

async function exchangeOAuthPopupCode(input) {
  const code = String(input.code ?? "").trim();
  const state = String(input.state ?? "").trim();
  const storedSession = state ? oauthPopupSessions.get(state) : null;
  const baseUrl = normalizeBaseUrl(input.baseUrl ?? storedSession?.baseUrl);
  const insecureTls = input.insecureTls === true || input.insecureTls === "on" || storedSession?.insecureTls === true;
  const expectedState = String(input.expectedState ?? state).trim();
  const redirectUri = String(input.redirectUri ?? storedSession?.redirectUri ?? "").trim();
  const clientId = String(input.clientId ?? storedSession?.clientId ?? "").trim();
  const clientSecret = String(input.clientSecret ?? storedSession?.clientSecret ?? "");
  const codeVerifier = String(input.codeVerifier ?? storedSession?.codeVerifier ?? "").trim();
  if (!code) throw new Error("Authorization callback did not include a code.");
  if (!state || state !== expectedState) throw new Error("OAuth state mismatch. Close the popup and start again.");
  if (!redirectUri || !clientId || !clientSecret || !codeVerifier) {
    throw new Error("OAuth popup session is incomplete. Start the popup flow again.");
  }

  const client = new MockClient(baseUrl, { insecureTls });
  const token = await client.form("/oauth/token", {
    grant_type: "authorization_code",
    code,
    redirect_uri: redirectUri,
    client_id: clientId,
    client_secret: clientSecret,
    code_verifier: codeVerifier,
    resource: baseUrl,
  });
  assertStatus(token, 200, "OAuth authorization_code token");
  if (storedSession) oauthPopupSessions.delete(state);
  const claims = decodeJwt(token.body.access_token);
  return {
    ok: true,
    tokenType: token.body.token_type,
    accessToken: token.body.access_token,
    expiresIn: token.body.expires_in,
    scope: token.body.scope,
    claims,
    genericTarget: {
      baseUrl,
      mockRoutePreset: "oauth",
      endpointPath: "/mcp/oauth",
      mcpUrl: `${baseUrl}/mcp/oauth`,
      protocolVersion: DEFAULT_PROTOCOL_VERSION,
      authMode: "bearer",
      bearerToken: token.body.access_token,
      methodPreset: "tools",
      methodParamsJson: "{}",
      toolName: "echo",
      toolArgsJson: JSON.stringify({ message: "hello" }),
      insecureTls,
    },
    diagnostics: [
      { check: "target", value: baseUrl },
      { check: "grant", value: "authorization_code" },
      { check: "jwt subject", value: String(claims.sub ?? "not reported") },
      { check: "jwt audience", value: String(claims.aud ?? "not reported") },
      { check: "jwt permissions", value: String(claims.endpoint_permissions?.length ?? 0) },
    ],
  };
}

function renderOAuthCallbackHtml(query) {
  const payload = {
    source: "mcp-mock-inspector-oauth",
    code: query.get("code") || "",
    state: query.get("state") || "",
    error: query.get("error") || "",
    errorDescription: query.get("error_description") || "",
  };
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>OAuth callback</title>
  <style>
    body { margin: 0; padding: 28px; font-family: "Aptos", "Segoe UI", Helvetica, Arial, sans-serif; background: #f4f6f3; color: #1d2724; }
    main { max-width: 560px; margin: 0 auto; border: 1px solid #d8e0dc; border-radius: 8px; background: #fff; padding: 18px; }
    h1 { margin: 0 0 10px; font-size: 1.35rem; }
    p { color: #5c6675; line-height: 1.5; }
    code { overflow-wrap: anywhere; }
  </style>
</head>
<body>
  <main>
    <h1>OAuth callback received</h1>
    <p>This popup will close after sending the authorization result back to the standalone inspector.</p>
    <p>If it does not close, return to the inspector and start the flow again.</p>
    <code>${escapeAttribute(payload.error || payload.code || "No code returned.")}</code>
  </main>
  <script>
    const payload = ${JSON.stringify(payload)};
    if (window.opener) {
      window.opener.postMessage(payload, window.location.origin);
      window.setTimeout(() => window.close(), 350);
    } else if (payload.code && payload.state) {
      (async () => {
        const response = await fetch("/api/oauth-popup/exchange", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ code: payload.code, state: payload.state }),
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.message || "OAuth token exchange failed.");
        window.localStorage.setItem("${GENERIC_DRAFT_STORAGE_KEY}", JSON.stringify(data.genericTarget));
        window.location.href = "/generic";
      })().catch((error) => {
        document.querySelector("main").insertAdjacentHTML(
          "beforeend",
          "<p>Token exchange failed. Return to the inspector and start again.</p><code>" + String(error.message || error).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;") + "</code>",
        );
      });
    }
  </script>
</body>
</html>`;
}

function iconSvg(name, className = "ui-icon") {
  const icons = {
    activity: '<polyline points="3 12 7 12 10 4 14 20 17 12 21 12" />',
    overview: '<path d="M4 19V5" /><path d="M4 19h16" /><path d="M8 16v-5" /><path d="M12 16V8" /><path d="M16 16v-3" />',
    mock: '<path d="m4 7 2 2 4-4" /><path d="M12 7h8" /><path d="m4 17 2 2 4-4" /><path d="M12 17h8" />',
    generic: '<circle cx="12" cy="12" r="7" /><circle cx="12" cy="12" r="2" /><path d="M12 3v3" /><path d="M12 18v3" /><path d="M3 12h3" /><path d="M18 12h3" />',
    oauth: '<circle cx="7.5" cy="12.5" r="3.5" /><path d="M11 12.5h9" /><path d="M17 12.5v3" /><path d="M14 12.5v2" />',
    terminal: '<path d="m4 7 5 5-5 5" /><path d="M12 19h8" />',
    server: '<rect x="4" y="5" width="16" height="6" rx="2" /><rect x="4" y="13" width="16" height="6" rx="2" /><path d="M8 8h.01" /><path d="M8 16h.01" /><path d="M12 8h4" /><path d="M12 16h4" />',
  };

  return `<svg class="${className}" aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.15" stroke-linecap="round" stroke-linejoin="round">${icons[name] ?? icons.generic}</svg>`;
}

function renderHtml(page = "home") {
  const safePage = ["home", "mock", "generic", "oauth"].includes(page) ? page : "home";
  const headerCopy = {
    home: {
      eyebrow: "Standalone inspector",
      title: "MCP Inspector",
      lede: "Choose one focused workflow: run the Mock Server scenario, inspect a generic MCP target, or verify the browser OAuth authorization-code flow.",
    },
    mock: {
      eyebrow: "Mock Server scenario",
      title: "Mock Server scenario",
      lede: "Run the full Mock Server verification path and review health, REST, MCP, Basic, OAuth, audit, reset, and cleanup evidence step by step.",
    },
    generic: {
      eyebrow: "Generic target",
      title: "Generic MCP target",
      lede: "Inspect any Streamable HTTP MCP endpoint with presets, Authorization helpers, optional tool calls, and raw protocol evidence.",
    },
    oauth: {
      eyebrow: "OAuth popup",
      title: "OAuth popup flow",
      lede: "Open the browser login and consent redirect, exchange the authorization code with PKCE, then reuse the Bearer token in Generic MCP target.",
    },
  }[safePage];
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Standalone MCP Inspector</title>
  <style>
    :root {
      color-scheme: light;
      --bg: #f4f6f3;
      --fg: #1d2724;
      --muted: #5d6a66;
      --line: #d8e0dc;
      --panel: #ffffff;
      --panel-low: #eef2ef;
      --panel-raised: #f9faf7;
      --accent: #2f6f64;
      --accent-dark: #214f49;
      --accent-soft: #dceee9;
      --danger: #b42318;
      --warn: #946200;
      --shadow-subtle: 0 1px 2px rgba(27, 39, 35, .05), 0 20px 60px rgba(27, 39, 35, .07);
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      background:
        linear-gradient(180deg, rgba(238, 242, 239, .78), rgba(244, 246, 243, 0) 360px),
        var(--bg);
      color: var(--fg);
      font-family: "Aptos", "Segoe UI", Helvetica, Arial, sans-serif;
    }
    main.inspector-shell {
      width: min(1240px, calc(100% - 32px));
      margin: 0 auto;
      padding: 0 0 56px;
    }
    .product-topbar {
      position: sticky;
      top: 0;
      z-index: 10;
      border-bottom: 1px solid var(--line);
      margin-bottom: 28px;
      background: rgba(244, 246, 243, .92);
      backdrop-filter: blur(14px);
    }
    .product-topbar-inner {
      min-height: 72px;
      display: flex;
      gap: 18px;
      align-items: center;
      justify-content: space-between;
    }
    .product-wordmark {
      color: var(--accent-dark);
      font-size: 1.18rem;
      font-weight: 900;
      text-decoration: none;
    }
    .product-top-tabs {
      display: inline-flex;
      gap: 18px;
      align-items: center;
      color: var(--muted);
      font-size: .9rem;
      font-weight: 850;
    }
    .product-top-tabs a {
      min-height: 44px;
      display: inline-flex;
      align-items: center;
      color: inherit;
      text-decoration: none;
    }
    .product-top-tabs a:hover {
      color: var(--accent-dark);
    }
    .product-top-tabs a[data-active="true"] {
      color: var(--accent-dark);
      box-shadow: inset 0 -2px 0 var(--accent);
    }
    .product-top-actions {
      display: inline-flex;
      gap: 8px;
      align-items: center;
      color: var(--muted);
      font-size: .72rem;
      font-weight: 900;
      letter-spacing: .04em;
    }
    .status-chip {
      display: inline-flex;
      gap: 6px;
      align-items: center;
    }
    .status-icon,
    .side-nav-icon {
      width: 17px;
      height: 17px;
      flex: 0 0 auto;
    }
    .product-status-dot {
      width: 10px;
      height: 10px;
      border-radius: 999px;
      background: #2e7354;
      box-shadow: 0 0 0 4px rgba(46, 115, 84, .12);
    }
    .inspector-body {
      display: grid;
      grid-template-columns: 256px minmax(0, 1fr);
      gap: 28px;
      align-items: start;
    }
    .product-side-rail {
      position: sticky;
      top: 92px;
      min-height: calc(100vh - 100px);
      border-right: 1px solid var(--line);
      padding: 20px 16px 20px 0;
      background: var(--panel-low);
    }
    .product-nav-brand {
      display: flex;
      gap: 12px;
      align-items: center;
      padding: 8px 8px 18px;
    }
    .product-brand-icon {
      width: 40px;
      height: 40px;
      display: inline-grid;
      place-items: center;
      border-radius: 8px;
      background: var(--accent);
      color: #fff;
      font-size: .72rem;
      font-weight: 900;
      letter-spacing: .04em;
    }
    .product-brand-icon .brand-icon {
      width: 22px;
      height: 22px;
      stroke-width: 2.25;
    }
    .product-nav-mark {
      display: block;
      color: var(--fg);
      font-weight: 900;
      text-decoration: none;
    }
    .product-nav-brand span:last-child {
      display: block;
      color: var(--muted);
      font-size: .82rem;
      font-weight: 750;
    }
    .side-nav {
      display: grid;
      gap: 10px;
      margin-top: 16px;
    }
    .side-nav-group {
      display: grid;
      gap: 4px;
      padding: 10px 6px;
    }
    .side-nav-label {
      margin: 0 8px 7px;
      color: var(--muted);
      font-size: .72rem;
      font-weight: 900;
      letter-spacing: .04em;
      text-transform: uppercase;
    }
    .side-nav a {
      min-height: 40px;
      display: flex;
      gap: 10px;
      align-items: center;
      border-radius: 8px;
      padding: 0 10px;
      color: var(--muted);
      font-size: .92rem;
      font-weight: 850;
      text-decoration: none;
    }
    .side-nav a:hover {
      background: var(--panel-raised);
      color: var(--accent-dark);
    }
    .side-nav a[aria-current="page"] {
      background: var(--accent-soft);
      color: var(--accent-dark);
    }
    .inspector-content {
      min-width: 0;
    }
    .page-header {
      display: grid;
      gap: 16px;
      border-bottom: 1px solid var(--line);
      margin-bottom: 22px;
      padding-bottom: 22px;
    }
    .header-row {
      display: flex;
      gap: 14px;
      align-items: end;
      justify-content: space-between;
    }
    .header-copy { min-width: 0; }
    .workflow-switch {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      align-items: center;
      justify-content: flex-end;
    }
    .workflow-link {
      display: inline-flex;
      min-height: 44px;
      align-items: center;
      border: 1px solid var(--line);
      border-radius: 8px;
      padding: 0 12px;
      background: var(--panel);
      color: var(--accent-dark);
      font-weight: 850;
      text-decoration: none;
      box-shadow: 0 1px 1px rgba(27, 39, 35, .04);
    }
    .workflow-link:hover { background: var(--accent-soft); border-color: rgba(47, 111, 100, .26); }
    .mode-card {
      min-height: 44px;
      border: 1px solid var(--line);
      border-radius: 8px;
      background: var(--panel);
      color: inherit;
      text-decoration: none;
    }
    .eyebrow {
      margin: 0 0 10px;
      color: var(--accent-dark);
      font-size: .78rem;
      font-weight: 800;
      text-transform: uppercase;
    }
    h1 { margin: 0; font-size: clamp(2.2rem, 4vw, 3.2rem); line-height: 1.02; letter-spacing: -0.02em; }
    .lede { max-width: 760px; margin: 14px 0 0; color: var(--muted); line-height: 1.55; }
    .handoff-highlight {
      display: inline-flex;
      align-items: center;
      margin-top: 14px;
      border: 1px solid rgba(47, 111, 100, .28);
      border-radius: 8px;
      padding: 8px 10px;
      background: var(--accent-soft);
      color: var(--accent-dark);
      font-size: .88rem;
      font-weight: 900;
    }
    .home-only,
    .mock-page,
    .generic-page,
    .oauth-page { display: none; }
    body.page-home .home-only { display: grid; }
    body.page-mock .mock-page { display: grid; }
    body.page-generic .generic-page { display: grid; }
    body.page-oauth .oauth-page { display: grid; }
    .home-grid { grid-template-columns: 1.18fr .92fr .92fr; gap: 16px; }
    .mode-card { display: grid; gap: 8px; padding: 18px; }
    .mode-card strong { font-size: 1.08rem; color: var(--fg); }
    .mode-card span { color: var(--muted); line-height: 1.45; }
    .mode-grid { display: grid; gap: 18px; }
    .layout { display: grid; grid-template-columns: minmax(320px, .72fr) minmax(0, 1.28fr); gap: 16px; align-items: start; }
    section, form {
      min-width: 0;
      border: 1px solid var(--line);
      border-radius: 8px;
      background: var(--panel);
      padding: 18px;
      box-shadow: var(--shadow-subtle);
    }
    section > h2:first-child,
    form > h2:first-child {
      border-bottom: 1px solid var(--line);
      margin: -18px -18px 16px;
      padding: 14px 18px;
      background: var(--panel-raised);
    }
    .mode-head { display: flex; gap: 12px; align-items: start; justify-content: space-between; margin-bottom: 12px; }
    .mode-head h2 { margin-bottom: 4px; }
    .mode-head p { margin: 0; color: var(--muted); line-height: 1.45; font-size: .88rem; }
    h2 { margin: 0 0 12px; font-size: 1.08rem; }
    label { display: grid; gap: 6px; margin-bottom: 12px; color: var(--fg); font-weight: 800; font-size: .9rem; }
    .label-text,
    .step-name-row {
      display: inline-flex;
      gap: 6px;
      align-items: center;
      min-width: 0;
    }
    .label-text { width: fit-content; }
    .help-tooltip {
      position: relative;
      display: inline-flex;
      flex: 0 0 auto;
      width: 20px;
      height: 20px;
      align-items: center;
      justify-content: center;
      border: 1px solid #b7c7d8;
      border-radius: 999px;
      background: var(--panel-raised);
      color: var(--accent-dark);
      font-size: .76rem;
      font-weight: 900;
      line-height: 1;
      cursor: help;
    }
    .help-tooltip::before {
      content: "?";
    }
    .help-tooltip::after {
      position: absolute;
      z-index: 20;
      left: 50%;
      bottom: calc(100% + 8px);
      width: min(300px, 78vw);
      transform: translateX(-50%);
      border: 1px solid rgba(29, 39, 36, .16);
      border-radius: 8px;
      padding: 9px 10px;
      background: #1d2724;
      color: #f9faf7;
      box-shadow: 0 10px 28px rgba(15, 23, 32, .18);
      content: attr(data-tooltip);
      font-size: .78rem;
      font-weight: 650;
      line-height: 1.4;
      opacity: 0;
      pointer-events: none;
      transition: opacity .12s ease;
    }
    .help-tooltip:hover::after,
    .help-tooltip:focus::after {
      opacity: 1;
    }
    .select-note {
      border: 1px solid var(--line);
      border-radius: 8px;
      margin: -4px 0 12px;
      padding: 9px 10px;
      background: var(--panel-raised);
      color: var(--muted);
      font-size: .82rem;
      line-height: 1.45;
    }
    .url-preview {
      display: grid;
      gap: 6px;
      border: 1px solid rgba(47, 111, 100, .26);
      border-radius: 8px;
      margin: -2px 0 12px;
      padding: 10px 12px;
      background: var(--accent-soft);
      color: var(--accent-dark);
    }
    .url-preview span {
      font-size: .72rem;
      font-weight: 900;
      text-transform: uppercase;
    }
    .url-preview code {
      max-width: 100%;
      overflow-wrap: anywhere;
      color: var(--fg);
      font-size: .88rem;
      font-weight: 800;
    }
    input, select, textarea {
      width: 100%;
      min-height: 44px;
      border: 1px solid #c9d4cf;
      border-radius: 8px;
      padding: 10px 11px;
      font: inherit;
      background: #fff;
    }
    input:focus, select:focus, textarea:focus {
      outline: 3px solid rgba(47, 111, 100, .16);
      border-color: rgba(47, 111, 100, .62);
    }
    input[readonly] {
      background: var(--panel-low);
      color: var(--muted);
      cursor: not-allowed;
    }
    input[type="checkbox"] {
      width: 18px;
      min-height: 18px;
      height: 18px;
      padding: 0;
    }
    .check-row {
      display: flex;
      grid-template-columns: none;
      align-items: center;
      gap: 10px;
      min-height: 44px;
    }
    .actions { display: flex; flex-wrap: wrap; gap: 10px; align-items: center; }
    textarea {
      min-height: 92px;
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      font-size: .86rem;
      line-height: 1.45;
    }
    button {
      min-height: 44px;
      border: 0;
      border-radius: 8px;
      padding: 0 14px;
      background: var(--accent);
      color: #fff;
      font-weight: 850;
      cursor: pointer;
    }
    button:hover { background: var(--accent-dark); }
    button:active, .workflow-link:active, .mode-card:active { transform: translateY(1px); }
    .secondary-button {
      border: 1px solid #c9d4cf;
      background: var(--panel-raised);
      color: var(--accent-dark);
    }
    .secondary-button:hover { background: var(--accent-soft); color: var(--accent-dark); }
    .send-generic-button { white-space: nowrap; }
    .progress-wrap { display: grid; gap: 10px; }
    .progress-meter {
      width: 100%;
      height: 10px;
      overflow: hidden;
      border-radius: 999px;
      background: var(--panel-low);
    }
    .progress-bar {
      width: 0%;
      height: 100%;
      border-radius: inherit;
      background: var(--accent);
      transition: width .18s ease;
    }
    .progress-list {
      display: grid;
      gap: 6px;
      margin: 0;
      padding: 0;
      list-style: none;
    }
    .progress-list li {
      display: flex;
      justify-content: space-between;
      gap: 10px;
      border: 1px solid var(--line);
      border-radius: 8px;
      padding: 8px 10px;
      background: var(--panel-raised);
      color: var(--muted);
      font-size: .84rem;
      font-weight: 750;
    }
    .progress-list li.active {
      border-color: rgba(47, 111, 100, .34);
      background: var(--accent-soft);
      color: var(--accent-dark);
    }
    .progress-list li.done {
      color: #136337;
    }
    button:disabled { opacity: .55; cursor: not-allowed; }
    .hint { color: var(--muted); font-size: .84rem; line-height: 1.45; margin: -4px 0 12px; }
    .auth-fields { display: none; gap: 10px; }
    .auth-fields.active { display: grid; }
    .summary { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 8px; margin-bottom: 12px; }
    .summary div { border: 1px solid var(--line); border-radius: 8px; padding: 10px; background: var(--panel-raised); }
    .summary span { display: block; color: var(--muted); font-size: .74rem; font-weight: 800; text-transform: uppercase; }
    .summary strong { display: block; margin-top: 4px; font-size: 1.25rem; }
    .step-card {
      display: grid;
      gap: 10px;
      border: 1px solid var(--line);
      border-radius: 8px;
      margin-top: 10px;
      padding: 12px;
      background: var(--panel-raised);
    }
    .step-card-head {
      display: flex;
      gap: 10px;
      align-items: center;
      justify-content: space-between;
    }
    .step-title {
      display: grid;
      gap: 4px;
      min-width: 0;
    }
    .step-name-row strong { overflow-wrap: anywhere; }
    .step-title strong { overflow-wrap: anywhere; }
    .step-actions {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      align-items: center;
      justify-content: flex-end;
    }
    details.step {
      border: 1px solid var(--line);
      border-radius: 8px;
      background: #fff;
      overflow: hidden;
    }
    details.step summary {
      display: flex;
      gap: 10px;
      align-items: center;
      justify-content: space-between;
      min-height: 48px;
      padding: 10px 12px;
      cursor: pointer;
      font-weight: 850;
    }
    details.step > .step-body { padding: 0 12px 12px; }
    .step-index { color: var(--muted); font-size: .82rem; font-weight: 850; }
    .step-head { display: flex; gap: 10px; align-items: center; justify-content: space-between; }
    .step h3 { margin: 0; font-size: .98rem; }
    .pill { border-radius: 999px; padding: 5px 9px; font-size: .75rem; font-weight: 900; text-transform: uppercase; }
    .pass { background: #eefaf3; color: #136337; border: 1px solid #93d5ba; }
    .fail { background: #fff4f2; color: var(--danger); border: 1px solid #f3b6af; }
    .warn { background: #fff8e7; color: var(--warn); border: 1px solid #f0c36d; }
    .skip { background: var(--panel-low); color: var(--muted); border: 1px solid var(--line); }
    pre {
      max-width: 100%;
      overflow: auto;
      white-space: pre-wrap;
      overflow-wrap: anywhere;
      border: 1px solid rgba(29, 39, 36, .14);
      border-radius: 8px;
      margin: 10px 0 0;
      padding: 10px;
      background: #1d2724;
      color: #eef2ef;
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      font-size: .8rem;
      line-height: 1.5;
    }
    .diag { display: grid; gap: 8px; }
    .diag div { display: grid; grid-template-columns: 180px minmax(0, 1fr); gap: 10px; border: 1px solid var(--line); border-radius: 8px; padding: 10px; background: var(--panel-raised); }
    .diag span { color: var(--muted); font-weight: 800; font-size: .82rem; }
    .empty { color: var(--muted); line-height: 1.5; }
    .stack { display: grid; gap: 12px; }
    .inline-tools {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      align-items: center;
      margin-bottom: 12px;
    }
    .history-list {
      display: grid;
      gap: 8px;
      margin: 0;
      padding: 0;
      list-style: none;
    }
    .history-list li {
      display: grid;
      gap: 4px;
      border: 1px solid var(--line);
      border-radius: 8px;
      padding: 10px;
      background: var(--panel-raised);
      color: var(--muted);
      font-size: .84rem;
    }
    .history-list strong { color: var(--fg); }
    .previous-runs-panel { grid-column: 1 / -1; }
    .previous-runs {
      border: 1px solid var(--line);
      border-radius: 8px;
      background: var(--panel);
      box-shadow: var(--shadow-subtle);
      overflow: hidden;
    }
    .previous-runs summary {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      min-height: 52px;
      padding: 0 16px;
      cursor: pointer;
      font-weight: 900;
      list-style: none;
    }
    .previous-runs summary::-webkit-details-marker { display: none; }
    .previous-runs-body {
      display: grid;
      gap: 10px;
      border-top: 1px solid var(--line);
      padding: 14px;
      background: var(--panel-raised);
    }
    .history-head {
      display: flex;
      justify-content: space-between;
      gap: 10px;
      align-items: center;
    }
    .history-head span,
    .history-meta {
      color: var(--muted);
      font-size: .78rem;
      font-weight: 800;
    }
    .history-meta { overflow-wrap: anywhere; }
    @media (max-width: 840px) {
      main.inspector-shell { width: min(100% - 24px, 620px); padding-top: 0; }
      .product-topbar-inner { display: grid; min-height: auto; gap: 10px; padding: 16px 0; }
      .product-top-tabs { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; }
      .product-top-tabs span { min-height: 36px; display: inline-flex; align-items: center; border: 1px solid var(--line); border-radius: 8px; padding: 0 10px; background: var(--panel); }
      .inspector-body { grid-template-columns: 1fr; }
      .product-side-rail { position: static; min-height: 0; border-right: 0; padding: 0; background: transparent; }
      .side-nav { grid-template-columns: 1fr; }
      .layout, .home-grid, .summary, .diag div { grid-template-columns: 1fr; }
      h1 { font-size: 2rem; }
      .mode-head, .header-row, .step-card-head { display: grid; align-items: start; }
      .workflow-switch, .step-actions { justify-content: start; }
      .send-generic-button, .workflow-link { width: 100%; justify-content: center; }
      .help-tooltip::after {
        position: fixed;
        left: 16px;
        right: 16px;
        bottom: auto;
        top: 76px;
        width: auto;
        transform: none;
      }
    }
  </style>
</head>
<body class="page-${safePage}">
  <main class="inspector-shell">
    <div class="product-topbar">
      <div class="product-topbar-inner">
        <a class="product-wordmark" href="/">MCP Inspector</a>
        <nav class="product-top-tabs" aria-label="Inspector workflow groups">
          <a href="/" data-active="${safePage === "home" ? "true" : ""}">Overview</a>
          <a href="/mock" data-active="${safePage === "mock" ? "true" : ""}">Mock Scenario</a>
          <a href="/generic" data-active="${safePage === "generic" ? "true" : ""}">Generic Target</a>
          <a href="/oauth" data-active="${safePage === "oauth" ? "true" : ""}">OAuth Popup</a>
        </nav>
        <div class="product-top-actions" aria-label="Inspector status">
          <span class="status-chip">${iconSvg("terminal", "status-icon")}LOCAL</span>
          <span class="status-chip">${iconSvg("server", "status-icon")}UI</span>
          <span class="product-status-dot" aria-label="Ready"></span>
        </div>
      </div>
    </div>
    <div class="inspector-body">
      <aside class="product-side-rail" aria-label="Inspector navigation">
        <div class="product-nav-brand">
          <div class="product-brand-icon" aria-hidden="true">${iconSvg("activity", "brand-icon")}</div>
          <div>
            <a href="/" class="product-nav-mark">Protocol Lab</a>
            <span>standalone inspector</span>
          </div>
        </div>
        <nav class="side-nav">
          <div class="side-nav-group">
            <span class="side-nav-label">Workflows</span>
            <a href="/" aria-label="Side workflow overview" aria-current="${safePage === "home" ? "page" : ""}">${iconSvg("overview", "side-nav-icon")}<span>Overview</span></a>
            <a href="/mock" aria-label="Side workflow mock" aria-current="${safePage === "mock" ? "page" : ""}">${iconSvg("mock", "side-nav-icon")}<span>Mock Server scenario</span></a>
            <a href="/generic" aria-label="Side workflow generic" aria-current="${safePage === "generic" ? "page" : ""}">${iconSvg("generic", "side-nav-icon")}<span>Generic MCP target</span></a>
            <a href="/oauth" aria-label="Side workflow oauth" aria-current="${safePage === "oauth" ? "page" : ""}">${iconSvg("oauth", "side-nav-icon")}<span>OAuth popup flow</span></a>
          </div>
        </nav>
      </aside>
      <div class="inspector-content">
    <header class="page-header">
      <div class="header-row">
        <div class="header-copy">
          <p class="eyebrow">${headerCopy.eyebrow}</p>
          <h1>${headerCopy.title}</h1>
          <p class="lede">${headerCopy.lede}</p>
          ${safePage === "oauth" ? `<p class="handoff-highlight">Final handoff: token is sent to Generic MCP Target for the actual Bearer MCP call.</p>` : ""}
        </div>
      </div>
    </header>
    ${safePage === "home" ? `<section class="home-only home-grid" aria-label="Inspector workflow choices">
      <a class="mode-card" href="/mock">
        <strong>Mock Server scenario</strong>
        <span>Run the broad local scenario for health, config, REST, MCP tools/resources/prompts/completion, SSE notifications, Basic, OAuth permissions, audit, reset guards, and cleanup.</span>
      </a>
      <a class="mode-card" href="/generic">
        <strong>Generic MCP target</strong>
        <span>Inspect one MCP Streamable HTTP endpoint with route presets, Authorization helpers, method presets, and raw protocol evidence.</span>
      </a>
      <a class="mode-card" href="/oauth">
        <strong>OAuth popup flow</strong>
        <span>Open the Mock Server login and consent flow in a popup, exchange the authorization code with PKCE, then reuse the token in Generic target.</span>
      </a>
    </section>` : ""}
    <div class="mode-grid">
      ${safePage === "mock" ? `<div class="layout mock-page">
        <form id="mock-form">
          <div class="mode-head">
            <div>
              <h2>Mock Server scenario</h2>
              <p>Creates temporary records, verifies the main product flows, then cleans up mutable test data.</p>
            </div>
            <span class="pill warn">broad</span>
          </div>
          <label>
            <span class="label-text">Mock Server base URL ${helpTooltip("The running Mock Server address. The scenario sends admin, REST, MCP, and OAuth requests to this server.")}</span>
            <input name="baseUrl" value="${DEFAULT_MOCK_BASE_URL}" placeholder="http://127.0.0.1:3100" />
          </label>
          <label class="check-row">
            <input name="includeReset" type="checkbox" />
            <span class="label-text">Include destructive root reset ${helpTooltip("Optional. When enabled, the scenario also proves root-protected reset. Leave it off for normal non-destructive checks.")}</span>
          </label>
          <label class="check-row">
            <input name="insecureTls" type="checkbox" />
            <span class="label-text">Allow self-signed HTTPS for this run ${helpTooltip("Allows local HTTPS certificates you created for testing. Keep it off for normal HTTP or publicly trusted HTTPS targets.")}</span>
          </label>
          <label>
            <span class="label-text">Root password for optional reset ${helpTooltip("Only used when destructive reset is enabled. The value is sent to the Mock Server reset API and is not stored by this page.")}</span>
            <input name="rootPassword" type="password" placeholder="Only needed when reset is enabled" />
          </label>
          <p class="hint">Default run covers health, config, discovery, endpoint admin, REST, MCP tools/resources/prompts/completion, SSE notifications, Basic, OAuth Bearer permissions, token revocation, audit, reset denial, and cleanup. Root reset stays off unless you opt in. Use self-signed HTTPS only for local certificates you control.</p>
          <p class="hint">This page remembers recent Base URL, Endpoint path, and protocol/tool names in this browser only. Headers, tool arguments, root passwords, and other secret-like fields are not stored.</p>
          <div class="actions">
            <button id="run-mock-button" type="submit">Run Mock Server scenario</button>
          </div>
        </form>
        <section>
          <h2>Scenario results</h2>
          <div id="mock-results" class="empty">No Mock Server scenario has run yet.</div>
        </section>
      </div>` : ""}

      ${safePage === "generic" ? `<div class="layout generic-page">
        <form id="inspect-form">
          <div class="mode-head">
            <div>
              <h2>Generic MCP target</h2>
              <p>Use this for any MCP HTTP server, including services that are not this Mock Server.</p>
            </div>
            <span class="pill pass">portable</span>
          </div>
          <label>
            <span class="label-text">Base URL ${helpTooltip("The server root, such as https://mcp.minasoftai.com or http://127.0.0.1:3100. The endpoint path below is joined to this root.")}</span>
            <input name="baseUrl" value="${DEFAULT_MOCK_BASE_URL}" placeholder="http://127.0.0.1:3100" />
          </label>
          <label>
            <span class="label-text">Route preset ${helpTooltip("Optional shortcut for this Mock Server's common MCP routes. Presets lock the endpoint path and fill matching auth helper fields.")}</span>
            <select name="mockRoutePreset">
              <option value="custom">Custom endpoint path</option>
              <option value="none">Mock no-auth /mcp/none</option>
              <option value="basic">Mock Basic /mcp/basic</option>
              <option value="oauth">Mock OAuth /mcp/oauth</option>
            </select>
          </label>
          <div id="route-preset-note" class="select-note" aria-live="polite"></div>
          <label>
            <span class="label-text">Endpoint path ${helpTooltip("The MCP route path joined to Base URL. Resource and prompt checks are method presets and usually use the same endpoint path.")}</span>
            <input name="endpointPath" value="/mcp/none" placeholder="/mcp/none" />
          </label>
          <div id="full-url-preview" class="url-preview" aria-live="polite">
            <span>Full URL used for this run</span>
            <code>http://127.0.0.1:3100/mcp/none</code>
          </div>
          <input name="mcpUrl" type="hidden" value="http://127.0.0.1:3100/mcp/none" />
          <label>
            <span class="label-text">Protocol version ${helpTooltip("Sent as the MCP-Protocol-Version header after initialize. Use the version your MCP client or server expects.")}</span>
            <input name="protocolVersion" value="${DEFAULT_PROTOCOL_VERSION}" />
          </label>
          <label>
            <span class="label-text">Authorization helper ${helpTooltip("Builds the Authorization header for common no-auth, Basic, or Bearer-token MCP calls.")}</span>
            <select name="authMode">
              <option value="none">No Authorization header</option>
              <option value="basic">Basic username/password</option>
              <option value="bearer">Bearer token</option>
            </select>
          </label>
          <div id="auth-mode-note" class="select-note" aria-live="polite"></div>
          <div id="basic-auth-fields" class="auth-fields">
            <label>
              <span class="label-text">Basic username ${helpTooltip("Username for the Basic Authorization header. The seeded Mock Server user is default.")}</span>
              <input name="basicUsername" autocomplete="off" placeholder="default" />
            </label>
            <label>
              <span class="label-text">Basic password ${helpTooltip("Password for the Basic Authorization header. It is used for this run only and is not saved in browser storage.")}</span>
              <input name="basicPassword" type="password" autocomplete="off" placeholder="default" />
            </label>
          </div>
          <div id="bearer-auth-fields" class="auth-fields">
            <label>
              <span class="label-text">Bearer token ${helpTooltip("Access token sent as Authorization: Bearer. For Mock Server OAuth, use the token helper below.")}</span>
              <textarea name="bearerToken" autocomplete="off" placeholder="eyJ..."></textarea>
            </label>
            <div class="stack">
              <label>
                <span class="label-text">Mock OAuth client id ${helpTooltip("Client id used by the token helper when requesting a client_credentials token from the Mock Server.")}</span>
                <input name="oauthClientId" autocomplete="off" placeholder="default" value="default" />
              </label>
              <label>
                <span class="label-text">Mock OAuth client secret ${helpTooltip("Client secret used only for the token-helper request. It is not shown in evidence and is not persisted.")}</span>
                <input name="oauthClientSecret" type="password" autocomplete="off" placeholder="default" />
              </label>
              <label>
                <span class="label-text">Optional OAuth scope ${helpTooltip("Limits the token to specific endpoint permissions when the Mock OAuth client allows them.")}</span>
                <input name="oauthScope" autocomplete="off" placeholder="endpoint:endpoint_default_echo" />
              </label>
              <div class="actions">
                <button id="issue-token-button" class="secondary-button" type="button">Issue Mock OAuth token</button>
                ${helpTooltip("Calls the Mock Server OAuth token endpoint with client_credentials, then fills the Bearer token field.")}
              </div>
              <div id="token-helper-status" class="hint" aria-live="polite"></div>
            </div>
          </div>
          <label>
            <span class="label-text">Extra headers JSON ${helpTooltip("Optional JSON object merged into the request headers. Use it for custom local targets, API keys, or non-standard test headers.")}</span>
            <textarea name="headersJson" placeholder='{"Authorization":"Bearer ..."}'></textarea>
          </label>
          <p class="hint">Use the helper for common Basic or Bearer calls. Extra headers JSON is still available for API keys or custom local server requirements. Secrets are redacted in displayed request evidence and are not stored in browser history for this page.</p>
          <div class="inline-tools" aria-label="Target config tools">
            <button id="copy-config-button" class="secondary-button" type="button">Copy target config JSON</button>
            <button id="import-config-button" class="secondary-button" type="button">Import target config JSON</button>
          </div>
          <label>
            <span class="label-text">Target config JSON ${helpTooltip("Portable, redacted target settings inspired by MCP Inspector connection presets. Paste exported JSON here to fill the form.")}</span>
            <textarea name="targetConfigJson" placeholder='{"baseUrl":"http://127.0.0.1:3100","endpointPath":"/mcp/none","authMode":"none"}'></textarea>
          </label>
          <div id="config-helper-status" class="hint" aria-live="polite"></div>
          <label class="check-row">
            <input name="insecureTls" type="checkbox" />
            <span class="label-text">Allow self-signed HTTPS for this run ${helpTooltip("Allows self-signed local HTTPS certificates for this inspection only. It does not change global system trust.")}</span>
          </label>
          <p class="hint">Enable this only for local HTTPS targets such as an MCP Mock Server started with <code>npm run start:tls</code>.</p>
          <label>
            <span class="label-text">Optional tool name ${helpTooltip("When set, the inspector sends tools/call after initialize and tools/list. Leave blank to stop after listing tools.")}</span>
            <input name="toolName" placeholder="echo" />
          </label>
          <label>
            <span class="label-text">Optional tool arguments JSON ${helpTooltip("JSON object used as params.arguments for tools/call. It must match the selected tool's input schema.")}</span>
            <textarea name="toolArgsJson" placeholder='{"message":"hello"}'>{}</textarea>
          </label>
          <label>
            <span class="label-text">MCP method preset ${helpTooltip("Choose the server-side MCP method to verify after initialize. Tools mode keeps the optional tools/call fields above.")}</span>
            <select name="methodPreset">
              <option value="tools">Tools list/call</option>
              <option value="resourcesList">resources/list</option>
              <option value="resourcesRead">resources/read</option>
              <option value="resourceTemplatesList">resources/templates/list</option>
              <option value="promptsList">prompts/list</option>
              <option value="promptsGet">prompts/get</option>
              <option value="completionPrompt">completion/complete prompt</option>
              <option value="completionResource">completion/complete resource template</option>
            </select>
          </label>
          <div id="method-preset-note" class="select-note" aria-live="polite"></div>
          <label>
            <span class="label-text">Method params JSON ${helpTooltip("JSON object used as params for the selected resources/read, prompts/get, or completion/complete preset. List methods usually use {}.")}</span>
            <textarea name="methodParamsJson" placeholder='{"uri":"mock://resources/server-status"}'>{}</textarea>
          </label>
          <button id="run-button" type="submit">Run generic inspection</button>
        </form>
        <section>
          <h2>Generic results</h2>
          <div id="results" class="empty">No generic inspection has run yet.</div>
        </section>
        <section class="previous-runs-panel">
          <details id="previous-runs" class="previous-runs">
            <summary>
              <span>Previous runs</span>
              <span id="history-count" class="pill skip">0 saved</span>
            </summary>
            <div class="previous-runs-body">
              <div id="request-history" class="empty">No previous generic runs in this tab yet.</div>
            </div>
          </details>
        </section>
      </div>` : ""}

      ${safePage === "oauth" ? `<div class="layout oauth-page">
        <form id="oauth-popup-form">
          <div class="mode-head">
            <div>
              <h2>OAuth popup flow</h2>
              <p>Uses the Mock Server authorization page so users can test login, consent, callback, PKCE token exchange, and Bearer MCP calls.</p>
            </div>
            <span class="pill warn">browser</span>
          </div>
          <label>
            <span class="label-text">Mock Server base URL ${helpTooltip("The running Mock Server address. The popup opens this server's /oauth/authorize page.")}</span>
            <input name="baseUrl" value="${DEFAULT_MOCK_BASE_URL}" placeholder="http://127.0.0.1:3100" />
          </label>
          <label class="check-row">
            <input name="insecureTls" type="checkbox" />
            <span class="label-text">Allow self-signed HTTPS for token exchange ${helpTooltip("Allows local HTTPS certificates for the token exchange after the browser callback returns.")}</span>
          </label>
          <p class="hint">This flow creates a temporary OAuth client with this inspector callback URL, opens the Mock Server login and consent UI in a popup, exchanges the returned authorization code with PKCE S256, then can fill Generic MCP target with the Bearer token.</p>
          <p class="hint">The Mock Server seeded OAuth user is <code>default</code> / <code>default</code>. The access token and client secret stay in this tab session and are not stored in localStorage.</p>
          <div class="actions">
            <button id="start-oauth-popup-button" type="submit">Start popup OAuth flow</button>
            <button id="send-oauth-generic-button" class="secondary-button" type="button" disabled>Send token to Generic MCP target</button>
          </div>
        </form>
        <section>
          <h2>OAuth flow results</h2>
          <div id="oauth-popup-results" class="empty">No popup OAuth flow has run yet.</div>
        </section>
      </div>` : ""}
    </div>
      </div>
    </div>
  </main>
  <script>
    const form = document.querySelector("#inspect-form");
    const button = document.querySelector("#run-button");
    const results = document.querySelector("#results");
    const mockForm = document.querySelector("#mock-form");
    const mockButton = document.querySelector("#run-mock-button");
    const mockResults = document.querySelector("#mock-results");
    const basicAuthFields = document.querySelector("#basic-auth-fields");
    const bearerAuthFields = document.querySelector("#bearer-auth-fields");
    const routePresetNote = document.querySelector("#route-preset-note");
    const authModeNote = document.querySelector("#auth-mode-note");
    const methodPresetNote = document.querySelector("#method-preset-note");
    const issueTokenButton = document.querySelector("#issue-token-button");
    const tokenHelperStatus = document.querySelector("#token-helper-status");
    const copyConfigButton = document.querySelector("#copy-config-button");
    const importConfigButton = document.querySelector("#import-config-button");
    const configHelperStatus = document.querySelector("#config-helper-status");
    const requestHistory = document.querySelector("#request-history");
    const historyCount = document.querySelector("#history-count");
    const fullUrlPreview = document.querySelector("#full-url-preview code");
    const oauthPopupForm = document.querySelector("#oauth-popup-form");
    const oauthPopupButton = document.querySelector("#start-oauth-popup-button");
    const oauthPopupResults = document.querySelector("#oauth-popup-results");
    const sendOAuthGenericButton = document.querySelector("#send-oauth-generic-button");
    const storageKey = "mcp-mock-standalone-inspector:v1";
    const genericDraftKey = "${GENERIC_DRAFT_STORAGE_KEY}";
    const historyKey = "mcp-mock-standalone-inspector:request-history:v1";
    const oauthGenericDraftKey = "mcp-mock-standalone-inspector:oauth-generic-draft:v1";
    const routePresetHelp = ${JSON.stringify(GENERIC_ROUTE_PRESET_HELP)};
    const authModeHelp = ${JSON.stringify(GENERIC_AUTH_HELP)};
    const methodPresetHelp = ${JSON.stringify(GENERIC_METHOD_PRESET_HELP)};
    const scenarioStepHelp = ${JSON.stringify(MOCK_SCENARIO_STEP_HELP)};

    function readRecentSettings() {
      try {
        return JSON.parse(window.localStorage.getItem(storageKey) || "{}") || {};
      } catch {
        return {};
      }
    }

    function writeRecentSettings(nextSettings) {
      const current = readRecentSettings();
      window.localStorage.setItem(storageKey, JSON.stringify({ ...current, ...nextSettings }));
    }

    function hydrateRecentSettings() {
      const settings = readRecentSettings();
      if (mockForm && settings.mockBaseUrl) mockForm.elements.baseUrl.value = settings.mockBaseUrl;
      if (mockForm && settings.mockInsecureTls === true) mockForm.elements.insecureTls.checked = true;
      if (form && settings.mockBaseUrl) form.elements.baseUrl.value = settings.mockBaseUrl;
      if (form && settings.endpointPath) form.elements.endpointPath.value = settings.endpointPath;
      if (form && settings.mcpUrl && !settings.endpointPath) applyTargetUrl(settings.mcpUrl);
      if (form && settings.protocolVersion) form.elements.protocolVersion.value = settings.protocolVersion;
      if (form && settings.genericInsecureTls === true) form.elements.insecureTls.checked = true;
      if (form && settings.methodPreset) {
        form.elements.methodPreset.value = settings.methodPreset;
        form.elements.methodParamsJson.value = methodParamsForPreset(settings.methodPreset);
      }
      if (form && settings.toolName) form.elements.toolName.value = settings.toolName;
      hydrateGenericDraft();
    }

    function hydrateGenericDraft() {
      if (!form || !document.body.classList.contains("page-generic")) return;
      let draft = null;
      try {
        draft = JSON.parse(window.localStorage.getItem(genericDraftKey) || "null");
      } catch {
        draft = null;
      }
      if (!draft) return;
      if (draft.baseUrl) form.elements.baseUrl.value = draft.baseUrl;
      if (draft.mockRoutePreset) form.elements.mockRoutePreset.value = draft.mockRoutePreset;
      if (draft.endpointPath) form.elements.endpointPath.value = draft.endpointPath;
      if (draft.mcpUrl && !draft.endpointPath) applyTargetUrl(draft.mcpUrl);
      if (draft.protocolVersion) form.elements.protocolVersion.value = draft.protocolVersion;
      if (draft.authMode) form.elements.authMode.value = draft.authMode;
      if (draft.basicUsername) form.elements.basicUsername.value = draft.basicUsername;
      if (draft.basicPassword) form.elements.basicPassword.value = draft.basicPassword;
      if (draft.bearerToken) form.elements.bearerToken.value = draft.bearerToken;
      if (draft.oauthClientId) form.elements.oauthClientId.value = draft.oauthClientId;
      if (draft.oauthClientSecret) form.elements.oauthClientSecret.value = draft.oauthClientSecret;
      if (draft.oauthScope) form.elements.oauthScope.value = draft.oauthScope;
      if (draft.methodPreset) form.elements.methodPreset.value = draft.methodPreset;
      if (draft.methodParamsJson) form.elements.methodParamsJson.value = draft.methodParamsJson;
      if (draft.toolName) form.elements.toolName.value = draft.toolName;
      if (draft.toolArgsJson) form.elements.toolArgsJson.value = draft.toolArgsJson;
      if (draft.headersJson) form.elements.headersJson.value = draft.headersJson;
      form.elements.insecureTls.checked = draft.insecureTls === true;
      applyMockRoutePreset({ preserveCustomPath: true });
      updateFullUrlPreview();
      updateAuthFields();
      updateMethodPresetNote();
      window.localStorage.removeItem(genericDraftKey);
    }

    function updateAuthFields() {
      if (!form) return;
      const mode = form.elements.authMode.value;
      if (basicAuthFields) basicAuthFields.classList.toggle("active", mode === "basic");
      if (bearerAuthFields) bearerAuthFields.classList.toggle("active", mode === "bearer");
      if (authModeNote) authModeNote.textContent = authModeHelp[mode] || "";
    }

    function updateRoutePresetNote() {
      if (!form || !routePresetNote) return;
      routePresetNote.textContent = routePresetHelp[form.elements.mockRoutePreset.value] || "";
    }

    function methodParamsForPreset(preset) {
      const params = {
        tools: "{}",
        resourcesList: "{}",
        resourcesRead: JSON.stringify({ uri: "mock://resources/server-status" }),
        resourceTemplatesList: "{}",
        promptsList: "{}",
        promptsGet: JSON.stringify({ name: "support_reply", arguments: { tone: "friendly" } }),
        completionPrompt: JSON.stringify({ ref: { type: "ref/prompt", name: "support_reply" }, argument: { name: "tone", value: "fri" } }),
        completionResource: JSON.stringify({ ref: { type: "ref/resource", uri: "mock://resources/customers/{customerId}" }, argument: { name: "customerId", value: "cust" } }),
      };
      return params[preset] || "{}";
    }

    function updateMethodPresetNote() {
      if (!form || !methodPresetNote) return;
      methodPresetNote.textContent = methodPresetHelp[form.elements.methodPreset.value] || "";
    }

    function applyMethodPreset() {
      if (!form) return;
      const preset = form.elements.methodPreset.value;
      form.elements.methodParamsJson.value = methodParamsForPreset(preset);
      updateMethodPresetNote();
    }

    function currentMockBaseUrl() {
      const value = form?.elements?.baseUrl?.value || mockForm?.elements?.baseUrl?.value || "${DEFAULT_MOCK_BASE_URL}";
      return String(value).trim().replace(/\\/+$/, "");
    }

    function splitTargetUrl(value) {
      try {
        const parsed = new URL(String(value || "").trim());
        return {
          baseUrl: parsed.origin,
          endpointPath: parsed.pathname + parsed.search,
        };
      } catch {
        return null;
      }
    }

    function applyTargetUrl(value) {
      if (!form) return;
      const split = splitTargetUrl(value);
      if (!split) return;
      form.elements.baseUrl.value = split.baseUrl;
      form.elements.endpointPath.value = split.endpointPath || "/mcp/none";
    }

    function normalizedEndpointPath() {
      if (!form) return "/mcp/none";
      const rawPath = String(form.elements.endpointPath.value || "").trim() || "/mcp/none";
      return rawPath.startsWith("/") ? rawPath : "/" + rawPath;
    }

    function resolvedTargetUrl() {
      if (!form) return "";
      try {
        const baseUrl = currentMockBaseUrl();
        const endpointPath = normalizedEndpointPath();
        return new URL(endpointPath, baseUrl + "/").toString();
      } catch {
        return "";
      }
    }

    function updateFullUrlPreview() {
      if (!form) return;
      const endpointPath = normalizedEndpointPath();
      form.elements.endpointPath.value = endpointPath;
      const fullUrl = resolvedTargetUrl();
      form.elements.mcpUrl.value = fullUrl;
      if (fullUrlPreview) {
        fullUrlPreview.textContent = fullUrl || "Enter a valid Base URL and endpoint path.";
      }
    }

    function applyMockRoutePreset(options = {}) {
      if (!form) return;
      const preset = form.elements.mockRoutePreset.value;
      const endpointPath = form.elements.endpointPath;
      endpointPath.readOnly = preset !== "custom";
      if (preset === "custom") {
        if (!options.preserveCustomPath) updateFullUrlPreview();
        return;
      }
      const baseUrl = currentMockBaseUrl();
      if (preset === "none") {
        endpointPath.value = "/mcp/none";
        form.elements.authMode.value = "none";
      } else if (preset === "basic") {
        endpointPath.value = "/mcp/basic";
        form.elements.authMode.value = "basic";
        form.elements.basicUsername.value = "default";
        form.elements.basicPassword.value = "default";
      } else if (preset === "oauth") {
        endpointPath.value = "/mcp/oauth";
        form.elements.authMode.value = "bearer";
        form.elements.oauthClientId.value = form.elements.oauthClientId.value || "default";
        form.elements.oauthClientSecret.value = form.elements.oauthClientSecret.value || "default";
      }
      updateFullUrlPreview();
      updateAuthFields();
    }

    function parseHeaderInput(value) {
      if (!String(value || "").trim()) return {};
      const parsed = JSON.parse(value);
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        throw new Error("Extra headers JSON must be an object.");
      }
      return parsed;
    }

    function authorizationHeader(payload) {
      if (payload.authMode === "basic") {
        const username = String(payload.basicUsername || "").trim();
        const password = String(payload.basicPassword || "");
        if (!username || !password) throw new Error("Basic username and password are required.");
        return "Basic " + btoa(username + ":" + password);
      }
      if (payload.authMode === "bearer") {
        const token = String(payload.bearerToken || "").trim();
        if (!token) throw new Error("Bearer token is required.");
        return "Bearer " + token;
      }
      return "";
    }

    function mergeAuthorizationHeader(payload) {
      const headers = parseHeaderInput(payload.headersJson);
      const authorization = authorizationHeader(payload);
      if (authorization) headers.Authorization = authorization;
      payload.headersJson = Object.keys(headers).length ? JSON.stringify(headers) : "";
      delete payload.authMode;
      delete payload.basicUsername;
      delete payload.basicPassword;
      delete payload.bearerToken;
      delete payload.mockRoutePreset;
      delete payload.baseUrl;
      delete payload.endpointPath;
      delete payload.oauthClientId;
      delete payload.oauthClientSecret;
      delete payload.oauthScope;
      return payload;
    }

    function currentTargetConfig() {
      if (!form) return {};
      return {
        baseUrl: String(form.elements.baseUrl.value || ""),
        mockRoutePreset: String(form.elements.mockRoutePreset.value || "custom"),
        endpointPath: normalizedEndpointPath(),
        mcpUrl: resolvedTargetUrl(),
        protocolVersion: String(form.elements.protocolVersion.value || ""),
        authMode: String(form.elements.authMode.value || "none"),
        basicUsername: String(form.elements.basicUsername.value || ""),
        oauthClientId: String(form.elements.oauthClientId.value || ""),
        oauthScope: String(form.elements.oauthScope.value || ""),
        headersJson: String(form.elements.headersJson.value || ""),
        insecureTls: form.elements.insecureTls.checked,
        methodPreset: String(form.elements.methodPreset.value || "tools"),
        methodParamsJson: String(form.elements.methodParamsJson.value || "{}"),
        toolName: String(form.elements.toolName.value || ""),
        toolArgsJson: String(form.elements.toolArgsJson.value || "{}"),
      };
    }

    function applyTargetConfig(config) {
      if (!form || !config || typeof config !== "object") return;
      if (config.baseUrl) form.elements.baseUrl.value = config.baseUrl;
      if (config.mockRoutePreset) form.elements.mockRoutePreset.value = config.mockRoutePreset;
      if (config.endpointPath) form.elements.endpointPath.value = config.endpointPath;
      if (config.mcpUrl && !config.endpointPath) applyTargetUrl(config.mcpUrl);
      if (config.protocolVersion) form.elements.protocolVersion.value = config.protocolVersion;
      if (config.authMode) form.elements.authMode.value = config.authMode;
      if (config.basicUsername) form.elements.basicUsername.value = config.basicUsername;
      if (config.basicPassword) form.elements.basicPassword.value = config.basicPassword;
      if (config.bearerToken) form.elements.bearerToken.value = config.bearerToken;
      if (config.oauthClientId) form.elements.oauthClientId.value = config.oauthClientId;
      if (config.oauthClientSecret) form.elements.oauthClientSecret.value = config.oauthClientSecret;
      if (config.oauthScope) form.elements.oauthScope.value = config.oauthScope;
      if (config.headersJson) form.elements.headersJson.value = config.headersJson;
      if (config.methodPreset) form.elements.methodPreset.value = config.methodPreset;
      if (config.methodParamsJson) form.elements.methodParamsJson.value = config.methodParamsJson;
      if (config.toolName) form.elements.toolName.value = config.toolName;
      if (config.toolArgsJson) form.elements.toolArgsJson.value = config.toolArgsJson;
      form.elements.insecureTls.checked = config.insecureTls === true;
      applyMockRoutePreset({ preserveCustomPath: true });
      updateFullUrlPreview();
      updateAuthFields();
      updateRoutePresetNote();
      updateMethodPresetNote();
    }

    function readHistory() {
      try {
        return JSON.parse(window.sessionStorage.getItem(historyKey) || "[]") || [];
      } catch {
        return [];
      }
    }

    function writeHistory(entries) {
      window.sessionStorage.setItem(historyKey, JSON.stringify(entries.slice(0, 8)));
    }

    function addHistoryEntry(entry) {
      const next = [{ ...entry, at: new Date().toLocaleTimeString() }, ...readHistory()];
      writeHistory(next);
      renderHistory();
    }

    function methodLabelForConfig(config) {
      const preset = String(config.methodPreset || "tools");
      if (preset === "tools") {
        const toolName = String(config.toolName || "").trim();
        return toolName ? "tools/call · " + toolName : "tools/list";
      }
      const labels = {
        resourcesList: "resources/list",
        resourcesRead: "resources/read",
        resourceTemplatesList: "resources/templates/list",
        promptsList: "prompts/list",
        promptsGet: "prompts/get",
        completionPrompt: "completion/complete · prompt",
        completionResource: "completion/complete · resource template",
      };
      return labels[preset] || preset;
    }

    function renderHistory() {
      if (!requestHistory) return;
      const entries = readHistory();
      if (historyCount) historyCount.textContent = entries.length + " saved";
      if (!entries.length) {
        requestHistory.className = "empty";
        requestHistory.textContent = "No previous generic runs in this tab yet.";
        return;
      }
      requestHistory.className = "";
      requestHistory.innerHTML = '<ul class="history-list">' + entries.map((entry) =>
        '<li><div class="history-head"><strong>' + escapeHtml(entry.ok ? "Pass" : "Fail") + ' · ' + escapeHtml(entry.methodLabel || entry.toolName || "tools/list") + '</strong><span>' + escapeHtml(entry.at || "") + '</span></div><div class="history-meta">' + escapeHtml(entry.authMode || "none") + ' · POST ' + escapeHtml(entry.mcpUrl || "") + '</div></li>'
      ).join("") + '</ul>';
    }

    function escapeHtml(value) {
      return String(value)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;");
    }

    function pretty(value) {
      return escapeHtml(JSON.stringify(value, null, 2));
    }

    function renderHelpTooltip(text) {
      if (!text) return "";
      return '<span class="help-tooltip" tabindex="0" title="' + escapeHtml(text) + '" data-tooltip="' + escapeHtml(text) + '"></span>';
    }

    function render(data) {
      const summary = data.summary ?? { pass: 0, warn: 0, skip: 0, fail: 0 };
      const diagnostics = (data.diagnostics ?? []).map((item) =>
        '<div><span>' + escapeHtml(item.check) + '</span><code>' + escapeHtml(item.value) + '</code></div>'
      ).join("");
      const steps = (data.steps ?? []).map((step, index) => {
        const evidence = step.evidence ? '<p class="hint">' + escapeHtml(step.evidence) + '</p>' : "";
        const request = step.request ? '<pre aria-label="' + escapeHtml(step.name) + ' request">' + pretty(step.request) + '</pre>' : "";
        const response = step.response ? '<pre aria-label="' + escapeHtml(step.name) + ' response">' + pretty(step.response) + '</pre>' : "";
        const genericAction = step.genericTarget
          ? '<button type="button" class="secondary-button send-generic-button" data-generic-target="' + escapeHtml(JSON.stringify(step.genericTarget)) + '">Send to Generic MCP target</button>'
          : "";
        const stepHelp = data.kind === "mock-scenario" ? renderHelpTooltip(scenarioStepHelp[step.name]) : "";
        const open = step.status === "fail" ? " open" : "";
        return '<article class="step-card"><div class="step-card-head"><div class="step-title"><span class="step-index">Step ' + (index + 1) + '</span><span class="step-name-row"><strong>' + escapeHtml(step.name) + '</strong>' + stepHelp + '</span></div><div class="step-actions">' + genericAction + '<span class="pill ' + escapeHtml(step.status) + '">' + escapeHtml(step.status) + '</span></div></div><details class="step"' + open + '><summary>View evidence</summary><div class="step-body">' + evidence + request + response + '</div></details></article>';
      }).join("");
      const statusByName = Object.fromEntries((data.steps ?? []).map((step) => [step.name, step.status]));
      const progress = data.kind === "mock-scenario" ? renderScenarioProgress(scenarioStepNames.length - 1, scenarioStepNames.length, statusByName) : "";
      return progress + '<div class="summary"><div><span>Pass</span><strong>' + summary.pass + '</strong></div><div><span>Warn</span><strong>' + summary.warn + '</strong></div><div><span>Skip</span><strong>' + summary.skip + '</strong></div><div><span>Fail</span><strong>' + summary.fail + '</strong></div></div><h2>Diagnostics</h2><div class="diag">' + diagnostics + '</div><h2>Step logs</h2><div class="stack">' + steps + '</div>';
    }

    const scenarioStepNames = ${JSON.stringify(MOCK_SCENARIO_STEP_NAMES)};

    function renderScenarioProgress(activeIndex = 0, doneCount = 0, statusByName = {}) {
      const boundedDone = Math.max(0, Math.min(doneCount, scenarioStepNames.length));
      const boundedActive = Math.max(0, Math.min(activeIndex, scenarioStepNames.length - 1));
      const percent = Math.round((boundedDone / scenarioStepNames.length) * 100);
      const items = scenarioStepNames.map((name, index) => {
        const finalStatus = statusByName[name];
        const state = finalStatus ? (finalStatus === "pass" ? "done" : finalStatus) : index < boundedDone ? "done" : index === boundedActive ? "active" : "";
        const label = finalStatus || (index < boundedDone ? "done" : index === boundedActive ? "running" : "queued");
        return '<li class="' + state + '"><span>' + escapeHtml(name) + '</span><span>' + label + '</span></li>';
      }).join("");
      return '<div class="progress-wrap"><div><strong>Scenario progress</strong><p class="hint">' + boundedDone + ' of ' + scenarioStepNames.length + ' steps complete.</p></div><div class="progress-meter" aria-label="Scenario progress"><div class="progress-bar" style="width:' + percent + '%"></div></div><ul class="progress-list">' + items + '</ul></div>';
    }

    function renderInto(container, data) {
      container.className = "";
      container.innerHTML = render(data);
    }

    if (form) form.addEventListener("submit", async (event) => {
      event.preventDefault();
      button.disabled = true;
      results.className = "empty";
      results.textContent = "Running inspection.";
      try {
        updateFullUrlPreview();
        const targetConfig = currentTargetConfig();
        const payload = Object.fromEntries(new FormData(form).entries());
        payload.insecureTls = form.elements.insecureTls.checked;
        mergeAuthorizationHeader(payload);
        writeRecentSettings({
          mockBaseUrl: targetConfig.baseUrl,
          endpointPath: targetConfig.endpointPath,
          mcpUrl: targetConfig.mcpUrl,
          protocolVersion: targetConfig.protocolVersion,
          genericInsecureTls: payload.insecureTls,
          methodPreset: targetConfig.methodPreset,
          toolName: targetConfig.toolName,
        });
        const response = await fetch("/api/inspect", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(payload),
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.message || "Inspection failed.");
        renderInto(results, data);
        addHistoryEntry({
          ok: data.ok !== false,
          mcpUrl: targetConfig.mcpUrl,
          authMode: targetConfig.authMode,
          methodLabel: methodLabelForConfig(targetConfig),
        });
      } catch (error) {
        results.className = "empty";
        results.innerHTML = '<span class="pill fail">fail</span><pre>' + escapeHtml(error.message || String(error)) + '</pre>';
        addHistoryEntry({
          ok: false,
          mcpUrl: resolvedTargetUrl(),
          authMode: form.elements.authMode.value,
          methodLabel: methodLabelForConfig(currentTargetConfig()),
        });
      } finally {
        button.disabled = false;
      }
    });

    if (mockForm) mockForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      mockButton.disabled = true;
      mockResults.className = "empty";
      mockResults.innerHTML = renderScenarioProgress(0, 0);
      let progressIndex = 0;
      const progressTimer = window.setInterval(() => {
        progressIndex = Math.min(progressIndex + 1, scenarioStepNames.length - 1);
        mockResults.innerHTML = renderScenarioProgress(progressIndex, progressIndex);
      }, 900);
      try {
        const payload = Object.fromEntries(new FormData(mockForm).entries());
        payload.includeReset = mockForm.elements.includeReset.checked;
        payload.insecureTls = mockForm.elements.insecureTls.checked;
        writeRecentSettings({
          mockBaseUrl: String(payload.baseUrl || ""),
          mockInsecureTls: payload.insecureTls,
        });
        const response = await fetch("/api/mock-scenario", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(payload),
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.message || "Scenario failed.");
        window.clearInterval(progressTimer);
        renderInto(mockResults, data);
      } catch (error) {
        window.clearInterval(progressTimer);
        mockResults.className = "empty";
        mockResults.innerHTML = '<span class="pill fail">fail</span><pre>' + escapeHtml(error.message || String(error)) + '</pre>';
      } finally {
        window.clearInterval(progressTimer);
        mockButton.disabled = false;
      }
    });

    if (issueTokenButton) issueTokenButton.addEventListener("click", async () => {
      issueTokenButton.disabled = true;
      tokenHelperStatus.textContent = "Issuing token.";
      try {
        const response = await fetch("/api/mock-oauth-token", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            baseUrl: currentMockBaseUrl(),
            clientId: form.elements.oauthClientId.value,
            clientSecret: form.elements.oauthClientSecret.value,
            scope: form.elements.oauthScope.value,
            insecureTls: form.elements.insecureTls.checked,
          }),
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.message || "Token issuance failed.");
        form.elements.authMode.value = "bearer";
        form.elements.bearerToken.value = data.accessToken;
        updateAuthFields();
        tokenHelperStatus.textContent = "Token issued and filled. Scope: " + (data.scope || "all allowed endpoints");
      } catch (error) {
        tokenHelperStatus.textContent = error.message || String(error);
      } finally {
        issueTokenButton.disabled = false;
      }
    });

    if (copyConfigButton) copyConfigButton.addEventListener("click", async () => {
      try {
        updateFullUrlPreview();
        const config = currentTargetConfig();
        const json = JSON.stringify(config, null, 2);
        form.elements.targetConfigJson.value = json;
        let copied = false;
        try {
          await navigator.clipboard.writeText(json);
          copied = true;
        } catch {
          copied = false;
        }
        configHelperStatus.textContent = copied
          ? "Target config copied without passwords or bearer tokens."
          : "Target config prepared without passwords or bearer tokens. Clipboard is unavailable in this browser.";
      } catch (error) {
        configHelperStatus.textContent = error.message || String(error);
      }
    });

    if (importConfigButton) importConfigButton.addEventListener("click", () => {
      try {
        const config = JSON.parse(form.elements.targetConfigJson.value || "{}");
        applyTargetConfig(config);
        configHelperStatus.textContent = "Target config imported.";
      } catch (error) {
        configHelperStatus.textContent = error.message || String(error);
      }
    });

    let oauthPopupSession = null;
    let oauthPopupGenericTarget = null;

    function renderOAuthStatus(data) {
      if (!oauthPopupResults) return;
      const diagnostics = (data.diagnostics ?? []).map((item) =>
        '<div><span>' + escapeHtml(item.check) + '</span><code>' + escapeHtml(item.value) + '</code></div>'
      ).join("");
      const authorizationLink = data.authorizationUrl
        ? '<p class="hint"><a class="workflow-link" href="' + escapeHtml(data.authorizationUrl) + '" target="mcpMockOAuthPopup">Open authorization popup</a> <a class="workflow-link" href="' + escapeHtml(data.authorizationUrl) + '">Continue in this tab</a></p>'
        : "";
      oauthPopupResults.className = "";
      oauthPopupResults.innerHTML = '<div class="summary"><div><span>Status</span><strong>' + escapeHtml(data.ok ? "Ready" : "Waiting") + '</strong></div><div><span>Grant</span><strong>Code</strong></div><div><span>PKCE</span><strong>S256</strong></div><div><span>Token</span><strong>' + escapeHtml(data.accessToken ? "Issued" : "Pending") + '</strong></div></div>' + authorizationLink + '<h2>Diagnostics</h2><div class="diag">' + diagnostics + '</div><pre>' + pretty({ ...data, accessToken: data.accessToken ? "<redacted>" : undefined, genericTarget: data.genericTarget ? { ...data.genericTarget, bearerToken: "<redacted>" } : undefined }) + '</pre>';
    }

    if (oauthPopupForm) oauthPopupForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      oauthPopupButton.disabled = true;
      oauthPopupResults.className = "empty";
      oauthPopupResults.textContent = "Preparing temporary OAuth client.";
      const popup = window.open("about:blank", "mcpMockOAuthPopup", "width=720,height=760");
      if (popup) {
        try {
          popup.document.write("<p style='font-family: system-ui; padding: 20px;'>Preparing OAuth authorization...</p>");
        } catch {
          // Some browser surfaces expose a popup handle without allowing document writes.
        }
      }
      try {
        const response = await fetch("/api/oauth-popup/prepare", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            baseUrl: oauthPopupForm.elements.baseUrl.value,
            insecureTls: oauthPopupForm.elements.insecureTls.checked,
          }),
        });
        const prepared = await response.json();
        if (!response.ok) throw new Error(prepared.message || "OAuth popup preparation failed.");
        oauthPopupSession = prepared;
        renderOAuthStatus({ ok: false, diagnostics: prepared.diagnostics });
        if (popup) {
          popup.location.href = prepared.authorizationUrl;
        } else {
          renderOAuthStatus({
            ok: false,
            authorizationUrl: prepared.authorizationUrl,
            diagnostics: [
              ...prepared.diagnostics,
              { check: "popup", value: "blocked; use the authorization link above" },
            ],
          });
          oauthPopupButton.disabled = false;
          return;
        }
      } catch (error) {
        if (popup && popup.location.href === "about:blank") popup.close();
        oauthPopupResults.className = "empty";
        oauthPopupResults.innerHTML = '<span class="pill fail">fail</span><pre>' + escapeHtml(error.message || String(error)) + '</pre>';
        oauthPopupButton.disabled = false;
      }
    });

    window.addEventListener("message", async (event) => {
      if (!oauthPopupForm || !event.data || event.data.source !== "mcp-mock-inspector-oauth") return;
      if (event.origin !== window.location.origin) return;
      try {
        if (!oauthPopupSession) throw new Error("OAuth popup session is missing. Start the flow again.");
        if (event.data.error) throw new Error(event.data.errorDescription || event.data.error);
        oauthPopupResults.className = "empty";
        oauthPopupResults.textContent = "Callback received. Exchanging authorization code.";
        const response = await fetch("/api/oauth-popup/exchange", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            baseUrl: oauthPopupSession.baseUrl,
            code: event.data.code,
            state: event.data.state,
            expectedState: oauthPopupSession.state,
            redirectUri: oauthPopupSession.redirectUri,
            clientId: oauthPopupSession.clientId,
            clientSecret: oauthPopupSession.clientSecret,
            codeVerifier: oauthPopupSession.codeVerifier,
            insecureTls: oauthPopupForm.elements.insecureTls.checked,
          }),
        });
        const exchanged = await response.json();
        if (!response.ok) throw new Error(exchanged.message || "OAuth token exchange failed.");
        oauthPopupGenericTarget = exchanged.genericTarget;
        sendOAuthGenericButton.disabled = false;
        renderOAuthStatus(exchanged);
      } catch (error) {
        oauthPopupResults.className = "empty";
        oauthPopupResults.innerHTML = '<span class="pill fail">fail</span><pre>' + escapeHtml(error.message || String(error)) + '</pre>';
      } finally {
        oauthPopupButton.disabled = false;
      }
    });

    if (sendOAuthGenericButton) sendOAuthGenericButton.addEventListener("click", () => {
      if (!oauthPopupGenericTarget) return;
      window.localStorage.setItem(genericDraftKey, JSON.stringify(oauthPopupGenericTarget));
      window.location.href = "/generic";
    });

    document.addEventListener("click", (event) => {
      const button = event.target.closest(".send-generic-button");
      if (!button) return;
      try {
        const draft = JSON.parse(button.dataset.genericTarget || "{}");
        window.localStorage.setItem(genericDraftKey, JSON.stringify(draft));
        window.location.href = "/generic";
      } catch (error) {
        button.textContent = error.message || "Could not send step.";
      }
    });

    if (form) form.elements.authMode.addEventListener("change", updateAuthFields);
    if (form) form.elements.mockRoutePreset.addEventListener("change", () => {
      applyMockRoutePreset();
      updateRoutePresetNote();
    });
    if (form) form.elements.baseUrl.addEventListener("input", () => {
      applyMockRoutePreset({ preserveCustomPath: true });
      updateFullUrlPreview();
    });
    if (form) form.elements.endpointPath.addEventListener("input", updateFullUrlPreview);
    if (form) form.elements.methodPreset.addEventListener("change", applyMethodPreset);
    applyMockRoutePreset({ preserveCustomPath: true });
    updateFullUrlPreview();
    updateAuthFields();
    updateRoutePresetNote();
    updateMethodPresetNote();
    hydrateRecentSettings();
    applyMockRoutePreset({ preserveCustomPath: true });
    updateFullUrlPreview();
    updateAuthFields();
    updateRoutePresetNote();
    updateMethodPresetNote();
    renderHistory();
  </script>
</body>
</html>`;
}

function createInspectorServer() {
  return createServer(async (request, response) => {
    try {
      const url = new URL(request.url ?? "/", "http://local.inspector");
      if (request.method === "GET" && url.pathname === "/") {
        htmlResponse(response, renderHtml("home"));
        return;
      }
      if (request.method === "GET" && url.pathname === "/mock") {
        htmlResponse(response, renderHtml("mock"));
        return;
      }
      if (request.method === "GET" && url.pathname === "/generic") {
        htmlResponse(response, renderHtml("generic"));
        return;
      }
      if (request.method === "GET" && url.pathname === "/oauth") {
        htmlResponse(response, renderHtml("oauth"));
        return;
      }
      if (request.method === "GET" && url.pathname === "/oauth-callback") {
        htmlResponse(response, renderOAuthCallbackHtml(url.searchParams));
        return;
      }
      if (request.method === "GET" && url.pathname === "/api/health") {
        jsonResponse(response, 200, { status: "ok", name: "standalone-mcp-inspector" });
        return;
      }
      if (request.method === "POST" && url.pathname === "/api/inspect") {
        const body = await readJson(request);
        const result = await inspectMcpTarget(body);
        jsonResponse(response, 200, result);
        return;
      }
      if (request.method === "POST" && url.pathname === "/api/mock-scenario") {
        const body = await readJson(request);
        const result = await inspectMockServerScenario(body);
        jsonResponse(response, 200, result);
        return;
      }
      if (request.method === "POST" && url.pathname === "/api/mock-oauth-token") {
        const body = await readJson(request);
        const result = await issueMockOAuthToken(body);
        jsonResponse(response, 200, result);
        return;
      }
      if (request.method === "POST" && url.pathname === "/api/oauth-popup/prepare") {
        const body = await readJson(request);
        const result = await prepareOAuthPopupFlow(body, inspectorOrigin(request));
        jsonResponse(response, 200, result);
        return;
      }
      if (request.method === "POST" && url.pathname === "/api/oauth-popup/exchange") {
        const body = await readJson(request);
        const result = await exchangeOAuthPopupCode(body);
        jsonResponse(response, 200, result);
        return;
      }
      jsonResponse(response, 404, { message: "Not found." });
    } catch (error) {
      jsonResponse(response, 400, { message: error instanceof Error ? error.message : String(error) });
    }
  });
}

try {
  const options = parseArgs(process.argv.slice(2));
  const server = createInspectorServer();
  server.listen(options.port, options.host, () => {
    const url = `http://${options.host}:${options.port}`;
    console.log(`Standalone MCP Inspector UI running at ${url}`);
    console.log("Open the URL in your browser, enter a Base URL and Endpoint path, then run inspection.");
  });
} catch (error) {
  console.error(`Inspector UI failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
}

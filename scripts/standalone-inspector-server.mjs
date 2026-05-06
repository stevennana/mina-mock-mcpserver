#!/usr/bin/env node

import { createServer } from "node:http";
import { Buffer } from "node:buffer";
import { performance } from "node:perf_hooks";
import { URL, URLSearchParams } from "node:url";

const DEFAULT_HOST = process.env.INSPECTOR_UI_HOST ?? "127.0.0.1";
const DEFAULT_PORT = Number(process.env.INSPECTOR_UI_PORT ?? "3200");
const DEFAULT_PROTOCOL_VERSION = "2025-06-18";
const DEFAULT_MOCK_BASE_URL = process.env.MCP_MOCK_BASE_URL ?? "http://127.0.0.1:3100";
const DEFAULT_DELETE_CODE = "87654321";

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

function redactHeaders(headers) {
  const redacted = {};
  for (const [key, value] of Object.entries(headers)) {
    redacted[key] = /authorization|token|secret|cookie/i.test(key) ? "<redacted>" : value;
  }
  return redacted;
}

function normalizeBaseUrl(value) {
  const baseUrl = String(value ?? "").trim() || DEFAULT_MOCK_BASE_URL;
  const url = new URL(baseUrl);
  if (!["http:", "https:"].includes(url.protocol)) {
    throw new Error("Mock Server base URL must be http or https.");
  }
  return baseUrl.replace(/\/+$/, "");
}

async function fetchJson(url, payload, headers) {
  const startedAt = performance.now();
  const response = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
  });
  const elapsedMs = Math.round(performance.now() - startedAt);
  const contentType = response.headers.get("content-type") ?? "";
  const text = await response.text();
  let body = text;
  if (contentType.includes("application/json") && text) {
    body = JSON.parse(text);
  }
  return {
    status: response.status,
    ok: response.ok,
    elapsedMs,
    headers: Object.fromEntries(response.headers.entries()),
    body,
  };
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

function decodeJwt(token) {
  const [, payload] = String(token).split(".");
  if (!payload) throw new Error("Access token is not a JWT.");
  return JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
}

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

class MockClient {
  constructor(baseUrl) {
    this.baseUrl = baseUrl;
  }

  url(path) {
    return `${this.baseUrl}${path}`;
  }

  async request(path, options = {}) {
    const startedAt = performance.now();
    const response = await fetch(this.url(path), options);
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

async function inspectMockServerScenario(input) {
  const baseUrl = normalizeBaseUrl(input.baseUrl);
  const includeReset = input.includeReset === true || input.includeReset === "on";
  const rootPassword = String(input.rootPassword ?? "");
  const client = new MockClient(baseUrl);
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
  const cleanup = {
    endpointId: "",
    basicUserId: "",
    oauthUserId: "",
    oauthClientId: "",
  };
  let endpoint = null;
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
      return { evidence: "Health is ok and config exposes MCP route URLs.", response: { health, config } };
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
      return { evidence: "OAuth metadata, protected-resource metadata, and JWKS are reachable.", response: { discovery, protectedResource, jwks } };
    });

    const endpointData = await runScenarioStep(steps, "Create temporary endpoint", async () => {
      const created = await createScenarioEndpoint(client, endpointName);
      endpoint = created.endpoint;
      cleanup.endpointId = endpoint.id;
      addDiagnostic(diagnostics, "temporary endpoint", endpointName);
      return {
        evidence: `Created ${endpointName} with exact-match and forced-error response cases.`,
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
        return { evidence: "Endpoint can be read and updated through admin APIs.", response: { detail, update } };
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
        return { evidence: "REST list, exact-match call, and configured forced-error case work.", response: { list, call, forcedError } };
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
        assertStatus(foreignOrigin, 403, "Foreign Origin rejection");
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
        addDiagnostic(diagnostics, "foreign origin", "403");
        return { evidence: "MCP protocol negotiation, list, call, protocol-version guard, and Origin guard work.", response: { initialize, badVersion, foreignOrigin, list, call } };
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
        return { evidence: "Basic user create, strict MCP access, disable, and rejection work.", response: { create, strictList, disable, disabled } };
      });

      await runScenarioStep(steps, "OAuth Bearer runtime", async () => {
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
        assert(claims.aud === baseUrl, "OAuth token audience must match requested resource.");
        const tokenList = await client.request("/api/oauth/tokens");
        assertStatus(tokenList, 200, "Issued token list");
        assert(JSON.stringify(tokenList.body).includes(claims.jti), "Issued token list must include created token jti.");
        const oauthList = await mockMcp(client, "/mcp/oauth", { jsonrpc: "2.0", id: 5, method: "tools/list" }, bearerHeader);
        assertStatus(oauthList, 200, "OAuth MCP tools/list");
        const toolNames = oauthList.body.result.tools.map((tool) => tool.name);
        assert(toolNames.includes(endpointName), "OAuth tools/list must include permitted endpoint.");
        assert(!toolNames.includes("echo"), "OAuth tools/list must filter non-permitted echo endpoint.");
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
        addDiagnostic(diagnostics, "jwt permissions", claims.endpoint_permissions.length);
        addDiagnostic(diagnostics, "oauth denied call", "403");
        addDiagnostic(diagnostics, "revoked token", "401 invalid_token");
        return { evidence: "OAuth client credentials, permission filtering, allowed/denied calls, token list, revocation, and revoked-token rejection work.", response: { missingBearer, userCreate, clientCreate: { ...clientCreate, body: { ...clientCreate.body, clientSecret: "<redacted>" } }, token: { ...token, body: { ...token.body, access_token: "<redacted>" } }, tokenList, oauthList, allowed, denied, revoke, revoked } };
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
        return { evidence: "Audit contains scenario activity and reset rejects invalid root credentials.", response: { audit, resetDenied } };
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
          return { evidence: "Root reset restored seeded defaults.", response: reset };
        });
      } else {
        steps.push(makeStep("Optional root reset", "skip", {
          evidence: "Destructive root reset is skipped unless explicitly enabled.",
        }));
      }
    }
  } finally {
    if (!includeReset) {
      if (cleanup.oauthClientId) await safeDelete(client, `/api/oauth-clients/${cleanup.oauthClientId}`);
      if (cleanup.oauthUserId) await safeDelete(client, `/api/oauth-users/${cleanup.oauthUserId}`);
      if (cleanup.basicUserId) await safeDelete(client, `/api/basic-users/${cleanup.basicUserId}`);
      if (cleanup.endpointId) await safeDelete(client, `/api/endpoints/${cleanup.endpointId}`, { deleteCode: DEFAULT_DELETE_CODE });
      addDiagnostic(diagnostics, "cleanup mode", "delete temporary records");
    } else {
      addDiagnostic(diagnostics, "cleanup mode", "root reset or best-effort cleanup");
    }
  }

  const failed = steps.filter((step) => step.status === "fail").length;
  return {
    ok: failed === 0,
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
  const targetUrl = String(input.mcpUrl ?? "").trim();
  if (!targetUrl) throw new Error("MCP endpoint URL is required.");
  const url = new URL(targetUrl);
  if (!["http:", "https:"].includes(url.protocol)) {
    throw new Error("MCP endpoint URL must be http or https.");
  }

  const protocolVersion = String(input.protocolVersion || DEFAULT_PROTOCOL_VERSION);
  const userHeaders = parseHeadersJson(input.headersJson);
  const baseHeaders = {
    "content-type": "application/json",
    accept: "application/json, text/event-stream",
    ...userHeaders,
  };
  const protocolHeaders = {
    ...baseHeaders,
    "MCP-Protocol-Version": protocolVersion,
  };
  const steps = [];
  const diagnostics = [];

  const initializePayload = {
    jsonrpc: "2.0",
    id: "inspector-initialize",
    method: "initialize",
    params: {
      protocolVersion,
      capabilities: {},
      clientInfo: { name: "standalone-local-inspector", version: "1.0.0" },
    },
  };
  const initialize = await fetchJson(targetUrl, initializePayload, baseHeaders);
  steps.push(makeStep("MCP initialize", initialize.ok ? "pass" : "fail", {
    request: { url: targetUrl, headers: redactHeaders(baseHeaders), body: initializePayload },
    response: initialize,
  }));
  diagnostics.push(["initialize status", initialize.status]);
  const negotiated = initialize.body?.result?.protocolVersion ?? initialize.headers["mcp-protocol-version"] ?? "not reported";
  diagnostics.push(["negotiated protocol", negotiated]);

  const listPayload = { jsonrpc: "2.0", id: "inspector-tools-list", method: "tools/list" };
  const list = await fetchJson(targetUrl, listPayload, protocolHeaders);
  const tools = Array.isArray(list.body?.result?.tools) ? list.body.result.tools : [];
  steps.push(makeStep("MCP tools/list", list.ok && Array.isArray(tools) ? "pass" : "fail", {
    request: { url: targetUrl, headers: redactHeaders(protocolHeaders), body: listPayload },
    response: list,
    evidence: `${tools.length} tools returned`,
  }));
  diagnostics.push(["tools returned", tools.length]);
  diagnostics.push(["response protocol header", list.headers["mcp-protocol-version"] ?? "not reported"]);

  const toolName = String(input.toolName ?? "").trim();
  if (toolName) {
    const args = parseToolArgs(input.toolArgsJson);
    const callPayload = {
      jsonrpc: "2.0",
      id: "inspector-tools-call",
      method: "tools/call",
      params: { name: toolName, arguments: args },
    };
    const call = await fetchJson(targetUrl, callPayload, protocolHeaders);
    const hasResultOrJsonRpcError = Boolean(call.body?.result || call.body?.error);
    steps.push(makeStep("MCP tools/call", call.ok && hasResultOrJsonRpcError ? "pass" : "fail", {
      request: { url: targetUrl, headers: redactHeaders(protocolHeaders), body: callPayload },
      response: call,
    }));
    diagnostics.push(["called tool", toolName]);
  } else {
    steps.push(makeStep("MCP tools/call", "skip", {
      evidence: "No tool name was provided.",
    }));
  }

  const badVersionPayload = { jsonrpc: "2.0", id: "inspector-bad-version", method: "tools/list" };
  const badVersion = await fetchJson(targetUrl, badVersionPayload, {
    ...baseHeaders,
    "MCP-Protocol-Version": "1900-01-01",
  });
  const badVersionStatus = badVersion.status >= 400 ? "pass" : "warn";
  steps.push(makeStep("Unsupported protocol-version probe", badVersionStatus, {
    request: {
      url: targetUrl,
      headers: redactHeaders({ ...baseHeaders, "MCP-Protocol-Version": "1900-01-01" }),
      body: badVersionPayload,
    },
    response: badVersion,
    evidence: badVersionStatus === "pass"
      ? "Target rejects an intentionally unsupported protocol version."
      : "Target accepted the unsupported probe; this may be allowed by that server, but strict mock targets should reject it.",
  }));
  diagnostics.push(["bad version probe", badVersion.status]);

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

function renderHtml() {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Standalone MCP Inspector</title>
  <style>
    :root {
      color-scheme: light;
      --bg: #f6f7f9;
      --fg: #171a1f;
      --muted: #5c6675;
      --line: #d9dee7;
      --panel: #fff;
      --accent: #0d766e;
      --danger: #b42318;
      --warn: #946200;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      background: var(--bg);
      color: var(--fg);
      font-family: Aptos, "Segoe UI", Helvetica, Arial, sans-serif;
    }
    main {
      width: min(1120px, calc(100% - 32px));
      margin: 0 auto;
      padding: 34px 0 48px;
    }
    header { margin-bottom: 22px; }
    .eyebrow {
      margin: 0 0 10px;
      color: var(--accent);
      font-size: .78rem;
      font-weight: 800;
      text-transform: uppercase;
    }
    h1 { margin: 0; font-size: 2.5rem; line-height: 1; }
    .lede { max-width: 760px; margin: 14px 0 0; color: var(--muted); line-height: 1.55; }
    .mode-grid { display: grid; gap: 18px; }
    .layout { display: grid; grid-template-columns: minmax(0, .8fr) minmax(0, 1.2fr); gap: 16px; align-items: start; }
    section, form {
      min-width: 0;
      border: 1px solid var(--line);
      border-radius: 8px;
      background: var(--panel);
      padding: 16px;
    }
    .mode-head { display: flex; gap: 12px; align-items: start; justify-content: space-between; margin-bottom: 12px; }
    .mode-head h2 { margin-bottom: 4px; }
    .mode-head p { margin: 0; color: var(--muted); line-height: 1.45; font-size: .88rem; }
    h2 { margin: 0 0 12px; font-size: 1.08rem; }
    label { display: grid; gap: 6px; margin-bottom: 12px; color: #26313f; font-weight: 800; font-size: .9rem; }
    input, textarea {
      width: 100%;
      min-height: 44px;
      border: 1px solid #cbd3df;
      border-radius: 8px;
      padding: 10px 11px;
      font: inherit;
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
    button:disabled { opacity: .55; cursor: not-allowed; }
    .hint { color: var(--muted); font-size: .84rem; line-height: 1.45; margin: -4px 0 12px; }
    .summary { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 8px; margin-bottom: 12px; }
    .summary div { border: 1px solid var(--line); border-radius: 8px; padding: 10px; background: #fbfcfe; }
    .summary span { display: block; color: var(--muted); font-size: .74rem; font-weight: 800; text-transform: uppercase; }
    .summary strong { display: block; margin-top: 4px; font-size: 1.25rem; }
    .step { border: 1px solid var(--line); border-radius: 8px; margin-top: 10px; padding: 12px; background: #fbfcfe; }
    .step-head { display: flex; gap: 10px; align-items: center; justify-content: space-between; }
    .step h3 { margin: 0; font-size: .98rem; }
    .pill { border-radius: 999px; padding: 5px 9px; font-size: .75rem; font-weight: 900; text-transform: uppercase; }
    .pass { background: #eefaf3; color: #136337; border: 1px solid #93d5ba; }
    .fail { background: #fff4f2; color: var(--danger); border: 1px solid #f3b6af; }
    .warn { background: #fff8e7; color: var(--warn); border: 1px solid #f0c36d; }
    .skip { background: #f5f7fa; color: #495466; border: 1px solid #d1d9e4; }
    pre {
      max-width: 100%;
      overflow: auto;
      white-space: pre-wrap;
      overflow-wrap: anywhere;
      border: 1px solid #d8e0ea;
      border-radius: 8px;
      margin: 10px 0 0;
      padding: 10px;
      background: #0f1720;
      color: #e8eef7;
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      font-size: .8rem;
      line-height: 1.5;
    }
    .diag { display: grid; gap: 8px; }
    .diag div { display: grid; grid-template-columns: 180px minmax(0, 1fr); gap: 10px; border: 1px solid #e4e9f0; border-radius: 8px; padding: 10px; background: #fbfcfe; }
    .diag span { color: var(--muted); font-weight: 800; font-size: .82rem; }
    .empty { color: var(--muted); line-height: 1.5; }
    .stack { display: grid; gap: 12px; }
    @media (max-width: 840px) {
      main { width: min(100% - 24px, 620px); padding-top: 24px; }
      .layout, .summary, .diag div { grid-template-columns: 1fr; }
      h1 { font-size: 2rem; }
      .mode-head { display: block; }
    }
  </style>
</head>
<body>
  <main>
    <header>
      <p class="eyebrow">Standalone local tool</p>
      <h1>MCP Inspector</h1>
      <p class="lede">Point this page at any MCP Streamable HTTP endpoint for a quick protocol check, or run the Mock Server scenario to verify REST, MCP, Basic Auth, OAuth Bearer, token revocation, audit evidence, and reset guards from one local UI.</p>
    </header>
    <div class="mode-grid">
      <div class="layout">
        <form id="mock-form">
          <div class="mode-head">
            <div>
              <h2>Mock Server scenario</h2>
              <p>Creates temporary records, verifies the main product flows, then cleans up mutable test data.</p>
            </div>
            <span class="pill warn">broad</span>
          </div>
          <label>
            Mock Server base URL
            <input name="baseUrl" value="${DEFAULT_MOCK_BASE_URL}" placeholder="http://127.0.0.1:3100" />
          </label>
          <label class="check-row">
            <input name="includeReset" type="checkbox" />
            Include destructive root reset
          </label>
          <label>
            Root password for optional reset
            <input name="rootPassword" type="password" placeholder="Only needed when reset is enabled" />
          </label>
          <p class="hint">Default run covers health, config, discovery, endpoint admin, REST, MCP, Basic, OAuth Bearer, token revocation, audit, reset denial, and cleanup. Root reset stays off unless you opt in.</p>
          <div class="actions">
            <button id="run-mock-button" type="submit">Run Mock Server scenario</button>
          </div>
        </form>
        <section>
          <h2>Scenario results</h2>
          <div id="mock-results" class="empty">No Mock Server scenario has run yet.</div>
        </section>
      </div>

      <div class="layout">
        <form id="inspect-form">
          <div class="mode-head">
            <div>
              <h2>Generic MCP target</h2>
              <p>Use this for any MCP HTTP server, including services that are not this Mock Server.</p>
            </div>
            <span class="pill pass">portable</span>
          </div>
          <label>
            MCP endpoint URL
            <input name="mcpUrl" value="http://127.0.0.1:3100/mcp/none" placeholder="http://127.0.0.1:3100/mcp/none" />
          </label>
          <label>
            Protocol version
            <input name="protocolVersion" value="${DEFAULT_PROTOCOL_VERSION}" />
          </label>
          <label>
            Extra headers JSON
            <textarea name="headersJson" placeholder='{"Authorization":"Bearer ..."}'></textarea>
          </label>
          <p class="hint">Use headers for Basic, Bearer, API keys, or custom local server requirements. Secrets are redacted in displayed request evidence.</p>
          <label>
            Optional tool name
            <input name="toolName" placeholder="echo" />
          </label>
          <label>
            Optional tool arguments JSON
            <textarea name="toolArgsJson" placeholder='{"message":"hello"}'>{}</textarea>
          </label>
          <button id="run-button" type="submit">Run generic inspection</button>
        </form>
        <section>
          <h2>Generic results</h2>
          <div id="results" class="empty">No generic inspection has run yet.</div>
        </section>
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

    function render(data) {
      const summary = data.summary ?? { pass: 0, warn: 0, skip: 0, fail: 0 };
      const diagnostics = (data.diagnostics ?? []).map((item) =>
        '<div><span>' + escapeHtml(item.check) + '</span><code>' + escapeHtml(item.value) + '</code></div>'
      ).join("");
      const steps = (data.steps ?? []).map((step) => {
        const evidence = step.evidence ? '<p class="hint">' + escapeHtml(step.evidence) + '</p>' : "";
        const request = step.request ? '<pre aria-label="' + escapeHtml(step.name) + ' request">' + pretty(step.request) + '</pre>' : "";
        const response = step.response ? '<pre aria-label="' + escapeHtml(step.name) + ' response">' + pretty(step.response) + '</pre>' : "";
        return '<article class="step"><div class="step-head"><h3>' + escapeHtml(step.name) + '</h3><span class="pill ' + escapeHtml(step.status) + '">' + escapeHtml(step.status) + '</span></div>' + evidence + request + response + '</article>';
      }).join("");
      return '<div class="summary"><div><span>Pass</span><strong>' + summary.pass + '</strong></div><div><span>Warn</span><strong>' + summary.warn + '</strong></div><div><span>Skip</span><strong>' + summary.skip + '</strong></div><div><span>Fail</span><strong>' + summary.fail + '</strong></div></div><h2>Diagnostics</h2><div class="diag">' + diagnostics + '</div><div class="stack">' + steps + '</div>';
    }

    function renderInto(container, data) {
      container.className = "";
      container.innerHTML = render(data);
    }

    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      button.disabled = true;
      results.className = "empty";
      results.textContent = "Running inspection.";
      try {
        const payload = Object.fromEntries(new FormData(form).entries());
        const response = await fetch("/api/inspect", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(payload),
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.message || "Inspection failed.");
        renderInto(results, data);
      } catch (error) {
        results.className = "empty";
        results.innerHTML = '<span class="pill fail">fail</span><pre>' + escapeHtml(error.message || String(error)) + '</pre>';
      } finally {
        button.disabled = false;
      }
    });

    mockForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      mockButton.disabled = true;
      mockResults.className = "empty";
      mockResults.textContent = "Running Mock Server scenario.";
      try {
        const payload = Object.fromEntries(new FormData(mockForm).entries());
        payload.includeReset = mockForm.elements.includeReset.checked;
        const response = await fetch("/api/mock-scenario", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(payload),
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.message || "Scenario failed.");
        renderInto(mockResults, data);
      } catch (error) {
        mockResults.className = "empty";
        mockResults.innerHTML = '<span class="pill fail">fail</span><pre>' + escapeHtml(error.message || String(error)) + '</pre>';
      } finally {
        mockButton.disabled = false;
      }
    });
  </script>
</body>
</html>`;
}

function createInspectorServer() {
  return createServer(async (request, response) => {
    try {
      const url = new URL(request.url ?? "/", "http://local.inspector");
      if (request.method === "GET" && url.pathname === "/") {
        htmlResponse(response, renderHtml());
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
    console.log("Open the URL in your browser, enter any MCP endpoint URL, then run inspection.");
  });
} catch (error) {
  console.error(`Inspector UI failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
}

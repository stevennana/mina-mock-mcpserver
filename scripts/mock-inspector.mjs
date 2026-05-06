#!/usr/bin/env node

import { Buffer } from "node:buffer";
import { URLSearchParams } from "node:url";

const DEFAULT_BASE_URL = process.env.MCP_MOCK_BASE_URL ?? "http://127.0.0.1:3100";
const DEFAULT_DELETE_CODE = "87654321";

function parseArgs(argv) {
  const options = {
    baseUrl: DEFAULT_BASE_URL,
    includeReset: false,
    rootPassword: process.env.ROOT_PASSWORD ?? "",
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
`);
}

function logStep(message) {
  console.log(`\n== ${message}`);
}

function pass(message) {
  console.log(`OK ${message}`);
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

class Client {
  constructor(baseUrl) {
    this.baseUrl = baseUrl;
  }

  url(path) {
    return `${this.baseUrl}${path}`;
  }

  async request(path, options = {}) {
    const response = await fetch(this.url(path), options);
    const contentType = response.headers.get("content-type") ?? "";
    const text = await response.text();
    const body = contentType.includes("application/json") && text ? JSON.parse(text) : text;
    return { response, body };
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
  const client = new Client(options.baseUrl);
  const stamp = Date.now();
  const endpointName = `inspector_${stamp}`;
  const basicUsername = `inspector_basic_${stamp}`;
  const basicPassword = "inspector-basic-secret";
  const oauthUsername = `inspector_oauth_${stamp}`;
  const oauthPassword = "inspector-oauth-secret";
  const clientId = `inspector-client-${stamp}`;
  const cleanup = {
    endpointId: "",
    basicUserId: "",
    oauthUserId: "",
    oauthClientId: "",
    revokedTokenJti: "",
  };

  try {
    logStep("Health and operator config");
    const health = await client.request("/api/health");
    assertStatus(health, 200, "Health");
    assert(health.body.status === "ok", "Health status must be ok.");
    pass("health reports ok");

    const config = await client.request("/api/config");
    assertStatus(config, 200, "Operator config");
    assert(isRecord(config.body.routes?.mcp), "Operator config must expose MCP routes.");
    pass("operator config exposes route map");

    const discovery = await client.request("/.well-known/oauth-authorization-server");
    assertStatus(discovery, 200, "OAuth authorization metadata");
    const jwks = await client.request("/oauth/jwks");
    assertStatus(jwks, 200, "OAuth JWKS");
    assert(Array.isArray(jwks.body.keys), "JWKS must contain keys.");
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
    pass("MCP tools/list and tools/call work");

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

    const tokenList = await client.request("/api/oauth/tokens");
    assertStatus(tokenList, 200, "Issued token list");
    assert(JSON.stringify(tokenList.body).includes(claims.jti), "Issued token list must include created token jti.");

    const oauthMcpList = await mcp(client, "/mcp/oauth", { jsonrpc: "2.0", id: 5, method: "tools/list" }, bearerHeader);
    assertStatus(oauthMcpList, 200, "OAuth MCP tools/list");
    const oauthToolNames = oauthMcpList.body.result.tools.map((tool) => tool.name);
    assert(oauthToolNames.includes(endpointName), "OAuth MCP tools/list must include permitted endpoint.");
    assert(!oauthToolNames.includes("echo"), "OAuth MCP tools/list must filter non-permitted echo endpoint.");

    const oauthRestAllowed = await client.json(
      "POST",
      `/rest/tools/${endpointName}/call`,
      { arguments: { city: "Seoul" } },
      bearerHeader,
    );
    assertStatus(oauthRestAllowed, 201, "OAuth REST allowed call");

    const oauthRestDenied = await client.json("POST", "/rest/tools/echo/call", { arguments: { message: "hello" } }, bearerHeader);
    assertStatus(oauthRestDenied, 403, "OAuth REST denied call");

    const revoke = await client.request(`/api/oauth/tokens/${claims.jti}/revoke`, { method: "POST" });
    assertStatus(revoke, 200, "Token revocation");
    const revokedCall = await client.request("/rest/tools", { headers: bearerHeader });
    assertStatus(revokedCall, 401, "Revoked token rejection");
    pass("OAuth user/client/token, permission filtering, denial, and revocation work");

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

    console.log("\nInspector completed successfully.");
  } finally {
    if (!options.includeReset) {
      if (cleanup.oauthClientId) await safeDelete(client, "OAuth client", `/api/oauth-clients/${cleanup.oauthClientId}`);
      if (cleanup.oauthUserId) await safeDelete(client, "OAuth user", `/api/oauth-users/${cleanup.oauthUserId}`);
      if (cleanup.basicUserId) await safeDelete(client, "Basic user", `/api/basic-users/${cleanup.basicUserId}`);
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

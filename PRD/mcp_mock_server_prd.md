# Product Requirements Document
## Remote MCP Mock Server with Public Web UI, Multi-Auth Testing, OAuth Permission Selection

**Document version:** 1.0  
**Date:** 2026-05-05  
**Primary language:** English  
**Owner:** AI Solution Architecture  
**Target stack:** Node.js, TypeScript, Next.js SPA, separate API server, SQLite  
**Deployment target:** Docker and direct execution behind Nginx reverse proxy

---

## 1. Product Summary

The product is a **publicly accessible Remote MCP Mock Server** designed to help developers and AI-agent teams test whether MCP clients can correctly connect to and invoke tools using three authentication modes:

1. **No authentication**
2. **HTTP Basic authentication**
3. **Mock OAuth2/OAuth 2.1-style authentication with JWT access tokens**

The server must behave like a real remote MCP server as much as practical for a mock product. It must support **JSON-RPC MCP flows**, especially `initialize`, `tools/list`, and `tools/call`, and it must also expose a **REST-style mock API** for the same tools.

The product includes a **public Web UI** where anyone can create, edit, test, and delete mock MCP endpoints/tools. Because the UI is intentionally public, destructive operations must be lightly protected using an **8-digit endpoint delete code**, while global recovery/reset operations are protected by a **root password configured through an environment variable**.

The product is not intended to be a secure production authorization service. It is a realistic, configurable, public mock server for testing MCP client behavior, authentication handling, token handling, endpoint-level OAuth permissions, and failure scenarios.

---

## 2. Standards and Reference Alignment

The implementation should align with the latest MCP specification available during this PRD creation, which lists **version `2025-11-25` as latest**. MCP uses JSON-RPC messages as its base protocol, and all client/server messages must follow JSON-RPC 2.0 semantics. ([modelcontextprotocol.io](https://modelcontextprotocol.io/specification/2025-11-25/changelog))

For remote operation, the product should implement MCP **Streamable HTTP**. The MCP transport specification defines Streamable HTTP as an independent-process transport using HTTP `POST` and `GET`, with a single MCP endpoint such as `/mcp`. The same specification also requires Origin validation for Streamable HTTP to mitigate DNS rebinding risks. ([modelcontextprotocol.io](https://modelcontextprotocol.io/specification/2025-11-25/basic/transports))

The MCP tool layer should implement tool discovery and invocation through `tools/list` and `tools/call`. MCP tools have a unique `name`, a human-readable `description`, and an `inputSchema`; clients call tools by sending a `tools/call` request with a tool name and arguments. ([modelcontextprotocol.io](https://modelcontextprotocol.io/specification/2025-11-25/server/tools))

The OAuth design should be inspired by the Atlassian Rovo MCP Server pattern: the MCP client initiates an OAuth flow, the user completes an interactive browser-based consent flow, the client receives an access token, and subsequent MCP requests include `Authorization: Bearer <access_token>`. Atlassian also documents Basic-style API token authentication as a non-interactive alternative, which maps well to this mock server’s Basic Auth test mode. ([support.atlassian.com](https://support.atlassian.com/atlassian-rovo-mcp-server/docs/authentication-and-authorization/))

For MCP authorization, the product should expose OAuth-style discovery metadata where feasible. The MCP authorization specification describes MCP servers as OAuth resource servers, recommends authorization-server discovery, and requires bearer tokens to be sent in the `Authorization` header for protected requests. It also defines `401 Unauthorized` for missing or invalid authorization and `403 Forbidden` for insufficient permissions/scopes. ([modelcontextprotocol.io](https://modelcontextprotocol.io/specification/2025-11-25/basic/authorization))

---

## 3. Goals

### 3.1 Primary Goals

The product must allow developers to:

1. Run an independent remote MCP mock server.
2. Create and manage MCP tools/endpoints through a simple public Web UI.
3. Define up to **three parameters per tool**.
4. Define exact-match mock responses based on parameter values.
5. Access the same mock tools through both:
   - MCP JSON-RPC `tools/list` and `tools/call`
   - REST-style HTTP endpoints
6. Test MCP client behavior with:
   - no authentication
   - HTTP Basic authentication
   - OAuth-style JWT bearer authentication
7. Use a mock OAuth login and consent flow without relying on an external OAuth service.
8. Select endpoint-level permissions during OAuth consent.
9. Ensure OAuth-issued tokens can only call the endpoints selected during consent.
10. Manage issued OAuth tokens through the Web UI, including viewing token claims/permissions and revoking tokens.
11. Simulate failure scenarios such as invalid tokens, expired tokens, permission denial, forced server errors, artificial delays, and malformed responses.
12. Persist all configuration and mock data in SQLite across server restarts.
13. Support deployment behind Nginx with TLS termination at the proxy.

---

## 4. Non-Goals

The product does **not** aim to:

1. Provide real production-grade identity management.
2. Integrate with external OAuth providers.
3. Provide true multi-tenant isolation in MVP.
4. Protect the public admin UI with enterprise-grade RBAC.
5. Store or process sensitive customer data.
6. Provide a full MCP implementation for resources, prompts, sampling, elicitation, or task-augmented execution in MVP.
7. Guarantee complete compatibility with every MCP client implementation.
8. Replace a real authorization server.

---

## 5. Target Users

### 5.1 MCP Client Developer

A developer building or testing an MCP client who needs to validate:

- remote MCP server connection
- tool listing
- tool calling
- auth header behavior
- bearer token handling
- expired token handling
- permission-denied handling

### 5.2 AI Agent Developer

An AI agent developer who wants to test how the agent behaves when tools are exposed through MCP and different auth modes.

### 5.3 Demo or QA User

A public user who wants to quickly create a mock endpoint and test it from a browser, curl, Postman, an MCP-compatible IDE, or an agent runtime.

### 5.4 Server Operator

The person running the public mock service. This user needs:

- root reset
- recovery from corrupted public configuration
- environment-based server configuration
- reverse proxy compatibility
- SQLite persistence

---

## 6. Core Product Concepts

### 6.1 Mock Endpoint / MCP Tool

A **mock endpoint** is the product’s internal object. It is exposed externally as:

1. an MCP tool through `tools/list` and `tools/call`
2. a REST callable endpoint

Each mock endpoint has:

- tool name
- optional display title
- description
- up to three parameters
- exact-match response cases
- optional default response
- optional artificial delay
- optional forced error behavior
- optional malformed response behavior
- delete protection code

### 6.2 Authentication Mode

The server supports three request authentication behaviors:

1. **None**
   - No `Authorization` header required.
   - All enabled endpoints are visible and callable.

2. **Basic**
   - Uses `Authorization: Basic <base64(username:password)>`.
   - If valid, all enabled endpoints are visible and callable.
   - Built-in `default/default` user must always work and cannot be deleted.

3. **OAuth Bearer**
   - Uses `Authorization: Bearer <jwt_access_token>`.
   - Token is issued by the mock OAuth flow.
   - Token carries selected endpoint permissions.
   - Only endpoints included in the token permission set are visible/callable.
   - Built-in OAuth user `default/default` must always work and cannot be deleted.
   - Built-in OAuth client `default/default` must always work and cannot be deleted.

### 6.3 Unified and Strict MCP Routes

To make testing easier, the server should expose both a unified route and strict test aliases.

| Route | Behavior |
|---|---|
| `/mcp` | Accepts None, Basic, or OAuth. Auth method is inferred from request headers. |
| `/mcp/none` | Requires no auth. Useful for explicit no-auth tests. |
| `/mcp/basic` | Requires valid Basic Auth. Missing/invalid Basic Auth returns `401`. |
| `/mcp/oauth` | Requires valid Bearer token. Missing/invalid token returns `401`; insufficient endpoint permission returns `403`. |

This avoids ambiguity during tests. For example, an MCP client that claims to be testing OAuth can be pointed to `/mcp/oauth`, while a client testing no-auth can be pointed to `/mcp/none`.

---

## 7. Product Architecture

### 7.1 Logical Architecture

```text
Browser / Public User
        |
        v
Next.js Web UI / Frontend Gateway
        |
        | /api/*
        | /mcp*
        | /oauth/*
        | /rest/*
        v
Node.js TypeScript API Server
        |
        v
SQLite Database
```

### 7.2 Deployment Architecture

```text
Internet
  |
  v
Nginx reverse proxy with HTTPS/TLS
  |
  v
http://localhost:3000
  |
  v
Next.js frontend gateway
  |
  v
API server, internal port 3001
  |
  v
SQLite volume/file
```

The default Docker deployment should expose only port `3000`. The Next.js gateway should serve the SPA and proxy backend requests to the API server.

### 7.3 Recommended Monorepo Structure

```text
mcp-mock-server/
  apps/
    web/                 # Next.js SPA
    api/                 # Node.js TypeScript API server
  packages/
    shared/              # shared schemas, types, validation
  prisma/ or db/
    migrations/
    seed.ts
  docker/
    nginx.example.conf
  docker-compose.yml
  package.json
  README.md
```

### 7.4 Recommended Backend Framework

Preferred backend options:

1. **Fastify + TypeScript**
   - lightweight
   - strong performance
   - good plugin ecosystem
   - easy raw HTTP control for MCP and OAuth responses

2. **NestJS**
   - stronger structure
   - useful if the codebase will grow

For MVP, **Fastify + TypeScript** is recommended.

### 7.5 Recommended Database Layer

Use one of:

- Prisma with SQLite
- Drizzle ORM with SQLite
- better-sqlite3 with explicit migrations

For fast delivery and clear schema migration, **Prisma + SQLite** is recommended.

---

## 8. Functional Requirements

## 8.1 Endpoint / Tool Management

### FR-ENDPOINT-001: Create Mock Endpoint

The Web UI must allow any public user to create a mock endpoint.

Required fields:

| Field | Required | Description |
|---|---:|---|
| `name` | yes | Unique MCP tool name. |
| `title` | no | Human-readable display name. |
| `description` | yes | Description shown in MCP `tools/list`. |
| `parameters` | no | Up to three parameters. |
| `responseCases` | yes | At least one response case or default response. |
| `deleteCode` | yes | 8-digit numeric code required to delete this endpoint. |
| `enabled` | yes | Whether the endpoint is exposed to clients. |

Validation:

- `name` must be unique.
- `name` should match `^[a-zA-Z0-9_-]{1,64}$`.
- Parameter count must be between 0 and 3.
- Parameter names must be unique within the endpoint.
- Delete code must be exactly 8 digits.
- Return JSON must be valid JSON unless intentionally configured as a malformed response test.

### FR-ENDPOINT-002: Edit Mock Endpoint

The Web UI must allow any public user to edit an endpoint.

Editable fields:

- title
- description
- enabled status
- parameters
- response cases
- artificial delay
- error simulation settings
- default no-match behavior

The endpoint `name` should be editable only if no issued OAuth token currently references the endpoint by name. To avoid permission drift, the system should internally use immutable endpoint IDs and expose names separately.

### FR-ENDPOINT-003: Delete Mock Endpoint

Deleting an endpoint must require one of:

1. the endpoint’s 8-digit delete code
2. the root password from environment variable

If deletion succeeds:

- endpoint is removed from `tools/list`
- OAuth client allowed-endpoint mappings are cleaned up
- issued tokens referencing the endpoint remain historically viewable, but calls using those tokens must fail with `403` or tool-not-found depending on route behavior

### FR-ENDPOINT-004: Reset to Default

The Web UI must include a **Reset to Default** button.

Rules:

- Requires root password.
- Removes all user-created endpoints, users, clients, tokens, and response cases.
- Recreates seed defaults.
- Must not break built-in `default/default` Basic user.
- Must not break built-in `default/default` OAuth user.
- Must not break built-in `default/default` OAuth client.

### FR-ENDPOINT-005: Exact-Match Response Cases

Each endpoint may define multiple response cases.

Each response case contains:

| Field | Description |
|---|---|
| `caseName` | Human-readable case label. |
| `matchJson` | JSON object containing exact parameter values. |
| `responseJson` | JSON object/array/string/number/boolean/null returned when matched. |
| `priority` | Lower number wins if multiple cases match. |
| `isDefault` | Whether this case is used when no exact match exists. |
| `delayMs` | Optional artificial delay. |
| `errorMode` | Optional forced error behavior. |

Exact matching rules:

1. The incoming arguments object is normalized by parameter type.
2. A response case matches only when every defined endpoint parameter has an exact value match in `matchJson`.
3. Extra client arguments are ignored by default in MVP, but this should be configurable.
4. If more than one case matches, the lowest `priority` wins.
5. If no case matches:
   - use the default case if configured
   - otherwise return a tool execution error for MCP
   - otherwise return `404` or `422` for REST depending on configured no-match behavior

### FR-ENDPOINT-006: Parameter Types

MVP must support these parameter types:

| Type | Exact Match Behavior |
|---|---|
| `string` | Exact string match. Case-sensitive by default. |
| `number` | Numeric equality after JSON number parsing. |
| `boolean` | Boolean equality. |

Future architecture must allow extension to:

- enum
- object
- array
- date
- regex
- partial match
- custom JavaScript matcher

### FR-ENDPOINT-007: MCP Tool Schema Generation

For each endpoint, the backend must generate an MCP `inputSchema`.

Example:

```json
{
  "type": "object",
  "properties": {
    "city": {
      "type": "string",
      "description": "City name"
    },
    "unit": {
      "type": "string",
      "description": "Temperature unit"
    }
  },
  "required": ["city", "unit"],
  "additionalProperties": true
}
```

MVP should make all defined parameters required by default, with an optional future setting for required/optional parameters.

---

## 8.2 Authentication Requirements

### FR-AUTH-001: No-Auth Mode

When a client calls `/mcp`, `/mcp/none`, or REST no-auth routes without an `Authorization` header:

- request is accepted
- principal is set to `anonymous`
- all enabled endpoints are visible
- all enabled endpoints are callable

### FR-AUTH-002: Basic Auth Mode

The server must support HTTP Basic Auth.

Header format:

```text
Authorization: Basic base64(username:password)
```

Rules:

- `default/default` must always work.
- `default/default` cannot be deleted.
- `default/default` password cannot be changed.
- Additional Basic Auth users can be created, edited, disabled, and deleted from the Web UI.
- Passwords must be stored as hashes.
- If an invalid Basic header is sent, the server must return `401`.
- Successful Basic Auth gives access to all enabled endpoints.

### FR-AUTH-003: OAuth Bearer Mode

The server must support mock OAuth-style bearer authentication.

Header format:

```text
Authorization: Bearer <jwt_access_token>
```

Rules:

- Access token must be a JWT.
- JWT must be signed by the mock server.
- Token must include expiration.
- Token must include selected endpoint permissions.
- Token must include issuer and audience/resource claims.
- Token must be rejected if expired.
- Token must be rejected if revoked.
- Token must be rejected if signature validation fails.
- OAuth token permissions apply only to OAuth Bearer mode.
- OAuth token permissions do not apply to None or Basic mode.

### FR-AUTH-004: Auth Header Precedence

For `/mcp` unified route:

1. If no `Authorization` header exists, use None mode.
2. If `Authorization` starts with `Basic`, validate Basic.
3. If `Authorization` starts with `Bearer`, validate OAuth token.
4. If `Authorization` uses an unsupported scheme, return `401`.
5. Do not silently downgrade invalid Basic or Bearer requests to None mode.

### FR-AUTH-005: Strict Auth Routes

For `/mcp/basic`:

- missing Basic Auth returns `401`
- invalid Basic Auth returns `401`
- valid Basic Auth gives access to all enabled endpoints

For `/mcp/oauth`:

- missing Bearer token returns `401`
- invalid/expired/revoked Bearer token returns `401`
- valid Bearer token gives access only to selected endpoints
- valid token without endpoint permission returns `403`

---

## 8.3 OAuth Mock Requirements

### FR-OAUTH-001: Built-in OAuth User

The server must always include:

```text
username: default
password: default
```

Rules:

- cannot be deleted
- cannot be disabled
- password cannot be changed
- token TTL can be edited if desired

### FR-OAUTH-002: OAuth User Management

The Web UI must allow public users to manage OAuth login users.

Fields:

| Field | Description |
|---|---|
| `username` | Unique login name. |
| `password` | Stored as hash. |
| `tokenTtlSeconds` | Access token lifetime for this user. |
| `enabled` | Whether login is allowed. |
| `isBuiltin` | Whether the row is protected. |

### FR-OAUTH-003: Built-in OAuth Client

The server must always include:

```text
client_id: default
client_secret: default
```

Rules:

- cannot be deleted
- cannot be disabled
- client secret cannot be changed unless explicitly allowed by root-only maintenance mode
- must be valid for authorization code flow and client credentials flow
- must allow all endpoints by default

### FR-OAUTH-004: OAuth Client Management

The Web UI must allow public users to create and manage OAuth clients.

Fields:

| Field | Required | Description |
|---|---:|---|
| `client_id` | yes | User-entered unique client ID. Not auto-generated. |
| `client_secret` | yes | Auto-generated by default, editable/regenerable. |
| `display_name` | no | Shown on consent screen. |
| `redirect_uris` | yes | List of allowed redirect URIs. |
| `allowed_endpoint_ids` | yes | Maximum endpoints this client may request. |
| `enabled` | yes | Whether the client can request tokens. |
| `clientCredentialsTtlSeconds` | yes | TTL for client credentials tokens. |

New client creation behavior:

- User enters `client_id`.
- Server generates random `client_secret`.
- Server generates a default random local test redirect URI.
- Server defaults allowed endpoints to all currently enabled endpoints.
- User can edit generated fields later.

### FR-OAUTH-005: Authorization Code Flow

The product must support a simplified authorization code flow.

Flow:

```text
MCP client
  -> GET /oauth/authorize
  -> Mock OAuth login UI
  -> User enters username/password
  -> Consent screen shows endpoint list
  -> User selects allowed endpoints
  -> Server redirects to redirect_uri with code and state
  -> Client exchanges code at /oauth/token
  -> Server returns JWT access token
  -> Client calls /mcp/oauth with Bearer token
```

Authorization request parameters:

| Parameter | Required | Description |
|---|---:|---|
| `response_type` | yes | Must be `code`. |
| `client_id` | yes | Registered OAuth client ID. |
| `redirect_uri` | yes | Must match registered redirect URI. |
| `state` | recommended | Returned unchanged. |
| `scope` | optional | Endpoint scope string or special value. |
| `resource` | optional | MCP resource/audience URI. |
| `code_challenge` | optional | PKCE support can be Phase 2. |
| `code_challenge_method` | optional | PKCE support can be Phase 2. |

Authorization code properties:

- single use
- short lifetime, default 5 minutes
- bound to client ID
- bound to redirect URI
- stores selected endpoint IDs
- stores user ID
- stores requested resource/audience

### FR-OAUTH-006: Consent Screen

After login, the server must show a consent screen.

The consent screen must display:

- client display name
- client ID
- redirect URI
- logged-in user
- token TTL
- list of selectable endpoints
- endpoint descriptions
- “Select all” and “Deselect all”
- Submit / Cancel buttons

Endpoint selection rules:

- User may select any endpoint allowed by the OAuth client.
- If an endpoint is disabled, it should be hidden or marked unavailable.
- Selected endpoints are stored in the authorization code and later in the access token.
- If no endpoint is selected, token issuance is allowed only if the user confirms an empty-permission token.

### FR-OAUTH-007: Token Endpoint

The server must expose:

```text
POST /oauth/token
```

Supported grants:

1. `authorization_code`
2. `client_credentials`

Authorization code request:

```json
{
  "grant_type": "authorization_code",
  "code": "AUTH_CODE",
  "redirect_uri": "https://client.example/callback",
  "client_id": "default",
  "client_secret": "default"
}
```

Client credentials request:

```json
{
  "grant_type": "client_credentials",
  "client_id": "default",
  "client_secret": "default",
  "scope": "endpoint:get_weather endpoint:get_ticket"
}
```

Token response:

```json
{
  "access_token": "eyJhbGciOiJSUzI1NiIsImtpZCI6...",
  "token_type": "Bearer",
  "expires_in": 3600,
  "scope": "endpoint:get_weather endpoint:get_ticket"
}
```

Refresh tokens are not required.

### FR-OAUTH-008: Client Credentials Flow

The server must support a simplified client credentials flow for non-interactive tests.

Rules:

- Requires valid `client_id` and `client_secret`.
- No user login.
- Subject claim should be `client:<client_id>`.
- Granted endpoints are:
  - requested endpoint scopes intersected with the client’s allowed endpoints, or
  - all client-allowed endpoints if no scope is requested
- Token TTL comes from the OAuth client’s `clientCredentialsTtlSeconds`.

### FR-OAUTH-009: JWT Access Token

JWT signing should use RS256 in MVP if practical. HS256 may be allowed only as a fallback for simpler local development.

Recommended JWT claims:

```json
{
  "iss": "https://mock.example.com",
  "aud": "https://mock.example.com/mcp",
  "sub": "user:default",
  "client_id": "default",
  "realm": "default",
  "grant_type": "authorization_code",
  "iat": 1770000000,
  "exp": 1770003600,
  "jti": "uuid",
  "scope": "endpoint:get_weather endpoint:get_ticket",
  "endpoint_permissions": [
    {
      "id": "endpoint_uuid",
      "name": "get_weather"
    }
  ]
}
```

Validation rules:

- verify signature
- verify issuer
- verify audience/resource
- verify expiration
- verify token is not revoked
- verify endpoint permission for OAuth calls

### FR-OAUTH-010: OAuth Discovery Metadata

The server should expose mock OAuth discovery endpoints:

```text
GET /.well-known/oauth-protected-resource
GET /.well-known/oauth-authorization-server
GET /.well-known/openid-configuration
GET /oauth/jwks
```

Protected resource metadata should advertise:

- resource identifier
- authorization server URL
- supported authorization methods

Authorization server metadata should advertise:

- authorization endpoint
- token endpoint
- JWKS endpoint
- supported grant types
- supported response types
- supported token endpoint auth methods
- supported scopes

### FR-OAUTH-011: Token Management UI

The Web UI must include an issued token management screen.

Capabilities:

- list issued tokens
- filter by user, client, grant type, revoked status, expiration status
- view token metadata and claims
- view selected endpoint permissions
- revoke token
- delete historical token record with root password, optional
- show token value only at issuance time unless explicitly configured to store raw tokens

### FR-OAUTH-012: Token Revocation

The UI must support token revocation.

Implementation:

- Store every issued JWT `jti` in `issued_tokens`.
- On revoke, set `revoked_at`.
- On every OAuth request, validate that the token `jti` is not revoked.
- Revoked tokens return `401`.

Optional API:

```text
POST /oauth/revoke
```

---

## 8.4 MCP Protocol Requirements

### FR-MCP-001: Streamable HTTP Endpoint

The API server must expose:

```text
POST /mcp
GET /mcp
DELETE /mcp
```

And auth-specific aliases:

```text
POST /mcp/none
POST /mcp/basic
POST /mcp/oauth
```

MVP behavior:

- `POST` handles JSON-RPC requests.
- `GET` may return `405 Method Not Allowed` if SSE streaming is not implemented.
- `DELETE` may return `405 Method Not Allowed` unless session management is enabled.
- Server should support `application/json` responses.
- SSE streaming may be Phase 2.

### FR-MCP-002: Initialize

The server must support:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "initialize",
  "params": {
    "protocolVersion": "2025-11-25",
    "capabilities": {},
    "clientInfo": {
      "name": "example-client",
      "version": "1.0.0"
    }
  }
}
```

Response:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "protocolVersion": "2025-11-25",
    "capabilities": {
      "tools": {
        "listChanged": true
      }
    },
    "serverInfo": {
      "name": "mcp-mock-server",
      "title": "MCP Mock Server",
      "version": "1.0.0",
      "description": "Public mock MCP server for testing auth and tool calls"
    },
    "instructions": "Use tools/list to discover mock tools and tools/call to invoke them."
  }
}
```

### FR-MCP-003: Initialized Notification

The server must accept:

```json
{
  "jsonrpc": "2.0",
  "method": "notifications/initialized"
}
```

Because this is a notification:

- no JSON-RPC response is returned
- HTTP response should be `202 Accepted` with no body

### FR-MCP-004: Tool Listing

The server must support:

```json
{
  "jsonrpc": "2.0",
  "id": 2,
  "method": "tools/list",
  "params": {}
}
```

No-auth and Basic response:

- return all enabled endpoints

OAuth response:

- return only endpoints included in the token permission set

Example response:

```json
{
  "jsonrpc": "2.0",
  "id": 2,
  "result": {
    "tools": [
      {
        "name": "get_weather",
        "title": "Get Weather",
        "description": "Returns mock weather data",
        "inputSchema": {
          "type": "object",
          "properties": {
            "city": {
              "type": "string",
              "description": "City name"
            }
          },
          "required": ["city"],
          "additionalProperties": true
        }
      }
    ]
  }
}
```

### FR-MCP-005: Tool Calling

The server must support:

```json
{
  "jsonrpc": "2.0",
  "id": 3,
  "method": "tools/call",
  "params": {
    "name": "get_weather",
    "arguments": {
      "city": "Seoul"
    }
  }
}
```

Successful MCP response:

```json
{
  "jsonrpc": "2.0",
  "id": 3,
  "result": {
    "content": [
      {
        "type": "text",
        "text": "{\"city\":\"Seoul\",\"temperature\":22,\"condition\":\"Sunny\"}"
      }
    ],
    "structuredContent": {
      "city": "Seoul",
      "temperature": 22,
      "condition": "Sunny"
    },
    "isError": false
  }
}
```

If the mock return value is not an object, `structuredContent` may be omitted.

### FR-MCP-006: Unknown Method

Unsupported JSON-RPC method:

```json
{
  "jsonrpc": "2.0",
  "id": 99,
  "error": {
    "code": -32601,
    "message": "Method not found"
  }
}
```

### FR-MCP-007: Unknown Tool

Calling an unknown tool should return either:

```json
{
  "jsonrpc": "2.0",
  "id": 3,
  "error": {
    "code": -32602,
    "message": "Unknown tool: get_unknown"
  }
}
```

or a tool execution error depending on implementation preference. MVP should use JSON-RPC `-32602` for unknown tool names because the `tools/call` parameters are invalid.

### FR-MCP-008: OAuth Permission Denial

If a valid OAuth token calls a tool not included in its endpoint permission set:

HTTP status:

```text
403 Forbidden
```

Response:

```json
{
  "jsonrpc": "2.0",
  "id": 3,
  "error": {
    "code": -32003,
    "message": "Forbidden: token does not allow endpoint get_weather",
    "data": {
      "required_endpoint": "get_weather"
    }
  }
}
```

### FR-MCP-009: Invalid or Expired OAuth Token

If token is missing, invalid, expired, or revoked on `/mcp/oauth`:

HTTP status:

```text
401 Unauthorized
```

Headers should include:

```text
WWW-Authenticate: Bearer error="invalid_token"
```

Response:

```json
{
  "jsonrpc": "2.0",
  "id": null,
  "error": {
    "code": -32001,
    "message": "Unauthorized: invalid or expired token"
  }
}
```

### FR-MCP-010: List Changed Notification

When endpoints are created, updated, deleted, enabled, or disabled, the server should support the capability to emit:

```json
{
  "jsonrpc": "2.0",
  "method": "notifications/tools/list_changed"
}
```

MVP does not need real-time server-to-client push unless SSE is implemented. The `tools.listChanged` capability may still be set to `true` if SSE is planned; otherwise set it to `false` in MVP and enable it in Phase 2.

---

## 8.5 REST Mock API Requirements

### FR-REST-001: List Tools

```text
GET /rest/tools
```

Auth behavior:

- None: all enabled endpoints
- Basic: all enabled endpoints
- OAuth: only permitted endpoints

Response:

```json
{
  "tools": [
    {
      "id": "endpoint_uuid",
      "name": "get_weather",
      "title": "Get Weather",
      "description": "Returns mock weather data",
      "parameters": [
        {
          "name": "city",
          "type": "string",
          "description": "City name"
        }
      ]
    }
  ]
}
```

### FR-REST-002: Call Tool

```text
POST /rest/tools/:name/call
```

Request:

```json
{
  "arguments": {
    "city": "Seoul"
  }
}
```

Successful response:

```json
{
  "city": "Seoul",
  "temperature": 22,
  "condition": "Sunny"
}
```

### FR-REST-003: REST Error Responses

Invalid auth:

```json
{
  "error": "unauthorized",
  "message": "Invalid credentials"
}
```

Permission denied:

```json
{
  "error": "forbidden",
  "message": "Token does not allow this endpoint"
}
```

No matching response case:

```json
{
  "error": "no_match",
  "message": "No exact match response case found"
}
```

Forced mock error:

```json
{
  "error": "mock_error",
  "message": "Configured mock error"
}
```

---

## 8.6 Failure Simulation Requirements

### FR-FAIL-001: Artificial Delay

Each endpoint and each response case may define `delayMs`.

Rules:

- `delayMs` default is `0`.
- UI max should default to `60000` ms.
- Root config may increase the max.
- Delay applies before returning success or configured error.

### FR-FAIL-002: Forced Error

Each endpoint or response case may configure:

| Field | Description |
|---|---|
| `errorEnabled` | Whether forced error is active. |
| `errorProbability` | 0–100%. |
| `restStatusCode` | REST status code to return. |
| `mcpErrorMode` | `tool_error` or `protocol_error`. |
| `mcpErrorCode` | JSON-RPC error code if protocol error. |
| `errorMessage` | Error message. |
| `errorBodyJson` | Optional custom error body. |

### FR-FAIL-003: Timeout Simulation

Timeout is simulated using large `delayMs`.

The UI should include a shortcut:

```text
Simulate timeout: delay response by 30 seconds
```

### FR-FAIL-004: Malformed Response

For negative testing, an endpoint may be configured to return malformed data.

Modes:

| Mode | REST Behavior | MCP Behavior |
|---|---|---|
| `none` | normal JSON | normal JSON-RPC |
| `invalid_json` | invalid JSON body | invalid JSON body |
| `wrong_content_type` | text/plain | text/plain |
| `empty_body` | empty body | empty body |

This setting should show a warning in UI because it intentionally breaks protocol behavior.

---

## 9. Web UI Requirements

## 9.1 Navigation

The Web UI must include:

1. Dashboard
2. Endpoints / MCP Tools
3. Basic Auth Users
4. OAuth Users
5. OAuth Clients
6. Issued Tokens
7. Server Config / Connection Guide
8. Reset to Default
9. Audit Log

---

## 9.2 Dashboard

Dashboard must show:

- total endpoints
- enabled endpoints
- Basic users count
- OAuth users count
- OAuth clients count
- active tokens count
- expired tokens count
- revoked tokens count
- MCP server URL examples
- REST API URL examples
- warning that the admin UI is public

---

## 9.3 Endpoints Screen

Features:

- list endpoints
- search by name or description
- create endpoint
- edit endpoint
- enable/disable endpoint
- delete endpoint with 8-digit code or root password
- copy MCP tool call example
- copy REST call example
- open test console

Endpoint editor sections:

1. Basic information
2. Parameters, up to 3
3. Response cases
4. Default response
5. Failure simulation
6. Delete protection code
7. Preview generated MCP schema

---

## 9.4 Endpoint Test Console

The test console must allow users to:

- select auth mode:
  - None
  - Basic
  - OAuth Bearer
- input Basic username/password
- paste OAuth token
- enter arguments JSON
- call via MCP simulation
- call via REST simulation
- see raw request
- see raw response
- see matched response case
- see auth principal
- see elapsed time

---

## 9.5 Basic Auth Users Screen

Features:

- list users
- create user
- edit password
- enable/disable user
- delete user
- built-in `default/default` displayed as locked

Fields:

| Field | Editable | Notes |
|---|---:|---|
| username | yes, except built-in | Unique. |
| password | yes, except built-in | Stored hashed. |
| enabled | yes, except built-in | Built-in must always be enabled. |
| isBuiltin | no | System-managed. |

---

## 9.6 OAuth Users Screen

Features:

- list OAuth users
- create user
- edit password
- edit token TTL
- enable/disable user
- delete user
- built-in `default/default` displayed as locked

Token TTL editor:

- seconds input
- quick presets:
  - 5 minutes
  - 1 hour
  - 24 hours
  - 7 days
  - never should not be allowed in MVP; use a very large TTL only if root-enabled

---

## 9.7 OAuth Clients Screen

Features:

- list OAuth clients
- create client
- edit display name
- edit redirect URIs
- regenerate secret
- edit allowed endpoints
- edit client credentials token TTL
- enable/disable client
- delete client
- built-in `default/default` displayed as locked

Client creation behavior:

- user enters `client_id`
- server generates random `client_secret`
- server generates default test redirect URI
- server assigns all enabled endpoints as allowed by default
- UI displays client secret once and allows copy

---

## 9.8 OAuth Login and Consent UI

The OAuth login UI must be separate from the admin UI.

### Login Page

Fields:

- username
- password
- login button
- cancel button

### Consent Page

Shows:

- client name
- client ID
- redirect URI
- resource/audience
- logged-in user
- token TTL
- endpoint permission checklist
- submit button
- cancel button

Consent confirmation result:

- creates authorization code
- redirects to client redirect URI with `code` and `state`

---

## 9.9 Issued Tokens Screen

Features:

- list issued tokens
- view token detail
- view claims
- view endpoint permissions
- revoke token
- filter by status

Token list columns:

| Column | Description |
|---|---|
| JTI | Token ID. |
| Subject | `user:<username>` or `client:<client_id>`. |
| Client | OAuth client. |
| Grant type | `authorization_code` or `client_credentials`. |
| Issued at | Timestamp. |
| Expires at | Timestamp. |
| Status | active, expired, revoked. |
| Endpoint count | Number of endpoints permitted. |

Token detail should show:

```json
{
  "jti": "uuid",
  "sub": "user:default",
  "client_id": "default",
  "grant_type": "authorization_code",
  "scope": "endpoint:get_weather",
  "endpoint_permissions": [
    {
      "id": "endpoint_uuid",
      "name": "get_weather"
    }
  ],
  "issued_at": "2026-05-05T00:00:00.000Z",
  "expires_at": "2026-05-05T01:00:00.000Z",
  "revoked_at": null
}
```

---

## 9.10 Server Config / Connection Guide

This screen must show:

- current public base URL
- detected base URL
- configured base URL override
- MCP URLs
- REST URLs
- OAuth discovery URLs
- sample MCP client config
- sample curl commands
- Nginx reverse proxy example

Base URL behavior:

1. If `APP_BASE_URL` env var exists, use it.
2. Else if DB setting `base_url_override` exists, use it.
3. Else infer from request headers:
   - `X-Forwarded-Proto`
   - `X-Forwarded-Host`
   - `Host`
4. Else fallback to local server URL.

Changing base URL override should require root password.

---

## 9.11 Reset to Default Screen

Fields:

- root password
- confirmation text
- reset button

Reset options:

- reset all data
- reset endpoints only
- reset users/clients/tokens only

MVP may implement only full reset.

---

## 9.12 Audit Log Screen

Audit log should show:

- endpoint created
- endpoint updated
- endpoint deleted
- Basic user created/deleted
- OAuth user created/deleted
- OAuth client created/deleted
- token issued
- token revoked
- reset performed
- failed delete attempt

Because the UI is public, audit logs help understand who changed what. Store IP address only if privacy policy allows it; otherwise store anonymized IP hash.

---

## 10. API Contract

## 10.1 Admin API

### Health

```text
GET /api/health
```

Response:

```json
{
  "status": "ok",
  "version": "1.0.0",
  "database": "ok",
  "time": "2026-05-05T00:00:00.000Z"
}
```

---

### Public Config

```text
GET /api/config/public
```

Response:

```json
{
  "baseUrl": "https://mock.example.com",
  "mcp": {
    "unified": "/mcp",
    "none": "/mcp/none",
    "basic": "/mcp/basic",
    "oauth": "/mcp/oauth"
  },
  "rest": {
    "listTools": "/rest/tools",
    "callTool": "/rest/tools/:name/call"
  },
  "oauth": {
    "authorize": "/oauth/authorize",
    "token": "/oauth/token",
    "jwks": "/oauth/jwks"
  }
}
```

---

### List Endpoints

```text
GET /api/endpoints
```

Response:

```json
{
  "items": [
    {
      "id": "endpoint_uuid",
      "name": "get_weather",
      "title": "Get Weather",
      "description": "Returns mock weather data",
      "enabled": true,
      "parameterCount": 1,
      "responseCaseCount": 2,
      "createdAt": "2026-05-05T00:00:00.000Z",
      "updatedAt": "2026-05-05T00:00:00.000Z"
    }
  ]
}
```

---

### Create Endpoint

```text
POST /api/endpoints
```

Request:

```json
{
  "name": "get_weather",
  "title": "Get Weather",
  "description": "Returns mock weather data",
  "enabled": true,
  "deleteCode": "12345678",
  "parameters": [
    {
      "name": "city",
      "type": "string",
      "description": "City name",
      "required": true
    }
  ],
  "responseCases": [
    {
      "caseName": "Seoul weather",
      "priority": 1,
      "matchJson": {
        "city": "Seoul"
      },
      "responseJson": {
        "city": "Seoul",
        "temperature": 22,
        "condition": "Sunny"
      },
      "isDefault": false,
      "delayMs": 0,
      "errorEnabled": false
    }
  ]
}
```

Response:

```json
{
  "id": "endpoint_uuid",
  "name": "get_weather"
}
```

---

### Update Endpoint

```text
PUT /api/endpoints/:id
```

Request shape should match create endpoint, except `deleteCode` is optional unless changing it.

---

### Delete Endpoint

```text
DELETE /api/endpoints/:id
```

Request:

```json
{
  "deleteCode": "12345678"
}
```

Alternative root deletion:

```json
{
  "rootPassword": "ROOT_PASSWORD_FROM_ENV"
}
```

Response:

```json
{
  "deleted": true
}
```

---

### Basic Users

```text
GET /api/basic-users
POST /api/basic-users
PUT /api/basic-users/:id
DELETE /api/basic-users/:id
```

Create request:

```json
{
  "username": "tester",
  "password": "tester-password",
  "enabled": true
}
```

---

### OAuth Users

```text
GET /api/oauth/users
POST /api/oauth/users
PUT /api/oauth/users/:id
DELETE /api/oauth/users/:id
```

Create request:

```json
{
  "username": "oauth_tester",
  "password": "password",
  "tokenTtlSeconds": 3600,
  "enabled": true
}
```

---

### OAuth Clients

```text
GET /api/oauth/clients
POST /api/oauth/clients
PUT /api/oauth/clients/:id
DELETE /api/oauth/clients/:id
POST /api/oauth/clients/:id/regenerate-secret
```

Create request:

```json
{
  "clientId": "my-test-client",
  "displayName": "My Test Client"
}
```

Create response:

```json
{
  "id": "client_uuid",
  "clientId": "my-test-client",
  "clientSecret": "generated-secret-shown-once",
  "redirectUris": [
    "http://localhost:3000/oauth/callback/generated"
  ],
  "allowedEndpointIds": ["endpoint_uuid"]
}
```

---

### Issued Tokens

```text
GET /api/oauth/tokens
GET /api/oauth/tokens/:jti
POST /api/oauth/tokens/:jti/revoke
```

Revoke response:

```json
{
  "revoked": true,
  "jti": "token_uuid"
}
```

---

### Reset

```text
POST /api/reset
```

Request:

```json
{
  "rootPassword": "ROOT_PASSWORD_FROM_ENV",
  "mode": "full"
}
```

Response:

```json
{
  "reset": true,
  "mode": "full"
}
```

---

## 10.2 OAuth API

### Authorization Endpoint

```text
GET /oauth/authorize
```

Example query:

```text
/oauth/authorize?response_type=code&client_id=default&redirect_uri=http%3A%2F%2Flocalhost%3A3000%2Fcallback&state=abc123&resource=https%3A%2F%2Fmock.example.com%2Fmcp
```

Behavior:

- validates client
- validates redirect URI
- starts browser login session
- renders login page if not logged in
- renders consent page after login

---

### Token Endpoint

```text
POST /oauth/token
Content-Type: application/x-www-form-urlencoded
```

Authorization code grant:

```text
grant_type=authorization_code
code=AUTH_CODE
redirect_uri=http://localhost:3000/callback
client_id=default
client_secret=default
```

Client credentials grant:

```text
grant_type=client_credentials
client_id=default
client_secret=default
scope=endpoint:get_weather
```

---

### JWKS Endpoint

```text
GET /oauth/jwks
```

Response:

```json
{
  "keys": [
    {
      "kty": "RSA",
      "kid": "active-key-id",
      "use": "sig",
      "alg": "RS256",
      "n": "...",
      "e": "AQAB"
    }
  ]
}
```

---

### Protected Resource Metadata

```text
GET /.well-known/oauth-protected-resource
```

Response:

```json
{
  "resource": "https://mock.example.com/mcp",
  "authorization_servers": [
    "https://mock.example.com"
  ],
  "bearer_methods_supported": [
    "header"
  ],
  "scopes_supported": [
    "endpoint:get_weather",
    "endpoint:get_ticket"
  ]
}
```

---

### Authorization Server Metadata

```text
GET /.well-known/oauth-authorization-server
```

Response:

```json
{
  "issuer": "https://mock.example.com",
  "authorization_endpoint": "https://mock.example.com/oauth/authorize",
  "token_endpoint": "https://mock.example.com/oauth/token",
  "jwks_uri": "https://mock.example.com/oauth/jwks",
  "response_types_supported": ["code"],
  "grant_types_supported": ["authorization_code", "client_credentials"],
  "token_endpoint_auth_methods_supported": [
    "client_secret_post",
    "client_secret_basic"
  ],
  "scopes_supported": [
    "endpoint:get_weather",
    "endpoint:get_ticket"
  ]
}
```

---

## 11. Database Schema

SQLite tables should be created through migrations.

### 11.1 `mock_endpoints`

```sql
CREATE TABLE mock_endpoints (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  title TEXT,
  description TEXT NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 1,
  delete_code_hash TEXT NOT NULL,
  no_match_behavior TEXT NOT NULL DEFAULT 'tool_error',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
```

### 11.2 `endpoint_parameters`

```sql
CREATE TABLE endpoint_parameters (
  id TEXT PRIMARY KEY,
  endpoint_id TEXT NOT NULL,
  position INTEGER NOT NULL,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  description TEXT,
  required INTEGER NOT NULL DEFAULT 1,
  case_sensitive INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (endpoint_id) REFERENCES mock_endpoints(id) ON DELETE CASCADE,
  UNIQUE(endpoint_id, name),
  UNIQUE(endpoint_id, position)
);
```

### 11.3 `endpoint_response_cases`

```sql
CREATE TABLE endpoint_response_cases (
  id TEXT PRIMARY KEY,
  endpoint_id TEXT NOT NULL,
  case_name TEXT NOT NULL,
  priority INTEGER NOT NULL DEFAULT 100,
  match_json TEXT NOT NULL,
  response_json TEXT NOT NULL,
  is_default INTEGER NOT NULL DEFAULT 0,
  delay_ms INTEGER NOT NULL DEFAULT 0,
  error_enabled INTEGER NOT NULL DEFAULT 0,
  error_probability INTEGER NOT NULL DEFAULT 100,
  rest_status_code INTEGER NOT NULL DEFAULT 200,
  mcp_error_mode TEXT NOT NULL DEFAULT 'none',
  mcp_error_code INTEGER,
  error_message TEXT,
  error_body_json TEXT,
  malformed_mode TEXT NOT NULL DEFAULT 'none',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (endpoint_id) REFERENCES mock_endpoints(id) ON DELETE CASCADE
);
```

### 11.4 `basic_users`

```sql
CREATE TABLE basic_users (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 1,
  is_builtin INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
```

### 11.5 `oauth_users`

```sql
CREATE TABLE oauth_users (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  token_ttl_seconds INTEGER NOT NULL DEFAULT 3600,
  enabled INTEGER NOT NULL DEFAULT 1,
  is_builtin INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
```

### 11.6 `oauth_clients`

```sql
CREATE TABLE oauth_clients (
  id TEXT PRIMARY KEY,
  client_id TEXT NOT NULL UNIQUE,
  client_secret_hash TEXT NOT NULL,
  display_name TEXT,
  redirect_uris_json TEXT NOT NULL,
  client_credentials_ttl_seconds INTEGER NOT NULL DEFAULT 3600,
  enabled INTEGER NOT NULL DEFAULT 1,
  is_builtin INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
```

### 11.7 `oauth_client_allowed_endpoints`

```sql
CREATE TABLE oauth_client_allowed_endpoints (
  client_id TEXT NOT NULL,
  endpoint_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY (client_id, endpoint_id),
  FOREIGN KEY (client_id) REFERENCES oauth_clients(id) ON DELETE CASCADE,
  FOREIGN KEY (endpoint_id) REFERENCES mock_endpoints(id) ON DELETE CASCADE
);
```

### 11.8 `oauth_authorization_codes`

```sql
CREATE TABLE oauth_authorization_codes (
  id TEXT PRIMARY KEY,
  code_hash TEXT NOT NULL UNIQUE,
  oauth_client_id TEXT NOT NULL,
  oauth_user_id TEXT NOT NULL,
  redirect_uri TEXT NOT NULL,
  state TEXT,
  resource TEXT,
  selected_endpoint_ids_json TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  used_at TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (oauth_client_id) REFERENCES oauth_clients(id),
  FOREIGN KEY (oauth_user_id) REFERENCES oauth_users(id)
);
```

### 11.9 `issued_tokens`

```sql
CREATE TABLE issued_tokens (
  jti TEXT PRIMARY KEY,
  token_hash TEXT NOT NULL,
  oauth_client_id TEXT NOT NULL,
  oauth_user_id TEXT,
  subject TEXT NOT NULL,
  grant_type TEXT NOT NULL,
  resource TEXT NOT NULL,
  selected_endpoint_ids_json TEXT NOT NULL,
  scope TEXT NOT NULL,
  issued_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  revoked_at TEXT,
  claims_json TEXT NOT NULL,
  FOREIGN KEY (oauth_client_id) REFERENCES oauth_clients(id),
  FOREIGN KEY (oauth_user_id) REFERENCES oauth_users(id)
);
```

### 11.10 `jwt_keys`

```sql
CREATE TABLE jwt_keys (
  kid TEXT PRIMARY KEY,
  algorithm TEXT NOT NULL,
  public_jwk_json TEXT NOT NULL,
  private_key_pem TEXT NOT NULL,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  retired_at TEXT
);
```

### 11.11 `server_settings`

```sql
CREATE TABLE server_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
```

### 11.12 `audit_logs`

```sql
CREATE TABLE audit_logs (
  id TEXT PRIMARY KEY,
  actor_type TEXT NOT NULL,
  actor_label TEXT,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT,
  summary_json TEXT,
  created_at TEXT NOT NULL
);
```

---

## 12. Environment Variables

| Variable | Required | Default | Description |
|---|---:|---|---|
| `NODE_ENV` | no | `development` | Runtime mode. |
| `PORT` | no | `3000` | Public frontend/gateway port. |
| `API_PORT` | no | `3001` | Internal API server port. |
| `DATABASE_URL` | no | `file:./data/mcp-mock.sqlite` | SQLite database path. |
| `APP_BASE_URL` | no | inferred | Public base URL for OAuth redirects and metadata. |
| `TRUST_PROXY` | no | `true` | Trust Nginx forwarded headers. |
| `ROOT_PASSWORD` | yes | none | Root password for reset and destructive recovery. |
| `JWT_PRIVATE_KEY_PEM` | no | generated | Optional RSA private key. |
| `JWT_PUBLIC_KEY_PEM` | no | generated | Optional RSA public key. |
| `JWT_KEY_ID` | no | generated | Active key ID. |
| `DEFAULT_OAUTH_REALM` | no | `default` | Single mock OAuth realm. |
| `MAX_ENDPOINTS` | no | `100` | Public UI safety limit. |
| `MAX_DELAY_MS` | no | `60000` | Max artificial delay unless root override. |
| `RATE_LIMIT_PER_MINUTE` | no | `300` | Basic public rate limit. |
| `ALLOWED_ORIGINS` | no | base URL + localhost | Origin validation allowlist. |

---

## 13. Reverse Proxy Requirements

The app should run HTTP internally and rely on Nginx for HTTPS.

Example Nginx behavior:

```nginx
server {
  listen 443 ssl http2;
  server_name mock.example.com;

  ssl_certificate /path/to/fullchain.pem;
  ssl_certificate_key /path/to/privkey.pem;

  location / {
    proxy_pass http://127.0.0.1:3000;
    proxy_http_version 1.1;

    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-Host $host;
    proxy_set_header X-Forwarded-Proto https;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;

    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
  }
}
```

Application requirements:

- respect `X-Forwarded-Proto`
- respect `X-Forwarded-Host`
- generate OAuth metadata and redirect URLs using public base URL
- validate Origin header against configured base URL and localhost development URLs
- allow local testing without HTTPS

---

## 14. Seed Data

On first boot or reset, seed:

### Basic User

```text
username: default
password: default
is_builtin: true
enabled: true
```

### OAuth User

```text
username: default
password: default
token_ttl_seconds: 3600
is_builtin: true
enabled: true
```

### OAuth Client

```text
client_id: default
client_secret: default
display_name: Default Mock OAuth Client
redirect_uris:
  - http://localhost:3000/oauth/callback
  - http://127.0.0.1:3000/oauth/callback
is_builtin: true
enabled: true
```

### Example Endpoint

```text
name: echo
title: Echo
description: Returns the provided message for mock testing.
parameter:
  - name: message
    type: string
response case:
  match: { "message": "hello" }
  response: { "echo": "hello" }
delete code: 00000000
```

The seed endpoint may be deleted only with code `00000000` or root password. Alternatively, it can be marked built-in and non-deletable; MVP should prefer deletable with known code for easier demo.

---

## 15. Security Requirements

### 15.1 Public UI Safety

Because anyone can access the UI:

- all pages must show a visible “public mock environment” warning
- endpoint deletion requires 8-digit code or root password
- reset requires root password
- built-in default accounts cannot be deleted
- rate limiting must be enabled
- audit logs must record destructive operations
- root password must never be displayed

### 15.2 Password Storage

- Basic Auth user passwords must be hashed.
- OAuth user passwords must be hashed.
- OAuth client secrets must be hashed.
- Recommended hash: Argon2id or bcrypt.

### 15.3 JWT Key Handling

- Generate RSA key pair on first boot if env keys are not supplied.
- Persist generated key in SQLite or mounted file.
- Expose public key via JWKS.
- Do not expose private key through UI or API.

### 15.4 OAuth Token Revocation

JWTs are normally stateless, but this mock server must check `issued_tokens` on every OAuth-authenticated request so UI revocation works.

### 15.5 Origin Validation

For Streamable HTTP, validate `Origin` when present.

Allowed origins:

- configured `APP_BASE_URL`
- detected local development origins
- configured `ALLOWED_ORIGINS`

Invalid Origin should return `403`.

---

## 16. Error Handling Requirements

### 16.1 HTTP Status Mapping

| Scenario | HTTP Status |
|---|---:|
| Missing Basic Auth on `/mcp/basic` | 401 |
| Invalid Basic Auth | 401 |
| Missing Bearer token on `/mcp/oauth` | 401 |
| Invalid/expired/revoked Bearer token | 401 |
| Valid OAuth token without endpoint permission | 403 |
| Invalid Origin | 403 |
| Unknown REST tool | 404 |
| Invalid JSON request body | 400 |
| Unsupported JSON-RPC method | 200 with JSON-RPC error, unless transport/auth error |
| Forced REST mock error | configured status |
| Forced MCP protocol error | configured JSON-RPC error |

### 16.2 JSON-RPC Error Codes

| Code | Use |
|---:|---|
| `-32700` | Parse error |
| `-32600` | Invalid request |
| `-32601` | Method not found |
| `-32602` | Invalid params |
| `-32603` | Internal error |
| `-32001` | Unauthorized |
| `-32002` | Invalid token |
| `-32003` | Forbidden |
| `-32004` | No matching mock response |
| `-32005` | Configured mock failure |

---

## 17. Observability Requirements

MVP should include:

- structured server logs
- audit log table
- request ID per request
- elapsed time in logs
- auth mode in logs
- endpoint/tool name in logs
- response case ID in logs
- token JTI in logs for OAuth calls, if available

Recommended log event:

```json
{
  "requestId": "uuid",
  "route": "/mcp/oauth",
  "method": "tools/call",
  "toolName": "get_weather",
  "authMode": "oauth",
  "subject": "user:default",
  "jti": "token_uuid",
  "status": 200,
  "elapsedMs": 14
}
```

---

## 18. Acceptance Criteria

### AC-001: No-Auth MCP Call

Given an enabled endpoint `echo`, when an MCP client calls `/mcp/none` with no Authorization header:

1. `initialize` succeeds.
2. `tools/list` returns `echo`.
3. `tools/call` with matching parameters returns configured mock data.

### AC-002: Basic Auth MCP Call

Given Basic user `default/default`, when an MCP client calls `/mcp/basic` with:

```text
Authorization: Basic ZGVmYXVsdDpkZWZhdWx0
```

Then:

1. `initialize` succeeds.
2. `tools/list` returns all enabled endpoints.
3. `tools/call` returns mock data.

### AC-003: Invalid Basic Auth

Given invalid Basic credentials, when client calls `/mcp/basic`, server returns `401`.

### AC-004: OAuth Authorization Code Flow

Given OAuth user `default/default` and OAuth client `default/default`:

1. Client starts `/oauth/authorize`.
2. User logs in.
3. User selects endpoint `echo`.
4. Server redirects with code.
5. Client exchanges code at `/oauth/token`.
6. Server returns JWT access token.
7. Client calls `/mcp/oauth` with bearer token.
8. `tools/list` returns only `echo`.
9. `tools/call` for `echo` succeeds.

### AC-005: OAuth Permission Denial

Given a token that only allows `echo`, when the client calls `get_weather` through `/mcp/oauth`, server returns `403`.

### AC-006: Expired Token

Given an expired token, when the client calls `/mcp/oauth`, server returns `401`.

### AC-007: Revoked Token

Given a token revoked in the Web UI, when the client calls `/mcp/oauth`, server returns `401`.

### AC-008: REST Parity

Given the same endpoint and same input arguments:

- MCP `tools/call`
- REST `POST /rest/tools/:name/call`

must resolve the same response case.

### AC-009: Endpoint Delete Code

Given an endpoint with delete code `12345678`:

- deletion with wrong code fails
- deletion with correct code succeeds
- deletion with root password succeeds

### AC-010: Reset to Default

Given arbitrary public modifications, when root password reset is performed:

- all non-default data is removed
- default Basic user still works
- default OAuth user still works
- default OAuth client still works
- seed endpoint exists

### AC-011: Artificial Delay

Given an endpoint response case with `delayMs=3000`, a call to that case must take at least 3 seconds before returning.

### AC-012: Forced Error

Given an endpoint configured for forced `500`, REST call returns HTTP `500`, and MCP call returns the configured MCP error or tool error.

### AC-013: Reverse Proxy Base URL

Given the app runs behind Nginx with HTTPS, OAuth metadata and redirect links must use the external HTTPS base URL, not internal `localhost`.

---

## 19. MVP Scope

MVP must include:

1. Next.js SPA frontend
2. Node.js TypeScript API server
3. SQLite persistence
4. Public endpoint/tool CRUD
5. 8-digit endpoint delete code
6. Root password reset
7. Basic Auth user management
8. OAuth user management
9. OAuth client management
10. Authorization code flow
11. Client credentials flow
12. JWT access tokens
13. Token list and revoke UI
14. MCP Streamable HTTP JSON-RPC `POST`
15. MCP methods:
    - `initialize`
    - `notifications/initialized`
    - `tools/list`
    - `tools/call`
    - `ping`, optional but recommended
16. REST tool list and call APIs
17. Exact-match response cases
18. Artificial delay
19. Forced error
20. Invalid/expired/revoked token testing
21. OAuth endpoint permission enforcement
22. Docker and direct execution support
23. Nginx reverse proxy guide
24. Seed defaults

---

## 20. Phase 2 Roadmap

Phase 2 should add:

1. SSE support for full Streamable HTTP behavior.
2. MCP session ID support.
3. `notifications/tools/list_changed` push behavior.
4. PKCE support for authorization code flow.
5. Dynamic Client Registration.
6. OAuth Client ID Metadata Document support.
7. More advanced scope model beyond endpoint permissions.
8. Workspace isolation so public users do not overwrite each other.
9. Import/export endpoint configurations.
10. Endpoint templates.
11. Regex and partial matching.
12. JSONPath-based matching.
13. OpenAPI generation for REST mock endpoints.
14. More detailed request history.
15. JWT key rotation.
16. Token introspection endpoint.
17. Optional admin password for the whole Web UI.
18. Old HTTP+SSE compatibility route for older MCP clients.
19. UI-based Nginx config generator.
20. Mock response recording and replay.

---

## 21. Phase 3 Roadmap

Phase 3 may include:

1. Multi-tenant public workspaces.
2. Temporary share links.
3. Time-limited public test environments.
4. Agent behavior analytics.
5. Load testing mode.
6. Webhook-style callbacks.
7. Built-in MCP client simulator.
8. Hosted SaaS version.
9. Team-level admin controls.
10. SSO for private deployments.

---

## 22. Key Product Risks and Mitigations

### Risk 1: Public UI Can Be Messed Up by Anyone

Mitigation:

- root reset
- endpoint delete codes
- built-in defaults
- audit log
- max endpoint limits
- rate limiting

### Risk 2: OAuth Mock Is Mistaken for Production Auth

Mitigation:

- visible warning in UI
- README warning
- token issuer name includes `mock`
- do not store real credentials
- recommend isolated test domain

### Risk 3: MCP Client Compatibility Differences

Mitigation:

- support latest Streamable HTTP basics
- provide strict and unified MCP routes
- provide sample configs
- add Phase 2 support for DCR, PKCE, SSE, and client metadata documents

### Risk 4: OAuth Permission Model Becomes Too Narrow

Mitigation:

- store endpoint permissions as explicit grants now
- also generate scope strings
- design DB to allow future scope/resource/action expansion

### Risk 5: Reverse Proxy URL Mismatch Breaks OAuth Redirects

Mitigation:

- `APP_BASE_URL`
- UI base URL override
- forwarded header support
- connection guide screen
- metadata preview screen

---

## 23. Recommended Implementation Milestones

### Milestone 1: Foundation

- monorepo setup
- API server
- Next.js SPA
- SQLite migrations
- seed defaults
- health check

### Milestone 2: Endpoint CRUD and REST Mock

- endpoint CRUD
- parameter editor
- response case editor
- exact matching
- REST list/call
- delete code

### Milestone 3: MCP Core

- `/mcp` POST handler
- `initialize`
- `notifications/initialized`
- `tools/list`
- `tools/call`
- JSON-RPC error handling
- strict MCP route aliases

### Milestone 4: Basic Auth

- Basic user CRUD
- password hashing
- default/default lock
- Basic Auth middleware
- Basic Auth tests

### Milestone 5: OAuth Mock

- OAuth user CRUD
- OAuth client CRUD
- authorization page
- login page
- consent page
- token endpoint
- JWT issuance
- JWKS
- discovery metadata

### Milestone 6: OAuth Permissions and Tokens UI

- endpoint permission selection
- OAuth token enforcement
- issued token table
- revoke token
- expired/revoked tests

### Milestone 7: Failure Simulation

- delay
- forced errors
- malformed response
- no-match behavior
- test console

### Milestone 8: Deployment Readiness

- Dockerfile
- docker-compose
- SQLite volume
- Nginx example
- environment variable documentation
- production-mode smoke tests

---

## 24. Final MVP Definition

The MVP is complete when a public user can:

1. Open the Web UI.
2. Create a mock MCP tool with up to three parameters.
3. Configure exact-match mock responses.
4. Call it through REST with no auth.
5. Call it through MCP with no auth.
6. Call it through MCP with Basic Auth using `default/default`.
7. Create an OAuth login user and OAuth client.
8. Complete the browser OAuth login and endpoint consent flow.
9. Receive a JWT access token.
10. Call only selected MCP tools with that token.
11. See `403` when using the token for unselected tools.
12. See `401` for expired, invalid, or revoked tokens.
13. View and revoke issued tokens from the UI.
14. Simulate delay and error responses.
15. Reset the whole environment using root password.
16. Run the server in Docker or directly behind Nginx HTTPS termination.

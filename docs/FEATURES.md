# Feature Overview

This page lists the user-facing features provided by MCP Mock Server as of the current Resources/Prompts wave.

Use this with:

- [README](../README.md) for the short project overview
- [Getting started](GETTING_STARTED.md) for step-by-step local use
- [Transports](TRANSPORTS.md) for MCP, SSE, REST, and OAuth call examples
- [Inspector integration](INSPECTOR.md) for project and upstream Inspector workflows

## Product Purpose

MCP Mock Server gives MCP client developers a repeatable remote-like target for verifying connection, authentication, authorization, tool schema, tool execution, failure handling, and audit evidence before integrating with a real MCP service.

## Admin UI

| Page | Purpose |
|---|---|
| `/` | Dashboard and workflow entry points |
| `/endpoints` | Endpoint catalog, search, create entry |
| `/endpoints/new` | Create one mock MCP/REST tool |
| `/endpoints/[id]` | Endpoint overview |
| `/endpoints/[id]/edit` | Name, description, enabled state, delete code |
| `/endpoints/[id]/parameters` | Up to three parameters and generated MCP `inputSchema` |
| `/endpoints/[id]/responses` | Default response and exact-match response cases |
| `/endpoints/[id]/failure` | Delay, forced error, malformed JSON, wrong content type, empty body |
| `/endpoints/[id]/console` | REST/MCP-style execution evidence |
| `/endpoints/[id]/delete` | Protected endpoint delete flow |
| `/resources` | Direct MCP resource catalog |
| `/resources/new`, `/resources/[id]/*` | Resource metadata, content, console, and delete workflows |
| `/resource-templates` | Parameterized MCP resource-template catalog |
| `/resource-templates/new`, `/resource-templates/[id]/*` | Template metadata, arguments, rendered content, completion candidates, console, and delete workflows |
| `/prompts` | MCP prompt catalog |
| `/prompts/new`, `/prompts/[id]/*` | Prompt metadata, arguments, messages, completion candidates, console, and delete workflows |
| `/basic-users` | Basic Auth fixture catalog |
| `/oauth-users` | OAuth login-user catalog |
| `/oauth-clients` | OAuth client catalog, redirect URIs, allowed endpoints, copy-once secrets |
| `/tokens` | Issued-token list with filters and manual refresh |
| `/tokens/[jti]` | Token claims, endpoint permissions, revocation |
| `/config` | Effective base URL, health, MCP/REST/OAuth/TLS connection URLs |
| `/inspector` | Verification hub with project and upstream Inspector guidance |
| `/audit` | Incrementally loaded audit log with filters |
| `/audit/[id]` | Full audit evidence payload |
| `/reset` | Root-password protected reset to defaults |

## Runtime Surfaces

| Surface | Routes | Notes |
|---|---|---|
| Streamable HTTP MCP | `/mcp`, `/mcp/none`, `/mcp/basic`, `/mcp/oauth` | Modern JSON-RPC MCP over HTTP POST. GET returns a lightweight SSE stream for compatibility checks. |
| Legacy SSE MCP | `/sse`, `/sse/none`, `/sse/basic`, `/sse/oauth` | Inspector-compatible SSE stream that emits an `endpoint` event for POSTing messages. |
| REST tool API | `/rest/tools`, `/rest/tools/{tool_name}/call` | Curl/Postman-friendly tool list and call routes. |
| OAuth authorization server | `/oauth/authorize`, `/oauth/login`, `/oauth/consent`, `/oauth/token`, `/oauth/revoke`, `/oauth/jwks` | Mock OAuth with browser authorization code, PKCE S256, client credentials, JWTs, and revocation. |
| OAuth discovery | `/.well-known/oauth-authorization-server`, `/.well-known/oauth-protected-resource`, `/.well-known/openid-configuration` | Metadata for clients and Inspectors. |
| Operations | `/api/health`, `/api/config`, `/api/reset`, `/api/audit` | Health, public config, reset, and audit APIs. |

## Authentication Modes

| Mode | Routes | Seed Credential |
|---|---|---|
| No auth | `/mcp/none`, `/sse/none`, `/rest/tools` | none |
| Unified | `/mcp`, `/sse` | no header is anonymous; valid Basic/Bearer applies auth; invalid auth fails closed |
| Basic Auth | `/mcp/basic`, `/sse/basic`, REST with Basic header | `default` / `default` |
| OAuth Bearer | `/mcp/oauth`, `/sse/oauth`, REST with Bearer header | token issued by `/oauth/token` |

OAuth tokens carry endpoint permission claims. A valid token that lacks permission returns `403` for that endpoint. Missing, invalid, expired, revoked, or wrong-audience tokens return `401`.

OAuth tokens also carry resource and prompt permission claims. Bearer `resources/list`, `resources/read`, `prompts/list`, `prompts/get`, and `completion/complete` expose only the permitted resource or prompt set.

## Endpoint Behavior

Each endpoint becomes an MCP tool and a REST-callable mock operation.

Supported endpoint settings:

- stable endpoint ID and external tool name
- title and description
- enabled/disabled state
- delete code for protected deletion
- up to three parameters
- generated MCP `inputSchema`
- default response
- exact-match response cases using `matchArgsJson`
- endpoint-level and case-level delay/error behavior
- malformed response modes for client parser testing

## Failure Simulation

Failure modes are intentionally visible because they can break client assumptions.

Supported modes:

- bounded artificial delay
- forced REST/MCP error
- invalid JSON body
- wrong content type
- empty body
- case-level protocol/tool errors

Mutation and security-relevant actions leave audit evidence without storing submitted secrets.

## Resources, Prompts, And Completion

The server exposes the full server-side MCP feature set needed for client integration smoke tests:

- direct Resources through `resources/list` and `resources/read`
- Resource Templates through `resources/templates/list`, templated `resources/read`, and resource argument completion
- Prompts through `prompts/list`, `prompts/get`, and prompt argument completion
- `completion/complete` for prompt arguments and resource-template arguments
- best-effort legacy SSE `resources/subscribe` / `resources/unsubscribe` with `notifications/resources/updated`, `notifications/resources/list_changed`, and `notifications/prompts/list_changed`

Client-side Sampling, Roots, and Elicitation are not implemented.

## Inspector Options

MCP Mock Server provides three verification paths:

- **Standalone project Inspector UI**: `npm run inspector:ui`, then open `http://127.0.0.1:3200` for Mock Server scenario, Generic method presets, and OAuth popup verification.
- **Project CLI smoke Inspector**: `npm run inspector:mock`.
- **Upstream MCP Inspector**: `npx @modelcontextprotocol/inspector` for browser and CLI tools/resources/prompts checks. Upstream CLI `0.21.2` does not expose `completion/complete`; use the upstream browser UI or project Generic target for completion.

The standalone project Inspector is the easiest way to prove the full Mock Server product flow. The upstream Inspector is best for standard MCP protocol debugging and compatibility checks.

## Persistence And Defaults

`npm run db:prepare` creates or preserves runtime SQLite state and ensures seeded defaults exist:

- endpoint: `echo`
- parameter: `message`
- exact-match response: `{"message":"hello"}` returns `{"ok":true,"message":"world"}`
- resource: `mock://resources/server-status`
- resource template: `mock://resources/customers/{customerId}`
- prompt: `support_reply`
- Basic user: `default` / `default`
- OAuth login user: `default` / `default`
- OAuth client: `default` / `default`
- default OAuth redirect URI: `http://localhost:3000/oauth/callback`

Built-in defaults are protected from normal destructive changes.

## Deployment And Operations

Supported operator paths:

- local development with `npm run dev`
- production-style logged start with `npm run start:logged`
- local app-level HTTPS with `npm run cert:dev` and `npm run start:tls`
- Docker Compose with SQLite/log volumes
- Nginx or another reverse proxy for public TLS termination

Public deployments should terminate TLS at the proxy layer and set `APP_BASE_URL` to the final public origin when possible.

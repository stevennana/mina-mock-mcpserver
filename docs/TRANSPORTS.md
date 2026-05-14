# MCP Transports, REST, SSE, And OAuth Calls

This page gives copy-ready protocol calls for MCP Mock Server.

For the short project overview, see [README](../README.md). For end-to-end UI steps, see [Getting started](GETTING_STARTED.md).

## Route Matrix

| Mode | Streamable HTTP MCP | Legacy SSE MCP | REST |
|---|---|---|---|
| Unified | `/mcp` | `/sse` | `/rest/tools` and `/rest/tools/{name}/call` |
| No auth | `/mcp/none` | `/sse/none` | no Authorization header |
| Basic | `/mcp/basic` | `/sse/basic` | `Authorization: Basic ...` |
| OAuth Bearer | `/mcp/oauth` | `/sse/oauth` | `Authorization: Bearer ...` |

`/mcp/*` routes accept JSON-RPC over HTTP `POST`. They also support lightweight `GET` SSE responses for compatibility checks.

`/sse/*` routes are legacy-style SSE compatibility aliases. A client opens the SSE stream, reads the emitted `endpoint` event, then POSTs JSON-RPC messages to that endpoint. Responses arrive as SSE `message` events.

The reusable MCP JSON-RPC method handling behind these routes comes from the `@minasoft/mcp-runtime` package boundary. Mock Server-owned wrappers still perform route auth, OAuth permission filtering, CORS, SSE session handling, failure simulation, and audit evidence.

The SSE bridge is for local compatibility and upstream Inspector checks. It is not durable session storage, resumable replay, or a production event queue.

Legacy SSE sessions also support best-effort, in-memory `resources/subscribe` and `resources/unsubscribe` calls. When an open legacy SSE session is subscribed to an enabled resource URI, admin resource content mutations emit `notifications/resources/updated` on that stream. Enabled resource/template catalog changes emit `notifications/resources/list_changed`, and enabled prompt catalog changes emit `notifications/prompts/list_changed`. Streamable HTTP `GET` remains only a lightweight compatibility stream and does not provide durable session replay.

## Streamable HTTP No-Auth

Initialize:

```bash
curl -X POST http://127.0.0.1:3100/mcp/none \
  -H 'content-type: application/json' \
  -H 'accept: application/json, text/event-stream' \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-06-18","capabilities":{},"clientInfo":{"name":"curl","version":"1.0.0"}}}'
```

List tools:

```bash
curl -X POST http://127.0.0.1:3100/mcp/none \
  -H 'content-type: application/json' \
  -H 'accept: application/json, text/event-stream' \
  -H 'MCP-Protocol-Version: 2025-06-18' \
  -d '{"jsonrpc":"2.0","id":2,"method":"tools/list"}'
```

Call `echo`:

```bash
curl -X POST http://127.0.0.1:3100/mcp/none \
  -H 'content-type: application/json' \
  -H 'accept: application/json, text/event-stream' \
  -H 'MCP-Protocol-Version: 2025-06-18' \
  -d '{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"echo","arguments":{"message":"hello"}}}'
```

List resources:

```bash
curl -X POST http://127.0.0.1:3100/mcp/none \
  -H 'content-type: application/json' \
  -H 'accept: application/json, text/event-stream' \
  -H 'MCP-Protocol-Version: 2025-06-18' \
  -d '{"jsonrpc":"2.0","id":"resources","method":"resources/list"}'
```

Read the seeded resource:

```bash
curl -X POST http://127.0.0.1:3100/mcp/none \
  -H 'content-type: application/json' \
  -H 'accept: application/json, text/event-stream' \
  -H 'MCP-Protocol-Version: 2025-06-18' \
  -d '{"jsonrpc":"2.0","id":"read","method":"resources/read","params":{"uri":"mock://resources/server-status"}}'
```

List resource templates:

```bash
curl -X POST http://127.0.0.1:3100/mcp/none \
  -H 'content-type: application/json' \
  -H 'accept: application/json, text/event-stream' \
  -H 'MCP-Protocol-Version: 2025-06-18' \
  -d '{"jsonrpc":"2.0","id":"templates","method":"resources/templates/list"}'
```

List prompts and get the seeded prompt:

```bash
curl -X POST http://127.0.0.1:3100/mcp/none \
  -H 'content-type: application/json' \
  -H 'accept: application/json, text/event-stream' \
  -H 'MCP-Protocol-Version: 2025-06-18' \
  -d '{"jsonrpc":"2.0","id":"prompts","method":"prompts/list"}'

curl -X POST http://127.0.0.1:3100/mcp/none \
  -H 'content-type: application/json' \
  -H 'accept: application/json, text/event-stream' \
  -H 'MCP-Protocol-Version: 2025-06-18' \
  -d '{"jsonrpc":"2.0","id":"prompt","method":"prompts/get","params":{"name":"support_reply","arguments":{"tone":"friendly"}}}'
```

Complete prompt and resource-template arguments:

```bash
curl -X POST http://127.0.0.1:3100/mcp/none \
  -H 'content-type: application/json' \
  -H 'accept: application/json, text/event-stream' \
  -H 'MCP-Protocol-Version: 2025-06-18' \
  -d '{"jsonrpc":"2.0","id":"complete-prompt","method":"completion/complete","params":{"ref":{"type":"ref/prompt","name":"support_reply"},"argument":{"name":"tone","value":"fri"}}}'

curl -X POST http://127.0.0.1:3100/mcp/none \
  -H 'content-type: application/json' \
  -H 'accept: application/json, text/event-stream' \
  -H 'MCP-Protocol-Version: 2025-06-18' \
  -d '{"jsonrpc":"2.0","id":"complete-resource","method":"completion/complete","params":{"ref":{"type":"ref/resource","uri":"mock://resources/customers/{customerId}"},"argument":{"name":"customerId","value":"cust"}}}'
```

## Streamable HTTP Basic Auth

```bash
curl -X POST http://127.0.0.1:3100/mcp/basic \
  -u default:default \
  -H 'content-type: application/json' \
  -H 'accept: application/json, text/event-stream' \
  -H 'MCP-Protocol-Version: 2025-06-18' \
  -d '{"jsonrpc":"2.0","id":4,"method":"tools/list"}'
```

Missing, invalid, or disabled Basic credentials return `401` with `WWW-Authenticate: Basic`.

## Streamable HTTP OAuth Bearer

Issue a client-credentials token:

```bash
TOKEN="$(
  curl -sS -X POST http://127.0.0.1:3100/oauth/token \
    -H 'content-type: application/x-www-form-urlencoded' \
    -d 'grant_type=client_credentials' \
    -d 'client_id=default' \
    -d 'client_secret=default' \
    -d 'resource=http://127.0.0.1:3100' \
  | node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>console.log(JSON.parse(d).access_token))"
)"
```

List permitted tools:

```bash
curl -X POST http://127.0.0.1:3100/mcp/oauth \
  -H 'content-type: application/json' \
  -H 'accept: application/json, text/event-stream' \
  -H 'MCP-Protocol-Version: 2025-06-18' \
  -H "authorization: Bearer $TOKEN" \
  -d '{"jsonrpc":"2.0","id":5,"method":"tools/list"}'
```

OAuth Bearer behavior:

- valid and permitted token -> `200`
- valid token without tool/resource/prompt permission -> `403`
- missing, invalid, expired, revoked, or wrong-audience token -> `401`

## Legacy SSE No-Auth

Open the SSE stream:

```bash
curl -N http://127.0.0.1:3100/sse/none \
  -H 'accept: text/event-stream'
```

The stream emits an event like:

```text
event: endpoint
data: /sse/none/message?sessionId=...
```

POST JSON-RPC messages to the emitted endpoint:

```bash
curl -X POST 'http://127.0.0.1:3100/sse/none/message?sessionId=PASTE_SESSION_ID' \
  -H 'content-type: application/json' \
  -H 'accept: application/json, text/event-stream' \
  -H 'MCP-Protocol-Version: 2025-06-18' \
  -d '{"jsonrpc":"2.0","id":"sse-list","method":"tools/list"}'
```

The SSE stream receives:

```text
event: message
data: {"jsonrpc":"2.0","id":"sse-list","result":...}
```

## Legacy SSE Basic And OAuth

Basic SSE:

```bash
curl -N http://127.0.0.1:3100/sse/basic \
  -H 'accept: text/event-stream' \
  -H 'authorization: Basic ZGVmYXVsdDpkZWZhdWx0'
```

OAuth SSE:

```bash
curl -N http://127.0.0.1:3100/sse/oauth \
  -H 'accept: text/event-stream' \
  -H "authorization: Bearer $TOKEN"
```

Use the emitted `/message?sessionId=...` endpoint for JSON-RPC POSTs.

## REST Tool API

List enabled tools:

```bash
curl http://127.0.0.1:3100/rest/tools
```

Call `echo`:

```bash
curl -X POST http://127.0.0.1:3100/rest/tools/echo/call \
  -H 'content-type: application/json' \
  -d '{"arguments":{"message":"hello"}}'
```

Call with Basic:

```bash
curl -u default:default http://127.0.0.1:3100/rest/tools
```

Call with Bearer:

```bash
curl http://127.0.0.1:3100/rest/tools \
  -H "authorization: Bearer $TOKEN"
```

## OAuth Authorization-Code Flow

Open an authorization URL:

```text
http://127.0.0.1:3100/oauth/authorize?response_type=code&client_id=default&redirect_uri=http%3A%2F%2Flocalhost%3A3000%2Foauth%2Fcallback&resource=http%3A%2F%2F127.0.0.1%3A3100&state=demo
```

Then:

1. Log in with `default` / `default`.
2. Select endpoint permissions.
3. Copy `code` from the redirect URL.
4. Exchange the code:

```bash
curl -X POST http://127.0.0.1:3100/oauth/token \
  -H 'content-type: application/x-www-form-urlencoded' \
  -d 'grant_type=authorization_code' \
  -d 'code=PASTE_CODE_HERE' \
  -d 'redirect_uri=http://localhost:3000/oauth/callback' \
  -d 'client_id=default' \
  -d 'client_secret=default'
```

PKCE S256 is supported. The standalone Inspector OAuth popup flow uses PKCE automatically.

## OAuth Revocation

Standard OAuth revocation endpoint:

```bash
curl -X POST http://127.0.0.1:3100/oauth/revoke \
  -H 'content-type: application/x-www-form-urlencoded' \
  -d 'client_id=default' \
  -d 'client_secret=default' \
  -d "token=$TOKEN"
```

Admin issued-token revocation is available from `/tokens` and `/api/oauth/tokens/{jti}/revoke`.

## CORS And Browser Inspectors

MCP Mock Server is intentionally permissive for mock testing. MCP, SSE, REST, OAuth metadata, JWKS, token, and revocation surfaces expose browser-friendly CORS headers so tools such as upstream MCP Inspector can call local and hosted targets.

Do not treat CORS openness as a production security model. This is public mock infrastructure.

## Upstream Inspector Shortcuts

```bash
npm run inspector:mcp:none
npm run inspector:mcp:basic
npm run inspector:mcp:oauth
npm run inspector:mcp:sse
npm run inspector:cli:list
npm run inspector:cli:call:echo
npm run inspector:cli:resources:list
npm run inspector:cli:resources:read
npm run inspector:cli:resources:templates
npm run inspector:cli:prompts:list
npm run inspector:cli:prompts:get
npm run inspector:cli:basic:list
npm run inspector:cli:sse:list
npm run inspector:cli:sse:resources
npm run inspector:cli:sse:resources:read
```

Upstream Inspector CLI `0.21.2` does not expose `completion/complete`; use the project Generic target completion presets or upstream browser Inspector when your installed version supports Completion controls.

See [MCP Browser Inspector guide](../MCPBrowserInspector.md) for browser UI screenshots and [Inspector integration](INSPECTOR.md) for the full project Inspector model.

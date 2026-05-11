# MCP JSON-RPC Runtime

## Goal
Remote MCP routes implement initialize, initialized notification, tools/list, tools/call, strict auth aliases, and JSON-RPC error semantics.

## Trigger / Entry
MCP connection guide examples

## User-Visible Behavior
- MCP connection guide examples
- Unified /mcp route
- Strict /mcp/none, /mcp/basic, /mcp/oauth routes
- Tool listing and calling

## No-Auth Initialize and Tool Listing
- `/mcp` without `Authorization` and `/mcp/none` share the no-auth runtime path.
- `/mcp` with valid Basic credentials uses the Basic runtime path; invalid or malformed Basic headers and unsupported authorization schemes return HTTP `401` and never downgrade to no-auth.
- `/mcp` with a Bearer authorization header uses OAuth Bearer precedence; invalid, expired, revoked, wrong-issuer, or otherwise unverifiable Bearer tokens return HTTP `401` and never downgrade to no-auth or Basic.
- `/mcp/basic` is a strict Basic route: missing, malformed, or invalid Basic credentials return HTTP `401` with `WWW-Authenticate`, while valid Basic credentials may list and call all enabled endpoint tools.
- `/mcp/oauth` is a strict OAuth route: missing, malformed, invalid, expired, or revoked Bearer tokens return HTTP `401` with `WWW-Authenticate: Bearer`.
- Bearer `401` challenges on MCP routes include `resource_metadata` pointing to `/.well-known/oauth-protected-resource` so standard clients can discover the mock authorization-server metadata before retrying with a token.
- The server supports JSON-RPC over Streamable HTTP `POST`, lightweight Streamable HTTP `GET` SSE open events, and legacy SSE compatibility aliases at `/sse`, `/sse/none`, `/sse/basic`, and `/sse/oauth`.
- Legacy SSE aliases open a live `text/event-stream`, emit an `endpoint` event for the matching message POST URL, process JSON-RPC messages through the same MCP runtime as Streamable HTTP, and send JSON-RPC responses back over the stream as `message` events.
- SSE compatibility is intentionally in-memory and local-test oriented. It does not provide durable sessions, cross-process resumability, or production-grade event replay.
- MCP `POST` responses include the server protocol version header. Requests that provide an unsupported `MCP-Protocol-Version` header return HTTP `400` with a JSON-RPC invalid-request error; requests without that header remain accepted for compatibility with simple curl/Postman probes.
- MCP routes are intentionally CORS-open for browser-based tools such as the upstream MCP Inspector UI on `http://localhost:6274`. `POST` responses include `Access-Control-Allow-Origin: *` and expose MCP/auth/debug headers that browser clients need to read.
- MCP, SSE, REST, OAuth metadata, JWKS, token, and revocation routes answer browser preflight `OPTIONS` requests with HTTP `204`, `Access-Control-Allow-Methods: GET, POST, DELETE, OPTIONS`, and allow the standard MCP test headers, including `Authorization`, `Content-Type`, `Last-Event-ID`, `MCP-Session-Id`, and `MCP-Protocol-Version`.
- MCP clients should send `Accept: application/json, text/event-stream`; the MVP server is lenient and does not reject missing `Accept` headers because many manual test clients omit them.
- `initialize` returns protocol version `2025-06-18` when requested, otherwise the newest MVP-supported version from `2025-06-18` and `2025-03-26`.
- `initialize` advertises only the `tools` capability with `listChanged: false`; resources, prompts, logging, sampling, durable session, and resumability capabilities are not claimed.
- `serverInfo` is `name: "mina-mock-mcpserver"` and `version: "1.0.0"`.
- `notifications/initialized` is accepted as a JSON-RPC notification with HTTP `202` and no response body.
- `tools/list` returns enabled endpoint tools only, with each tool's name, description, and generated endpoint-domain `inputSchema`.
- `tools/list` for valid OAuth Bearer callers returns only enabled endpoint tools included in the token's endpoint permissions.
- `tools/call` on `/mcp` without credentials and `/mcp/none` executes enabled endpoints by name through the shared endpoint matcher. Exact response cases return MCP tool results with text content, and JSON-object responses also return `structuredContent`.
- `tools/call` for valid OAuth Bearer callers executes permitted endpoint tools and returns HTTP `403` with JSON-RPC error data when the token is valid but does not grant the requested endpoint.
- If no exact response case matches the supplied arguments, the configured default response case is returned. Unknown tools, disabled tools, malformed `tools/call` params, and endpoint argument validation failures return JSON-RPC `-32602` envelopes with HTTP `200`.
- Configured endpoint or response-case delays apply before MCP tool success, tool-error, or protocol-error responses and are bounded to 30000 ms.
- Response-case tool errors return MCP `tools/call` results with `isError: true`; endpoint-level or response-case protocol errors return JSON-RPC `-32000` errors with `protocol_error` data.
- Unsupported JSON-RPC methods return `-32601` with HTTP `200`.
- `GET` on MCP endpoints opens a lightweight SSE compatibility response. `DELETE` on Streamable HTTP MCP endpoints returns deterministic `405 Method Not Allowed` with `Allow: GET, POST, OPTIONS` because durable Streamable HTTP session termination is not implemented.
- Future MCP session persistence, resumability, and event replay must be designed and tested as a separate transport feature. The server must not advertise durable session capabilities before those runtime paths exist.

## Validation
- JSON-RPC parsing/formatting
- Unknown method/tool errors
- Notification empty response
- MCP content/structuredContent formatting
- Call initialize, list tools, call a configured tool, and observe route-specific auth behavior

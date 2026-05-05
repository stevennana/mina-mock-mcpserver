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
- The MVP server supports JSON-RPC over Streamable HTTP `POST`; it does not assign MCP sessions or expose SSE streams.
- `initialize` returns protocol version `2025-06-18` when requested, otherwise the newest MVP-supported version from `2025-06-18` and `2025-03-26`.
- `initialize` advertises only the `tools` capability with `listChanged: false`; resources, prompts, logging, sampling, and SSE/session capabilities are not claimed.
- `serverInfo` is `name: "mina-mock-mcpserver"` and `version: "1.0.0"`.
- `notifications/initialized` is accepted as a JSON-RPC notification with HTTP `202` and no response body.
- `tools/list` returns enabled endpoint tools only, with each tool's name, description, and generated endpoint-domain `inputSchema`.
- `tools/list` for valid OAuth Bearer callers returns only enabled endpoint tools included in the token's endpoint permissions.
- `tools/call` on `/mcp` without credentials and `/mcp/none` executes enabled endpoints by name through the shared endpoint matcher. Exact response cases return MCP tool results with text content, and JSON-object responses also return `structuredContent`.
- `tools/call` for valid OAuth Bearer callers executes permitted endpoint tools and returns HTTP `403` with JSON-RPC error data when the token is valid but does not grant the requested endpoint.
- If no exact response case matches the supplied arguments, the configured default response case is returned. Unknown tools, disabled tools, malformed `tools/call` params, and endpoint argument validation failures return JSON-RPC `-32602` envelopes with HTTP `200`.
- Unsupported JSON-RPC methods return `-32601` with HTTP `200`.
- `GET` and `DELETE` on the MVP MCP endpoints return deterministic `405 Method Not Allowed` responses with `Allow: POST`.

## Validation
- JSON-RPC parsing/formatting
- Unknown method/tool errors
- Notification empty response
- MCP content/structuredContent formatting
- Call initialize, list tools, call a configured tool, and observe route-specific auth behavior

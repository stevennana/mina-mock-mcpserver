# REST Mock API

## Goal
REST routes expose the same configured tools for simple curl/Postman/browser testing with consistent auth and error behavior.

## Trigger / Entry
REST example copy

## User-Visible Behavior
- REST example copy
- REST call from test console
- REST list and call routes
- `GET /rest/tools` returns simple JSON, not an MCP JSON-RPC envelope:
  - `tools`: enabled tools sorted by name
  - each tool includes `name`, `title`, `description`, and `parameters`
  - each parameter includes `name`, `label`, `description`, `type`, `required`, and `defaultValue` when configured
- `GET /rest/tools` allows no-auth callers and valid Basic callers to see all enabled endpoints.
- `GET /rest/tools` with a valid OAuth Bearer token returns only enabled endpoints included in the token's endpoint permissions.
- Invalid or unsupported `Authorization` headers return `401` with `WWW-Authenticate`; invalid, expired, revoked, or unverifiable Bearer tokens return `401` and never downgrade to no-auth or Basic.
- `POST /rest/tools/:name/call` accepts `{ "arguments": { ... } }` and executes the same endpoint matcher used by MCP tool calls.
- Successful REST calls return the configured mock response body directly with the configured status code, not a JSON-RPC envelope.
- REST call responses include same-origin evidence headers for the admin console:
  - `X-MCP-Mock-Matched-Case` when a response case matched
  - `X-MCP-Mock-Principal` as `anonymous` or `basic:<username>`
- REST call errors use simple JSON bodies:
  - `401 { "error": "unauthorized", "message": "Authorization header was invalid." }`
  - `403 { "error": "forbidden", "message": "Bearer token does not grant permission for this endpoint.", "tool": "<tool name>" }`
  - `400 { "error": "invalid_json", "message": "Request body must be valid JSON." }`
  - `404 { "error": "tool_not_found", "message": "Tool was not found or is disabled." }`
  - `422 { "error": "invalid_arguments", "message": "<matcher validation message>" }`
  - response-case forced errors return the configured status and configured error body, or `{ "error": "tool_error", "message": "<configured message>", "matchedCase": "<case name>" }` when no error body is configured.
  - endpoint or response-case protocol forced errors return the configured status and configured error body, or `{ "error": "protocol_error", "message": "<configured message>", "matchedCase": "<case name>" }` when no error body is configured.
- Configured endpoint or response-case delays apply only to the current call and are bounded to 30000 ms.

## Validation
- REST error mapping
- Argument normalization
- Auth principal propagation
- List tools and call a tool via REST in no-auth, Basic, and OAuth modes

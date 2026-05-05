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
- The MVP server supports JSON-RPC over Streamable HTTP `POST`; it does not assign MCP sessions or expose SSE streams.
- `initialize` returns protocol version `2025-06-18` when requested, otherwise the newest MVP-supported version from `2025-06-18` and `2025-03-26`.
- `initialize` advertises only the `tools` capability with `listChanged: false`; resources, prompts, logging, sampling, and SSE/session capabilities are not claimed.
- `serverInfo` is `name: "mina-mock-mcpserver"` and `version: "1.0.0"`.
- `notifications/initialized` is accepted as a JSON-RPC notification with HTTP `202` and no response body.
- `tools/list` returns enabled endpoint tools only, with each tool's name, description, and generated endpoint-domain `inputSchema`.
- `GET` and `DELETE` on the MVP MCP endpoints return deterministic `405 Method Not Allowed` responses with `Allow: POST`.

## Validation
- JSON-RPC parsing/formatting
- Unknown method/tool errors
- Notification empty response
- MCP content/structuredContent formatting
- Call initialize, list tools, call a configured tool, and observe route-specific auth behavior

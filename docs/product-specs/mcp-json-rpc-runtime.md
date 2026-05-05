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

## Validation
- JSON-RPC parsing/formatting
- Unknown method/tool errors
- Notification empty response
- MCP content/structuredContent formatting
- Call initialize, list tools, call a configured tool, and observe route-specific auth behavior

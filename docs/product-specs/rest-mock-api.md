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
- Invalid or unsupported `Authorization` headers return `401` with `WWW-Authenticate`; OAuth bearer filtering is handled by a later permissions slice.

## Validation
- REST error mapping
- Argument normalization
- Auth principal propagation
- List tools and call a tool via REST in no-auth, Basic, and OAuth modes

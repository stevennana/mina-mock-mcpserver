# MCP Initialize and Tools List No-Auth Runtime

```json taskmeta
{
  "id": "mcp-initialize-and-tools-list",
  "title": "MCP Initialize and Tools List No-Auth Runtime",
  "order": 7,
  "status": "completed",
  "next_task_on_success": "mcp-tools-call-and-errors",
  "prompt_docs": [
    "AGENTS.md",
    "ARCHITECTURE.md",
    "docs/PRODUCT_SENSE.md",
    "docs/RELIABILITY.md",
    "docs/product-specs/mcp-json-rpc-runtime.md"
  ],
  "required_commands": [
    "npm run test:unit",
    "npm run test:e2e -- --grep @mcp-initialize-list",
    "npm run verify"
  ],
  "required_files": [],
  "human_review_triggers": [
    "The task broadens into unrelated feature fronts.",
    "Required checks do not prove the claimed behavior.",
    "Implementation changes contradict the product spec or security/reliability docs."
  ],
  "promotion_mode": "deterministic",
  "completed_at": "2026-05-05T10:39:05.356Z"
}
```

## Objective

Implement no-auth MCP JSON-RPC initialization and tool discovery before adding tool execution.

## Clarity notes

- This is the first MCP runtime slice and should not attempt to finish all MCP behavior.
- `/mcp` without Authorization and `/mcp/none` should share the no-auth path.
- Tool listing should read enabled endpoints and generated input schemas from existing domain services.
- Unsupported Streamable HTTP methods can be explicit MVP responses.

## Expected result

- MCP clients can call `initialize` and receive server info/capabilities.
- MCP clients can send `notifications/initialized` and receive the expected no-body/accepted behavior.
- `tools/list` returns enabled endpoint tools for no-auth callers.
- GET/DELETE unsupported behavior is deterministic if SSE/session support is absent.

## Objections / risks to avoid

- Do not implement `tools/call` in this task.
- Do not add Basic/OAuth auth handling beyond preserving no-auth behavior.
- Do not handcraft schemas instead of using endpoint domain schema generation.
- Do not claim SSE support if it is not implemented.

## Scope

- Implement POST handling for `initialize`, `notifications/initialized`, and `tools/list` on `/mcp` and `/mcp/none`.
- Return JSON-RPC compliant responses and HTTP statuses for these methods.
- Expose enabled endpoint names/descriptions/input schemas in tool listings.
- Add unit and E2E coverage tagged `@mcp-initialize-list`.

## Out of scope

- `tools/call` execution.
- Unknown tool/call errors.
- Basic Auth and OAuth routes.
- SSE streaming/session management.

## Exit criteria

1. `initialize` response matches documented protocol version/serverInfo/capability decisions.
2. `notifications/initialized` returns accepted/no-body behavior.
3. `tools/list` reflects enabled endpoints and hides disabled ones.
4. `@mcp-initialize-list` passes.
5. All required checks pass.

## Required checks

- npm run test:unit
- npm run test:e2e -- --grep @mcp-initialize-list
- npm run verify

## Implementation notes

- Keep JSON-RPC adapter code separate from domain services.

## Docs to update

- docs/PRODUCT_SENSE.md
- docs/RELIABILITY.md

## Evaluator notes

Required commands are mandatory promotion gates, not suggestions.
Do not promote if any required check fails.
Do not accept broad feature work outside this task.
Confirm that this task maps to the primary product spec `mcp-json-rpc-runtime.md` or is explicitly final hardening.

## Progress log

- Start here. Append timestamped progress notes as work lands.
- Note when existing partial implementations were found and reused instead of replaced.
- 2026-05-05T10:31:06.589Z: restored as current task after root-reset-defaults promotion.
- 2026-05-05T10:33:14Z: found no existing MCP route implementation; reused the existing endpoint domain `generateMcpInputSchema` helper for tools/list rather than creating protocol-local schemas.
- 2026-05-05T10:33:14Z: added stateless no-auth MCP handlers for `/mcp` and `/mcp/none`, documented MVP protocol/capability decisions, and added unit plus `@mcp-initialize-list` E2E coverage.
- 2026-05-05T10:39:05.356Z: automatically promoted after deterministic checks and evaluator approval.

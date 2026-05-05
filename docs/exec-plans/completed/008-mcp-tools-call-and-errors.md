# MCP Tools Call and Error Semantics

```json taskmeta
{
  "id": "mcp-tools-call-and-errors",
  "title": "MCP Tools Call and Error Semantics",
  "order": 8,
  "status": "completed",
  "next_task_on_success": "basic-auth-users-domain-ui",
  "prompt_docs": [
    "AGENTS.md",
    "ARCHITECTURE.md",
    "docs/PRODUCT_SENSE.md",
    "docs/RELIABILITY.md",
    "docs/product-specs/mcp-json-rpc-runtime.md"
  ],
  "required_commands": [
    "npm run test:unit",
    "npm run test:e2e -- --grep @mcp-tools-call",
    "npm run verify"
  ],
  "required_files": [],
  "human_review_triggers": [
    "The task broadens into unrelated feature fronts.",
    "Required checks do not prove the claimed behavior.",
    "Implementation changes contradict the product spec or security/reliability docs."
  ],
  "promotion_mode": "deterministic",
  "completed_at": "2026-05-05T10:49:01.250Z"
}
```

## Objective

Implement no-auth MCP `tools/call` execution and JSON-RPC error semantics using the endpoint matcher.

## Clarity notes

- This task completes no-auth MCP tool execution after list/initialize already work.
- MCP success and error envelopes are protocol contracts, not REST responses.
- Endpoint matching should remain shared with REST later.
- This task can include unknown method behavior because it belongs to protocol error semantics.

## Expected result

- `tools/call` executes exact-match endpoint response cases.
- Successful MCP responses include text content and structuredContent when appropriate.
- Unknown method, invalid params, unknown tool, no-match, and endpoint disabled behavior are deterministic.
- E2E coverage proves a configured tool can be called through `/mcp/none`.

## Objections / risks to avoid

- Do not duplicate response-case matching logic inside MCP handlers.
- Do not return REST-style error bodies from JSON-RPC routes.
- Do not add Basic/OAuth authorization here.
- Do not implement failure simulation modes beyond existing domain outcomes unless already available.

## Scope

- Implement `tools/call` for no-auth MCP routes.
- Map matcher outcomes to MCP success, tool execution error, or JSON-RPC protocol error as documented.
- Add unit tests for response conversion and error mapping.
- Add E2E coverage tagged `@mcp-tools-call` for success and negative cases.

## Out of scope

- Auth-specific MCP aliases.
- REST routes.
- OAuth permission denial.
- Failure simulation runtime not already represented by matcher outcomes.

## Exit criteria

1. Configured endpoint calls return expected MCP content.
2. Unknown tool uses JSON-RPC `-32602` or documented chosen behavior.
3. Unsupported methods return `-32601`.
4. No-match behavior is deterministic and tested.
5. All required checks pass.

## Required checks

- npm run test:unit
- npm run test:e2e -- --grep @mcp-tools-call
- npm run verify

## Implementation notes

- Keep HTTP status choices documented for protocol errors.

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
- 2026-05-05T10:39:05.356Z: restored as current task after mcp-initialize-and-tools-list promotion.
- 2026-05-05T10:44:37Z: found initialize/tools-list MCP adapter and endpoint schema helpers already implemented, but no reusable endpoint call matcher in the current tree; added shared endpoint runtime matching and no-auth MCP `tools/call` protocol mapping.
- 2026-05-05T10:44:37Z: documented no-auth `tools/call` success, default no-match fallback, JSON-RPC `-32602` invalid/unknown-tool behavior, and `-32601` unsupported-method behavior; added unit and `@mcp-tools-call` E2E coverage.
- 2026-05-05T10:49:01.250Z: automatically promoted after deterministic checks and evaluator approval.

# MCP Resources Runtime

```json taskmeta
{
  "id": "mcp-resources-runtime",
  "title": "MCP Resources Runtime",
  "order": 31,
  "status": "queued",
  "next_task_on_success": "mcp-prompts-completion-runtime",
  "prompt_docs": [
    "AGENTS.md",
    "ARCHITECTURE.md",
    "docs/RELIABILITY.md",
    "docs/SECURITY.md",
    "docs/product-specs/mcp-json-rpc-runtime.md",
    "docs/product-specs/mcp-resources-prompts.md"
  ],
  "required_commands": [
    "npm run lint",
    "npm run typecheck",
    "npm run test:unit -- tests/unit/mcp-protocol.test.ts tests/unit/mcp-resources-runtime.test.ts",
    "npm run test:e2e -- tests/e2e/mcp-resources.spec.ts",
    "npx -y @modelcontextprotocol/inspector@0.21.2 --cli http://127.0.0.1:3100/mcp/none --transport http --method resources/list"
  ],
  "required_files": [],
  "human_review_triggers": [
    "The task broadens into unrelated MCP feature fronts.",
    "Required checks do not prove the claimed behavior.",
    "Implementation changes contradict the product spec or security/reliability docs."
  ],
  "promotion_mode": "deterministic_only"
}
```

## Objective
Implement MCP Resources runtime methods over existing Streamable HTTP and legacy SSE transports.

## Clarity notes
- This is the first slice that may advertise the `resources` capability.
- Runtime must reuse the current auth resolution and MCP response helpers.
- No OAuth filtering is added here; OAuth-specific filtering lands in task 033.

## Scope
- Extend `initialize` capabilities with `resources: { subscribe: true, listChanged: true }`.
- Implement `resources/list`, `resources/templates/list`, and `resources/read` for no-auth and Basic routes.
- Implement direct-resource and rendered-template reads through the domain service.
- Return JSON-RPC `-32002` for inaccessible/not-found resource URIs and `-32602` for malformed params.
- Ensure `/mcp`, `/mcp/none`, `/mcp/basic`, `/sse`, `/sse/none`, and `/sse/basic` share behavior.

## Out of scope
- Prompts and completion runtime.
- OAuth permission filtering.
- Durable subscription notification delivery.

## Expected result
- A standard MCP client can initialize, list resources/templates, and read seeded or configured resources.
- Existing tools/list and tools/call tests still pass.

## Exit criteria
- A standard MCP client can initialize, list resources/templates, and read seeded or configured resources.
- Existing tools/list and tools/call tests still pass.

## Objections / risks to avoid
- Do not duplicate MCP adapters per transport.
- Do not claim resources before handlers and tests exist.
- Do not return HTTP 404 for JSON-RPC resource misses; use MCP error envelopes.

## Required checks
- `npm run lint`
- `npm run typecheck`
- `npm run test:unit -- tests/unit/mcp-protocol.test.ts tests/unit/mcp-resources-runtime.test.ts`
- `npm run test:e2e -- tests/e2e/mcp-resources.spec.ts`
- `npx -y @modelcontextprotocol/inspector@0.21.2 --cli http://127.0.0.1:3100/mcp/none --transport http --method resources/list`

## Evaluator notes

- Confirm the task stays inside its declared slice.
- Confirm required commands are treated as promotion-blocking gates.

## Progress log

- 2026-05-13T00:00:00Z: seeded as part of MCP Resources/Prompts next-wave planning.

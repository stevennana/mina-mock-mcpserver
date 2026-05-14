# MCP Runtime Core JSON-RPC Foundation

```json taskmeta
{
  "id": "mcp-runtime-core-json-rpc",
  "title": "MCP Runtime Core JSON-RPC Foundation",
  "order": 37,
  "status": "completed",
  "next_task_on_success": "mcp-runtime-resources-json-rpc",
  "prompt_docs": [
    "AGENTS.md",
    "ARCHITECTURE.md",
    "docs/design-docs/mcp-runtime-library-architecture.md",
    "docs/product-specs/mcp-json-rpc-runtime.md",
    "docs/product-specs/mcp-resources-prompts.md",
    "docs/RELIABILITY.md"
  ],
  "required_commands": [
    "npm run lint",
    "npm run typecheck",
    "npm run mcp-runtime:build",
    "npm run mcp-runtime:test"
  ],
  "required_files": [
    "packages/mcp-runtime/src/core.ts",
    "packages/mcp-runtime/src/types.ts",
    "packages/mcp-runtime/src/index.ts"
  ],
  "human_review_triggers": [
    "Core code imports HTTP, Next.js, Prisma, or Mock Server modules.",
    "Capability advertisement claims optional methods without provider support.",
    "Provider errors are thrown instead of mapped through typed outcomes."
  ],
  "promotion_mode": "deterministic_only",
  "completed_at": "2026-05-14T07:19:40.332Z"
}
```

## Objective
Implement the reusable JSON-RPC envelope, initialization, capability derivation, and error-mapping foundation in `@minasoft/mcp-runtime` before adding individual MCP feature families.

## Scope
- Implement core message handling for JSON-RPC request envelopes, explicit batch non-support, notifications, `initialize`, invalid params, provider protocol errors, forbidden/not-found helpers, and unsupported methods.
- Derive advertised capabilities from the provider shape without dispatching feature-specific methods yet.
- Define reusable internal helpers for provider result mapping so resources, tools, prompts, and completion tasks do not each invent their own JSON-RPC error shape.
- Add package unit tests for `initialize`, initialized notifications, invalid JSON-RPC envelopes, unsupported methods, provider error mapping, and capability advertisement with no optional providers.

## Out of Scope
- `resources/*`, `tools/*`, `prompts/*`, and `completion/complete` method dispatch.
- Fetch `Request`/`Response` adapter.
- Mock Server app migration.
- App-level auth, CORS, SSE session storage, OAuth challenges, and audit logging.

## Exit Criteria
- Package core tests prove the reusable envelope and initialization behavior independently from the app.
- Core source depends only on package-owned modules.
- Existing package foundation tests still pass.
- Feature-family methods intentionally return method-not-found until later tasks add provider dispatch.

## Required Checks
- `npm run lint`
- `npm run typecheck`
- `npm run mcp-runtime:build`
- `npm run mcp-runtime:test`

## Evaluator Notes
- Confirm core behavior is provider-driven and not hard-coded to Mock Server fixtures.
- Confirm optional feature methods are not half-implemented in this task.

## Progress Log
- 2026-05-14T00:00:00Z: seeded as the reusable JSON-RPC core task.

## Progress log

- 2026-05-14T07:13:35.309Z: restored as current task after mcp-runtime-package-foundation promotion.
- 2026-05-14T07:17:51Z: implemented package core JSON-RPC message handling, provider-derived initialize capabilities, reusable JSON-RPC/provider error helpers, batch non-support, notification acceptance, and focused package unit coverage. Required checks passed: `npm run lint`, `npm run typecheck`, `npm run mcp-runtime:build`, and `npm run mcp-runtime:test`.
- 2026-05-14T07:19:40.332Z: automatically promoted after deterministic checks and evaluator approval.

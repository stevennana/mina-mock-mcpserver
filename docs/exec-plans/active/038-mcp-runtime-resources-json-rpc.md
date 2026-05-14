# MCP Runtime Resources JSON-RPC

```json taskmeta
{
  "id": "mcp-runtime-resources-json-rpc",
  "title": "MCP Runtime Resources JSON-RPC",
  "order": 38,
  "status": "active",
  "next_task_on_success": "mcp-runtime-tools-prompts-json-rpc",
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
    "Resource runtime imports HTTP, Next.js, Prisma, or Mock Server modules.",
    "Pagination behavior is hard-coded to Mock Server storage details.",
    "Resource provider errors are thrown instead of mapped through typed outcomes."
  ],
  "promotion_mode": "deterministic_only"
}
```

## Objective
Add provider-driven MCP resource, resource template, and resource subscription JSON-RPC handling to the reusable runtime package.

## Scope
- Implement `resources/list`, `resources/read`, `resources/templates/list`, `resources/subscribe`, and `resources/unsubscribe` dispatch on top of the core handler.
- Preserve provider-owned cursor pagination and expose optional offset pagination helpers without forcing storage policy on consumers.
- Map not-found, forbidden, invalid params, unsupported subscription, and provider protocol errors through package-owned MCP error responses.
- Add package unit tests for resource list/read success, template listing, cursor pagination, not-found reads, forbidden reads, unsupported subscriptions, and subscription method gating when the provider does not advertise support.

## Out of Scope
- Tool, prompt, and completion dispatch.
- Fetch `Request`/`Response` adapter.
- Mock Server app migration.
- App-level auth, CORS, SSE session storage, OAuth challenges, and audit logging.

## Exit Criteria
- Resource and template tests pass using only package-owned provider fixtures.
- Resource capabilities are advertised only when the provider supplies matching support.
- Package core foundation tests still pass.

## Required Checks
- `npm run lint`
- `npm run typecheck`
- `npm run mcp-runtime:build`
- `npm run mcp-runtime:test`

## Evaluator Notes
- Confirm resources are generic content-provider behavior, not Mock Server catalog behavior.
- Confirm subscription support is optional and deterministic when absent.

## Progress Log
- 2026-05-14T00:00:00Z: split out from the broad reusable JSON-RPC core task.

## Progress log

- 2026-05-14T07:19:40.332Z: restored as current task after mcp-runtime-core-json-rpc promotion.
- 2026-05-14T07:23:38Z: added provider-driven resource list/read/template/subscription JSON-RPC handling, optional offset pagination helpers, and package unit coverage for success, pagination, provider errors, unsupported subscriptions, and subscription gating.

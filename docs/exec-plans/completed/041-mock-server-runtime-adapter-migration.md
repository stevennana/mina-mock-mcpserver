# Mock Server Runtime Adapter Migration

```json taskmeta
{
  "id": "mock-server-runtime-adapter-migration",
  "title": "Mock Server Runtime Adapter Migration",
  "order": 41,
  "status": "completed",
  "next_task_on_success": "mcp-runtime-inspector-docs-hardening",
  "prompt_docs": [
    "AGENTS.md",
    "ARCHITECTURE.md",
    "docs/design-docs/mcp-runtime-library-architecture.md",
    "docs/product-specs/mcp-json-rpc-runtime.md",
    "docs/product-specs/mcp-resources-prompts.md",
    "docs/RELIABILITY.md",
    "docs/SECURITY.md"
  ],
  "required_commands": [
    "npm run lint",
    "npm run typecheck",
    "npm run mcp-runtime:build",
    "npm run mcp-runtime:test",
    "npm run test:unit -- tests/unit/mcp-protocol.test.ts tests/unit/mcp-resources-runtime.test.ts tests/unit/mcp-prompts-runtime.test.ts tests/unit/mcp-permissions.test.ts"
  ],
  "required_files": [
    "lib/mcp/http.ts",
    "lib/mcp/runtime-provider.ts",
    "tests/unit/mcp-runtime-import-guard.test.ts"
  ],
  "human_review_triggers": [
    "Mock Server keeps active imports from old app-local MCP protocol/type modules.",
    "Auth, CORS, SSE, or audit behavior is moved into the package.",
    "Existing MCP runtime behavior changes without matching product spec updates."
  ],
  "promotion_mode": "deterministic_only",
  "completed_at": "2026-05-14T07:48:02.208Z"
}
```

## Objective
Migrate MCP Mock Server to consume `@minasoft/mcp-runtime` for reusable JSON-RPC protocol handling while keeping app-owned auth, persistence, SSE, and audit behavior unchanged.

## Scope
- Add app-owned adapter code that maps endpoints, resources, resource templates, prompts, completion candidates, permissions, and endpoint call results into package provider outcomes.
- Put that adapter in `lib/mcp/runtime-provider.ts` so app-specific provider mapping is reviewable separately from transport/auth handling in `lib/mcp/http.ts`.
- Update `lib/mcp/http.ts` and MCP unit tests to import package types/core instead of `@/lib/mcp/protocol` and `@/lib/mcp/types`.
- Preserve no-auth, Basic, OAuth Bearer, strict route, malformed-response, protocol-error, tool-error, prompt, completion, resource, and subscription behavior.
- Remove old internal protocol/type modules or reduce them to non-active migration shims only if a same-task removal would be unsafe.
- Add `tests/unit/mcp-runtime-import-guard.test.ts` or an equivalent static unit guard so app/test code cannot keep using old app-local MCP protocol modules.

## Out of Scope
- Admin UI changes.
- Database schema changes.
- New MCP methods or new user-visible protocol behavior.
- Public npm publish automation.

## Exit Criteria
- Mock Server production route handlers use the package for JSON-RPC method handling.
- `lib/mcp/runtime-provider.ts` owns app-to-package provider mapping for endpoints, resources, templates, prompts, completion, permissions, and endpoint call outcomes.
- Existing targeted MCP unit tests pass through the migrated path.
- A static import guard fails if active app/test code imports `@/lib/mcp/protocol` or `@/lib/mcp/types`.
- Static search confirms active app/test code no longer imports `@/lib/mcp/protocol` or `@/lib/mcp/types`.

## Required Checks
- `npm run lint`
- `npm run typecheck`
- `npm run mcp-runtime:build`
- `npm run mcp-runtime:test`
- `npm run test:unit -- tests/unit/mcp-protocol.test.ts tests/unit/mcp-resources-runtime.test.ts tests/unit/mcp-prompts-runtime.test.ts tests/unit/mcp-permissions.test.ts`

## Evaluator Notes
- Confirm this is a real migration, not a package existing beside the old implementation.
- Confirm app-specific auth and transport policy remain in app code.
- Confirm the runtime provider adapter is narrow enough for downstream apps to understand what they need to implement without copying Mock Server persistence or UI code.

## Progress Log
- 2026-05-14T00:00:00Z: seeded as the first production app consumption task.

## Progress log

- 2026-05-14T07:35:29.412Z: restored as current task after mcp-runtime-http-consumer-fixture promotion.
- 2026-05-14T08:18:00Z: migrated `lib/mcp/http.ts` to dispatch through `@minasoft/mcp-runtime`, added `lib/mcp/runtime-provider.ts` for app-owned endpoint/resource/prompt/permission mapping, removed old app-local MCP protocol/type modules, and added a static import guard. Required lint, typecheck, package build/test, and targeted MCP unit checks passed.
- 2026-05-14T07:48:02.208Z: automatically promoted after deterministic checks and evaluator approval.
